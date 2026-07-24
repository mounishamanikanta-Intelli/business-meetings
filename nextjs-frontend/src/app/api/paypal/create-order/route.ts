import { NextRequest, NextResponse } from 'next/server';
import { writeClient } from '@/app/sanity/client';
import { sendEmail } from '@/app/lib/emailService';
import { getEmailConfig } from '@/app/utils/paymentReceiptEmailer';

interface CreateOrderRequest {
  amount: string;
  currency: string;
  registrationId: string;
  registrationData?: any;
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return response.ok ? data.access_token : null;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderRequest = await request.json();
    const { amount, currency = 'USD', registrationId } = body;

    if (!amount || !currency || !registrationId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, registrationId' },
        { status: 400 }
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount provided' }, { status: 400 });
    }

    const supportedCurrencies = ['USD', 'EUR', 'GBP'];
    if (!supportedCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json(
        {
          error: `Currency ${currency} is not supported by PayPal. Supported: ${supportedCurrencies.join(', ')}`,
          note: currency.toUpperCase() === 'INR' ? 'For INR payments, please use Razorpay.' : undefined,
        },
        { status: 400 }
      );
    }

    // Validate registration exists via writeClient
    console.log('🔍 Validating registration exists before creating PayPal order...');
    try {
      const existing = await writeClient.fetch(
        `*[_type == "conferenceRegistration" && (registrationId == $id || paypalOrderId == $id || razorpayOrderId == $id)][0]{ _id, registrationId, paymentStatus }`,
        { id: registrationId }
      );
      if (!existing) {
        return NextResponse.json(
          { error: 'Registration not found', message: 'Please complete the registration form before proceeding to payment', registrationId },
          { status: 404 }
        );
      }
      console.log('✅ Registration validated:', existing.registrationId);
    } catch (validationError) {
      console.warn('⚠️ Registration validation warning, continuing:', validationError);
    }

    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to authenticate with PayPal.' }, { status: 500 });
    }

    const baseUrl = getPayPalBaseUrl();
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: registrationId,
          amount: { currency_code: currency, value: amount },
          description: `Conference Registration - ID: ${registrationId}`,
          custom_id: registrationId,
        },
      ],
      application_context: {
        brand_name: 'Cardiology Conference',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/registration/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/registration`,
      },
    };

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': `${registrationId}-${Date.now()}`,
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('❌ PayPal order creation failed:', result);
      return NextResponse.json({ error: 'Failed to create PayPal order', details: result }, { status: response.status });
    }

    const paypalOrderId = result.id;
    console.log('✅ PayPal order created:', paypalOrderId);

    // Patch registration with paypalOrderId; registrationId stays stable
    try {
      const reg = await writeClient.fetch(
        `*[_type == "conferenceRegistration" && (registrationId == $id || paypalOrderId == $id)][0]{ _id }`,
        { id: registrationId }
      );
      if (reg?._id) {
        await writeClient
          .patch(reg._id)
          .set({
            paypalOrderId: paypalOrderId,
            paymentStatus: 'pending',
            lastUpdated: new Date().toISOString(),
          })
          .commit();
        console.log('✅ Registration patched with PayPal order ID:', paypalOrderId);
      }

      const sendOrderCreatedEmail = process.env.PAYPAL_ENVIRONMENT!=="sandbox";
      if (sendOrderCreatedEmail) {
        const email = await sendEmail({
          from: process.env.SMTP_USER,
          to: `${process.env.PAYMENT_MAIL_TO}`,
          subject: 'PayPal Order Created',
          html: getEmailContent(),
        });
        console.log('✅ Email sent successfully:', email);
      }
    } catch (patchError) {
      console.warn('⚠️ Failed to patch registration with PayPal order ID:', patchError);
    }

    return NextResponse.json({
      success: true,
      orderId: paypalOrderId,
      status: result.status,
      registrationId, // stable original registration ID
      links: result.links,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in create-order API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  return NextResponse.json({
    message: 'PayPal Create Order API',
    environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    configured: { clientId: !!clientId },
    baseUrl: getPayPalBaseUrl(),
  });
}
function getEmailContent(): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                      <div style="text-align: center; padding: 20px 0;">
                          <h2 style="color: #2c3e50; margin: 0;">🎉 Registration Confirmed</h2>
                      </div>

                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center;">
                          <p style="font-size: 16px; line-height: 1.6; margin: 0;">
                              Your registration for
                              <strong>${process.env.NEXT_PUBLIC_BASE_URL || 'Conference'}</strong>
                              has been successfully created.
                          </p>

                          <p style="font-size: 16px; line-height: 1.6; margin-top: 16px;">
                              Thank you for your support! 🎉
                          </p>
                      </div>

                      <div style="margin-top: 24px; text-align: center; font-size: 14px; color: #666;">
                          <p>
                              We look forward to welcoming you to the conference.
                          </p>
                      </div>
                  </div>`
}

