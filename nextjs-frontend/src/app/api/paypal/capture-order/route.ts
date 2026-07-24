import { NextRequest, NextResponse } from 'next/server';
import { writeClient, client } from '@/app/sanity/client';

interface CaptureOrderRequest {
  orderId: string;
  registrationId: string;
}

function getPayPalBaseUrl(): string {
  const env = process.env.PAYPAL_ENVIRONMENT || process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT || 'sandbox';
  return env === 'production' || env === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return response.ok ? data.access_token : null;
}

async function findRegistration(registrationId: string, orderId: string) {
  const reg = await client.fetch(
    `*[_type == "conferenceRegistration" && (registrationId == $regId || paypalOrderId == $orderId)][0]{
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
      paymentStatus
    }`,
    { regId: registrationId, orderId }
  );
  return reg || null;
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
    console.log(`💰 Capturing PayPal payment (${env})...`);

    const body: CaptureOrderRequest = await request.json();
    const { orderId, registrationId } = body;

    if (!orderId || !registrationId) {
      return NextResponse.json({ error: 'Missing required fields: orderId, registrationId' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to authenticate with PayPal' }, { status: 500 });
    }

    const captureResponse = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': `${registrationId}-capture-${Date.now()}`,
      },
    });

    const result = await captureResponse.json();
    if (!captureResponse.ok) {
      console.error('❌ PayPal order capture failed:', result);
      return NextResponse.json({ error: 'Failed to capture PayPal payment', details: result }, { status: captureResponse.status });
    }

    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
    const transactionId = capture?.id;
    const amount = capture?.amount?.value;
    const currency = capture?.amount?.currency_code;
    const status = capture?.status;

    console.log(`✅ PayPal payment captured:`, { orderId, transactionId, amount, currency });

    // Find registration record
    let registrationRecord = await findRegistration(registrationId, orderId);
    let actualRegistrationId = registrationId;

    if (!registrationRecord && result?.payer?.email_address) {
      console.log('🔍 Searching for registration by payer email...');
      const emailReg = await client.fetch(
        `*[_type == "conferenceRegistration" && personalDetails.email == $email && paymentStatus == "pending"] | order(registrationDate desc)[0]{
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
          paymentStatus
        }`,
        { email: result.payer.email_address }
      );
      if (emailReg) {
        registrationRecord = emailReg;
        actualRegistrationId = emailReg.registrationId;
        await writeClient
          .patch(emailReg._id)
          .set({ paypalOrderId: orderId, paymentStatus: 'processing', lastUpdated: new Date().toISOString() })
          .commit();
        console.log('✅ Registration found by payer email and linked to PayPal order');
      }
    }

    if (!registrationRecord) {
      throw new Error(`Registration not found for ID: ${registrationId} or Order: ${orderId}`);
    }

    actualRegistrationId = registrationRecord.registrationId;

    // Update registration with payment completion + pricing fields
    await writeClient
      .patch(registrationRecord._id)
      .set({
        paymentStatus: 'completed',
        paymentMethod: 'paypal',
        paypalOrderId: orderId,
        paypalTransactionId: transactionId,
        paidAmount: parseFloat(amount || '0'),
        paidCurrency: currency,
        'pricing.currency': currency,
        'pricing.totalPrice': parseFloat(amount || '0'),
        paymentCapturedAt: new Date().toISOString(),
        paymentCompletedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        webhookProcessed: true,
      })
      .commit();

    console.log('✅ Registration updated with payment completion');

    // Send email receipt via direct require()
    try {
      const { sendPaymentReceiptEmailWithRealData } = require('@/app/utils/paymentReceiptEmailer');
      const emailPaymentData = {
        transactionId: transactionId || 'N/A',
        orderId: orderId || result.id || 'N/A',
        amount: amount || '0',
        currency: currency || 'USD',
        capturedAt: new Date().toISOString(),
        paymentMethod: 'PayPal',
        status: 'completed',
      };
      await sendPaymentReceiptEmailWithRealData(
        emailPaymentData,
        registrationRecord,
        registrationRecord.personalDetails?.email
      );
      console.log('✅ Email receipt sent for:', registrationRecord.personalDetails?.email);
    } catch (emailError: any) {
      console.error('❌ Email receipt error (non-fatal):', emailError.message);
    }

    const successUrl =
      `/registration/success?registration_id=${actualRegistrationId}` +
      `&transaction_id=${transactionId}&order_id=${orderId}` +
      `&amount=${amount}&currency=${currency}&payment_method=PayPal` +
      `&status=completed&captured_at=${encodeURIComponent(new Date().toISOString())}`;

    return NextResponse.json({
      success: true,
      orderId,
      transactionId,
      amount,
      currency,
      status,
      registrationId: actualRegistrationId,
      capturedAt: new Date().toISOString(),
      successUrl,
      redirectUrl: successUrl,
    });
  } catch (error) {
    console.error('❌ Error in capture-order API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
