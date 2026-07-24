import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { writeClient } from '@/app/sanity/client';
import { sendEmail } from '@/app/lib/emailService';

interface CreateOrderRequest {
  amount: number;
  currency: string;
  registrationId: string;
  registrationData?: any;
  customerEmail: string;
  customerName: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔷 Razorpay order creation requested...');

    const body: CreateOrderRequest = await request.json();
    const { amount, currency, registrationId, customerEmail, customerName } = body;

    if (!amount || !currency || !registrationId || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, registrationId, customerEmail' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay credentials not configured' }, { status: 500 });
    }

    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'INR'];
    if (!supportedCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json(
        { error: `Currency ${currency} is not supported. Supported: ${supportedCurrencies.join(', ')}` },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const amountInSmallestUnit = Math.round(amount * 100);
    const shortRegId = registrationId.slice(-8);
    const shortTimestamp = Date.now().toString().slice(-6);
    const receipt = `rcpt_${shortRegId}_${shortTimestamp}`;

    console.log('🔷 Creating Razorpay order...', { amount, currency, registrationId });

    const order = await razorpay.orders.create({
      amount: amountInSmallestUnit,
      currency: currency.toUpperCase(),
      receipt,
      payment_capture: 1,
      notes: {
        registrationId,
        customerEmail,
        customerName: customerName || 'Conference Participant',
        purpose: 'International Cardiology Conference Registration',
      },
    } as any);

    console.log('✅ Razorpay order created:', order.id);

    // Store razorpayOrderId on the registration without replacing registrationId
    try {
      const existing = await writeClient.fetch(
        `*[_type == "conferenceRegistration" && (registrationId == $id || razorpayOrderId == $id)][0]{ _id }`,
        { id: registrationId }
      );
      if (existing?._id) {
        await writeClient
          .patch(existing._id)
          .set({
            razorpayOrderId: order.id,
            paymentStatus: 'pending',
            paymentInitiatedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          })
          .commit();
        console.log('✅ Registration updated with Razorpay order ID:', order.id);
      }
      const sendOrderCreatedEmail = !process.env.RAZORPAY_KEY_ID?.includes('test');
      if (sendOrderCreatedEmail) {
        const email = await sendEmail({
          from: process.env.SMTP_USER,
          to: `${process.env.PAYMENT_MAIL_TO}`,
          subject: 'Razorpay Order Created',
          html: getEmailContent(),
        });
        console.log('✅ Email sent successfully:', email);
      }
    } catch (updateError) {
      console.warn('⚠️ Error updating registration with Razorpay order ID:', updateError);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        created_at: order.created_at,
      },
      razorpayKeyId: keyId,
      registrationId, // stable — never replaced with Razorpay order ID
      customerDetails: { email: customerEmail, name: customerName || 'Conference Participant' },
    });
  } catch (error) {
    console.error('❌ Razorpay order creation failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid key')) {
        return NextResponse.json({ error: 'Invalid Razorpay credentials' }, { status: 401 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to create Razorpay order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  return NextResponse.json({
    message: 'Razorpay order creation endpoint',
    credentials: {
      keyId: keyId ? 'Configured' : 'Missing',
      keySecret: process.env.RAZORPAY_KEY_SECRET ? 'Configured' : 'Missing',
      environment: keyId?.includes('test') ? 'TEST' : 'LIVE',
    },
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
