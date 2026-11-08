import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  POPULAR_COURSES, 
  POPULAR_TEACHERS, 
  SLOT_DEFINITIONS, 
  INITIAL_USER_POSTS, 
  MOCK_STUDENTS_POOL 
} from '../data/mockData';

const SlotFriendContext = createContext(null);

const STORAGE_KEY = 'helpu_slot_friend_posts_v1';

export function SlotFriendProvider({ children }) {
  // 1. My Posts State (with localStorage persistence)
  const [myPosts, setMyPosts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore JSON parse error
    }
    return INITIAL_USER_POSTS;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(myPosts));
    } catch {
      // ignore storage error
    }
  }, [myPosts]);

  // 2. Feedback Toast State
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // 3. Create a Slot Post
  const createPost = useCallback((postData) => {
    const newPost = {
      id: `post-${Date.now()}`,
      course: postData.course.trim(),
      slot: postData.slot.trim(),
      teacher: postData.teacher.trim(),
      notes: (postData.notes || '').trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    setMyPosts((prev) => [newPost, ...prev]);
    showToast('Slot post created! Compatible students are now discoverable.', 'success');
    return newPost;
  }, [showToast]);

  // 4. Update an existing Slot Post
  const updatePost = useCallback((id, updatedData) => {
    setMyPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              course: updatedData.course.trim(),
              slot: updatedData.slot.trim(),
              teacher: updatedData.teacher.trim(),
              notes: (updatedData.notes || '').trim(),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    showToast('Slot post updated successfully.', 'info');
  }, [showToast]);

  // 5. Delete a Slot Post
  const deletePost = useCallback((id) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
    showToast('Slot post removed.', 'info');
  }, [showToast]);

  // 6. Reset to default demo posts
  const resetDemoPosts = useCallback(() => {
    setMyPosts(INITIAL_USER_POSTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    showToast('Reset to default campus sample posts.', 'info');
  }, [showToast]);

  // 7. Dynamic Match Computation: Same Course + Same Slot
  // Teacher can be different.
  const computeMatches = useCallback((postsList) => {
    if (!Array.isArray(postsList) || postsList.length === 0) return [];

    const matchesMap = new Map();

    postsList.forEach((post) => {
      if (!post.isActive) return;

      // Find all students matching exact Course and Slot
      const matchingStudents = MOCK_STUDENTS_POOL.filter(
        (student) =>
          student.course.toLowerCase().trim() === post.course.toLowerCase().trim() &&
          student.slot.toUpperCase().trim() === post.slot.toUpperCase().trim()
      );

      matchingStudents.forEach((student) => {
        const isSameTeacher =
          student.teacher.toLowerCase().trim() === post.teacher.toLowerCase().trim();

        // Calculate match metadata
        const matchRecord = {
          ...student,
          matchedPostId: post.id,
          matchedCourse: post.course,
          matchedSlot: post.slot,
          userTeacher: post.teacher,
          isSameTeacher,
          matchBadge: isSameTeacher ? 'Same Course, Slot & Faculty' : 'Same Course & Slot',
          matchBadgeType: isSameTeacher ? 'faculty-match' : 'slot-match',
        };

        // De-duplicate if student matches multiple posts
        if (!matchesMap.has(student.id)) {
          matchesMap.set(student.id, matchRecord);
        }
      });
    });

    return Array.from(matchesMap.values());
  }, []);

  // All matches for user's current posts
  const allMatches = useMemo(() => {
    return computeMatches(myPosts);
  }, [computeMatches, myPosts]);

  // Find single student by ID
  const getStudentById = useCallback((id) => {
    const found = MOCK_STUDENTS_POOL.find((s) => s.id === id);
    if (found) {
      // Find which post of user matched this student
      const matchedPost = myPosts.find(
        (p) =>
          p.course.toLowerCase().trim() === found.course.toLowerCase().trim() &&
          p.slot.toUpperCase().trim() === found.slot.toUpperCase().trim()
      );
      const isSameTeacher = matchedPost
        ? found.teacher.toLowerCase().trim() === matchedPost.teacher.toLowerCase().trim()
        : false;

      return {
        ...found,
        matchedPost,
        isSameTeacher,
        matchBadge: isSameTeacher ? 'Same Course, Slot & Faculty' : 'Same Course & Slot',
      };
    }
    return null;
  }, [myPosts]);

  const value = {
    myPosts,
    allMatches,
    courses: POPULAR_COURSES,
    teachers: POPULAR_TEACHERS,
    slotDefinitions: SLOT_DEFINITIONS,
    createPost,
    updatePost,
    deletePost,
    resetDemoPosts,
    computeMatches,
    getStudentById,
    toast,
    showToast,
  };

  return (
    <SlotFriendContext.Provider value={value}>
      {children}
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-3 rounded-2xl bg-[#17233C] text-white text-xs font-bold shadow-xl flex items-center justify-between gap-3 animate-bounce">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/70 hover:text-white text-sm"
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

