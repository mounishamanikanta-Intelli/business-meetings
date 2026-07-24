import { NextRequest, NextResponse } from 'next/server';
import { writeClient } from '@/app/sanity/client';

/**
 * Pre-Payment Registration Save API
 * Saves registration to Sanity BEFORE payment is processed
 * This ensures the registration exists when payment verification happens
 */

interface RegistrationData {
    registrationId: string;
    personalDetails: {
        title?: string;
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        country: string;
        fullPostalAddress: string;
    };
    selectedRegistration?: string;
    selectedRegistrationName?: string;
    sponsorType?: string;
    accommodationType?: string;
    accommodationNights?: string | number;
    numberOfParticipants?: number;
    pricing: {
        totalPrice: number;
        currency: string;
        breakdown?: any;
    };
}

export async function POST(request: NextRequest) {
    try {
        console.log('💾 Pre-payment registration save requested...');

        const body: RegistrationData = await request.json();
        const {
            registrationId,
            personalDetails,
            selectedRegistration,
            selectedRegistrationName,
            sponsorType,
            accommodationType,
            accommodationNights,
            numberOfParticipants,
            pricing
        } = body;

        // Validate required fields
        if (!registrationId || !personalDetails?.email || !personalDetails?.firstName) {
            console.error('❌ Missing required fields for registration');
            return NextResponse.json(
                { error: 'Missing required registration fields' },
                { status: 400 }
            );
        }

        console.log('📝 Saving registration:', {
            registrationId,
            email: personalDetails.email,
            name: `${personalDetails.firstName} ${personalDetails.lastName}`,
            amount: pricing?.totalPrice,
            currency: pricing?.currency
        });

        // Check if registration already exists
        const existingRegistration = await writeClient.fetch(
            `*[_type == "conferenceRegistration" && (registrationId == $regId ||
            razorpayOrderId == $regId ||
            paypalOrderId == $regId)][0]`,
            { regId: registrationId }
        );

        if (existingRegistration) {
            console.log('⚠️ Registration already exists, updating instead...');

            // Update existing registration
            const updateResult = await writeClient
                .patch(existingRegistration._id)
                .set({
                    personalDetails,
                    selectedRegistration,
                    selectedRegistrationName,
                    numberOfParticipants: numberOfParticipants || 1,
                    paymentStatus: 'pending',
                    lastUpdated: new Date().toISOString()
                })
                .commit();

            console.log('✅ Registration updated successfully:', updateResult._id);

            return NextResponse.json({
                success: true,
                registrationId: registrationId,
                sanityId: updateResult._id,
                message: 'Registration updated successfully'
            });
        }

        // Create new registration document
        const registrationDoc = {
            _type: 'conferenceRegistration',
            registrationId: registrationId,
            personalDetails: {
                title: personalDetails.title || 'Dr.',
                firstName: personalDetails.firstName,
                lastName: personalDetails.lastName,
                email: personalDetails.email,
                phoneNumber: personalDetails.phoneNumber,
                country: personalDetails.country,
                fullPostalAddress: personalDetails.fullPostalAddress
            },
            selectedRegistration: selectedRegistration || '',
            selectedRegistrationName: selectedRegistrationName || '',
            registrationType: selectedRegistrationName || 'regular',
            sponsorType: sponsorType || '',
            accommodationType: accommodationType || '',
            accommodationNights: accommodationNights || '',
            numberOfParticipants: numberOfParticipants || 1,
            pricing: {
                totalPrice: pricing.totalPrice,
                currency: pricing.currency,
                breakdown: pricing.breakdown || {}
            },
            paymentStatus: 'pending',
            paymentMethod: '',
            registrationDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            status: 'pending'
        };

        console.log('🔄 Creating registration document in Sanity...');

        const result = await writeClient.create(registrationDoc);

        console.log('✅ Registration saved successfully to Sanity:', result._id);

        return NextResponse.json({
            success: true,
            registrationId: registrationId,
            sanityId: result._id,
            message: 'Registration saved successfully'
        });

    } catch (error) {
        console.error('❌ Failed to save registration:', error);

        return NextResponse.json(
            {
                error: 'Failed to save registration',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Pre-payment registration save endpoint',
        usage: 'POST with registration data before payment',
        example: {
            registrationId: 'TEMP-REG-xxxxx',
            personalDetails: {
                title: 'Dr.',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                phoneNumber: '1234567890',
                country: 'India',
                fullPostalAddress: '123 Main St'
            },
            pricing: {
                totalPrice: 399,
                currency: 'USD'
            }
        }
    });
}