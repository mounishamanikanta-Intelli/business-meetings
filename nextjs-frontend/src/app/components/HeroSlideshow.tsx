'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { type HeroSectionType } from '../getHeroSection';

interface AboutUsContent {
  showScientificProgramButton?: boolean;
  scientificProgramPdfUrl?: string;
  scientificProgramLabel?: string;
}

interface HeroSlideshowProps {
  hero: HeroSectionType | null;
  about?: AboutUsContent | null; 
}

export default function HeroSlideshow({ hero, about }: HeroSlideshowProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Auto-advance slideshow
  useEffect(() => {
    if (!hero?.images || hero.images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % hero.images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [hero?.images]);

  const jump = (delay: number) => ({
    animation: `jumpIn 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
  });

  // Simple overlay settings (slightly stronger default overlay for text contrast)
  const overlayOpacity = hero?.slideshowSettings?.overlayOpacity ?? 55;
  const overlayColor = typeof hero?.slideshowSettings?.overlayColor === 'string'
    ? hero.slideshowSettings.overlayColor
    : hero?.slideshowSettings?.overlayColor?.hex || '#000000';

  const showScientificButton = about?.showScientificProgramButton !== false && about?.scientificProgramPdfUrl;

  return (
    <section className="hero-section" aria-label="Conference hero">
      {/* Animation */}
      <style>
        {`
          @keyframes jumpIn {
            0% {
              opacity: 0;
              transform: translateY(22px) scale(0.96);
            }
            60% {
              opacity: 1;
              transform: translateY(-6px) scale(1.02);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>

      {/* Background Images with Slideshow */}
      {hero?.images && hero.images.length > 0 ? (
        <div className="absolute inset-0">
          {hero.images.map((image, index) => (
            <div
              key={index}
              className={`hero-image-responsive absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentImageIndex ? 'opacity-100 animate-zoom' : 'opacity-0'
              }`}
              style={{
                backgroundImage: `url(${image.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center bottom',
                backgroundRepeat: 'no-repeat',
                transform: index === currentImageIndex ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 5s ease-out, opacity 1s ease-in-out',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]" />
      )}

      {/* Dynamic Overlay from CMS */}
      <div
        className="absolute inset-0 z-10"
        style={{
          backgroundColor: overlayColor,
          opacity: overlayOpacity / 100,
        }}
      />

      {/* Content */}
      <div 
        className="relative z-10 w-full h-full flex items-center justify-center"
        style={{
          padding: isMobile ? '1rem 0 0 0' : '0.5rem clamp(1rem, 2vw, 2rem)',
        }}
      >
        <div 
          className="hero-content-container glass-layout-910x598"
          style={{
            padding: isMobile 
              ? '3rem 2rem 3rem' 
              : 'clamp(1.5rem, 6vh, 8rem) clamp(3rem, 8vw, 12rem) clamp(2rem, 6vh, 10rem)',
          }}
        >
          {/* Conference Title */}
          <h1
            className="hero-conference-title"
            style={{
              color: hero?.textColor?.hex || '#ffffff',
              opacity: hero?.textColor?.alpha || 1,
              fontSize: isMobile 
                ? 'clamp(1rem, 4vw, 1rem)' 
                : 'clamp(0.75rem, 2.5vh, 3.5rem)',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0',
              marginBottom: isMobile ? '0.8rem' : 'clamp(0.3rem, 1.5vh, 2rem)',
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              ...jump(0.15),
            }}
          >
            {hero?.conferenceTitle || 'INTERNATIONAL CONFERENCE ON'}
          </h1>

          {/* Conference Subject */}
          <h2
            className="hero-conference-subject"
            style={{
              color: '#f97316',
              opacity: 1,
              fontSize: isMobile 
                ? 'clamp(2.4rem, 6vw, 3.6rem)'
                : 'clamp(1.5rem, 7vh, 9rem)',
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '0',
              marginBottom: isMobile ? '1.2rem' : 'clamp(0.5rem, 2vh, 3rem)',
              lineHeight: 1.1,
              textShadow: '0 3px 12px rgba(0,0,0,0.45)',
              ...jump(0.3),
            }}
          >
            {hero?.conferenceSubject || 'NURSING'}
          </h2>

          {/* Conference Theme */}
          {hero?.conferenceTheme && (
            <p
              className="hero-conference-theme"
              style={{
                color: hero?.textColor?.hex || '#ffffff',
                opacity: hero?.textColor?.alpha || 1,
                fontSize: isMobile ? '1rem' : 'clamp(0.75rem, 2vh, 2.5rem)',
                lineHeight: 1.35,
                textAlign: 'center',
                textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                margin: isMobile 
                  ? '0 auto 1.4rem' 
                  : '0 auto clamp(0.6rem, 2.5vh, 3.5rem)',
                ...jump(0.45),
              }}
            >
              {hero.conferenceTheme}
            </p>
          )}

          {/* Event Type */}
          {hero?.eventType && (
            <div
              className="hero-event-type"
              style={{
                color: '#10b981',
                opacity: 1,
                fontSize: isMobile ? '0.85rem' : 'clamp(0.7rem, 1.8vh, 2.2rem)',
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                margin: '0',
                marginBottom: isMobile ? '1.5rem' : 'clamp(0.6rem, 2.5vh, 3.5rem)',
                lineHeight: '1.1',
                textAlign: 'center',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'clamp(10px, 2.5vw, 16px)',
                padding: isMobile 
                  ? '0.5rem 1.1rem' 
                  : 'clamp(0.4rem, 1.5vh, 2rem) clamp(1rem, 3vw, 4rem)',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '90%',
                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                ...jump(0.6) 
              }}
            >
              🌐 {hero.eventType}
            </div>
          )}

          {/* Date and Venue Section - Simplified Layout */}
          <div className="hero-date-venue-container" style={{...jump(0.75)}}>
            {/* Date */}
            <div className="hero-info-item-simple">
              <div className="hero-info-icon-simple">
                <svg className="hero-icon-svg" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="hero-info-content-simple">
                <span className="hero-info-label-simple">Date</span>
                <span
                  className="hero-info-value-simple"
                  style={{
                    color: hero?.textColor?.hex || '#ffffff',
                    opacity: hero?.textColor?.alpha || 1,
                    fontSize: isMobile ? '0.95rem' : 'clamp(0.65rem, 1.8vh, 2.2rem)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.45)'
                  }}
                >
                  {hero?.conferenceDate || 'June 23-24, 2025'}
                </span>
              </div>
            </div>

            {/* Venue */}
            <div className="hero-info-item-simple">
              <div className="hero-info-icon-simple">
                <svg className="hero-icon-svg" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="hero-info-content-simple">
                <span className="hero-info-label-simple">Venue</span>
                <span
                  className="hero-info-value-simple"
                  style={{
                    color: hero?.textColor?.hex || '#ffffff',
                    opacity: hero?.textColor?.alpha || 1,
                    fontSize: isMobile ? '0.95rem' : 'clamp(0.65rem, 1.8vh, 2.2rem)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.45)'
                  }}
                >
                  {hero?.conferenceVenue || 'Hotel Indigo Kuala Lumpur On The Park, Kuala Lumpur, Malaysia'}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="hero-additional-info">
            {hero?.abstractSubmissionInfo && (
              <div
                className="hero-info-bullet"
                style={{
                  color: hero?.textColor?.hex || '#ffffff',
                  opacity: hero?.textColor?.alpha || 1,
                  fontSize: isMobile ? '0.9rem' : 'clamp(0.7rem, 2vh, 2.5rem)',
                  textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                  ...jump(0.9),
                }}
              >
                <span className="hero-bullet-icon">📝</span>
                {hero.abstractSubmissionInfo}
              </div>
            )}
            {hero?.registrationInfo && (
              <div
                className="hero-info-bullet"
                style={{
                  color: hero?.textColor?.hex || '#ffffff',
                  opacity: hero?.textColor?.alpha || 1,
                  fontSize: isMobile ? '0.9rem' : 'clamp(0.7rem, 2vh, 2.5rem)',
                  ...jump(0.9),
                }}
              >
                <span className="hero-bullet-icon">🎟️</span>
                {hero.registrationInfo}
              </div>
            )}
          </div>

          {/* Register Buttons */}
          {(hero?.showRegisterButton || showScientificButton) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'clamp(0.7rem, 1.5vw, 1.5rem)',
                width: '100%',
                marginTop: isMobile ? '1rem' : 'clamp(0.8rem, 3vh, 3rem)',
              }}
            >
              {/* Primary Register Button */}
              {hero?.showRegisterButton && (
                <Link
                  href={hero?.registerButtonUrl || '/registration'}
                  className="hero-register-button"
                  aria-label={hero?.registerButtonText || 'Register for conference'}
                  style={{
                    fontSize: isMobile ? '0.95rem' : 'clamp(0.8rem, 2vh, 2.2rem)',
                    padding: isMobile 
                      ? '0.75rem 2rem' 
                      : 'clamp(0.7rem, 2vh, 2.5rem) clamp(2rem, 5vw, 6rem)',
                    minHeight: 'clamp(40px, 8.5vw, 52px)',
                    minWidth: 'clamp(140px, 32vw, 220px)',
                    maxWidth: 'clamp(180px, 42vw, 260px)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 'clamp(0.08em, 0.2vw, 0.12em)',
                    borderRadius: 'clamp(20px, 5vw, 50px)',
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#ffffff',
                    boxShadow: '0 6px 18px rgba(249, 115, 22, 0.45)',
                    border: '2px solid rgba(255,255,255,0.15)',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(2px)',
                    transition: 'all 0.3s ease',
                    ...jump(1.05)
                  }}
                >
                  {isMobile && <span>→</span>} {hero?.registerButtonText || 'Register Now'}
                </Link>
              )}

              {/* Secondary Scientific Program Button */}
              {showScientificButton && (
                <a
                  href='/scientific-program'
                  className="hero-register-button"
                  aria-label={about?.scientificProgramLabel || 'Scientific Program'}
                  style={{
                    fontSize: isMobile ? '0.9rem' : 'clamp(0.75rem, 1.9vh, 2rem)',
                    padding: isMobile 
                      ? '0.7rem 1.6rem' 
                      : 'clamp(0.65rem, 2vh, 2.2rem) clamp(1.6rem, 4vw, 4.5rem)',
                    minHeight: 'clamp(40px, 8.5vw, 52px)',
                    minWidth: 'clamp(140px, 32vw, 220px)',
                    maxWidth: 'clamp(180px, 42vw, 260px)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'clamp(0.3rem, 0.8vw, 0.6rem)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 'clamp(0.08em, 0.2vw, 0.12em)',
                    borderRadius: 'clamp(20px, 5vw, 50px)',
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                    color: '#ffffff',
                    boxShadow: '0 6px 18px rgba(255,255,255,0.15)',
                    border: '2px solid rgba(255,255,255,0.85)',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(2px)',
                    transition: 'all 0.3s ease',
                    ...jump(1.15)
                  }}
                >
                  {about?.scientificProgramLabel || 'Scientific Program'}
                  <svg
                    style={{ 
                      width: 'clamp(16px, 2.5vh, 20px)', 
                      height: 'clamp(16px, 2.5vh, 20px)' 
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}