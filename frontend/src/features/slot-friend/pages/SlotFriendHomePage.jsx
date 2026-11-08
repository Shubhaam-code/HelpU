import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Calendar, Clock, BookOpen, GraduationCap, 
  ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { ServiceSwitcher } from '../../../components/layout/ServiceSwitcher';
import { useSlotFriend } from '../context/SlotFriendContext';
import { Avatar } from '../../../components/ui/Avatar';

export default function SlotFriendHomePage() {
  const navigate = useNavigate();
  const { myPosts, allMatches } = useSlotFriend();

  // Top 3 sample matches to highlight on the landing page
  const sampleMatches = allMatches.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
      <SlotFriendHeader 
        title="SlotMate" 
        subtitle="Find your study partner studying the same subject & slot"
      />

      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">

        {/* ========================================================================= */}
        {/* FLIPKART-STYLE TOP SERVICE SWITCHER: [ PoolMate ]   [ SlotMate ]          */}
        {/* ========================================================================= */}
        <ServiceSwitcher activeService="slotmate" />

        {/* ========================================================================= */}
        {/* 1. HERO SERVICE BANNER                                                   */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-4 sm:p-6"
        >
          {/* Subtle warm glow background */}
          <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-[#EAF5FF]/60 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
            <div className="max-w-xl space-y-2">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF5FF] border border-[#BAE6FD] text-[#0284C7] text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Academic Peer Matching</span>
              </div>

              <h1 className="font-black text-[#17233C] text-xl sm:text-2xl md:text-3xl tracking-tight leading-tight">
                Slot<span className="text-[#0284C7]">Mate</span>
              </h1>

              <p className="text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed">
                Connect with fellow students studying the <strong>exact same subject in the same slot</strong>. 
                Compare lecture notes, clarify assignment doubts, prepare for exams, and find your study partner!
              </p>

              {/* Primary & Secondary Action CTAs */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/slot-friend/matches')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-[#0284C7] hover:bg-[#0369A1] active:scale-95 text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#0284C7]/25 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4 stroke-[2.5]" />
                  <span>Find Partners ({allMatches.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/slot-friend/create')}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white hover:bg-[#F0F9FF] active:scale-95 border border-[#BAE6FD] hover:border-[#0284C7]/40 text-[#17233C] rounded-full font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#0284C7] stroke-[2.5]" />
                  <span>Create My Slot Post</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Pill Panel */}
            <div className="w-full md:w-auto shrink-0 grid grid-cols-2 gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[#F4E3D8]/60">
              <div 
                onClick={() => navigate('/slot-friend/my-posts')}
                className="bg-[#FFF8F3] hover:bg-[#FFF2EB] border border-[#F4E3D8] rounded-2xl p-3 text-center cursor-pointer transition-colors"
              >
                <span className="block font-black text-xl sm:text-2xl text-[#17233C]">
                  {myPosts.length}
                </span>
                <span className="text-[11px] font-bold text-[#6E7587]">
                  My Slot Posts
                </span>
              </div>

              <div 
                onClick={() => navigate('/slot-friend/matches')}
                className="bg-[#EDFAF3] hover:bg-[#E0F7EB] border border-[#BCECD4] rounded-2xl p-3 text-center cursor-pointer transition-colors"
              >
                <span className="block font-black text-xl sm:text-2xl text-[#16A34A]">
                  {allMatches.length}
                </span>
                <span className="text-[11px] font-bold text-[#16A34A]">
                  Active Matches
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 2. HOW SLOT FRIEND MATCHING WORKS (3 STEPS)                              */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center font-black text-xs">
              1
            </div>
            <h3 className="font-black text-xs sm:text-sm text-[#17233C]">
              Post Course & Slot
            </h3>
            <p className="text-[11px] text-[#6E7587] leading-relaxed">
              Select your registered subject and theoretical or lab slot (e.g. B1, A2).
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center font-black text-xs">
              2
            </div>
            <h3 className="font-black text-xs sm:text-sm text-[#17233C]">
              Instant Smart Match
            </h3>
            <p className="text-[11px] text-[#6E7587] leading-relaxed">
              We match you with all students registered in the same subject and slot.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0284C7] flex items-center justify-center font-black text-xs">
              3
            </div>
            <h3 className="font-black text-xs sm:text-sm text-[#17233C]">
              Study & Prep Together
            </h3>
            <p className="text-[11px] text-[#6E7587] leading-relaxed">
              Reach out on WhatsApp, share notes, compare assignments, and attend class together.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SAMPLE COMPATIBLE MATCHES SHOWCASE                                     */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 fill-[#FF572E]/10 stroke-[2.4]" />
              </div>
              <h2 className="font-black text-sm sm:text-base text-[#17233C]">
                Compatible Student Matches
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate('/slot-friend/matches')}
              className="text-xs font-black text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All ({allMatches.length})</span>
              <ArrowRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          {sampleMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sampleMatches.map((student) => (
                <div
                  key={student.id}
                  onClick={() => navigate(`/slot-friend/student/${student.id}`)}
                  className="p-3.5 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    {/* Top: Avatar + Name + Verified */}
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        avatarId={student.avatarId || 'm1'}
                        size="sm"
                        name={student.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="font-black text-xs sm:text-sm text-[#17233C] truncate group-hover:text-[#FF572E] transition-colors">
                            {student.name}
                          </h4>
                          {student.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#6E7587] truncate font-medium">
                          {student.department} • {student.year}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Course & Slot Chips */}
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[10px] font-black">
                        <CheckCircle2 className="w-3 h-3 stroke-[2.4]" />
                        <span>{student.matchBadge}</span>
                      </div>

                      <div className="text-[11px] font-bold text-[#17233C] line-clamp-1">
                        {student.course}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#6E7587]">
                        <span className="font-black text-[#FF572E] bg-[#FFF0E6] px-1.5 py-0.2 rounded">
                          Slot {student.slot}
                        </span>
                        <span className="truncate">
                          Faculty: {student.teacher.split('(')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: View Profile Action */}
                  <div className="pt-2 border-t border-[#F4E3D8]/60 flex items-center justify-between text-[11px] font-bold text-[#FF572E]">
                    <span>View Student Profile</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#6E7587] font-medium">
              No matches found for your current posts yet. Create a slot post to discover friends!
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. CURRENT STUDENT ACTIVE POSTS PREVIEW                                    */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EAF5FF] text-[#0284C7] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 stroke-[2.4]" />
              </div>
              <h2 className="font-black text-sm sm:text-base text-[#17233C]">
                My Published Slot Posts ({myPosts.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate('/slot-friend/my-posts')}
              className="text-xs font-black text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Manage Posts</span>
              <ArrowRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-2">
            {myPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => navigate('/slot-friend/my-posts')}
                className="p-3 rounded-2xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#FFF0E6] text-[#FF572E] font-black text-[11px] border border-[#FDD0BE]">
                      Slot {post.slot}
                    </span>
                    <h3 className="font-black text-xs sm:text-sm text-[#17233C] truncate">
                      {post.course}
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#6E7587] font-medium truncate">
                    Teacher: {post.teacher}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                  <span className="text-xs font-bold text-[#FF572E] hover:underline">
                    Find Matches →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

