import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query Client for Helpu.
 * Configured with sensible staleTime and gcTime defaults for instant mobile navigation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds default freshness window
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection window
      refetchOnWindowFocus: false, // Prevents aggressive refetch on app refocus in Capacitor mobile
      refetchOnReconnect: true,
      retry: 1
    }
  }
});

/**
 * Standard Query Keys
 */
export const QUERY_KEYS = {
  profile: (userId) => ['profile', userId || 'current'],
  myTravels: (userId) => ['travels', 'my', userId || 'current'],
  userMatches: (userId) => ['travels', 'matches', 'user', userId || 'current'],
  travelMatches: (travelId) => ['travels', 'matches', travelId],
  travels: (params) => ['travels', 'list', params || {}],
  travelDetail: (id) => ['travels', 'detail', id],
  myBookings: (userId) => ['bookings', 'my', userId || 'current'],
  receivedBookings: (userId) => ['bookings', 'received', userId || 'current'],
  confirmedBookings: (userId) => ['bookings', 'confirmed', userId || 'current'],
  bookingDetail: (id) => ['bookings', 'detail', id],
  unreadCount: (userId) => ['notifications', 'unread-count', userId || 'current'],
  notifications: (params, userId) => ['notifications', 'list', params || {}, userId || 'current'],
  communityPosts: (params) => ['community', 'posts', params || {}]
};

/**
 * Targeted Cache Invalidation Helpers
 */
export function invalidateRideQueries() {
  queryClient.invalidateQueries({ queryKey: ['travels'] });
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
}

