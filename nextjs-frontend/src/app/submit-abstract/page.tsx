'use client'

import { useState, useEffect } from 'react'
import AbstractSubmissionForm from './AbstractSubmissionForm'
import BlinkText from '../components/HeroBlinkText'
import HeroBlinkText from '../components/HeroBlinkText'

interface AbstractSettings {
  title: string
  subtitle: string
  backgroundImage?: {
    asset: {
      url: string
    }
  }
  abstractTemplate?: {
    asset: {
      url: string
    }
  }
  templateDownloadText: string
  submissionEnabled: boolean
  submissionDeadline?: string
  contactEmail?: string
  interestedInOptions: Array<{ value: string; label: string }>
  trackNames: Array<{ value: string; label: string }>
}

export default function AbstractSubmissionPage() {
  const [settings, setSettings] = useState<AbstractSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conferenceData, setConferenceData] = useState<any | null>(null)

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      try {
        await Promise.all([
          fetchSettings(),
          fetchConferenceTitle()
        ]);
      } catch (err) {
        console.error('❌ Init failed:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/abstract/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }
      const data = await response.json()
      setSettings(data)
    } catch (err) {
      setError('Failed to load page settings')
      console.error('Error fetching settings:', err)
    }
  }

  const fetchConferenceTitle = async () => {
    console.log('🚀 Fetching hero section via API');

    const response = await fetch('/api/hero-section');

    if (!response.ok) {
      console.error('❌ Failed to fetch hero section:', response.statusText);
      throw new Error('Failed to fetch hero section');
    }

    const data = await response.json();
    console.log('✅ Hero section data:', data);

    setConferenceData(data);
  };

  useEffect(() => {
  console.log('🧠 conferenceData updated:', conferenceData);
  }, [conferenceData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={fetchSettings}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!settings?.submissionEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Abstract Submission Closed</h1>
          <p className="text-gray-600">Abstract submission is currently not available.</p>
          {settings?.contactEmail && (
            <p className="mt-4 text-gray-600">
              For inquiries, please contact: 
              <a href={`mailto:${settings.contactEmail}`} className="text-blue-600 hover:underline ml-1">
                {settings.contactEmail}
              </a>
            </p>
          )}
        </div>
      </div>
    )
  }

  function AbstractHeroClient({ imageUrl, overlayPercent }: { imageUrl?: string; overlayPercent?: number }) {
  // Force overlay to exactly 60% as requested
  const opacity = 0.6;
  // Account for fixed/sticky header overlap with top padding (increase to clear both top bars)
  const headerOffset = 'pt-32 md:pt-40';
  return (
    <section
      className={`relative text-white ${headerOffset} pb-16 md:pb-24`}
      style={{
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Fallback gradient only when no image */}
      {!imageUrl ? (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
      ) : null}
      {/* Black overlay at requested opacity (0.4 – 0.6) */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="uppercase text-3xl md:text-4xl font-extrabold text-white tracking-wide drop-shadow-md">
            {conferenceData?.hero?.conferenceSubject}
          </h1>
          <HeroBlinkText
          text={conferenceData?.hero?.abstractSubmissionInfo}
          style={{
            background:"#0c1625",
            color:"#186FF0",
            border:"1px solid blue",
          }}
          />
          <h4 className="text-xl md:text-xl text-white drop-shadow-md">
            {conferenceData?.hero?.conferenceVenue} - {conferenceData?.hero?.conferenceDate}
          </h4>
          <h3 className="text-3xl md:text-5xl font-extrabold text-white tracking-wide drop-shadow-md">
            ABSTRACT SUBMISSION
          </h3>
          <nav className="mt-2 md:mt-3 text-sm md:text-base text-blue-100">
            <span>Home</span>
            <span className="mx-2">»</span>
            <span>Abstract Submission</span>
          </nav>
        </div>
      </div>
    </section>
  );
}

  return (
    <div className="min-h-screen bg-gray-50">

      <AbstractHeroClient imageUrl={settings?.backgroundImage?.asset?.url} overlayPercent={40} />

      {/* Main Content - Compact Layout */}
      <div className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                {/* Form Section */}
                <div className="lg:w-3/5 p-8">
                  <div className="text-center">
                    <h3 className="text-xl font-bold mb-4">
                      Download Abstract template here
                    </h3>
                    {settings?.abstractTemplate?.asset?.url ? (
                      <a
                        href={settings.abstractTemplate.asset.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-full transition-all duration-300"
                      >
                        📥 Download Here
                      </a>
                    ) : (
                      <button className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-full transition-all duration-300">
                        📥 Download Here
                      </button>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-6 mt-6 text-center">
                    Submit Your Abstract
                  </h2>
                  <AbstractSubmissionForm settings={settings} />
                </div>

                {/* Template Download Section */}
                <div className="lg:w-3/5 bg-gradient-to-br from-blue-800 to-blue-900 p-8 text-white flex flex-col justify-center">
                  <h3 className='text-white'>Guidelines for the Individual Abstract Structure :</h3>
                  <hr />
                  <p className='text-white mt-3'>
1. Abstract: Please ensure that your abstract contains no more than (Up to 300 words) and Biography (Up to 100 words)</p>
                  <p className='text-white'>
2. Title of presentation: Please choose a brief title that clearly indicates the content of the contribution.</p>
                  <p className='text-white'>
                    3. Abbreviations may be used in the text if they are defined when first used.</p>
                    <p className='text-white'>

4. Title of presentation: Please choose a brief title that clearly indicates the content of the contribution.
                    </p>
                    <p className='text-white'>
                      5. Title, author’s name, affiliation, address, telephone (WhatsApp number) and fax number, and email address should be included.</p>
                      <p className='text-white'>
                        6. Abstract should be written in English.
                      </p>
                      <p className='text-white'>
                        7. Name, highest educational degree obtained, email and complete mailing address, cell and work telephone numbers, institution, business affiliation (department, school, agency, or company, etc.), city and state. In instances of multiple authorship, the person whose name is listed first is expected to deliver the presentation.
                      </p>
                      <p className='text-white'>
                        8. List a maximum of 5 key words.
                      </p>
                </div>
              </div>
              <hr />
              <div>
                <p className="text-center mt-3 italic">
                  Note:  If you are unable to submit through given online submission you can: <b>contactus@intelliglobalconferences.com</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
