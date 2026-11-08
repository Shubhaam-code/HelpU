import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/**
 * Helpu ErrorState Component
 * 
 * Provides friendly error presentations with retry or back actions.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an issue loading this information. Please check your connection and try again.',
  onRetry = null,
  onBack = null,
  className = '',
  card = true
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-3.5 max-w-md mx-auto ${className}`}>
      {/* Icon Badge */}
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center shadow-xs">
        <AlertCircle className="w-7 h-7" />
      </div>

      {/* Text Info */}
      <div className="space-y-1">
        <h4 className="font-black text-[#17233C] text-base sm:text-lg">
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-[#6E7587] leading-relaxed max-w-xs mx-auto font-medium">
          {message}
        </p>
      </div>

      {/* Actions */}
      {(onRetry || onBack) && (
        <div className="flex items-center justify-center gap-2.5 pt-2">
          {onRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          )}
          {onBack && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
            >
              Go Back
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (card) {
    return (
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-rose-200 shadow-xs">
        {content}
      </div>
    );
  }

  return content;
}

export default ErrorState;

