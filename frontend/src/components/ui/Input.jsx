import React, { forwardRef } from 'react';

/**
 * Helpu Form Input Component
 * 
 * Features:
 * - Label with required indicator
 * - Left & right icon slots
 * - Helper text & error state
 * - Consistent border, focus ring, and typography
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    className = '',
    containerClassName = '',
    id,
    required = false,
    disabled = false,
    type = 'text',
    ...props
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={`w-full space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-[#17233C]"
        >
          {label}
          {required && <span className="text-[#FF572E] ml-1">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C93A4] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          className={`
            w-full rounded-xl bg-white border text-xs sm:text-sm font-semibold text-[#17233C] placeholder:text-[#8C93A4] placeholder:font-normal
            min-h-[44px] transition-all duration-150 outline-none
            ${leftIcon ? 'pl-10' : 'pl-3.5'}
            ${rightIcon ? 'pr-10' : 'pr-3.5'}
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-[#F4E3D8] focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15'}
            ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : ''}
            ${className}
          `}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C93A4] flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-[11px] font-semibold text-red-500 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-[#6E7587] mt-1">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;

