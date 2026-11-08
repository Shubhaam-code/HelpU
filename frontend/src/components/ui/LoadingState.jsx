import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Helpu LoadingState Component
 * 
 * Used for full page or section loading with brand logo and warm spinner.
 */
export function LoadingState({ message = 'Loading...', fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[#FFEBE0] flex items-center justify-center shadow-xs">
          <Loader2 className="w-6 h-6 text-[#FF572E] animate-spin" />
        </div>
      </div>
      <p className="text-xs sm:text-sm font-bold text-[#17233C]">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingState;

