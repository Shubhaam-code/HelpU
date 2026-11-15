import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Plus,
  ArrowLeft,
  Check,
  ChevronRight
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import { CourseSkeletonCard } from '../components/FFCSSkeleton';
import heroImgSrc from '../../../assets/images/ffcs_background.webp';
import notebookImgSrc from '../../../assets/images/notebook.webp';
import bgBubbleWaveSrc from '../../../assets/images/background.webp';
import sparkLeftSrc from '../../../assets/images/ffcs_spark_left.png';
import sparkRightSrc from '../../../assets/images/ffcs_spark_right.png';

export function FFCSHome() {
  const navigate = useNavigate();
  const { coursesList, loading, isBackgroundFetching } = useFFCS();

  const handleUploadClick = () => {
    if (coursesList.length >= 8) {
      window.alert('Maximum 8 courses allowed in FFCS. Please remove an existing course to add a new one.');
      return;
    }
    navigate('/slotmate/ffcs/add');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] flex justify-center">
      <div className="w-full max-w-[420px] min-h-[100dvh] bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between relative overflow-x-hidden selection:bg-[#FDE047] sm:shadow-xl sm:border-x sm:border-amber-100/70">
        {/* Decorative Golden Ambient Gradients at Top */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/40 via-[#FFFBEB]/20 to-transparent pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FDE047]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-24 -left-12 w-40 h-40 bg-[#FEF08A]/25 rounded-full blur-2xl pointer-events-none" />

        {/* Main Container: Mobile First */}
        <main className="w-full px-4 pt-2 space-y-3.5 relative z-10 flex-1">
        
        {/* Top Navigation Header */}
        <header className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/slotmate')}
              className="w-8 h-8 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/60 flex items-center justify-center text-[#17233C] transition-colors cursor-pointer shadow-xs active:scale-95"
              aria-label="Back to SlotMate"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <h1 className="font-black text-lg text-[#17233C] tracking-tight">
              SlotMate
            </h1>
          </div>
        </header>

        {/* HERO SECTION: 3D STUDENTS DESK ILLUSTRATION (ffcs_background.webp) */}
        <div className="w-full flex justify-center items-center select-none pointer-events-none -mt-1 -mb-1 px-1">
          <div className="w-full max-w-[370px] flex justify-center items-center">
            <img
              src={heroImgSrc}
              alt="FFCS Course Registration"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width="370"
              height="190"
              className="w-full h-auto max-h-[190px] sm:max-h-[205px] object-contain drop-shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* YOUR COURSES SECTION: Full-Width Edge-to-Edge Left & Right Cover          */}
        {/* ========================================================================= */}
        <section className="-mx-4 w-[calc(100%+2rem)] bg-white rounded-t-[32px] rounded-b-[32px] p-4 sm:p-5 shadow-[0_10px_28px_rgba(23,35,60,0.05)] border-y border-[#F1F5F9] space-y-3">
          
          {/* Section Header: Yellow Vertical Indicator + Heading */}
          <div className="flex items-center justify-between px-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
              <h2 className="font-black text-[19px] text-[#17233C] tracking-tight">
                Your Courses
              </h2>
            </div>
            {isBackgroundFetching && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 animate-pulse">
                Syncing...
              </span>
            )}
          </div>

          {/* DYNAMIC COURSE CARDS: Displays Actual Course Code, No "Upload Image" text */}
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-amber-200">
            {coursesList.length === 0 ? (
              <div className="text-center py-6 px-3 space-y-1">
                <p className="font-black text-sm text-[#17233C]">No courses added yet</p>
                <p className="text-[11px] text-[#64748B]">
                  Tap Add More Course below to search and add your courses.
                </p>
              </div>
            ) : (
              coursesList.map((course, idx) => {
              const isUploaded = course.status === 'completed' || course.status === 'needs_review';

              return (
                <div
                  key={course.id || idx}
                  className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-[0_4px_16px_rgba(23,35,60,0.03)] border border-[#F1F5F9] flex items-center justify-between gap-2.5 transition-all hover:shadow-[0_8px_20px_rgba(250,204,21,0.1)]"
                >
                  {/* Left: Compact Circular Number Badge + Course Details */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFD426] text-[#17233C] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {course.sequence || idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-sm text-[#17233C] leading-tight truncate">
                        {course.code || `CSE${2000 + (course.sequence || idx + 1)}`}
                      </h3>
                      <p className="text-[11px] text-[#64748B] font-medium truncate mt-0.5">
                        {course.name || ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Compact Done Badge or Upload Button */}
                  {isUploaded ? (
                    <div className="px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shrink-0 bg-[#10B981] text-white shadow-2xs">
                      <Check className="w-3 h-3 stroke-[3] text-white" />
                      <span>Done</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      className="px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0 bg-[#FFD426] hover:bg-[#FACC15] text-[#17233C] border border-[#FACC15]"
                    >
                      <UploadCloud className="w-3 h-3 stroke-[2.4]" />
                      <span>Upload</span>
                    </button>
                  )}
                </div>
              );
            }))}
          </div>

          {/* ========================================================================= */}
          {/* ADD MORE COURSE BUTTON -> Capsule with Provided Yellow Decorative PNGs   */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-center w-full pt-2 pb-1">
            {/* Left yellow decorative PNG asset */}
            <img
              src={sparkLeftSrc}
              alt=""
              aria-hidden="true"
              className="h-7 sm:h-8 w-auto object-contain mr-1.5 sm:mr-2 select-none pointer-events-none shrink-0"
            />

            {/* Glowing Yellow Pill Button */}
            <button
              type="button"
              onClick={handleUploadClick}
              className={`group pl-1.5 pr-4 py-1.5 sm:pl-2 sm:pr-5 sm:py-2 rounded-full bg-white hover:bg-[#FEFCE8] border-[2px] border-[#FACC15] hover:border-[#EAB308] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(250,204,21,0.25)] hover:shadow-[0_6px_22px_rgba(234,179,8,0.35)] cursor-pointer active:scale-95 transition-all ${
                coursesList.length >= 8 ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {/* Vibrant Golden Circle with Dark Navy Bold Plus */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#FFE066] via-[#FFD426] to-[#F59E0B] text-[#17233C] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(245,158,11,0.35)] group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3.2] text-[#17233C]" />
              </div>

              {/* Light Yellow Subtle Vertical Divider */}
              <div className="w-[1.5px] h-5 bg-[#FDE047] shrink-0" />

              {/* Bold Dark Blue / Navy Text */}
              <span className="font-black text-[13px] sm:text-sm text-[#17233C] tracking-tight whitespace-nowrap pl-0.5">
                {coursesList.length >= 8 ? 'Limit Reached (8/8)' : 'Add More Course'}
              </span>
            </button>

            {/* Right yellow decorative PNG asset */}
            <img
              src={sparkRightSrc}
              alt=""
              aria-hidden="true"
              className="h-7 sm:h-8 w-auto object-contain ml-1.5 sm:ml-2 select-none pointer-events-none shrink-0"
            />
          </div>
        </section>

      </main>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: ANDROID MOBILE PROPORTIONS                                */}
      {/* ========================================================================= */}
      <section className="relative w-full flex flex-col items-center justify-end pt-2 pb-16 sm:pb-18 overflow-hidden mt-auto min-h-[195px]">
        {/* Full-width transparent yellow-cream bubble/wave background.webp (Fitted to Android phone) */}
        <div className="absolute inset-x-0 bottom-0 w-full h-[185px] sm:h-[210px] pointer-events-none select-none overflow-hidden flex items-end justify-center">
          <img
            src={bgBubbleWaveSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-fill object-bottom"
          />
        </div>

        {/* Centered Calendar / Notebook Illustration & Explanatory Text */}
        <div className="relative z-10 w-full px-4 flex flex-col items-center justify-center text-center pb-1">
          {/* Calendar/Notebook Logo */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-1 drop-shadow-md mx-auto">
            <img
              src={notebookImgSrc}
              alt="Course Timetable"
              loading="lazy"
              decoding="async"
              width="96"
              height="96"
              className="w-full h-full object-contain select-none pointer-events-none"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Explanatory Text (Shifted up with proper breathing room) */}
          <p className="-mt-0.5 -translate-y-1 font-extrabold text-xs sm:text-[13px] text-[#17233C] leading-snug drop-shadow-2xs">
            Upload your courses to <br />
            generate your timetable
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FIXED 3-TAB BOTTOM NAVIGATION: HOME | TIME TABLE | SETTINGS               */}
      {/* ========================================================================= */}
      <FFCSBottomNav activeTab="home" />
      </div>
    </div>
  );
}
