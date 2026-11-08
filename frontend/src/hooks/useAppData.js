import { useQuery } from '@tanstack/react-query';
import { 
  getProfile, 
  getMyTravels, 
  getUserMatches, 
  getUnreadCount,
  getNotifications,
  getTravels,
  getTravelById,
  getMyBookings,
  getReceivedBookings,
  getConfirmedBookings,
  getCommunityPosts,
  getMySharedRideGroups,
  discoverSharedRideGroups,
  getSharedRideGroupById,
  getReceivedInvitations,
  getGroupJoinRequests,
  getGroupInvites,
  getTravelMatches,
  getCompatibleFinds
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
 * Hook to get notifications list with TanStack Query caching.
 */
export function useNotificationsList(params = {}) {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.notifications(params, user?.id),
    queryFn: async () => {
      const res = await getNotifications(params);
      const items = res.data?.data || [];
      return Array.isArray(items) ? items : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000
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

// Re-export date and ride lifecycle utilities from utils
export {
  toCanonicalDateString,
  getTodayDateString,
  categorizeConfirmedRides
} from '../lib/utils';

/**
 * Hook to get confirmed bookings for the logged-in user with TanStack Query caching.
 */
export function useConfirmedBookings() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.confirmedBookings(user?.id),
    queryFn: async () => {
      const res = await getConfirmedBookings();
      const list = res.data?.data || res.data?.bookings || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000
  });
}

/**
 * Hook to get Shared Ride Groups the student has joined.
 */
export function useMySharedRideGroups() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.myGroups(user?.id),
    queryFn: async () => {
      const res = await getMySharedRideGroups();
      const list = res.data?.data || res.data?.groups || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 15 * 1000
  });
}

/**
 * Hook to discover compatible Shared Ride Groups for an active FIND post.
 */
export function useDiscoverSharedRideGroups(travelId) {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.discoverGroups(travelId),
    queryFn: async () => {
      if (!travelId) return [];
      const res = await discoverSharedRideGroups(travelId);
      const list = res.data?.data || res.data?.groups || res.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id && travelId),
    staleTime: 15 * 1000
  });
}

/**
 * Hook to discover compatible FIND posts for smart group formation suggestions.
 */
export function useCompatibleFinds(travelId) {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.compatibleFinds ? QUERY_KEYS.compatibleFinds(travelId) : ['travels', 'compatible-finds', travelId || 'none'],
    queryFn: async () => {
      if (!travelId) return [];
      const res = await getCompatibleFinds(travelId);
      const list = res.data?.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id && travelId),
    staleTime: 15 * 1000
  });
}

/**
 * Hook to get Shared Ride Group details by ID.
 */
export function useSharedRideGroupDetails(groupId) {
  return useQuery({
    queryKey: QUERY_KEYS.groupDetails(groupId),
    queryFn: async () => {
      if (!groupId) return null;
      const res = await getSharedRideGroupById(groupId);
      return res.data?.data || null;
    },
    enabled: Boolean(groupId),
    staleTime: 15 * 1000
  });
}

/**
 * Hook to get pending received group invitations for the current student.
 */
export function useReceivedGroupInvitations() {
  const { user } = useUser();
  return useQuery({
    queryKey: QUERY_KEYS.receivedInvitations(user?.id),
    queryFn: async () => {
      const res = await getReceivedInvitations();
      const list = res.data?.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 15 * 1000
  });
}

/**
 * Hook to get student join requests for a group (Group Admin only).
 */
export function useGroupJoinRequests(groupId, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.groupJoinRequests(groupId),
    queryFn: async () => {
      if (!groupId) return [];
      const res = await getGroupJoinRequests(groupId);
      const list = res.data?.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(groupId && enabled),
    staleTime: 10 * 1000
  });
}

/**
 * Hook to get sent invitations for a group (Group Admin only).
 */
export function useGroupSentInvites(groupId, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.groupInvites(groupId),
    queryFn: async () => {
      if (!groupId) return [];
      const res = await getGroupInvites(groupId);
      const list = res.data?.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(groupId && enabled),
    staleTime: 10 * 1000
  });
}

/**
 * Hook to get compatible travel matches for an originating travel post.
 */
export function useOriginatingTravelMatches(travelId, enabled = true) {
  return useQuery({
    queryKey: ['travels', 'matches', travelId],
    queryFn: async () => {
      if (!travelId) return [];
      const res = await getTravelMatches(travelId);
      const list = res.data?.data || [];
      return Array.isArray(list) ? list : [];
    },
    enabled: Boolean(travelId && enabled),
    staleTime: 30 * 1000
  });
}

export default {
  useUserProfile,
  useMyTravels,
  useUserMatches,
  useUserMatchesData,
  useNotificationsList,
  useUnreadNotificationsCount,
  useTravels,
  useTravelDetails,
  useMyBookings,
  useReceivedBookings,
  useConfirmedBookings,
  useMySharedRideGroups,
  useDiscoverSharedRideGroups,
  useCompatibleFinds,
  useSharedRideGroupDetails,
  useReceivedGroupInvitations,
  useGroupJoinRequests,
  useGroupSentInvites,
  useOriginatingTravelMatches
};

