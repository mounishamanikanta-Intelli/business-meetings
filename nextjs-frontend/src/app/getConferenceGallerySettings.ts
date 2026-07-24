import { client } from "./sanity/client";

export interface ConferenceGallerySettings {
  _id: string;
  galleryTitle: string;
  conferenceDate: string;
  conferenceLocation: string;
  activeGallery: boolean;
  showInMenu: boolean;
}

// Get the conference gallery settings
export async function getConferenceGallerySettings(): Promise<ConferenceGallerySettings | null> {
    try {
      const query = `*[_type == "pastConferenceGallery"][0]{
        _id,
        galleryTitle,
        conferenceDate,
        conferenceLocation,
        activeGallery,
        showInMenu
      }`;

      const data = await client.fetch(query, {}, {
        next: {
          revalidate: 300, // Cache for 5    minutes
          tags: ['conference-gallery-settings']
        }
      });

      return data || null;
    } catch (error) {
      console.error('Error fetching conference gallery settings:', error);
      return null;
    }
  }

  export async function getConferenceGallerySettingsWithFallback(): Promise<ConferenceGallerySettings> {
    const settings = await getConferenceGallerySettings();
    return settings || getDefaultConferenceGallerySettings();
  }

  // Get default conference gallery settings (fallback)
  export function getDefaultConferenceGallerySettings(): ConferenceGallerySettings {
    return {
      _id: 'default',
      galleryTitle: 'Conference Gallery',
      conferenceDate: '2025-06-23',
      conferenceLocation: 'Hotel Indigo Kuala Lumpur On The Park',
      activeGallery: true,
      showInMenu: true,
    };
  } 