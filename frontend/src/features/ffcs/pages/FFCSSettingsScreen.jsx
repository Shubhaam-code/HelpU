import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Info,
  CheckCircle2,
  AlertCircle,
  Download,
  CalendarCheck,
  FileSpreadsheet
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { downloadTimetablePdf } from '../utils/exportTimetablePdf';

export function FFCSSettingsScreen() {
  const navigate = useNavigate();
  const { resetSelections, confirmedFaculties, coursesList, courses } = useFFCS();
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showResetModal, setShowResetModal] = useState(false);

  const totalCourses = coursesList?.length || courses?.length || 0;
  const selectedCount = Object.keys(confirmedFaculties || {}).length;

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
    <div className="min-h-[100dvh] bg-[#F0F6FF] flex justify-center selection:bg-blue-200">
      <div className="w-full max-w-[430px] min-h-[100dvh] bg-gradient-to-b from-[#EFF6FF] via-[#F4F9FF] to-[#EAF2FE] text-[#0F172A] flex flex-col justify-between pb-28 relative overflow-x-hidden sm:shadow-xl sm:border-x sm:border-blue-100">
        
        {/* Soft Ambient Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[340px] h-[220px] bg-blue-300/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-200/40 blur-2xl rounded-full pointer-events-none" />

        {/* Main Content */}
        <main className="w-full px-4 pt-3 space-y-4 relative z-10 flex-1">
          
          {/* Header */}
          <header className="flex items-center justify-between py-1">
            <h1 className="font-black text-lg text-[#0B1E48] tracking-tight">
              FFCS Settings
            </h1>
            <div className="text-[11px] font-black text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-full border border-[#BFDBFE]">
              Preferences
            </div>
          </header>

          {/* Toast Alert */}
          {toastMessage && (
            <div
              className={`border px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-in fade-in ${
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
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Current Status Card */}
          <div className="bg-white rounded-3xl border border-[#BFDBFE] p-4 sm:p-5 shadow-[0_8px_24px_rgba(37,99,235,0.06)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] block">
                Current Status
              </span>
              <h3 className="font-black text-base sm:text-lg text-[#0F172A] mt-0.5">
                {selectedCount} / {totalCourses} Registered
              </h3>
              <p className="text-[11px] text-[#475569] font-medium mt-0.5 truncate">
                Weekly schedule active in Timetable
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
              <CalendarCheck className="w-5 h-5 stroke-[2.4]" />
            </div>
          </div>

          {/* Data & Export Controls */}
          <div className="bg-white rounded-3xl border border-[#BFDBFE] p-4 sm:p-5 shadow-[0_8px_24px_rgba(37,99,235,0.06)] space-y-3">
            <h2 className="font-black text-xs uppercase tracking-wider text-[#2563EB]">
              Data &amp; Export Controls
            </h2>

            <div className="space-y-2.5">
              {/* Reset Selections */}
              <button
                type="button"
                onClick={handleResetClick}
                className="w-full p-3 sm:p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-rose-50/60 border border-[#E2E8F0] hover:border-rose-200 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-xs sm:text-sm text-[#0F172A] group-hover:text-rose-600 transition-colors">
                      Reset Selections
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium truncate mt-0.5">
                      Remove selected teachers &amp; clear timetable
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shrink-0">
                  Reset
                </span>
              </button>

              {/* Export Timetable (PDF Only) */}
              <button
                type="button"
                onClick={handleExportPdf}
                className="w-full p-3 sm:p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-blue-50/60 border border-[#E2E8F0] hover:border-blue-200 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-xs sm:text-sm text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                      Export Timetable (PDF)
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium truncate mt-0.5">
                      Download weekly matrix as printable PDF
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-full border border-[#BFDBFE] shrink-0">
                  Export
                </span>
              </button>
            </div>
          </div>

          {/* About FFCS Companion */}
          <div className="bg-white rounded-3xl border border-[#BFDBFE] p-4 sm:p-5 shadow-[0_8px_24px_rgba(37,99,235,0.06)] space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#2563EB] stroke-[2.4]" />
              <h3 className="font-black text-xs sm:text-sm text-[#0F172A]">
                About FFCS Companion
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-[#475569] font-medium leading-relaxed">
              Faculty &amp; Course Selection (FFCS) module allows VIT students to organize courses, review faculties, check classroom venues, and visualize clash-free weekly timetable matrices directly inside HelpU SlotMate.
            </p>
          </div>
        </main>

        {/* Bottom Navigation */}
        <FFCSBottomNav activeTab="settings" />

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
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm w-full border border-blue-100 text-center space-y-4 animate-in zoom-in-95 duration-200"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto shadow-xs">
                <RotateCcw className="w-7 h-7 stroke-[2.2]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-black text-lg text-[#0F172A]">
                  Reset All Selections?
                </h3>
                <p className="text-xs font-medium text-[#64748B] pt-1 leading-relaxed">
                  Are you sure you want to remove all selected teachers and clear your timetable? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-[#475569] font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer active:scale-95"
                >
                  Yes, Reset All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FFCSSettingsScreen;
