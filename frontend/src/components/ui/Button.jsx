import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Helpu Button Component
 * 
 * Supports variants:
 * - primary: Helpu brand orange (#FF572E)
 * - secondary: White card surface with subtle border
 * - outline: Transparent with orange outline
 * - ghost: Clean hover state
 * - danger: Alert red / rose
 * 
 * Sizes:
 * - sm: 36px min height
 * - md: 44px min height (default)
 * - lg: 48px min height
 */
export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  isLoading = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-extrabold transition-all duration-150 select-none cursor-pointer focus:outline-none';

  const variantStyles = {
    primary: 'bg-[#FF572E] hover:bg-[#E64A22] text-white shadow-sm shadow-[#FF572E]/25 border border-transparent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
    secondary: 'bg-white hover:bg-[#FFF9F5] text-[#17233C] border border-[#F4E3D8] hover:border-[#FF572E]/30 shadow-2xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
    outline: 'bg-transparent hover:bg-[#FFEBE0]/50 text-[#FF572E] border-2 border-[#FF572E] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'bg-transparent hover:bg-[#FFEBE0]/40 text-[#17233C] hover:text-[#FF572E] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
  };

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 min-h-[36px] rounded-xl gap-1.5',
    md: 'text-xs sm:text-sm px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl gap-2',
    lg: 'text-sm sm:text-base px-6 py-3 min-h-[48px] rounded-2xl gap-2.5'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${baseStyles}
        ${variantStyles[variant] || variantStyles.primary}
        ${sizeStyles[size] || sizeStyles.md}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

export default Button;

