import { useState, useEffect } from 'react';
import { AvatarSVG, getAvatar } from '../../lib/avatars';

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
};

export function Avatar({ avatarId, src, name, size = 'md', className = '', ring = false }) {
  const [imgError, setImgError] = useState(false);
  const px = typeof size === 'number' ? size : sizes[size] || 48;

  useEffect(() => {
    setImgError(false);
  }, [src]);

  return (
    <div
      className={`relative inline-block flex-shrink-0 rounded-full overflow-hidden ${ring ? 'ring-2 ring-[#FF572E]' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      {src && !imgError ? (
        <img 
          src={src} 
          alt={name || "Avatar"} 
          className="w-full h-full object-cover rounded-full" 
          onError={() => setImgError(true)}
        />
      ) : (
        <AvatarSVG avatarId={avatarId || 'm1'} size={px} />
      )}
    </div>
  );
}

export default Avatar;
