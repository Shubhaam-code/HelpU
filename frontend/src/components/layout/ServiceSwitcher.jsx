import { useNavigate } from 'react-router-dom';
import { Car, GraduationCap, ArrowRight } from 'lucide-react';

/**
 * Helpu Flipkart-Style Dual Service Switcher
 * 
 * Accurately styled after Flipkart's top service switcher:
 * - Active tile: Vibrant colored gradient background, white icon badge, white text.
 * - Inactive tile: Clean white card, pastel icon badge, crisp navy & muted typography.
 */
export function ServiceSwitcher({ activeService = 'poolmate', className = '' }) {
  const navigate = useNavigate();

  const isPoolActive = activeService === 'poolmate';
  const isSlotActive = activeService === 'slotmate';

  const handleSelectPool = () => {
    if (!isPoolActive) {
      navigate('/home');
    }
  };

  const handleSelectSlot = () => {
    if (!isSlotActive) {
      navigate('/slot-friend');
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full">
        
        {/* =================================================================== */}
        {/* TILE 1: POOLMATE (RIDE SHARING & CAB POOLING)                       */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleSelectPool}
          aria-pressed={isPoolActive}
          className={`relative rounded-[20px] sm:rounded-[24px] p-2.5 min-[360px]:p-3 sm:p-3.5 text-left transition-all duration-200 cursor-pointer select-none active:scale-[0.98] flex items-center gap-2.5 sm:gap-3 overflow-hidden ${
            isPoolActive
              ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF451A] text-white shadow-md shadow-[#FF572E]/25 ring-2 ring-[#FF572E]/20'
              : 'bg-white hover:bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-2xs hover:shadow-xs'
          }`}
        >
          {/* Icon Container */}
          <div 
            className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
              isPoolActive 
                ? 'bg-white/20 text-white backdrop-blur-xs' 
                : 'bg-[#FFF0E6] text-[#FF572E]'
            }`}
          >
            <Car className="w-4.5 h-4.5 min-[360px]:w-5 min-[360px]:h-5 sm:w-5.5 sm:h-5.5 stroke-[2.4]" />
          </div>

          {/* Text Content */}
          <div className="min-w-0 flex-1">
            <h3 className={`font-black text-sm min-[360px]:text-[15px] sm:text-base tracking-tight leading-tight ${
              isPoolActive ? 'text-white' : 'text-[#17233C]'
            }`}>
              PoolMate
            </h3>
            <p className={`text-[10px] min-[360px]:text-[10.5px] sm:text-[11.5px] font-medium leading-tight mt-0.5 truncate ${
              isPoolActive ? 'text-white/90' : 'text-[#6E7587]'
            }`}>
              Ride together. Save together.
            </p>
          </div>
        </button>

        {/* =================================================================== */}
        {/* TILE 2: SLOTMATE (ACADEMICS & TIMETABLE SLOTS)                     */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleSelectSlot}
          aria-pressed={isSlotActive}
          className={`relative rounded-[20px] sm:rounded-[24px] p-2.5 min-[360px]:p-3 sm:p-3.5 text-left transition-all duration-200 cursor-pointer select-none active:scale-[0.98] flex items-center gap-2.5 sm:gap-3 overflow-hidden ${
            isSlotActive
              ? 'bg-gradient-to-r from-[#0284C7] to-[#0369A1] text-white shadow-md shadow-[#0284C7]/25 ring-2 ring-[#0284C7]/20'
              : 'bg-white hover:bg-[#F8FBFF] border border-[#F4E3D8] hover:border-[#0284C7]/40 shadow-2xs hover:shadow-xs'
          }`}
        >
          {/* Icon Container */}
          <div 
            className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
              isSlotActive 
                ? 'bg-white/20 text-white backdrop-blur-xs' 
                : 'bg-[#EAF5FF] text-[#0284C7]'
            }`}
          >
            <GraduationCap className="w-4.5 h-4.5 min-[360px]:w-5 min-[360px]:h-5 sm:w-5.5 sm:h-5.5 stroke-[2.4]" />
          </div>

          {/* Text Content */}
          <div className="min-w-0 flex-1">
            <h3 className={`font-black text-sm min-[360px]:text-[15px] sm:text-base tracking-tight leading-tight ${
              isSlotActive ? 'text-white' : 'text-[#17233C]'
            }`}>
              SlotMate
            </h3>
            <p className={`text-[10px] min-[360px]:text-[10.5px] sm:text-[11.5px] font-medium leading-tight mt-0.5 truncate ${
              isSlotActive ? 'text-white/90' : 'text-[#6E7587]'
            }`}>
              Find your study partner.
            </p>
          </div>
        </button>

      </div>
    </div>
  );
}
