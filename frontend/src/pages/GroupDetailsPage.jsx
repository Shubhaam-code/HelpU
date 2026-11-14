import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CarTaxiFront,
  Users,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  UserCheck,
  Send,
  Sparkles,
  Info
} from 'lucide-react';
import { useUser } from '../context/FirebaseAuthContext';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import {
  useUserProfile,
  useMyTravels,
  useMySharedRideGroups,
  useSharedRideGroupDetails,
  useGroupJoinRequests,
  useGroupSentInvites,
  useOriginatingTravelMatches
} from '../hooks/useAppData';
import {
  createGroupJoinRequest,
  acceptGroupInvitation,
  rejectGroupInvitation,
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  inviteStudentToGroup,
  leaveSharedRideGroup,
  updateGroupWhatsAppLink
} from '../lib/api';
import { invalidateGroupQueries } from '../lib/queryClient';
import { formatMinutesToTime } from '../lib/utils';

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

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { data: profile } = useUserProfile();

  const navigationState = location.state || {};

  const handleBack = () => {
    if (navigationState.fromPath) {
      navigate(navigationState.fromPath, { state: navigationState.fromState });
    } else if (navigationState.from === 'match') {
      navigate('/matches', { state: navigationState.fromState });
    } else if (navigationState.from === 'discover') {
      navigate('/shared-rides?tab=discover', { state: navigationState.fromState });
    } else if (navigationState.from === 'my-groups') {
      navigate('/shared-rides?tab=my-groups', { state: navigationState.fromState });
    } else if (navigationState.from === 'invitations') {
      navigate('/shared-rides?tab=invitations', { state: navigationState.fromState });
    } else if (navigationState.from === 'notifications') {
      navigate('/notifications');
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/shared-rides');
    }
  };

  const backLabel =
    navigationState.fromLabel ||
    (navigationState.from === 'match'
      ? 'Back to Find Match'
      : navigationState.from === 'discover'
      ? 'Back to Discover Groups'
      : navigationState.from === 'my-groups'
      ? 'Back to My Groups'
      : navigationState.from === 'invitations'
      ? 'Back to Invitations'
      : navigationState.from === 'notifications'
      ? 'Back to Notifications'
      : 'Back to Groups');

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text: string }
  const [leaving, setLeaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedJoinTravelId, setSelectedJoinTravelId] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(false);
  const [editingWhatsApp, setEditingWhatsApp] = useState(false);
  const [whatsappLinkInput, setWhatsappLinkInput] = useState('');
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);

  // 1. Fetch live group details
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup
  } = useSharedRideGroupDetails(groupId);

  const { data: rawUserTravels } = useMyTravels();
  const userTravels = Array.isArray(rawUserTravels) ? rawUserTravels : [];

  const { data: rawMyGroups } = useMySharedRideGroups();
  const myGroups = Array.isArray(rawMyGroups) ? rawMyGroups : [];

  const isAdmin = Boolean(group && user?.id && group.adminId === user.id);
  const isConfirmedMember = Boolean(
    group && user?.id && Array.isArray(group.members) && group.members.some((m) => m.userId === user.id)
  );
  const canManageRequests = Boolean(isAdmin || isConfirmedMember);
  const isInactiveGroup = Boolean(
    group && ['cancelled', 'empty', 'completed', 'expired'].includes(group.status)
  );
  const availableSpotsCount = group
    ? Math.max(0, (group.targetCapacity || 0) - (group.confirmedMemberCount ?? group.members?.length ?? 0))
    : 0;
  const myPendingRequest = group?.myPendingRequest || null;

  const activeFindPosts = useMemo(() => {
    const now = new Date();
    return userTravels.filter((t) => {
      const isFind = t.type === 'request';
      const isActive = t.status === 'active';
      const isUnexpired = !t.expiresAt || new Date(t.expiresAt) > now;
      return isFind && isActive && isUnexpired;
    });
  }, [userTravels]);

  const sortedJoinCandidatePosts = useMemo(() => {
    if (!group) return activeFindPosts;
    const norm = (val) => String(val || '').trim().toLowerCase();
    const gSrc = norm(group.source);
    const gDst = norm(group.destination);
    const gDate = group.travelDate ? new Date(group.travelDate).toISOString().slice(0, 10) : '';
    return [...activeFindPosts].sort((a, b) => {
      const aMatch =
        norm(a.source) === gSrc &&
        norm(a.destination) === gDst &&
        (!gDate || (a.travelDate && new Date(a.travelDate).toISOString().slice(0, 10) === gDate));
      const bMatch =
        norm(b.source) === gSrc &&
        norm(b.destination) === gDst &&
        (!gDate || (b.travelDate && new Date(b.travelDate).toISOString().slice(0, 10) === gDate));
      return Number(bMatch) - Number(aMatch);
    });
  }, [activeFindPosts, group]);

  useEffect(() => {
    if (sortedJoinCandidatePosts.length === 0) {
      setSelectedJoinTravelId('');
      return;
    }
    if (!selectedJoinTravelId || !sortedJoinCandidatePosts.some((p) => p._id === selectedJoinTravelId)) {
      setSelectedJoinTravelId(sortedJoinCandidatePosts[0]._id);
    }
  }, [sortedJoinCandidatePosts, selectedJoinTravelId]);

  const activeOtherGroup = useMemo(() => {
    if (!group) return null;
    return (
      myGroups.find(
        (g) => String(g._id) !== String(group._id) && (g.status === 'open' || g.status === 'full')
      ) || null
    );
  }, [myGroups, group]);

  // 2. Fetch join requests & sent invites - any confirmed member or admin can view/approve/reject (BUG 7)
  const {
    data: rawJoinRequests,
    isLoading: requestsLoading,
    refetch: refetchRequests
  } = useGroupJoinRequests(groupId, canManageRequests);
  const joinRequests = Array.isArray(rawJoinRequests) ? rawJoinRequests : [];

  const {
    data: rawSentInvites,
    isLoading: invitesLoading,
    refetch: refetchInvites
  } = useGroupSentInvites(groupId, canManageRequests);
  const sentInvites = Array.isArray(rawSentInvites) ? rawSentInvites : [];

  // 3. Fetch candidate compatible travel matches for member/admin invite panel
  const originatingTravelId = group?.originatingTravelId?._id || group?.originatingTravelId;
  const {
    data: rawTravelMatches,
    isLoading: matchesLoading,
    refetch: refetchMatches
  } = useOriginatingTravelMatches(originatingTravelId, canManageRequests);
  const travelMatches = Array.isArray(rawTravelMatches) ? rawTravelMatches : [];

  // Separate confirmed members
  const confirmedMembersList = Array.isArray(group?.members) ? group.members : [];
  const adminMember = confirmedMembersList.find((m) => m.role === 'admin' || m.userId === group?.adminId);
  const regularMembers = confirmedMembersList.filter((m) => m.role !== 'admin' && m.userId !== group?.adminId);

  // Pending join requests & invites
  const pendingJoinRequests = joinRequests.filter((r) => r.status === 'pending');
  const pendingSentInvites = sentInvites.filter((i) => i.status === 'pending');

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  // Non-member requests to join this group using a compatible FIND post
  const handleRequestToJoin = async (e) => {
    e.preventDefault();
    if (!group?._id || !selectedJoinTravelId) return;
    setRequestingJoin(true);
    try {
      await createGroupJoinRequest(group._id, {
        travelId: selectedJoinTravelId,
        message: joinNote.trim() || undefined
      });
      invalidateGroupQueries();
      refetchGroup();
      setJoinNote('');
      showFeedback('success', 'Join request sent to the group organizer! You will be notified once reviewed.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to send join request.');
    } finally {
      setRequestingJoin(false);
    }
  };

  // Invited student accepts group invitation right on Group Details
  const handleAcceptMyInvite = async () => {
    if (!myPendingRequest?._id) return;
    setRespondingInvite(true);
    try {
      await acceptGroupInvitation(myPendingRequest._id);
      invalidateGroupQueries();
      refetchGroup();
      showFeedback('success', 'Invitation accepted! You are now a confirmed member of this group.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to accept invitation.');
    } finally {
      setRespondingInvite(false);
    }
  };

  // Invited student declines group invitation right on Group Details
  const handleRejectMyInvite = async () => {
    if (!myPendingRequest?._id) return;
    setRespondingInvite(true);
    try {
      await rejectGroupInvitation(myPendingRequest._id);
      invalidateGroupQueries();
      refetchGroup();
      showFeedback('info', 'Invitation declined.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to decline invitation.');
    } finally {
      setRespondingInvite(false);
    }
  };

  // Admin accepts student join request
  const handleAcceptRequest = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await acceptStudentJoinRequest(requestId);
      invalidateGroupQueries();
      refetchGroup();
      refetchRequests();
      showFeedback('success', 'Student join request approved! Member added to the group.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to approve join request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Admin rejects student join request
  const handleRejectRequest = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await rejectStudentJoinRequest(requestId);
      invalidateGroupQueries();
      refetchRequests();
      showFeedback('info', 'Join request rejected.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to reject join request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Admin invites a compatible student
  const handleInviteStudent = async (candidateTravel) => {
    const travelIdToInvite = candidateTravel._id || candidateTravel.travel?._id;
    if (!travelIdToInvite) return;

    setActionLoadingId(travelIdToInvite);
    try {
      await inviteStudentToGroup(groupId, { travelId: travelIdToInvite });
      invalidateGroupQueries();
      refetchInvites();
      showFeedback('success', 'Invitation sent to student! They can accept it in their Invitations tab.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to send invitation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Leave group handler confirmed via Modal
  const handleLeaveGroup = async () => {
    setLeaving(true);
    try {
      await leaveSharedRideGroup(groupId);
      invalidateGroupQueries();
      showFeedback('info', 'You have left the group. Your active FIND post remains active.');
      setShowLeaveModal(false);
      setTimeout(() => {
        navigate('/shared-rides');
      }, 900);
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to leave group.');
      setLeaving(false);
    }
  };

  // WhatsApp link management handlers
  const handleStartEditWhatsApp = () => {
    setWhatsappLinkInput(group?.whatsappGroupUrl || '');
    setEditingWhatsApp(true);
  };

  const handleCancelEditWhatsApp = () => {
    setEditingWhatsApp(false);
    setWhatsappLinkInput('');
  };

  const handleSaveWhatsAppLink = async () => {
    if (!groupId) return;
    setSavingWhatsApp(true);
    try {
      await updateGroupWhatsAppLink(groupId, { whatsappGroupUrl: whatsappLinkInput.trim() || null });
      invalidateGroupQueries();
      refetchGroup();
      setEditingWhatsApp(false);
      showFeedback('success', whatsappLinkInput.trim() ? 'WhatsApp group link updated!' : 'WhatsApp group link removed.');
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to update WhatsApp link.');
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const handleContactMemberOnWhatsApp = (member) => {
    const phone = member.student?.whatsappNumber || member.student?.phone;
    if (!phone || !phone.trim()) {
      showFeedback('info', 'Phone number not available for this member.');
      return;
    }
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      showFeedback('info', 'Invalid phone number for this member.');
      return;
    }
    // Create WhatsApp deep link with pre-filled message
    const message = encodeURIComponent(`Hi! We are in the same Helpu ride group. Let's coordinate our trip.`);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      customMobileHeader={
        <AppHeader
          title="Group Details"
          backTo={handleBack}
          avatarId={profile?.avatarId}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-2 pb-8 sm:pt-4 sm:pb-12 space-y-4 sm:space-y-6">
        
        {/* Desktop Back Navigation Bar */}
        <div className="hidden sm:flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#6E7587] hover:text-[#17233C] transition-colors cursor-pointer group"
          >
            <span className="p-1 rounded-lg bg-white border border-[#F4E3D8] group-hover:border-[#FF572E] text-[#17233C] transition-colors shadow-2xs">
              <ArrowLeft className="w-4 h-4" />
            </span>
            <span>{backLabel}</span>
          </button>
        </div>
        
        {/* Loading skeleton */}
        {groupLoading ? (
          <div className="space-y-4">
            <div className="h-44 bg-white/70 rounded-3xl animate-pulse border border-[#F4E3D8]" />
            <div className="h-60 bg-white/70 rounded-3xl animate-pulse border border-[#F4E3D8]" />
          </div>
        ) : groupError || !group ? (
          /* Error / 404 state */
          <div className="bg-white rounded-[24px] border border-[#F4E3D8] p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <h2 className="font-black text-lg text-[#17233C]">Shared Ride Group Not Found</h2>
            <p className="text-xs sm:text-sm text-[#6E7587] max-w-md mx-auto leading-relaxed">
              This group may have been cancelled, expired, or you do not have permission to view it.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/shared-rides')}
                className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Return to Shared Rides
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. FEEDBACK TOAST                                                         */}
            {/* ========================================================================= */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : feedback.type === 'info'
                      ? 'bg-sky-50 border-sky-200 text-sky-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                  <button
                    onClick={() => setFeedback(null)}
                    className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-0.5 rounded cursor-pointer"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inactive Group Status Alert Banner */}
            {isInactiveGroup && (
              <div className="bg-rose-50 border border-rose-200 rounded-[22px] p-4 sm:p-5 flex items-start gap-3.5 text-rose-800 shadow-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-sm sm:text-base text-rose-900">
                    {group.status === 'empty'
                      ? 'This Shared Ride Group Is Now Empty'
                      : group.status === 'expired'
                      ? 'This Shared Ride Group Has Expired'
                      : group.status === 'completed'
                      ? 'This Shared Ride Group Is Completed'
                      : 'This Shared Ride Group Has Been Cancelled'}
                  </h4>
                  <p className="text-xs sm:text-[13px] text-rose-700 leading-relaxed">
                    {group.status === 'empty'
                      ? 'All members left this group, so it has been closed and removed from ride discovery.'
                      : 'New student joins and member coordination are closed for this group.'}
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 2. GROUP HERO / ROUTE CARD                                                */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-5 sm:p-7 relative overflow-hidden space-y-4">
              <div className="absolute top-0 right-0 left-0 h-24 bg-gradient-to-b from-[#FFF5EE]/70 to-transparent pointer-events-none" />

              {/* Status and Role Top Bar */}
              <div className="relative z-10 flex items-start justify-between gap-2.5 border-b border-gray-100 pb-3">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0">
                    <CarTaxiFront className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>Shared Cab Group</span>
                  </span>

                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE] text-[10px] font-black uppercase tracking-wider shrink-0">
                      You are Admin
                    </span>
                  )}
                  {!isAdmin && isConfirmedMember && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#2563EB] border border-[#BFDBFE] text-[10px] font-black uppercase tracking-wider shrink-0">
                      Confirmed Member
                    </span>
                  )}

                  <StatusBadge status={group.status} />
                </div>

                {!isInactiveGroup && (isAdmin || isConfirmedMember) && (
                  <button
                    type="button"
                    disabled={leaving}
                    onClick={() => setShowLeaveModal(true)}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {leaving ? 'Leaving...' : 'Leave Group'}
                  </button>
                )}
              </div>

              {/* Route Display */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2 font-black text-lg sm:text-2xl text-[#17233C]">
                  <span className="truncate">{group.source}</span>
                  <ArrowRight className="w-5 h-5 text-[#FF572E] shrink-0" strokeWidth={2.5} />
                  <span className="truncate">{group.destination}</span>
                </div>

                {/* Date & Time Chips */}
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#6E7587] font-semibold">
                  <div className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#FF572E]" />
                    <span>{formatTravelDate(group.travelDate)}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#FF572E]" />
                    <span>{formatMinutesToTime(group.departureTime)}</span>
                  </div>
                  {group.actualCabCapacity && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8C93A4]">
                      <span>Vehicle Capacity: {group.actualCabCapacity} seats</span>
                    </div>
                  )}
                </div>

                {/* Capacity Progress Bar */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#17233C]">
                      Confirmed: {group.members?.length || 0} / {group.targetCapacity} Passengers
                    </span>
                    <span className="text-[#FF572E]">
                      {Math.max(0, group.targetCapacity - (group.members?.length || 0))} spots remaining
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#FFF2EB] rounded-full overflow-hidden border border-[#FDE0D0]">
                    <div
                      className="h-full bg-[#FF572E] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          ((group.members?.length || 0) / (group.targetCapacity || 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {/* Notes if present */}
                {group.notes && (
                  <div className="p-3 bg-[#FFFDFB] rounded-xl border border-[#F4E3D8] text-xs text-[#6E7587]">
                    <span className="font-bold text-[#17233C]">Coordination Notes: </span>
                    <span>{group.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. WHATSAPP GROUP SECTION (CONFIRMED MEMBERS ONLY)                        */}
            {/* ========================================================================= */}
            {!isInactiveGroup && (isAdmin || isConfirmedMember) && (
              <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-[#EAF8F0] border border-[#BCECD4] flex items-center justify-center p-1.5 shadow-2xs shrink-0">
                      <img
                        src="/whatsapp.svg"
                        alt="WhatsApp"
                        className="w-5 h-5 object-contain"
                        onError={(e) => { e.currentTarget.src = '/whatsapp.png'; }}
                      />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        WhatsApp Coordination
                      </h3>
                      <p className="text-[11px] text-[#8C93A4]">
                        Coordinate rides and communicate with your group members
                      </p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Group Link Section */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[#17233C] uppercase tracking-wider">
                      Group Chat Link
                    </h4>
                    {isAdmin && !editingWhatsApp && (
                      <button
                        type="button"
                        onClick={handleStartEditWhatsApp}
                        className="text-xs font-bold text-[#FF572E] hover:text-[#E64A22] transition-colors cursor-pointer"
                      >
                        {group.whatsappGroupUrl ? 'Edit Link' : 'Add Link'}
                      </button>
                    )}
                  </div>

                  {editingWhatsApp ? (
                    <div className="space-y-3 p-3 bg-[#FFFDFB] rounded-xl border border-[#F4E3D8]">
                      <input
                        type="url"
                        value={whatsappLinkInput}
                        onChange={(e) => setWhatsappLinkInput(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-white text-xs text-[#17233C] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF572E]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingWhatsApp}
                          onClick={handleSaveWhatsAppLink}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingWhatsApp ? 'Saving...' : 'Save Link'}
                        </button>
                        <button
                          type="button"
                          disabled={savingWhatsApp}
                          onClick={handleCancelEditWhatsApp}
                          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#17233C] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        {group.whatsappGroupUrl && (
                          <button
                            type="button"
                            disabled={savingWhatsApp}
                            onClick={() => {
                              setWhatsappLinkInput('');
                              handleSaveWhatsAppLink();
                            }}
                            className="ml-auto px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Remove Link
                          </button>
                        )}
                      </div>
                    </div>
                  ) : group.whatsappGroupUrl ? (
                    <a
                      href={group.whatsappGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
                    >
                      <img
                        src="/whatsapp.svg"
                        alt="WhatsApp"
                        className="w-4 h-4 object-contain brightness-0 invert"
                        onError={(e) => { e.currentTarget.src = '/whatsapp.png'; }}
                      />
                      <span>Open WhatsApp Group</span>
                    </a>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-[#6E7587]">
                      {isAdmin ? 'Click "Add Link" above to set up a WhatsApp group for coordination.' : 'WhatsApp group link not yet added by the admin.'}
                    </div>
                  )}
                </div>

                {/* Individual Member Contact Buttons */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-black text-[#17233C] uppercase tracking-wider">
                    Contact Members Individually
                  </h4>
                  <div className="space-y-2">
                    {confirmedMembersList
                      .filter((member) => !member.isMe && member.userId !== user?.id)
                      .map((member) => {
                        const hasPhone = Boolean(member.student?.whatsappNumber || member.student?.phone);
                        return (
                          <div
                            key={member._id || member.userId}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                src={member.student?.imageUrl}
                                name={member.student?.name || 'Member'}
                                size={32}
                                className="border border-[#F4E3D8] shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-[#17233C] truncate">
                                    {member.student?.name || 'Member'}
                                  </span>
                                  {member.student?.isVerified && (
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                  )}
                                  {(member.role === 'admin' || member.userId === group?.adminId) && (
                                    <span className="text-[9px] font-black text-[#FF572E] uppercase tracking-wider">
                                      Admin
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {hasPhone ? (
                              <button
                                type="button"
                                onClick={() => handleContactMemberOnWhatsApp(member)}
                                className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                              >
                                <img
                                  src="/whatsapp.svg"
                                  alt="WhatsApp"
                                  className="w-3.5 h-3.5 object-contain brightness-0 invert"
                                  onError={(e) => { e.currentTarget.src = '/whatsapp.png'; }}
                                />
                                <span>WhatsApp</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#8C93A4] font-semibold shrink-0">
                                WhatsApp not added
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {confirmedMembersList.filter(m => !m.isMe && m.userId !== user?.id).length === 0 && (
                    <p className="text-xs text-[#6E7587] text-center py-2">
                      No other members to contact yet
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 3B. NON-MEMBER JOIN REQUEST / INVITATION RESPONSE SECTION                 */}
            {/* ========================================================================= */}
            {!isAdmin && !isConfirmedMember && !isInactiveGroup && (
              <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 sm:p-6 space-y-4">
                {activeOtherGroup ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                          Already in Another Active Group
                        </h3>
                        <p className="text-xs sm:text-[13px] text-[#6E7587] leading-relaxed">
                          You are currently a member of <span className="font-bold text-[#17233C]">{activeOtherGroup.source} → {activeOtherGroup.destination}</span>. Leave your current active group before joining or requesting to join another group.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/groups/${activeOtherGroup._id}`)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                    >
                      Go to My Active Group →
                    </button>
                  </div>
                ) : myPendingRequest?.type === 'invite' && myPendingRequest?.status === 'pending' ? (
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                          You Have Been Invited to Join This Group
                        </h3>
                        <p className="text-xs text-[#6E7587]">
                          Accepting confirms your seat ({availableSpotsCount} {availableSpotsCount === 1 ? 'seat' : 'seats'} currently available).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={respondingInvite || availableSpotsCount <= 0}
                        onClick={handleAcceptMyInvite}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        {respondingInvite ? 'Processing...' : 'Accept & Join Group'}
                      </button>
                      <button
                        type="button"
                        disabled={respondingInvite}
                        onClick={handleRejectMyInvite}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        Decline Invite
                      </button>
                    </div>
                  </div>
                ) : myPendingRequest?.type === 'join_request' && myPendingRequest?.status === 'pending' ? (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Join Request Pending Approval
                      </h3>
                      <p className="text-xs text-[#6E7587] leading-relaxed">
                        Your request has been sent to {group.admin?.name || 'the group organizer'}. Once approved, you will be added as a confirmed member and gain access to group coordination.
                      </p>
                    </div>
                  </div>
                ) : group.status === 'full' || availableSpotsCount <= 0 ? (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Group Is Currently Full
                      </h3>
                      <p className="text-xs text-[#6E7587]">
                        All {group.targetCapacity} seats in this shared group are already filled.
                      </p>
                    </div>
                  </div>
                ) : activeFindPosts.length === 0 ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Post a Compatible Ride Request to Join
                      </h3>
                      <p className="text-xs text-[#6E7587] mt-1 leading-relaxed">
                        You need an active FIND ride request for this route and date before requesting to join a shared group.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/rides/offer?type=request')}
                      className="px-4 py-2.5 rounded-xl bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                    >
                      Post FIND Request →
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestToJoin} className="space-y-4">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Request to Join This Shared Group
                      </h3>
                      <p className="text-xs text-[#6E7587] mt-0.5">
                        Select your compatible FIND ride request and send a join request to the organizer ({availableSpotsCount} {availableSpotsCount === 1 ? 'seat' : 'seats'} left).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#17233C]">
                        Your Active FIND Ride Request
                      </label>
                      <select
                        value={selectedJoinTravelId}
                        onChange={(e) => setSelectedJoinTravelId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFDFB] text-xs sm:text-sm font-semibold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                      >
                        {sortedJoinCandidatePosts.map((post) => (
                          <option key={post._id} value={post._id}>
                            {post.source} → {post.destination} ({formatTravelDate(post.travelDate)}, {formatMinutesToTime(post.departureTime)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#17233C]">
                        Message to Organizer (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        value={joinNote}
                        onChange={(e) => setJoinNote(e.target.value)}
                        placeholder="e.g., Travelling with 1 cabin bag, ready near Gate 2"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFDFB] text-xs text-[#17233C] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#FF572E]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={requestingJoin || !selectedJoinTravelId}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{requestingJoin ? 'Sending Request...' : 'Request to Join Group'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. CONFIRMED MEMBERS SECTION (STRICTLY CONFIRMED MEMBERS ONLY)           */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF572E]" />
                  <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                    Confirmed Members ({group.members?.length || 0})
                  </h3>
                </div>
                <span className="text-xs text-[#8C93A4] font-semibold">
                  Target: {group.targetCapacity} students
                </span>
              </div>

              {/* Members List */}
              <div className="divide-y divide-gray-100">
                {/* 1. Admin Member */}
                {adminMember && (
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={adminMember.student?.imageUrl}
                        name={adminMember.student?.name || 'Group Admin'}
                        size={40}
                        className="border border-[#F4E3D8] shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                            {adminMember.student?.name || 'Student Admin'}
                          </span>
                          {adminMember.student?.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-[#8C93A4]">
                          {adminMember.student?.college || 'Campus Peer'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE] text-[10px] font-black uppercase tracking-wider shrink-0">
                      Group Admin
                    </span>
                  </div>
                )}

                {/* 2. Regular Confirmed Members */}
                {regularMembers.map((member) => (
                  <div key={member._id || member.userId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={member.student?.imageUrl}
                        name={member.student?.name || 'Student Member'}
                        size={40}
                        className="border border-[#F4E3D8] shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                            {member.student?.name || 'Student Member'}
                          </span>
                          {member.student?.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-[#8C93A4]">
                          Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Confirmed'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider shrink-0">
                      Member
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. GROUP MANAGEMENT PANEL (VISIBLE TO CONFIRMED MEMBERS & ADMIN)          */}
            {/* ========================================================================= */}
            {canManageRequests && !isInactiveGroup && (
              <div className="space-y-4">
                
                {/* 5A. PENDING STUDENT JOIN REQUESTS */}
                <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#FF572E]" />
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Student Join Requests ({pendingJoinRequests.length})
                      </h3>
                    </div>
                    <span className="text-xs text-[#8C93A4] font-semibold">
                      Requires group member approval
                    </span>
                  </div>

                  {requestsLoading ? (
                    <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                  ) : pendingJoinRequests.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {pendingJoinRequests.map((req) => {
                        const isActing = actionLoadingId === req._id;
                        return (
                          <div key={req._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar
                                src={req.requester?.imageUrl}
                                name={req.requester?.name || 'Requester'}
                                size={40}
                                className="border border-[#F4E3D8] shadow-2xs shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                                    {req.requester?.name || 'Campus Student'}
                                  </span>
                                  {req.requester?.isVerified && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>
                                {req.message && (
                                  <p className="text-xs text-[#6E7587] italic line-clamp-1 mt-0.5">
                                    "{req.message}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isActing || group.availableSpots <= 0}
                                onClick={() => handleAcceptRequest(req._id)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {isActing ? 'Processing...' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleRejectRequest(req._id)}
                                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#17233C] text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#6E7587] py-2">
                      No pending join requests for this group right now.
                    </p>
                  )}
                </div>

                {/* 5B. PENDING SENT INVITATIONS */}
                {pendingSentInvites.length > 0 && (
                  <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-3">
                    <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                      Pending Invitations Sent ({pendingSentInvites.length})
                    </h3>
                    <p className="text-xs text-[#6E7587]">
                      These students have been invited. Once they accept, they will appear in your confirmed members list.
                    </p>
                    <div className="space-y-2 pt-1">
                      {pendingSentInvites.map((inv) => (
                        <div key={inv._id} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              src={inv.recipient?.imageUrl || inv.requester?.imageUrl}
                              name={inv.recipient?.name || inv.requester?.name || inv.recipientName || inv.requesterName || 'Student'}
                              className="w-7 h-7 text-[10px] shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-[#17233C] block truncate">
                                {inv.recipient?.name || inv.requester?.name || inv.recipientName || inv.requesterName || 'Student'}
                              </span>
                              {(inv.recipient?.college || inv.requester?.college) && (
                                <span className="text-[10px] text-[#8C93A4] block truncate">
                                  {inv.recipient?.college || inv.requester?.college}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                            Awaiting Response
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5C. INVITE COMPATIBLE FIND STUDENTS */}
                <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#FF572E]" />
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        Invite Compatible FIND Students
                      </h3>
                    </div>
                    <span className="text-xs text-[#8C93A4] font-semibold">
                      {travelMatches.length} matching students
                    </span>
                  </div>

                  {matchesLoading ? (
                    <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                  ) : travelMatches.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {travelMatches.map((matchItem) => {
                        const candidate = matchItem.travel || matchItem;
                        const candidateId = candidate._id;
                        const isActing = actionLoadingId === candidateId;
                        const isAlreadyMember = group.members?.some((m) => m.userId === candidate.userId);
                        const isInvitePending = pendingSentInvites.some(
                          (i) => i.requesterId === candidate.userId || i.requesterTravelId?._id === candidateId
                        );

                        return (
                          <div key={candidateId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar
                                src={candidate.student?.imageUrl || matchItem.student?.imageUrl}
                                name={candidate.student?.name || matchItem.student?.name || 'Campus Student'}
                                size={40}
                                className="border border-[#F4E3D8] shadow-2xs shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs sm:text-sm text-[#17233C] truncate">
                                    {candidate.student?.name || matchItem.student?.name || 'Campus Student'}
                                  </span>
                                  {(candidate.student?.isVerified || matchItem.student?.isVerified) && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] text-[#6E7587]">
                                  Departing ~{formatMinutesToTime(candidate.departureTime)} • {formatTravelDate(candidate.travelDate)}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isAlreadyMember ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                  Already in Group
                                </span>
                              ) : isInvitePending ? (
                                <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-xl border border-gray-200">
                                  Invitation Pending
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isActing || group.availableSpots <= 0}
                                  onClick={() => handleInviteStudent(candidate)}
                                  className="px-4 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                  {isActing ? 'Inviting...' : 'Invite to Group'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#6E7587] py-2">
                      No matching FIND students found right now for this route and 7-hour departure window.
                    </p>
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </div>

      {/* Leave Group Confirmation Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Shared Ride Group"
        subtitle="Review trip details before leaving"
        actions={
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={() => setShowLeaveModal(false)}
              className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={leaving}
              onClick={handleLeaveGroup}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {leaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Leaving...</span>
                </>
              ) : (
                <span>Confirm & Leave</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5">
          {group && (
            <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] space-y-2 text-xs">
              <div className="flex items-center gap-2 font-black text-sm text-[#17233C]">
                <span>{group.source}</span>
                <span className="text-[#FF572E]">→</span>
                <span>{group.destination}</span>
              </div>
              <div className="flex items-center gap-3 text-[#6E7587] text-[11px]">
                <span>{formatTravelDate(group.travelDate)}</span>
                <span>•</span>
                <span>{formatMinutesToTime(group.departureTime)}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Your FIND post remains intact</span>
            </div>
            <p className="text-[11.5px] leading-relaxed">
              Leaving this shared group will not cancel or delete your active FIND request. You can still discover and receive vehicle offers and form new groups.
            </p>
          </div>
        </div>
      </Modal>
    </ResponsiveShell>
  );
}

