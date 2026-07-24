import { NextResponse } from 'next/server';
import { client } from '@/app/sanity/client';

export async function GET() {
  try {
    console.log('📖 Fetching Conference Awards section data from Sanity...');
    
    // Query for active About Us section (fetch both old and new fields for compatibility)
    const query = `
              *[_type == "conferenceAwards"]{
        _id,
        awardName,
        description,
        awardImage{
          alt,
          asset->{
            _id,
            url
          }
        }
      }
    `;

    const conferenceAwards = await client.fetch(query);
    
    if (!conferenceAwards) {
      console.log('⚠️ No Awards section found');
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No Awards section found'
      });
    }

    console.log('✅ Conference Awards section data fetched successfully');

    const response = NextResponse.json({
      success: true,
      data: conferenceAwards
    });

    // Add cache-busting headers
    response.headers.set(
    'Cache-Control',
    'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400'
    );


    return response;
  } catch (error) {
    console.error('❌ Error fetching Awards section:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Awards section data',
        data: null
      },
      { status: 500 }
    );
  }
}
