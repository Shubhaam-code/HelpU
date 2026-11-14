import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  UploadCloud,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import heroImgSrc from '../../../assets/images/ffcs_hero_illustration.png';

export function FFCSHome() {
  const navigate = useNavigate();
  const { uploadSlots, uploadCourseImage, loadDemoData, resetAllData } = useFFCS();
  const [expanded, setExpanded] = useState(false);
  const [selectedSlotForUpload, setSelectedSlotForUpload] = useState(null);
  const fileInputRef = useRef(null);

  // Default show 3 slots, expand to 5
  const visibleSlots = expanded ? uploadSlots.slice(0, 5) : uploadSlots.slice(0, 3);
  const uploadedCount = uploadSlots.filter((s) => s.uploaded).length;

  const handleUploadClick = (slotId) => {
    setSelectedSlotForUpload(slotId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && selectedSlotForUpload !== null) {
      uploadCourseImage(selectedSlotForUpload, file);
      setSelectedSlotForUpload(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28">
      {/* Hidden file input for native image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Top Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/slotmate')}
              className="w-9 h-9 rounded-xl bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Return to SlotMate"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#FFD426] text-[#17233C] flex items-center justify-center shadow-xs">
                <GraduationCap className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <h1 className="font-black text-lg text-[#17233C] leading-none tracking-tight">
                  FFCS
                </h1>
                <p className="text-[11px] font-semibold text-[#854D0E] leading-tight">
                  Faculty &amp; Course Selection
                </p>
              </div>
            </div>
          </div>

          {/* Quick Demo Reset / Load */}
          <button
            type="button"
            onClick={loadDemoData}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] text-[10px] font-black border border-[#FACC15] transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Load Sample VIT Courses"
          >
            <Sparkles className="w-3 h-3 text-[#D97706]" />
            <span>Load Demo</span>
          </button>
        </header>

        {/* Hero Banner Illustration */}
        <div className="relative w-full rounded-[24px] bg-gradient-to-b from-[#FEF08A] via-[#FFFBEB] to-[#FFFDF7] p-4 border border-[#FEEBA4] shadow-sm overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-300/30 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Custom PNG Illustration with graceful fallback */}
            <div className="w-full max-w-[280px] h-[160px] sm:h-[180px] flex items-center justify-center">
              <img
                src={heroImgSrc}
                alt="FFCS Course Selection"
                className="w-full h-full object-contain select-none pointer-events-none drop-shadow-md"
                onError={(e) => {
                  // Fallback container if file isn't found
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-hero');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <div className="fallback-hero hidden w-full h-full flex flex-col items-center justify-center bg-amber-100/60 rounded-2xl border border-amber-300/60 p-4">
                <GraduationCap className="w-12 h-12 text-amber-600 mb-2" />
                <p className="font-extrabold text-sm text-[#17233C]">FFCS Smart Companion</p>
                <p className="text-[11px] text-amber-800">Plan courses &amp; timetable seamlessly</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Your Courses */}
        <section className="bg-white rounded-[24px] p-4 border border-[#FEEBA4] shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#FFD426] rounded-full" />
              <h2 className="font-black text-base text-[#17233C] tracking-tight">
                Your Courses
              </h2>
            </div>
            <span className="text-[11px] font-bold text-[#854D0E] bg-[#FEF9C3] px-2.5 py-0.5 rounded-full border border-[#FEF08A]">
              {uploadedCount} Uploaded
            </span>
          </div>

          {/* Upload Rows */}
          <div className="space-y-2.5">
            {visibleSlots.map((slot) => {
              const isUploaded = slot.uploaded;

              return (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isUploaded
                      ? 'bg-[#FEFCE8] border-[#FACC15]'
                      : 'bg-[#FFFDF7] border-[#FEEBA4]/80 hover:border-[#FACC15]'
                  }`}
                >
                  {/* Left: Numbered Badge + Label */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                        isUploaded
                          ? 'bg-[#FFD426] text-[#17233C]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {slot.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-[#17233C] truncate">
                        {slot.label}
                      </h3>
                      <p className="text-[11px] text-[#78350F] font-medium truncate">
                        {isUploaded
                          ? slot.fileName || `${slot.courseCode || 'Course'} Image`
                          : 'Upload Image'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Upload Action Button */}
                  <button
                    type="button"
                    onClick={() => handleUploadClick(slot.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 shadow-xs ${
                      isUploaded
                        ? 'bg-[#10B981] hover:bg-[#059669] text-white border border-[#059669]'
                        : 'bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] border border-[#EAB308]'
                    }`}
                  >
                    {isUploaded ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Uploaded ✓</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5 stroke-[2.4]" />
                        <span>Upload</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* See More Courses Button */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2.5 rounded-xl bg-[#FFFDF7] hover:bg-[#FEF9C3] border border-[#FEEBA4] text-[#854D0E] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <span>{expanded ? 'Show Less Courses' : 'See More Courses'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </section>

        {/* Primary CTA: View Added Courses */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs/courses')}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/25 border border-[#EAB308] transition-all cursor-pointer active:scale-98"
          >
            <span>View Added Courses</span>
            <ArrowRight className="w-4 h-4 stroke-[2.8]" />
          </button>

          {/* Secondary helper */}
          <p className="text-center text-[11px] font-medium text-[#78350F]">
            Pre-loaded with 5 VIT sample courses ready to explore.
          </p>
        </div>

        {/* Informational Card */}
        <div className="bg-[#FFFDF7] rounded-2xl border border-[#FEEBA4] p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-xs text-[#17233C]">
              Upload courses to generate timetable
            </h4>
            <p className="text-[10px] text-[#64748B] leading-tight mt-0.5">
              Select your favorite faculty for each course and watch your weekly grid populate automatically.
            </p>
          </div>
        </div>
      </div>

      {/* 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
