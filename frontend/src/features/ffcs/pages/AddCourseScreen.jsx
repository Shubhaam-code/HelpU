import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Search,
  ChevronDown,
  UploadCloud,
  PlusCircle,
  Info,
  X,
  CheckCircle2,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import heroImgSrc from '../../../assets/images/ffcs_background.png';
import celebrationImgSrc from '../../../assets/images/ffcs_celebration.png';

export function AddCourseScreen() {
  const navigate = useNavigate();
  const { courses, addCourse } = useFFCS();

  // STEP 1: Course Selection / Input
  const [selectedCourse, setSelectedCourse] = useState(courses[0] || null);
  const [customCourseCode, setCustomCourseCode] = useState('');
  const [customCourseName, setCustomCourseName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [courseConfirmed, setCourseConfirmed] = useState(false);

  // STEP 2: Teacher Screenshots (Maximum 3 Screenshots per course)
  const [screenshots, setScreenshots] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const fileInputRef = useRef(null);

  const activeCourseCode = selectedCourse?.code || customCourseCode.toUpperCase().trim() || 'NEW COURSE';
  const activeCourseName = selectedCourse?.title || customCourseName.trim() || 'Course Details';

  // Handle file uploads (Strictly maximum 3 screenshots per course)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 3 - screenshots.length;
    if (remainingSlots <= 0) return;

    const filesToAdd = files.slice(0, remainingSlots).map((file) => ({
      name: file.name,
      file,
      url: URL.createObjectURL(file)
    }));

    setScreenshots((prev) => [...prev, ...filesToAdd].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScreenshot = (index) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  // STEP 3: Save Course
  const handleSaveCourse = () => {
    addCourse({
      courseCode: activeCourseCode,
      courseName: activeCourseName,
      screenshots: screenshots
    });

    // Show celebratory animation with ffcs_celebration.png
    setShowCelebration(true);
    setTimeout(() => {
      navigate('/slotmate/ffcs');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-28 relative overflow-x-hidden selection:bg-[#FDE047]">
      {/* Hidden file input for native image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Decorative Warm Golden Wave Background Gradients */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/35 via-[#FFFBEB]/20 to-transparent pointer-events-none" />

      {/* Main Container (Mobile-first 393px width) */}
      <main className="w-full max-w-[393px] mx-auto px-4 pt-2 space-y-4 relative z-10">
        
        {/* Top Header: Back arrow + FFCS + Bell Icon */}
        <header className="flex items-center justify-between pt-1 pb-1">
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs')}
            className="w-9 h-9 rounded-full bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 7L4 16L20 25L36 16L20 7Z" fill="#17233C" />
                <path d="M10 20.5V26.5C10 29.5 14.5 32 20 32C25.5 32 30 29.5 30 26.5V20.5L20 26L10 20.5Z" fill="#17233C" />
                <path d="M32 18V27.5C32 28.5 30.5 29.5 30.5 29.5" stroke="#FACC15" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="30.5" cy="30" r="2.2" fill="#FACC15" />
              </svg>
            </div>
            <span className="font-black text-lg text-[#17233C] tracking-tight">FFCS</span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/slotmate/notifications')}
            className="w-9 h-9 rounded-full bg-white border border-[#FEEBA4] text-[#17233C] flex items-center justify-center hover:bg-[#FFFBEB] active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Bell className="w-4 h-4 stroke-[2.2]" />
          </button>
        </header>

        {/* Top Hero Illustration: ffcs_background.png */}
        <div className="w-full flex justify-center items-center select-none pointer-events-none -mt-1">
          <div className="w-full max-w-[340px] flex justify-center items-center">
            <img
              src={heroImgSrc}
              alt="Course Registration"
              className="w-full h-auto max-h-[160px] object-contain drop-shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: ADD COURSE                                                        */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[26px] p-4 shadow-[0_8px_24px_rgba(23,35,60,0.05)] border border-[#F1F5F9] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
              <h2 className="font-black text-[17px] text-[#17233C] tracking-tight">
                Add Your Courses
              </h2>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]">
              Step 1
            </span>
          </div>

          {/* Select Course Dropdown */}
          <div className="relative">
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-[#FFFDF7] rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between shadow-2xs cursor-pointer hover:border-[#FACC15] transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Search className="w-4 h-4 text-[#64748B] shrink-0 stroke-[2.4]" />
                <span className={`text-xs sm:text-sm font-bold truncate ${selectedCourse ? 'text-[#17233C]' : 'text-[#64748B]'}`}>
                  {selectedCourse ? `${selectedCourse.code} — ${selectedCourse.title}` : 'Select Course'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#FEEBA4] shadow-lg z-30 max-h-52 overflow-y-auto divide-y divide-slate-100 p-1">
                {courses.map((c) => (
                  <div
                    key={c.code}
                    onClick={() => {
                      setSelectedCourse(c);
                      setDropdownOpen(false);
                      setCourseConfirmed(true);
                    }}
                    className="p-2.5 hover:bg-[#FEFCE8] rounded-xl cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-xs text-[#17233C]">{c.code}</p>
                      <p className="text-[11px] text-[#64748B] truncate">{c.title}</p>
                    </div>
                    {selectedCourse?.code === c.code && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 2: ADD TEACHER SCREENSHOTS (MAXIMUM 3 SCREENSHOTS)                   */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[26px] p-4 shadow-[0_8px_24px_rgba(23,35,60,0.05)] border border-[#F1F5F9] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
              <h3 className="font-black text-[17px] text-[#17233C] tracking-tight">
                Add Teacher Screenshots
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]">
              Step 2
            </span>
          </div>

          <p className="text-[11px] font-medium text-[#64748B] -mt-1">
            Upload screenshot of courses or faculty timetable slots (Max 3).
          </p>

          {/* Upload Area */}
          <div
            onClick={() => {
              if (screenshots.length < 3) {
                fileInputRef.current?.click();
              }
            }}
            className={`w-full rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all ${
              screenshots.length >= 3
                ? 'bg-amber-50/50 border-[#FACC15] cursor-default'
                : 'bg-[#FFFDF7] hover:bg-[#FEFCE8] border-[#FACC15]/70 hover:border-[#FACC15] cursor-pointer'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-[#FEF3C7] text-[#17233C] flex items-center justify-center mb-1 shadow-2xs">
              <UploadCloud className="w-5 h-5 stroke-[2.4]" />
            </div>

            <h4 className="font-black text-sm text-[#17233C]">
              Upload Screenshot
            </h4>
            <span className="text-[11px] font-bold text-[#854D0E] mt-0.5">
              Maximum 3 Screenshots ({screenshots.length}/3)
            </span>

            {/* Selected Screenshots Preview Grid */}
            {screenshots.length > 0 && (
              <div className="w-full grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200/60">
                {screenshots.map((s, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-amber-300 bg-white shadow-2xs group">
                    <img
                      src={s.url}
                      alt={s.name}
                      className="w-full h-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScreenshot(idx);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 bg-[#17233C] text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors cursor-pointer shadow-xs"
                      title="Remove screenshot"
                    >
                      <X className="w-3 h-3 stroke-[2.8]" />
                    </button>
                    <p className="text-[9px] font-bold text-[#17233C] bg-white/90 truncate px-1 py-0.5 text-center">
                      {s.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STEP 3: SAVE COURSE ACTION BUTTON                                         */}
        {/* ========================================================================= */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSaveCourse}
            className="w-full py-3.5 px-4 rounded-full bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/30 border border-[#EAB308] transition-all cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.8]" />
            <span>Save Course</span>
          </button>
        </div>

        {/* Informational Callout */}
        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-3.5 flex items-center gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-[#D97706] shrink-0" />
          <p className="text-xs font-semibold text-[#17233C] leading-tight">
            Upload clear screenshots of all required documents
          </p>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* CELEBRATION MODAL: ffcs_celebration.png                                   */}
      {/* ========================================================================= */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 border-2 border-[#FACC15] max-w-xs w-full text-center shadow-xl space-y-3">
            <div className="w-full h-32 flex items-center justify-center">
              <img
                src={celebrationImgSrc}
                alt="Course Added Celebration"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="font-black text-base text-[#17233C]">
              Course Added Successfully! 🎉
            </h3>
            <p className="text-xs text-[#64748B]">
              Added to your courses list with screenshots saved.
            </p>
          </div>
        </div>
      )}

      {/* Fixed 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
