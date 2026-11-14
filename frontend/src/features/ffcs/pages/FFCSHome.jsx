import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  PlusCircle,
  ArrowLeft
} from 'lucide-react';
import { useFFCS } from '../context/FFCSContext';
import { FFCSBottomNav } from '../components/FFCSBottomNav';
import heroImgSrc from '../../../assets/images/ffcs_background.png';
import notebookImgSrc from '../../../assets/images/notebook.png';
import bgBubbleWaveSrc from '../../../assets/images/background.png';

export function FFCSHome() {
  const navigate = useNavigate();
  const { coursesList, uploadCourseImage } = useFFCS();
  const [selectedCourseForUpload, setSelectedCourseForUpload] = useState(null);
  const fileInputRef = useRef(null);

  const handleUploadClick = (courseId) => {
    setSelectedCourseForUpload(courseId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && selectedCourseForUpload !== null) {
      uploadCourseImage(selectedCourseForUpload, file);
      setSelectedCourseForUpload(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#17233C] flex flex-col justify-between pb-32 relative overflow-x-hidden selection:bg-[#FDE047]">
      {/* Hidden file input for native image picking on cards */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Decorative Golden Ambient Gradients at Top */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/40 via-[#FFFBEB]/20 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FDE047]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-24 -left-12 w-40 h-40 bg-[#FEF08A]/25 rounded-full blur-2xl pointer-events-none" />

      {/* Main Container: Mobile First 393px */}
      <main className="w-full max-w-[393px] mx-auto px-4 pt-2 space-y-3 relative z-10">
        
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
            Manage Courses ({coursesList.length}) →
          </button>
        </div>

        {/* ========================================================================= */}
        {/* HERO SECTION: STUDENT ILLUSTRATION (ffcs_background.png)                  */}
        {/* ========================================================================= */}
        <div className="w-full flex justify-center items-center select-none pointer-events-none -mt-1 mb-1">
          <div className="w-full max-w-[360px] flex justify-center items-center">
            <img
              src={heroImgSrc}
              alt="FFCS Course Registration"
              className="w-full h-auto max-h-[175px] object-contain drop-shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* YOUR COURSES SECTION: Curved White Container with Large Rounded Corners   */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[32px] sm:rounded-[36px] p-4 sm:p-4.5 shadow-[0_10px_28px_rgba(23,35,60,0.05)] border border-[#F1F5F9] space-y-3">
          
          {/* Section Header: Yellow Vertical Indicator + Heading + 3 Yellow Dots */}
          <div className="flex items-center justify-between px-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#FACC15] rounded-full" />
              <h2 className="font-black text-[19px] text-[#17233C] tracking-tight">
                Your Courses
              </h2>
            </div>

            {/* 3 Decorative Yellow Dots */}
            <div className="flex items-center gap-1.5 pr-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15] shadow-xs" />
              <span className="w-2 h-2 rounded-full bg-[#FDE047]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#FEF08A]" />
            </div>
          </div>

          {/* UNLIMITED COURSE CARDS: Every course rendered in sequence */}
          <div className="space-y-2.5">
            {coursesList.map((course, idx) => {
              const isUploaded = course.uploaded || (course.screenshots && course.screenshots.length > 0);

              return (
                <div
                  key={course.id || idx}
                  className="bg-white rounded-[22px] sm:rounded-[24px] p-3 sm:p-3.5 shadow-[0_4px_16px_rgba(23,35,60,0.03)] border border-[#F1F5F9] flex items-center justify-between gap-3 transition-all hover:shadow-[0_8px_20px_rgba(250,204,21,0.1)]"
                >
                  {/* Left: Yellow Circular Number Badge (1, 2, 3...) */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full bg-[#FACC15] text-[#17233C] font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                      {course.sequence || idx + 1}
                    </div>

                    {/* Middle: Course Name & Uploaded details */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-[15px] text-[#17233C] leading-tight truncate">
                        {course.label || `Course ${idx + 1}`}
                      </h3>
                      <p className="text-xs font-semibold text-[#64748B] mt-0.5 truncate">
                        {isUploaded
                          ? course.fileName || `${course.code || 'Course'} Image`
                          : 'Upload Image'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Yellow Rounded Upload Button (STRICT: NO GREEN BUTTONS) */}
                  <button
                    type="button"
                    onClick={() => handleUploadClick(course.id)}
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
          {/* PROBLEM 4: ADD MORE COURSE (REPLACES OLD "SEE MORE COURSES")               */}
          {/* ========================================================================= */}
          <div className="relative flex items-center justify-center w-full pt-1.5 pb-0.5">
            {/* Left burst rays */}
            <div className="flex flex-col gap-1 text-[#FACC15] mr-2 shrink-0">
              <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[-35deg]" />
              <div className="w-3.5 h-0.5 bg-[#FACC15] rounded-full" />
              <div className="w-2.5 h-0.5 bg-[#FACC15] rounded-full rotate-[35deg]" />
            </div>

            {/* Yellow Dashed Pill Button -> Opens Dedicated Add Course Page */}
            <button
              type="button"
              onClick={() => navigate('/slotmate/ffcs/add')}
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
        </section>

        {/* ========================================================================= */}
        {/* PROBLEM 1: BOTTOM EMPTY STATE SECTION WITH TRANSPARENT BUBBLE BACKGROUND  */}
        {/* ========================================================================= */}
        <section className="relative w-full pt-4 pb-2 flex flex-col items-center justify-center text-center overflow-hidden">
          
          {/* User Provided Transparent Yellow-Cream Bubble/Wave background.png */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <img
              src={bgBubbleWaveSrc}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain opacity-90 scale-105"
            />
          </div>

          {/* Centered Document Illustration Using User's notebook.png */}
          <div className="relative z-10 w-20 h-20 flex items-center justify-center mb-1 drop-shadow-sm">
            <img
              src={notebookImgSrc}
              alt="Course Timetable Generator"
              className="w-full h-full object-contain select-none pointer-events-none"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Explanatory Text */}
          <p className="relative z-10 font-black text-[15px] sm:text-base text-[#17233C] leading-snug drop-shadow-2xs">
            Upload your courses to <br />
            generate your timetable
          </p>
        </section>

      </main>

      {/* ========================================================================= */}
      {/* FIXED 3-TAB BOTTOM NAVIGATION: HOME | TIME TABLE | SETTINGS               */}
      {/* ========================================================================= */}
      <FFCSBottomNav activeTab="home" />
    </div>
  );
}
