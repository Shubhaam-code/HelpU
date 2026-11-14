import React, { useMemo } from 'react';
import { VIT_TIME_COLUMNS, VIT_TIMETABLE_DAYS } from '../data/sampleCourses';

export function TimetableGrid({ confirmedFaculties = {} }) {
  // Map of slot codes -> faculty/course info
  const slotMap = useMemo(() => {
    const map = {};
    Object.values(confirmedFaculties).forEach((fac) => {
      if (!fac || !fac.slot) return;
      const codes = fac.slot.split('+').map((s) => s.trim().toUpperCase());
      codes.forEach((code) => {
        map[code] = {
          slotCode: code,
          courseCode: fac.courseCode,
          roomNo: fac.roomNo,
          facultyName: fac.name
        };
      });
    });
    return map;
  }, [confirmedFaculties]);

  const totalRegisteredSlots = Object.keys(slotMap).length;

  return (
    <div className="w-full space-y-3">
      {/* Responsive Horizontal Scroll Container */}
      <div className="bg-white rounded-2xl border border-[#FEEBA4] shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-amber-200">
          <table className="min-w-[760px] w-full border-collapse text-center">
            {/* Table Header - Light Blue Theme */}
            <thead>
              <tr className="bg-[#E0F2FE] text-[#0369A1]">
                <th className="py-2.5 px-3 text-[11px] font-black tracking-wider uppercase border-r border-[#BAE6FD] w-16 text-[#0369A1]">
                  Day
                </th>
                {VIT_TIME_COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    className={`py-2 px-1 text-[10px] font-bold border-r border-[#BAE6FD] last:border-r-0 ${
                      col.isLunch ? 'w-14 bg-[#BAE6FD]' : 'w-24'
                    }`}
                  >
                    {col.isLunch ? (
                      <span className="text-[#0369A1] font-extrabold uppercase tracking-wide">
                        Lunch
                      </span>
                    ) : (
                      <>
                        <div className="font-extrabold text-[10px] text-[#0284C7]">
                          {col.start}
                        </div>
                        <div className="text-[9px] text-[#0369A1]/80 font-medium">{col.end}</div>
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {VIT_TIMETABLE_DAYS.map((row, rowIdx) => {
                const isEven = rowIdx % 2 === 0;

                return (
                  <tr
                    key={row.day}
                    className={`border-b border-[#FEEBA4]/70 last:border-b-0 ${
                      isEven ? 'bg-[#FFFDF7]' : 'bg-[#FFF9EA]/60'
                    }`}
                  >
                    {/* Day Column */}
                    <td className="py-2 px-2 font-black text-xs text-[#17233C] border-r border-[#FEEBA4] bg-[#FEF3C7]/40">
                      {row.day}
                    </td>

                    {/* Time Slots */}
                    {VIT_TIME_COLUMNS.map((col) => {
                      if (col.isLunch) {
                        return (
                          <td
                            key={col.id}
                            className="py-1 px-1 border-r border-[#FEEBA4] bg-[#F1F5F9]/80 text-[#94A3B8] text-[10px] font-bold select-none"
                          >
                            <span className="rotate-0 inline-block text-[9px] tracking-wider uppercase opacity-75">
                              Lunch
                            </span>
                          </td>
                        );
                      }

                      const slotCode = row.slots[col.id];
                      const matched = slotCode ? slotMap[slotCode.toUpperCase()] : null;

                      if (matched) {
                        return (
                          <td
                            key={col.id}
                            className="py-1.5 px-1 border-r border-[#A7F3D0] bg-[#DCFCE7] hover:bg-[#BBF7D0] transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-emerald-100/60 border border-emerald-300 shadow-2xs">
                              <span className="font-black text-[10px] text-[#065F46] leading-none">
                                {slotCode}
                              </span>
                              <span className="font-bold text-[9px] text-[#047857] truncate max-w-[80px] mt-0.5 leading-tight">
                                {matched.courseCode}
                              </span>
                              <span className="text-[8px] font-medium text-[#059669] truncate max-w-[80px] leading-tight">
                                {matched.roomNo}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.id}
                          className="py-2 px-1 border-r border-[#FEEBA4]/60 text-[#78350F] hover:bg-amber-100/50 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center min-h-[36px]">
                            <span className="text-[11px] font-bold text-[#854D0E]/80">
                              {slotCode || '—'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-1">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#10B981] ring-2 ring-[#A7F3D0]" />
          <span className="text-xs font-bold text-[#17233C]">Registered ({totalRegisteredSlots})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#FDE68A] ring-2 ring-[#FEF3C7]" />
          <span className="text-xs font-bold text-[#64748B]">Available</span>
        </div>
      </div>
    </div>
  );
}

