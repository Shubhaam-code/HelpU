import { useState, useEffect } from 'react';
import defaultAvatarImg from '../../assets/images/default-avatar-opt.png';

// Global cache of broken image URLs to prevent network re-fetching on component re-renders
const failedImageUrls = new Set();

// Preload into browser memory once on load
if (typeof window !== 'undefined') {
  const preloader = new Image();
  preloader.src = defaultAvatarImg;
}

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
  const isBroken = src ? failedImageUrls.has(src) : true;
  const initialValid = Boolean(src && !isBroken);
  const [imgError, setImgError] = useState(!initialValid);

  const isFull = size === 'full' || (className.includes('w-full') && className.includes('h-full'));
  const px = typeof size === 'number' ? size : sizes[size] || 48;

  useEffect(() => {
    if (src && !failedImageUrls.has(src)) {
      setImgError(false);
    } else {
      setImgError(true);
    }
  }, [src]);

  const handleError = () => {
    if (src) {
      failedImageUrls.add(src);
    }
    setImgError(true);
  };

  const showCustomSrc = Boolean(src && !imgError && !failedImageUrls.has(src));

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none transition-all ${
        ring ? 'ring-2 ring-coral/80 ring-offset-1 ring-offset-white' : ''
      } ${className}`}
      style={isFull ? { width: '100%', height: '100%' } : { width: px, height: px }}
    >
      {showCustomSrc ? (
        <img 
          src={src} 
          alt={name || 'User Profile'} 
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover rounded-full aspect-square block" 
          onError={handleError}
        />
      ) : (
        /* Bundled, Preloaded & Cached Default User Avatar */
        <img 
          src={defaultAvatarImg} 
          alt={name || 'Default User Avatar'} 
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover rounded-full aspect-square block select-none"
        />
      )}
    </div>
  );
}

export default Avatar;
