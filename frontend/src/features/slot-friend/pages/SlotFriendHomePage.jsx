import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Users, BookOpen, CalendarDays, 
  FileText, ChevronRight, Sparkles, Plus, 
  MessageCircle, Home, PlusCircle, User, CheckCircle2, ArrowRight, Loader2,
  FileCheck
} from 'lucide-react';

import { AppHeader } from '../../../components/layout/AppHeader';
import { ServiceSwitcher } from '../../../components/layout/ServiceSwitcher';
import { useSlotFriend } from '../context/SlotFriendContext';
import { useUser } from '../../../context/FirebaseAuthContext';
import { useAuthProfile } from '../../../context/AuthProfileContext';
import { useUserProfile, useUnreadNotificationsCount } from '../../../hooks/useAppData';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { getSlotMateDraft, clearSlotMateDraft } from '../../../utils/guestDraft';
import { GuestAuthPromptModal } from '../../../components/auth/GuestAuthPromptModal';
import { useScrollRestoration } from '../../../hooks/useScrollRestoration';

export default function SlotFriendHomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { hasWhatsApp } = useAuthProfile();
  const { data: profile } = useUserProfile();

  // Phase 4: Preserve scroll position when navigating away and returning
  useScrollRestoration();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount({ module: 'slotmate' });

  const { myPosts = [], totalMatchesCount = 0, getPostMatchCount, createPost, isLoadingPosts = false } = useSlotFriend();

  const [pendingDraft, setPendingDraft] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isPublishingDraft, setIsPublishingDraft] = useState(false);

  useEffect(() => {
    const draft = getSlotMateDraft();
    if (draft && draft.data) {
      setPendingDraft(draft);
    } else {
      setPendingDraft(null);
    }
  }, []);

  const handlePublishDraft = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!hasWhatsApp) {
      navigate(`/whatsapp-setup?returnTo=${encodeURIComponent('/slotmate')}`);
      return;
    }
    const draft = getSlotMateDraft();
    if (!draft || !draft.data) return;

    setIsPublishingDraft(true);
    try {
      const d = draft.data;
      await createPost({
        courseId: d.courseId,
        courseCode: d.courseCode,
        slot: d.slot,
        teacherName: d.teacherName,
        additionalNotes: d.notes || ''
      });
      clearSlotMateDraft();
      setPendingDraft(null);
    } catch (err) {
      console.warn('Publish draft failed:', err);
    } finally {
      setIsPublishingDraft(false);
    }
  };

  const firstName = profile?.name ? profile.name.split(' ')[0] : (user?.firstName || 'Student');

  // Dynamic Statistics from Actual User Data
  const myPostsCount = myPosts.length;
  const coursesCount = useMemo(() => {
    return new Set(myPosts.map((p) => (p.courseCode || p.course || '').toLowerCase().trim())).size;
  }, [myPosts]);
  const slotsCount = useMemo(() => {
    return new Set(myPosts.map((p) => p.slot.toUpperCase().trim())).size;
  }, [myPosts]);

  return (
    <div className="min-h-screen bg-[#FFFDF0] text-[#17233C] flex flex-col justify-between selection:bg-[#FDE047]">
      {/* Decorative Ambient Top Glows (Warm Light Yellowish for SlotMate) */}
      <div className="fixed top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FEF08A]/35 via-[#FFFBEB]/20 to-transparent pointer-events-none" />
      <div className="fixed -top-12 -right-12 w-56 h-56 bg-[#FDE047]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-24 -left-12 w-48 h-48 bg-[#FEF08A]/20 rounded-full blur-2xl pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. APP HEADER: ORIGINAL HELPU LOGO + NOTIFICATION BELL + AVATAR (SLOTMATE THEME) */}
      {/* ========================================================================= */}
      <AppHeader
        theme="slotmate"
        avatarId={profile?.avatarId}
        onBell={() => {
          if (!user) {
            setShowAuthModal(true);
            return;
          }
          navigate('/slotmate/notifications');
        }}
        profileRoute="/slotmate/profile"
        unreadCount={unreadCount}
      />

      {/* ========================================================================= */}
      {/* MAIN CONTENT CONTAINER                                                    */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl lg:max-w-4xl mx-auto px-3.5 sm:px-6 pt-2.5 pb-28 sm:pb-32 space-y-4 sm:space-y-5 relative z-10 flex-1">
        
        {/* Welcome Greeting */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-black text-[#17233C] text-lg sm:text-xl md:text-2xl tracking-tight">
              Welcome back, {firstName}
            </h2>
            <span className="text-lg">👋</span>
          </div>
        </div>

        {/* 2. Dual Service Switcher: [ Ride ]  [ SlotMate ] (Active: SlotMate) */}
        <ServiceSwitcher activeService="slotmate" />

        {/* ========================================================================= */}
        {/* 3. HERO BANNER: SLOTMATE FIND YOUR SLOT PARTNER                           */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-[#FFFBEB] rounded-[24px] sm:rounded-[28px] border border-[#FEF3C7] p-4 sm:p-5 overflow-hidden shadow-2xs"
        >
          {/* Subtle glow effect */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#FEF08A]/40 to-transparent pointer-events-none rounded-full" />

          <div className="relative z-10 flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Left Content */}
            <div className="flex-1 min-w-0 pr-0.5 sm:pr-1 space-y-1.5">
              <h1 className="font-black text-[#17233C] text-[20px] min-[360px]:text-[22px] sm:text-2xl md:text-3xl leading-[1.15] tracking-tight">
                Find Your <br />
                <span className="text-[#FF572E]">Slot Partner</span>
              </h1>

              <p className="text-[11px] min-[360px]:text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed max-w-[210px] min-[390px]:max-w-[245px] sm:max-w-md">
                Connect with students who have the{' '}
                <span className="bg-[#FEF08A] text-[#17233C] px-1 py-0.5 rounded font-bold">
                  same course
                </span>{' '}
                in the{' '}
                <span className="bg-[#FEF08A] text-[#17233C] px-1 py-0.5 rounded font-bold">
                  same slot
                </span>
                .
              </p>
            </div>

            {/* Right Illustration: slot-hero.png (Prominent & larger) */}
            <div 
              className="shrink-0 w-[155px] min-[360px]:w-[170px] min-[390px]:w-[185px] min-[470px]:w-[215px] sm:w-[260px] md:w-[300px] -mr-1 min-[360px]:-mr-2 sm:-mr-3 flex justify-end items-center"
              style={{ maxWidth: '54%' }}
            >
              <img
                src="/slot-hero.png"
                alt="Find Your Slot Partner"
                className="w-full h-auto max-h-[145px] sm:max-h-[185px] md:max-h-[210px] object-contain select-none pointer-events-none drop-shadow-xs"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 4. STATISTICS SECTION (4 REAL DYNAMIC VALUES IN A ROW)                    */}
        {/* ========================================================================= */}
        {isLoadingPosts && myPosts.length === 0 && (
          <div className="flex justify-end -mb-1">
            <span className="text-[11px] font-bold text-[#D97706] bg-[#FEF3C7]/70 border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
              Data loading...
            </span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 min-[360px]:gap-2.5 sm:gap-4 py-1">
          {/* 1. My Posts */}
          <div 
            onClick={() => navigate('/slotmate/matches')}
            className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <GraduationCap className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
              My Posts
            </span>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] font-black text-xs leading-none">
              {myPostsCount}
            </span>
          </div>

          {/* 2. Total Matches */}
          <div 
            onClick={() => navigate('/slotmate/matches')}
            className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <Users className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
              Total Matches
            </span>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] font-black text-xs leading-none">
              {totalMatchesCount}
            </span>
          </div>

          {/* 3. Courses */}
          <div 
            onClick={() => navigate('/slotmate/matches')}
            className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <BookOpen className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
              Courses
            </span>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0284C7] font-black text-xs leading-none">
              {coursesCount}
            </span>
          </div>

          {/* 4. My Slots */}
          <div 
            onClick={() => navigate('/slotmate/matches')}
            className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 min-[360px]:w-13 min-[360px]:h-13 sm:w-14 sm:h-14 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-all">
              <CalendarDays className="w-5 h-5 min-[360px]:w-5.5 min-[360px]:h-5.5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] min-[360px]:text-xs font-bold text-[#17233C] mt-1.5 leading-tight whitespace-nowrap">
              My Slots
            </span>
            <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] font-black text-xs leading-none">
              {slotsCount}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. HOW SLOTMATE WORKS? (3 COMPACT STEPS)                                  */}
        {/* ========================================================================= */}
        <div className="bg-[#FFFBEB] rounded-[24px] sm:rounded-[26px] p-4 sm:p-5 border border-[#FEF3C7] shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm sm:text-base text-[#17233C] tracking-tight">
              How SlotMate Works?
            </h3>
            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
          </div>

          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="relative">
                <div className="w-13 h-13 min-[360px]:w-14 min-[360px]:h-14 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shadow-xs">
                  <FileText className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FBBF24] text-[#78350F] text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  1
                </span>
              </div>
              <span className="text-xs font-black text-[#17233C] mt-2 leading-tight">
                Post
              </span>
              <span className="text-[10px] text-[#6E7587] font-medium leading-tight">
                Course &amp; Slot
              </span>
            </div>

            {/* Connecting Arrow */}
            <span className="text-[#FBBF24] font-black text-base -mt-4">→</span>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="relative">
                <div className="w-13 h-13 min-[360px]:w-14 min-[360px]:h-14 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shadow-xs">
                  <Users className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FBBF24] text-[#78350F] text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  2
                </span>
              </div>
              <span className="text-xs font-black text-[#17233C] mt-2 leading-tight">
                Get
              </span>
              <span className="text-[10px] text-[#6E7587] font-medium leading-tight">
                Matched
              </span>
            </div>

            {/* Connecting Arrow */}
            <span className="text-[#FBBF24] font-black text-base -mt-4">→</span>

            {/* Step 3: WhatsApp Connect */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="relative">
                <div className="w-13 h-13 min-[360px]:w-14 min-[360px]:h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center shadow-xs p-1.5 transition-transform group-hover:scale-105">
                  <img
                    src="/whatsapp.svg"
                    alt="WhatsApp"
                    className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 object-contain select-none pointer-events-none drop-shadow-xs"
                    onError={(e) => { e.currentTarget.src = '/whatsapp.png'; }}
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FBBF24] text-[#78350F] text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                  3
                </span>
              </div>
              <span className="text-xs font-black text-[#17233C] mt-2 leading-tight">
                Connect
              </span>
              <span className="text-[10px] text-[#6E7587] font-medium leading-tight">
                on WhatsApp
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SAVED SLOT DRAFT REVIEW CARD                                              */}
        {/* ========================================================================= */}
        {pendingDraft && (
          <div className="bg-[#FFFDF7] rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 border border-[#FDE68A] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                    Saved Slot Draft
                  </h3>
                  <span className="text-[10px] text-[#D97706] font-bold">Ready to publish when you choose</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] font-black text-[11px]">
                Draft
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-[#FCE7C8] flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-xs sm:text-sm text-[#17233C] truncate">
                  {pendingDraft.data?.courseCode} – {pendingDraft.data?.courseName || 'Course'}
                </h4>
                <p className="text-[11px] text-[#6E7587] font-medium truncate mt-0.5">
                  Slot {pendingDraft.data?.slot} • {pendingDraft.data?.teacherName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => navigate('/slotmate/create')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-[#FFFDF9] border border-[#F4E3D8] text-[#17233C] font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                Review &amp; Edit
              </button>
              <button
                type="button"
                onClick={handlePublishDraft}
                disabled={isPublishingDraft}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] font-black text-xs shadow-xs transition-all cursor-pointer active:scale-95 border border-[#EAB308] flex items-center justify-center gap-1.5"
              >
                {isPublishingDraft ? 'Publishing...' : 'Publish to Campus'}
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.4]" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. MY SLOT POSTS (EXACT DESIGN MATCHING REFERENCE SCREENSHOT)              */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 stroke-[2.4]" />
              </div>
              <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                My Slot Posts
              </h3>
            </div>

            <button
              type="button"
              onClick={() => navigate('/slotmate/matches')}
              className="text-xs font-black text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Actual Logged-In User Posts (Maximum 3 on Home Page) or Clean Empty State */}
          {isLoadingPosts && myPosts.length === 0 ? (
            <div className="py-7 px-3 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#D97706] animate-spin mb-2" />
              <p className="text-[11px] text-[#6E7587] font-medium">Loading your slot posts...</p>
            </div>
          ) : myPosts.length > 0 ? (
            <div className="space-y-2.5">
              {myPosts.slice(0, 3).map((post) => {
                const postMatchCount = post.matchCount ?? 0;
                const postId = post.id || post._id;
                const courseCode = post.courseCode || post.course?.split(/[-–]/)?.[0]?.trim();

                return (
                  <div
                    key={postId}
                    onClick={() =>
                      navigate(
                        `/slotmate/matches?postId=${postId}&course=${encodeURIComponent(
                          courseCode
                        )}&slot=${encodeURIComponent(post.slot)}`
                      )
                    }
                    className="p-3 sm:p-3.5 rounded-2xl bg-[#FFFDF9] border border-[#F4E3D8] hover:border-[#F59E0B]/50 hover:bg-[#FFFBF2] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all group"
                  >
                    {/* Left: Icon + Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-[#FED7AA]">
                        <GraduationCap className="w-5 h-5 stroke-[2.2]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-xs sm:text-sm text-[#17233C] truncate group-hover:text-[#D97706] transition-colors">
                          {post.course}
                        </h4>
                        <p className="text-[11px] text-[#6E7587] font-medium truncate mt-0.5">
                          Slot {post.slot} • {post.teacher}
                        </p>
                      </div>
                    </div>

                    {/* Right: Matches Badge + Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                        {postMatchCount} Matches
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#17233C] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Clean Empty State for New User */
            <div className="py-7 px-3 text-center flex flex-col items-center justify-center">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-2">
                <GraduationCap className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                No Slot Posts Yet
              </h4>
              <p className="text-[11px] text-[#6E7587] max-w-xs mt-1 leading-relaxed">
                Create your first slot post to find campus peers registered in your exact courses and slots!
              </p>
              <button
                type="button"
                onClick={() => navigate('/slot-friend/create')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create Slot Post</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 7. STUDY BANNER: STUDY BETTER TOGETHER                                    */}
        {/* ========================================================================= */}
        <div className="relative bg-[#FFFBEB] rounded-[24px] sm:rounded-[28px] border border-[#FEF3C7] p-4 sm:p-5 overflow-hidden shadow-2xs">
          <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
            {/* Left Illustration: slot-study-partner.png */}
            <div className="shrink-0 w-[120px] min-[360px]:w-[135px] min-[400px]:w-[150px] sm:w-[175px] -ml-1 sm:-ml-2 flex items-center">
              <img
                src="/slot-study-partner.png"
                alt="Study Better Together"
                className="w-full h-auto max-h-[105px] sm:max-h-[125px] object-contain select-none pointer-events-none drop-shadow-xs"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>

            {/* Right Text */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base min-[360px]:text-lg sm:text-xl text-[#17233C] leading-tight">
                  Study Better Together
                </h3>
                <span className="text-[#F59E0B] text-sm">✨</span>
              </div>
              <p className="text-[11px] min-[360px]:text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed mt-1">
                Find slot mates, discuss concepts and prepare for exams together.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 8. BOTTOM NAVIGATION: 5 ITEMS WITH HOME ACTIVE                            */}
      {/* ========================================================================= */}
      <SlotMateBottomNav active="home" />

      {/* Guest Authentication Prompt Modal */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="SlotMate"
        returnPath="/slotmate"
      />
    </div>
  );
}
