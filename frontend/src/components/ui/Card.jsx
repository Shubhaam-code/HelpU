import React from 'react';

/**
 * Helpu Card Component
 * 
 * Consistent white card surface with subtle border, rounded corners,
 * and delicate shadow matching the Helpu design system.
 */
export function Card({
  children,
  className = '',
  isInteractive = false,
  onClick = null,
  padding = 'p-4 sm:p-5',
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-[24px] border border-[#F4E3D8] shadow-xs
        ${isInteractive ? 'hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99]' : ''}
        ${padding}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`flex items-center justify-between gap-3 pb-3 border-b border-[#F4E3D8]/60 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`font-black text-[#17233C] text-base sm:text-lg tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`py-3.5 space-y-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`pt-3 border-t border-[#F4E3D8]/60 flex items-center justify-between gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;

