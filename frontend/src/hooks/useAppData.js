import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProfile, 
  saveProfile,
  updateProfile,
  getMyTravels, 
  getUserMatches, 
  getUnreadCount,
  getNotifications,
  markRead,
  markAllRead,
  getTravels,
  getTravelById,
  createTravel,
  updateTravel,
  deleteTravel,
  cancelTravel,
  getMyBookings,
  getReceivedBookings,
  getConfirmedBookings,
  createBooking,
  confirmBooking,
  cancelBooking,
  respondBooking,
  completeBooking,
  getCommunityPosts,
  getMySharedRideGroups,
  discoverSharedRideGroups,
  getSharedRideGroupById,
  createSharedRideGroup,
  createGroupFromFindMatch,
  directJoinSharedRideGroup,
  leaveSharedRideGroup,
  getReceivedInvitations,
  acceptGroupInvitation,
  rejectGroupInvitation,
  getGroupJoinRequests,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  getGroupInvites,
  inviteStudentToGroup,
  getTravelMatches,
  getCompatibleFinds
} from '../lib/api';
import { 
  QUERY_KEYS, 
  CACHE_DURATIONS,
  invalidateBookingQueries,
  invalidateRideQueries,
  invalidateGroupQueries,
  invalidateProfileQueries,
  invalidateNotificationQueries
} from '../lib/queryClient';
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
    ...CACHE_DURATIONS.PROFILE
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
    ...CACHE_DURATIONS.MY_RIDES
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
    ...CACHE_DURATIONS.HOME_MATCHES
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
    ...CACHE_DURATIONS.HOME_MATCHES
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
    ...CACHE_DURATIONS.NOTIFICATIONS
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
    ...CACHE_DURATIONS.UNREAD_COUNT
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
    ...CACHE_DURATIONS.MY_RIDES
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
    ...CACHE_DURATIONS.MY_RIDES
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
    ...CACHE_DURATIONS.BOOKINGS
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
    ...CACHE_DURATIONS.BOOKINGS
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
    ...CACHE_DURATIONS.BOOKINGS
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
    ...CACHE_DURATIONS.SHARED_GROUPS
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
    ...CACHE_DURATIONS.SHARED_GROUPS
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
    ...CACHE_DURATIONS.SHARED_GROUPS
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
    ...CACHE_DURATIONS.GROUP_DETAILS
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
    ...CACHE_DURATIONS.INVITATIONS
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
    ...CACHE_DURATIONS.INVITATIONS
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
    ...CACHE_DURATIONS.INVITATIONS
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
    ...CACHE_DURATIONS.HOME_MATCHES
  });
}

// ════════════════════════════════════════════════════════════════════════════
// MUTATION HOOKS WITH TARGETED CACHE INVALIDATION & DATA CONSISTENCY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Hook to create a ride booking with automatic cache invalidation.
 */
export function useCreateBookingMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => createBooking(payload),
    onSuccess: (data, variables, context) => {
      invalidateBookingQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCreateBookingMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to cancel a booking with automatic cache invalidation and seat restoration.
 */
export function useCancelBookingMutation(options = {}) {
  return useMutation({
    mutationFn: (bookingId) => cancelBooking(bookingId),
    onSuccess: (data, variables, context) => {
      invalidateBookingQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCancelBookingMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to confirm a booking with automatic cache invalidation and atomic seat reservation.
 */
export function useConfirmBookingMutation(options = {}) {
  return useMutation({
    mutationFn: (bookingId) => confirmBooking(bookingId),
    onSuccess: (data, variables, context) => {
      invalidateBookingQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useConfirmBookingMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to respond to a booking (accept/reject) with automatic cache invalidation.
 */
export function useRespondBookingMutation(options = {}) {
  return useMutation({
    mutationFn: ({ bookingId, action }) => respondBooking(bookingId, { action }),
    onSuccess: (data, variables, context) => {
      invalidateBookingQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useRespondBookingMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to complete a booking with automatic cache invalidation.
 */
export function useCompleteBookingMutation(options = {}) {
  return useMutation({
    mutationFn: (bookingId) => completeBooking(bookingId),
    onSuccess: (data, variables, context) => {
      invalidateBookingQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCompleteBookingMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to create a travel post (OFFER or FIND) with automatic cache invalidation.
 */
export function useCreateTravelMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => createTravel(payload),
    onSuccess: (data, variables, context) => {
      invalidateRideQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCreateTravelMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to update a travel post with automatic cache invalidation.
 */
export function useUpdateTravelMutation(options = {}) {
  return useMutation({
    mutationFn: ({ travelId, payload }) => updateTravel(travelId, payload),
    onSuccess: (data, variables, context) => {
      invalidateRideQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useUpdateTravelMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to cancel a travel post with automatic cache invalidation.
 */
export function useCancelTravelMutation(options = {}) {
  return useMutation({
    mutationFn: (travelId) => cancelTravel(travelId),
    onSuccess: (data, variables, context) => {
      invalidateRideQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCancelTravelMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to delete a travel post with automatic cache invalidation.
 */
export function useDeleteTravelMutation(options = {}) {
  return useMutation({
    mutationFn: (travelId) => deleteTravel(travelId),
    onSuccess: (data, variables, context) => {
      invalidateRideQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useDeleteTravelMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to create a Shared Ride Group with automatic cache invalidation.
 */
export function useCreateSharedRideGroupMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => createSharedRideGroup(payload),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCreateSharedRideGroupMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to create a Shared Ride Group from a FIND match proposal with automatic cache invalidation.
 */
export function useCreateGroupFromMatchMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => createGroupFromFindMatch(payload),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useCreateGroupFromMatchMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to directly join a Shared Ride Group with automatic cache invalidation.
 */
export function useDirectJoinGroupMutation(options = {}) {
  return useMutation({
    mutationFn: ({ groupId, payload }) => directJoinSharedRideGroup(groupId, payload),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useDirectJoinGroupMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to leave a Shared Ride Group with automatic cache invalidation.
 */
export function useLeaveGroupMutation(options = {}) {
  return useMutation({
    mutationFn: (groupId) => leaveSharedRideGroup(groupId),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useLeaveGroupMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to accept a group invitation with automatic cache invalidation.
 */
export function useAcceptGroupInvitationMutation(options = {}) {
  return useMutation({
    mutationFn: (requestId) => acceptGroupInvitation(requestId),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useAcceptGroupInvitationMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to reject a group invitation with automatic cache invalidation.
 */
export function useRejectGroupInvitationMutation(options = {}) {
  return useMutation({
    mutationFn: (requestId) => rejectGroupInvitation(requestId),
    onSuccess: (data, variables, context) => {
      invalidateGroupQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useRejectGroupInvitationMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to save or update student profile with automatic cache invalidation.
 */
export function useSaveProfileMutation(options = {}) {
  return useMutation({
    mutationFn: (payload) => saveProfile(payload),
    onSuccess: (data, variables, context) => {
      invalidateProfileQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useSaveProfileMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to mark a notification as read with automatic cache invalidation.
 */
export function useMarkNotificationReadMutation(options = {}) {
  return useMutation({
    mutationFn: (notifId) => markRead(notifId),
    onSuccess: (data, variables, context) => {
      invalidateNotificationQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useMarkNotificationReadMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
  });
}

/**
 * Hook to mark all notifications as read with automatic cache invalidation.
 */
export function useMarkAllNotificationsReadMutation(options = {}) {
  return useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: (data, variables, context) => {
      invalidateNotificationQueries();
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      console.error('[useMarkAllNotificationsReadMutation] Error:', error);
      options.onError?.(error, variables, context);
    },
    ...options
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
  useOriginatingTravelMatches,
  // Mutations
  useCreateBookingMutation,
  useCancelBookingMutation,
  useConfirmBookingMutation,
  useRespondBookingMutation,
  useCompleteBookingMutation,
  useCreateTravelMutation,
  useUpdateTravelMutation,
  useCancelTravelMutation,
  useDeleteTravelMutation,
  useCreateSharedRideGroupMutation,
  useCreateGroupFromMatchMutation,
  useDirectJoinGroupMutation,
  useLeaveGroupMutation,
  useAcceptGroupInvitationMutation,
  useRejectGroupInvitationMutation,
  useSaveProfileMutation,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation
};

