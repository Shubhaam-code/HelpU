import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Users, MessageSquare, Heart, Share2, Send, Plus, 
  Sparkles, Filter, TrendingUp, ShieldCheck, Tag, 
  MapPin, Calendar, Clock, ArrowRight, Check, X, Loader2
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { openWhatsAppChat } from '../lib/whatsapp';
import {
  getProfile, getUnreadCount,
  getCommunityPosts, createCommunityPost, toggleLikePost, addComment, deleteCommunityPost
} from '../lib/api';

const COMMUNITY_CATEGORIES = [
  'All Posts',
  'Ride Sharing',
  'Weekend Trips',
  'Campus Life',
  'Hostel & Mess',
  'Lost & Found'
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');

  const [activeCategory, setActiveCategory] = useState('All Posts');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState('Ride Sharing');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Fetch posts from backend
  const fetchPosts = useCallback(async (category) => {
    setPostsLoading(true);
    setPostsError('');
    try {
      const params = { limit: 30 };
      if (category && category !== 'All Posts') params.category = category;
      const res = await getCommunityPosts(params);
      setPosts(res.data?.data || []);
    } catch (err) {
      console.error('Community fetch error:', err);
      setPostsError('Could not load posts. Please try again.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeCategory);
  }, [fetchPosts, activeCategory]);

  // Fetch student profile & unread count
  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((res) => { if (isMounted) setProfile(res.data?.data || null); })
      .catch(() => {});

    getUnreadCount()
      .then((res) => { if (isMounted) setUnreadCount(res.data?.data?.count || 0); })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const currentUserName = useMemo(() => {
    return profile?.name || user?.fullName || user?.firstName || 'Campus Student';
  }, [profile, user]);

  // Handle Create Post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    setPostSubmitting(true);
    try {
      await createCommunityPost({
        content: postContent.trim(),
        category: postCategory,
        authorName: currentUserName,
        college: profile?.college || 'VIT, Bhopal',
        whatsapp: profile?.phone || ''
      });
      setPostContent('');
      setIsCreatingPost(false);
      fetchPosts(activeCategory); // refetch
    } catch (err) {
      console.error('Create post error:', err);
    } finally {
      setPostSubmitting(false);
    }
  };

  // Toggle Like
  const handleToggleLike = async (postId) => {
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p._id === postId) {
        const nowLiked = !p.isLiked;
        return { ...p, isLiked: nowLiked, likeCount: nowLiked ? (p.likeCount || 0) + 1 : Math.max(0, (p.likeCount || 0) - 1) };
      }
      return p;
    }));
    try {
      await toggleLikePost(postId);
    } catch (err) {
      console.error('Like error:', err);
      // Revert on error
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          const reverted = !p.isLiked;
          return { ...p, isLiked: reverted, likeCount: reverted ? (p.likeCount || 0) + 1 : Math.max(0, (p.likeCount || 0) - 1) };
        }
        return p;
      }));
    }
  };

  // Add Comment
  const handleAddComment = async (postId) => {
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await addComment(postId, { text: commentText.trim(), authorName: currentUserName });
      const newComment = res.data?.data;
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            comments: [...(p.comments || []), newComment],
            commentCount: (p.commentCount || 0) + 1
          };
        }
        return p;
      }));
      setCommentText('');
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Filtered posts (backend already filters by category, so just use `posts`)
  const filteredPosts = posts;

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      unreadCount={unreadCount}
      customMobileHeader={<AppHeader title="Community" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-xs relative overflow-hidden p-6 sm:p-8 mb-6"
        >
          {/* Subtle warm decorative background glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FFF0E7]/70 via-[#FFF5EE]/30 to-transparent pointer-events-none rounded-r-[28px]" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-3">
                <Users className="w-3.5 h-3.5" />
                <span>Campus Community</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#17233C] tracking-tight leading-tight">
                Connect with Your <span className="text-[#FF572E]">Campus Tribe</span>
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#6E7587] font-medium max-w-lg leading-relaxed">
                Share ride routes, coordinate weekend carpools, campus notices, and meet verified students.
              </p>
            </div>

            <button
              onClick={() => setIsCreatingPost(true)}
              className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Post</span>
            </button>
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* MAIN TWO-COLUMN COMMUNITY LAYOUT (8 COLS FEED + 4 COLS SIDEBAR)           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: CATEGORIES + CREATE POST MODAL/CARD + FEED (SPAN 8) */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">
            
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {COMMUNITY_CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeCategory === category
                      ? 'bg-[#FF572E] text-white shadow-sm'
                      : 'bg-white text-[#17233C] hover:bg-[#FFF7F2] border border-[#F4E3D8]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Quick Share / Post Creator Box */}
            <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8]/90 shadow-xs">
              <div className="flex items-center gap-3">
                <Avatar 
                  avatarId={currentUserAvatar} 
                  src={user?.imageUrl} 
                  size="md" 
                  ring 
                />
                <button
                  onClick={() => setIsCreatingPost(true)}
                  className="flex-1 bg-[#FFFBF8] hover:bg-[#FFF5EE] border border-[#F4E3D8] rounded-full py-2.5 px-4 text-xs sm:text-sm text-left text-[#8C93A4] transition-colors cursor-pointer"
                >
                  What's happening on campus, {currentUserName.split(' ')[0]}?
                </button>
                <button
                  onClick={() => setIsCreatingPost(true)}
                  className="w-10 h-10 rounded-full bg-[#FF572E] text-white flex items-center justify-center hover:bg-[#E64A22] transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal for Creating New Post */}
            <AnimatePresence>
              {isCreatingPost && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-[28px] max-w-lg w-full p-6 border border-[#F4E3D8] shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]">
                      <h3 className="font-black text-[#17233C] text-lg">Create Community Post</h3>
                      <button
                        onClick={() => setIsCreatingPost(false)}
                        className="w-8 h-8 rounded-full bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Author Preview */}
                    <div className="flex items-center gap-2.5">
                      <Avatar 
                        avatarId={currentUserAvatar} 
                        src={user?.imageUrl} 
                        size="md" 
                        ring 
                      />
                      <div>
                        <div className="font-extrabold text-[#17233C] text-sm">{currentUserName}</div>
                        <span className="text-[11px] text-[#16A34A] font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Verified Student
                        </span>
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1.5">
                        Post Category
                      </label>
                      <select
                        value={postCategory}
                        onChange={(e) => setPostCategory(e.target.value)}
                        className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                      >
                        <option value="Ride Sharing">🚗 Ride Sharing</option>
                        <option value="Weekend Trips">🌴 Weekend Trips</option>
                        <option value="Campus Life">🎓 Campus Life</option>
                        <option value="Hostel & Mess">🏠 Hostel & Mess</option>
                        <option value="Lost & Found">🔍 Lost & Found</option>
                      </select>
                    </div>

                    {/* Content TextArea */}
                    <div>
                      <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1.5">
                        Your Message
                      </label>
                      <textarea
                        rows={4}
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Share ride details, campus updates, trip plans, or questions..."
                        className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl p-3 text-xs sm:text-sm font-medium text-[#17233C] focus:outline-none focus:border-[#FF572E] resize-none"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F4E3D8]">
                      <button
                        type="button"
                        onClick={() => setIsCreatingPost(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-[#6E7587] hover:bg-[#FFFBF8] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreatePost}
                        disabled={!postContent.trim() || postSubmitting}
                        className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {postSubmitting ? 'Publishing...' : 'Publish Post'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Posts Feed */}
            <div className="space-y-4">
              {postsLoading ? (
                <div className="bg-white rounded-[26px] p-10 text-center border border-[#F4E3D8]">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FF572E] mx-auto mb-3" />
                  <p className="text-xs text-[#6E7587] font-medium">Loading community posts...</p>
                </div>
              ) : postsError ? (
                <div className="bg-white rounded-[26px] p-10 text-center border border-red-100">
                  <p className="text-xs text-red-500 font-bold mb-2">{postsError}</p>
                  <button onClick={() => fetchPosts(activeCategory)} className="px-4 py-1.5 bg-[#FF572E] text-white text-xs font-bold rounded-xl cursor-pointer">Retry</button>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="bg-white rounded-[26px] p-10 text-center border border-[#F4E3D8] max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-[#17233C] text-base mb-1">No Posts Yet</h3>
                  <p className="text-xs text-[#6E7587] mb-4">
                    Be the first student to start a discussion or share a travel update!
                  </p>
                  <button
                    onClick={() => setIsCreatingPost(true)}
                    className="px-5 py-2 bg-[#FF572E] text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    Start a Discussion
                  </button>
                </div>
              ) : (
                filteredPosts.map(post => {
                  const postId = post._id || post.id;
                  const likeCount = post.likeCount ?? post.likes ?? 0;
                  const commentCount = post.commentCount ?? post.comments?.length ?? 0;
                  const isLiked = post.isLiked ?? false;
                  const timeAgo = post.timeAgo || (post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '');
                  return (
                    <motion.div
                      key={postId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs hover:border-[#FF572E]/30 transition-all"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            avatarId={post.authorAvatar}
                            src={post.authorImage}
                            size="md"
                            ring
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                                {post.authorName}
                              </h4>
                              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#6E7587]">
                              <span>{post.college || 'VIT, Bhopal'}</span>
                              <span>•</span>
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-[#FFF4ED] text-[#FF572E] text-[11px] font-black shrink-0">
                          {post.category}
                        </span>
                      </div>

                      {/* Post Content */}
                      <p className="text-xs sm:text-sm text-[#17233C] font-medium leading-relaxed mb-4">
                        {post.content}
                      </p>

                      {/* Actions Row */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#F4E3D8]">
                        <div className="flex items-center gap-4">
                          {/* Like Button */}
                          <button
                            onClick={() => handleToggleLike(postId)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                              isLiked ? 'text-[#FF572E]' : 'text-[#6E7587] hover:text-[#FF572E]'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#FF572E]' : ''}`} />
                            <span>{likeCount}</span>
                          </button>

                          {/* Comment Toggle */}
                          <button
                            onClick={() => setActiveCommentPostId(activeCommentPostId === postId ? null : postId)}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>{commentCount}</span>
                          </button>
                        </div>

                        {/* Direct WhatsApp Connect */}
                        {post.whatsapp && (
                          <button
                            onClick={() => openWhatsAppChat({
                              phone: post.whatsapp,
                              name: post.authorName,
                              message: `Hi ${post.authorName}! Saw your post on HelpU Community regarding "${post.category}". Let's coordinate!`
                            })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs border border-[#25D366]/30 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </div>

                      {/* Comments Section */}
                      {activeCommentPostId === postId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-[#F4E3D8]/60 space-y-2.5"
                        >
                          {post.comments?.map(comment => (
                            <div key={comment._id || comment.id} className="bg-[#FFFBF8] rounded-xl p-2.5 text-xs">
                              <span className="font-extrabold text-[#17233C] mr-1.5">{comment.authorName || comment.author}:</span>
                              <span className="text-[#596277]">{comment.text}</span>
                            </div>
                          ))}

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddComment(postId);
                              }}
                              placeholder="Write a friendly reply..."
                              className="flex-1 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-medium text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                            />
                            <button
                              onClick={() => handleAddComment(postId)}
                              disabled={commentSubmitting}
                              className="px-3 py-2 bg-[#FF572E] text-white rounded-xl text-xs font-bold hover:bg-[#E64A22] cursor-pointer disabled:opacity-60"
                            >
                              {commentSubmitting ? '...' : 'Reply'}
                            </button>
                          </div>
                        </motion.div>
                      )}

                    </motion.div>
                  );
                })
              )}
            </div>

          </div>


          {/* RIGHT COLUMN: TRENDING TOPICS & COMMUNITY GUIDELINES (SPAN 4) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Trending Campus Topics */}
            <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5">
                <TrendingUp className="w-4.5 h-4.5 text-[#FF572E]" />
                <h3 className="font-black text-[#17233C] text-base">Trending Topics</h3>
              </div>

              <div className="space-y-2.5">
                <div 
                  onClick={() => navigate('/rides?to=Bhopal%20Railway%20Station')}
                  className="p-3 bg-[#FFFBF8] hover:bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-black text-xs text-[#17233C]">#BhopalStationCarpool</div>
                    <div className="text-[10px] text-[#6E7587]">18 active carpools</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E]" />
                </div>

                <div 
                  onClick={() => navigate('/rides?to=Airport')}
                  className="p-3 bg-[#FFFBF8] hover:bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-black text-xs text-[#17233C]">#AirportDropFriday</div>
                    <div className="text-[10px] text-[#6E7587]">12 shared cabs</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E]" />
                </div>

                <div 
                  onClick={() => navigate('/match')}
                  className="p-3 bg-[#FFFBF8] hover:bg-white rounded-2xl border border-[#F4E3D8] hover:border-[#FF572E]/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-black text-xs text-[#17233C]">#WeekendTravelMatches</div>
                    <div className="text-[10px] text-[#6E7587]">9 verified buddies</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E]" />
                </div>
              </div>
            </div>

            {/* Verified Student Network Callout */}
            <div className="bg-[#FFF8F3] rounded-[26px] p-5 sm:p-6 border border-[#FDE0D0] shadow-xs">
              <div className="flex items-center gap-2 mb-2.5">
                <ShieldCheck className="w-5 h-5 text-[#FF572E]" />
                <h3 className="font-black text-[#17233C] text-sm sm:text-base">
                  Campus Verified Only
                </h3>
              </div>
              <p className="text-xs text-[#596277] leading-relaxed mb-4">
                Every member on HelpU is authenticated with official college credentials. Never worry about fake profiles or spam.
              </p>
              <div className="flex items-center justify-between text-xs font-extrabold text-[#FF572E]">
                <span>100% Peer-to-Peer</span>
                <span className="text-[#17233C]">•</span>
                <span>Zero Commission</span>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs">
              <h3 className="font-black text-[#17233C] text-sm mb-3">Quick Navigation</h3>
              <div className="space-y-2 text-xs font-bold text-[#6E7587]">
                <button 
                  onClick={() => navigate('/rides/offer')} 
                  className="w-full text-left p-2 rounded-xl hover:bg-[#FFFBF8] hover:text-[#FF572E] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>Offer a Campus Ride</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => navigate('/help')} 
                  className="w-full text-left p-2 rounded-xl hover:bg-[#FFFBF8] hover:text-[#FF572E] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>Get Campus Assistance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => navigate('/about')} 
                  className="w-full text-left p-2 rounded-xl hover:bg-[#FFFBF8] hover:text-[#FF572E] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>About HelpU Platform</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </ResponsiveShell>
  );
}

