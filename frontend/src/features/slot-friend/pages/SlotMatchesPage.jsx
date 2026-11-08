import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, Search, ShieldCheck, CheckCircle2, BookOpen, Clock, 
  ArrowRight, Filter, AlertCircle, Sparkles, UserCheck 
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { useSlotFriend } from '../context/SlotFriendContext';
import { Avatar } from '../../../components/ui/Avatar';

export default function SlotMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseFilterParam = searchParams.get('course');
  const slotFilterParam = searchParams.get('slot');

  const { myPosts, allMatches } = useSlotFriend();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState(slotFilterParam || 'ALL');

  // Filtered Matches
  const displayedMatches = useMemo(() => {
    return allMatches.filter((student) => {
      // 1. Slot Filter
      if (selectedSlotFilter !== 'ALL' && student.slot !== selectedSlotFilter) {
        return false;
      }

      // 2. Course Param Filter (if provided from a specific post link)
      if (courseFilterParam && student.course !== courseFilterParam) {
        return false;
      }

      // 3. Search Query Filter (name, faculty, course, branch)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesFaculty = student.teacher.toLowerCase().includes(q);
        const matchesCourse = student.course.toLowerCase().includes(q);
        const matchesDept = (student.department || '').toLowerCase().includes(q);
        return matchesName || matchesFaculty || matchesCourse || matchesDept;
      }

      return true;
    });
  }, [allMatches, selectedSlotFilter, courseFilterParam, searchQuery]);

  // Distinct slots available in user's posts
  const availableUserSlots = useMemo(() => {
    const set = new Set(myPosts.map((p) => p.slot));
    return Array.from(set);
  }, [myPosts]);

  return (
    <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
      <SlotFriendHeader 
        title="Slot Friend Matches" 
        subtitle="All students studying in your exact course and slot"
        backTo="/slot-friend"
      />

      <div className="max-w-5xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">

        {/* Top Matching Rule Banner */}
        <div className="bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <h2 className="font-black text-xs sm:text-sm text-[#17233C]">
                Matching Rule: Same Course + Same Slot
              </h2>
              <p className="text-[11px] text-[#6E7587] font-medium">
                Faculty can be same or different. Every compatible student is shown below.
              </p>
            </div>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#FFF0E6] text-[#FF572E] text-xs font-black border border-[#FDD0BE] self-start sm:self-auto shrink-0">
            {displayedMatches.length} Compatible {displayedMatches.length === 1 ? 'Student' : 'Students'}
          </div>
        </div>

        {/* Search & Slot Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, faculty, or course..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#F4E3D8] text-xs sm:text-sm font-semibold text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15 shadow-2xs"
            />
          </div>

          {/* Slot Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedSlotFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                selectedSlotFilter === 'ALL'
                  ? 'bg-[#17233C] text-white shadow-2xs'
                  : 'bg-white text-[#6E7587] border border-[#F4E3D8] hover:text-[#17233C]'
              }`}
            >
              All Slots
            </button>
            {availableUserSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlotFilter(slot)}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                  selectedSlotFilter === slot
                    ? 'bg-[#FF572E] text-white shadow-2xs'
                    : 'bg-white text-[#6E7587] border border-[#F4E3D8] hover:text-[#17233C]'
                }`}
              >
                Slot {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Active Filter Indicator */}
        {courseFilterParam && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] text-xs">
            <span className="text-[#6E7587] font-medium truncate">
              Showing matches specifically for: <strong className="text-[#17233C]">{courseFilterParam}</strong>
            </span>
            <button
              type="button"
              onClick={() => navigate('/slot-friend/matches')}
              className="text-[#FF572E] font-black hover:underline ml-2 shrink-0 cursor-pointer"
            >
              Clear Filter ✕
            </button>
          </div>
        )}

        {/* Matches Grid */}
        {displayedMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedMatches.map((student) => {
              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/slot-friend/student/${student.id}`)}
                  className="bg-white rounded-[24px] border border-[#F4E3D8] p-4 sm:p-5 shadow-xs hover:border-[#FF572E]/40 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar + Name + Compatibility Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          avatarId={student.avatarId || 'm1'}
                          size="md"
                          name={student.name}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-sm sm:text-base text-[#17233C] truncate group-hover:text-[#FF572E] transition-colors">
                              {student.name}
                            </h3>
                            {student.isVerified && (
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#6E7587] font-medium truncate">
                            {student.department} • {student.year}
                          </p>
                        </div>
                      </div>

                      {/* Slot Badge */}
                      <span className="shrink-0 px-2.5 py-1 rounded-xl bg-[#FFF0E6] text-[#FF572E] font-black text-xs border border-[#FDD0BE]">
                        Slot {student.slot}
                      </span>
                    </div>

                    {/* Compatibility Match Tag */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        student.isSameTeacher
                          ? 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]'
                          : 'bg-[#FFF8F3] text-[#FF572E] border-[#FDD0BE]'
                      }`}>
                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                        <span>{student.matchBadge}</span>
                      </span>

                      <span className="text-[10px] font-semibold text-[#8C93A4]">
                        • Active in your timetable
                      </span>
                    </div>

                    {/* Academic Course Box */}
                    <div className="p-3 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[#17233C] font-black truncate">
                        <BookOpen className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                        <span className="truncate">{student.course}</span>
                      </div>

                      <div className="text-[11px] text-[#6E7587] flex items-center justify-between gap-2">
                        <span className="truncate">
                          <strong>Teacher:</strong> {student.teacher}
                        </span>
                        {student.isSameTeacher ? (
                          <span className="text-[10px] font-black text-[#16A34A] bg-[#EDFAF3] px-1.5 py-0.2 rounded shrink-0">
                            Identical Faculty
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[#8C93A4] shrink-0">
                            Different Faculty
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Short Bio / Study Goals Preview */}
                    {student.bio && (
                      <p className="text-xs text-[#6E7587] font-medium line-clamp-2 italic leading-relaxed">
                        "{student.bio}"
                      </p>
                    )}
                  </div>

                  {/* Bottom Bar: Action */}
                  <div className="pt-2.5 border-t border-[#F4E3D8]/60 flex items-center justify-between text-xs font-black text-[#FF572E]">
                    <span>View Student Profile & Connect</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Empty Search / Filter State */
          <div className="bg-white rounded-[24px] p-8 border border-[#F4E3D8] text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mx-auto text-xl">
              🔍
            </div>
            <h3 className="font-black text-base text-[#17233C]">
              No matching students found
            </h3>
            <p className="text-xs text-[#6E7587] max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `No students found matching "${searchQuery}". Try searching by another keyword.`
                : 'Create another slot post to expand your peer circle and discover more batchmates!'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 rounded-full border border-[#F4E3D8] text-xs font-bold text-[#17233C] hover:bg-[#FFF8F3] cursor-pointer"
              >
                Clear Search Query
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/slot-friend/create')}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-full font-black text-xs shadow-xs cursor-pointer"
              >
                <span>Add Another Slot Post</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

