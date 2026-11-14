import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Users, ChevronRight, Check, 
  Calendar, User, Plus, Loader2, Trash2, Edit3, 
  Bookmark, MoreHorizontal, Building2, GraduationCap, 
  ArrowRight, CheckCircle2, CheckCircle, CircleSlash
} from 'lucide-react';
import { useSlotFriend } from '../context/SlotFriendContext';
import { useSlotPostMatches } from '../../../hooks/useAppData';
import { useUser } from '../../../context/FirebaseAuthContext';
import { GuestAuthPromptModal } from '../../../components/auth/GuestAuthPromptModal';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { getCourseSubjectTheme } from '../utils/courseIconHelper';

export default function SlotMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postIdParam = searchParams.get('postId');
  const courseFilterParam = searchParams.get('course');
  const slotFilterParam = searchParams.get('slot');
  const { user, isSignedIn } = useUser();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { 
    myPosts = [], 
    getPostMatchCount, 
    deletePost,
    isLoadingPosts 
  } = useSlotFriend();

  // Check if we are viewing Post-wise Match Details (Page 2)
  const isViewingSpecificCourse = Boolean(postIdParam || (courseFilterParam && slotFilterParam));

  // Find the user's matching post for Page 2
  const currentPost = useMemo(() => {
    if (!isViewingSpecificCourse) return null;
    if (postIdParam) {
      return myPosts.find((p) => p.id === postIdParam || p._id === postIdParam);
    }
    const targetSlot = (slotFilterParam || '').toUpperCase().trim();
    const cleanCourse = (courseFilterParam || '').toLowerCase().trim();

    return myPosts.find((p) => {
      const pCode = (p.courseCode || '').toLowerCase().trim();
      const pCourse = (p.course || '').toLowerCase().trim();
      return (
        (pCode === cleanCourse || pCourse.includes(cleanCourse) || cleanCourse.includes(pCode)) &&
        p.slot.toUpperCase().trim() === targetSlot
      );
    });
  }, [myPosts, postIdParam, courseFilterParam, slotFilterParam, isViewingSpecificCourse]);

  const targetPostId = currentPost?._id || currentPost?.id || postIdParam || null;

  // Cached per-post match list. Cached results render immediately on tab return.
  const { data: matchesPayload, isLoading: isMatchesQueryLoading } = useSlotPostMatches(
    targetPostId,
    { enabled: isViewingSpecificCourse }
  );

  // Filter tabs for Page 1: 'all' | 'with-matches' | 'no-matches'
  const [filterTab, setFilterTab] = useState('all');

  // Compute posts with matches and without matches dynamically
  const totalCoursesCount = myPosts.length;
  const withMatchesPosts = useMemo(() => {
    return myPosts.filter((p) => getPostMatchCount(p) > 0);
  }, [myPosts, getPostMatchCount]);

  const noMatchesPosts = useMemo(() => {
    return myPosts.filter((p) => getPostMatchCount(p) === 0);
  }, [myPosts, getPostMatchCount]);

  const displayedPosts = useMemo(() => {
    if (filterTab === 'with-matches') return withMatchesPosts;
    if (filterTab === 'no-matches') return noMatchesPosts;
    return myPosts;
  }, [filterTab, myPosts, withMatchesPosts, noMatchesPosts]);

  // Real matched students for Page 2 come from the cached query above.
  const matchedStudents = matchesPayload?.matches || [];
  const postDetailsFromApi = matchesPayload?.post || null;
  const isLoadingMatches =
    isMatchesQueryLoading || (isViewingSpecificCourse && isLoadingPosts && !targetPostId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const menuRef = useRef(null);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsPostMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectivePost = currentPost || postDetailsFromApi;

  // Helper to extract clean course code (e.g. 'CSE2001')
  const getCourseCode = (post) => {
    if (!post) return courseFilterParam || '';
    return post.courseCode || post.course?.split(/[-–]/)[0]?.trim() || '';
  };

  // Helper to extract course title (e.g. 'Data Structures & Algorithms')
  const getCourseTitle = (post) => {
    if (!post) return '';
    return post.courseName || post.course?.split(/[-–]/)?.[1]?.trim() || post.courseCode;
  };

  // Helper to format clean teacher name
  const cleanTeacherName = (teacherStr = '') => {
    return (teacherStr || '').split('(')[0].trim();
  };

  // Open WhatsApp chat directly (Prompt guest to sign in first)
  const handleOpenWhatsApp = (e, student) => {
    e.stopPropagation();
    if (!isSignedIn) {
      setShowAuthModal(true);
      return;
    }
    const raw = student.whatsappNumber || student.phone || '9876543210';
    const cleanPhone = raw.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Navigate to student profile (Page 3)
  const handleStudentClick = (matchId) => {
    navigate(`/slotmate/student/${matchId}`);
  };

  // Delete post handler
  const handleDeletePost = async (e, postToDelete) => {
    e.stopPropagation();
    setIsPostMenuOpen(false);
    const postId = postToDelete?._id || postToDelete?.id;
    if (!postId) return;
    if (!window.confirm(`Are you sure you want to delete your post for ${getCourseCode(postToDelete)}?`)) return;

    try {
      setIsDeleting(true);
      await deletePost(postId);
      if (isViewingSpecificCourse) {
        navigate('/slotmate/matches');
      }
    } catch (err) {
      console.warn('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit post handler
  const handleEditPost = (e, postToEdit) => {
    e.stopPropagation();
    setIsPostMenuOpen(false);
    const postId = postToEdit?._id || postToEdit?.id;
    if (postId) {
      navigate(`/slotmate/create?edit=${postId}`);
    }
  };

  // ===========================================================================
  // PAGE 2: POST-WISE MATCH DETAILS SCREEN (EXACT MATCH TO REFERENCE IMAGE 1)
  // ===========================================================================
  if (isViewingSpecificCourse) {
    const courseCode = getCourseCode(effectivePost);
    const courseTitle = getCourseTitle(effectivePost);
    const slotCode = effectivePost?.slot || slotFilterParam || '';
    const teacherName = cleanTeacherName(effectivePost?.teacherName || effectivePost?.teacher || '');
    const courseCredits = effectivePost?.credits || 4;

    return (
      <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col pb-28">
        
        {/* Header (Exact to Reference UI with Title, Bookmark and 3-Dots Menu) */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/slotmate/matches')}
              className="p-1 -ml-1 text-[#17233C] hover:bg-white rounded-xl transition-colors cursor-pointer shrink-0"
              aria-label="Back to Matches"
            >
              <ArrowLeft className="w-5 h-5 text-[#17233C] stroke-[2.4]" />
            </button>
            <h1 className="font-black text-[#17233C] text-lg sm:text-xl tracking-tight truncate">
              {courseCode} – Slot {slotCode}
            </h1>
          </div>

          {/* Top Right Action Icons: Bookmark + 3-Dots Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Bookmark Button */}
            <button
              type="button"
              onClick={() => setIsBookmarked((b) => !b)}
              className="w-9 h-9 rounded-2xl border border-[#F4E3D8] bg-white flex items-center justify-center text-[#17233C] hover:bg-[#FFFDF9] shadow-2xs transition-colors cursor-pointer"
              aria-label="Bookmark Course"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#17233C]'}`} />
            </button>

            {/* Three Dots Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsPostMenuOpen((o) => !o)}
                className="w-9 h-9 rounded-2xl border border-[#F4E3D8] bg-white flex items-center justify-center text-[#17233C] hover:bg-[#FFFDF9] shadow-2xs transition-colors cursor-pointer"
                aria-label="Post Options"
              >
                <MoreHorizontal className="w-5 h-5 stroke-[2.4]" />
              </button>

              {/* Dropdown Menu for Edit / Delete */}
              {isPostMenuOpen && effectivePost && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-2xl border border-[#F4E3D8] shadow-lg py-1 z-30 divide-y divide-[#F4E3D8]/60">
                  <button
                    type="button"
                    onClick={(e) => handleEditPost(e, effectivePost)}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-[#17233C] hover:bg-[#FEF9C3]/50 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Edit Post</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePost(e, effectivePost)}
                    disabled={isDeleting}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-[#DC2626] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Post</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Container (Mobile-first 360px-430px optimized) */}
        <main className="w-full max-w-xl mx-auto px-3.5 sm:px-4 pt-3.5 space-y-4 flex-1">
          
          {/* =================================================================== */}
          {/* 1. TOP COURSE INFORMATION CARD (EXACT MATCH TO REFERENCE IMAGE 1)   */}
          {/* =================================================================== */}
          <div className="bg-white rounded-[28px] sm:rounded-[32px] p-4 min-[390px]:p-5 border border-[#F4E3D8] shadow-[0_6px_24px_rgba(250,204,21,0.06)] relative overflow-hidden space-y-3.5">
            
            {/* Matched Students Handshake PNG Illustration */}
            <div className="absolute right-1 top-2 sm:right-2 sm:top-2 w-28 h-28 min-[390px]:w-32 min-[390px]:h-32 sm:w-36 sm:h-36 pointer-events-none select-none overflow-hidden flex items-center justify-end opacity-95">
              <img
                src="/slot-handshake.png"
                alt="Matched Study Partners"
                className="w-full h-full object-contain object-right drop-shadow-sm select-none"
              />
            </div>

            {/* Top Section: 3D Book Icon + Course Details */}
            <div className="relative z-10 flex items-start gap-3 min-[390px]:gap-3.5 pr-24 min-[390px]:pr-28 sm:pr-32">
              
              {/* Left Column: 3D Book PNG inside Squircle */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                <img
                  src="/course-3d-book.png"
                  alt={courseCode}
                  className="w-full h-full object-contain select-none drop-shadow-md"
                />
              </div>

              {/* Course Texts & Metadata */}
              <div className="min-w-0 flex-1 space-y-1">
                
                {/* 'Course' Pill */}
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] font-black text-[11px] tracking-wide border border-[#FDE68A]/60">
                  Course
                </span>

                {/* Course Code */}
                <h2 className="font-black text-xl sm:text-2xl text-[#17233C] tracking-tight leading-tight">
                  {courseCode}
                </h2>

                {/* Course Name */}
                <p className="text-xs sm:text-sm font-bold text-[#4B5563] leading-snug line-clamp-2">
                  {courseTitle}
                </p>

                {/* Teacher Pill & Credits */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {teacherName && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#78350F] text-xs font-bold border border-[#FDE68A]">
                      <User className="w-3.5 h-3.5 text-[#78350F]" />
                      <span>Teacher: <span className="font-black text-[#17233C]">{teacherName}</span></span>
                    </div>
                  )}

                  <span className="text-[#D1D5DB] font-light">|</span>

                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17233C]">
                    <GraduationCap className="w-4 h-4 text-[#17233C] stroke-[2.2]" />
                    <span>{courseCredits} Credits</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Horizontal Divider Line */}
            <div className="border-t border-[#F4E3D8]/70" />

            {/* Bottom Row: Class Slots | Posted By: You */}
            <div className="relative z-10 flex items-center gap-5 sm:gap-6 pt-0.5">
              
              {/* Group 1: Class Slots */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]">
                  <Calendar className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#6E7587] block leading-none">
                    Class Slots
                  </span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#854D0E] font-black text-xs mt-1 border border-[#FDE68A]/70 truncate">
                    {slotCode}
                  </span>
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="h-7 w-[1px] bg-[#F4E3D8] shrink-0" />

              {/* Group 2: Posted By: You */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]">
                  <Users className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#6E7587] block leading-none">
                    Posted By
                  </span>
                  <span className="inline-block px-3 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] font-black text-xs mt-1 border border-[#FDE047]/70">
                    You
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* =================================================================== */}
          {/* 2. MATCHED STUDENTS HEADING (WITH GOLDEN ACCENT UNDERLINE)           */}
          {/* =================================================================== */}
          <div className="pt-1 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]">
                <Users className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg text-[#17233C] tracking-tight leading-none">
                  Matched Students ({isLoadingMatches ? '...' : matchedStudents.length})
                </h3>
                {/* Yellow Rounded Accent Bar */}
                <div className="w-10 h-1 bg-[#F59E0B] rounded-full mt-1.5" />
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* 3. MATCHED STUDENTS LIST / CARDS (EXACT MATCH TO REFERENCE IMAGE 1) */}
          {/* =================================================================== */}
          {isLoadingMatches ? (
            <div className="bg-white rounded-[26px] p-8 border border-[#F4E3D8] text-center space-y-2 shadow-xs">
              <Loader2 className="w-6 h-6 text-[#D97706] animate-spin mx-auto" />
              <p className="text-xs text-[#6E7587]">Finding matching classmates...</p>
            </div>
          ) : matchedStudents.length > 0 ? (
            <div className="space-y-3">
              {matchedStudents.map((student) => (
                <div
                  key={student.matchId || student.postId}
                  onClick={() => handleStudentClick(student.matchId || student.postId)}
                  className="bg-white rounded-[26px] sm:rounded-[28px] p-4 min-[390px]:p-4.5 border border-[#F4E3D8] shadow-[0_4px_16px_rgba(250,204,21,0.06)] hover:border-[#FACC15] transition-all cursor-pointer relative overflow-hidden flex items-center justify-between gap-3.5 group active:scale-[0.99]"
                >
                  {/* Left Side: Student Avatar + Details + Badges */}
                  <div className="relative z-10 flex items-center gap-3.5 min-w-0 flex-1">
                    
                    {/* Student Avatar with Online/Verified Indicator */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 min-[390px]:w-13 min-[390px]:h-13 rounded-full overflow-hidden border-2 border-white shadow-xs bg-[#FEF3C7]">
                        <img
                          src={student.profileImage || '/image.png'}
                          alt={student.studentName}
                          className="w-full h-full object-cover select-none"
                          onError={(e) => {
                            e.currentTarget.src = '/image.png';
                          }}
                        />
                      </div>
                      {/* Green Verified / Active Dot */}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-white shadow-2xs" />
                    </div>

                    {/* Student Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      
                      {/* Name */}
                      <h4 className="font-black text-base min-[390px]:text-lg text-[#17233C] group-hover:text-[#D97706] transition-colors truncate leading-tight">
                        {student.studentName}
                      </h4>

                      {/* Teacher Row (clean) */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#6E7587] leading-tight">
                        <GraduationCap className="w-3.5 h-3.5 text-[#17233C]" />
                        <span>Teacher: <span className="text-[#D97706] font-black">{cleanTeacherName(student.teacherName)}</span></span>
                      </div>

                      {/* Bottom Pills Row: [ Slot Match ✓ ]  [ C11, C12 ] */}
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        {/* Mint Green Slot Match Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-black border border-[#BBF7D0]">
                          <Calendar className="w-3.5 h-3.5 stroke-[2.4]" />
                          <span>Slot Match</span>
                          <CheckCircle className="w-3.5 h-3.5 fill-[#16A34A] text-white" />
                        </div>

                        {/* Soft Warm Yellow Slot Pill */}
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-black border border-[#FDE68A]">
                          <Calendar className="w-3.5 h-3.5 text-[#92400E]" />
                          <span>{student.slot || slotCode}</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Right Side: Compact WhatsApp Icon */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenWhatsApp(e, student)}
                    className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer"
                    aria-label={`Connect with ${student.studentName} on WhatsApp`}
                    title={`Connect with ${student.studentName} on WhatsApp`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="w-5 h-5 fill-current"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </button>

                </div>
              ))}
            </div>
          ) : (
            /* =================================================================== */
            /* ZERO-MATCH EXPERIENCE                                               */
            /* =================================================================== */
            <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-[#F4E3D8] text-center space-y-3.5 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-[#FEF9C3] text-[#D97706] flex items-center justify-center mx-auto text-3xl border border-[#FEF08A] shadow-2xs">
                👥
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="font-black text-base sm:text-lg text-[#17233C]">
                  No matches yet!
                </h4>
                <p className="text-xs sm:text-sm font-bold text-[#D97706] leading-relaxed">
                  We'll notify you when someone joins your course and slot.
                </p>
                <p className="text-xs text-[#6E7587] leading-relaxed pt-1">
                  Once another student registers for {courseCode} in slot {slotCode}, they will automatically appear here!
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <SlotMateBottomNav active="matches" />
      </div>
    );
  }

  // ===========================================================================
  // PAGE 1: MAIN MATCHES PAGE (All Posts by Current Student)
  // ===========================================================================
  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col pb-28">
      {/* Header */}
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
          <h1 className="font-black text-[#17233C] text-xl tracking-tight">
            Matches
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate('/slotmate/create')}
          className="px-4 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 border border-[#EAB308]/60"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Post</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-xl mx-auto px-3.5 sm:px-4 pt-3.5 space-y-4 flex-1">
        
        {/* ======================================================================= */}
        {/* HERO BANNER CARD (EXACT MATCH TO REFERENCE IMAGE)                       */}
        {/* ======================================================================= */}
        <div className="rounded-[28px] bg-gradient-to-r from-[#FFFDF7] via-[#FFF9EE] to-[#FEF3D6] border border-[#FDE68A]/60 p-4 min-[390px]:p-5 relative overflow-hidden shadow-[0_4px_20px_rgba(250,204,21,0.06)] flex items-center justify-between">
          {/* Left Text */}
          <div className="space-y-1 relative z-10 max-w-[190px] min-[390px]:max-w-[220px] min-[420px]:max-w-[240px] sm:max-w-xs">
            <h2 className="font-black text-lg min-[390px]:text-xl sm:text-2xl text-[#17233C] tracking-tight leading-tight">
              Your Course{' '}
              <span className="relative inline-block px-2.5 py-0.5 rounded-xl bg-[#FEF08A] text-[#17233C] font-black italic shadow-2xs">
                Matches
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#6E7587] font-medium leading-snug pt-0.5">
              Students matching your posted course &amp; slot.
            </p>
          </div>

          {/* Right Illustration: 3 Students PNG */}
          <div className="relative shrink-0 self-end -mb-4 -mr-3 sm:-mb-5 sm:-mr-4 pointer-events-none select-none">
            <div className="w-32 min-[390px]:w-36 min-[420px]:w-44 sm:w-52 h-28 min-[390px]:h-32 min-[420px]:h-36 sm:h-40 flex items-end justify-end">
              <img
                src="/slot-matches-students.png"
                alt="Course Matches Students"
                className="w-full h-full object-contain object-bottom-right drop-shadow-sm shrink-0"
                onError={(e) => {
                  e.currentTarget.src = '/slot-post-illustration.png';
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* MATCH FILTERS (3 TABS WITH DYNAMIC COUNTS)                               */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#FFF8F3] border border-[#F4E3D8] rounded-2xl shadow-2xs">
          {/* Tab 1: All Courses */}
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            aria-pressed={filterTab === 'all'}
            className={`min-h-10 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#FEF08A] text-[#78350F] shadow-2xs'
                : 'text-[#6E7587] hover:bg-white hover:text-[#17233C]'
            }`}
          >
            <BookOpen className="hidden sm:block w-4 h-4 stroke-[2.2] shrink-0" />
            <span className="sm:hidden">All</span>
            <span className="hidden sm:inline">All Courses</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] sm:text-[11px] font-black leading-none ${
                filterTab === 'all'
                  ? 'bg-[#FDE047]/70 text-[#78350F]'
                  : 'bg-[#F4E3D8]/70 text-[#6E7587]'
              }`}
            >
              {totalCoursesCount}
            </span>
          </button>

          {/* Tab 2: With Matches */}
          <button
            type="button"
            onClick={() => setFilterTab('with-matches')}
            aria-pressed={filterTab === 'with-matches'}
            className={`min-h-10 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              filterTab === 'with-matches'
                ? 'bg-[#FEF08A] text-[#78350F] shadow-2xs'
                : 'text-[#6E7587] hover:bg-white hover:text-[#17233C]'
            }`}
          >
            <Users className="hidden sm:block w-4 h-4 stroke-[2.2] shrink-0" />
            <span className="sm:hidden">Matches</span>
            <span className="hidden sm:inline">With Matches</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] sm:text-[11px] font-black leading-none ${
                filterTab === 'with-matches'
                  ? 'bg-[#FDE047]/70 text-[#78350F]'
                  : 'bg-[#F4E3D8]/70 text-[#6E7587]'
              }`}
            >
              {withMatchesPosts.length}
            </span>
          </button>

          {/* Tab 3: No Matches */}
          <button
            type="button"
            onClick={() => setFilterTab('no-matches')}
            aria-pressed={filterTab === 'no-matches'}
            className={`min-h-10 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              filterTab === 'no-matches'
                ? 'bg-[#FEF08A] text-[#78350F] shadow-2xs'
                : 'text-[#6E7587] hover:bg-white hover:text-[#17233C]'
            }`}
          >
            <CircleSlash className="hidden sm:block w-4 h-4 stroke-[2.2] shrink-0" />
            <span className="sm:hidden">No Match</span>
            <span className="hidden sm:inline">No Matches</span>
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] sm:text-[11px] font-black leading-none ${
                filterTab === 'no-matches'
                  ? 'bg-[#FDE047]/70 text-[#78350F]'
                  : 'bg-[#F4E3D8]/70 text-[#6E7587]'
              }`}
            >
              {noMatchesPosts.length}
            </span>
          </button>
        </div>

        {/* ======================================================================= */}
        {/* DYNAMIC COURSE CARDS LIST                                               */}
        {/* ======================================================================= */}
        {isLoadingPosts ? (
          <div className="bg-white rounded-[24px] p-8 border border-[#F4E3D8] text-center space-y-2">
            <Loader2 className="w-6 h-6 text-[#D97706] animate-spin mx-auto" />
            <p className="text-xs text-[#6E7587]">Loading your published courses...</p>
          </div>
        ) : displayedPosts.length > 0 ? (
          <div className="space-y-3">
            {displayedPosts.map((post) => {
              const matchCount = getPostMatchCount(post);
              const courseCode = getCourseCode(post);
              const courseTitle = getCourseTitle(post);
              const teacherName = cleanTeacherName(post.teacherName || post.teacher);
              const postId = post.id || post._id;

              // Subject-based dynamic icon & theme
              const theme = getCourseSubjectTheme(courseCode, courseTitle);
              const SubjectIcon = theme.icon;

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
                  className="bg-white rounded-[24px] sm:rounded-[26px] p-4 sm:p-4.5 border border-[#F4E3D8] shadow-[0_4px_16px_rgba(250,204,21,0.06)] hover:border-[#FACC15] transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] relative overflow-hidden"
                >
                  {/* Left: Subject Icon + Course Info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Subject-based squircle container */}
                    <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl ${theme.bgClass} ${theme.textClass} border ${theme.borderClass} flex items-center justify-center shrink-0 shadow-2xs`}>
                      <SubjectIcon className="w-6 h-6 stroke-[2.2]" />
                    </div>

                    {/* Course Code + Name + Slot & Faculty Details */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h3 className="font-black text-base min-[390px]:text-lg text-[#3E1A00] tracking-tight leading-tight">
                        {courseCode}
                      </h3>

                      <p className="font-bold text-xs min-[390px]:text-sm text-[#17233C] truncate leading-tight">
                        {courseTitle || courseCode}
                      </p>

                      <div className="flex items-center gap-2 text-xs font-semibold text-[#6E7587] pt-1 flex-wrap leading-tight">
                        <span className="flex items-center gap-1 text-[#6E7587]">
                          <Calendar className="w-3.5 h-3.5 text-[#8C93A4] stroke-[2.2]" />
                          <span>Slot {post.slot}</span>
                        </span>

                        {teacherName && (
                          <>
                            <span className="text-[#D1D5DB] font-light">|</span>
                            <span className="flex items-center gap-1 text-[#6E7587]">
                              <User className="w-3.5 h-3.5 text-[#8C93A4] stroke-[2.2]" />
                              <span className="truncate">{teacherName}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Matches Badge + Chevron */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {matchCount > 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] text-xs font-black shadow-2xs">
                        <Users className="w-3.5 h-3.5 stroke-[2.4]" />
                        <span>{matchCount} {matchCount === 1 ? 'Match' : 'Matches'}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEF3C7] text-[#78350F] border border-[#FDE68A] text-xs font-black shadow-2xs">
                        <Users className="w-3.5 h-3.5 stroke-[2.4]" />
                        <span>0 Matches</span>
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-[#17233C] stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : myPosts.length === 0 ? (
          /* Enhanced Empty State Card when student has no posts yet */
          <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-[#F4E3D8] text-center space-y-4 shadow-xs">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#FEF9C3] border border-[#FEF08A] flex items-center justify-center p-3 shadow-2xs">
              <img
                src="/slot-post-illustration.png"
                alt="No Posts"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/slot-calendar-3d.png';
                }}
              />
            </div>
            <div className="space-y-1 max-w-xs mx-auto">
              <h3 className="font-black text-base sm:text-lg text-[#17233C]">No Slot Posts Yet</h3>
              <p className="text-xs text-[#6E7587] leading-relaxed">
                Post your registered courses and timetable slots to instantly discover matching study partners!
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate('/slotmate/create')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#17233C] text-xs font-black rounded-full shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Your First Post</span>
              </button>
            </div>
          </div>
        ) : (
          /* Filtered empty state (e.g. "With Matches" is active but none match yet) */
          <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-[#F4E3D8] text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FEF9C3] border border-[#FEF08A] flex items-center justify-center text-2xl shadow-2xs">
              {filterTab === 'with-matches' ? '🔍' : '🎉'}
            </div>
            <div className="space-y-1 max-w-xs mx-auto">
              <h3 className="font-black text-base text-[#17233C]">
                {filterTab === 'with-matches'
                  ? 'No Courses with Matches Yet'
                  : 'All Courses Have Matches!'}
              </h3>
              <p className="text-xs text-[#6E7587] leading-relaxed">
                {filterTab === 'with-matches'
                  ? 'None of your posted courses have matching classmates yet. We will notify you as soon as someone joins!'
                  : 'Great news! All your posted courses have at least one matching classmate.'}
              </p>
            </div>
            {filterTab !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className="text-xs font-black text-[#D97706] hover:underline cursor-pointer pt-1"
              >
                View All Courses ({totalCoursesCount})
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <SlotMateBottomNav active="matches" />

      {/* Guest Authentication Prompt Modal */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="SlotMate"
        returnPath="/slotmate/matches"
      />
    </div>
  );
}
