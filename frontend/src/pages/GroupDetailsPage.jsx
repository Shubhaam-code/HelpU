import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CarTaxiFront,
  Users,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
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
import {
  useUserProfile,
  useSharedRideGroupDetails,
  useGroupJoinRequests,
  useGroupSentInvites,
  useOriginatingTravelMatches
} from '../hooks/useAppData';
import {
  acceptStudentJoinRequest,
  rejectStudentJoinRequest,
  inviteStudentToGroup
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
  const { user } = useUser();
  const { data: profile } = useUserProfile();

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'info', text: string }

  // 1. Fetch live group details
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup
  } = useSharedRideGroupDetails(groupId);

  const isAdmin = Boolean(group && user?.id && group.adminId === user.id);
  const isConfirmedMember = Boolean(
    group && user?.id && Array.isArray(group.members) && group.members.some((m) => m.userId === user.id)
  );

  // 2. Fetch admin join requests & sent invites only if user is group admin
  const {
    data: joinRequests = [],
    isLoading: requestsLoading,
    refetch: refetchRequests
  } = useGroupJoinRequests(groupId, isAdmin);

  const {
    data: sentInvites = [],
    isLoading: invitesLoading,
    refetch: refetchInvites
  } = useGroupSentInvites(groupId, isAdmin);

  // 3. Fetch candidate compatible travel matches for admin invite panel
  const originatingTravelId = group?.originatingTravelId?._id || group?.originatingTravelId;
  const {
    data: travelMatches = [],
    isLoading: matchesLoading,
    refetch: refetchMatches
  } = useOriginatingTravelMatches(originatingTravelId, isAdmin);

  // Separate confirmed members
  const adminMember = (group?.members || []).find((m) => m.role === 'admin' || m.userId === group?.adminId);
  const regularMembers = (group?.members || []).filter((m) => m.role !== 'admin' && m.userId !== group?.adminId);

  // Pending join requests & invites
  const pendingJoinRequests = (joinRequests || []).filter((r) => r.status === 'pending');
  const pendingSentInvites = (sentInvites || []).filter((i) => i.status === 'pending');

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
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

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      customMobileHeader={
        <AppHeader
          title="Group Details"
          backTo="/shared-rides"
          avatarId={profile?.avatarId}
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-2 pb-8 sm:pt-4 sm:pb-12 space-y-4 sm:space-y-6">
        
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

            {/* ========================================================================= */}
            {/* 2. GROUP HERO / ROUTE CARD                                                */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-5 sm:p-7 relative overflow-hidden space-y-4">
              <div className="absolute top-0 right-0 left-0 h-24 bg-gradient-to-b from-[#FFF5EE]/70 to-transparent pointer-events-none" />

              {/* Status and Role Top Bar */}
              <div className="relative z-10 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                    <CarTaxiFront className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>Shared Cab Group</span>
                  </span>

                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE] text-[10px] font-black uppercase tracking-wider">
                      You are Admin
                    </span>
                  )}
                  {!isAdmin && isConfirmedMember && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#2563EB] border border-[#BFDBFE] text-[10px] font-black uppercase tracking-wider">
                      Confirmed Member
                    </span>
                  )}
                </div>

                <StatusBadge status={group.status} />
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
            {(isAdmin || isConfirmedMember) && (
              <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-[#F4E3D8] shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <MessageCircle className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-[#17233C]">
                        WhatsApp Coordination Group
                      </h3>
                      <p className="text-[11px] text-[#8C93A4]">
                        Private link visible only to confirmed members of this ride group.
                      </p>
                    </div>
                  </div>
                </div>

                {group.whatsappGroupUrl ? (
                  <div className="pt-1">
                    <a
                      href={group.whatsappGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Join WhatsApp Group</span>
                    </a>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-[#6E7587]">
                    WhatsApp group link was not provided when the group was created.
                  </div>
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
            {/* 5. ADMIN MANAGEMENT PANEL (VISIBLE ONLY TO GROUP ADMIN)                   */}
            {/* ========================================================================= */}
            {isAdmin && (
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
                      Requires your approval
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
                        <div key={inv._id} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs flex items-center justify-between">
                          <span className="font-semibold text-[#17233C]">Student ID: {inv.requesterId}</span>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Awaiting Student Response
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
    </ResponsiveShell>
  );
}

