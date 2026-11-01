import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ActionWidget({ 
  icon, 
  title, 
  subtitle, 
  color = 'peach', 
  onClick, 
  arrow = true,
  className = '' 
}) {
  const colorStyles = {
    peach: 'bg-peach/90 hover:bg-peach border-peach',
    lavender: 'bg-lavender/90 hover:bg-lavender border-lavender',
    mint: 'bg-mint/90 hover:bg-mint border-mint',
    sky: 'bg-sky/90 hover:bg-sky border-sky',
    match: 'bg-white hover:bg-peach/20 border-coral/30 shadow-xs',
  };

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      className={cn(
        'rounded-3xl p-4 text-left w-full transition-all duration-200 shadow-xs border flex flex-col justify-between cursor-pointer group',
        colorStyles[color] || 'bg-peach',
        className
      )}
    >
      <div>
        <div className="text-2xl mb-2.5 group-hover:scale-105 transition-transform duration-200">
          {icon}
        </div>
        <div className="font-extrabold text-navy text-sm leading-snug">
          {title}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        {subtitle && (
          <div className="text-text-secondary text-[11px] leading-tight font-medium">
            {subtitle}
          </div>
        )}
        {arrow && (
          <div className="w-5 h-5 rounded-full bg-white/70 flex items-center justify-center shrink-0 ml-1 text-navy group-hover:bg-coral group-hover:text-white transition-colors">
            <ArrowRight className="w-3 h-3" />
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default ActionWidget;
