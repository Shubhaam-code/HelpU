import { Star, ChevronRight, Briefcase, GraduationCap } from 'lucide-react';

const THEME_ACCENTS = [
  {
    border: 'border-l-4 border-l-[#F59E0B]',
    boxBg: 'bg-gradient-to-b from-[#FEF9C3] to-[#FEF08A] text-[#78350F] border-[#FDE047]/70',
    starPill: 'bg-[#FEF9C3] border-[#FEF08A] text-[#17233C]'
  },
  {
    border: 'border-l-4 border-l-[#A855F7]',
    boxBg: 'bg-gradient-to-b from-[#F3E8FF] to-[#E9D5FF] text-[#581C87] border-[#D8B4FE]/70',
    starPill: 'bg-[#FEF9C3] border-[#FEF08A] text-[#17233C]'
  },
  {
    border: 'border-l-4 border-l-[#F43F5E]',
    boxBg: 'bg-gradient-to-b from-[#FFE4E6] to-[#FECDD3] text-[#881337] border-[#FDA4AF]/70',
    starPill: 'bg-[#FEF9C3] border-[#FEF08A] text-[#17233C]'
  },
  {
    border: 'border-l-4 border-l-[#0EA5E9]',
    boxBg: 'bg-gradient-to-b from-[#E0F2FE] to-[#BAE6FD] text-[#0369A1] border-[#7DD3FC]/70',
    starPill: 'bg-[#FEF9C3] border-[#FEF08A] text-[#17233C]'
  }
];

/**
 * Extract clean initials from teacher name (e.g. "Ajay Sharma" -> "AS", "Ajay Kumar Phulre" -> "AK")
 */
export function getFacultyInitials(name = '') {
  const clean = name
    .replace(/\b(dr|prof|mr|mrs|ms)\.?\s*/gi, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FC';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  // If there are multiple names (e.g. "Ajay Kumar Phulre"), first + middle or first + last
  return (parts[0][0] + (parts[1] ? parts[1][0] : parts[parts.length - 1][0])).toUpperCase();
}

/**
 * FacultyCard component styled exactly per reference:
 * - Left vertical colored accent border
 * - Initials box (AS, AK, PS, RV) with pastel gradient & rounded-xl border (No teacher face photo)
 * - Vertical separator line
 * - Center: Faculty name (bold), Briefcase icon + "Assistant Professor", Cap icon + Department
 * - Right: Yellow star rating pill ("5.0 / 5") + circular Chevron button
 */
export function FacultyCard({ faculty, onViewReviews }) {
  if (!faculty) return null;

  const id = faculty.facultyId || faculty._id || faculty.name || '';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const theme = THEME_ACCENTS[Math.abs(hash) % THEME_ACCENTS.length];

  const initials = getFacultyInitials(faculty.name);
  const rating = faculty.overall_rating;
  const hasRating = rating !== null && rating !== undefined && !Number.isNaN(Number(rating));
  const formattedRating = hasRating ? Number(rating).toFixed(1) : '—';
  const department = faculty.department && faculty.department.trim() ? faculty.department.trim() : 'Computer Science';

  const handleClick = () => {
    if (onViewReviews) onViewReviews(faculty);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View profile and reviews for ${faculty.name}`}
      className={`w-full bg-white rounded-2xl border border-[#F4E3D8] ${theme.border} p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 shadow-[0_2px_12px_rgba(23,35,60,0.03)] hover:shadow-md hover:border-[#FDE047]/80 active:scale-[0.99] transition-all cursor-pointer focus:outline-none`}
    >
      {/* Left: Initials box (AS, AK, PS, RV) */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm tracking-wide border shadow-2xs shrink-0 select-none ${theme.boxBg}`}>
          {initials}
        </div>
        {/* Subtle vertical separator line */}
        <div className="h-7 w-px bg-[#F4E3D8] shrink-0" />
      </div>

      {/* Center Details */}
      <div className="flex-1 min-w-0 pr-1">
        {/* Faculty Name */}
        <h3 className="text-sm sm:text-[15px] font-extrabold text-[#17233C] truncate leading-tight">
          {faculty.name}
        </h3>

        {/* Designation with Briefcase Icon */}
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] sm:text-xs text-[#6E7587] font-medium truncate">
          <Briefcase className="w-3 h-3 text-[#9CA3AF] shrink-0" />
          <span className="truncate">{faculty.designation || 'Assistant Professor'}</span>
        </div>

        {/* Department with Graduation Cap Icon */}
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] sm:text-xs text-[#6E7587] font-medium truncate">
          <GraduationCap className="w-3 h-3 text-[#9CA3AF] shrink-0" />
          <span className="truncate">{department}</span>
        </div>
      </div>

      {/* Right: Star Rating Pill + Circular Chevron */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Rating Pill */}
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF9C3] border border-[#FEF08A] shadow-2xs">
          <Star className="w-3.5 h-3.5 fill-[#FACC15] text-[#FACC15] shrink-0" />
          <span className="text-xs sm:text-[13px] font-black text-[#17233C] tracking-tight">
            {formattedRating} / 5
          </span>
        </div>

        {/* Circular Chevron Arrow Button */}
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFFDF9] border border-[#F4E3D8] flex items-center justify-center text-[#6E7587] hover:bg-[#FEF08A] hover:border-[#FEF08A] hover:text-[#C2410C] transition-colors shrink-0 shadow-2xs">
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
        </div>
      </div>
    </div>
  );
}

export default FacultyCard;
