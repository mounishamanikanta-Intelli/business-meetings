import { NextResponse } from 'next/server';
import { getPastConferencesRedirect } from '../../getPastConferencesRedirect';
import { getConferenceGallerySettings } from '@/app/getConferenceGallerySettings';

export async function GET() {
  try {
    console.log('🔍 API: Checking past conferences visibility...');
    
    const gallerySettings = await getConferenceGallerySettings();
    
    console.log('📊 API: Past conferences Gallery config:', gallerySettings);
    
    if (!gallerySettings) {
      console.log('❌ API: No past conferences configuration found');
      return NextResponse.json({
        showConferenceGallery: false,
        error: 'No configuration found'
      });
    }

    // Return the showInMenu value from Sanity
    const showConferenceGallery = gallerySettings.showInMenu === true;
    
    console.log('✅ API: Returning showConferenceGallery =', showConferenceGallery);
    
    return NextResponse.json({
      showConferenceGallery
    });
  } catch (error) {
    console.error('❌ API: Error fetching past conferences visibility:', error);
    return NextResponse.json(
      { 
        showConferenceGallery: false,
        error: 'Failed to fetch visibility setting' 
      },
      { status: 500 }
    );
  }
}
