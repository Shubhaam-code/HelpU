import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ShieldCheck, CheckCircle2, BookOpen, Clock, 
  GraduationCap, Calendar, MessageCircle, Sparkles, MapPin, 
  HelpCircle, Share2, Info 
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { useSlotFriend } from '../context/SlotFriendContext';
import { Avatar } from '../../../components/ui/Avatar';

export default function SlotStudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { getStudentById, showToast } = useSlotFriend();

  const student = getStudentById(studentId);

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  if (!student) {
    return (
      <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
        <SlotFriendHeader title="Student Profile" backTo="/slot-friend/matches" />
        <div className="max-w-md mx-auto px-4 pt-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl">
            ⚠️
          </div>
          <h2 className="font-black text-lg text-[#17233C]">Student Not Found</h2>
          <p className="text-xs text-[#6E7587]">
            This student profile may have expired or was removed.
          </p>
          <button
            type="button"
            onClick={() => navigate('/slot-friend/matches')}
            className="px-5 py-2.5 bg-[#FF572E] text-white rounded-full font-bold text-xs"
          >
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  const handleWhatsAppClick = () => {
    setShowWhatsAppModal(true);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
      <SlotFriendHeader 
        title={`${student.name}'s Profile`}
        subtitle="Slot Friend Connection Details"
        backTo="/slot-friend/matches"
      />

      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">

        {/* ========================================================================= */}
        {/* 1. STUDENT IDENTITY HERO CARD                                             */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] p-5 sm:p-7 shadow-xs space-y-5"
        >
          {/* Avatar + Main Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
            <div className="relative">
              <Avatar
                avatarId={student.avatarId || 'm1'}
                size="xl"
                name={student.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#FFEBE0] shadow-sm"
              />
              {student.isVerified && (
                <div 
                  title="Verified VIT Student"
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-xs border border-emerald-200"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="font-black text-lg sm:text-2xl text-[#17233C] tracking-tight">
                  {student.name}
                </h1>
                {student.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]">
                    <ShieldCheck className="w-3 h-3 stroke-[2.4]" />
                    <span>Verified Student</span>
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm font-semibold text-[#6E7587]">
                {student.department} • {student.year}
              </p>

              <p className="text-xs text-[#8C93A4] font-medium flex items-center justify-center sm:justify-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
                <span>{student.college || 'VIT, Bhopal Campus'}</span>
              </p>
            </div>

            {/* Slot Badge */}
            <div className="shrink-0 px-3.5 py-2 rounded-2xl bg-[#FFF0E6] border border-[#FDD0BE] text-[#FF572E] text-center">
              <span className="block font-black text-sm sm:text-base">
                Slot {student.slot}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF572E]/80">
                Registered
              </span>
            </div>
          </div>

          {/* Student Bio */}
          {student.bio && (
            <div className="p-3.5 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] text-xs text-[#17233C] font-medium leading-relaxed">
              <span className="font-black text-[#8C93A4] text-[10px] uppercase block mb-1">
                About & Study Style
              </span>
              "{student.bio}"
            </div>
          )}

          {/* Academic Interests / Topics */}
          {student.interests && student.interests.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block">
                Focus Areas & Topics
              </span>
              <div className="flex flex-wrap gap-1.5">
                {student.interests.map((topic) => (
                  <span
                    key={topic}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF8F3] border border-[#F4E3D8] text-xs font-bold text-[#17233C]"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ========================================================================= */}
        {/* 2. MUTUAL ACADEMIC MATCH DETAILS                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F4E3D8]/60">
            <div className="w-7 h-7 rounded-lg bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
            </div>
            <h2 className="font-black text-sm sm:text-base text-[#17233C]">
              Why You Two Match (Exact Course & Slot)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Registered Course */}
            <div className="p-3.5 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] space-y-1">
              <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block">
                Mutual Registered Course
              </span>
              <p className="font-black text-xs sm:text-sm text-[#17233C]">
                {student.course}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold inline-block">
                ✓ Identical Course Syllabus & Tests
              </span>
            </div>

            {/* Timetable Slot */}
            <div className="p-3.5 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] space-y-1">
              <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block">
                Class Timetable Slot
              </span>
              <p className="font-black text-xs sm:text-sm text-[#FF572E]">
                Slot {student.slot}
              </p>
              <span className="text-[10px] text-[#6E7587] font-medium inline-block">
                Same class hours & lecture schedule
              </span>
            </div>

            {/* Faculty Comparison */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-[#FFF8F3] border border-[#FDD0BE] space-y-1.5">
              <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block">
                Faculty Instructor Comparison
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[#8C93A4]">Their Teacher: </span>
                  <strong className="text-[#17233C]">{student.teacher}</strong>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border self-start sm:self-auto ${
                  student.isSameTeacher
                    ? 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]'
                    : 'bg-[#FFF0E6] text-[#FF572E] border-[#FDD0BE]'
                }`}>
                  {student.isSameTeacher ? 'Identical Instructor' : 'Different Instructor (Same Curriculum)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. VISUALLY PROMINENT WHATSAPP CONNECT ACTION                            */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-[#128C7E]/10 via-[#25D366]/5 to-transparent rounded-[24px] sm:rounded-[28px] border border-[#25D366]/30 p-5 sm:p-6 shadow-xs space-y-3.5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F8F0] border border-[#25D366]/40 text-[#128C7E] text-[10px] font-black uppercase tracking-wider">
              <span>💬 Direct Campus Connect</span>
            </div>
            <h3 className="font-black text-sm sm:text-base text-[#17233C]">
              Connect with {student.name.split(' ')[0]} on WhatsApp
            </h3>
            <p className="text-xs text-[#6E7587] leading-relaxed">
              Introduce yourself, exchange lecture notes, sit together in Slot {student.slot}, and prepare for exams!
            </p>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#25D366] hover:bg-[#20BD5A] active:scale-95 text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#25D366]/30 transition-all cursor-pointer shrink-0"
          >
            <MessageCircle className="w-5 h-5 fill-white stroke-none" />
            <span>Connect on WhatsApp</span>
          </button>
        </div>

      </div>

      {/* WhatsApp Connect Modal Placeholder */}
      <AnimatePresence>
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhatsAppModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[28px] p-6 border border-[#F4E3D8] shadow-2xl max-w-md w-full space-y-4 z-10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-[#E8F8F0] text-[#25D366] flex items-center justify-center mx-auto text-2xl shadow-xs">
                💬
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-base sm:text-lg text-[#17233C]">
                  Connect with {student.name}
                </h3>
                <p className="text-xs text-[#6E7587]">
                  Slot Friend WhatsApp Direct Connect Placeholder
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFF8F3] border border-[#F4E3D8] text-xs space-y-1 text-left">
                <div className="flex justify-between text-[#6E7587]">
                  <span>Student Phone:</span>
                  <span className="font-bold text-[#17233C]">{student.phone}</span>
                </div>
                <div className="flex justify-between text-[#6E7587]">
                  <span>Mutual Slot:</span>
                  <span className="font-bold text-[#FF572E]">Slot {student.slot}</span>
                </div>
                <div className="flex justify-between text-[#6E7587]">
                  <span>Subject:</span>
                  <span className="font-bold text-[#17233C] truncate max-w-[180px]">{student.course}</span>
                </div>
              </div>

              <p className="text-[11px] text-[#8C93A4] leading-relaxed">
                In production, tapping continue will safely open WhatsApp with a pre-composed greeting mentioning your mutual <strong>Slot {student.slot}</strong> class!
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-4 py-2.5 rounded-full border border-[#F4E3D8] text-xs font-bold text-[#6E7587] hover:bg-[#FFF8F3] cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowWhatsAppModal(false);
                    showToast(`Simulated WhatsApp chat opened with ${student.name}!`, 'success');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Chat (Mock)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

