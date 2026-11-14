import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  UploadCloud,
  PlusCircle,
  Info,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import celebrationHeroSrc from '../../../assets/images/ffcs_celebration.png';

export function AddCourseScreen() {
  const navigate = useNavigate();
  const { courses, addCourse } = useFFCS();

  // State: Selected Course
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

  // State: Teacher Screenshots (Max 3 screenshots per course)
  const [screenshots, setScreenshots] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [maxLimitReached, setMaxLimitReached] = useState(false);
  const fileInputRef = useRef(null);

  // Filter courses based on search
  const filteredCourses = courses.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

  // Handle image files selection (Support multiple, enforce max 3)
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErrorMessage('');

    const currentCount = screenshots.length;
    const remainingSlots = 3 - currentCount;

    if (remainingSlots <= 0) {
      setMaxLimitReached(true);
      setErrorMessage('Maximum 3 screenshots allowed for this course.');
      return;
    }

    if (files.length > remainingSlots) {
      setErrorMessage(`Only ${remainingSlots} more screenshot(s) allowed (Max 3 total).`);
    }

    const filesToAdd = files.slice(0, remainingSlots).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      file,
      url: URL.createObjectURL(file)
    }));

    const updated = [...screenshots, ...filesToAdd];
    setScreenshots(updated);
    if (updated.length >= 3) {
      setMaxLimitReached(true);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual screenshot
  const handleRemoveScreenshot = (idToRemove) => {
    setScreenshots((prev) => {
      const updated = prev.filter((s) => s.id !== idToRemove);
      if (updated.length < 3) setMaxLimitReached(false);
      return updated;
    });
    setErrorMessage('');
  };

  // Trigger file picker
  const triggerUploadClick = () => {
    if (screenshots.length >= 3) {
      setErrorMessage('Maximum 3 screenshots reached. Remove one to replace.');
      return;
    }
    fileInputRef.current?.click();
  };

  // Save / Add Course
  const handleAddCourseSubmit = () => {
    if (!selectedCourse) {
      setErrorMessage('Please select a course before adding.');
      return;
    }

    // Save course with its associated screenshots
    addCourse({
      courseCode: selectedCourse.code,
      courseName: selectedCourse.title,
      screenshots: screenshots
    });

    // Return to the Home page where the newly added course card will appear
    navigate('/slotmate/ffcs');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-32 relative overflow-x-hidden selection:bg-[#FDE047]">
      {/* Hidden file input supporting multiple image selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Decorative Golden Ambient Gradients at Top */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/40 via-[#FFFBEB]/20 to-transparent pointer-events-none" />

      {/* Main Container: Mobile-first 393px width */}
      <main className="w-full max-w-[393px] mx-auto px-4 pt-2 space-y-4 relative z-10">
        
        {/* Top Minimal Navigation Bar */}
        <div className="flex items-center justify-between pt-1 pb-0.5">
          <button
            type="button"
            onClick={() => navigate('/slotmate/ffcs')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#854D0E] hover:text-[#17233C] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to Home</span>
          </button>

          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]">
            Add Course
          </span>
        </div>

        {/* ========================================================================= */}
        {/* 1. HERO IMAGE: ffcs_celebration.png AT TOP (FULL WIDTH, ROUNDED BOTTOM)   */}
        {/* ========================================================================= */}
        <div className="w-full rounded-b-[28px] overflow-hidden shadow-xs bg-gradient-to-b from-[#FEF9C3]/50 to-[#FFFDF7] -mt-1">
          <img
            src={celebrationHeroSrc}
            alt="Add Your Courses Celebration"
            className="w-full h-auto max-h-[175px] object-cover object-center select-none pointer-events-none"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 2. PAGE HEADING: "Add Your Courses" WITH YELLOW VERTICAL INDICATOR        */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2.5 px-1 pt-0.5">
          <span className="w-1.5 h-6 bg-[#FACC15] rounded-full" />
          <h1 className="font-black text-xl text-[#17233C] tracking-tight">
            Add Your Courses
          </h1>
        </div>

        {/* ========================================================================= */}
        {/* 3. SELECT COURSE DROPDOWN                                                 */}
        {/* ========================================================================= */}
        <div className="relative">
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 flex items-center justify-between shadow-2xs cursor-pointer hover:border-[#FACC15] transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Search className="w-4 h-4 text-[#64748B] shrink-0 stroke-[2.4]" />
              <span className={`text-sm font-bold truncate ${selectedCourse ? 'text-[#17233C]' : 'text-[#64748B]'}`}>
                {selectedCourse ? `${selectedCourse.code} — ${selectedCourse.title}` : 'Select Course'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Dropdown Options */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#FEEBA4] shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 p-1.5">
              <div className="p-1 pb-2">
                <input
                  type="text"
                  placeholder="Search course code or name..."
                  value={courseSearchQuery}
                  onChange={(e) => setCourseSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#FACC15]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {filteredCourses.map((c) => (
                <div
                  key={c.code}
                  onClick={() => {
                    setSelectedCourse(c);
                    setDropdownOpen(false);
                    setErrorMessage('');
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

        {/* ========================================================================= */}
        {/* 4. SCREENSHOT UPLOAD SECTION: ONE LARGE ROUNDED DASHED UPLOAD AREA        */}
        {/* ========================================================================= */}
        <div
          onClick={triggerUploadClick}
          className={`w-full rounded-[26px] border-2 border-dashed transition-all p-5 flex flex-col items-center justify-center text-center ${
            maxLimitReached
              ? 'bg-amber-50/40 border-[#FACC15] cursor-default'
              : 'bg-white hover:bg-[#FFFDF7] border-slate-300 hover:border-[#FACC15] cursor-pointer shadow-xs'
          }`}
        >
          {/* Cloud Upload Icon */}
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#17233C] flex items-center justify-center mb-1 shadow-2xs">
            <UploadCloud className="w-6 h-6 stroke-[2.2]" />
          </div>

          {/* Primary Text */}
          <h3 className="font-black text-sm text-[#17233C] mt-1">
            Upload Screenshot
          </h3>

          {/* Max 3 Subtitle */}
          <p className="text-xs font-bold text-[#854D0E] mt-0.5">
            (Max 3)
          </p>

          {/* Selected Screenshots Previews Inside the Upload Area */}
          {screenshots.length > 0 && (
            <div className="w-full mt-3.5 pt-3 border-t border-slate-200/70">
              <div className="grid grid-cols-3 gap-2">
                {screenshots.map((s) => (
                  <div
                    key={s.id}
                    className="relative rounded-xl overflow-hidden border border-[#FACC15] bg-white shadow-2xs group"
                  >
                    <img
                      src={s.url}
                      alt={s.name}
                      className="w-full h-16 object-cover"
                    />
                    {/* Individual remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveScreenshot(s.id);
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

              {/* Status Badge */}
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#854D0E]">
                <span>{screenshots.length} of 3 screenshots selected</span>
                {screenshots.length < 3 && (
                  <span className="text-[#D97706]">• Tap to add more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Validation / Error Message */}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. ADD COURSE BUTTON: LARGE YELLOW ROUNDED BUTTON                         */}
        {/* ========================================================================= */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleAddCourseSubmit}
            className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#FDE047] to-[#FACC15] hover:from-[#FACC15] hover:to-[#EAB308] text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-amber-400/30 border border-[#FACC15] transition-all cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.8]" />
            <span>Add Course</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 6. INFORMATION MESSAGE CONTAINER                                          */}
        {/* ========================================================================= */}
        <div className="bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7] p-3.5 flex items-center gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-[#D97706] shrink-0" />
          <p className="text-xs font-semibold text-[#17233C] leading-tight">
            Upload clear screenshots of all required documents
          </p>
        </div>

      </main>

      {/* Fixed 3-tab Bottom Navigation */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
