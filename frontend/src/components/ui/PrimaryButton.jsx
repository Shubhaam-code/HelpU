import React from 'react';
import { Button } from './Button';

/**
 * Backward-compatible wrapper for PrimaryButton that maps to the new design system Button.
 */
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  variant = 'coral',
  fullWidth = true,
  disabled = false,
  className = '',
  icon = null,
  ...props
}) {
  const mappedVariant = 
    variant === 'coral' ? 'primary' :
    variant === 'navy' ? 'secondary' :
    variant === 'outline' ? 'outline' :
    variant === 'ghost' ? 'ghost' : 'primary';

  return (
    <Button
      type={type}
      onClick={onClick}
      variant={mappedVariant}
      size="md"
      fullWidth={fullWidth}
      disabled={disabled}
      leftIcon={icon}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export default PrimaryButton;
