import { AvatarSVG, getAvatar } from '../../lib/avatars';

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
};

export function Avatar({ avatarId, size = 'md', className = '', ring = false }) {
  const px = typeof size === 'number' ? size : sizes[size] || 48;
  const avatar = getAvatar(avatarId);

  return (
    <div
      className={`relative inline-block flex-shrink-0 rounded-full overflow-hidden ${ring ? 'ring-2 ring-coral' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      <AvatarSVG avatarId={avatarId || 'm1'} size={px} />
    </div>
  );
}

export default Avatar;
