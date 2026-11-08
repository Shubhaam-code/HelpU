import { QueryClient } from '@tanstack/react-query';

/**
 * Tiered Cache Duration Configurations (in milliseconds)
 * Tailored to match real-world campus mobility dynamics.
 */
export const CACHE_DURATIONS = {
  // Profiles rarely change within a session
  PROFILE: { staleTime: 2 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  // Home dashboard & match calculations
  HOME_MATCHES: { staleTime: 60 * 1000, gcTime: 15 * 60 * 1000 },
  // User's own ride offers & find requests
  MY_RIDES: { staleTime: 45 * 1000, gcTime: 15 * 60 * 1000 },
  // Fast-moving shared groups & discovery
  SHARED_GROUPS: { staleTime: 20 * 1000, gcTime: 15 * 60 * 1000 },
  // Invitations & join requests
  INVITATIONS: { staleTime: 20 * 1000, gcTime: 15 * 60 * 1000 },
  // Group details (active member lists)
  GROUP_DETAILS: { staleTime: 20 * 1000, gcTime: 15 * 60 * 1000 },
  // Notifications
  NOTIFICATIONS: { staleTime: 30 * 1000, gcTime: 15 * 60 * 1000 },
  // Unread badge count
  UNREAD_COUNT: { staleTime: 20 * 1000, gcTime: 15 * 60 * 1000 },
  // Bookings
  BOOKINGS: { staleTime: 45 * 1000, gcTime: 15 * 60 * 1000 },
};

/**
 * Global TanStack Query Client for Helpu.
 * Configured with sensible staleTime and gcTime defaults for instant mobile navigation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45 * 1000, // 45 seconds default freshness window
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection window (preserves cached data across tabs)
      refetchOnWindowFocus: false, // Prevents aggressive refetch on app refocus in Capacitor mobile
      refetchOnReconnect: true, // Automatically revalidates when mobile device regains network
      refetchOnMount: false, // Prevents full-screen spinners on tab re-entry when data is still fresh
      retry: 1
    }
  }
});

/**
 * Centralized Query Key Factory.
 * Incorporates canonical userId and route/post parameters to prevent cross-account cache collision.
 */
export const QUERY_KEYS = {
  profile: (userId) => ['profile', userId || 'current'],
  myTravels: (userId) => ['travels', 'my', userId || 'current'],
  userMatches: (userId) => ['travels', 'matches', 'user', userId || 'current'],
  travelMatches: (travelId) => ['travels', 'matches', travelId || 'none'],
  travels: (params) => ['travels', 'list', params || {}],
  travelDetail: (id) => ['travels', 'detail', id || 'none'],
  myBookings: (userId) => ['bookings', 'my', userId || 'current'],
  receivedBookings: (userId) => ['bookings', 'received', userId || 'current'],
  confirmedBookings: (userId) => ['bookings', 'confirmed', userId || 'current'],
  bookingDetail: (id) => ['bookings', 'detail', id || 'none'],
  unreadCount: (userId) => ['notifications', 'unread-count', userId || 'current'],
  notifications: (params, userId) => ['notifications', 'list', params || {}, userId || 'current'],
  communityPosts: (params) => ['community', 'posts', params || {}],
  myGroups: (userId) => ['groups', 'my', userId || 'current'],
  discoverGroups: (travelId) => ['groups', 'discover', travelId || 'none'],
  compatibleFinds: (travelId) => ['travels', 'compatible-finds', travelId || 'none'],
  groupDetails: (groupId) => ['groups', 'detail', groupId || 'none'],
  groupJoinRequests: (groupId) => ['groups', 'joinRequests', groupId || 'none'],
  groupInvites: (groupId) => ['groups', 'sentInvites', groupId || 'none'],
  receivedInvitations: (userId) => ['groups', 'receivedInvites', userId || 'current']
};

export const queryKeys = QUERY_KEYS;

/**
 * Targeted Cache Invalidation Helpers.
 * Only invalidates queries affected by the specific user action, preventing unnecessary network churn.
 */
export function invalidateGroupQueries() {
  queryClient.invalidateQueries({ queryKey: ['groups'] });
  queryClient.invalidateQueries({ queryKey: ['travels', 'compatible-finds'] });
  queryClient.invalidateQueries({ queryKey: ['travels', 'matches'] });
}

export function invalidateRideQueries() {
  queryClient.invalidateQueries({ queryKey: ['travels'] });
  queryClient.invalidateQueries({ queryKey: ['groups', 'discover'] });
}

export function invalidateBookingQueries() {
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  queryClient.invalidateQueries({ queryKey: ['travels'] });
}

export function invalidateNotificationQueries() {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function invalidateProfileQueries() {
  queryClient.invalidateQueries({ queryKey: ['profile'] });
}

export function invalidateCommunityQueries() {
  queryClient.invalidateQueries({ queryKey: ['community'] });
}

/**
 * Clears the entire cache on logout or account switch to guarantee user data privacy.
 */
export function clearUserCache() {
  console.log('[HelpuCache] User logged out or switched. Clearing global query cache...');
  queryClient.clear();
  try {
    sessionStorage.removeItem('helpu_active_route_draft');
  } catch {}
}

