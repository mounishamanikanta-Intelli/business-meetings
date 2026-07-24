import { NextRequest, NextResponse } from 'next/server';
import { writeClient, client } from '@/app/sanity/client';

interface PaymentWorkflowRequest {
  registrationId: string;
  paymentData: {
    transactionId?: string;
    orderId?: string;
    amount: string;
    currency: string;
    capturedAt: string;
    paymentMethod: string;
    // Razorpay aliases
    paymentId?: string;
    paymentOrderId?: string;
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
  };
  customerEmail?: string;
  autoSendEmail?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Complete Payment Workflow API called');

    const body: PaymentWorkflowRequest = await request.json();
    const { registrationId, paymentData, customerEmail, autoSendEmail = true } = body;

    if (!registrationId || !paymentData) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters', required: ['registrationId', 'paymentData'] },
        { status: 400 }
      );
    }

    // Normalise payment IDs across PayPal and Razorpay shapes
    const transactionId = paymentData.transactionId || paymentData.paymentId || paymentData.razorpay_payment_id || 'N/A';
    const orderId       = paymentData.orderId || paymentData.paymentOrderId || paymentData.razorpay_order_id || 'N/A';

    console.log('📋 Processing payment workflow for:', { registrationId, transactionId, amount: paymentData.amount, currency: paymentData.currency });

    // Step 1: Find registration — OR across registrationId / paypalOrderId / razorpayOrderId
    console.log('🔍 Step 1: Fetching registration details...');
    const registration = await client.fetch(
      `*[_type == "conferenceRegistration" && (registrationId == $id || paypalOrderId == $id || razorpayOrderId == $id)][0]{
        _id,
        registrationId,
        personalDetails,
        selectedRegistrationName,
        sponsorType,
        accommodationType,
        accommodationNights,
        checkInDate,
        checkOutDate,
        numberOfParticipants,
        numberOfAccompanyingPersons,
        pricing,
        paymentStatus,
        registrationDate,
        paypalOrderId,
        razorpayOrderId
      }`,
      { id: registrationId }
    );

    if (!registration) {
      console.error('❌ Registration not found for ID:', registrationId);
      return NextResponse.json(
        { success: false, error: 'Registration not found', searchedId: registrationId },
        { status: 404 }
      );
    }

    console.log('✅ Registration found:', registration._id);

    // Step 2: Update payment details + pricing fields
    console.log('💾 Step 2: Updating registration with payment details...');
    await writeClient
      .patch(registration._id)
      .set({
        paymentStatus: 'completed',
        paymentMethod: paymentData.paymentMethod,
        paypalTransactionId: transactionId,
        paypalOrderId: orderId,
        paidAmount: parseFloat(paymentData.amount),
        paidCurrency: paymentData.currency,
        'pricing.currency': paymentData.currency,
        'pricing.totalPrice': parseFloat(paymentData.amount),
        paymentCapturedAt: paymentData.capturedAt,
        paymentCompletedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        webhookProcessed: true,
      })
      .commit();

    console.log('✅ Registration updated with payment details');

    // Step 3: Generate PDF receipt
    console.log('📄 Step 3: Generating PDF receipt...');
    let pdfBuffer: Buffer | null = null;
    let pdfGenerated = false;
    let pdfSize = 0;

    try {
      const { generateUnifiedReceiptPDF } = require('@/app/utils/paymentReceiptEmailer');

      const unifiedReg = {
        registrationId: registration.registrationId,
        _id: registration._id,
        fullName: registration.personalDetails?.firstName && registration.personalDetails?.lastName
          ? `${registration.personalDetails.title ? registration.personalDetails.title + ' ' : ''}${registration.personalDetails.firstName} ${registration.personalDetails.lastName}`.trim()
          : 'N/A',
        email: registration.personalDetails?.email || 'N/A',
        phoneNumber: registration.personalDetails?.phoneNumber || 'N/A',
        country: registration.personalDetails?.country || 'N/A',
        address: registration.personalDetails?.fullPostalAddress || 'N/A',
        registrationType: registration.selectedRegistrationName || 'Regular Registration',
        sponsorType: registration.sponsorType,
        accommodationType: registration.accommodationType,
        accommodationNights: registration.accommodationNights,
        numberOfParticipants: registration.numberOfParticipants || 1,
        numberOfAccompanyingPersons: registration.numberOfAccompanyingPersons || 0,
        checkInDate: registration.checkInDate,
        checkOutDate: registration.checkOutDate,
        pricing: registration.pricing,
        personalDetails: registration.personalDetails,
      };

      pdfBuffer = await generateUnifiedReceiptPDF(
        { ...paymentData, transactionId, orderId },
        unifiedReg
      );

      if (pdfBuffer) {
        pdfGenerated = true;
        pdfSize = pdfBuffer.length;
        console.log(`✅ PDF generated successfully: ${pdfSize} bytes`);
      }
    } catch (pdfError) {
      console.error('❌ PDF generation failed:', pdfError);
    }

    // Step 4: Upload PDF to Sanity
    let pdfUploaded = false;
    let pdfAssetId: string | null = null;

    if (pdfBuffer) {
      console.log('📤 Step 4: Uploading PDF to Sanity CMS...');
      try {
        const { uploadPDFToSanity, updateRegistrationWithPDF } = require('@/app/utils/paymentReceiptEmailer');
        const filename = `receipt_${registrationId}_${transactionId}_${Date.now()}.pdf`;
        const pdfAsset = await uploadPDFToSanity(pdfBuffer, filename);
        if (pdfAsset) {
          const updateSuccess = await updateRegistrationWithPDF(registration._id, pdfAsset);
          pdfUploaded = updateSuccess;
          pdfAssetId = pdfAsset._id;
          console.log(`✅ PDF uploaded to Sanity: ${pdfAsset._id}`);
        }
      } catch (uploadError) {
        console.error('❌ PDF upload error:', uploadError);
      }
    }

    // Step 5: Send email via direct require() — no HTTP round-trip
    let emailSent = false;
    let emailError: string | null = null;
    let messageId: string | null = null;

    if (autoSendEmail) {
      console.log('📧 Step 5: Sending email receipt...');
      try {
        const { sendPaymentReceiptEmailWithRealData } = require('@/app/utils/paymentReceiptEmailer');
        const emailResult = await sendPaymentReceiptEmailWithRealData(
          { ...paymentData, transactionId, orderId },
          registration,
          customerEmail || registration.personalDetails?.email
        );

        if (emailResult.success) {
          emailSent = true;
          messageId = emailResult.messageId || null;
          console.log('✅ Email sent:', messageId);
        } else {
          emailError = emailResult.error || 'Unknown email error';
          console.error('❌ Email error:', emailError);
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Unknown email error';
        console.error('❌ Email sending error:', emailError);
      }
    }

    // Step 6: Update workflow status
    console.log('📊 Step 6: Updating registration with workflow results...');
    await writeClient
      .patch(registration._id)
      .set({
        receiptEmailSent: emailSent,
        receiptEmailSentAt: emailSent ? new Date().toISOString() : null,
        receiptEmailRecipient: customerEmail || registration.personalDetails?.email,
        receiptEmailError: emailError,
        pdfReceiptGenerated: pdfGenerated,
        pdfReceiptSize: pdfSize,
        pdfReceiptUploaded: pdfUploaded,
        pdfReceiptAssetId: pdfAssetId,
        workflowCompletedAt: new Date().toISOString(),
        workflowStatus: 'completed',
      })
      .commit();

    console.log('🎉 Payment workflow completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Payment workflow completed successfully',
      details: {
        registrationId,
        paymentStatus: 'completed',
        transactionId,
        orderId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        pdfGenerated,
        pdfSize,
        pdfUploaded,
        pdfAssetId,
        emailSent,
        emailRecipient: customerEmail || registration.personalDetails?.email,
        messageId,
        emailError,
        workflowCompletedAt: new Date().toISOString(),
        registrationUpdated: true,
        sanityRecordId: registration._id,
      },
    });
  } catch (error) {
    console.error('❌ Payment workflow error:', error);
    return NextResponse.json(
      { success: false, error: 'Payment workflow failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
