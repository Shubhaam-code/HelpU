import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create an axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Token getter ref (set by AuthProvider)
let _getToken = null;

export const setTokenGetter = (fn) => {
  _getToken = fn;
};

// Request interceptor: attach Clerk token
apiClient.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('[API] Could not get auth token:', e.message);
    }
  }
  return config;
});

// Response interceptor: normalize errors
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Something went wrong';
    return Promise.reject(new Error(message));
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
export const createTravel = (data) => apiClient.post('/api/travels', data);
export const getTravelById = (id) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.get(`/api/travels/${id}`);
};
export const getTravelMatches = (id) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.get(`/api/travels/${id}/matches`);
};
export const updateTravelStatus = (id, status) => {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return Promise.reject(new Error('Invalid travel ID format'));
  }
  return apiClient.patch(`/api/travels/${id}/status`, { status });
};

// ── Bookings ──────────────────────────────────────────────────────────────
export const createBooking = (data) => apiClient.post('/api/bookings', data);
export const getMyBookings = () => apiClient.get('/api/bookings/my');
export const getReceivedBookings = () => apiClient.get('/api/bookings/received');
export const getBookingById = (id) => apiClient.get(`/api/bookings/${id}`);
export const getWhatsAppDetails = (id) => apiClient.get(`/api/bookings/${id}/whatsapp-details`);
export const respondBooking = (id, data) => apiClient.patch(`/api/bookings/${id}/respond`, data);
export const confirmBooking = (id) => apiClient.patch(`/api/bookings/${id}/confirm`);
export const cancelBooking = (id) => apiClient.patch(`/api/bookings/${id}/cancel`);

// ── Notifications ─────────────────────────────────────────────────────────
export const getNotifications = (params) => apiClient.get('/api/notifications', { params });
export const getUnreadCount = () => apiClient.get('/api/notifications/unread-count');
export const markRead = (id) => apiClient.patch(`/api/notifications/${id}/read`);
export const markAllRead = () => apiClient.patch('/api/notifications/read-all');

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

export default apiClient;

