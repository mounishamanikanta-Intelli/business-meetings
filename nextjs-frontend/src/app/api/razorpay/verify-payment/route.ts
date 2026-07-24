import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { writeClient } from '@/app/sanity/client';

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  registrationId: string;
  amount: number;
  currency: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔷 Razorpay payment verification requested...');

    const body: VerifyPaymentRequest = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId, amount, currency } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registrationId) {
      return NextResponse.json({ error: 'Missing required payment verification fields' }, { status: 400 });
    }

    // Verify HMAC signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const bodyToVerify = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(bodyToVerify)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid Razorpay payment signature');
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    console.log('✅ Razorpay payment signature verified');

    // Find registration — OR lookup on registrationId / razorpayOrderId
    const registration = await writeClient.fetch(
      `*[_type == "conferenceRegistration" && (registrationId == $id || razorpayOrderId == $orderId)][0]{
        _id,
        registrationId,
        personalDetails,
        paymentStatus
      }`,
      { id: registrationId, orderId: razorpay_order_id }
    );

    if (!registration) {
      console.error('❌ Registration not found for ID:', registrationId);
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.paymentStatus === 'completed') {
      console.log('⚠️ Payment already completed for registration:', registrationId);
      return NextResponse.json({ error: 'Payment already completed for this registration' }, { status: 400 });
    }

    // Update registration with canonical payment fields
    await writeClient
      .patch(registration._id)
      .set({
        paymentStatus: 'completed',
        paymentMethod: 'razorpay',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        paidAmount: amount,
        paidCurrency: currency,
        'pricing.currency': currency,
        'pricing.totalPrice': amount,
        paymentDate: new Date().toISOString(),
        webhookProcessed: true,
        lastUpdated: new Date().toISOString(),
      })
      .commit();

    console.log('✅ Registration updated with Razorpay payment details:', registration._id);

    // Trigger complete-workflow for email + PDF
    const customerEmail = registration.personalDetails?.email;
    if (customerEmail) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payment/complete-workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationId,
            paymentData: {
              transactionId: razorpay_payment_id,
              orderId: razorpay_order_id,
              amount: amount.toString(),
              currency,
              capturedAt: new Date().toISOString(),
              paymentMethod: 'Razorpay',
            },
            customerEmail,
          }),
        });
        console.log('✅ Complete-workflow triggered for Razorpay payment');
      } catch (workflowError) {
        console.error('❌ Complete-workflow error (non-fatal):', workflowError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      paymentDetails: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount,
        currency,
        registrationId,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Razorpay payment verification failed:', error);
    return NextResponse.json(
      { error: 'Payment verification failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Razorpay payment verification endpoint', usage: 'POST with payment verification data' });
}
