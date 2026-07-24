import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { normalizeCountryValue } from '../../../utils/countries';

// Validate environment variables
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || 'zt8218vh';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || process.env.SANITY_API_VERSION || '2023-05-03';
const token = process.env.SANITY_API_TOKEN;

if (!token && process.env.NODE_ENV === 'development') {
  console.error('❌ SANITY_API_TOKEN is not set in environment variables');
  console.error('Please add SANITY_API_TOKEN to your .env.local file');
}

const client = createClient({
  projectId,
  dataset,
  useCdn: false,
  apiVersion,
  token,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface ScientificProgramFormData {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  country: string;
  professionalTitle?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check if API token is available
    if (!token) {
      console.error('❌ SANITY_API_TOKEN not configured');
      return NextResponse.json(
        {
          error: 'Server configuration error. Please contact support.',
          details: 'API token not configured'
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Parse the request body
    const formData: ScientificProgramFormData = await request.json();
    
    // Validate required fields
    const { fullName, email, phone, organization, country } = formData;

    if (!fullName || !email || !phone || !organization || !country) {
      return NextResponse.json(
        { error: 'Missing required fields. Full name, email, phone number, organization, and country are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate phone number (basic validation)
    if (phone.length < 10) {
      return NextResponse.json(
        { error: 'Phone number must be at least 10 digits.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get client IP address and user agent for tracking
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referrer = request.headers.get('referer') || 'direct';

    console.log('📄 Processing brochure download request...');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Form Data:', {
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      organization: formData.organization || 'Not provided',
      country: formData.country,
      professionalTitle: formData.professionalTitle || 'Not provided',
      ipAddress,
    });

    // Check if brochure downloads are active - prioritize singleton document
    const scientificSettingsQuery = `*[_type == "scientificProgramSettings" && _id == "scientificProgramSettings" && active == true][0] {
      _id,
      title,
      description,
      pdfFile {
        asset -> {
          _id,
          url,
          originalFilename,
          size
        }
      },
      active,
      downloadCount
    }`;

    const scientificSettings = await client.fetch(scientificSettingsQuery);

    if (!scientificSettings || !scientificSettings.active) {
      return NextResponse.json(
        { error: 'Scientific program downloads are currently not available.' },
        { status: 503, headers: corsHeaders }
      );
    }

    if (!scientificSettings.pdfFile || !scientificSettings.pdfFile.asset) {
      return NextResponse.json(
        { error: 'Scientific program file is not available.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // Create brochure download record in Sanity
    const downloadRecord = {
      _type: 'scientificProgramDownload',
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      organization: formData.organization,
      country: normalizeCountryValue(formData.country), // Store full country name
      professionalTitle: formData.professionalTitle || null,
      downloadTimestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      referrer,
    };

    const result = await client.create(downloadRecord);

    // Update download count in brochure settings
    const currentCount = scientificSettings.downloadCount || 0;
    await client
      .patch(scientificSettings._id)
      .set({ 
        downloadCount: currentCount + 1,
        lastUpdated: new Date().toISOString()
      })
      .commit();

    console.log('✅ Brochure download record created successfully');
    console.log('Download ID:', result._id);
    
    // Return success response with download URL
    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully. You can now download the scientific program brochure.',
      downloadUrl: scientificSettings.pdfFile.asset.url,
      downloadId: result._id,
      scientificProgramTitle: scientificSettings.title,
      timestamp: new Date().toISOString(),
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing scientific program brochure download:', error);

    return NextResponse.json(
      {
        error: 'Failed to process scientific program brochure download request. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit scientific program brochure download form.' },
    { status: 405, headers: corsHeaders }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit scientific program brochure download form.' },
    { status: 405, headers: corsHeaders }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit scientific program brochure download form.' },
    { status: 405, headers: corsHeaders }
  );
}
