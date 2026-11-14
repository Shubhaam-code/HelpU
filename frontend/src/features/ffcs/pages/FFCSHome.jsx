import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  ArrowLeft
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import heroImgSrc from '../../../assets/images/ffcs_hero_illustration.png';

export function FFCSHome() {
  const navigate = useNavigate();
  const { uploadSlots, uploadCourseImage } = useFFCS();
  const [expanded, setExpanded] = useState(false);
  const [selectedSlotForUpload, setSelectedSlotForUpload] = useState(null);
  const fileInputRef = useRef(null);

  // Default shows 3 courses as in screenshot, expandable up to 5
  const visibleSlots = expanded ? uploadSlots.slice(0, 5) : uploadSlots.slice(0, 3);

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
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28 relative overflow-x-hidden selection:bg-[#FDE047]">
      {/* Hidden file input for native image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Decorative Warm Golden Wave Background Gradients */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/45 via-[#FFFBEB]/30 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FDE047]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-24 -left-12 w-40 h-40 bg-[#FEF08A]/30 rounded-full blur-2xl pointer-events-none" />
      
      {/* Bottom organic wave glow */}
      <div className="absolute bottom-16 left-0 right-0 h-48 bg-gradient-to-t from-[#FEF08A]/30 via-[#FFFBEB]/20 to-transparent pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-44 h-44 bg-[#FDE047]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-44 h-44 bg-[#FEF08A]/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Area (Mobile First 393px) */}
      <main className="w-full max-w-[393px] mx-auto px-4 pt-2 space-y-3.5 relative z-10">
        
        {/* Top Minimal Navigation Bar */}
        <div className="flex items-center justify-between pt-1 pb-0.5">
          <button
            type="button"
            onClick={() => navigate('/slotmate')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#854D0E] hover:text-[#17233C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>SlotMate</span>
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs/courses')}
            className="text-[11px] font-extrabold text-[#854D0E] bg-[#FEF08A]/80 hover:bg-[#FDE047] px-2.5 py-0.5 rounded-full border border-[#FACC15]/60 transition-all cursor-pointer"
          >
            All Courses ({uploadSlots.length}) →
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 1. HERO SECTION: 3D BOY & GIRL STUDYING AT DESK WITH LAPTOP               */}
        {/* ========================================================================= */}
        <div className="w-full flex justify-center items-center select-none pointer-events-none -mt-1 mb-1">
          <div className="w-full max-w-[360px] flex justify-center items-center">
            <img
              src={heroImgSrc}
              alt="FFCS Course Registration"
              className="w-full h-auto max-h-[175px] object-contain drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SECTION: "Your Courses" + DECORATIVE YELLOW SPARKLE CLUSTER            */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-1 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
            <h2 className="font-black text-[19px] text-[#17233C] tracking-tight">
              Your Courses
            </h2>
          </div>

          {/* 3 Floating Golden Yellow Dots matching screenshot */}
          <div className="flex items-center gap-1.5 pr-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15] shadow-xs" />
            <span className="w-2 h-2 rounded-full bg-[#FDE047]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#FEF08A]" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. COMPACT HORIZONTAL COURSE CARDS (1, 2, 3)                              */}
        {/* ========================================================================= */}
        <div className="space-y-2.5">
          {visibleSlots.map((slot) => {
            const isUploaded = slot.uploaded;

            return (
              <div
                key={slot.id}
                className="bg-white rounded-[24px] p-3 sm:p-3.5 shadow-[0_8px_20px_rgba(23,35,60,0.04)] border border-[#F1F5F9] flex items-center justify-between gap-3 transition-all hover:shadow-[0_10px_24px_rgba(250,204,21,0.12)]"
              >
                {/* Left: Yellow Circular Number Badge (1, 2, 3) */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-[#FACC15] text-[#17233C] font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                    {slot.id}
                  </div>

                  {/* Title & Upload Subtitle */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-[15px] text-[#17233C] leading-tight truncate">
                      {slot.label}
                    </h3>
                    <p className="text-xs font-semibold text-[#64748B] mt-0.5 truncate">
                      {isUploaded && slot.fileName
                        ? slot.fileName
                        : 'Upload Image'}
                    </p>
                  </div>
                </div>

                {/* Right: Yellow Rounded Upload Button (STRICT: NO GREEN BUTTONS!) */}
                <button
                  type="button"
                  onClick={() => handleUploadClick(slot.id)}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-[0_4px_12px_rgba(250,204,21,0.35)] shrink-0 bg-gradient-to-r from-[#FDE047] to-[#FACC15] hover:from-[#FACC15] hover:to-[#EAB308] text-[#17233C] border border-[#FACC15]"
                >
                  <UploadCloud className="w-4 h-4 stroke-[2.4]" />
                  <span>Upload</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 4. "ADD MORE COURSE" DASHED OUTLINE BUTTON WITH BURST ACCENTS             */}
        {/* ========================================================================= */}
        <div className="relative flex items-center justify-center w-full pt-1 pb-0.5">
          {/* Left burst rays */}
          <div className="flex flex-col gap-1 text-[#FACC15] mr-2 shrink-0">
            <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[-35deg]" />
            <div className="w-3.5 h-0.5 bg-[#FACC15] rounded-full" />
            <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[35deg]" />
          </div>

          {/* Yellow Dashed Button */}
          <button
            type="button"
            onClick={() => {
              // Expand slots if not already expanded, and trigger upload
              if (!expanded) setExpanded(true);
              const nextSlot = uploadSlots.find((s) => !s.uploaded) || uploadSlots[uploadSlots.length - 1];
              handleUploadClick(nextSlot.id);
            }}
            className="flex-1 py-2.5 px-4 rounded-full bg-[#FFFDF7] hover:bg-[#FEFCE8] border-2 border-dashed border-[#FACC15] flex flex-col items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <div className="flex items-center gap-1.5 text-[#17233C]">
              <PlusCircle className="w-4 h-4 stroke-[2.4]" />
              <span className="font-extrabold text-xs sm:text-sm">Add More Course</span>
            </div>
            <span className="text-[10px] text-[#64748B] font-semibold leading-tight">
              (Up to 3 Screenshots)
            </span>
          </button>

          {/* Right burst rays */}
          <div className="flex flex-col gap-1 text-[#FACC15] ml-2 shrink-0">
            <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[35deg]" />
            <div className="w-3.5 h-0.5 bg-[#FACC15] rounded-full" />
            <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[-35deg]" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. "SEE MORE COURSES ⌵" PILL BUTTON (NO NAVY BUTTONS)                     */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 px-4 rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#17233C] font-black text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(254,240,138,0.4)] border border-[#FDE047]/60 transition-all cursor-pointer active:scale-98"
        >
          <span>{expanded ? 'Show Less Courses' : 'See More Courses'}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 stroke-[2.8]" />
          ) : (
            <ChevronDown className="w-4 h-4 stroke-[2.8]" />
          )}
        </button>

        {/* ========================================================================= */}
        {/* 6. CLEAR, CRISP DOCUMENT/CHECKMARK ILLUSTRATION & EXPLANATORY TEXT         */}
        {/* ========================================================================= */}
        <div className="pt-2 pb-2 flex flex-col items-center text-center">
          {/* Crisp, high-res Vector SVG Document with Checkmark Badge */}
          <div className="w-16 h-16 flex items-center justify-center mb-1">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-xs"
            >
              {/* Radiating sparkle rays */}
              <path d="M42 12L45 9" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M46 16L50 16" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M43 20L47 22" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />

              {/* Yellow sheet in the back */}
              <rect
                x="14"
                y="14"
                width="24"
                height="30"
                rx="3"
                transform="rotate(-8 14 14)"
                fill="#FDE047"
                stroke="#17233C"
                strokeWidth="2"
              />

              {/* White sheet in front */}
              <path
                d="M17 12C17 10.8954 17.8954 10 19 10H33L41 18V43C41 44.1046 40.1046 45 39 45H19C17.8954 45 17 44.1046 17 43V12Z"
                fill="white"
                stroke="#17233C"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Folded corner */}
              <path
                d="M33 10V18H41"
                fill="#FEF3C7"
                stroke="#17233C"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />

              {/* Text lines */}
              <path d="M22 20H32" stroke="#17233C" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22 26H35" stroke="#17233C" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22 32H28" stroke="#17233C" strokeWidth="2.2" strokeLinecap="round" />

              {/* Circular Yellow Checkmark Badge */}
              <circle
                cx="37"
                cy="38"
                r="8.5"
                fill="#FACC15"
                stroke="#17233C"
                strokeWidth="2.2"
              />
              <path
                d="M33.5 38L36 40.5L40.5 35.5"
                stroke="#17233C"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Explanatory text matching screenshot */}
          <p className="font-extrabold text-[15px] sm:text-base text-[#17233C] leading-snug">
            Upload your courses to <br />
            generate your timetable
          </p>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 7. FIXED BOTTOM NAVIGATION: HOME | TIME TABLE | SETTINGS                  */}
      {/* ========================================================================= */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
