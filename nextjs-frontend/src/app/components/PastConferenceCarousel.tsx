'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CarouselImage {
  src: string;
  alt?: string;
}

interface PastConferenceCarouselProps {
  images: CarouselImage[];
  title?: string;
  scrollSpeed?: number; // pixels per second, default 60
}

export function PastConferenceCarousel({
  images,
  title = 'Past Conference Gallery',
  scrollSpeed = 60,
}: PastConferenceCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const lastTimeRef = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // We duplicate the images array so the strip loops seamlessly
  const validImages = images.filter((img) => !!img.src);
  const looped = [...validImages, ...validImages]; // duplicate for infinite loop

  const IMAGE_HEIGHT = 380; // px — fixed card height
  const IMAGE_GAP = 8;      // px gap between cards

  const animate = useCallback((timestamp: number) => {
    if (!trackRef.current) return;

    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = timestamp;

    if (!pausedRef.current) {
      offsetRef.current += scrollSpeed * delta;

      // Calculate total width of one set of images
      // We don't know individual widths upfront, so use the track's scrollWidth / 2
      const halfWidth = trackRef.current.scrollWidth / 2;
      if (offsetRef.current >= halfWidth) {
        offsetRef.current -= halfWidth;
      }

      trackRef.current.style.transform = `translateX(-${offsetRef.current}px)`;
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [scrollSpeed]);

  useEffect(() => {
    if (validImages.length === 0) return;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, validImages.length]);

  const pause = () => {
    pausedRef.current = true;
    lastTimeRef.current = null;
    setIsPaused(true);
  };

  const resume = () => {
    pausedRef.current = false;
    setIsPaused(false);
  };

  if (validImages.length === 0) return null;

  return (
    <div className="w-full bg-white py-8 md:py-12">
      {/* Title */}
      {title && (
        <h2 className="text-center text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">
          {title}
        </h2>
      )}

      {/* Carousel viewport */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: `${IMAGE_HEIGHT}px` }}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
      >
        {/* Left fade */}
        <div
          className="absolute left-0 top-0 bottom-0 w-16 md:w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, white, transparent)' }}
        />

        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 md:w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, white, transparent)' }}
        />

        {/* Left arrow */}
        <button
          onClick={() => { offsetRef.current = Math.max(0, offsetRef.current - 300); }}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md text-gray-600 hover:text-orange-500 hover:shadow-lg transition-all"
          aria-label="Scroll left"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={() => { offsetRef.current += 300; }}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md text-gray-600 hover:text-orange-500 hover:shadow-lg transition-all"
          aria-label="Scroll right"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Scrolling track */}
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ gap: `${IMAGE_GAP}px`, height: `${IMAGE_HEIGHT}px` }}
        >
          {looped.map((img, i) => (
            <div
              key={i}
              className="flex-none relative overflow-hidden rounded-lg shadow-sm"
              style={{
                height: `${IMAGE_HEIGHT}px`,
                width: 'auto',
                // Natural aspect ratio — let the image define the width
              }}
            >
              <img
                src={
                  img.src.includes('sanity.io')
                    ? `${img.src}?h=${IMAGE_HEIGHT * 2}&q=80&auto=format&fit=max`
                    : img.src
                }
                alt={img.alt || 'Conference photo'}
                className="h-full w-auto object-cover block"
                draggable={false}
                loading={i < 4 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <p className="text-center text-xs text-gray-400 mt-3 tracking-widest uppercase">
          Paused — move away to resume
        </p>
      )}
    </div>
  );
}