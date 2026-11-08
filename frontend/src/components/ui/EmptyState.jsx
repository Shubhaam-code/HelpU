import React from 'react';

/**
 * Helpu EmptyState Component
 * 
 * Provides consistent, friendly empty states with warm cream badge,
 * bold title, descriptive subtitle, and optional call-to-action.
 */
export function EmptyState({ 
  icon = '🚗', 
  title, 
  subtitle, 
  action = null,
  className = '',
  card = true
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-3.5 max-w-md mx-auto ${className}`}>
      {/* Icon Badge */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE] flex items-center justify-center text-2xl sm:text-3xl shadow-xs">
        {icon}
      </div>

      {/* Text Info */}
      <div className="space-y-1">
        <h4 className="font-black text-[#17233C] text-base sm:text-lg">
          {title}
        </h4>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#6E7587] leading-relaxed max-w-xs mx-auto font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Button */}
      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  );

  if (card) {
    return (
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs">
        {content}
      </div>
    );
  }

  return content;
}

export default EmptyState;
