import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function ActionWidget({ icon, title, subtitle, color = 'peach', onClick, className = '' }) {
  const colors = {
    peach: 'bg-peach',
    lavender: 'bg-lavender',
    mint: 'bg-mint',
    sky: 'bg-sky',
  };

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'rounded-2xl p-4 text-left w-full transition-shadow hover:shadow-md',
        colors[color] || 'bg-peach',
        className
      )}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold text-navy text-sm leading-snug">{title}</div>
      {subtitle && <div className="text-text-secondary text-xs mt-0.5 leading-snug">{subtitle}</div>}
    </motion.button>
  );
}

export default ActionWidget;
