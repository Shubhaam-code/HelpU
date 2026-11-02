import { useState, useEffect } from 'react';

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
};

export function Avatar({ src, name, email, avatarId, size = 'md', className = '', ring = false }) {
  const [imgError, setImgError] = useState(false);
  const px = typeof size === 'number' ? size : sizes[size] || 48;

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const displayName = (name || (email ? email.split('@')[0] : '') || 'Student').trim();
  const initial = displayName.charAt(0).toUpperCase() || 'S';

  // Email / Name based avatar image from standard UI-Avatars service
  const emailAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=FF572E&color=ffffff&bold=true&size=256`;

  // Primary image source: user's authenticated email account image (Google/Clerk) or generated email initial PNG
  const activeSrc = (src && !imgError) ? src : emailAvatarUrl;

  return (
    <div
      className={`relative inline-block flex-shrink-0 rounded-full overflow-hidden select-none ${ring ? 'ring-2 ring-[#FF572E]' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      <img 
        src={activeSrc} 
        alt={displayName} 
        className="w-full h-full object-cover rounded-full" 
        onError={(e) => {
          if (!imgError && src) {
            setImgError(true);
          } else {
            // If network fails, display pure CSS letter badge
            e.currentTarget.style.display = 'none';
          }
        }}
      />
      {/* Pristine CSS initial letter fallback */}
      <div 
        className="w-full h-full rounded-full bg-gradient-to-br from-[#FF572E] to-[#E64A22] text-white font-black flex items-center justify-center uppercase"
        style={{ fontSize: Math.max(12, Math.round(px * 0.42)) }}
      >
        {initial}
      </div>
    </div>
  );
}

export default Avatar;
