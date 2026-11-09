import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit3, Trash2, Users, BookOpen, Clock, 
  Calendar, CheckCircle2, AlertTriangle, ArrowRight, Loader2
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { useSlotFriend } from '../context/SlotFriendContext';
import { SlotMateBottomNav } from '../components/SlotMateBottomNav';

export default function MySlotPostsPage() {
  const navigate = useNavigate();
  const { myPosts = [], deletePost, isLoadingPosts } = useSlotFriend();

  const [deletingPostId, setDeletingPostId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const postToDelete = deletingPostId ? myPosts.find((p) => p.id === deletingPostId || p._id === deletingPostId) : null;

  const handleConfirmDelete = async () => {
    if (deletingPostId) {
      setIsDeleting(true);
      try {
        await deletePost(deletingPostId);
        setDeletingPostId(null);
      } catch (err) {
        console.error('Failed to delete post:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-24 md:pb-16 text-[#17233C]">
      <SlotFriendHeader 
        title="My Slot Posts" 
        subtitle="Manage your registered courses and find peers studying in the same slot"
        backTo="/slotmate"
      />

      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">

        {/* Top Header Card with My Posts Illustration on Left */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-br from-[#FEF9C3] via-[#FEF08A]/50 to-[#FFFBEB] rounded-[24px] p-4 sm:p-5 border border-[#FDE68A] shadow-2xs">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
              <img
                src="/slot-post-illustration.png"
                alt="My Posts"
                className="w-full h-full object-contain select-none pointer-events-none drop-shadow-sm"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-sm sm:text-base text-[#17233C]">
                Your Published Courses ({myPosts.length})
              </h2>
              <p className="text-[11px] text-[#6E7587] font-medium mt-0.5 leading-relaxed">
                Each post automatically discovers all peers registered in the identical course and slot.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/slotmate/create')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#FACC15] hover:bg-[#EAB308] active:scale-95 text-[#17233C] rounded-full font-black text-xs shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add New Slot</span>
          </button>
        </div>

        {/* Posts List */}
        {isLoadingPosts ? (
          <div className="bg-white rounded-[24px] p-12 border border-[#F4E3D8] text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#D97706] animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#6E7587]">Loading your published courses...</p>
          </div>
        ) : myPosts.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {myPosts.map((post) => {
              const postId = post.id || post._id;
              const courseCode = post.courseCode || post.course?.split(/[-–]/)?.[0]?.trim();
              const courseName = post.courseName || post.course?.split(/[-–]/)?.[1]?.trim() || courseCode;
              const teacherName = post.teacherName || post.teacher || 'Faculty';
              const matchCount = post.matchCount ?? 0;

              return (
                <motion.div
                  key={postId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[24px] border border-[#F4E3D8] p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-[#FACC15] transition-all"
                >
                  {/* Top Bar: Course Name + Slot Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FEF08A] text-[#78350F] font-black text-xs border border-[#FDE68A] shadow-2xs">
                          Slot {post.slot}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[10px] font-black">
                          ● Active Post
                        </span>
                      </div>

                      <h3 className="font-black text-sm sm:text-base text-[#17233C] leading-snug">
                        {courseCode} – {courseName}
                      </h3>
                    </div>

                    {/* Quick Match Count Pill */}
                    <div 
                      onClick={() => navigate(`/slotmate/matches?postId=${postId}&course=${encodeURIComponent(courseCode)}&slot=${encodeURIComponent(post.slot)}`)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0] text-[#16A34A] text-center cursor-pointer hover:bg-[#BBF7D0]/50 transition-colors"
                    >
                      <span className="block font-black text-sm sm:text-base leading-none">
                        {matchCount}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-tight">
                        {matchCount === 1 ? 'Match' : 'Matches'}
                      </span>
                    </div>
                  </div>

                  {/* Faculty & Details */}
                  <div className="p-3 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[#8C93A4] block uppercase">
                        Faculty / Instructor
                      </span>
                      <span className="font-bold text-[#17233C]">
                        {teacherName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[#8C93A4] block uppercase">
                        Matching Criteria
                      </span>
                      <span className="font-medium text-[#6E7587]">
                        Same course + Slot {post.slot} (Any Faculty)
                      </span>
                    </div>

                    {post.additionalNotes && (
                      <div className="sm:col-span-2 pt-1.5 border-t border-[#F4E3D8]/50">
                        <span className="text-[10px] font-bold text-[#8C93A4] block uppercase">
                          Study Goal / Note
                        </span>
                        <p className="text-[#6E7587] font-medium italic mt-0.5">
                          "{post.additionalNotes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-[#F4E3D8]/60 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/slotmate/matches?postId=${postId}&course=${encodeURIComponent(courseCode)}&slot=${encodeURIComponent(post.slot)}`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#17233C] hover:bg-[#253658] text-white text-xs font-black transition-all cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-[#FACC15]" />
                      <span>View {matchCount} Compatible Peers</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => navigate(`/slotmate/create?edit=${postId}`)}
                        className="p-2 rounded-xl border border-[#F4E3D8] hover:border-[#FACC15] hover:bg-[#FFF8F3] text-[#17233C] text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Edit slot post"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#D97706]" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeletingPostId(postId)}
                        className="p-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Delete slot post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-[24px] p-8 border border-[#F4E3D8] text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mx-auto text-xl">
              📚
            </div>
            <h3 className="font-black text-sm sm:text-base text-[#17233C]">No Published Courses Yet</h3>
            <p className="text-xs text-[#6E7587] max-w-xs mx-auto">
              You haven't posted any timetable slots yet. Publish your registered course and slot to discover study buddies.
            </p>
            <button
              type="button"
              onClick={() => navigate('/slotmate/create')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#FACC15] hover:bg-[#EAB308] text-[#17233C] text-xs font-black rounded-full shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Publish First Course</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingPostId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[24px] p-5 max-w-sm w-full border border-[#F4E3D8] shadow-xl space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-black text-base text-[#17233C]">Remove Slot Post?</h3>
              <p className="text-xs text-[#6E7587]">
                Are you sure you want to remove your post for{' '}
                <strong className="text-[#17233C]">
                  {postToDelete?.courseCode || postToDelete?.course || 'this course'}
                </strong>{' '}
                (Slot {postToDelete?.slot})? Peers will no longer match with this post.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingPostId(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl border border-[#F4E3D8] text-xs font-bold text-[#6E7587] hover:bg-[#FFFDF9]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SlotMateBottomNav active="post" />
    </div>
  );
}
