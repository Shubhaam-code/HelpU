import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Check } from 'lucide-react';

const COMMON_CAMPUS_TIMES = [
  { label: '07:30 AM', sub: 'Early', h: 7, m: 30, ampm: 'AM' },
  { label: '08:30 AM', sub: 'Morning', h: 8, m: 30, ampm: 'AM' },
  { label: '11:00 AM', sub: 'Midday', h: 11, m: 0, ampm: 'AM' },
  { label: '02:00 PM', sub: 'Afternoon', h: 2, m: 0, ampm: 'PM' },
  { label: '05:30 PM', sub: 'Evening', h: 5, m: 30, ampm: 'PM' },
  { label: '08:00 PM', sub: 'Night', h: 8, m: 0, ampm: 'PM' },
];

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '15', '30', '45'];

/**
 * Parse HH:MM 24-hour string to { hour12, minute, ampm }
 */
function parseTimeString(tStr) {
  if (!tStr || !tStr.includes(':')) {
    return { hour12: 8, minute: '00', ampm: 'AM' };
  }
  const [h24, m] = tStr.split(':').map(Number);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  const minute = String(m || 0).padStart(2, '0');
  return { hour12, minute, ampm };
}

/**
 * Format { hour12, minute, ampm } to 24-hour HH:MM string for backend
 */
function to24HourString(hour12, minute, ampm) {
  let h24 = Number(hour12);
  if (ampm === 'PM' && h24 < 12) h24 += 12;
  if (ampm === 'AM' && h24 === 12) h24 = 0;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function TimePickerModal({
  isOpen,
  onClose,
  value = '08:00',
  onChange,
  title = "Select Departure Time"
}) {
  const initial = useMemo(() => parseTimeString(value), [value]);

  const [selectedHour, setSelectedHour] = useState(initial.hour12);
  const [selectedMinute, setSelectedMinute] = useState(initial.minute);
  const [selectedAmPm, setSelectedAmPm] = useState(initial.ampm);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseTimeString(value);
      setSelectedHour(parsed.hour12);
      setSelectedMinute(parsed.minute);
      setSelectedAmPm(parsed.ampm);
    }
  }, [isOpen, value]);

  const handleConfirm = () => {
    const formatted = to24HourString(selectedHour, selectedMinute, selectedAmPm);
    onChange(formatted);
    onClose();
  };

  const handleQuickPick = (item) => {
    setSelectedHour(item.h);
    setSelectedMinute(String(item.m).padStart(2, '0'));
    setSelectedAmPm(item.ampm);
    const formatted = to24HourString(item.h, item.m, item.ampm);
    onChange(formatted);
    onClose();
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
                <Clock className="w-4.5 h-4.5 stroke-[2.2]" />
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
            {/* Quick Popular Times */}
            <div>
              <span className="block text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-2">
                Popular Times
              </span>
              <div className="grid grid-cols-3 gap-2">
                {COMMON_CAMPUS_TIMES.map((item) => {
                  const isCurrent = 
                    selectedHour === item.h && 
                    Number(selectedMinute) === item.m && 
                    selectedAmPm === item.ampm;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleQuickPick(item)}
                      className={`py-2 px-1.5 rounded-xl text-center border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#FF572E] bg-[#FFF2EB] text-[#FF572E] shadow-2xs font-black'
                          : 'border-[#F4E3D8] bg-[#FFFBF8] hover:border-[#FF572E]/40 text-[#17233C]'
                      }`}
                    >
                      <div className="text-[11px] font-black">{item.label}</div>
                      <div className="text-[9.5px] text-[#6E7587] font-semibold">{item.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Display Header with AM/PM toggle */}
            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <span className="font-black text-2xl sm:text-3xl text-[#17233C]">
                {String(selectedHour).padStart(2, '0')}:{selectedMinute}
              </span>
              <div className="flex rounded-xl bg-white border border-[#F4E3D8] p-1 ml-2">
                <button
                  type="button"
                  onClick={() => setSelectedAmPm('AM')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedAmPm === 'AM'
                      ? 'bg-[#FF572E] text-white shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17233C]'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAmPm('PM')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedAmPm === 'PM'
                      ? 'bg-[#FF572E] text-white shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17233C]'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Hour Picker Grid */}
            <div>
              <span className="block text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-2">
                Hour
              </span>
              <div className="grid grid-cols-6 gap-1.5 text-center">
                {HOURS.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedHour(h)}
                      className={`h-9 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF572E] text-white shadow-sm shadow-[#FF572E]/25'
                          : 'bg-[#FFFBF8] border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF4ED]'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minute Picker Grid */}
            <div>
              <span className="block text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-2">
                Minute
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {MINUTES.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMinute(m)}
                      className={`h-9 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF572E] text-white shadow-sm shadow-[#FF572E]/25'
                          : 'bg-[#FFFBF8] border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFF4ED]'
                      }`}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Confirm Bar with safe-area bottom insets */}
          <div className="px-5 pt-3.5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] bg-[#FFFBF8] border-t border-[#F4E3D8] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold text-[#6E7587] uppercase tracking-wider">
                Selected Time
              </span>
              <span className="block text-xs sm:text-sm font-black text-[#17233C] truncate">
                {String(selectedHour).padStart(2, '0')}:{selectedMinute} {selectedAmPm}
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
                onClick={handleConfirm}
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

export default TimePickerModal;

