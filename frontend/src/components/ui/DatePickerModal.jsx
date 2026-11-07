import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Format a Date object to canonical YYYY-MM-DD
 */
function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get friendly display string for a date (e.g., Sat, 7 Nov)
 */
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export function DatePickerModal({
  isOpen,
  onClose,
  value,
  onChange,
  title = "Select Travel Date"
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  // Selected date state
  const selectedDateStr = value || todayStr;

  // Currently viewed month/year in the calendar
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Quick shortcuts: Today, Tomorrow, Day After
  const quickOptions = useMemo(() => {
    const t = new Date();
    const tom = new Date(t);
    tom.setDate(tom.getDate() + 1);
    const dayAfter = new Date(t);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [
      { label: 'Today', dateStr: toDateStr(t), sub: t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
      { label: 'Tomorrow', dateStr: toDateStr(tom), sub: tom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
      { label: 'Day After', dateStr: toDateStr(dayAfter), sub: dayAfter.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
    ];
  }, []);

  // Compute days in the current viewMonth
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Trailing days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false,
        disabled: true,
        dateStr: null
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dStr < todayStr;
      days.push({
        dayNum: d,
        isCurrentMonth: true,
        disabled: isPast,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        dateStr: dStr
      });
    }

    // Leading days for next month to complete the grid (up to 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        disabled: true,
        dateStr: null
      });
    }

    return days;
  }, [viewYear, viewMonth, todayStr, selectedDateStr]);

  const canGoPrev = useMemo(() => {
    return viewYear > today.getFullYear() || viewMonth > today.getMonth();
  }, [viewYear, viewMonth, today]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelect = (dateStr) => {
    if (!dateStr || dateStr < todayStr) return;
    onChange(dateStr);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center px-3.5 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] pt-4 sm:p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 25, scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className="bg-white rounded-[26px] sm:rounded-[28px] w-full max-w-sm sm:max-w-md border border-[#F4E3D8] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F4E3D8]/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                <CalendarIcon className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <h3 className="font-black text-[#17233C] text-sm sm:text-base">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FFF8F3] hover:bg-[#F4E3D8] text-[#6E7587] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[55vh] sm:max-h-[60vh]">
            {/* Quick Action Chips: Today, Tomorrow, Day After */}
            <div className="grid grid-cols-3 gap-2">
              {quickOptions.map((opt) => {
                const isSelected = selectedDateStr === opt.dateStr;
                return (
                  <button
                    key={opt.dateStr}
                    type="button"
                    onClick={() => {
                      handleSelect(opt.dateStr);
                      // Update calendar view to this date
                      const [y, m] = opt.dateStr.split('-').map(Number);
                      setViewDate(new Date(y, m - 1, 1));
                    }}
                    className={`py-2 px-2 rounded-xl text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FF572E] bg-[#FFF2EB] text-[#FF572E] shadow-2xs font-black'
                        : 'border-[#F4E3D8] bg-[#FFFBF8] hover:border-[#FF572E]/40 text-[#17233C]'
                    }`}
                  >
                    <div className="text-[11px] font-black">{opt.label}</div>
                    <div className="text-[9.5px] text-[#6E7587] font-semibold">{opt.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Month & Year Navigation */}
            <div className="flex items-center justify-between px-1">
              <span className="font-black text-sm sm:text-base text-[#17233C]">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={!canGoPrev}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                    canGoPrev 
                      ? 'border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF7F2] cursor-pointer' 
                      : 'border-transparent text-[#CBD5E1] cursor-not-allowed'
                  }`}
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-lg border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF7F2] flex items-center justify-center cursor-pointer transition-all"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 text-center">
              {WEEKDAY_NAMES.map((name, i) => (
                <span key={name} className={`text-[10px] font-bold uppercase tracking-wider ${
                  i === 0 ? 'text-[#EF4444]' : 'text-[#8C93A4]'
                }`}>
                  {name}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div key={idx} className="h-9 sm:h-10 flex items-center justify-center text-xs text-[#CBD5E1] font-medium select-none">
                      {cell.dayNum}
                    </div>
                  );
                }

                if (cell.disabled) {
                  return (
                    <div key={idx} className="h-9 sm:h-10 flex items-center justify-center text-xs text-[#CBD5E1] font-medium line-through select-none cursor-not-allowed">
                      {cell.dayNum}
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(cell.dateStr)}
                    className={`h-9 sm:h-10 rounded-full flex flex-col items-center justify-center text-xs font-black transition-all cursor-pointer relative ${
                      cell.isSelected
                        ? 'bg-[#FF572E] text-white shadow-md shadow-[#FF572E]/30 scale-105'
                        : cell.isToday
                        ? 'bg-[#FFF0E6] text-[#FF572E] border border-[#FF572E]/40 hover:bg-[#FFE8DC]'
                        : 'text-[#17233C] hover:bg-[#FFF4ED]'
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {cell.isToday && !cell.isSelected && (
                      <span className="w-1 h-1 rounded-full bg-[#FF572E] absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Bar: Selected Preview & Action Buttons with safe-area spacing */}
          <div className="px-5 pt-3.5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] bg-[#FFFBF8] border-t border-[#F4E3D8] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold text-[#6E7587] uppercase tracking-wider">
                Selected Date
              </span>
              <span className="block text-xs sm:text-sm font-black text-[#17233C] truncate">
                {formatFriendlyDate(selectedDateStr) || 'None'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3.5 bg-white border border-[#F4E3D8] hover:bg-[#FFF7F2] text-[#6E7587] hover:text-[#17233C] text-xs font-bold rounded-full transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-5 bg-[#FF572E] hover:bg-[#E64A22] active:scale-95 text-white text-xs sm:text-sm font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default DatePickerModal;

