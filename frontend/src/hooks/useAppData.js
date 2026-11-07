import { useQuery } from '@tanstack/react-query';
import { 
  getProfile, 
  getMyTravels, 
  getUserMatches, 
  getUnreadCount,
  getTravels,
  getTravelById,
  getMyBookings,
  getReceivedBookings,
  getCommunityPosts
} from '../lib/api';
import { QUERY_KEYS } from '../lib/queryClient';
import { useUser } from '../context/FirebaseAuthContext';

/**
 * Hook to get the current authenticated user's profile with caching.
 */
export function useUserProfile() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.profile(user?.id),
    queryFn: async () => {
      const res = await getProfile();
      return res.data?.data || null;
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000 // 1 minute
  });
}

/**
 * Hook to get user's created travel posts with caching.
 */
export function useMyTravels() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.myTravels(user?.id),
    queryFn: async () => {
      const res = await getMyTravels();
      const list = res.data?.data || res.data?.travels || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000
  });
}

/**
 * Fetcher function for user matches ensuring consistent payload shape across Home and Match pages.
 */
async function fetchUserMatchesPayload() {
  const res = await getUserMatches();
  const mData = res.data || {};
  const matches = Array.isArray(mData.data) ? mData.data : (Array.isArray(mData.matches) ? mData.matches : []);
  return {
    matches,
    hasPostedTravel: Boolean(mData.hasPostedTravel ?? (matches.length > 0 || (Array.isArray(mData.myTravels) && mData.myTravels.length > 0))),
    myTravels: Array.isArray(mData.myTravels) ? mData.myTravels : []
  };
}

/**
 * Hook to get user matches list with caching (used on Home and dashboard).
 * Perfectly synchronized with useUserMatchesData via shared Query Key and select.
 */
export function useUserMatches() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.userMatches(user?.id),
    queryFn: fetchUserMatchesPayload,
    select: (data) => {
      if (Array.isArray(data)) return data;
      return Array.isArray(data?.matches) ? data.matches : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000
  });
}

/**
 * Hook to get comprehensive user matches payload (matches, hasPostedTravel, myTravels) with caching.
 * Perfectly synchronized with useUserMatches via shared Query Key.
 */
export function useUserMatchesData() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.userMatches(user?.id),
    queryFn: fetchUserMatchesPayload,
    select: (data) => {
      if (Array.isArray(data)) {
        return {
          matches: data,
          hasPostedTravel: data.length > 0,
          myTravels: []
        };
      }
      return {
        matches: Array.isArray(data?.matches) ? data.matches : [],
        hasPostedTravel: Boolean(data?.hasPostedTravel ?? (Array.isArray(data?.matches) && data.matches.length > 0)),
        myTravels: Array.isArray(data?.myTravels) ? data.myTravels : []
      };
    },
    enabled: Boolean(user?.id),
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000
  });
}

/**
 * Hook to get unread notification count with caching.
 */
export function useUnreadNotificationsCount() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.unreadCount(user?.id),
    queryFn: async () => {
      const res = await getUnreadCount();
      return res.data?.data?.count || 0;
    },
    enabled: Boolean(user?.id),
    staleTime: 20 * 1000
  });
}

/**
 * Hook to search/list travels with query caching.
 */
export function useTravels(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.travels(params),
    queryFn: async () => {
      const res = await getTravels(params);
      const list = res.data?.data || res.data?.travels || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    staleTime: 30 * 1000
  });
}

/**
 * Hook to get single travel details with caching.
 */
export function useTravelDetails(id) {
  return useQuery({
    queryKey: QUERY_KEYS.travelDetail(id),
    queryFn: async () => {
      if (!id) return null;
      const res = await getTravelById(id);
      return res.data?.data || res.data?.travel || res.data || null;
    },
    enabled: Boolean(id),
    staleTime: 45 * 1000
  });
}

/**
 * Hook to get user's created bookings with caching.
 */
export function useMyBookings() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.myBookings(user?.id),
    queryFn: async () => {
      const res = await getMyBookings();
      const list = res.data?.data || res.data?.bookings || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000
  });
}

/**
 * Hook to get received bookings on user's travels with caching.
 */
export function useReceivedBookings() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.receivedBookings(user?.id),
    queryFn: async () => {
      const res = await getReceivedBookings();
      const list = res.data?.data || res.data?.bookings || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000
  });
}

