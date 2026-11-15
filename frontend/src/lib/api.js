import axios from 'axios';
import { auth } from './firebase';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';

// Determine API Base URL
// In Android/iOS native app (Capacitor), ALWAYS use production backend URL.
// In local web development (npm run dev on localhost), allow local backend fallback.
const getBaseUrl = () => {
  // If user explicitly set custom API URL in localStorage, check and use it
  if (typeof window !== 'undefined' && window.localStorage?.getItem('VITE_API_URL')) {
    const custom = window.localStorage.getItem('VITE_API_URL');
    if (custom && custom !== 'https://helpu.onrender.com') {
      return custom;
    }
  }

  const envUrl = import.meta.env.VITE_API_URL || 'https://helpu.onrender.com';

  // 1. Native mobile platform (Android APK / iOS via Capacitor)
  let isNative = false;
  try {
    isNative = Boolean(
      Capacitor?.isNativePlatform?.() ||
      (typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform?.())
    );
  } catch {
    isNative = false;
  }

  if (isNative) {
    return envUrl;
  }

  // 2. Web browser: if on localhost, 127.0.0.1 or local network IP (192.168.x, 10.x, etc.)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return `http://${hostname}:5000`;
    }
  }

  return envUrl;
};

const BASE_URL = getBaseUrl();

// Create an axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000, // 45 seconds to accommodate Render free-tier cold start latency
});

// Token getter ref (set by AuthProvider)
let _getToken = null;

export const setTokenGetter = (fn) => {
  _getToken = fn;
};

// Request interceptor: attach Firebase Auth ID token
apiClient.interceptors.request.use(async (config) => {
  try {
    let token = null;
    if (_getToken) {
      token = await _getToken(false);
    }
    // Direct fallback: obtain fresh token from Firebase Auth currentUser
    if (!token && auth?.currentUser) {
      token = await auth.currentUser.getIdToken(false);
    }
    // Direct fallback on native platform via Capacitor Firebase Authentication
    if (!token) {
      try {
        let isNative = false;
        try {
          isNative = Boolean(
            Capacitor?.isNativePlatform?.() ||
            (typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform?.())
          );
        } catch {}
        if (isNative) {
          const res = await FirebaseAuthentication.getIdToken({ forceRefresh: false });
          token = res?.token;
        }
      } catch {
        // Continue if native token retrieval fails
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[API] Could not get auth token:', e.message);
  }
  return config;
});

// Automatic 401 token refresh queue to seamlessly restore session after token expiration
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: automatically refresh expired token & retry failed requests
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const status = err.response?.status;
    const isTokenExpired = 
      status === 401 && 
      originalRequest && 
      !originalRequest._retry;

    if (isTokenExpired) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((e) => Promise.reject(e));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        let freshToken = null;
        if (auth?.currentUser) {
          try {
            freshToken = await auth.currentUser.getIdToken(true);
          } catch (e) {
            console.warn('[API] auth.currentUser.getIdToken(true) failed:', e?.message);
          }
        }
        if (!freshToken && Capacitor.isNativePlatform()) {
          try {
            const res = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
            freshToken = res?.token;
          } catch (e) {
            console.warn('[API] FirebaseAuthentication.getIdToken({ forceRefresh: true }) failed:', e?.message);
          }
        }

        if (freshToken) {
          originalRequest.headers.Authorization = `Bearer ${freshToken}`;
          processQueue(null, freshToken);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Something went wrong';
    const error = new Error(message);
    error.response = err.response;
    error.status = err.response?.status;
    error.code = err.response?.data?.code || err.code;
    return Promise.reject(error);
  }
);

// ── Student ────────────────────────────────────────────────────────────────
export const getProfile = () => apiClient.get('/api/students/profile');
export const saveProfile = (data) => apiClient.post('/api/students/profile', data);
export const updateProfile = (data) => apiClient.put('/api/students/profile', data);

// ── Auth ───────────────────────────────────────────────────────────────────
export const getMe = () => apiClient.get('/api/auth/me');

// ── Travels ───────────────────────────────────────────────────────────────
export const getTravels = (params) => apiClient.get('/api/travels', { params });
export const getMyTravels = () => apiClient.get('/api/travels/my');
export const getUserMatches = () => apiClient.get('/api/travels/user/matches');
export const createTravel = (data, options = {}) => apiClient.post('/api/travels', data, options);
export const getTravelById = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || !/^[0-9a-fA-F]{24}$/.test(cleanId)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.get(`/api/travels/${cleanId}`);
};
export const getTravelMatches = (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId || !/^[0-9a-fA-F]{24}$/.test(cleanId)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.get(`/api/travels/${cleanId}/matches`);
};
export const updateTravelStatus = (id, status) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.patch(`/api/travels/${id}/status`, { status });
};
export const cancelTravel = (id) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.patch(`/api/travels/${id}/cancel`);
};
export const updateTravel = (id, data) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.put(`/api/travels/${id}`, data);
};
export const checkTravelGroupStatus = async (id) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.get(`/api/travels/${id}/group-status`);
};
export const deleteTravel = async (id) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  try {
    return await apiClient.delete(`/api/travels/${id}`);
  } catch (err) {
    const is404 = err.response?.status === 404 || err.message?.includes('404');
    if (is404) {
      // 1. If backend returns 404, route might be missing on cloud (Render deployment pending)
      // or post is already deleted. Attempt fallback status cancellation:
      try {
        console.warn('[API] DELETE /api/travels/:id returned 404. Attempting fallback cancellation...');
        return await apiClient.patch(`/api/travels/${id}/status`, { status: 'cancelled' });
      } catch (fallbackErr) {
        // If fallback also returned 404, the post no longer exists in MongoDB.
        // Resolve successfully so the client can safely remove the card from the UI.
        const isFallback404 = fallbackErr.response?.status === 404 || fallbackErr.message?.includes('404');
        if (isFallback404) {
          console.warn('[API] Post not found in database (already removed). Resolving delete as success.');
          return { data: { success: true, message: 'Post removed from database', deletedId: id } };
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
};

// ── Bookings ──────────────────────────────────────────────────────────────
export const createBooking = (data, options = {}) => apiClient.post('/api/bookings', data, options);
export const getMyBookings = () => apiClient.get('/api/bookings/my');
export const getReceivedBookings = () => apiClient.get('/api/bookings/received');
export const getConfirmedBookings = () => apiClient.get('/api/bookings/confirmed');
export const getBookingById = (id) => apiClient.get(`/api/bookings/${id}`);
export const getWhatsAppDetails = (id) => apiClient.get(`/api/bookings/${id}/whatsapp-details`);
export const respondBooking = (id, data) => apiClient.patch(`/api/bookings/${id}/respond`, data);
export const confirmBooking = (id) => apiClient.patch(`/api/bookings/${id}/confirm`);
export const cancelBooking = (id) => apiClient.patch(`/api/bookings/${id}/cancel`);
export const completeBooking = (id) => apiClient.patch(`/api/bookings/${id}/complete`);

// ── Notifications ─────────────────────────────────────────────────────────
export const getNotifications = (params) => apiClient.get('/api/notifications', { params });
export const getUnreadCount = (params) => apiClient.get('/api/notifications/unread-count', { params });
export const markRead = (id) => apiClient.patch(`/api/notifications/${id}/read`);
export const markAllRead = (params) => apiClient.patch('/api/notifications/read-all', null, { params });
export const deleteNotification = (id) => apiClient.delete(`/api/notifications/${id}`);
export const getSlotMateNotifications = (params) => apiClient.get('/api/slotmate/notifications', { params });
export const getSlotMateUnreadCount = () => apiClient.get('/api/slotmate/notifications/unread-count');
export const markAllSlotMateRead = () => apiClient.patch('/api/slotmate/notifications/read-all');
export const deleteSlotMateNotification = (id) => apiClient.delete(`/api/slotmate/notifications/${id}`);
export const registerFcmToken = (token, platform = 'android') =>
  apiClient.post('/api/notifications/fcm-token', { token, platform });
export const unregisterFcmToken = (token) =>
  apiClient.delete('/api/notifications/fcm-token', { data: { token } });

// ── Community ─────────────────────────────────────────────────────────────────
export const getCommunityPosts = (params) => apiClient.get('/api/community/posts', { params });
export const createCommunityPost = (data) => apiClient.post('/api/community/posts', data);
export const toggleLikePost = (id) => apiClient.patch(`/api/community/posts/${id}/like`);
export const addComment = (id, data) => apiClient.post(`/api/community/posts/${id}/comments`, data);
export const deleteCommunityPost = (id) => apiClient.delete(`/api/community/posts/${id}`);

// ── Help ──────────────────────────────────────────────────────────────────────
export const getHelpRequests = (params) => apiClient.get('/api/help/requests', { params });
export const createHelpRequest = (data) => apiClient.post('/api/help/requests', data);
export const getMyHelpRequests = () => apiClient.get('/api/help/requests/my');
export const updateHelpStatus = (id, status) => apiClient.patch(`/api/help/requests/${id}/status`, { status });

// ── Shared Ride Groups ────────────────────────────────────────────────────────
export const createSharedRideGroup = (data) => apiClient.post('/api/groups', data);
export const createGroupFromFindMatch = (data) => apiClient.post('/api/groups/from-match', data);
export const getCompatibleFinds = (travelId) => apiClient.get(`/api/travels/${travelId}/compatible-finds`);
export const getMySharedRideGroups = () => apiClient.get('/api/groups/my');
export const getSharedRideGroupById = (id) => apiClient.get(`/api/groups/${id}`);
export const discoverSharedRideGroups = (travelId) =>
  apiClient.get('/api/groups/discover', { params: { travelId } });
export const createGroupJoinRequest = (groupId, data) =>
  apiClient.post(`/api/groups/${groupId}/join-requests`, data);
export const getGroupJoinRequests = (groupId) =>
  apiClient.get(`/api/groups/${groupId}/join-requests`);
export const acceptStudentJoinRequest = (requestId) =>
  apiClient.post(`/api/groups/join-requests/${requestId}/accept`);
export const rejectStudentJoinRequest = (requestId) =>
  apiClient.post(`/api/groups/join-requests/${requestId}/reject`);
export const inviteStudentToGroup = (groupId, data) =>
  apiClient.post(`/api/groups/${groupId}/invites`, data);
export const getGroupInvites = (groupId) =>
  apiClient.get(`/api/groups/${groupId}/invites`);
export const getReceivedInvitations = () =>
  apiClient.get('/api/groups/invitations/received');
export const getSentGroupProposals = () =>
  apiClient.get('/api/groups/proposals/sent');
export const acceptGroupInvitation = (requestId) =>
  apiClient.post(`/api/groups/invitations/${requestId}/accept`);
export const rejectGroupInvitation = (requestId) =>
  apiClient.post(`/api/groups/invitations/${requestId}/reject`);
export const withdrawInvitation = (requestId) =>
  apiClient.post(`/api/groups/invitations/${requestId}/withdraw`);
export const acceptGroupProposal = (requestId) =>
  apiClient.post(`/api/groups/proposals/${requestId}/accept`);
export const rejectGroupProposal = (requestId) =>
  apiClient.post(`/api/groups/proposals/${requestId}/reject`);
export const directJoinSharedRideGroup = (groupId, data) =>
  apiClient.post(`/api/groups/${groupId}/join`, data);
export const leaveSharedRideGroup = (groupId) =>
  apiClient.post(`/api/groups/${groupId}/leave`);

// BUG 4 FIX: WhatsApp group link management
export const updateGroupWhatsAppLink = (groupId, data) =>
  apiClient.put(`/api/groups/${groupId}/whatsapp`, data);

// ── SlotMate ─────────────────────────────────────────────────────────────────
export const searchCourses = (q = '', limit = 200) => apiClient.get('/api/slotmate/courses', { params: { q, limit } });
export const createSlotPost = (data, options = {}) => apiClient.post('/api/slotmate/posts', data, options);
export const updateSlotPost = (postId, data) => apiClient.put(`/api/slotmate/posts/${postId}`, data);
export const getMySlotPosts = () => apiClient.get('/api/slotmate/posts/my');
export const getMySlotMatches = () => apiClient.get('/api/slotmate/matches/my');
export const getPostMatches = (postId) => apiClient.get(`/api/slotmate/posts/${postId}/matches`);
export const getSlotMatchDetails = (matchId) => apiClient.get(`/api/slotmate/matches/${matchId}`);
export const deleteSlotPost = (postId) => apiClient.delete(`/api/slotmate/posts/${postId}`);

// ── Faculty Search & Reviews ────────────────────────────────────────────────
export const searchFaculty = (q = '', limit = 10) =>
  apiClient.get('/api/faculty/search', { params: { q, limit } });
export const listFaculty = (limit = 20) =>
  apiClient.get('/api/faculty', { params: { limit } });
export const getFacultyById = (id) =>
  apiClient.get(`/api/faculty/${id}`);
export const getFacultyByName = (name) =>
  apiClient.get('/api/faculty/by-name', { params: { name } });
export const getFacultyReviews = (id, page = 1, limit = 10) =>
  apiClient.get(`/api/faculty/${id}/reviews`, { params: { page, limit } });
export const submitFacultyRating = (id, data) =>
  apiClient.post(`/api/faculty/${id}/ratings`, data);

// FFCS Curriculum & Course Registration
export const listCurriculumCourses = (params = {}) =>
  apiClient.get('/api/curriculum/courses', { params });
export const searchCurriculumCourses = (q = '', params = {}) =>
  apiClient.get('/api/curriculum/courses/search', { params: { q, ...params } });
export const getCurriculumCourse = (courseId) =>
  apiClient.get(`/api/curriculum/courses/${courseId}`);
export const addFFCSCourse = (data = {}, files = [], options = {}) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  });
  files.forEach((file) => formData.append('screenshots', file));
  return apiClient.post('/api/courses/add', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 minutes to allow Gemini AI extraction of screenshots
    ...options
  });
};
export const getMyFFCSCourses = () => apiClient.get('/api/courses');
export const getFFCSCourse = (courseId) => apiClient.get(`/api/courses/${courseId}`);
export const getFFCSCourseStatus = (courseId) => apiClient.get(`/api/courses/${courseId}/status`);
export const getFFCSCourseTeachers = (courseId) =>
  apiClient.get(`/api/courses/${courseId}/teachers`);
export const deleteFFCSCourse = (courseId) => apiClient.delete(`/api/courses/${courseId}`);
export const getMyTeachers = () => apiClient.get('/api/teachers');

export default apiClient;

