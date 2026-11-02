import { AvatarSVG, getAvatar } from '../../lib/avatars';

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
};

export function Avatar({ avatarId, src, size = 'md', className = '', ring = false }) {
  const px = typeof size === 'number' ? size : sizes[size] || 48;

  return (
    <div
      className={`relative inline-block flex-shrink-0 rounded-full overflow-hidden ${ring ? 'ring-2 ring-[#FF572E]' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      {src ? (
        <img 
          src={src} 
          alt="Avatar" 
          className="w-full h-full object-cover rounded-full" 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <AvatarSVG avatarId={avatarId || 'm1'} size={px} />
      )}
    </div>
  );
}

export default Avatar;
