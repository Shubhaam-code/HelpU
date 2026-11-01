export function CampusHeroIllustration({ className = '' }) {
  return (
    <svg 
      viewBox="0 0 380 180" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`w-full h-auto ${className}`}
    >
      {/* Background soft glow / sky */}
      <rect width="380" height="180" fill="transparent" />

      {/* Campus Clock Tower (Center-Left Background) */}
      <rect x="135" y="55" width="45" height="110" rx="4" fill="#FFE6CB" />
      <path d="M128 55 L157 25 L187 55 Z" fill="#FF654F" /> {/* Roof spire */}
      <circle cx="157.5" cy="72" r="10" fill="white" stroke="#17233C" strokeWidth="2" /> {/* Clock face */}
      <line x1="157.5" y1="72" x2="157.5" y2="66" stroke="#17233C" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="157.5" y1="72" x2="162" y2="72" stroke="#17233C" strokeWidth="1.5" strokeLinecap="round" />

      {/* Campus Building Wings */}
      <rect x="75" y="85" width="60" height="80" rx="3" fill="#FFE6CB" />
      <rect x="180" y="85" width="70" height="80" rx="3" fill="#FFE6CB" />
      <path d="M70 85 L105 65 L140 85 Z" fill="#FF8D7B" />
      <path d="M175 85 L215 65 L255 85 Z" fill="#FF8D7B" />

      {/* Building Windows */}
      <rect x="90" y="100" width="8" height="14" rx="2" fill="#17233C" opacity="0.7" />
      <rect x="110" y="100" width="8" height="14" rx="2" fill="#17233C" opacity="0.7" />
      <rect x="195" y="100" width="8" height="14" rx="2" fill="#17233C" opacity="0.7" />
      <rect x="215" y="100" width="8" height="14" rx="2" fill="#17233C" opacity="0.7" />
      <rect x="235" y="100" width="8" height="14" rx="2" fill="#17233C" opacity="0.7" />

      {/* Trees */}
      <circle cx="45" cy="120" r="28" fill="#C9F2DE" />
      <rect x="42" y="135" width="7" height="30" fill="#8B6914" />
      <circle cx="65" cy="140" r="18" fill="#A3E7C6" />

      <circle cx="280" cy="115" r="32" fill="#C9F2DE" />
      <rect x="277" y="135" width="7" height="30" fill="#8B6914" />
      <circle cx="305" cy="130" r="22" fill="#A3E7C6" />

      {/* Ground Lawn */}
      <ellipse cx="180" cy="175" rx="190" ry="20" fill="#C9F2DE" opacity="0.5" />

      {/* Student Character on Right */}
      {/* Backpack & Straps */}
      <rect x="250" y="90" width="22" height="42" rx="8" fill="#17233C" />
      <ellipse cx="260" cy="100" rx="3" ry="8" fill="#FF654F" />

      {/* Body / Navy Hoodie */}
      <ellipse cx="278" cy="145" rx="26" ry="24" fill="#17233C" />
      <path d="M266 125 L278 140 L290 125" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* "H" logo badge on chest */}
      <rect x="272" y="142" width="12" height="12" rx="3" fill="#FF654F" />
      <text x="275" y="151" fontSize="9" fill="white" fontWeight="900">H</text>

      {/* Neck & Head */}
      <rect x="273" y="95" width="10" height="12" rx="3" fill="#FDBCB4" />
      <circle cx="278" cy="85" r="18" fill="#FDBCB4" />

      {/* Dark Hair */}
      <ellipse cx="278" cy="72" rx="19" ry="10" fill="#17233C" />
      <ellipse cx="265" cy="78" rx="4" ry="10" fill="#17233C" />
      <ellipse cx="291" cy="78" rx="4" ry="10" fill="#17233C" />

      {/* Headphones around neck */}
      <path d="M262 90 Q278 102 294 90" stroke="#FF654F" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <rect x="260" y="84" width="7" height="11" rx="3" fill="#FF654F" />
      <rect x="289" y="84" width="7" height="11" rx="3" fill="#FF654F" />

      {/* Friendly Face */}
      <circle cx="273" cy="84" r="2" fill="#17233C" />
      <circle cx="283" cy="84" r="2" fill="#17233C" />
      <path d="M273 90 Q278 95 283 90" stroke="#17233C" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Waving Hand 👋 */}
      <ellipse cx="308" cy="115" rx="7" ry="5" fill="#FDBCB4" transform="rotate(-30 308 115)" />
      <circle cx="313" cy="111" r="3.5" fill="#FDBCB4" />
    </svg>
  );
}

export default CampusHeroIllustration;

