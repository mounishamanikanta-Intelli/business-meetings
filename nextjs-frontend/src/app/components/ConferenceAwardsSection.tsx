'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ConferenceAward, ConferenceAwardsApiResponse } from '@/app/types/conferenceAwards';

const ConferenceAwardsSection: React.FC = () => {
  const [awards, setAwards] = useState<ConferenceAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAwards();
  }, []);

  const fetchAwards = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/conference-awards');
      const result: ConferenceAwardsApiResponse = await response.json();

      if (result.success) {
        setAwards(result.data || []);
      } else {
        setError(result.error || 'Failed to fetch awards');
      }
    } catch (err) {
      setError('An error occurred while fetching awards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (error || awards.length === 0) return null;

  if (loading) {
    return (
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-center text-5xl font-bold mb-10 text-slate-900">
          <span className="bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
            Conference Awards
          </span>
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {awards.map((award) => (
            <AwardCard key={award._id} award={award} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface AwardCardProps {
  award: ConferenceAward;
}

const AwardCard: React.FC<AwardCardProps> = ({ award }) => {
  return (
    <div className="bg-white border rounded-xl p-4 sm:p-5 hover:shadow-lg transition-all duration-300 group">
      
      {/* Square Image Container */}
      <div className="relative w-full aspect-square max-h-[220px] mx-auto mb-4 flex items-center justify-center">
        {award.awardImage?.asset?.url ? (
          <Image
            src={award.awardImage.asset.url}
            alt={award.awardImage.alt ?? award.awardName}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 220px"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-3xl">
            🏅
          </div>
        )}
      </div>

      {/* Award Name */}
      <h3 className="text-center font-semibold text-sm sm:text-base text-slate-900">
        {award.awardName}
      </h3>

      {/* Optional Description */}
      {award.description && (
        <p className="text-xs sm:text-sm text-gray-500 text-center mt-2 line-clamp-3">
          {award.description}
        </p>
      )}
    </div>
  );
};



export default ConferenceAwardsSection;
