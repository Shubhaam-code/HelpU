import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Pencil, Check, CheckCircle2, 
  FileText, Users, GraduationCap, Layers, ChevronRight, Crown,
  X, AlertCircle, Plus, Mail, LogOut, ArrowRight, ShieldAlert, User as UserIcon
} from 'lucide-react';
import { useFirebaseAuth } from '../../../context/FirebaseAuthContext';
import { useUserProfile } from '../../../hooks/useAppData';
import { useAuthProfile } from '../../../context/AuthProfileContext';
import { useSlotFriend } from '../context/SlotFriendContext';
import { saveProfile } from '../../../lib/api';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { getProfileDraft } from '../../../utils/guestDraft';

export default function SlotMateProfilePage() {
  const navigate = useNavigate();
  const { user, firebaseUser, signOut } = useFirebaseAuth();
  const { data: cachedProfile, refetch: refetchProfile } = useUserProfile();
  const { setWhatsAppNumber: setContextWhatsAppNumber } = useAuthProfile();
  const { myPosts = [], totalMatchesCount = 0, showToast } = useSlotFriend();

  const isGuest = !user;

  const profile = cachedProfile || null;

  // Real display data matching reference UI
  const displayName = isGuest
    ? 'Guest Mode'
    : (profile?.fullName || user?.fullName || user?.displayName || 'Campus Student');
  const displayEmail = isGuest
    ? 'Unverified'
    : (profile?.email || user?.email || user?.primaryEmailAddress?.emailAddress || '');
  const displayCollege = isGuest
    ? 'Unverified'
    : (profile?.college || profile?.university || user?.college || 'VIT, Bhopal');
  const displayWhatsApp = isGuest
    ? 'Unverified'
    : (profile?.whatsappNumber || profile?.phone || user?.phoneNumber || 'Not added yet');
  
  // Real Google Profile Photo from authentication (or user's saved avatar)
  const googlePhoto = user?.imageUrl || firebaseUser?.photoURL || profile?.avatar || profile?.imageUrl || profile?.photoURL;
  const displayAvatar = isGuest ? '/image.png' : (googlePhoto || '/image.png');

  // Real calculated statistics from actual application data
  const postsCount = isGuest ? 0 : (Array.isArray(myPosts) ? myPosts.length : 0);
  const matchesCount = isGuest ? 0 : totalMatchesCount;
  const coursesCount = useMemo(() => {
    if (isGuest || !Array.isArray(myPosts) || myPosts.length === 0) return 0;
    const uniqueCourses = new Set(myPosts.map((p) => p.courseCode || p.course?.trim()).filter(Boolean));
    return uniqueCourses.size;
  }, [isGuest, myPosts]);

  // Edit Profile Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editCollege, setEditCollege] = useState(displayCollege);
  const [editWhatsApp, setEditWhatsApp] = useState(displayWhatsApp);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      if (signOut) {
        await signOut();
      }
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle Opening Edit Modal
  const handleOpenEdit = () => {
    setEditName(displayName);
    setEditCollege(displayCollege);
    setEditWhatsApp(displayWhatsApp);
    setSaveError('');
    setIsEditing(true);
  };

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setSaveError('Please enter your full name.');
      return;
    }
    if (!editWhatsApp.trim()) {
      setSaveError('Please enter your WhatsApp contact number.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      await saveProfile({
        fullName: editName.trim(),
        college: editCollege.trim(),
        whatsappNumber: editWhatsApp.trim(),
        phone: editWhatsApp.trim(),
      });

      if (setContextWhatsAppNumber) {
        setContextWhatsAppNumber(editWhatsApp.trim());
      }
      if (refetchProfile) {
        await refetchProfile();
      }

      if (showToast) {
        showToast('Profile updated successfully!', 'success');
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      // Fallback update locally so user experience is smooth
      if (setContextWhatsAppNumber) {
        setContextWhatsAppNumber(editWhatsApp.trim());
      }
      if (showToast) {
        showToast('Profile details saved locally.', 'info');
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col pb-28">

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: BACK ARROW + TITLE                                         */}
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
            Profile
          </h1>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl mx-auto px-4 pt-3 space-y-4 sm:space-y-5">

        {/* ======================================================================= */}
        {/* 2. PROFILE BANNER & AVATAR CARD (MATCHES REFERENCE DESIGN)               */}
        {/* ======================================================================= */}
        <div className="relative w-full rounded-[26px] sm:rounded-[30px] overflow-hidden bg-white border border-[#F4E3D8] shadow-xs">
          
          {/* Panoramic Top Campus Illustration Banner */}
          <div className="relative w-full aspect-[2.4/1] min-h-[145px] max-h-[210px] overflow-hidden bg-[#FEF9C3]">
            <img
              src="/profile-campus-footer.png"
              alt="SlotMate Campus Life"
              className="w-full h-full object-cover object-top select-none pointer-events-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Subtle soft gradient fade into the white profile card */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/95 via-white/40 to-transparent pointer-events-none" />
          </div>

          {/* Profile Details Area: Avatar on Left + Student Info on Right */}
          <div className="px-4 sm:px-6 pb-4 pt-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-start sm:items-end justify-between gap-3.5 sm:gap-4">
                
                {/* Circular Avatar on Left with Golden/Amber Border & Crown for Guest */}
                <div className="flex items-start sm:items-end gap-3.5 sm:gap-4 min-w-0">
                  <div className="relative -mt-12 min-[380px]:-mt-14 sm:-mt-16 shrink-0 z-10">
                    <div className="w-20 h-20 min-[380px]:w-24 min-[380px]:h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#F59E0B] shadow-md overflow-hidden bg-[#FFFBEB] flex items-center justify-center">
                      {isGuest ? (
                        <UserIcon className="w-10 h-10 sm:w-12 sm:h-12 text-[#9CA3AF] stroke-[1.8]" />
                      ) : (
                        <img
                          src={displayAvatar}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover select-none"
                          onError={(e) => {
                            e.currentTarget.src = '/image.png';
                          }}
                        />
                      )}
                    </div>

                    {/* Crown icon on bottom-left for guest, checkmark on bottom-right for verified */}
                    {isGuest ? (
                      <div className="absolute -bottom-1.5 -left-1 text-[#F59E0B] pointer-events-none select-none drop-shadow-xs">
                        <Crown className="w-5 h-5 fill-[#FBBF24] stroke-[#D97706] -rotate-12" />
                      </div>
                    ) : (
                      <div className="absolute bottom-0 right-0 w-6 h-6 min-[380px]:w-6.5 min-[380px]:h-6.5 rounded-full bg-[#16A34A] border-2 border-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                      </div>
                    )}
                  </div>

                  {/* Student Info on Right: Name + Verified Pill, College, Email */}
                  <div className="flex-1 min-w-0 pt-1 space-y-1">
                    {/* Row 1: Name + [✓ Verified Student] Green Pill */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-lg min-[380px]:text-xl sm:text-2xl text-[#17233C] tracking-tight leading-tight truncate">
                        {displayName}
                      </h2>
                      {isGuest ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] text-[11px] font-bold border border-[#FED7AA] whitespace-nowrap">
                          <ShieldAlert className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>Unverified</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16A34A] text-white text-[11px] min-[380px]:text-xs font-bold shadow-2xs whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Verified Student</span>
                        </div>
                      )}
                    </div>

                    {/* Row 2: College */}
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6E7587]">
                      <GraduationCap className="w-4 h-4 text-[#EAB308] stroke-[2.2] shrink-0" />
                      <span className="truncate">{isGuest ? 'Student • Unverified' : displayCollege}</span>
                    </div>

                    {/* Row 3: Email */}
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#6E7587]">
                      <Mail className="w-3.5 h-3.5 text-[#8C93A4] stroke-[2] shrink-0" />
                      <span className="truncate">{isGuest ? 'College Email • Unverified' : displayEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Edit Profile button for verified user */}
                {!isGuest && (
                  <div className="shrink-0 flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="inline-flex items-center gap-1.5 px-4 min-[380px]:px-5 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] font-black text-xs min-[380px]:text-sm shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Edit Profile</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Guest Mode: Full Width "Sign In to Complete Your Profile" Pill Button */}
              {isGuest && (
                <div className="w-full pt-1.5">
                  <button
                    type="button"
                    onClick={() => navigate('/auth?returnTo=/slotmate/profile')}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 sm:py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] hover:to-[#E63E15] active:scale-98 text-white font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                  >
                    <span>Sign In to Complete Your Profile</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 3. PROFILE STATISTICS (CLEAN UNIFORM 3 CARDS, NO FORCED HIGHLIGHT)       */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Card 1: Posts */}
          <div
            onClick={() => navigate('/slotmate/matches')}
            className="bg-white rounded-xl sm:rounded-2xl py-2 px-2.5 sm:py-2.5 border border-[#F4E3D8] shadow-2xs flex flex-col items-center text-center cursor-pointer active:scale-95 transition-all group hover:border-[#FACC15]"
          >
            <FileText className="w-4.5 h-4.5 text-[#D97706] stroke-[2.2] group-hover:scale-110 transition-transform" />
            <span className="font-black text-base sm:text-lg text-[#17233C] mt-0.5 leading-tight">
              {postsCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6E7587] leading-tight">Posts</span>
          </div>

          {/* Card 2: Matches (Uniform Clean Card) */}
          <div
            onClick={() => navigate('/slotmate/matches')}
            className="bg-white rounded-xl sm:rounded-2xl py-2 px-2.5 sm:py-2.5 border border-[#F4E3D8] shadow-2xs flex flex-col items-center text-center cursor-pointer active:scale-95 transition-all group hover:border-[#FACC15]"
          >
            <Users className="w-4.5 h-4.5 text-[#D97706] stroke-[2.2] group-hover:scale-110 transition-transform" />
            <span className="font-black text-base sm:text-lg text-[#17233C] mt-0.5 leading-tight">
              {matchesCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6E7587] leading-tight">Matches</span>
          </div>

          {/* Card 3: Courses (with GraduationCap Icon) */}
          <div
            onClick={() => navigate('/slotmate/matches')}
            className="bg-white rounded-xl sm:rounded-2xl py-2 px-2.5 sm:py-2.5 border border-[#F4E3D8] shadow-2xs flex flex-col items-center text-center cursor-pointer active:scale-95 transition-all group hover:border-[#FACC15]"
          >
            <GraduationCap className="w-5 h-5 text-[#D97706] stroke-[2.2] group-hover:scale-110 transition-transform" />
            <span className="font-black text-base sm:text-lg text-[#17233C] mt-0.5 leading-tight">
              {coursesCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#6E7587] leading-tight">Courses</span>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 4. PROFILE MENU CARD (2 ROWS: MATCHES, COURSES)                         */}
        {/* ======================================================================= */}
        <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden divide-y divide-[#F4E3D8]/60">
          {/* Row 1: My Slot Matches & Posts */}
          <div
            onClick={() => navigate('/slotmate/matches')}
            className="px-4 py-3.5 flex items-center justify-between hover:bg-[#FFFDF9] transition-colors cursor-pointer group active:bg-[#FEF9C3]/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <Users className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <span className="font-black text-xs sm:text-sm text-[#17233C]">
                My Matches by Course
              </span>
            </div>
            <ChevronRight className="w-4.5 h-4.5 text-[#17233C] stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
          </div>

          {/* Row 2: Create Slot Post */}
          <div
            onClick={() => navigate('/slotmate/create')}
            className="px-4 py-3.5 flex items-center justify-between hover:bg-[#FFFDF9] transition-colors cursor-pointer group active:bg-[#FEF9C3]/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <span className="font-black text-xs sm:text-sm text-[#17233C]">
                Publish New Post
              </span>
            </div>
            <ChevronRight className="w-4.5 h-4.5 text-[#17233C] stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 5. WHATSAPP CARD (SEPARATE ROUNDED CARD)                                */}
        {/* ======================================================================= */}
        <div
          onClick={handleOpenEdit}
          className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-3.5 sm:p-4 flex items-center justify-between hover:bg-[#FFFDF9] transition-colors cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#DCFCE7] flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
              <img
                src="/whatsapp.svg"
                alt="WhatsApp"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/whatsapp.png';
                }}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-xs sm:text-sm text-[#17233C] leading-tight">
                WhatsApp Number
              </span>
              <span className="text-xs text-[#475569] font-bold mt-0.5 truncate leading-tight">
                {displayWhatsApp}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isGuest ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F4F6] text-[#6E7587] text-xs font-bold border border-[#E5E7EB]">
                <span>Unverified</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-black border border-[#BBF7D0]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Verified</span>
              </div>
            )}
            <ChevronRight className="w-4.5 h-4.5 text-[#17233C] stroke-[2.2] group-hover:translate-x-0.5 transition-transform ml-1" />
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 6. LOGOUT BUTTON FOR AUTHENTICATED USERS (HIDDEN FOR GUESTS)             */}
        {/* ======================================================================= */}
        {!isGuest && (
          <div className="pt-2 pb-2 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full max-w-xs py-2.5 px-6 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <LogOut className="w-4 h-4 stroke-[2.4]" />
              <span>Log Out</span>
            </button>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 7. FOOTER DECORATIVE ILLUSTRATION (NO SIGN OUT / NO EXTRA SCROLL)         */}
        {/* ======================================================================= */}
        <div className="relative -mx-4 pt-3 pb-0 overflow-hidden select-none -mb-px">
          <img
            src="/profile-campus-footer.png"
            alt="Helpu Campus Students Illustration"
            className="w-full h-auto max-h-[240px] object-contain mx-auto block pointer-events-none"
            loading="lazy"
          />
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 7. EDIT PROFILE MODAL                                                     */}
      {/* ========================================================================= */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[#F4E3D8] shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                  <Pencil className="w-4 h-4 stroke-[2.4]" />
                </div>
                <h3 className="font-black text-base text-[#17233C]">
                  Edit SlotMate Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-[#FFF8F3] text-[#6E7587] flex items-center justify-center font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-black text-[#17233C]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] focus:border-[#FACC15] focus:outline-none text-xs sm:text-sm font-bold text-[#17233C]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-[#17233C]">
                  College / University
                </label>
                <input
                  type="text"
                  value={editCollege}
                  onChange={(e) => setEditCollege(e.target.value)}
                  placeholder="e.g. VIT, Bhopal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] focus:border-[#FACC15] focus:outline-none text-xs sm:text-sm font-bold text-[#17233C]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black text-[#17233C]">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  value={editWhatsApp}
                  onChange={(e) => setEditWhatsApp(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] focus:border-[#FACC15] focus:outline-none text-xs sm:text-sm font-bold text-[#17233C]"
                />
              </div>

              {saveError && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{saveError}</span>
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-full border border-[#F4E3D8] text-xs font-bold text-[#6E7587]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] font-black text-xs shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. BOTTOM NAVIGATION: 5 ITEMS WITH PROFILE ACTIVE                         */}
      {/* ========================================================================= */}
      <SlotMateBottomNav active="profile" />

    </div>
  );
}
