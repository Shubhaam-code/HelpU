import React from 'react';

/**
 * Helpu LoadingSkeleton Component
 * 
 * Provides polished skeleton placeholders for cards, lists, and avatars
 * matching the warm cream and white design system.
 */
export function LoadingSkeleton({ count = 3, type = 'card', className = '' }) {
  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i} 
            className="bg-white rounded-[24px] p-5 border border-[#F4E3D8] animate-pulse space-y-4 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFEBE0]/70 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 bg-[#F4E3D8]/80 rounded-md w-3/4" />
                <div className="h-3 bg-[#F4E3D8]/50 rounded-md w-1/2" />
              </div>
            </div>
            <div className="h-14 bg-[#FFF9F5] rounded-xl border border-[#F4E3D8]/50" />
            <div className="h-8 bg-[#FFEBE0]/50 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`flex flex-col gap-2.5 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i} 
            className="h-16 bg-white border border-[#F4E3D8] rounded-2xl animate-pulse flex items-center px-4 gap-3 shadow-2xs"
          >
            <div className="w-8 h-8 rounded-full bg-[#FFEBE0]/70 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-[#F4E3D8]/80 rounded-md w-1/3" />
              <div className="h-2.5 bg-[#F4E3D8]/50 rounded-md w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`h-40 bg-white rounded-[24px] border border-[#F4E3D8] animate-pulse ${className}`} />
  );
}

export default LoadingSkeleton;
