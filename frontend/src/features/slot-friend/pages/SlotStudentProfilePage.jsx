import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Check, User, 
  GraduationCap, Calendar, FileText, Sparkles, Loader2 
} from 'lucide-react';
import { useSlotMatchDetails } from '../../../hooks/useAppData';

export default function SlotStudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { data: student, isLoading } = useSlotMatchDetails(studentId);

  if (isLoading) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#FFFDF9] flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-8 h-8 text-[#D97706] animate-spin mb-2" />
        <p className="text-xs font-bold text-[#6E7587]">Loading student profile...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen min-h-dvh bg-[#FFFDF9] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center text-2xl mb-3">
          ⚠️
        </div>
        <h2 className="font-black text-lg text-[#17233C]">Match Not Found</h2>
        <p className="text-xs text-[#6E7587] max-w-xs mt-1 mb-4">
          This match profile may have been removed or updated.
        </p>
        <button
          type="button"
          onClick={() => navigate('/slotmate/matches')}
          className="px-5 py-2.5 bg-[#FACC15] text-[#17233C] font-black text-xs rounded-full shadow-xs cursor-pointer"
        >
          Back to Matches
        </button>
      </div>
    );
  }

  const rawPhone = student.whatsappNumber || student.phone || '9876543210';
  const cleanPhone = rawPhone.replace(/\D/g, '');

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const studentName = student.studentName || 'Classmate';
  const teacherName = student.teacherName ? student.teacherName.split('(')[0].trim() : 'Faculty';
  const courseDisplay = student.courseCode && student.courseName 
    ? `${student.courseCode} – ${student.courseName}`
    : (student.courseName || student.courseCode || 'Course');

  return (
    <div className="min-h-screen min-h-dvh bg-[#FFFDF9] text-[#17233C] flex flex-col">
      {/* ========================================================================= */}
      {/* 1. HEADER: BACK ARROW + MATCH DETAILS TITLE + THREE-DOT MENU             */}
      {/* ========================================================================= */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-[#17233C] hover:bg-white rounded-xl transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#17233C] stroke-[2.4]" />
          </button>
          <h1 className="font-black text-[#17233C] text-lg sm:text-xl tracking-tight">
            Match Details
          </h1>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="w-full max-w-xl mx-auto px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-4 flex-1">
        {/* ======================================================================= */}
        {/* 2. PROFILE HEADER CARD (WARM YELLOW GRADIENT)                           */}
        {/* ======================================================================= */}
        <div className="relative w-full rounded-[26px] overflow-hidden bg-gradient-to-br from-[#FEF9C3] via-[#FEF08A]/60 to-[#FFFBEB] border border-[#FDE68A] p-4 sm:p-5 shadow-xs">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/40 to-transparent pointer-events-none rounded-full" />

          <div className="relative z-10 flex items-center gap-4">
            {/* Avatar with Sunburst & Active Green Dot */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border-3 border-white shadow-md overflow-hidden bg-white">
                <img
                  src={student.profileImage || '/image.png'}
                  alt={studentName}
                  className="w-full h-full object-cover select-none"
                  onError={(e) => {
                    e.currentTarget.src = '/image.png';
                  }}
                />
              </div>

              {/* Sunburst Mark at Top-Right */}
              <div className="absolute -top-1 -right-1 text-[#F59E0B]">
                <Sparkles className="w-5 h-5 text-[#F59E0B] fill-[#FACC15]" />
              </div>

              {/* Active Online Green Dot at Bottom-Right */}
              <div className="absolute bottom-0 right-1 w-4 h-4 rounded-full bg-[#22C55E] border-2 border-white shadow-xs" />
            </div>

            {/* Student Info: Verified Badge + Name + Teacher */}
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-black border border-[#BBF7D0] shadow-2xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Verified Student</span>
              </div>

              <h2 className="font-black text-xl sm:text-2xl text-[#17233C] tracking-tight leading-tight mt-1.5 truncate">
                {studentName}
              </h2>

              <p className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6E7587] mt-1 truncate">
                <User className="w-4 h-4 text-[#6E7587] shrink-0" />
                <span>{teacherName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 3. POST & COURSE DETAILS CARD                                           */}
        {/* ======================================================================= */}
        <div className="bg-white rounded-[26px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs">
          <div className="space-y-3.5">
            {/* Card Title */}
          <div className="flex items-center gap-2 pb-2 border-b border-[#F4E3D8]/60">
            <GraduationCap className="w-5 h-5 text-[#D97706] stroke-[2.2]" />
            <h3 className="font-black text-sm sm:text-base text-[#17233C] tracking-tight">
              Post &amp; Course Details
            </h3>
          </div>

          {/* Row 1: Course */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
              <span className="text-xs text-[#6E7587] font-bold w-14 shrink-0">Course</span>
              <span className="font-black text-xs sm:text-sm text-[#17233C] text-right truncate">
                {courseDisplay}
              </span>
            </div>
          </div>

          {/* Row 2: Slot */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#F4E3D8]/60">
            <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Calendar className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
              <span className="text-xs text-[#6E7587] font-bold w-14 shrink-0">Slot</span>
              <span className="font-black text-xs sm:text-sm text-[#78350F] bg-[#FEF08A] px-2.5 py-0.5 rounded-md">
                {student.slot}
              </span>
            </div>
          </div>

          {/* Row 3: Teacher */}
          <div className="flex items-center gap-3 pt-2 border-t border-[#F4E3D8]/60">
            <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <User className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
              <span className="text-xs text-[#6E7587] font-bold w-14 shrink-0">Teacher</span>
              <span className="font-black text-xs sm:text-sm text-[#17233C] text-right truncate">
                {teacherName}
              </span>
            </div>
          </div>

            {/* Row 4: Post Note */}
            <div className="space-y-1.5 pt-2 border-t border-[#F4E3D8]/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <span className="text-xs text-[#6E7587] font-bold">Post Note</span>
              </div>

              <div className="bg-[#FEFCE8] border border-[#FEF08A] rounded-2xl p-3 sm:p-3.5 text-xs sm:text-sm text-[#17233C] font-medium leading-relaxed">
                {student.additionalNotes || 'Looking for classmates in the same slot to discuss, solve assignments and prepare for exams together.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="mt-5 w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FACC15] via-[#FBBF24] to-[#F59E0B] hover:brightness-105 active:scale-98 text-[#17233C] font-black text-sm sm:text-base shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <img
              src="/whatsapp.svg"
              alt="WhatsApp"
              className="w-5 h-5 object-contain"
              onError={(e) => {
                e.currentTarget.src = '/whatsapp.png';
              }}
            />
            <span>Contact on WhatsApp</span>
          </button>
        </div>
      </main>
    </div>
  );
}
