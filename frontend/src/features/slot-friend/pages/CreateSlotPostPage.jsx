import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Search, X, Calendar, ChevronDown, 
  User, FileText, ArrowRight, GraduationCap, Users, 
  Plus, CheckCircle2, AlertCircle, Loader2, BookOpen,
  Sparkles
} from 'lucide-react';

import { useSlotFriend } from '../context/SlotFriendContext';
import { searchCourses } from '../../../lib/api';
import { filterCourses, syncCourseCatalogueInBackground } from '../utils/courseCatalogueManager';
import { SlotSelectionModal } from '../components/SlotSelectionModal';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { useUser } from '../../../context/FirebaseAuthContext';
import { useAuthProfile } from '../../../context/AuthProfileContext';
import { 
  saveSlotMateDraft, 
  getSlotMateDraft, 
  clearSlotMateDraft, 
  generateIdempotencyKey 
} from '../../../utils/guestDraft';
import { GuestAuthPromptModal } from '../../../components/auth/GuestAuthPromptModal';

export default function CreateSlotPostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');

  const { 
    myPosts = [], 
    createPost, 
    updatePost,
    showToast 
  } = useSlotFriend();

  const existingPost = editPostId ? myPosts.find((p) => p.id === editPostId || p._id === editPostId) : null;

  // Form is always open and visible by default so users don't face an empty blank page
  const [isFormOpen, setIsFormOpen] = useState(true);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdPostData, setCreatedPostData] = useState(null);

  // Form State
  const [courseQuery, setCourseQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSuggestions, setCourseSuggestions] = useState(() => filterCourses('', 20));
  const [isSearchingCourses, setIsSearchingCourses] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState('');
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);

  const [teacherName, setTeacherName] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const courseDropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const formSectionRef = useRef(null);
  const courseInputRef = useRef(null);

  const { isSignedIn } = useUser();
  const { hasWhatsApp } = useAuthProfile();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const idempotencyKeyRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Pre-populate if editing existing post
  useEffect(() => {
    if (existingPost) {
      setIsFormOpen(true);
      setCourseQuery(`[${existingPost.courseCode}] ${existingPost.courseName}`);
      setSelectedCourse({
        id: existingPost.courseId,
        courseCode: existingPost.courseCode,
        courseName: existingPost.courseName
      });
      setSelectedSlot(existingPost.slot || '');
      setTeacherName(existingPost.teacher || existingPost.teacherName || '');
      setNotes(existingPost.notes || existingPost.additionalNotes || '');
    } else {
      // Restore guest draft on mount if present
      const draft = getSlotMateDraft();
      if (draft && draft.data) {
        const d = draft.data;
        if (d.courseCode || d.courseName) {
          setSelectedCourse({
            id: d.courseId,
            courseCode: d.courseCode,
            courseName: d.courseName
          });
          setCourseQuery(d.courseQuery || (d.courseCode ? `[${d.courseCode}] ${d.courseName || ''}` : ''));
        }
        if (d.slot) setSelectedSlot(d.slot);
        if (d.teacherName) setTeacherName(d.teacherName);
        if (d.notes) setNotes(d.notes);
        setIsDraftRestored(true);
      }
    }
  }, [existingPost]);

  // Close course dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target)) {
        setIsCourseDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Silently sync latest courses from backend in background once on mount
  useEffect(() => {
    syncCourseCatalogueInBackground().then((latest) => {
      if (Array.isArray(latest) && latest.length > 0 && !selectedCourse) {
        setCourseSuggestions(filterCourses(courseQuery, 25));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant in-memory course search (0ms latency, always loaded, offline ready)
  useEffect(() => {
    // Don't re-filter if the query exactly matches the already selected course string
    if (selectedCourse && courseQuery === `[${selectedCourse.courseCode}] ${selectedCourse.courseName}`) {
      return;
    }

    const matches = filterCourses(courseQuery, 25);
    setCourseSuggestions(matches);
  }, [courseQuery, selectedCourse]);

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setCourseQuery(`[${course.courseCode}] ${course.courseName}`);
    setIsCourseDropdownOpen(false);
    if (errors.course) setErrors((prev) => ({ ...prev, course: null }));
    setSubmitError('');
  };

  const handleClearCourse = () => {
    setSelectedCourse(null);
    setCourseQuery('');
    setCourseSuggestions(filterCourses('', 25));
    setIsCourseDropdownOpen(true);
    if (courseInputRef.current) {
      courseInputRef.current.focus();
    }
  };

  const handleSlotSelect = (slotCode) => {
    setSelectedSlot(slotCode);
    if (errors.slot) setErrors((prev) => ({ ...prev, slot: null }));
    setSubmitError('');
  };

  // Open / Focus Form Handler when tapping "+ Create Slot Post"
  const handleOpenForm = () => {
    setIsFormOpen(true);
    setTimeout(() => {
      if (formSectionRef.current) {
        formSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (courseInputRef.current && !selectedCourse) {
        courseInputRef.current.focus();
      }
    }, 100);
  };

  const validate = () => {
    const errs = {};
    if (!selectedCourse && !courseQuery.trim()) {
      errs.course = 'Please search and select a course from the official catalogue.';
    } else if (!selectedCourse && courseSuggestions.length > 0) {
      // Auto-match if exact code typed
      const clean = courseQuery.toUpperCase().trim();
      const exact = courseSuggestions.find(c => c.courseCode === clean);
      if (exact) {
        setSelectedCourse(exact);
      } else {
        errs.course = 'Please select a valid course from the dropdown suggestions.';
      }
    } else if (!selectedCourse) {
      errs.course = 'Please select a course from the official catalogue.';
    }

    if (!selectedSlot.trim()) {
      errs.slot = 'Please select your registered timetable slot.';
    }
    if (!teacherName.trim()) {
      errs.teacher = 'Please enter faculty / teacher name.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    if (isSubmitting || isSubmittingRef.current) return;

    // 1. If guest attempting to publish, save draft and prompt Google authentication
    if (!isSignedIn) {
      saveSlotMateDraft({
        courseId: selectedCourse?.id || selectedCourse?._id,
        courseCode: selectedCourse?.courseCode || courseQuery.split(']')[0].replace('[', '').trim(),
        courseName: selectedCourse?.courseName || '',
        courseQuery,
        slot: selectedSlot.trim(),
        teacherName: teacherName.trim(),
        notes: notes.trim()
      }, '/slotmate/create');
      setShowAuthModal(true);
      return;
    }

    // 2. If authenticated but missing WhatsApp setup, preserve draft & route to onboarding
    if (!hasWhatsApp) {
      saveSlotMateDraft({
        courseId: selectedCourse?.id || selectedCourse?._id,
        courseCode: selectedCourse?.courseCode || courseQuery.split(']')[0].replace('[', '').trim(),
        courseName: selectedCourse?.courseName || '',
        courseQuery,
        slot: selectedSlot.trim(),
        teacherName: teacherName.trim(),
        notes: notes.trim()
      }, '/slotmate/create');
      navigate(`/whatsapp-setup?returnTo=${encodeURIComponent('/slotmate/create')}`);
      return;
    }

    // 3. User is authenticated and verified: DIRECT BACKEND PUBLICATION
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
        courseId: selectedCourse?.id || selectedCourse?._id,
        courseCode: selectedCourse?.courseCode || courseQuery.split(']')[0].replace('[', '').trim(),
        slot: selectedSlot.trim(),
        teacherName: teacherName.trim(),
        additionalNotes: notes.trim()
      };

      // Generate or reuse UUID idempotency key for this submission attempt
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = generateIdempotencyKey();
      }

      const options = {
        headers: {
          'Idempotency-Key': idempotencyKeyRef.current
        }
      };

      // Controlled retry with backoff for transient 503 or network glitches
      let res;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (existingPost) {
            res = await updatePost(existingPost.id || existingPost._id, payload);
          } else {
            res = await createPost(payload, options);
          }
          break;
        } catch (callErr) {
          if (callErr.response?.status === 503 && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 750));
            continue;
          }
          throw callErr;
        }
      }

      const savedPost = res?.post || {
        _id: payload.courseId,
        id: payload.courseId,
        courseCode: payload.courseCode,
        courseName: selectedCourse?.courseName || '',
        slot: payload.slot,
        teacherName: payload.teacherName
      };

      idempotencyKeyRef.current = null;
      clearSlotMateDraft();
      setIsDraftRestored(false);
      setCreatedPostData(savedPost);
      setShowSuccessModal(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setSubmitError('A submission is currently being processed. Please wait a moment.');
      } else if (err.response?.status === 503) {
        setSubmitError('Verification service is momentarily busy. Please try again in a few seconds.');
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to save slot post';
        setSubmitError(msg);
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Navigate to Matches page showing the created/updated post and its matching students
  const handleViewMyMatches = () => {
    setShowSuccessModal(false);
    const pid = createdPostData?._id || createdPostData?.id;
    const cCode = createdPostData?.courseCode || '';
    const sCode = createdPostData?.slot || '';
    navigate(
      `/slotmate/matches?postId=${pid}&course=${encodeURIComponent(cCode)}&slot=${encodeURIComponent(sCode)}`
    );
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col pb-28">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: BACK ARROW + POST TITLE                                    */}
      {/* ========================================================================= */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/slotmate')}
            className="p-1 -ml-1 text-[#17233C] hover:bg-white rounded-xl transition-colors cursor-pointer"
            aria-label="Back to SlotMate Home"
          >
            <ArrowLeft className="w-5 h-5 text-[#17233C] stroke-[2.4]" />
          </button>
          <h1 className="font-black text-[#17233C] text-lg sm:text-xl tracking-tight">
            Post
          </h1>
        </div>

        {/* Action Link to Matches */}
        <button
          type="button"
          onClick={() => navigate('/slotmate/matches')}
          className="text-xs font-black text-[#D97706] hover:text-[#B45309] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Matches ({myPosts.length})</span>
        </button>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT                                                              */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl mx-auto px-3.5 sm:px-4 pt-3.5 space-y-4 flex-1">
        
        {/* ======================================================================= */}
        {/* HERO BANNER CARD (EXACT MATCH TO REFERENCE IMAGE 1 & 2)                */}
        {/* ======================================================================= */}
        <div className="relative rounded-[26px] sm:rounded-[30px] bg-gradient-to-br from-[#FFFDF7] via-[#FFF8EC] to-[#FEF3D6] border border-[#FCE7C8] p-3.5 min-[390px]:p-4 sm:p-5 shadow-[0_6px_24px_rgba(250,204,21,0.08)] overflow-hidden">
          
          {/* Background Decorative Origami Airplane & Dotted Flight Trail */}
          <div className="absolute right-0 top-0 bottom-0 w-44 pointer-events-none select-none overflow-hidden">
            <svg
              className="w-full h-full opacity-85"
              viewBox="0 0 160 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Dotted Golden Flight Path */}
              <path
                d="M 10 110 C 50 115, 75 75, 80 50 C 85 25, 115 35, 128 42"
                stroke="#F59E0B"
                strokeWidth="1.8"
                strokeDasharray="3 3.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Paper Airplane */}
              <g transform="translate(122, 30) rotate(-10)">
                <path
                  d="M0 0 L24 8 L10 14 L0 0 Z"
                  fill="#FACC15"
                />
                <path
                  d="M24 8 L10 14 L12 24 L15 16 Z"
                  fill="#EAB308"
                />
                <path
                  d="M10 14 L24 8 L12 20 Z"
                  fill="#FDE047"
                />
              </g>
            </svg>
          </div>

          {/* Bottom Soft Yellow Wave Accent */}
          <div className="absolute -bottom-8 -right-8 w-40 h-28 bg-[#FDE68A]/30 rounded-full blur-2xl pointer-events-none" />

          {/* Card Layout: Left Illustration + Right Content */}
          <div className="relative z-10 flex items-center gap-3 min-[390px]:gap-3.5 sm:gap-5">
            
            {/* Left: 3D Transparent Calendar & Cap Illustration */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-20 h-20 min-[375px]:w-22 min-[375px]:h-22 min-[410px]:w-24 min-[410px]:h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                <img
                  src="/slot-calendar-cap.png"
                  alt="Slot Calendar"
                  className="w-full h-full object-contain select-none pointer-events-none drop-shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = '/slot-calendar-3d.png';
                  }}
                />
              </div>
            </div>

            {/* Right: Content & CTA */}
            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
              
              {/* Title with Highlighted 'Slot Details' Badge */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black text-base min-[390px]:text-lg sm:text-xl text-[#17233C] tracking-tight leading-tight flex items-center gap-1.5 flex-wrap">
                  <span>{existingPost ? 'Edit Your' : 'Post Your'}</span>
                  <span className="relative inline-flex items-center px-2 py-0.5 rounded-lg sm:rounded-xl bg-[#FEF08A] text-[#17233C] font-black border border-[#FDE047]/60 shadow-2xs">
                    Slot Details
                  </span>
                </h2>
              </div>

              {/* Subtitle */}
              <p className="text-[11px] min-[390px]:text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed pr-2">
                Select course and slot from official curriculum to discover classmates automatically.
              </p>

              {/* Call-to-Action Pill Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleOpenForm}
                  className="inline-flex items-center gap-2 px-4 min-[390px]:px-5 py-2 min-[390px]:py-2.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#17233C] shadow-sm transition-all cursor-pointer font-black text-xs min-[390px]:text-sm group border border-[#EAB308]/50"
                >
                  <span className="w-4.5 h-4.5 rounded-full bg-[#17233C] text-[#FACC15] flex items-center justify-center font-black text-xs leading-none shrink-0 group-hover:rotate-90 transition-transform">
                    +
                  </span>
                  <span>{existingPost ? 'Update Post Form' : 'Create Slot Post'}</span>
                  <ArrowRight className="w-4 h-4 text-[#17233C] stroke-[2.4] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {submitError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 shadow-2xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="flex-1 leading-snug">{submitError}</span>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ACTUAL POST CREATION FORM (EXPANDS ON CTA TAP OR EDIT)                  */}
        {/* ======================================================================= */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              ref={formSectionRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[26px] p-4 min-[390px]:p-5 border border-[#F4E3D8] shadow-xs space-y-4"
            >
              
              {/* Restored Draft Review Banner */}
              {isDraftRestored && !existingPost && (
                <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-[#92400E]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
                    <span><strong>Draft restored:</strong> Please review your course and slot details before clicking 'Post Now'.</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      clearSlotMateDraft();
                      setIsDraftRestored(false);
                      setSelectedCourse(null);
                      setCourseQuery('');
                      setSelectedSlot('');
                      setTeacherName('');
                      setNotes('');
                    }} 
                    className="text-[#B45309] font-bold underline hover:no-underline text-[11px] shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Form Card Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-[#17233C] leading-tight">
                      {existingPost ? 'Edit Registered Course & Slot' : 'Enter Your Course & Slot'}
                    </h3>
                    <p className="text-[11px] text-[#6E7587] font-medium leading-tight mt-0.5">
                      Matched exclusively with peers taking identical slot
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* =================================================================== */}
                {/* 1. COURSE SEARCH (COURSE CODE OR COURSE NAME)                       */}
                {/* =================================================================== */}
                <div className="space-y-1.5 relative" ref={courseDropdownRef}>
                  <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                    Course <span className="text-red-500">*</span>
                  </label>

                  {/* Course Search Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                      {isSearchingCourses ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#D97706]" />
                      ) : (
                        <Search className="w-4 h-4 stroke-[2.4]" />
                      )}
                    </div>

                    <input
                      ref={courseInputRef}
                      type="text"
                      value={courseQuery}
                      onFocus={() => {
                        setIsCourseDropdownOpen(true);
                        setCourseSuggestions(filterCourses(courseQuery, 25));
                      }}
                      onClick={() => {
                        setIsCourseDropdownOpen(true);
                        setCourseSuggestions(filterCourses(courseQuery, 25));
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCourseQuery(val);
                        setSelectedCourse(null);
                        setIsCourseDropdownOpen(true);
                        setCourseSuggestions(filterCourses(val, 25));
                        if (errors.course) setErrors((prev) => ({ ...prev, course: null }));
                      }}
                      placeholder="Search course code or name (e.g. CSE2001, Data Structures)..."
                      className={`w-full pl-10 pr-10 py-3 rounded-2xl bg-[#FFFDF9] border text-xs sm:text-sm font-bold text-[#17233C] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FACC15]/40 transition-all shadow-2xs ${
                        errors.course ? 'border-red-500' : 'border-[#F4E3D8] focus:border-[#FACC15]'
                      }`}
                    />

                    {courseQuery && (
                      <button
                        type="button"
                        onClick={handleClearCourse}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9CA3AF] hover:text-[#17233C] cursor-pointer"
                        aria-label="Clear course search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown List */}
                  <AnimatePresence>
                    {isCourseDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-40 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-2xl border border-[#F4E3D8] shadow-xl divide-y divide-[#F4E3D8]/60"
                      >
                        {courseSuggestions.length > 0 ? (
                          courseSuggestions.map((course) => (
                            <div
                              key={course.id || course._id || course.courseCode}
                              onClick={() => handleSelectCourse(course)}
                              className="p-3 hover:bg-[#FEF9C3]/50 cursor-pointer transition-colors flex items-center justify-between gap-2 group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-xs sm:text-sm text-[#D97706] group-hover:text-[#B45309]">
                                    {course.courseCode}
                                  </span>
                                  {course.credits && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#E0F2FE] text-[#0369A1]">
                                      {course.credits} Credits
                                    </span>
                                  )}
                                  {course.category && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#FEF3C7] text-[#92400E]">
                                      {course.category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#17233C] font-bold truncate mt-0.5">
                                  {course.courseName}
                                </p>
                              </div>
                              <Plus className="w-4 h-4 text-[#D97706] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-[#6E7587]">
                            No courses found matching "{courseQuery}".
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected Course Confirmation Card (Displayed after selection) */}
                  {selectedCourse && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-between gap-3 shadow-2xs mt-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-[#FEF08A] text-[#854D0E] flex items-center justify-center shrink-0 border border-[#FDE047]">
                          <BookOpen className="w-4.5 h-4.5 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs sm:text-sm text-[#D97706]">
                              {selectedCourse.courseCode}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[10px] font-black">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Selected
                            </span>
                          </div>
                          <p className="text-xs text-[#17233C] font-bold truncate mt-0.5">
                            {selectedCourse.courseName}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearCourse}
                        className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626] rounded-xl hover:bg-white transition-colors cursor-pointer shrink-0"
                        title="Change course"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}

                  {errors.course && (
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.course}</span>
                    </p>
                  )}
                </div>

                {/* =================================================================== */}
                {/* 2. SLOT SELECTION (OPENS TIMETABLE MATRIX MODAL)                    */}
                {/* =================================================================== */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                      Slot Selection <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-[#6E7587] font-medium">
                      Multi-slot supported
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSlotModalOpen(true)}
                    className={`w-full px-4 py-3 rounded-2xl bg-[#FFFDF9] border text-left flex items-center justify-between gap-3 shadow-2xs hover:border-[#FACC15] transition-all cursor-pointer group active:scale-[0.99] ${
                      errors.slot ? 'border-red-500' : 'border-[#F4E3D8]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]">
                        <Calendar className="w-4.5 h-4.5 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {selectedSlot ? (
                          <div>
                            <span className="text-[10px] text-[#6E7587] font-bold block uppercase tracking-wider">
                              Selected Slot(s)
                            </span>
                            <span className="font-black text-xs sm:text-sm text-[#17233C] truncate block">
                              {selectedSlot}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-[#9CA3AF] block">
                              Tap to select from timetable...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {selectedSlot ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#FEF9C3] text-[#D97706] text-xs font-black border border-[#FEF08A]">
                          Change
                        </span>
                      ) : (
                        <ChevronDown className="w-4.5 h-4.5 text-[#9CA3AF] group-hover:text-[#17233C] transition-colors" />
                      )}
                    </div>
                  </button>

                  {errors.slot && (
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.slot}</span>
                    </p>
                  )}
                </div>

                {/* =================================================================== */}
                {/* 3. FACULTY / TEACHER NAME                                          */}
                {/* =================================================================== */}
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                    Faculty / Teacher Name <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                      <User className="w-4 h-4 stroke-[2.4]" />
                    </div>

                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => {
                        setTeacherName(e.target.value);
                        if (errors.teacher) setErrors((prev) => ({ ...prev, teacher: null }));
                      }}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      className={`w-full pl-10 pr-4 py-3 rounded-2xl bg-[#FFFDF9] border text-xs sm:text-sm font-bold text-[#17233C] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FACC15]/40 transition-all shadow-2xs ${
                        errors.teacher ? 'border-red-500' : 'border-[#F4E3D8] focus:border-[#FACC15]'
                      }`}
                    />
                  </div>

                  {errors.teacher && (
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.teacher}</span>
                    </p>
                  )}
                </div>

                {/* =================================================================== */}
                {/* 4. ADDITIONAL STUDY NOTES (OPTIONAL)                                */}
                {/* =================================================================== */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                      Additional Notes <span className="text-[#9CA3AF] font-normal text-xs">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {notes.length}/200
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    maxLength={200}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Looking for a study peer to solve weekly assignments and prepare for exams..."
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FACC15]/40 focus:border-[#FACC15] transition-all shadow-2xs resize-none"
                  />
                </div>

                {/* =================================================================== */}
                {/* 5. POST SUBMISSION BUTTON                                           */}
                {/* =================================================================== */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-full bg-[#FACC15] hover:bg-[#EAB308] active:scale-[0.98] text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border border-[#EAB308]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Publishing Slot Post...</span>
                      </>
                    ) : (
                      <>
                        <span>{existingPost ? 'Update Slot Post' : isDraftRestored ? 'Publish Slot Post' : 'Save Details & View in SlotMate'}</span>
                        <ArrowRight className="w-5 h-5 stroke-[2.4]" />
                      </>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* ========================================================================= */}
      {/* TIMETABLE MATRIX MODAL POPUP                                              */}
      {/* ========================================================================= */}
      <SlotSelectionModal
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        currentSlot={selectedSlot}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSlotSelect}
      />

      {/* ========================================================================= */}
      {/* SUCCESS POPUP MODAL                                                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-[32px] p-6 max-w-sm w-full border border-[#F4E3D8] shadow-2xl text-center space-y-4 relative overflow-hidden"
            >
              {/* Top Decorative Sparkle Background */}
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#FEF08A]/60 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-[#FDE68A]/40 rounded-full blur-2xl pointer-events-none" />

              {/* Icon / 3D Badge */}
              <div className="relative mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] border border-[#FDE047] flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-9 h-9 text-[#16A34A] stroke-[2.2]" />
                <span className="absolute -top-1 -right-1 text-base">✨</span>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5">
                <h3 className="font-black text-xl text-[#17233C] tracking-tight">
                  Post Created Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed">
                  Your slot post is live. Let's find your classmates!
                </p>
              </div>

              {/* Course & Slot Pill Preview */}
              {createdPostData && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#FFFDF7] border border-[#FCE7C8] text-xs font-black text-[#854D0E] shadow-2xs max-w-full truncate">
                  <span className="text-[#D97706] truncate">
                    {createdPostData.courseCode || 'Course'}
                  </span>
                  <span className="text-[#D1D5DB] font-light">•</span>
                  <span className="text-[#17233C] truncate">
                    Slot {createdPostData.slot || 'N/A'}
                  </span>
                </div>
              )}

              {/* Action Buttons: View My Matches + Go to Post */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleViewMyMatches}
                  className="w-full py-3.5 px-4 rounded-full bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#17233C] font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#EAB308]/60"
                >
                  <span>View My Matches</span>
                  <ArrowRight className="w-4 h-4 text-[#17233C] stroke-[2.4]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    handleClearCourse();
                    setSelectedSlot('');
                    setTeacherName('');
                    setNotes('');
                  }}
                  className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-[#FFFDF9] active:scale-95 text-[#6E7587] hover:text-[#17233C] font-bold text-xs sm:text-sm transition-all cursor-pointer border border-[#F4E3D8]"
                >
                  Go to Post
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guest Authentication Prompt Modal */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="SlotMate"
        returnPath="/slotmate/create"
        onAuthSuccess={() => {
          setShowAuthModal(false);
          setIsDraftRestored(true);
        }}
      />

      {/* Bottom Navigation */}
      <SlotMateBottomNav active="post" />
    </div>
  );
}
