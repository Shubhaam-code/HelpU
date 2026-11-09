import { useState, useEffect } from 'react';
import { X, Check, Calendar, ArrowRightLeft, Layers } from 'lucide-react';

/**
 * Slot Selection Popup matching the exact university timetable matrix
 * from the user reference image (media_1794165285727_b25af8ad.jpg).
 * 
 * Supports MULTI-SLOT SELECTION ("jitne man utne slot select kar skata ha"):
 * - User can tap any number of slot cells to toggle them ON/OFF.
 * - All selected slots are highlighted in bright lime-yellow (#CCFF00) with dark borders.
 * - Chips row shows all selected slots with individual removal (✕) and "Clear All".
 * - 8 Columns: 10:00 | 11:35 | 13:10 | Lunch | 14:45 | 16:20 | 17:55 | 19:30
 * - 6 Rows with exact entries from the reference timetable.
 */

export const TIMETABLE_HEADERS = [
  '10:00',
  '11:35',
  '13:10',
  'Lunch',
  '14:45',
  '16:20',
  '17:55',
  '19:30',
];

export const TIMETABLE_ROWS = [
  ['A11', 'B11', 'C11', 'Lunch', 'A21', 'A14', 'B21', 'C21'],
  ['D11', 'E11', 'F11', 'Lunch', 'D21', 'E14', 'E21', 'F21'],
  ['A12', 'B12', 'C12', 'Lunch', 'A22', 'B14', 'B22', 'A24'],
  ['D12', 'E12', 'F12', 'Lunch', 'D22', 'F14', 'E22', 'F22'],
  ['A13', 'B13', 'C13', 'Lunch', 'A23', 'C14', 'B23', 'B24'],
  ['D13', 'E13', 'F13', 'Lunch', 'D23', 'D14', 'D24', 'E23'],
];

const parseSlots = (input) => {
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'Lunch');
  }
  return [];
};

export function SlotSelectionModal({
  isOpen,
  onClose,
  currentSlot = '',
  selectedSlot = '',
  onSelectSlot,
}) {
  const initialValue = selectedSlot || currentSlot;
  const [selectedSlots, setSelectedSlots] = useState(() => parseSlots(initialValue));

  // Sync selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSlots(parseSlots(selectedSlot || currentSlot));
    }
  }, [isOpen, currentSlot, selectedSlot]);

  if (!isOpen) return null;

  // Toggle a single slot code in multi-select state
  const toggleSlot = (slotCode) => {
    if (slotCode === 'Lunch') return;
    setSelectedSlots((prev) => {
      if (prev.includes(slotCode)) {
        return prev.filter((s) => s !== slotCode);
      } else {
        return [...prev, slotCode];
      }
    });
  };

  const handleClearAll = () => {
    setSelectedSlots([]);
  };

  const handleConfirm = () => {
    if (selectedSlots.length > 0) {
      onSelectSlot(selectedSlots.join(', '));
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="bg-white w-full sm:max-w-3xl md:max-w-4xl rounded-t-[28px] sm:rounded-[28px] border border-[#F4E3D8] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 rounded-full bg-[#E2E8F0] mx-auto mt-2.5 sm:hidden" />

        {/* ================================================================= */}
        {/* MODAL HEADER                                                      */}
        {/* ================================================================= */}
        <div className="px-4 sm:px-6 pt-3.5 pb-3 border-b border-[#F4E3D8]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Calendar className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-[#17233C] leading-tight">
                  Select Slots from Timetable
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] font-black text-[10px] border border-[#BFDBFE]">
                  Multi-Select
                </span>
              </div>
              <p className="text-[11px] text-[#6E7587] font-medium leading-tight mt-0.5">
                Tap as many slots as you want • Tap again to deselect
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FFF8F3] hover:bg-[#F4E3D8] text-[#6E7587] hover:text-[#17233C] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.4]" />
          </button>
        </div>

        {/* Horizontal Scroll Helper Pill on mobile */}
        <div className="px-4 sm:px-6 pt-2 pb-1 flex items-center justify-between text-[11px] text-[#6E7587]">
          <div className="flex items-center gap-1.5 text-[#3B82F6] font-bold">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Scroll horizontally to view all 8 columns</span>
          </div>
          <div className="flex items-center gap-1 text-[#D97706] font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>Select Multiple Slots</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL BODY: EXACT TIMETABLE GRID                                  */}
        {/* ================================================================= */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1">
          <div className="overflow-x-auto rounded-xl border-2 border-[#3B82F6] shadow-xs bg-white">
            <table className="w-full min-w-[640px] sm:min-w-[700px] border-collapse border border-[#3B82F6] text-center select-none">
              {/* Header Row: Column timings */}
              <thead className="bg-[#93C5FD] text-[#1E3A8A] font-black text-xs sm:text-sm border-b-2 border-[#3B82F6]">
                <tr>
                  {TIMETABLE_HEADERS.map((headerText, colIdx) => (
                    <th
                      key={colIdx}
                      className={`border border-[#3B82F6] py-2 px-1 text-center font-black ${
                        headerText === 'Lunch'
                          ? 'bg-[#CBD5E1] text-[#334155] w-14'
                          : ''
                      }`}
                    >
                      {headerText}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body: 6 Rows exactly matching reference image */}
              <tbody className="divide-y divide-[#3B82F6]">
                {TIMETABLE_ROWS.map((rowCells, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-blue-50/20 transition-colors">
                    {rowCells.map((cellValue, colIdx) => {
                      const isLunch = cellValue === 'Lunch';
                      const isSelected = selectedSlots.includes(cellValue);

                      if (isLunch) {
                        return (
                          <td
                            key={colIdx}
                            className="border border-[#3B82F6] bg-[#E2E8F0] text-[#475569] font-bold text-xs py-2.5 sm:py-3 px-1 text-center select-none"
                          >
                            Lunch
                          </td>
                        );
                      }

                      return (
                        <td
                          key={colIdx}
                          onClick={() => toggleSlot(cellValue)}
                          className={`border border-[#3B82F6] text-center py-2.5 sm:py-3.5 px-1 cursor-pointer transition-all active:scale-95 ${
                            isSelected
                              ? 'bg-[#CCFF00] text-[#0F172A] font-black ring-2 ring-[#0F172A] border-2 border-[#1E40AF] shadow-xs'
                              : 'bg-[#FEFCE8] text-[#17233C] hover:bg-[#FEF08A] font-bold text-xs sm:text-sm'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <span className="tracking-tight leading-none">
                              {cellValue}
                            </span>
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A] mt-1" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* =============================================================== */}
          {/* MULTI-SELECT CHIPS & SELECTION SUMMARY                          */}
          {/* =============================================================== */}
          <div className="mt-3 p-3 rounded-2xl bg-[#FFFDF5] border border-[#FEF08A] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#78350F] font-black">
                  Selected Slots ({selectedSlots.length}):
                </span>
                {selectedSlots.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] font-black text-[10px]">
                    {selectedSlots.length} active
                  </span>
                )}
              </div>
              {selectedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedSlots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedSlots.map((slot) => (
                  <span
                    key={slot}
                    className="inline-flex items-center gap-1 font-black text-[#17233C] bg-[#CCFF00] border-2 border-[#1E3A8A] px-2.5 py-1 rounded-lg text-xs shadow-2xs"
                  >
                    <span>{slot}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSlot(slot);
                      }}
                      className="w-3.5 h-3.5 rounded-full bg-black/10 hover:bg-black/20 text-[#17233C] flex items-center justify-center text-[10px] cursor-pointer"
                      title={`Remove ${slot}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#9CA3AF] italic">
                None selected yet. Tap any slot codes in the timetable above to select multiple slots.
              </p>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER: CANCEL & SELECT SLOTS BUTTONS                       */}
        {/* ================================================================= */}
        <div className="px-4 sm:px-6 py-3 bg-[#FFFDF9] border-t border-[#F4E3D8] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full border border-[#F4E3D8] text-xs sm:text-sm font-bold text-[#6E7587] hover:bg-white hover:text-[#17233C] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedSlots.length === 0}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] active:scale-98 text-[#17233C] font-black text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              {selectedSlots.length === 0
                ? 'Select Slots'
                : selectedSlots.length === 1
                ? 'Select 1 Slot'
                : `Select ${selectedSlots.length} Slots`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default SlotSelectionModal;
