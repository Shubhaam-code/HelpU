import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getMySlotPosts, 
  createSlotPost as createSlotPostApi, 
  updateSlotPost as updateSlotPostApi,
  deleteSlotPost as deleteSlotPostApi,
  getPostMatches,
  getSlotMatchDetails,
  searchCourses
} from '../../../lib/api';
import { useFirebaseAuth } from '../../../context/FirebaseAuthContext';

const SlotFriendContext = createContext(null);

export function SlotFriendProvider({ children }) {
  const { user } = useFirebaseAuth();

  // 1. My Posts State (real data from MongoDB)
  const [myPosts, setMyPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState(null);

  // 2. Feedback Toast State
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Helper to normalize backend post object to work smoothly with all UI components
  const formatPost = useCallback((p) => {
    if (!p) return null;
    const postId = p._id || p.id;
    const code = p.courseCode || '';
    const name = p.courseName || '';
    const fullCourse = code && name ? `${code} - ${name}` : (name || code);
    const teacher = p.teacherName || p.teacher || '';
    const notes = p.additionalNotes || p.notes || '';
    const count = typeof p.matchCount === 'number' ? p.matchCount : 0;

    return {
      id: postId,
      _id: postId,
      courseId: p.courseId,
      courseCode: code,
      courseName: name,
      course: fullCourse,
      slot: p.slot || '',
      teacher,
      teacherName: teacher,
      notes,
      additionalNotes: notes,
      status: p.status || 'active',
      matchCount: count,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }, []);

  // 3. Fetch user's real posts from backend
  const fetchMyPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    setPostsError(null);
    try {
      const res = await getMySlotPosts();
      const rawPosts = res?.data?.posts || [];
      const formatted = rawPosts.map(formatPost);
      setMyPosts(formatted);
      return formatted;
    } catch (err) {
      console.warn('[SlotMate] Failed to fetch user posts:', err?.message);
      setPostsError(err?.message || 'Failed to load slot posts');
      return [];
    } finally {
      setIsLoadingPosts(false);
    }
  }, [formatPost]);

  // Load posts on user auth ready
  useEffect(() => {
    if (user) {
      fetchMyPosts();
    } else {
      setMyPosts([]);
    }
  }, [user, fetchMyPosts]);

  // 4. Create a Slot Post via backend API
  const createPost = useCallback(async (postData, options = {}) => {
    try {
      const res = await createSlotPostApi({
        courseId: postData.courseId,
        courseCode: postData.courseCode,
        slot: postData.slot.trim(),
        teacherName: postData.teacherName || postData.teacher,
        additionalNotes: postData.additionalNotes || postData.notes || ''
      }, options);

      const newPost = res?.data?.post;
      const matchCount = res?.data?.matchCount ?? 0;

      // Refresh real posts from backend (Success modal handles visual confirmation)
      await fetchMyPosts();
      return { post: newPost, matchCount };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to publish slot post';
      showToast(message, 'error');
      throw err;
    }
  }, [showToast, fetchMyPosts]);

  // 4b. Update an existing Slot Post via backend API
  const updatePost = useCallback(async (postId, postData) => {
    try {
      const res = await updateSlotPostApi(postId, {
        courseId: postData.courseId,
        courseCode: postData.courseCode,
        slot: postData.slot.trim(),
        teacherName: postData.teacherName || postData.teacher,
        additionalNotes: postData.additionalNotes || postData.notes || ''
      });

      const updated = res?.data?.post;
      const matchCount = res?.data?.matchCount ?? 0;

      showToast('Slot post updated successfully!', 'success');
      await fetchMyPosts();
      return { post: updated, matchCount };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to update slot post';
      showToast(message, 'error');
      throw err;
    }
  }, [showToast, fetchMyPosts]);

  // 5. Delete / Close a Slot Post via backend API
  const deletePost = useCallback(async (postId) => {
    try {
      await deleteSlotPostApi(postId);
      setMyPosts((prev) => prev.filter((p) => p.id !== postId && p._id !== postId));
      showToast('Slot post removed.', 'info');
      await fetchMyPosts();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to delete slot post';
      showToast(message, 'error');
      throw err;
    }
  }, [showToast, fetchMyPosts]);

  // 6. Fetch matching students for a specific post
  const fetchMatchesForPost = useCallback(async (postId) => {
    try {
      const res = await getPostMatches(postId);
      return {
        post: res?.data?.post,
        matches: res?.data?.matches || [],
        totalMatches: res?.data?.totalMatches || 0
      };
    } catch (err) {
      console.error('[SlotMate] Failed to fetch matches for post:', err);
      return { post: null, matches: [], totalMatches: 0 };
    }
  }, []);

  // 7. Fetch details for a specific match
  const fetchMatchDetails = useCallback(async (matchId) => {
    try {
      const res = await getSlotMatchDetails(matchId);
      return res?.data?.match || null;
    } catch (err) {
      console.error('[SlotMate] Failed to fetch match details:', err);
      return null;
    }
  }, []);

  // 8. Match count helper
  const getPostMatchCount = useCallback((post) => {
    if (!post) return 0;
    return typeof post.matchCount === 'number' ? post.matchCount : 0;
  }, []);

  // Total matches across all posts
  const totalMatchesCount = useMemo(() => {
    return myPosts.reduce((sum, p) => sum + (p.matchCount || 0), 0);
  }, [myPosts]);

  const value = {
    myPosts,
    isLoadingPosts,
    postsError,
    fetchMyPosts,
    createPost,
    updatePost,
    deletePost,
    fetchMatchesForPost,
    fetchMatchDetails,
    getPostMatchCount,
    totalMatchesCount,
    allMatches: myPosts, // for backward-compatible array references
    toast,
    showToast,
  };

  return (
    <SlotFriendContext.Provider value={value}>
      {children}
      {/* Toast Notification Container */}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-3 rounded-2xl text-xs font-black shadow-xl flex items-center justify-between gap-3 animate-bounce ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : toast.type === 'info'
            ? 'bg-[#17233C] text-white'
            : 'bg-[#16A34A] text-white'
        }`}>
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/80 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </SlotFriendContext.Provider>
  );
}

export function useSlotFriend() {
  const context = useContext(SlotFriendContext);
  if (!context) {
    throw new Error('useSlotFriend must be used within a SlotFriendProvider');
  }
  return context;
}
