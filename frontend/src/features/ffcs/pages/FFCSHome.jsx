import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import heroImgSrc from '../../../assets/images/ffcs_hero_illustration.png';
import docImgSrc from '../../../assets/images/ffcs_doc_illustration.png';

export function FFCSHome() {
  const navigate = useNavigate();
  const { uploadSlots, uploadCourseImage, loadDemoData } = useFFCS();
  const [expanded, setExpanded] = useState(false);
  const [selectedSlotForUpload, setSelectedSlotForUpload] = useState(null);
  const fileInputRef = useRef(null);

  // Default shows 3 courses as in screenshot, expandable up to 5
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
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28 relative overflow-x-hidden">
      {/* Hidden file input for native image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Decorative Warm Golden Wave Background Elements */}
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-[#FEF08A]/35 via-[#FFFBEB]/40 to-transparent pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#FDE047]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 -left-12 w-36 h-36 bg-[#FEF08A]/25 rounded-full blur-2xl pointer-events-none" />

      {/* Main Content Area */}
      <main className="w-full max-w-[420px] mx-auto px-4 pt-3.5 space-y-4 relative z-10">
        
        {/* ========================================================================= */}
        {/* 1. HEADER: CAP ICON | FFCS - Faculty & Course Selection                   */}
        {/* ========================================================================= */}
        <header className="flex items-center justify-between pt-1 pb-0.5">
          <div className="flex items-center gap-2.5">
            {/* Back button to SlotMate */}
            <button
              type="button"
              onClick={() => navigate('/slotmate')}
              className="w-8 h-8 rounded-full bg-white/80 border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-white active:scale-95 transition-all shadow-2xs cursor-pointer mr-0.5"
              title="Return to SlotMate"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Official Graduation Cap SVG matching reference screenshot */}
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <svg
                width="34"
                height="34"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-xs"
              >
                {/* Mortarboard Diamond Top */}
                <path
                  d="M20 7L4 16L20 25L36 16L20 7Z"
                  fill="#17233C"
                />
                {/* Cap Skull Underneath */}
                <path
                  d="M10 20.5V26.5C10 29.5 14.5 32 20 32C25.5 32 30 29.5 30 26.5V20.5L20 26L10 20.5Z"
                  fill="#17233C"
                />
                {/* Golden Tassel */}
                <path
                  d="M32 18V27.5C32 28.5 30.5 29.5 30.5 29.5"
                  stroke="#FACC15"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="30.5" cy="30" r="2.2" fill="#FACC15" />
              </svg>
            </div>

            {/* Subtle Vertical Divider */}
            <div className="w-[1.5px] h-7 bg-[#CBD5E1]/60 mx-0.5" />

            {/* Title & Subtitle */}
            <div className="flex flex-col justify-center">
              <h1 className="font-black text-xl text-[#17233C] leading-none tracking-tight">
                FFCS
              </h1>
              <p className="text-[11px] font-semibold text-[#475569] leading-tight mt-0.5">
                Faculty &amp; Course Selection
              </p>
            </div>
          </div>

          {/* Quick Demo button */}
          <button
            type="button"
            onClick={loadDemoData}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF08A]/80 hover:bg-[#FDE047] text-[#854D0E] text-[10px] font-black border border-[#FACC15]/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Load Sample VIT Courses"
          >
            <Sparkles className="w-3 h-3 text-[#D97706]" />
            <span>Sample Demo</span>
          </button>
        </header>

        {/* ========================================================================= */}
        {/* 2. HERO ILLUSTRATION: BOY & GIRL STUDYING AT DESK WITH LAPTOP             */}
        {/* ========================================================================= */}
        <div className="w-full flex justify-center items-center py-1 select-none pointer-events-none">
          <div className="w-full max-w-[360px] flex justify-center items-center">
            <img
              src={heroImgSrc}
              alt="FFCS Course Selection"
              className="w-full h-auto max-h-[220px] object-contain drop-shadow-sm transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-hero');
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            {/* Fallback container */}
            <div className="fallback-hero hidden w-full h-[180px] flex flex-col items-center justify-center bg-[#FEF9C3]/50 rounded-3xl border border-[#FDE047]/60 p-4">
              <BookOpen className="w-12 h-12 text-[#D97706] mb-2" />
              <p className="font-black text-sm text-[#17233C]">FFCS Companion</p>
              <p className="text-xs text-[#854D0E]">Organize courses and generate timetable</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SECTION: YOUR COURSES + DECORATIVE SPARKLE DOTS                        */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
            <h2 className="font-black text-lg text-[#17233C] tracking-tight">
              Your Courses
            </h2>
          </div>

          {/* Decorative Sparkle Golden Dots matching screenshot */}
          <div className="flex items-center gap-1.5 pr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15] shadow-xs" />
            <span className="w-2 h-2 rounded-full bg-[#FDE047]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#FEF08A]" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. COURSE UPLOAD CARDS (White rounded cards with yellow badge & button)    */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          {visibleSlots.map((slot) => {
            const isUploaded = slot.uploaded;

            return (
              <div
                key={slot.id}
                className="bg-white rounded-[26px] p-3.5 sm:p-4 shadow-[0_8px_24px_rgba(23,35,60,0.05)] border border-[#F3F4F6] flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-[0_12px_28px_rgba(250,204,21,0.12)]"
              >
                {/* Left: Yellow Numbered Badge (1, 2, 3) + Title */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Yellow Circle Badge */}
                  <div className="w-12 h-12 rounded-full bg-[#FACC15] text-[#17233C] font-black text-xl flex items-center justify-center shrink-0 shadow-xs">
                    {slot.id}
                  </div>

                  {/* Title & Subtitle */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-base text-[#17233C] leading-tight truncate">
                      {slot.label}
                    </h3>
                    <p className="text-xs font-semibold text-[#64748B] mt-0.5 truncate">
                      {isUploaded
                        ? slot.fileName || `${slot.courseCode || 'Course'} Image`
                        : 'Upload Image'}
                    </p>
                  </div>
                </div>

                {/* Right: Upload Button with Cloud Icon */}
                <button
                  type="button"
                  onClick={() => handleUploadClick(slot.id)}
                  className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-[0_4px_14px_rgba(250,204,21,0.35)] shrink-0 ${
                    isUploaded
                      ? 'bg-[#10B981] hover:bg-[#059669] text-white border border-[#059669]'
                      : 'bg-gradient-to-r from-[#FDE047] to-[#FACC15] hover:from-[#FACC15] hover:to-[#EAB308] text-[#17233C] border border-[#FACC15]'
                  }`}
                >
                  {isUploaded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Uploaded ✓</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 5. "SEE MORE COURSES ⌵" PILL BUTTON                                       */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3.5 px-4 rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#17233C] font-black text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(254,240,138,0.4)] border border-[#FDE047]/60 transition-all cursor-pointer active:scale-98"
        >
          <span>{expanded ? 'Show Less Courses' : 'See More Courses'}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 stroke-[2.8]" />
          ) : (
            <ChevronDown className="w-4 h-4 stroke-[2.8]" />
          )}
        </button>

        {/* ========================================================================= */}
        {/* 6. DOCUMENT WITH CHECKMARK GRAPHIC & TEXT                                 */}
        {/* ========================================================================= */}
        <div className="pt-2 pb-1 flex flex-col items-center text-center">
          {/* Document with checkmark graphic */}
          <div className="w-16 h-16 flex items-center justify-center mb-1.5">
            <img
              src={docImgSrc}
              alt="Upload documents"
              className="w-14 h-14 object-contain select-none pointer-events-none drop-shadow-xs"
              onError={(e) => {
                // Fallback SVG if image is missing
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-doc');
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            {/* Fallback SVG document with checkmark badge */}
            <div className="fallback-doc hidden relative">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Paper sheet */}
                <path d="M12 8C12 6.89543 12.8954 6 14 6H28L36 14V40C36 41.1046 35.1046 42 34 42H14C12.8954 42 12 41.1046 12 40V8Z" fill="white" stroke="#17233C" strokeWidth="2.5" />
                <path d="M28 6V14H36" stroke="#17233C" strokeWidth="2.5" strokeLinejoin="round" />
                {/* Lines */}
                <path d="M18 18H28M18 24H30M18 30H24" stroke="#17233C" strokeWidth="2" strokeLinecap="round" />
                {/* Yellow circular check badge */}
                <circle cx="34" cy="34" r="8" fill="#FACC15" stroke="#17233C" strokeWidth="2" />
                <path d="M31 34L33.5 36.5L37.5 31.5" stroke="#17233C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Centered Descriptive Text matching screenshot */}
          <p className="font-extrabold text-sm sm:text-base text-[#17233C] leading-snug">
            Upload your courses to <br />
            generate your timetable
          </p>

          {/* Primary View Added Courses Action */}
          <div className="w-full pt-3">
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/courses')}
              className="w-full py-3.5 px-4 rounded-full bg-[#17233C] hover:bg-[#23314F] text-amber-300 font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-slate-900/15 transition-all cursor-pointer active:scale-98"
            >
              <span>View Added Courses ({uploadSlots.length})</span>
              <ArrowRight className="w-4 h-4 text-amber-300 stroke-[2.8]" />
            </button>
          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 7. BOTTOM NAVIGATION: HOME | TIME TABLE | SETTINGS                        */}
      {/* ========================================================================= */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
