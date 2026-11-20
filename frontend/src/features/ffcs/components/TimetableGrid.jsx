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
      <div className="bg-white rounded-2xl border border-[#DBEAFE] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200">
          <table className="min-w-[760px] w-full border-collapse text-center">
            {/* Table Header - Light Blue Theme */}
            <thead>
              <tr className="bg-[#EFF6FF] text-[#1D4ED8]">
                <th className="py-2.5 px-3 text-[11px] font-black tracking-wider uppercase border-r border-[#DBEAFE] w-16 text-[#1D4ED8]">
                  Day
                </th>
                {VIT_TIME_COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    className={`py-2 px-1 text-[10px] font-bold border-r border-[#DBEAFE] last:border-r-0 ${
                      col.isLunch ? 'w-14 bg-[#DBEAFE]/70' : 'w-24'
                    }`}
                  >
                    {col.isLunch ? (
                      <span className="text-[#1D4ED8] font-extrabold uppercase tracking-wide">
                        Lunch
                      </span>
                    ) : (
                      <>
                        <div className="font-extrabold text-[10px] text-[#2563EB]">
                          {col.start}
                        </div>
                        <div className="text-[9px] text-[#3B82F6] font-medium">{col.end}</div>
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
                    className={`border-b border-[#DBEAFE] last:border-b-0 ${
                      isEven ? 'bg-white' : 'bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Day Column */}
                    <td className="py-2 px-2 font-black text-xs text-[#17233C] border-r border-[#DBEAFE] bg-[#EFF6FF]">
                      {row.day}
                    </td>

                    {/* Time Slots */}
                    {VIT_TIME_COLUMNS.map((col) => {
                      if (col.isLunch) {
                        return (
                          <td
                            key={col.id}
                            className="py-1 px-1 border-r border-[#DBEAFE] bg-[#F1F5F9]/80 text-[#94A3B8] text-[10px] font-bold select-none"
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
                            className="py-1.5 px-1 border-r border-[#FDE047] bg-[#FEF9C3] hover:bg-[#FEF08A] transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center p-1 rounded-lg bg-[#FEF08A]/90 border border-[#FACC15] shadow-2xs">
                              <span className="font-black text-[10px] text-[#78350F] leading-none">
                                {slotCode}
                              </span>
                              <span className="font-bold text-[9px] text-[#854D0E] truncate max-w-[80px] mt-0.5 leading-tight">
                                {matched.courseCode}
                              </span>
                              <span className="text-[8px] font-medium text-[#92400E] truncate max-w-[80px] leading-tight">
                                {matched.roomNo}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.id}
                          className="py-2 px-1 border-r border-[#DBEAFE] text-[#64748B] hover:bg-[#EFF6FF] transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center min-h-[36px]">
                            <span className="text-[11px] font-bold text-[#64748B]">
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
          <span className="w-3.5 h-3.5 rounded-full bg-[#FACC15] ring-2 ring-[#FEF08A]" />
          <span className="text-xs font-bold text-[#17233C]">Registered ({totalRegisteredSlots})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#BFDBFE] ring-2 ring-[#DBEAFE]" />
          <span className="text-xs font-bold text-[#64748B]">Available</span>
        </div>
      </div>
    </div>
  );
}

