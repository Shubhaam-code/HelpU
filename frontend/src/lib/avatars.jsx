// HelpU Avatar System — 10 illustrated campus avatars (5 male, 5 female)
// Each avatar is an SVG-based illustrated character in campus style

export const AVATARS = [
  { id: 'm1', gender: 'male', label: 'Aarav', emoji: '👦', bg: '#BBDFFF', color: '#17233C' },
  { id: 'm2', gender: 'male', label: 'Rohan', emoji: '🧑', bg: '#C9F2DE', color: '#17233C' },
  { id: 'm3', gender: 'male', label: 'Arjun', emoji: '👨', bg: '#FFE6CB', color: '#17233C' },
  { id: 'm4', gender: 'male', label: 'Karan', emoji: '🧔', bg: '#E9E0FF', color: '#17233C' },
  { id: 'm5', gender: 'male', label: 'Dev', emoji: '👦', bg: '#C9F2DE', color: '#17233C' },
  { id: 'f1', gender: 'female', label: 'Priya', emoji: '👧', bg: '#FFE6CB', color: '#17233C' },
  { id: 'f2', gender: 'female', label: 'Ananya', emoji: '👩', bg: '#E9E0FF', color: '#17233C' },
  { id: 'f3', gender: 'female', label: 'Neha', emoji: '🧕', bg: '#BBDFFF', color: '#17233C' },
  { id: 'f4', gender: 'female', label: 'Riya', emoji: '👧', bg: '#C9F2DE', color: '#17233C' },
  { id: 'f5', gender: 'female', label: 'Ishita', emoji: '👩', bg: '#FFE6CB', color: '#17233C' },
];

export const getAvatar = (id) => AVATARS.find(a => a.id === id) || AVATARS[0];

// SVG avatar illustrations using consistent campus character style
export const AvatarSVG = ({ avatarId, size = 48, className = '' }) => {
  const avatar = getAvatar(avatarId);
  const isFemale = avatar.gender === 'female';
  
  // Deterministic colors based on id
  const skinTones = ['#FDBCB4', '#F1A77D', '#C68642', '#8D5524', '#FDBCB4'];
  const idx = parseInt(avatarId?.replace(/[mf]/, '') || '1', 10) - 1;
  const skinTone = skinTones[idx % skinTones.length];
  
  const hairColors = ['#1a1a1a', '#3d2b1f', '#6b3a2a', '#c19a6b', '#1a1a1a'];
  const hairColor = hairColors[idx % hairColors.length];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="50" fill={avatar.bg} />
      
      {/* Body / Shirt */}
      <ellipse cx="50" cy="82" rx="22" ry="16" fill={isFemale ? '#FF654F' : '#17233C'} />
      
      {/* Neck */}
      <rect x="44" y="62" width="12" height="10" rx="4" fill={skinTone} />
      
      {/* Head */}
      <circle cx="50" cy="52" r="18" fill={skinTone} />
      
      {/* Hair */}
      {isFemale ? (
        <>
          <ellipse cx="50" cy="36" rx="18" ry="9" fill={hairColor} />
          <ellipse cx="32" cy="50" rx="4" ry="12" fill={hairColor} />
          <ellipse cx="68" cy="50" rx="4" ry="12" fill={hairColor} />
        </>
      ) : (
        <ellipse cx="50" cy="36" rx="18" ry="8" fill={hairColor} />
      )}
      
      {/* Eyes */}
      <circle cx="44" cy="51" r="2.5" fill="#1a1a1a" />
      <circle cx="56" cy="51" r="2.5" fill="#1a1a1a" />
      <circle cx="45" cy="50" r="1" fill="white" />
      <circle cx="57" cy="50" r="1" fill="white" />
      
      {/* Smile */}
      <path d="M 44 58 Q 50 63 56 58" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      
      {/* Collar / clothes detail */}
      <path d="M 44 72 L 50 78 L 56 72" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default AVATARS;
