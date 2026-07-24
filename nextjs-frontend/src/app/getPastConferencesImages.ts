import { client } from './sanity/client';

export interface PastConferenceGalleryImage {
  _key: string;
  url: string;
  alt?: string;
  caption?: string;
}

export interface PastConferenceGalleryImages {
  _id: string;
  title: string;
  conferenceDate?: string;
  location?: string;
  galleryImages: PastConferenceGalleryImage[];
}

export async function getPastConferenceGalleryImages(): Promise<PastConferenceGalleryImages[]> {
  try {
    const query = `*[_type == "pastConferenceGallery" && isActive == true]{
      _id,
      title,
      conferenceDate,
      location,
      "galleryImages": galleryImages[]{
        "_key": _key,
        "url": asset->url,
        alt,
        caption
      }
    }`;

    const data = await client.fetch<PastConferenceGalleryImages[]>(
      query,
      {},
      { next: { revalidate: 300, tags: ['past-conference-gallery'] } }
    );

    if (!data?.length) return [];

    return data
      .filter((gallery) => gallery._id && gallery.title)
      .map((gallery) => ({
        _id: gallery._id,
        title: gallery.title || '',
        conferenceDate: gallery.conferenceDate || undefined,
        location: gallery.location || undefined,
        galleryImages: (gallery.galleryImages ?? [])
          .filter((img) => !!img.url)
          .map((img) => ({
            _key: img._key,
            url: img.url,
            alt: img.alt || undefined,
            caption: img.caption || undefined,
          })),
      }));
  } catch (error) {
    console.error('Error fetching past conference gallery images:', error);
    return [];
  }
}