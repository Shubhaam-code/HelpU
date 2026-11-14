import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertCircle,
  Download
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { downloadTimetablePdf } from '../utils/exportTimetablePdf';

export function FFCSSettingsScreen() {
  const navigate = useNavigate();
  const { resetSelections, confirmedFaculties, courses } = useFFCS();
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleReset = () => {
    const selectedCount = Object.keys(confirmedFaculties).length;
    if (selectedCount === 0) {
      showToast('No teacher selections to reset.', 'error');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to remove all selected teachers and clear your timetable? This cannot be undone.'
    );
    if (!confirmed) return;

    resetSelections();
    showToast('All selected teachers and timetable entries have been removed.');
  };

  const handleExportPdf = () => {
    try {
      const selectedCount = Object.keys(confirmedFaculties).length;
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
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Header - Simple back arrow and title, no gear/settings icon */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/60 flex items-center justify-center text-[#17233C] transition-colors cursor-pointer shadow-xs active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              FFCS Settings
            </h1>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`border px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-fade-in ${
              toastType === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
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

        {/* Quick Stats Card */}
        <div className="bg-white rounded-2xl border border-[#FEEBA4] p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#854D0E]">
            Current Status
          </p>
          <h3 className="font-black text-base text-[#17233C]">
            {Object.keys(confirmedFaculties).length} / {courses.length} Registered
          </h3>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Weekly schedule populated in Timetable
          </p>
        </div>

        {/* State & Export Controls */}
        <div className="bg-white rounded-2xl border border-[#FEEBA4] p-4 shadow-xs space-y-3">
          <h2 className="font-black text-xs uppercase tracking-wider text-[#854D0E]">
            Data &amp; Export Controls
          </h2>

          <div className="space-y-2">
            {/* Reset Selections */}
            <button
              type="button"
              onClick={handleReset}
              className="w-full p-3 rounded-xl bg-[#FFFDF7] hover:bg-rose-50 border border-[#FEEBA4] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#17233C]">
                    Reset Selections
                  </h4>
                  <p className="text-[10px] text-[#64748B]">
                    Remove all selected teachers and clear your selections.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-rose-600">Reset</span>
            </button>

            {/* Export Timetable (PDF Only) */}
            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full p-3 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#17233C]">
                    Export Timetable (PDF)
                  </h4>
                  <p className="text-[10px] text-[#64748B]">
                    Download your weekly schedule as PDF for offline view
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700">Export</span>
            </button>
          </div>
        </div>

        {/* About FFCS Companion */}
        <div className="bg-[#FFFDF7] rounded-2xl border border-[#FEEBA4] p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#D97706]" />
            <h3 className="font-black text-xs text-[#17233C]">
              About FFCS Companion
            </h3>
          </div>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Faculty &amp; Course Selection (FFCS) module allows VIT students to organize courses, review faculties, check classroom venues, and visualize clash-free weekly timetable matrices directly inside HelpU SlotMate.
          </p>
        </div>
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="settings" />
    </div>
  );
}

