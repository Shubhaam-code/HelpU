import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  CalendarDays,
  ShieldCheck,
  Download
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';

export function FFCSSettingsScreen() {
  const navigate = useNavigate();
  const { loadDemoData, resetAllData, confirmedFaculties, courses } = useFFCS();
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleReset = () => {
    resetAllData();
    showToast('All selections & uploaded courses have been reset.');
  };

  const handleLoadDemo = () => {
    loadDemoData();
    showToast('Loaded 5 sample VIT courses with confirmed faculties.');
  };

  const handleSimulateExport = () => {
    showToast('Timetable exported! (Mock download ready)');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Main Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs')}
              className="w-9 h-9 rounded-xl bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              FFCS Settings
            </h1>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shadow-2xs border border-[#FDE047]">
            <Settings className="w-4 h-4 stroke-[2.2]" />
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Quick Stats Card */}
        <div className="bg-white rounded-2xl border border-[#FEEBA4] p-4 shadow-xs flex items-center justify-between">
          <div>
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
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs/timetable')}
            className="px-3 py-2 rounded-xl bg-[#FFD426] text-[#17233C] font-bold text-xs shadow-2xs active:scale-95 transition-transform"
          >
            View Grid
          </button>
        </div>

        {/* Demo & State Controls */}
        <div className="bg-white rounded-2xl border border-[#FEEBA4] p-4 shadow-xs space-y-3">
          <h2 className="font-black text-xs uppercase tracking-wider text-[#854D0E]">
            Data &amp; Preview Controls
          </h2>

          <div className="space-y-2">
            {/* Load Sample Demo Data */}
            <button
              type="button"
              onClick={handleLoadDemo}
              className="w-full p-3 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#17233C]">
                    Load Sample Demo Data
                  </h4>
                  <p className="text-[10px] text-[#64748B]">
                    Populate 5 sample courses and faculties
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-[#D97706]">Load</span>
            </button>

            {/* Reset All Data */}
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
                    Clear uploaded courses and confirmed faculties
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-rose-600">Reset</span>
            </button>

            {/* Export Timetable */}
            <button
              type="button"
              onClick={handleSimulateExport}
              className="w-full p-3 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#17233C]">
                    Export Timetable (PDF / Image)
                  </h4>
                  <p className="text-[10px] text-[#64748B]">
                    Download your weekly schedule for offline view
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
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Frontend UI v1.0 • VIT Timetable Matrix Compatible</span>
          </div>
        </div>
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="settings" />
    </div>
  );
}

