import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit3, Trash2, Users, BookOpen, Clock, 
  Calendar, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw 
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { useSlotFriend } from '../context/SlotFriendContext';

export default function MySlotPostsPage() {
  const navigate = useNavigate();
  const { myPosts, deletePost, resetDemoPosts, computeMatches } = useSlotFriend();

  const [deletingPostId, setDeletingPostId] = useState(null);

  const postToDelete = deletingPostId ? myPosts.find((p) => p.id === deletingPostId) : null;

  const handleConfirmDelete = () => {
    if (deletingPostId) {
      deletePost(deletingPostId);
      setDeletingPostId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
      <SlotFriendHeader 
        title="My Slot Posts" 
        subtitle="Manage your registered courses and find peers studying in the same slot"
        backTo="/slot-friend"
      />

      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">

        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-[#F4E3D8] shadow-2xs">
          <div>
            <h2 className="font-black text-sm sm:text-base text-[#17233C]">
              Your Published Courses ({myPosts.length})
            </h2>
            <p className="text-[11px] text-[#6E7587] font-medium mt-0.5">
              Each post automatically discovers all peers registered in the identical course and slot.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={resetDemoPosts}
              title="Reset sample posts"
              className="p-2 sm:px-3 sm:py-2 rounded-full border border-[#F4E3D8] hover:bg-[#FFF8F3] text-xs font-bold text-[#6E7587] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/slot-friend/create')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] active:scale-95 text-white rounded-full font-black text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add New Slot</span>
            </button>
          </div>
        </div>

        {/* Posts List */}
        {myPosts.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {myPosts.map((post) => {
              const matchedPeers = computeMatches([post]);

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[24px] border border-[#F4E3D8] p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-[#FF572E]/30 transition-all"
                >
                  {/* Top Bar: Course Name + Slot Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FF572E] text-white font-black text-xs shadow-2xs">
                          Slot {post.slot}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] text-[10px] font-black">
                          ● Active Post
                        </span>
                      </div>

                      <h3 className="font-black text-sm sm:text-base text-[#17233C] leading-snug">
                        {post.course}
                      </h3>
                    </div>

                    {/* Quick Match Count Pill */}
                    <div 
                      onClick={() => navigate(`/slot-friend/matches?course=${encodeURIComponent(post.course)}&slot=${encodeURIComponent(post.slot)}`)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FFF0E6] border border-[#FDD0BE] text-[#FF572E] text-center cursor-pointer hover:bg-[#FFE5D6] transition-colors"
                    >
                      <span className="block font-black text-sm sm:text-base leading-none">
                        {matchedPeers.length}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-tight">
                        {matchedPeers.length === 1 ? 'Match' : 'Matches'}
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
                        {post.teacher}
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

                    {post.notes && (
                      <div className="sm:col-span-2 pt-1.5 border-t border-[#F4E3D8]/50">
                        <span className="text-[10px] font-bold text-[#8C93A4] block uppercase">
                          Study Goal / Note
                        </span>
                        <p className="text-[#6E7587] font-medium italic mt-0.5">
                          "{post.notes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-[#F4E3D8]/60 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/slot-friend/matches?course=${encodeURIComponent(post.course)}&slot=${encodeURIComponent(post.slot)}`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#17233C] hover:bg-[#253658] text-white text-xs font-black transition-all cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View {matchedPeers.length} Compatible Peers</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => navigate(`/slot-friend/create?edit=${post.id}`)}
                        className="p-2 rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:bg-[#FFF8F3] text-[#17233C] text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Edit slot post"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#6E7587]" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeletingPostId(post.id)}
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
            <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mx-auto text-xl">
              📚
            </div>
            <h3 className="font-black text-base text-[#17233C]">
              No slot posts created yet
            </h3>
            <p className="text-xs text-[#6E7587] max-w-sm mx-auto leading-relaxed">
              Create your first slot post with your course and timetable slot to start discovering compatible study friends!
            </p>
            <button
              type="button"
              onClick={() => navigate('/slot-friend/create')}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-full font-black text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create My First Post</span>
            </button>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingPostId && postToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingPostId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-[24px] p-5 sm:p-6 border border-[#F4E3D8] shadow-2xl max-w-md w-full space-y-4 z-10"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                    Delete Slot Post?
                  </h3>
                  <p className="text-[11px] text-[#6E7587]">
                    You will no longer be visible to peers matching this slot.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FFF8F3] border border-[#F4E3D8] text-xs font-semibold text-[#17233C]">
                {postToDelete.course} (Slot {postToDelete.slot})
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingPostId(null)}
                  className="px-4 py-2 rounded-full border border-[#F4E3D8] text-xs font-bold text-[#6E7587] hover:bg-[#FFF8F3] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

