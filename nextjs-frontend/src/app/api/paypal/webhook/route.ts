import { NextRequest, NextResponse } from 'next/server';
import { writeClient, client } from '@/app/sanity/client';
import { paypalService } from '@/app/services/paypalService';

const HANDLED_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.REFUNDED',
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.ORDER.COMPLETED',
];

async function findRegistrationByCustomId(customId: string) {
  return client.fetch(
    `*[_type == "conferenceRegistration" && (registrationId == $id || paypalOrderId == $id || _id == $id)][0]{
      _id,
      registrationId,
      personalDetails,
      selectedRegistrationName,
      sponsorType,
      accommodationType,
      accommodationNights,
      numberOfParticipants,
      numberOfAccompanyingPersons,
      checkInDate,
      checkOutDate,
      pricing,
      paymentStatus,
      paypalOrderId
    }`,
    { id: customId }
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 PayPal webhook received at:', new Date().toISOString());

    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    let webhookEvent: any;
    try {
      webhookEvent = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('🔔 Webhook event_type:', webhookEvent.event_type);

    // Verify webhook signature
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (webhookId) {
      try {
        const isValid = await paypalService.verifyWebhookSignature(headers, body, webhookId);
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        console.log('✅ Webhook signature verified');
      } catch (verificationError: any) {
        console.warn('⚠️ Signature verification warning, continuing:', verificationError.message);
      }
    } else {
      console.warn('⚠️ PAYPAL_WEBHOOK_ID not configured — skipping signature verification');
    }

    if (!HANDLED_EVENTS.includes(webhookEvent.event_type)) {
      console.log('ℹ️ Unhandled event type, acknowledging:', webhookEvent.event_type);
      return NextResponse.json({ received: true });
    }

    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(webhookEvent);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePaymentCaptureDenied(webhookEvent);
        break;
      case 'PAYMENT.CAPTURE.PENDING':
        await handlePaymentCapturePending(webhookEvent);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentCaptureRefunded(webhookEvent);
        break;
      case 'CHECKOUT.ORDER.APPROVED':
        await handleOrderApproved(webhookEvent);
        break;
      case 'CHECKOUT.ORDER.COMPLETED':
        await handleOrderCompleted(webhookEvent);
        break;
    }

    return NextResponse.json({ success: true, event_type: webhookEvent.event_type });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCaptureCompleted(webhookEvent: any) {
  try {
    const capture = webhookEvent.resource;
    const customId = capture.custom_id;
    const orderId = capture.supplementary_data?.related_ids?.order_id || customId;
    const captureId = capture.id;
    const amount = capture.amount?.value;
    const currency = capture.amount?.currency_code;

    console.log('✅ Payment capture completed:', { captureId, orderId, amount, currency, customId });

    if (!customId && !orderId) return;

    const registration = await findRegistrationByCustomId(customId || orderId);
    if (!registration) {
      console.warn('⚠️ No registration found for webhook customId/orderId:', customId || orderId);
      return;
    }

    // Idempotency check
    if (registration.paymentStatus === 'completed') {
      console.log('⚠️ Registration already completed, skipping update:', registration.registrationId);
      return;
    }

    await writeClient
      .patch(registration._id)
      .set({
        paymentStatus: 'completed',
        paymentMethod: 'paypal',
        paypalOrderId: orderId,
        paypalTransactionId: captureId,
        paidAmount: parseFloat(amount || '0'),
        paidCurrency: currency || 'USD',
        'pricing.currency': currency || 'USD',
        'pricing.totalPrice': parseFloat(amount || '0'),
        paymentDate: new Date().toISOString(),
        webhookProcessed: true,
        lastUpdated: new Date().toISOString(),
      })
      .commit();

    console.log('✅ Registration updated via webhook:', registration.registrationId);

    // Send email receipt via direct require()
    const customerEmail = registration.personalDetails?.email;
    if (customerEmail) {
      try {
        const { sendPaymentReceiptEmailWithRealData } = require('../../../utils/paymentReceiptEmailer');
        const paymentData = {
          transactionId: captureId || 'N/A',
          orderId: orderId || 'N/A',
          amount: parseFloat(amount || '0'),
          currency: currency || 'USD',
          paymentMethod: 'PayPal',
          paymentDate: new Date().toISOString(),
          status: 'completed',
          capturedAt: new Date().toISOString(),
        };
        await sendPaymentReceiptEmailWithRealData(paymentData, registration, customerEmail);
        console.log('✅ Webhook email sent to:', customerEmail);

        await writeClient
          .patch(registration._id)
          .set({
            receiptEmailSent: true,
            receiptEmailSentAt: new Date().toISOString(),
            receiptEmailRecipient: customerEmail,
          })
          .commit();
      } catch (emailError: any) {
        console.error('❌ Webhook email error (non-fatal):', emailError.message);
        await writeClient
          .patch(registration._id)
          .set({
            receiptEmailSent: false,
            receiptEmailError: emailError.message,
            receiptEmailAttemptedAt: new Date().toISOString(),
          })
          .commit();
      }
    }
  } catch (error) {
    console.error('❌ Error handling payment capture completed:', error);
  }
}

async function handlePaymentCaptureDenied(webhookEvent: any) {
  try {
    const capture = webhookEvent.resource;
    const customId = capture.custom_id;
    if (!customId) return;

    const registration = await findRegistrationByCustomId(customId);
    if (registration) {
      await writeClient
        .patch(registration._id)
        .set({
          paymentStatus: 'failed',
          paymentFailureReason: capture.status_details?.reason || 'Payment denied',
          webhookProcessed: true,
          lastUpdated: new Date().toISOString(),
        })
        .commit();
      console.log('✅ Registration updated with payment failure:', registration.registrationId);
    }
  } catch (error) {
    console.error('❌ Error handling payment capture denied:', error);
  }
}

async function handlePaymentCapturePending(webhookEvent: any) {
  try {
    const capture = webhookEvent.resource;
    const customId = capture.custom_id;
    if (!customId) return;

    const registration = await findRegistrationByCustomId(customId);
    if (registration) {
      await writeClient
        .patch(registration._id)
        .set({
          paymentStatus: 'pending',
          paymentPendingReason: capture.status_details?.reason || 'Payment pending',
          webhookProcessed: true,
          lastUpdated: new Date().toISOString(),
        })
        .commit();
      console.log('✅ Registration updated with payment pending:', registration.registrationId);
    }
  } catch (error) {
    console.error('❌ Error handling payment capture pending:', error);
  }
}

async function handlePaymentCaptureRefunded(webhookEvent: any) {
  try {
    const refund = webhookEvent.resource;
    const customId = refund.custom_id;
    if (!customId) return;

    const registration = await findRegistrationByCustomId(customId);
    if (registration) {
      await writeClient
        .patch(registration._id)
        .set({
          paymentStatus: 'refunded',
          refundId: refund.id,
          refundAmount: parseFloat(refund.amount?.value || '0'),
          refundDate: new Date().toISOString(),
          webhookProcessed: true,
          lastUpdated: new Date().toISOString(),
        })
        .commit();
      console.log('✅ Registration updated with refund:', registration.registrationId);
    }
  } catch (error) {
    console.error('❌ Error handling payment refund:', error);
  }
}

async function handleOrderApproved(webhookEvent: any) {
  try {
    const order = webhookEvent.resource;
    const customId = order.purchase_units?.[0]?.custom_id;
    if (!customId) return;

    const registration = await findRegistrationByCustomId(customId);
    if (registration) {
      await writeClient
        .patch(registration._id)
        .set({
          paymentStatus: 'approved',
          paypalOrderId: order.id,
          webhookProcessed: true,
          lastUpdated: new Date().toISOString(),
        })
        .commit();
      console.log('✅ Registration updated with order approval:', registration.registrationId);
    }
  } catch (error) {
    console.error('❌ Error handling order approved:', error);
  }
}

async function handleOrderCompleted(webhookEvent: any) {
  try {
    const order = webhookEvent.resource;
    const customId = order.purchase_units?.[0]?.custom_id;
    if (!customId) return;

    const registration = await findRegistrationByCustomId(customId);
    if (registration) {
      await writeClient
        .patch(registration._id)
        .set({
          orderStatus: 'completed',
          paypalOrderId: order.id,
          webhookProcessed: true,
          lastUpdated: new Date().toISOString(),
        })
        .commit();
      console.log('✅ Registration updated with order completion:', registration.registrationId);
    }
  } catch (error) {
    console.error('❌ Error handling order completed:', error);
  }
}
