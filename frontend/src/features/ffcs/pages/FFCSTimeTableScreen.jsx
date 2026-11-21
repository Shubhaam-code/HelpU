import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  UserCheck,
  Plus,
  BookOpen,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { TimetableGrid } from '../components/TimetableGrid';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { downloadTimetablePdf } from '../utils/exportTimetablePdf';

export function FFCSTimeTableScreen() {
  const navigate = useNavigate();
  const { confirmedFaculties, courses, resetSelections } = useFFCS();

  // Segmented switch: 'timetable' or 'faculties'
  const [activeTab, setActiveTab] = useState('timetable');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showResetModal, setShowResetModal] = useState(false);

  const confirmedList = Object.values(confirmedFaculties || {});
  const selectedCount = confirmedList.length;

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleResetClick = () => {
    if (selectedCount === 0) {
      showToast('No teacher selections to reset.', 'error');
      return;
    }
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    resetSelections();
    setShowResetModal(false);
    showToast('All selected teachers and timetable entries have been removed.');
  };

  const handleExportPdf = () => {
    try {
      if (selectedCount === 0) {
        showToast(
          'No selected teachers or timetable available to export. Please select at least one teacher first.',
          'error'
        );
        return;
      }

      downloadTimetablePdf({ confirmedFaculties });
      showToast('Timetable PDF downloaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to export timetable PDF.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-lg md:max-w-2xl mx-auto px-3.5 sm:px-4 pt-3 space-y-3.5">
        {/* Header with Quick Actions: Download PDF & Reset */}
        <header className="flex items-center justify-between py-1">
          <h1 className="font-black text-lg sm:text-xl text-[#17233C] tracking-tight">
            Time Table
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#2563EB] font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download Timetable PDF"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.4]" />
              <span className="hidden min-[360px]:inline">Download PDF</span>
              <span className="min-[360px]:hidden">PDF</span>
            </button>
            <button
              type="button"
              onClick={handleResetClick}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[#64748B] hover:text-rose-600 font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Reset Selections"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
              <span className="hidden min-[400px]:inline">Reset</span>
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`border px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-in fade-in ${
              toastType === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {toastType === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1">{toastMessage}</span>
          </div>
        )}

        {/* Top Segmented Switch: [ Faculty List ]  [ My Time Table ] */}
        <div className="bg-white p-1 rounded-2xl border border-[#DBEAFE] flex items-center shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('faculties')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'faculties'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-2xs'
                : 'text-[#64748B] hover:text-[#17233C]'
            }`}
          >
            <UserCheck className={`w-4 h-4 stroke-[2.2] ${activeTab === 'faculties' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
            <span>Faculty List</span>
            {confirmedList.length > 0 && (
              <span
                className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ml-1 transition-colors ${
                  activeTab === 'faculties'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#EFF6FF] text-[#2563EB]'
                }`}
              >
                {confirmedList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-2xs'
                : 'text-[#64748B] hover:text-[#17233C]'
            }`}
          >
            <CalendarDays className={`w-4 h-4 stroke-[2.2] ${activeTab === 'timetable' ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
            <span>My Time Table</span>
          </button>
        </div>

        {/* TAB 1: My Time Table Grid */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <TimetableGrid confirmedFaculties={confirmedFaculties} />

            {/* Quick action card */}
            <div className="bg-white rounded-2xl border border-[#DBEAFE] p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-xs text-[#17233C]">
                  Need to change a faculty or slot?
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Return to your courses and pick another batch or instructor anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/slotmate/ffcs/courses')}
                className="px-3 py-2 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-bold text-xs border border-[#BFDBFE] shrink-0 active:scale-95 transition-all cursor-pointer"
              >
                Manage Courses
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Faculty List */}
        {activeTab === 'faculties' && (
          <div className="space-y-3">
            {confirmedList.length === 0 ? (
              /* Empty State */
              <div className="bg-white rounded-3xl border border-[#DBEAFE] p-8 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center mx-auto shadow-2xs">
                  <UserCheck className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#17233C]">
                    No Faculties Confirmed Yet
                  </h3>
                  <p className="text-xs text-[#64748B] max-w-xs mx-auto mt-1 leading-relaxed">
                    You haven't selected faculties for your registered courses yet. Select your faculties to view them here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/slotmate/ffcs/courses')}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:from-[#2563EB] hover:to-[#1D4ED8] text-white font-black text-xs shadow-md shadow-blue-500/20 cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Go to Added Courses</span>
                </button>
              </div>
            ) : (
              /* Confirmed Faculties Cards - Showing ONLY Teacher Name, Slot, Room No */
              <div className="space-y-2.5">
                {confirmedList.map((fac) => (
                  <div
                    key={fac.courseCode || fac.facultyId}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#DBEAFE] hover:border-[#3B82F6] shadow-xs transition-all space-y-2"
                  >
                    {/* Top Row: Course Code Badge + Change Button */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] font-black text-[10px] sm:text-[11px] tracking-wider uppercase">
                        {fac.courseCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/slotmate/ffcs/faculty/${fac.courseCode}`)}
                        className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all shadow-2xs"
                      >
                        Change
                      </button>
                    </div>

                    {/* Faculty Name: Full width, clean & bold, never truncated */}
                    <h3 className="font-black text-sm text-[#17233C] leading-snug break-words">
                      {fac.name}
                    </h3>

                    {/* Details: Slot & Room No with whitespace-nowrap */}
                    <div className="flex items-center gap-3 pt-0.5 text-xs">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">Slot:</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] font-black text-[10px] sm:text-[11px] border border-[#BFDBFE]">
                          {fac.slot}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide whitespace-nowrap">Room No:</span>
                        <span className="font-extrabold text-xs text-[#17233C] whitespace-nowrap">
                          {fac.roomNo}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Bottom navigation link to courses */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/slotmate/ffcs/courses')}
                    className="w-full py-3 rounded-2xl bg-white hover:bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View All Added Courses ({courses.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="timetable" />

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowResetModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-blue-100 space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-[#0F172A]">
                Reset All Selections?
              </h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                This will remove all your chosen teachers and clear your timetable. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[#64748B] font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

