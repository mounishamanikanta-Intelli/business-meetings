import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/app/sanity/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId, transactionId, orderId, amount, currency, capturedAt } = body;

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required' }, { status: 400 });
    }

    console.log('🔍 Fetching registration for PDF generation:', registrationId);

    const registrationDetails = await client.fetch(
      `*[_type == "conferenceRegistration" && (registrationId == $id || paypalOrderId == $id || razorpayOrderId == $id)][0]{
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
        registrationDate,
        paypalOrderId,
        paypalTransactionId,
        razorpayOrderId,
        razorpayPaymentId,
        paidAmount,
        paidCurrency,
        paymentMethod
      }`,
      { id: registrationId }
    );

    if (!registrationDetails) {
      console.error('❌ Registration not found for PDF generation:', registrationId);
      return NextResponse.json(
        { error: 'Registration not found for PDF generation', searchedId: registrationId },
        { status: 404 }
      );
    }

    console.log('✅ Registration found for PDF generation:', {
      _id: registrationDetails._id,
      registrationId: registrationDetails.registrationId,
      paymentStatus: registrationDetails.paymentStatus,
    });

    const { generateUnifiedReceiptPDF } = require('@/app/utils/paymentReceiptEmailer');

    const paymentData = {
      transactionId: transactionId || registrationDetails.paypalTransactionId || registrationDetails.razorpayPaymentId || 'N/A',
      orderId: orderId || registrationDetails.paypalOrderId || registrationDetails.razorpayOrderId || 'N/A',
      amount: amount ?? registrationDetails.paidAmount ?? registrationDetails.pricing?.totalPrice ?? '0.00',
      currency: currency || registrationDetails.paidCurrency || registrationDetails.pricing?.currency || 'USD',
      paymentDate: capturedAt || registrationDetails.registrationDate || new Date().toISOString(),
      status: 'Completed',
      paymentMethod: registrationDetails.paymentMethod || 'PayPal',
    };

    const unifiedRegistrationData = {
      registrationId: registrationDetails.registrationId,
      _id: registrationDetails._id,
      fullName: registrationDetails.personalDetails?.firstName && registrationDetails.personalDetails?.lastName
        ? `${registrationDetails.personalDetails.title ? registrationDetails.personalDetails.title + ' ' : ''}${registrationDetails.personalDetails.firstName} ${registrationDetails.personalDetails.lastName}`.trim()
        : 'N/A',
      email: registrationDetails.personalDetails?.email || 'N/A',
      phoneNumber: registrationDetails.personalDetails?.phoneNumber || 'N/A',
      country: registrationDetails.personalDetails?.country || 'N/A',
      address: registrationDetails.personalDetails?.fullPostalAddress || 'N/A',
      registrationType: registrationDetails.selectedRegistrationName || 'Regular Registration',
      sponsorType: registrationDetails.sponsorType,
      accommodationType: registrationDetails.accommodationType,
      accommodationNights: registrationDetails.accommodationNights,
      numberOfParticipants: registrationDetails.numberOfParticipants || 1,
      numberOfAccompanyingPersons: registrationDetails.numberOfAccompanyingPersons || 0,
      checkInDate: registrationDetails.checkInDate,
      checkOutDate: registrationDetails.checkOutDate,
      pricing: registrationDetails.pricing,
      personalDetails: registrationDetails.personalDetails,
    };

    const pdfBuffer = await generateUnifiedReceiptPDF(paymentData, unifiedRegistrationData);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Registration_Receipt_${registrationId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Error generating registration receipt PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
