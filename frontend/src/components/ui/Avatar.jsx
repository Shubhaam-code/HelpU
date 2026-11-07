import { useState, useEffect } from 'react';

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
};

export function Avatar({ 
  src, 
  name, 
  email, 
  avatarId, 
  size = 'md', 
  className = '', 
  ring = false 
}) {
  const [imgError, setImgError] = useState(false);
  const isFull = size === 'full' || (className.includes('w-full') && className.includes('h-full'));
  const px = typeof size === 'number' ? size : sizes[size] || 48;

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const hasValidImage = Boolean(src && !imgError);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none transition-all ${
        ring ? 'ring-2 ring-coral/80 ring-offset-1 ring-offset-white' : ''
      } ${className}`}
      style={isFull ? {} : { width: px, height: px }}
    >
      {hasValidImage ? (
        <img 
          src={src} 
          alt={name || 'User Profile'} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-full aspect-square block" 
          onError={() => setImgError(true)}
        />
      ) : (
        /* Premium Helpu Default User Avatar (Clean silhouette, no ST initials) */
        <div 
          className="w-full h-full rounded-full bg-gradient-to-b from-[#FDF3EE] to-[#F5E5DC] flex items-center justify-center text-[#8A786B] border border-coral/10 shadow-inner"
          aria-label={name || 'Default User Avatar'}
        >
          <svg 
            className="w-[56%] h-[56%] text-[#8A786B]" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M12 12c2.485 0 4.5-2.015 4.5-4.5S14.485 3 12 3 7.5 5.015 7.5 7.5 9.515 12 12 12zm0 2.25c-3.007 0-9 1.51-9 4.5V21h18v-2.25c0-2.99-5.993-4.5-9-4.5z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default Avatar;
