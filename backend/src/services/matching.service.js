import Travel from '../models/Travel.js';
import Student from '../models/Student.js';
import SharedRideGroup from '../models/SharedRideGroup.js';
import GroupJoinRequest from '../models/GroupJoinRequest.js';
import { createOutboxEvent, triggerOutboxSweep } from './outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';
import {
  getCandidateUserIds,
  buildUserIdSet,
  isUserInSet,
  isSameUserId,
  stripFirebasePrefix,
  resolveStudentProfilesMap,
  getStudentFromMap,
  formatSafePublicStudent
} from '../utils/studentProfileResolver.js';

/**
 * Builds canonical sorted key for a pair of users across UID formats.
 */
export function buildPairUserKey(userA, userB) {
  const a = stripFirebasePrefix(String(userA || ''));
  const b = stripFirebasePrefix(String(userB || ''));
  if (!a || !b) return '';
  return [a, b].sort().join('::');
}

/**
 * Builds a friendly combined group display name like "Group A + B".
 */
export function buildGroupDisplayName(members = [], fallbackAdminName = '') {
  const rawNames = [];
  const seen = new Set();

  for (const m of members || []) {
    const name = typeof m === 'string' ? m.trim() : (m?.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    rawNames.push(name);
  }

  if (rawNames.length === 0 && fallbackAdminName && fallbackAdminName.trim()) {
    rawNames.push(fallbackAdminName.trim());
  }

  if (rawNames.length === 0) return 'Shared Ride Group';

  const firstTokens = rawNames.map((n) => n.split(/\s+/)[0]);
  const distinctFirstTokens = new Set(firstTokens.map((t) => t.toLowerCase()));
  const displayTokens = distinctFirstTokens.size === rawNames.length ? firstTokens : rawNames;

  if (displayTokens.length === 1) {
    return `Group ${displayTokens[0]}`;
  }
  if (displayTokens.length === 2) {
    return `Group ${displayTokens[0]} + ${displayTokens[1]}`;
  }
  return `Group ${displayTokens[0]} + ${displayTokens[1]} + ${displayTokens.length - 2} more`;
}

/**
 * Returns a Set containing all userId variants of students currently belonging
 * to an active, unexpired SharedRideGroup (status open or full).
 */
export async function getActiveGroupedUserIds(now = new Date()) {
  const activeGroups = await SharedRideGroup.find(
    {
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: now }
    },
    { 'members.userId': 1 }
  ).lean();

  const ids = [];
  for (const g of activeGroups) {
    if (Array.isArray(g.members) && g.members.length > 0) {
      for (const m of g.members) {
        if (m?.userId) ids.push(m.userId);
      }
    }
  }
  return buildUserIdSet(ids);
}

/**
 * Computes backend-driven group formation relationship state between a viewer
 * and a list of peer user IDs.
 * States: NONE | REQUEST_SENT | REQUEST_RECEIVED | ACCEPTED | DECLINED
 */
export async function computePairRelationshipStates(viewerUserId, peerUserIds = []) {
  const map = new Map();
  if (!viewerUserId || !peerUserIds || peerUserIds.length === 0) return map;

  const now = new Date();
  const viewerVariants = getCandidateUserIds(viewerUserId);
  const viewerSet = buildUserIdSet([viewerUserId]);
  const allPeerVariants = Array.from(buildUserIdSet(peerUserIds));
  const uniqueRawPeers = [...new Set(peerUserIds.filter(Boolean))];

  // Default state
  for (const pid of uniqueRawPeers) {
    const rawKey = stripFirebasePrefix(pid) || pid;
    map.set(rawKey, {
      relationshipState: 'NONE',
      proposalId: null,
      proposedCapacity: null,
      groupId: null,
      senderTravelId: null,
      requesterTravelId: null
    });
  }

  // 1. Check active shared groups that contain both viewer and any peer
  const activeSharedGroups = await SharedRideGroup.find({
    status: { $in: ['open', 'full'] },
    expiresAt: { $gt: now },
    'members.userId': { $in: viewerVariants }
  })
    .select('_id members targetCapacity status')
    .lean();

  const activeGroupPairMap = new Map();
  for (const g of activeSharedGroups) {
    const gMemberSet = buildUserIdSet((g.members || []).map((m) => m.userId));
    for (const pid of uniqueRawPeers) {
      if (isUserInSet(pid, gMemberSet)) {
        const rawKey = stripFirebasePrefix(pid) || pid;
        activeGroupPairMap.set(rawKey, g);
        map.set(rawKey, {
          relationshipState: 'ACCEPTED',
          proposalId: null,
          proposedCapacity: g.targetCapacity || null,
          groupId: g._id,
          senderTravelId: null,
          requesterTravelId: null
        });
      }
    }
  }

  // 2. Check GroupJoinRequest records (formation_proposal & invite) for viewer <-> peers
  const pairKeys = uniqueRawPeers
    .map((pid) => buildPairUserKey(viewerUserId, pid))
    .filter(Boolean);

  const requests = await GroupJoinRequest.find({
    type: { $in: ['formation_proposal', 'invite'] },
    status: { $in: ['pending', 'accepted', 'rejected', 'declined'] },
    $or: [
      ...(pairKeys.length > 0 ? [{ pairUserKey: { $in: pairKeys } }] : []),
      {
        senderId: { $in: viewerVariants },
        $or: [{ requesterId: { $in: allPeerVariants } }, { recipientId: { $in: allPeerVariants } }]
      },
      {
        senderId: { $in: allPeerVariants },
        $or: [{ requesterId: { $in: viewerVariants } }, { recipientId: { $in: viewerVariants } }]
      }
    ]
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  console.log(`[computePairRelationshipStates] Found ${requests.length} requests for viewer ${viewerUserId}:`, 
    requests.map(r => ({ type: r.type, status: r.status, senderId: r.senderId, recipientId: r.recipientId }))
  );

  // Track which peer pairs already received a definitive state from active groups or newest record
  const resolvedPeers = new Set(activeGroupPairMap.keys());

  for (const reqDoc of requests) {
    // Identify which peer in the list corresponds to this request
    const participants = [reqDoc.senderId, reqDoc.requesterId, reqDoc.recipientId].filter(Boolean);
    const matchedPeer = uniqueRawPeers.find((pid) => {
      const pVariants = buildUserIdSet([pid]);
      return participants.some((part) => !isUserInSet(part, viewerSet) && isUserInSet(part, pVariants));
    });
    if (!matchedPeer) continue;

    const rawKey = stripFirebasePrefix(matchedPeer) || matchedPeer;
    if (resolvedPeers.has(rawKey)) continue;

    if (reqDoc.expiresAt && new Date(reqDoc.expiresAt) <= now && reqDoc.status === 'pending') {
      continue;
    }

    if (reqDoc.status === 'pending') {
      const iAmSender = isUserInSet(reqDoc.senderId, viewerSet);
      const state = iAmSender ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
      console.log(`[computePairRelationshipStates] Setting ${state} for peer ${matchedPeer}, proposalId: ${reqDoc._id}`);
      map.set(rawKey, {
        relationshipState: state,
        proposalId: reqDoc._id,
        proposedCapacity: reqDoc.proposedCapacity || null,
        groupId: reqDoc.groupId || null,
        senderTravelId: reqDoc.senderTravelId || null,
        requesterTravelId: reqDoc.requesterTravelId || null
      });
      resolvedPeers.add(rawKey);
    } else if (reqDoc.status === 'accepted') {
      // Only stays ACCEPTED while the linked group is still active and has both users;
      // if activeGroupPairMap didn't have it, verify whether groupId is still active with viewer
      if (reqDoc.groupId) {
        const linkedGroup = await SharedRideGroup.findOne({
          _id: reqDoc.groupId,
          status: { $in: ['open', 'full'] },
          expiresAt: { $gt: now },
          'members.userId': { $all: [viewerUserId] }
        }).select('_id targetCapacity members.userId').lean();

        // fallback check with variants if exact match failed
        const activeLinked = linkedGroup || (await SharedRideGroup.findOne({
          _id: reqDoc.groupId,
          status: { $in: ['open', 'full'] },
          expiresAt: { $gt: now },
          'members.userId': { $in: viewerVariants }
        }).select('_id targetCapacity members.userId').lean());

        if (activeLinked) {
          const mSet = buildUserIdSet((activeLinked.members || []).map((m) => m.userId));
          if (isUserInSet(matchedPeer, mSet)) {
            map.set(rawKey, {
              relationshipState: 'ACCEPTED',
              proposalId: reqDoc._id,
              proposedCapacity: reqDoc.proposedCapacity || activeLinked.targetCapacity || null,
              groupId: activeLinked._id,
              senderTravelId: reqDoc.senderTravelId || null,
              requesterTravelId: reqDoc.requesterTravelId || null
            });
            resolvedPeers.add(rawKey);
          }
        }
      }
      // If group ended/left, fall through so eligibility is restored (NONE or next record)
    } else if (reqDoc.status === 'rejected' || reqDoc.status === 'declined') {
      map.set(rawKey, {
        relationshipState: 'DECLINED',
        proposalId: reqDoc._id,
        proposedCapacity: reqDoc.proposedCapacity || null,
        groupId: reqDoc.groupId || null,
        senderTravelId: reqDoc.senderTravelId || null,
        requesterTravelId: reqDoc.requesterTravelId || null
      });
      resolvedPeers.add(rawKey);
    }
  }

  return map;
}

/**
 * Normalizes location strings to standard canonical names
 * to avoid mismatches due to casing, punctuation, or common aliases.
 */
export function normalizeLocation(loc) {
  if (!loc || typeof loc !== 'string') return '';
  let s = loc.toLowerCase().trim();
  s = s.replace(/[,.-]/g, ' ').replace(/\s+/g, ' ').trim();

  // VIT Bhopal / Campus aliases
  if (/\b(vit|vitb|campus|college|kothri|kothrikalan|university)\b/i.test(s)) {
    return 'vit bhopal';
  }

  // Bhopal Railway Station / Junction (excluding Rani Kamlapati)
  if (
    /\b(bhopal junction|bhopal station|bhopal stn|bhopal rly|railway station|main station)\b/i.test(s) &&
    !/\b(rkmp|kamlapati|kamalapati|habibganj)\b/i.test(s)
  ) {
    return 'bhopal junction';
  }

  // Rani Kamlapati / RKMP / Habibganj
  if (/\b(rkmp|rani kamlapati|rani kamalapati|kamlapati|kamalapati|habibganj)\b/i.test(s)) {
    return 'rani kamlapati';
  }

  // Bhopal Airport / Raja Bhoj
  if (/\b(airport|raja bhoj|bho)\b/i.test(s)) {
    return 'bhopal airport';
  }

  // Indore
  if (/\b(indore|bhawarkua|vijay nagar)\b/i.test(s)) {
    return 'indore';
  }

  // Sehore
  if (/\b(sehore)\b/i.test(s)) {
    return 'sehore';
  }

  // Ashta
  if (/\b(ashta)\b/i.test(s)) {
    return 'ashta';
  }

  // Home / Residence
  if (/\b(home|ghar|residence|house)\b/i.test(s)) {
    return 'home';
  }

  return s;
}

/**
 * Checks if two location strings refer to compatible locations.
 */
export function areLocationsMatching(locA, locB) {
  if (!locA || !locB) return false;
  const a = normalizeLocation(locA);
  const b = normalizeLocation(locB);
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}

/**
 * Strict travel direction verification:
 * Checks that sourceA matches sourceB AND destA matches destB.
 * Specifically rejects opposite-direction journeys (e.g. A->B vs B->A).
 */
export function isSameDirection(sourceA, destA, sourceB, destB) {
  const sourcesMatch = areLocationsMatching(sourceA, sourceB);
  const destsMatch = areLocationsMatching(destA, destB);

  if (!sourcesMatch || !destsMatch) return false;

  // Guard against opposite direction
  if (areLocationsMatching(sourceA, destB) && !areLocationsMatching(sourceA, destA)) {
    return false;
  }

  return true;
}

/**
 * Normalizes any date representation (Date object, ISO string, YYYY-MM-DD, DD/MM/YYYY, timestamp)
 * into a canonical calendar day string 'YYYY-MM-DD' in Asia/Kolkata timezone.
 * Prevents accidental date mismatches caused by UTC vs IST offset transitions.
 */
export function getCanonicalCalendarDate(dateInput) {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Format YYYY-MM-DD (e.g. "2026-11-07" or "2026-11-07T00:00:00.000Z")
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch && !trimmed.includes('T')) {
      const [, y, m, d] = ymdMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Format DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

/**
 * Checks if two Date objects/strings fall on the exact same calendar day in Asia/Kolkata timezone.
 * Guaranteed to return false for different calendar dates (e.g. 7 Nov vs 9 Nov).
 */
export function isSameCalendarDay(date1, date2) {
  const d1 = getCanonicalCalendarDate(date1);
  const d2 = getCanonicalCalendarDate(date2);
  if (!d1 || !d2) return false;
  return d1 === d2;
}

/**
 * Checks if two departure times (in minutes from midnight, 0-1439)
 * fall within the maximum allowed departure window (default 420 minutes / 7 hours).
 * Returns false if either time is undefined, null, or not a number.
 */
export function isDepartureTimeCompatible(timeA, timeB, maxWindowMinutes = 420) {
  if (typeof timeA !== 'number' || typeof timeB !== 'number' || isNaN(timeA) || isNaN(timeB)) {
    return false;
  }
  const diff = Math.abs(timeA - timeB);
  return diff <= maxWindowMinutes;
}

/**
 * Rule-based Smart Matching Engine for Helpu.
 * 
 * Strict Matching Rules:
 * 1. An OFFER post matches ONLY with relevant REQUEST posts from other users.
 * 2. A REQUEST post matches ONLY with relevant OFFER posts from other users.
 * 3. Never match a student's post with their own post.
 * 4. Both posts must be active and unexpired (status: 'active', expiresAt > now).
 * 5. Strict Travel Direction:
 *    - Starting location compatibility (normalized).
 *    - Destination location compatibility (normalized).
 *    - Never match opposite-direction rides (e.g. VIT->Home never matches Home->VIT).
 * 6. Travel date must match on the same calendar day in Asia/Kolkata.
 * 7. Departure time compatibility within allowed flexibility:
 *    Math.abs(timeA - timeB) <= flexibilityA + flexibilityB (or default 60-120 mins).
 * 8. Seat capacity check:
 *    - If user OFFER matches candidate REQUEST: candidate required seats <= offer's available seats.
 *    - If user REQUEST matches candidate OFFER: offer's available seats >= request's required seats.
 * 9. Never exposes private phone numbers.
 * 
 * @param {Object} travelPost - The source Travel Mongoose document
 * @returns {Promise<Array>} List of matched travel posts with public creator details
 */
/**
 * Finds compatible travel matches for a given travel post.
 * Returns matched offers/requests and (when enabled for FIND posts) open Shared Ride Groups
 * whose remaining capacity acts as an offer in Match.
 *
 * @param {Object} travelPost - The source Travel Mongoose document
 * @param {Object} [options]
 * @param {boolean} [options.includeGroupOffers=true] - Whether to include compatible open groups as offers
 * @returns {Promise<Array>} List of matched travel posts and group offers with public creator details
 */
export async function findMatchesForTravel(travelPost, { includeGroupOffers = true } = {}) {
  const now = new Date();

  // Guard: if current post is not active or already expired, return no matches
  if (!travelPost || travelPost.status !== 'active' || travelPost.expiresAt <= now) {
    return [];
  }

  // 1. Determine eligible candidate type:
  // - OFFER queries 'request' AND 'offer' posts (Offer matches Request & Offer)
  // - REQUEST queries ONLY 'offer' posts (Never match Request with Request)
  let eligibleTypes = [];
  if (travelPost.type === 'offer') {
    eligibleTypes = ['request', 'offer'];
  } else if (travelPost.type === 'request') {
    eligibleTypes = ['offer'];
  } else {
    return [];
  }

  // 2. Fetch all active, unexpired candidate posts from other users of the eligible type
  // Exclude students who already belong to an active SharedRideGroup (BUG 6)
  const [candidates, activeGroupedUserIds] = await Promise.all([
    Travel.find({
      _id: { $ne: travelPost._id },
      userId: { $nin: getCandidateUserIds(travelPost.userId) },
      status: 'active',
      expiresAt: { $gt: now },
      type: { $in: eligibleTypes }
    }).sort({ createdAt: -1 }).lean(),
    getActiveGroupedUserIds(now)
  ]);

  const userBooked = travelPost.bookedSeats || 0;
  const userAvailableSeats = Math.max(0, (travelPost.seats || 1) - userBooked);

  // 3. Apply rule-based filter
  const matchedPosts = [];

  for (const candidate of candidates) {
    // Exclude active group members from appearing as independent individual matches
    if (isUserInSet(candidate.userId, activeGroupedUserIds)) {
      continue;
    }

    // Rule A: Strict travel direction and location compatibility (NEVER opposite direction)
    if (!isSameDirection(travelPost.source, travelPost.destination, candidate.source, candidate.destination)) {
      continue;
    }

    // Rule B: Same calendar day (Asia/Kolkata timezone)
    if (!isSameCalendarDay(travelPost.travelDate, candidate.travelDate)) {
      continue;
    }

    // Rule C: Departure time compatibility (maximum 7 hours / 420 minutes)
    if (!isDepartureTimeCompatible(travelPost.departureTime, candidate.departureTime, 420)) {
      continue;
    }

    // Rule D: Seat capacity compatibility
    const candBooked = candidate.bookedSeats || 0;
    const candAvailableSeats = Math.max(0, (candidate.seats || 1) - candBooked);

    if (travelPost.type === 'offer' && candidate.type === 'request') {
      // Offer must have enough available seats to fulfill the requested seats
      const requiredSeats = candidate.seats || 1;
      if (userAvailableSeats < requiredSeats) {
        continue;
      }
    } else if (travelPost.type === 'request' && candidate.type === 'offer') {
      // Candidate offer must have enough available seats for current user request
      const requiredSeats = travelPost.seats || 1;
      if (candAvailableSeats < requiredSeats) {
        continue;
      }
    } else if (travelPost.type === 'offer' && candidate.type === 'offer') {
      // Both are offers: candidate must have available seats to share/co-travel
      if (candAvailableSeats <= 0) {
        continue;
      }
    }

    matchedPosts.push({
      ...candidate,
      availableSeats: candAvailableSeats,
      matchedWithPostId: travelPost._id,
      matchedWithPostType: travelPost.type,
      matchedWithTravelDate: travelPost.travelDate,
      matchedWithRoute: `${travelPost.source} → ${travelPost.destination}`,
      matchingReason: candidate.type === 'request'
        ? `Passenger request for your ride (${travelPost.source} → ${travelPost.destination})`
        : travelPost.type === 'offer'
        ? `Co-travel offer on your route (${travelPost.source} → ${travelPost.destination})`
        : `Ride offer matching your request (${travelPost.source} → ${travelPost.destination})`
    });
  }

  let enrichedTravelMatches = [];
  if (matchedPosts.length > 0) {
    // 4. Attach creator details including phone for direct WhatsApp coordination
    const userIds = [...new Set(matchedPosts.map((p) => p.userId))];
    const studentMap = await resolveStudentProfilesMap(userIds, { includeContact: true });

    enrichedTravelMatches = matchedPosts.map((post) => {
      const student = getStudentFromMap(studentMap, post.userId);
      const safePublic = formatSafePublicStudent(student, {
        fallbackName: post.authorName || 'Student',
        includeContact: true
      });
      const peerPhone = safePublic.phone || post.authorPhone || '';
      const publicProfile = {
        ...safePublic,
        email: safePublic.email || post.authorEmail || '',
        phone: peerPhone,
        college: safePublic.college || 'VIT, Bhopal'
      };
      return {
        ...post,
        authorName: publicProfile.name,
        phone: peerPhone,
        student: publicProfile,
        creator: publicProfile
      };
    });
  }

  // 5. For FIND posts, expose open Shared Ride Groups as Group Ride Offers based on remaining capacity
  if (includeGroupOffers && travelPost.type === 'request') {
    try {
      const compatibleGroups = await findCompatibleGroupsForFindPost(travelPost, travelPost.userId);
      const requiredSeats = travelPost.seats || 1;
      const groupOffers = compatibleGroups
        .filter((g) => (g.availableSpots || 0) >= requiredSeats)
        .map((g) => ({
          _id: `group_${g._id}`,
          id: String(g._id),
          groupId: g._id,
          isGroupOffer: true,
          type: 'offer',
          groupDisplayName: g.groupDisplayName,
          source: g.source,
          destination: g.destination,
          travelDate: g.travelDate,
          departureTime: g.departureTime,
          seats: g.targetCapacity,
          targetCapacity: g.targetCapacity,
          confirmedMemberCount: g.confirmedMemberCount,
          availableSpots: g.availableSpots,
          availableSeats: g.availableSpots,
          pricePerSeat: 0,
          status: g.status,
          members: g.members,
          membersPreview: g.membersPreview,
          student: g.admin,
          creator: g.admin,
          authorName: g.groupDisplayName || g.admin?.name || 'Shared Ride Group',
          matchedWithPostId: travelPost._id,
          matchedWithPostType: travelPost.type,
          matchedWithTravelDate: travelPost.travelDate,
          matchedWithRoute: `${travelPost.source} → ${travelPost.destination}`,
          matchingReason: `Shared group offer (${g.confirmedMemberCount}/${g.targetCapacity} joined • ${g.availableSpots} seats left)`
        }));

      return [...enrichedTravelMatches, ...groupOffers];
    } catch (groupErr) {
      console.warn('[MatchingService] Non-fatal error adding group offers:', groupErr.message);
    }
  }

  return enrichedTravelMatches;
}

/**
 * Finds all matching travel posts across all active unexpired travels of a given user.
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Object containing myTravels and matched travel posts
 */
export async function findMatchesForUser(userId) {
  const now = new Date();
  const userVariants = getCandidateUserIds(userId);

  // 1. Fetch user's active, unexpired travels
  const myTravels = await Travel.find({
    userId: { $in: userVariants.length > 0 ? userVariants : [userId] },
    status: 'active',
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 }).lean();

  if (!myTravels || myTravels.length === 0) {
    return {
      hasPostedTravel: false,
      myTravels: [],
      matches: [],
      compatibleFinds: []
    };
  }

  // 2. Run matching for each of user's active travel posts and aggregate results
  const matchedMap = new Map();
  const compatibleFindsMap = new Map();

  for (const travelPost of myTravels) {
    const matches = await findMatchesForTravel(travelPost);
    for (const match of matches) {
      const matchId = match._id.toString();
      if (!matchedMap.has(matchId)) {
        matchedMap.set(matchId, match);
      }
    }

    if (travelPost.type === 'request') {
      try {
        const finds = await findCompatibleFindPosts(travelPost, { viewerUserId: userId });
        for (const peer of finds) {
          const peerId = peer._id.toString();
          if (!compatibleFindsMap.has(peerId)) {
            compatibleFindsMap.set(peerId, peer);
          }
        }
      } catch (err) {
        console.warn('[MatchingService] Non-fatal error collecting compatible FIND peers:', err.message);
      }
    }
  }

  return {
    hasPostedTravel: true,
    myTravels,
    matches: Array.from(matchedMap.values()),
    compatibleFinds: Array.from(compatibleFindsMap.values())
  };
}

/**
 * Checks if two FIND posts (type: 'request') are compatible for Shared Group formation.
 * 
 * Rules:
 * 1. Both posts must exist and belong to different students (postA.userId !== postB.userId).
 * 2. Both posts must have type 'request' (FIND posts).
 * 3. Both posts must be active and unexpired (status: 'active', expiresAt > now).
 * 4. Same origin (normalized location).
 * 5. Same destination and travel direction (NEVER reverse direction).
 * 6. Same calendar day in Asia/Kolkata timezone.
 * 7. Departure time difference within 420 minutes tolerance.
 * 8. Neither student is already a confirmed member of the same active/relevant group.
 * 
 * @param {Object} postA - First FIND post (Travel document or object)
 * @param {Object} postB - Second FIND post (Travel document or object)
 * @param {Object} [options]
 * @param {boolean} [options.skipGroupCheck=false] - Skip group lookup if already verified
 * @returns {Promise<boolean>}
 */
export async function areFindPostsCompatible(postA, postB, { skipGroupCheck = false } = {}) {
  if (!postA || !postB) return false;

  const idA = postA._id ? postA._id.toString() : null;
  const idB = postB._id ? postB._id.toString() : null;
  if (idA && idB && idA === idB) return false;

  if (!postA.userId || !postB.userId || postA.userId === postB.userId) return false;

  if (postA.type !== 'request' || postB.type !== 'request') return false;

  if (postA.status !== 'active' || postB.status !== 'active') return false;

  const now = new Date();
  if (postA.expiresAt && new Date(postA.expiresAt) <= now) return false;
  if (postB.expiresAt && new Date(postB.expiresAt) <= now) return false;

  if (!isSameDirection(postA.source, postA.destination, postB.source, postB.destination)) {
    return false;
  }

  if (!isSameCalendarDay(postA.travelDate, postB.travelDate)) {
    return false;
  }

  if (!isDepartureTimeCompatible(postA.departureTime, postB.departureTime, 420)) {
    return false;
  }

  if (!skipGroupCheck) {
    try {
      const commonGroup = await SharedRideGroup.findOne({
        status: { $in: ['open', 'full'] },
        expiresAt: { $gt: now },
        'members.userId': { $all: [postA.userId, postB.userId] }
      }).select('_id');
      if (commonGroup) return false;
    } catch {
      // Safe fallback if SharedRideGroup lookup fails
    }
  }

  return true;
}

/**
 * Discovers existing active compatible FIND posts for a given FIND post.
 * Strictly used for Shared Ride Group suggestions.
 * NEVER creates normal bookings or decrements seats.
 * 
 * @param {Object} targetFindPost - The source FIND post
 * @returns {Promise<Array>} List of compatible FIND posts with safe public profiles
 */
export async function findCompatibleFindPosts(targetFindPost, { viewerUserId = null, includeInternalUserId = false } = {}) {
  if (!targetFindPost || targetFindPost.type !== 'request' || targetFindPost.status !== 'active') {
    return [];
  }

  const now = new Date();
  if (targetFindPost.expiresAt && new Date(targetFindPost.expiresAt) <= now) {
    return [];
  }

  const [candidates, activeGroupedUserIds] = await Promise.all([
    Travel.find({
      _id: { $ne: targetFindPost._id },
      userId: { $nin: getCandidateUserIds(targetFindPost.userId) },
      type: 'request',
      status: 'active',
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 }).lean(),
    getActiveGroupedUserIds(now)
  ]);

  const compatiblePosts = [];
  for (const cand of candidates) {
    // BUG 6: Active group members must never appear as individual matching students
    if (isUserInSet(cand.userId, activeGroupedUserIds)) {
      continue;
    }
    const isCompat = await areFindPostsCompatible(targetFindPost, cand);
    if (isCompat) {
      compatiblePosts.push(cand);
    }
  }

  if (compatiblePosts.length === 0) return [];

  // Enrich with safe public student details and pair relationship state
  const userIds = [...new Set(compatiblePosts.map((p) => p.userId))];
  const effectiveViewer = viewerUserId || targetFindPost.userId;
  const [studentMap, relationshipMap] = await Promise.all([
    resolveStudentProfilesMap(userIds, { includeContact: false }),
    computePairRelationshipStates(effectiveViewer, userIds)
  ]);

  return compatiblePosts.map((post) => {
    const student = getStudentFromMap(studentMap, post.userId);
    const safeStudent = {
      ...formatSafePublicStudent(student, { fallbackName: post.authorName || 'Student' }),
      college: student?.college || 'VIT, Bhopal'
    };

    const rawPeerKey = stripFirebasePrefix(post.userId) || post.userId;
    const rel = relationshipMap.get(rawPeerKey) || {
      relationshipState: 'NONE',
      proposalId: null,
      proposedCapacity: null,
      groupId: null
    };

    return {
      _id: post._id,
      ...(includeInternalUserId ? { userId: post.userId } : {}),
      type: post.type,
      source: post.source,
      destination: post.destination,
      travelDate: post.travelDate,
      departureTime: post.departureTime,
      timeFlexibility: post.timeFlexibility,
      seats: post.seats || 1,
      status: post.status,
      expiresAt: post.expiresAt,
      student: safeStudent,
      matchedWithTravelId: targetFindPost._id,
      relationshipState: rel.relationshipState,
      proposalId: rel.proposalId,
      proposedCapacity: rel.proposedCapacity,
      groupId: rel.groupId,
      canCreateGroup: rel.relationshipState === 'NONE'
    };
  });
}

/**
 * Detects compatible existing FIND posts when a new FIND post is created,
 * and triggers idempotent notifications for both students via the Outbox.
 * 
 * Notification text per specification:
 * - Student A (Existing Post Owner):
 *   Title: "Another student wants to travel on your route!"
 *   Message: "A compatible student has been found for your trip. You can create a Shared Group together."
 * 
 * - Student B (New Post Creator):
 *   Title: "A compatible student was found!"
 *   Message: "Another student wants to travel on the same route and date. You can create a Shared Group together."
 * 
 * @param {Object} newFindPost - The newly created FIND post
 * @returns {Promise<Array>} Array of created notification events / pairs
 */
export async function detectAndNotifyCompatibleFindPosts(newFindPost) {
  if (!newFindPost || newFindPost.type !== 'request' || newFindPost.status !== 'active') {
    return [];
  }

  const now = new Date();
  if (newFindPost.expiresAt && new Date(newFindPost.expiresAt) <= now) {
    return [];
  }

  const compatiblePosts = await findCompatibleFindPosts(newFindPost, { includeInternalUserId: true });
  if (!compatiblePosts || compatiblePosts.length === 0) {
    return [];
  }

  const createdEvents = [];

  for (const existingPost of compatiblePosts) {
    // Canonical pair key (sorted travel post IDs) guarantees determinism regardless of creation order
    const [id1, id2] = [newFindPost._id.toString(), existingPost._id.toString()].sort();
    const pairKey = `${id1}_${id2}`;

    // Event 1: Student A (existing post owner)
    const eventIdA = `find_pair_${pairKey}_${existingPost.userId}`;
    try {
      const evtA = await createOutboxEvent({
        eventId: eventIdA,
        eventType: NOTIFICATION_JOB_TYPES.COMPATIBLE_FIND_MATCH,
        recipientId: existingPost.userId,
        relatedTravelId: existingPost._id,
        payload: {
          title: 'Another student wants to travel on your route!',
          message: 'A compatible student has been found for your trip. You can create a Shared Group together.',
          isExistingPostOwner: true,
          source: existingPost.source,
          destination: existingPost.destination,
          travelDate: existingPost.travelDate,
          departureTime: existingPost.departureTime,
          matchedTravelId: newFindPost._id,
          pairKey,
          navigationUrl: '/shared-rides'
        }
      });
      if (evtA) createdEvents.push(evtA);
    } catch (err) {
      // Code 11000 = duplicate eventId -> idempotent skip
      if (err.code !== 11000 && !err.message?.includes('E11000')) {
        console.warn(`[FindMatch] Outbox event creation error for student A (${existingPost.userId}):`, err.message);
      }
    }

    // Event 2: Student B (new post creator)
    const eventIdB = `find_pair_${pairKey}_${newFindPost.userId}`;
    try {
      const evtB = await createOutboxEvent({
        eventId: eventIdB,
        eventType: NOTIFICATION_JOB_TYPES.COMPATIBLE_FIND_MATCH,
        recipientId: newFindPost.userId,
        relatedTravelId: newFindPost._id,
        payload: {
          title: 'A compatible student was found!',
          message: 'Another student wants to travel on the same route and date. You can create a Shared Group together.',
          isExistingPostOwner: false,
          source: newFindPost.source,
          destination: newFindPost.destination,
          travelDate: newFindPost.travelDate,
          departureTime: newFindPost.departureTime,
          matchedTravelId: existingPost._id,
          pairKey,
          navigationUrl: '/shared-rides'
        }
      });
      if (evtB) createdEvents.push(evtB);
    } catch (err) {
      // Code 11000 = duplicate eventId -> idempotent skip
      if (err.code !== 11000 && !err.message?.includes('E11000')) {
        console.warn(`[FindMatch] Outbox event creation error for student B (${newFindPost.userId}):`, err.message);
      }
    }
  }

  if (createdEvents.length > 0) {
    try {
      triggerOutboxSweep();
    } catch (sweepErr) {
      console.warn('[FindMatch] Outbox sweep trigger warning:', sweepErr.message);
    }
  }

  return createdEvents;
}

/**
 * Discovers compatible, active, open Shared Ride Groups for an active FIND post.
 * Excludes:
 * - Inactive or expired groups
 * - Full groups (members.length >= targetCapacity)
 * - Groups where the student is admin or confirmed member
 * - Groups originating from the same travel post
 * - Groups for which the student already has an active pending join request/invitation
 * Validates:
 * - Same normalized origin & destination (isSameDirection)
 * - Same calendar travel date in Asia/Kolkata (isSameCalendarDay)
 * - Departure time within 420 minutes tolerance (isDepartureTimeCompatible)
 * - Safe admin and member preview without sensitive private data
 */
export async function findCompatibleGroupsForFindPost(findPost, studentId) {
  const now = new Date();

  if (!findPost || findPost.type !== 'request' || findPost.status !== 'active' || (findPost.expiresAt && findPost.expiresAt <= now)) {
    return [];
  }

  const studentVariants = getCandidateUserIds(studentId);

  // 0. Strict One Active Group Per Student rule: if student is already in any active group, hide group offers
  if (studentVariants.length > 0) {
    const alreadyInActiveGroup = await SharedRideGroup.findOne({
      status: { $in: ['open', 'full'] },
      expiresAt: { $gt: now },
      'members.userId': { $in: studentVariants }
    }).select('_id').lean();

    if (alreadyInActiveGroup) {
      return [];
    }
  }

  // 1. Fetch active pending join requests or invitations for this student to exclude groups
  const pendingRequests = studentVariants.length > 0
    ? await GroupJoinRequest.find(
        {
          requesterId: { $in: studentVariants },
          status: 'pending',
          groupId: { $ne: null }
        },
        { groupId: 1, expiresAt: 1 }
      ).populate({ path: 'groupId', select: 'expiresAt status' }).lean()
    : [];

  const activePendingGroupIds = [];
  const expiredRequestIds = [];

  for (const r of pendingRequests) {
    const expiry = r.expiresAt || r.groupId?.expiresAt;
    if (expiry && new Date(expiry) <= now) {
      expiredRequestIds.push(r._id);
    } else if (r.groupId && r.groupId.status === 'open') {
      activePendingGroupIds.push(r.groupId._id || r.groupId);
    }
  }

  // Lazy cleanup expired pending requests
  if (expiredRequestIds.length > 0) {
    GroupJoinRequest.updateMany(
      { _id: { $in: expiredRequestIds }, status: 'pending' },
      { $set: { status: 'expired' } }
    ).catch(() => {});
  }

  // 2. Query candidates
  const candidateQuery = {
    status: 'open',
    expiresAt: { $gt: now },
    ...(studentVariants.length > 0
      ? {
          adminId: { $nin: studentVariants },
          'members.userId': { $nin: studentVariants }
        }
      : {}),
    originatingTravelId: { $ne: findPost._id }
  };

  if (activePendingGroupIds.length > 0) {
    candidateQuery._id = { $nin: activePendingGroupIds };
  }

  const candidateGroups = await SharedRideGroup.find(candidateQuery)
    .populate({ path: 'originatingTravelId', select: 'status expiresAt' })
    .sort({ createdAt: -1 })
    .lean();

  // 3. Filter using compatibility rules
  const matchingGroups = [];
  for (const group of candidateGroups) {
    // Check non-empty & capacity
    const memberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (memberCount <= 0 || memberCount >= group.targetCapacity) {
      continue;
    }

    // Ensure originating FIND post is still active and unexpired
    const origTravel = group.originatingTravelId;
    if (origTravel && typeof origTravel === 'object') {
      if (origTravel.status !== 'active' || (origTravel.expiresAt && new Date(origTravel.expiresAt) <= now)) {
        continue;
      }
    }

    // Check same route and direction
    if (!isSameDirection(group.source, group.destination, findPost.source, findPost.destination)) {
      continue;
    }

    // Check same calendar day in Asia/Kolkata
    if (!isSameCalendarDay(group.travelDate, findPost.travelDate)) {
      continue;
    }

    // Check departure time within 420 minutes tolerance
    if (!isDepartureTimeCompatible(group.departureTime, findPost.departureTime, 420)) {
      continue;
    }

    matchingGroups.push(group);
  }

  if (matchingGroups.length === 0) {
    return [];
  }

  // 4. Attach safe admin profile & safe member preview (no phone, no email, no clerkId, no firebaseUid)
  const allUserIds = [
    ...new Set([
      ...matchingGroups.map((g) => g.adminId),
      ...matchingGroups.flatMap((g) => (g.members || []).map((m) => m.userId))
    ].filter(Boolean))
  ];

  const studentMap = await resolveStudentProfilesMap(allUserIds, { includeContact: false });

  return matchingGroups.map((g) => {
    const adminStudentDoc = getStudentFromMap(studentMap, g.adminId);
    const adminProfile = formatSafePublicStudent(adminStudentDoc, { fallbackName: 'Student' });

    const membersList = (g.members || []).map((m) => {
      const pDoc = getStudentFromMap(studentMap, m.userId);
      const safeMember = formatSafePublicStudent(pDoc, { fallbackName: 'Student' });
      return {
        ...safeMember,
        role: m.role || 'member'
      };
    });

    const memberCount = Array.isArray(g.members) ? g.members.length : 0;
    const availableSpots = Math.max(0, g.targetCapacity - memberCount);
    const groupDisplayName = buildGroupDisplayName(membersList, adminProfile.name);

    return {
      _id: g._id,
      groupId: g._id,
      groupDisplayName,
      source: g.source,
      destination: g.destination,
      travelDate: g.travelDate,
      departureTime: g.departureTime,
      admin: adminProfile,
      confirmedMemberCount: memberCount,
      targetCapacity: g.targetCapacity,
      availableSpots,
      availableSeats: availableSpots,
      status: g.status,
      members: membersList,
      membersPreview: membersList.slice(0, 4)
    };
  });
}
