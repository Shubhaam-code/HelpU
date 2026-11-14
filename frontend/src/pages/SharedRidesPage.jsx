import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CarTaxiFront,
  Users,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Info,
  Mail,
  ChevronRight,
  RefreshCw,
  Search,
  Check,
  Zap,
  Car,
  Send,
  XCircle
} from 'lucide-react';
import { useUser } from '../context/FirebaseAuthContext';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { CreateGroupModal } from '../components/groups/CreateGroupModal';
import { GuestAuthPromptModal } from '../components/auth/GuestAuthPromptModal';
import {
  useUserProfile,
  useMyTravels,
  useMySharedRideGroups,
  useDiscoverSharedRideGroups,
  useCompatibleFinds,
  useReceivedGroupInvitations
} from '../hooks/useAppData';
import {
  createGroupJoinRequest,
  acceptGroupInvitation,
  rejectGroupInvitation,
  createGroupFromFindMatch,
  leaveSharedRideGroup,
  getGroupInvites,
  getSentGroupProposals,
  withdrawInvitation
} from '../lib/api';
import { invalidateGroupQueries } from '../lib/queryClient';
import { formatMinutesToTime } from '../lib/utils';

/**
 * Format date string into friendly bold format (e.g. Sat, 14 Nov)
 */
function formatTravelDate(dateStr) {
  if (!dateStr) return 'Upcoming Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Upcoming Date';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export default function SharedRidesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { data: profile } = useUserProfile();
  const { data: rawUserTravels, isLoading: travelsLoading, refetch: refetchTravels } = useMyTravels();
  const userTravels = Array.isArray(rawUserTravels) ? rawUserTravels : [];

  const { data: rawMyGroups, isLoading: myGroupsLoading, refetch: refetchMyGroups } = useMySharedRideGroups();
  const myGroups = Array.isArray(rawMyGroups) ? rawMyGroups : [];

  const { data: rawReceivedInvites, isLoading: invitesLoading, refetch: refetchInvitations } = useReceivedGroupInvitations();
  const receivedInvitations = Array.isArray(rawReceivedInvites) ? rawReceivedInvites : [];

  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'my-groups' | 'sent-invitations' | 'received-invitations'
  const [selectedTravelId, setSelectedTravelId] = useState(null);
  const [requestingGroupId, setRequestingGroupId] = useState(null);
  const [leavingGroupId, setLeavingGroupId] = useState(null);
  const [actingInviteId, setActingInviteId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [requestedGroupIds, setRequestedGroupIds] = useState(() => new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creatingMatchGroupId, setCreatingMatchGroupId] = useState(null);
  const [groupSizeModalPeer, setGroupSizeModalPeer] = useState(null);
  const [selectedGroupSize, setSelectedGroupSize] = useState(4);
  const [groupModalError, setGroupModalError] = useState(null);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(null);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [loadingSentInvites, setLoadingSentInvites] = useState(false);
  const [withdrawingInviteId, setWithdrawingInviteId] = useState(null);
  const [confirmWithdrawInvite, setConfirmWithdrawInvite] = useState(null);

  // Active unexpired FIND posts created by this student
  const activeFindPosts = useMemo(() => {
    const now = new Date();
    return userTravels.filter((t) => {
      const isFind = t.type === 'request';
      const isActive = t.status === 'active';
      const isUnexpired = !t.expiresAt || new Date(t.expiresAt) > now;
      return isFind && isActive && isUnexpired;
    });
  }, [userTravels]);

  // Sync selected FIND post ID
  const currentTravelId = useMemo(() => {
    if (selectedTravelId && activeFindPosts.some((p) => p._id === selectedTravelId)) {
      return selectedTravelId;
    }
    return activeFindPosts[0]?._id || null;
  }, [selectedTravelId, activeFindPosts]);

  // Fetch compatible groups for the currently selected active FIND post
  const {
    data: rawDiscoveredGroups,
    isLoading: discoverLoading,
    isFetching: isFetchingDiscover,
    error: discoverError,
    refetch: refetchDiscover
  } = useDiscoverSharedRideGroups(currentTravelId);
  const discoveredGroups = Array.isArray(rawDiscoveredGroups) ? rawDiscoveredGroups : [];

  // Fetch compatible FIND peer posts for smart group proposal suggestions
  const {
    data: rawCompatibleFinds,
    isLoading: compatibleFindsLoading,
    refetch: refetchCompatibleFinds
  } = useCompatibleFinds(currentTravelId);
  const compatibleFinds = Array.isArray(rawCompatibleFinds) ? rawCompatibleFinds : [];

  // Existing active group membership (One Active Group Per Student rule)
  const activeMemberGroup = useMemo(() => {
    return myGroups.find((g) => g.status === 'open' || g.status === 'full') || null;
  }, [myGroups]);

  // Sync ?createFromTravelId=...&peerTravelId=... and ?tab=... from deep-links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const createFromId = params.get('createFromTravelId');
    const peerTravelId = params.get('peerTravelId');
    const tabParam = params.get('tab');

    if (tabParam === 'invitations' || tabParam === 'received' || tabParam === 'received-invitations') {
      setActiveTab('received-invitations');
    } else if (tabParam === 'sent-invitations' || tabParam === 'sent') {
      setActiveTab('sent-invitations');
    } else if (tabParam === 'my-groups' || tabParam === 'my') {
      setActiveTab('my-groups');
    } else if (tabParam === 'discover') {
      setActiveTab('discover');
    }

    if (createFromId && activeFindPosts.some((p) => p._id === createFromId)) {
      setSelectedTravelId(createFromId);
    }

    if (peerTravelId && compatibleFinds.length > 0 && currentTravelId) {
      const targetPeer = compatibleFinds.find((p) => p._id === peerTravelId);
      if (targetPeer) {
        setActiveTab('discover');
        setSelectedGroupSize(4);
        setGroupModalError(null);
        setGroupSizeModalPeer(targetPeer);
        navigate('/shared-rides', { replace: true });
      }
    }
  }, [location.search, activeFindPosts, compatibleFinds, currentTravelId, navigate]);

  // Auto-dismiss toast feedback after 5 seconds
  const showFeedback = (type, text) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // Groups where user is the admin (for sent invites management)
  const adminGroups = useMemo(() => {
    return (myGroups || []).filter(
      (g) => g.adminId === user?.id || (Array.isArray(g.members) && g.members.some((m) => m.userId === user?.id && m.role === 'admin'))
    );
  }, [myGroups, user?.id]);

  // Fetch sent invitations AND formation proposals
  const fetchSentInvitations = useCallback(async () => {
    setLoadingSentInvites(true);
    try {
      // Fetch formation proposals sent by current user
      const proposalsRes = await getSentGroupProposals();
      const proposals = proposalsRes.data?.data || [];

      // Fetch invitations for groups where user is admin
      let groupInvites = [];
      if (adminGroups.length > 0) {
        const results = await Promise.allSettled(
          adminGroups.map(async (g) => {
            const res = await getGroupInvites(g._id);
            const list = res.data?.data || res.data?.invites || [];
            return list.map((inv) => ({
              ...inv,
              groupId: g._id,
              groupRoute: `${g.source} → ${g.destination}`,
              groupDate: g.travelDate,
              groupTime: g.departureTime,
              groupAdminName: g.admin?.name || 'You'
            }));
          })
        );
        groupInvites = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value || []);
      }

      // Combine both: formation proposals + group invitations
      const combined = [...proposals, ...groupInvites];
      setSentInvitations(combined);
    } catch (err) {
      console.error('Error fetching sent invites:', err);
    } finally {
      setLoadingSentInvites(false);
    }
  }, [adminGroups]);

  useEffect(() => {
    if (activeTab === 'sent-invitations' || activeTab === 'received-invitations') {
      fetchSentInvitations();
    }
  }, [activeTab, fetchSentInvitations]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDiscover(),
        refetchCompatibleFinds(),
        refetchMyGroups(),
        refetchInvitations(),
        refetchTravels(),
        fetchSentInvitations()
      ]);
      showFeedback('success', 'Rides and invitations updated!');
    } catch {
      showFeedback('error', 'Failed to refresh. Please check network.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Group Size selector modal before creating a Shared Ride Group with a peer
  const handleCreateGroupWithPeer = (peerTravel) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!currentTravelId || !peerTravel?._id) return;
    setSelectedGroupSize(4);
    setGroupModalError(null);
    setGroupSizeModalPeer(peerTravel);
  };

  // Confirm initiating a Shared Ride Group with the chosen group size
  const handleConfirmCreateGroupWithPeer = async () => {
    if (!currentTravelId || !groupSizeModalPeer?._id) return;
    const peerTravel = groupSizeModalPeer;
    setCreatingMatchGroupId(peerTravel._id);
    setGroupModalError(null);
    try {
      const res = await createGroupFromFindMatch({
        originatingTravelId: currentTravelId,
        candidateTravelId: peerTravel._id,
        targetCapacity: selectedGroupSize
      });
      invalidateGroupQueries();
      refetchDiscover();
      refetchMyGroups();
      refetchCompatibleFinds();
      setGroupSizeModalPeer(null);
      const group = res.data?.data?.group || res.data?.group;
      if (group?._id) {
        showFeedback('success', 'Shared Ride Group created!');
        navigate(`/groups/${group._id}`, {
          state: { from: 'discover', fromLabel: 'Back to Discover Groups' }
        });
      } else {
        showFeedback('success', 'Group formation proposal sent! Awaiting student response.');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create group proposal.';
      setGroupModalError(message);
      showFeedback('error', message);
    } finally {
      setCreatingMatchGroupId(null);
    }
  };

  // Open Leave Group Confirmation Dialog
  const handleOpenLeaveModal = (e, group) => {
    e.stopPropagation();
    setConfirmLeaveGroup(group);
  };

  // Confirmed leave group execution
  const handleLeaveGroupConfirmed = async (groupId) => {
    if (!groupId) return;
    setLeavingGroupId(groupId);
    try {
      await leaveSharedRideGroup(groupId);
      invalidateGroupQueries();
      refetchMyGroups();
      refetchDiscover();
      fetchSentInvitations();
      showFeedback('info', 'You have left the group. Your active FIND post remains active.');
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      showFeedback('error', message || 'Failed to leave group.');
    } finally {
      setLeavingGroupId(null);
      setConfirmLeaveGroup(null);
    }
  };

  // Handle Request to Join a discovered group (fallback)
  const handleRequestToJoin = async (group) => {
    if (!currentTravelId) {
      showFeedback('error', 'Please create or select an active FIND ride post first.');
      return;
    }

    if (group.availableSpots <= 0) {
      showFeedback('error', 'This group has already reached its capacity.');
      return;
    }

    setRequestingGroupId(group._id);
    try {
      await createGroupJoinRequest(group._id, { travelId: currentTravelId });
      setRequestedGroupIds((prev) => new Set([...prev, group._id]));
      invalidateGroupQueries();
      showFeedback(
        'success',
        `Join request sent to ${group.admin?.name || 'group admin'}! You will be notified once reviewed.`
      );
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;

      if (status === 409) {
        setRequestedGroupIds((prev) => new Set([...prev, group._id]));
        showFeedback('info', 'A pending join request or invitation already exists for this group.');
      } else {
        showFeedback('error', message || 'Failed to submit join request. Please try again.');
      }
    } finally {
      setRequestingGroupId(null);
    }
  };

  // Handle Accept received invitation / formation proposal
  const handleAcceptInvite = async (invitation) => {
    setActingInviteId(invitation._id);
    try {
      const res = await acceptGroupInvitation(invitation._id);
      invalidateGroupQueries();
      refetchInvitations();
      refetchMyGroups();
      refetchDiscover();
      fetchSentInvitations(); // Refresh sent invitations for the sender
      showFeedback('success', 'Invitation accepted! You are now a confirmed group member.');
      const targetGroupId = res?.data?.data?.group?._id || res?.data?.group?._id || invitation.groupId?._id || invitation.groupId;
      if (targetGroupId) {
        navigate(`/groups/${targetGroupId}`, {
          state: { from: 'invitations', fromLabel: 'Back to Invitations' }
        });
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to accept invitation.');
    } finally {
      setActingInviteId(null);
    }
  };

  // Handle Reject received invitation
  const handleRejectInvite = async (invitation) => {
    setActingInviteId(invitation._id);
    try {
      await rejectGroupInvitation(invitation._id);
      invalidateGroupQueries();
      refetchInvitations();
      fetchSentInvitations(); // Refresh sent invitations for the sender
      showFeedback('info', 'Invitation declined.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to decline invitation.');
    } finally {
      setActingInviteId(null);
    }
  };

  // Handle Withdraw sent invitation (sender cancels)
  const handleWithdrawInvite = async (invitation) => {
    if (!confirmWithdrawInvite) {
      setConfirmWithdrawInvite(invitation);
      return;
    }
    
    setWithdrawingInviteId(invitation._id);
    try {
      await withdrawInvitation(invitation._id);
      invalidateGroupQueries();
      refetchInvitations();
      fetchSentInvitations();
      setConfirmWithdrawInvite(null);
      showFeedback('info', 'Invitation withdrawn successfully.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to withdraw invitation.');
    } finally {
      setWithdrawingInviteId(null);
    }
  };

  const selectedPostObj = activeFindPosts.find((p) => p._id === currentTravelId);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      customMobileHeader={
        <AppHeader
          title="Shared Rides"
          backTo="/home"
          avatarId={profile?.avatarId}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-1 pb-8 sm:pt-3 sm:pb-12 space-y-4 sm:space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. MODERN HERO CARD (MATCHING NEW HELPU DESIGN)                           */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-[24px] sm:rounded-[32px] border border-[#F4E3D8] shadow-xs overflow-hidden p-4 sm:p-6 lg:p-7"
        >
          {/* Subtle warm cream background glow at top */}
          <div className="absolute top-0 right-0 left-0 h-28 bg-gradient-to-b from-[#FFF5EE]/80 to-transparent pointer-events-none" />

          {/* Content Row: Text + Buttons on Left, Hero Illustration on Right */}
          <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-6">
            
            {/* Left Content */}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-[#17233C] text-[22px] min-[390px]:text-[24px] sm:text-3xl md:text-4xl leading-[1.18] tracking-tight">
                Shared <span className="text-[#FF572E]">Rides</span>
              </h1>

              <p className="text-xs sm:text-[13px] md:text-sm text-[#6E7587] font-medium leading-relaxed mt-1.5 max-w-[210px] min-[390px]:max-w-[250px] sm:max-w-md">
                Find students travelling on a similar route and split cab fares together.
              </p>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2.5 pt-3.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => user ? setShowCreateModal(true) : setShowAuthModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.98] text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Create Group</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white hover:bg-[#FFF7F2] active:scale-[0.98] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] rounded-full font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Refresh rides and invites"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#FF572E] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Right Illustration: Prominent & Crisp */}
            <div className="shrink-0 w-[130px] min-[380px]:w-[150px] min-[410px]:w-[170px] sm:w-[210px] md:w-[245px] -mr-1 sm:-mr-2 flex justify-end items-center">
              <img
                src="/car-hero.png"
                alt="Helpu Shared Rides"
                className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xs"
                onError={(e) => {
                  e.currentTarget.src = '/car.png';
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 2. TOAST FEEDBACK NOTIFICATION                                            */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : feedbackMsg.type === 'info'
                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
              <button
                onClick={() => setFeedbackMsg(null)}
                className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* 3. MODERN SEGMENTED TABS: Discover | My Groups | Invitations              */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Discover Tab */}
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'discover'
                  ? 'bg-[#FF572E] text-white shadow-md shadow-[#FF572E]/25 scale-[1.01]'
                  : 'bg-white text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F4] border border-[#F4E3D8] shadow-2xs'
              }`}
            >
              <span>Discover Groups</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${
                  activeTab === 'discover'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFF2EA] text-[#FF572E]'
                }`}
              >
                {discoveredGroups.length}
              </span>
            </button>

            {/* My Groups Tab */}
            <button
              onClick={() => setActiveTab('my-groups')}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'my-groups'
                  ? 'bg-[#FF572E] text-white shadow-md shadow-[#FF572E]/25 scale-[1.01]'
                  : 'bg-white text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F4] border border-[#F4E3D8] shadow-2xs'
              }`}
            >
              <span>My Groups</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${
                  activeTab === 'my-groups'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFF2EA] text-[#FF572E]'
                }`}
              >
                {myGroups.length}
              </span>
            </button>

            {/* Sent Invitations Tab */}
            <button
              onClick={() => setActiveTab('sent-invitations')}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'sent-invitations'
                  ? 'bg-[#FF572E] text-white shadow-md shadow-[#FF572E]/25 scale-[1.01]'
                  : 'bg-white text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F4] border border-[#F4E3D8] shadow-2xs'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Sent</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${
                  activeTab === 'sent-invitations'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFF2EA] text-[#FF572E]'
                }`}
              >
                {sentInvitations.length}
              </span>
            </button>

            {/* Received Invitations Tab */}
            <button
              onClick={() => setActiveTab('received-invitations')}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'received-invitations'
                  ? 'bg-[#FF572E] text-white shadow-md shadow-[#FF572E]/25 scale-[1.01]'
                  : 'bg-white text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F4] border border-[#F4E3D8] shadow-2xs'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Received</span>
              {receivedInvitations.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-rose-500 text-white animate-pulse shadow-xs">
                  {receivedInvitations.length}
                </span>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black ${
                    activeTab === 'received-invitations'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#FFF2EA] text-[#FF572E]'
                  }`}
                >
                  0
                </span>
              )}
            </button>
          </div>

          {activeTab === 'discover' && isFetchingDiscover && !discoverLoading && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF3EC] text-[11px] font-bold text-[#FF572E] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF572E] animate-ping" />
              <span>Updating matches...</span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. DISCOVER GROUPS TAB CONTENT                                            */}
        {/* ========================================================================= */}
        {activeTab === 'discover' && (
          <div className="space-y-4">
            
            {/* Active FIND Post Context Card */}
            {activeFindPosts.length > 0 ? (
              <div className="relative bg-gradient-to-r from-white via-[#FFFBF8] to-[#FFF5EE] rounded-[22px] sm:rounded-[26px] border border-[#FDE3D3] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FFE4D3] text-[#FF572E] flex items-center justify-center shrink-0 shadow-2xs">
                    <CarTaxiFront className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Route Matching
                      </span>
                      <span className="text-[11px] font-semibold text-[#8C93A4] hidden sm:inline">
                        Matching against your active FIND post
                      </span>
                    </div>

                    {selectedPostObj ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-extrabold text-[#17233C]">
                        <span className="truncate">{selectedPostObj.source} → {selectedPostObj.destination}</span>
                        <span className="text-[#6E7587] font-semibold text-xs inline-flex items-center gap-2">
                          <span>•</span>
                          <span>{formatTravelDate(selectedPostObj.travelDate)}</span>
                          <span>•</span>
                          <span>{formatMinutesToTime(selectedPostObj.departureTime)}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-[#6E7587]">Select an active post to match</div>
                    )}
                  </div>
                </div>

                {/* Dropdown if student has multiple active FIND posts */}
                {activeFindPosts.length > 1 && (
                  <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#FDE0D0]">
                    <span className="text-xs font-bold text-[#6E7587]">Switch Post:</span>
                    <select
                      value={currentTravelId || ''}
                      onChange={(e) => setSelectedTravelId(e.target.value)}
                      className="text-xs font-bold bg-white text-[#17233C] border border-[#F4E3D8] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/30 cursor-pointer shadow-2xs"
                    >
                      {activeFindPosts.map((post) => (
                        <option key={post._id} value={post._id}>
                          {post.source} → {post.destination} ({formatTravelDate(post.travelDate)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              /* No Active FIND Post Guidance Box */
              <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/70 rounded-[24px] border border-amber-200/80 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold shadow-2xs">
                    <Info className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#17233C] text-sm sm:text-base">
                      Create a FIND Post to Discover Compatible Groups
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6E7587] mt-0.5 leading-relaxed max-w-xl">
                      Shared Ride discovery matches your destination, travel date, and 7-hour departure window. You need an active FIND ride post to discover and request to join open groups.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/rides/request')}
                  className="shrink-0 w-full sm:w-auto px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                >
                  Create FIND Post
                </button>
              </div>
            )}

            {/* Compatible Peer Students for Smart Group Creation */}
            {compatibleFinds.length > 0 && (
              <div className="space-y-3 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF572E] animate-pulse" />
                    <h3 className="font-extrabold text-sm sm:text-base text-[#17233C]">
                      Compatible Students Found ({compatibleFinds.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-[#FF572E] bg-[#FFF4ED] px-2.5 py-1 rounded-full border border-[#FDE0D0]">
                    Form a Group
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {compatibleFinds.map((peer) => {
                    const isCreating = creatingMatchGroupId === peer._id;
                    const peerName = peer.student?.name || 'Fellow Student';
                    return (
                      <div
                        key={peer._id}
                        className="bg-white rounded-2xl border border-[#FDE0D0] p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-[#FF572E]/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              src={peer.student?.imageUrl}
                              name={peerName}
                              size={36}
                              className="border border-[#F4E3D8] shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                                {peerName}
                              </h4>
                              <span className="text-[10.5px] font-semibold text-[#8C93A4] truncate block">
                                {peer.student?.college || 'Campus Peer'}
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10.5px] font-black text-[#FF572E] bg-[#FFF4ED] px-2 py-0.5 rounded-full border border-[#FDE0D0]">
                            FIND Match
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-[#475569] space-y-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-[#17233C]">{peer.source}</span>
                            <span>→</span>
                            <span className="font-bold text-[#17233C]">{peer.destination}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-[#6E7587]">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#FF572E]" />
                              {formatTravelDate(peer.travelDate)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#FF572E]" />
                              {formatMinutesToTime(peer.departureTime)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isCreating}
                          onClick={() => handleCreateGroupWithPeer(peer)}
                          className="w-full py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                          {isCreating ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Creating Group...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Create Group Together</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Discovered Groups List */}
            {(discoverLoading || travelsLoading || (isFetchingDiscover && discoveredGroups.length === 0)) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 bg-white/70 rounded-[24px] animate-pulse border border-[#F4E3D8]" />
                ))}
              </div>
            ) : discoverError ? (
              <div className="bg-white rounded-[28px] border border-rose-200 p-8 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-black text-[#17233C] text-base sm:text-lg">
                  Unable to load compatible groups
                </h3>
                <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto">
                  {discoverError?.response?.data?.message || discoverError?.message || 'Please check your connection and try again.'}
                </p>
                <button
                  type="button"
                  onClick={() => refetchDiscover()}
                  className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-full shadow-xs cursor-pointer"
                >
                  Retry Discovery
                </button>
              </div>
            ) : discoveredGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {discoveredGroups.map((group) => {
                  const previewMembers = Array.isArray(group.membersPreview) ? group.membersPreview : [];

                  return (
                    <motion.div
                      key={group._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between group shadow-xs"
                    >
                      {/* Top Row: Admin Info & Available Spots */}
                      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={group.admin?.imageUrl}
                            name={group.admin?.name || 'Admin'}
                            size={40}
                            className="border border-[#F4E3D8] shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-[#17233C] truncate">
                                {group.admin?.name || 'Student Admin'}
                              </span>
                              {group.admin?.isVerified && (
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-[#8C93A4]">
                              Group Organizer
                            </span>
                          </div>
                        </div>

                        {/* Spots Pill */}
                        <div className="shrink-0 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-2xs">
                          {group.availableSpots}{' '}
                          {group.availableSpots === 1 ? 'spot left' : 'spots left'}
                        </div>
                      </div>

                      {/* Route Details */}
                      <div className="py-4 space-y-2.5">
                        <div className="flex items-center gap-2 font-black text-base sm:text-lg text-[#17233C]">
                          <span className="truncate">{group.source}</span>
                          <ArrowRight className="w-4 h-4 text-[#FF572E] shrink-0" strokeWidth={2.5} />
                          <span className="truncate">{group.destination}</span>
                        </div>

                        {/* Meta Chips */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E7587] font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatTravelDate(group.travelDate)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatMinutesToTime(group.departureTime)}</span>
                          </div>
                        </div>

                        {/* Progress Bar for Capacity */}
                        <div className="pt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-[#17233C]">
                            <span>
                              {group.confirmedMemberCount} / {group.targetCapacity} Confirmed
                            </span>
                            <span className="text-[#FF572E] text-[11px]">
                              {Math.max(0, group.targetCapacity - group.confirmedMemberCount)} needed
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[#FFF2EB] rounded-full overflow-hidden border border-[#FDE0D0]">
                            <div
                              className="h-full bg-[#FF572E] rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((group.confirmedMemberCount || 1) / (group.targetCapacity || 1)) * 100
                                )}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* Members Preview */}
                        {previewMembers.length > 0 && (
                          <div className="flex items-center gap-2 pt-1.5">
                            <div className="flex -space-x-2">
                              {previewMembers.slice(0, 4).map((m, idx) => (
                                <Avatar
                                  key={m.userId || idx}
                                  src={m.imageUrl}
                                  name={m.name || 'Member'}
                                  size={24}
                                  className="ring-2 ring-white"
                                />
                              ))}
                            </div>
                            <span className="text-[11px] font-semibold text-[#6E7587] truncate">
                              {previewMembers.map((m) => m.name?.split(' ')[0]).filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action: Inspect Group Details before Requesting to Join */}
                      <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-[#8C93A4]">
                          Target: {group.targetCapacity} passengers
                        </span>

                        <button
                          type="button"
                          onClick={() => navigate(`/groups/${group._id}`, {
                            state: { from: 'discover', fromLabel: 'Back to Discover Groups' }
                          })}
                          className="px-4 sm:px-5 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 bg-[#FF572E] hover:bg-[#E64A22] text-white shadow-md shadow-[#FF572E]/20"
                        >
                          <span>View Group Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : activeMemberGroup ? (
              activeFindPosts.length > 0 && (
                <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] p-8 sm:p-10 text-center space-y-4 shadow-xs">
                  <div className="w-16 h-16 rounded-3xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mx-auto shadow-sm">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                      You are already in an active Shared Ride Group
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed mt-1.5">
                      Each student can belong to only one active group at a time. Open your active group ({activeMemberGroup.source} → {activeMemberGroup.destination}) or leave it to discover other groups.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/groups/${activeMemberGroup._id}`, {
                        state: { from: 'discover', fromLabel: 'Back to Discover Groups' }
                      })}
                      className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer active:scale-95"
                    >
                      Open My Active Group →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('my-groups')}
                      className="px-5 py-3 bg-white hover:bg-[#FFF8F4] border border-[#F4E3D8] text-[#17233C] text-xs sm:text-sm font-bold rounded-full shadow-2xs transition-all cursor-pointer"
                    >
                      View My Groups
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* BUG 1 FIX: Enhanced Empty state only when BOTH groups AND compatible students are empty */
              activeFindPosts.length > 0 && discoveredGroups.length === 0 && compatibleFinds.length === 0 && (
                <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] p-8 sm:p-12 text-center space-y-4 shadow-xs">
                  <div className="w-16 h-16 rounded-3xl bg-[#FFF0E6] text-[#FF572E] flex items-center justify-center mx-auto shadow-sm">
                    <CarTaxiFront className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                      No compatible groups or students found yet
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed mt-1.5">
                      We couldn't find any open groups or compatible students matching your route ({selectedPostObj?.source} → {selectedPostObj?.destination}) on {formatTravelDate(selectedPostObj?.travelDate)}. Check back soon or create your own group!
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => user ? setShowCreateModal(true) : setShowAuthModal(true)}
                      className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer active:scale-95"
                    >
                      Create a Group for This Route
                    </button>
                    <button
                      onClick={() => navigate('/rides')}
                      className="px-5 py-3 bg-white hover:bg-[#FFF8F4] border border-[#F4E3D8] text-[#17233C] text-xs sm:text-sm font-bold rounded-full shadow-2xs transition-all cursor-pointer"
                    >
                      Browse Other Rides
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. MY GROUPS TAB CONTENT                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'my-groups' && (
          <div className="space-y-4">
            {myGroupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 bg-white/70 rounded-[24px] animate-pulse border border-[#F4E3D8]" />
                ))}
              </div>
            ) : myGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {myGroups.map((group) => {
                  const isAdmin = group.adminId === user?.id;
                  const confirmedCount = Array.isArray(group.members) ? group.members.length : 0;

                  return (
                    <motion.div
                      key={group._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(`/groups/${group._id}`, {
                        state: { from: 'my-groups', fromLabel: 'Back to My Groups' }
                      })}
                      className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between cursor-pointer group shadow-xs"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                              isAdmin
                                ? 'bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE]'
                                : 'bg-[#EBF5FF] text-[#2563EB] border border-[#BFDBFE]'
                            }`}
                          >
                            {isAdmin ? 'Group Admin' : 'Confirmed Member'}
                          </span>
                        </div>
                        <StatusBadge status={group.status} />
                      </div>

                      {/* Route */}
                      <div className="py-4 space-y-2.5">
                        <div className="flex items-center gap-2 font-black text-base sm:text-lg text-[#17233C] group-hover:text-[#FF572E] transition-colors">
                          <span className="truncate">{group.source}</span>
                          <ArrowRight className="w-4 h-4 text-[#FF572E] shrink-0" strokeWidth={2.5} />
                          <span className="truncate">{group.destination}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E7587] font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatTravelDate(group.travelDate)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatMinutesToTime(group.departureTime)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#F4E3D8] text-[#17233C]">
                            <Users className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>
                              {confirmedCount} / {group.targetCapacity} Members
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: View details link + Leave Group button */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold">
                        <button
                          type="button"
                          disabled={leavingGroupId === group._id}
                          onClick={(e) => handleOpenLeaveModal(e, group)}
                          className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer text-xs font-bold disabled:opacity-50"
                        >
                          {leavingGroupId === group._id ? 'Leaving...' : 'Leave Group'}
                        </button>
                        <div className="flex items-center gap-1 text-[#FF572E]">
                          <span>Manage & View Group</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Enhanced Empty state if student has no groups */
              <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] p-8 sm:p-12 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-[#EBF5FF] text-[#2563EB] flex items-center justify-center mx-auto shadow-sm">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                    No groups joined yet
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed mt-1.5">
                    You are not currently a member of any shared ride groups. Find a compatible group under Discover Groups or create your own ride group!
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-full shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer active:scale-95"
                  >
                    Explore Open Groups
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. INVITATIONS TAB CONTENT (RECEIVED & SENT INVITATIONS SUB-TABS)        */}
        {/* ========================================================================= */}
        {activeTab === 'sent-invitations' && (
          <div className="space-y-4">
            {/* A. SENT INVITATIONS TAB */}
            {loadingSentInvites ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 bg-white/70 rounded-[24px] animate-pulse border border-[#F4E3D8]" />
                ))}
              </div>
            ) : sentInvitations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {sentInvitations.map((inv) => {
                  const recipientName = inv.recipientName || inv.recipient?.name || inv.requester?.name || 'Student';
                  const recipientAvatar = inv.recipient?.imageUrl || inv.requester?.imageUrl;
                  const groupObj = inv.groupId || {};

                  return (
                    <motion.div
                      key={inv._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between shadow-xs"
                    >
                      {/* Top Bar: Recipient Info */}
                      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={recipientAvatar}
                            name={recipientName}
                            size={40}
                            className="border border-[#F4E3D8] shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-[#17233C] truncate">
                                {recipientName}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-[#6E7587]">
                              Invitation sent
                            </span>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[10px] font-black uppercase tracking-wider">
                          Pending
                        </span>
                      </div>

                      {/* Route Details */}
                      <div className="py-4 space-y-2.5">
                        <div className="flex items-center gap-2 font-black text-base sm:text-lg text-[#17233C]">
                          <span className="truncate">{groupObj.source || inv.source || 'Campus'}</span>
                          <ArrowRight className="w-4 h-4 text-[#FF572E] shrink-0" strokeWidth={2.5} />
                          <span className="truncate">{groupObj.destination || inv.destination || 'Destination'}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E7587] font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatTravelDate(groupObj.travelDate || inv.travelDate)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatMinutesToTime(groupObj.departureTime || inv.departureTime)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action: Withdraw Button */}
                      <div className="pt-3.5 border-t border-gray-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmWithdrawInvite(inv)}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Withdraw</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] p-8 sm:p-12 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-[#FFF9F5] text-[#FF572E] flex items-center justify-center mx-auto shadow-sm">
                  <Send className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                    No invitations sent yet
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed mt-1.5">
                    {adminGroups.length > 0
                      ? 'You can invite compatible students directly from your Group Details page.'
                      : 'Create a shared ride group as an organizer to start inviting fellow campus students.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 7. RECEIVED INVITATIONS TAB CONTENT                                      */}
        {/* ========================================================================= */}
        {activeTab === 'received-invitations' && (
          <div className="space-y-4">
            {invitesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 bg-white/70 rounded-[24px] animate-pulse border border-[#F4E3D8]" />
                ))}
              </div>
            ) : receivedInvitations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {receivedInvitations.map((inv) => {
                  const isActing = actingInviteId === inv._id;
                  const groupObj = inv.groupId || {};

                  return (
                    <motion.div
                      key={inv._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] hover:border-[#FF572E]/40 hover:shadow-md transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between shadow-xs"
                    >
                      {/* Top Bar: Admin Info */}
                      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={inv.admin?.imageUrl}
                            name={inv.admin?.name || 'Group Admin'}
                            size={40}
                            className="border border-[#F4E3D8] shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-[#17233C] truncate">
                                {inv.admin?.name || 'Campus Peer'}
                              </span>
                              {inv.admin?.isVerified && (
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-[#FF572E]">
                              Invited you to ride
                            </span>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                          Pending Invite
                        </span>
                      </div>

                      {/* Route Details */}
                      <div className="py-4 space-y-2.5">
                        <div className="flex items-center gap-2 font-black text-base sm:text-lg text-[#17233C]">
                          <span className="truncate">{groupObj.source || 'Campus'}</span>
                          <ArrowRight className="w-4 h-4 text-[#FF572E] shrink-0" strokeWidth={2.5} />
                          <span className="truncate">{groupObj.destination || 'Destination'}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E7587] font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatTravelDate(groupObj.travelDate)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3]">
                            <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>{formatMinutesToTime(groupObj.departureTime)}</span>
                          </div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#F4E3D8] text-[#17233C]">
                            <Users className="w-3.5 h-3.5 text-[#FF572E]" />
                            <span>
                              {inv.confirmedMemberCount || 1} / {inv.targetCapacity || 4} Members
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action: Accept / Reject Buttons */}
                      <div className="pt-3.5 border-t border-gray-100 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleRejectInvite(inv)}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-gray-100 hover:bg-gray-200 text-[#17233C] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleAcceptInvite(inv)}
                          className="px-5 py-2 rounded-full text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                          {isActing ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Accepting...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Accept Invite</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Enhanced Empty state if no received invitations */
              <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-[#F4E3D8] p-8 sm:p-12 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-[#FFF9F5] text-[#FF572E] flex items-center justify-center mx-auto shadow-sm">
                  <Mail className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-black text-[#17233C] text-lg sm:text-xl">
                    No pending invitations
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed mt-1.5">
                    When group organizers invite you to pool together, their invitations will appear right here with one-click acceptance.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

  </div>

  {/* Leave Group Confirmation Dialog */}
  <Modal
    isOpen={Boolean(confirmLeaveGroup)}
    onClose={() => setConfirmLeaveGroup(null)}
    title="Leave Shared Ride Group"
    subtitle="Review before leaving this group"
    actions={
      confirmLeaveGroup ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={() => setConfirmLeaveGroup(null)}
            className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={leavingGroupId === confirmLeaveGroup._id}
            onClick={() => handleLeaveGroupConfirmed(confirmLeaveGroup._id)}
            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {leavingGroupId === confirmLeaveGroup._id ? 'Leaving...' : 'Confirm & Leave'}
          </button>
        </div>
      ) : null
    }
  >
    {confirmLeaveGroup && (
      <div className="space-y-3.5">
        <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] space-y-2.5 text-xs">
          <div className="flex items-center gap-2 font-black text-sm text-[#17233C]">
            <span>{confirmLeaveGroup.source}</span>
            <span className="text-[#FF572E]">→</span>
            <span>{confirmLeaveGroup.destination}</span>
          </div>
          <div className="flex items-center gap-3 text-[#6E7587] text-[11px]">
            <span>{formatTravelDate(confirmLeaveGroup.travelDate)}</span>
            <span>•</span>
            <span>{formatMinutesToTime(confirmLeaveGroup.departureTime)}</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Your FIND post remains safe</span>
          </div>
          <p className="text-[11.5px] leading-relaxed">
            Leaving this group will <strong>not</strong> delete or cancel your active FIND ride post. You can continue matching with normal vehicle offers and other student groups.
          </p>
        </div>
      </div>
    )}
  </Modal>

  {/* Withdraw Invitation Confirmation Dialog */}
  <Modal
    isOpen={Boolean(confirmWithdrawInvite)}
    onClose={() => setConfirmWithdrawInvite(null)}
    title="Withdraw Invitation"
    subtitle="Are you sure you want to withdraw this invitation?"
    actions={
      confirmWithdrawInvite ? (
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={() => setConfirmWithdrawInvite(null)}
            className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={withdrawingInviteId === confirmWithdrawInvite._id}
            onClick={() => handleWithdrawInvite(confirmWithdrawInvite)}
            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {withdrawingInviteId === confirmWithdrawInvite._id ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Withdrawing...</span>
              </>
            ) : (
              'Confirm & Withdraw'
            )}
          </button>
        </div>
      ) : null
    }
  >
    {confirmWithdrawInvite && (
      <div className="space-y-3.5">
        <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] space-y-2.5 text-xs">
          <div className="flex items-center gap-3">
            <Avatar
              src={confirmWithdrawInvite.recipient?.imageUrl || confirmWithdrawInvite.requester?.imageUrl}
              name={confirmWithdrawInvite.recipientName || confirmWithdrawInvite.recipient?.name || 'Student'}
              size={36}
              className="border border-[#F4E3D8] shadow-2xs shrink-0"
            />
            <div>
              <div className="font-black text-sm text-[#17233C]">
                {confirmWithdrawInvite.recipientName || confirmWithdrawInvite.recipient?.name || 'Student'}
              </div>
              <div className="text-[11px] text-[#6E7587] font-semibold">Invitation recipient</div>
            </div>
          </div>
          <div className="pt-2 border-t border-[#F4E3D8]">
            <div className="flex items-center gap-2 font-black text-sm text-[#17233C]">
              <span>{confirmWithdrawInvite.source || confirmWithdrawInvite.groupId?.source || 'Campus'}</span>
              <span className="text-[#FF572E]">→</span>
              <span>{confirmWithdrawInvite.destination || confirmWithdrawInvite.groupId?.destination || 'Destination'}</span>
            </div>
            <div className="flex items-center gap-3 text-[#6E7587] text-[11px] mt-1">
              <span>{formatTravelDate(confirmWithdrawInvite.travelDate || confirmWithdrawInvite.groupId?.travelDate)}</span>
              <span>•</span>
              <span>{formatMinutesToTime(confirmWithdrawInvite.departureTime || confirmWithdrawInvite.groupId?.departureTime)}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-blue-800">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>This action cannot be undone</span>
          </div>
          <p className="text-[11.5px] leading-relaxed">
            The invitation will be permanently removed from the recipient's pending invitations. You can send a new invitation later if needed.
          </p>
        </div>
      </div>
    )}
  </Modal>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userTravels={userTravels}
      />

      {/* Guest Authentication Prompt Modal */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="PoolMate Shared Rides"
        returnPath="/shared-rides"
        title="Sign In to Manage Groups"
        subtitle="Sign in with your campus account to create and join shared ride groups with peers."
      />

      {/* Choose Group Size Modal */}
      <Modal
        isOpen={!!groupSizeModalPeer}
        onClose={() => {
          if (!creatingMatchGroupId) {
            setGroupSizeModalPeer(null);
            setGroupModalError(null);
          }
        }}
        title="Choose Group Size"
        maxWidth="max-w-sm"
        actions={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={Boolean(creatingMatchGroupId)}
              onClick={() => {
                setGroupSizeModalPeer(null);
                setGroupModalError(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#6E7587] bg-white border border-[#F4E3D8] hover:bg-[#FFF9F6] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(creatingMatchGroupId)}
              onClick={handleConfirmCreateGroupWithPeer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-[#FF572E] hover:bg-[#E84720] text-white shadow-xs cursor-pointer disabled:opacity-60"
            >
              {creatingMatchGroupId ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>{`Create Group (${selectedGroupSize})`}</span>
              )}
            </button>
          </div>
        }
      >
        {groupSizeModalPeer && (
          <div className="space-y-4">
            <p className="text-xs text-[#6E7587] leading-relaxed">
              Choose total group size with <span className="font-bold text-[#17233C]">{groupSizeModalPeer.student?.name || 'this student'}</span>. Remaining empty seats are offered automatically in Matches.
            </p>
            <div>
              <span className="block text-[11px] font-black uppercase tracking-wider text-[#17233C] mb-2">
                Group Size (Total Members)
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((size) => {
                  const active = selectedGroupSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={Boolean(creatingMatchGroupId)}
                      onClick={() => {
                        setSelectedGroupSize(size);
                        setGroupModalError(null);
                      }}
                      className={`py-2.5 rounded-xl text-sm font-black border transition-all cursor-pointer disabled:opacity-60 ${
                        active
                          ? 'bg-[#FF572E] text-white border-[#FF572E] shadow-xs'
                          : 'bg-[#FFFDFB] text-[#17233C] border-[#F4E3D8] hover:border-[#FF572E]/50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
            {groupModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {groupModalError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </ResponsiveShell>
  );
}
