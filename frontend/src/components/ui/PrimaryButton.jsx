import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  variant = 'coral',
  fullWidth = true,
  disabled = false,
  className = '',
  icon,
}) {
  const variants = {
    coral: 'bg-coral text-white hover:bg-coral/90',
    navy: 'bg-navy text-white hover:bg-navy/90',
    outline: 'bg-transparent border-2 border-coral text-coral hover:bg-coral/10',
    outlineNavy: 'bg-transparent border-2 border-navy text-navy hover:bg-navy/10',
    ghost: 'bg-white/20 text-white border border-white/30 hover:bg-white/30',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      className={cn(
        'flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-semibold text-base',
        'transition-colors duration-150 select-none cursor-pointer',
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        variants[variant],
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  );
}

export default PrimaryButton;

