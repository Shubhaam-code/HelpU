import { useNavigate } from 'react-router-dom';
import { Car, GraduationCap, Users } from 'lucide-react';

/**
 * Helpu Responsive Triple Service Switcher:
 * Optimized for Mobile Phones (Capacitor) & Desktop Browsers:
 * - 'slotmate' -> /slotmate
 * - 'poolmate' -> /home
 * - 'ffcs'     -> /slotmate/ffcs
 */
export function ServiceSwitcher({ activeService = 'poolmate', className = '' }) {
  const navigate = useNavigate();

  const isPoolActive = activeService === 'poolmate';
  const isSlotActive = activeService === 'slotmate';
  const isFFCSActive = activeService === 'ffcs';

  const handleSelectSlot = () => {
    if (!isSlotActive) navigate('/slotmate');
  };

  const handleSelectPool = () => {
    if (!isPoolActive) navigate('/home');
  };

  const handleSelectFFCS = () => {
    if (!isFFCSActive) navigate('/slotmate/ffcs');
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-3 gap-1.5 min-[360px]:gap-2 sm:gap-3.5 w-full">
        
        {/* =================================================================== */}
        {/* TILE 1: SLOTMATE (ACADEMICS & TIMETABLE SLOTS)                     */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleSelectSlot}
          aria-pressed={isSlotActive}
          className={`relative rounded-[16px] min-[360px]:rounded-[20px] sm:rounded-[24px] p-2 min-[360px]:p-2.5 sm:p-3.5 text-left transition-all duration-200 cursor-pointer select-none active:scale-[0.98] flex items-center gap-1.5 sm:gap-3 overflow-hidden ${
            isSlotActive
              ? 'bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] text-[#17233C] shadow-md shadow-[#F59E0B]/25 ring-2 ring-[#F59E0B]/30'
              : 'bg-white hover:bg-[#FFFDF5] border border-[#F4E3D8] hover:border-[#F59E0B]/40 shadow-2xs hover:shadow-xs'
          }`}
        >
          <div 
            className={`w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
              isSlotActive 
                ? 'bg-[#FEF9C3] text-[#17233C] shadow-2xs border border-[#FDE047]' 
                : 'bg-[#FEF3C7] text-[#D97706]'
            }`}
          >
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className={`font-black text-[11px] min-[360px]:text-xs sm:text-base tracking-tight leading-tight truncate ${
              isSlotActive ? 'text-[#17233C]' : 'text-[#17233C]'
            }`}>
              SlotMate
            </h3>
            <p className={`text-[9px] min-[360px]:text-[10px] sm:text-xs font-medium leading-tight mt-0.5 truncate ${
              isSlotActive ? 'text-[#78350F]' : 'text-[#6E7587]'
            }`}>
              Slots
            </p>
          </div>
        </button>

        {/* =================================================================== */}
        {/* TILE 2: POOLMATE (RIDE SHARING & CAB POOLING)                      */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleSelectPool}
          aria-pressed={isPoolActive}
          className={`relative rounded-[16px] min-[360px]:rounded-[20px] sm:rounded-[24px] p-2 min-[360px]:p-2.5 sm:p-3.5 text-left transition-all duration-200 cursor-pointer select-none active:scale-[0.98] flex items-center gap-1.5 sm:gap-3 overflow-hidden ${
            isPoolActive
              ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF451A] text-white shadow-md shadow-[#FF572E]/25 ring-2 ring-[#FF572E]/20'
              : 'bg-white hover:bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-2xs hover:shadow-xs'
          }`}
        >
          <div 
            className={`w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
              isPoolActive 
                ? 'bg-white/20 text-white backdrop-blur-xs' 
                : 'bg-[#FFF0E6] text-[#FF572E]'
            }`}
          >
            <Car className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className={`font-black text-[11px] min-[360px]:text-xs sm:text-base tracking-tight leading-tight truncate ${
              isPoolActive ? 'text-white' : 'text-[#17233C]'
            }`}>
              PoolMate
            </h3>
            <p className={`text-[9px] min-[360px]:text-[10px] sm:text-xs font-medium leading-tight mt-0.5 truncate ${
              isPoolActive ? 'text-white/90' : 'text-[#6E7587]'
            }`}>
              Rides
            </p>
          </div>
        </button>

        {/* =================================================================== */}
        {/* TILE 3: FFCS MATE (SMART COURSE & FACULTY SELECTION)               */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleSelectFFCS}
          aria-pressed={isFFCSActive}
          className={`relative rounded-[16px] min-[360px]:rounded-[20px] sm:rounded-[24px] p-2 min-[360px]:p-2.5 sm:p-3.5 text-left transition-all duration-200 cursor-pointer select-none active:scale-[0.98] flex items-center gap-1.5 sm:gap-3 overflow-hidden ${
            isFFCSActive
              ? 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20'
              : 'bg-white hover:bg-[#F0F7FF] border border-[#E0E7FF] hover:border-blue-400/40 shadow-2xs hover:shadow-xs'
          }`}
        >
          <div 
            className={`w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
              isFFCSActive 
                ? 'bg-white/20 text-white backdrop-blur-xs' 
                : 'bg-[#EFF6FF] text-[#2563EB]'
            }`}
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className={`font-black text-[11px] min-[360px]:text-xs sm:text-base tracking-tight leading-tight truncate ${
              isFFCSActive ? 'text-white' : 'text-[#17233C]'
            }`}>
              FFCS Mate
            </h3>
            <p className={`text-[9px] min-[360px]:text-[10px] sm:text-xs font-medium leading-tight mt-0.5 truncate ${
              isFFCSActive ? 'text-white/90' : 'text-[#6E7587]'
            }`}>
              Curriculum
            </p>
          </div>
        </button>

      </div>
    </div>
  );
}

export default ServiceSwitcher;
