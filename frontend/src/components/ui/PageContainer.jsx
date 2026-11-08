import React from 'react';

/**
 * Helpu PageContainer
 * 
 * Provides consistent responsive layout across mobile and desktop:
 * - Mobile: max-w-xl mx-auto px-4 py-3 space-y-4
 * - Tablet/Desktop: max-w-6xl xl:max-w-7xl px-6 lg:px-8 py-6 space-y-6
 */
export function PageContainer({
  children,
  className = '',
  maxWidth = 'max-w-xl lg:max-w-6xl xl:max-w-7xl',
  title = null,
  subtitle = null,
  headerAction = null,
  noPadding = false
}) {
  return (
    <div
      className={`w-full mx-auto ${maxWidth} ${
        noPadding ? '' : 'px-3.5 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-8'
      } space-y-4 sm:space-y-6 ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 sm:pb-2">
          <div>
            {title && (
              <h1 className="font-black text-[#17233C] text-xl sm:text-2xl lg:text-3xl tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="shrink-0 flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

export default PageContainer;

