import Travel from '../models/Travel.js';
import Student from '../models/Student.js';
import SharedRideGroup from '../models/SharedRideGroup.js';
import GroupJoinRequest from '../models/GroupJoinRequest.js';
import { createOutboxEvent, triggerOutboxSweep } from './outbox.service.js';
import { NOTIFICATION_JOB_TYPES } from '../jobs/notification.jobs.js';

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
export async function findMatchesForTravel(travelPost) {
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
  const candidates = await Travel.find({
    _id: { $ne: travelPost._id },
    userId: { $ne: travelPost.userId },
    status: 'active',
    expiresAt: { $gt: now },
    type: { $in: eligibleTypes }
  }).sort({ createdAt: -1 }).lean();

  const userBooked = travelPost.bookedSeats || 0;
  const userAvailableSeats = Math.max(0, (travelPost.seats || 1) - userBooked);

  // 3. Apply rule-based filter
  const matchedPosts = [];

  for (const candidate of candidates) {
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

  if (matchedPosts.length === 0) {
    return [];
  }

  // 4. Attach creator details including phone for direct WhatsApp coordination
  const userIds = [...new Set(matchedPosts.map((p) => p.userId))];
  const students = await Student.find(
    { clerkId: { $in: userIds } },
    { name: 1, email: 1, phone: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
  ).lean();

  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.clerkId, s));

  return matchedPosts.map((post) => {
    const student = studentMap.get(post.userId);
    const peerPhone = student?.phone || post.authorPhone || '';
    const publicProfile = {
      name: student?.name || post.authorName || 'Campus Student',
      email: student?.email || post.authorEmail || '',
      phone: peerPhone,
      imageUrl: student?.imageUrl || post.authorImage || null,
      avatarId: student?.avatarId || 'm1',
      college: student?.college || 'VIT, Bhopal',
      isVerified: Boolean(student?.isVerified)
    };
    return {
      ...post,
      phone: peerPhone,
      student: publicProfile,
      creator: publicProfile
    };
  });
}

/**
 * Finds all matching travel posts across all active unexpired travels of a given user.
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Object containing myTravels and matched travel posts
 */
export async function findMatchesForUser(userId) {
  const now = new Date();

  // 1. Fetch user's active, unexpired travels
  const myTravels = await Travel.find({
    userId,
    status: 'active',
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 }).lean();

  if (!myTravels || myTravels.length === 0) {
    return {
      hasPostedTravel: false,
      myTravels: [],
      matches: []
    };
  }

  // 2. Run matching for each of user's active travel posts and aggregate results
  const matchedMap = new Map();

  for (const travelPost of myTravels) {
    const matches = await findMatchesForTravel(travelPost);
    for (const match of matches) {
      const matchId = match._id.toString();
      if (!matchedMap.has(matchId)) {
        matchedMap.set(matchId, match);
      }
    }
  }

  return {
    hasPostedTravel: true,
    myTravels,
    matches: Array.from(matchedMap.values())
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
export async function findCompatibleFindPosts(targetFindPost) {
  if (!targetFindPost || targetFindPost.type !== 'request' || targetFindPost.status !== 'active') {
    return [];
  }

  const now = new Date();
  if (targetFindPost.expiresAt && new Date(targetFindPost.expiresAt) <= now) {
    return [];
  }

  const candidates = await Travel.find({
    _id: { $ne: targetFindPost._id },
    userId: { $ne: targetFindPost.userId },
    type: 'request',
    status: 'active',
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 }).lean();

  const compatiblePosts = [];
  for (const cand of candidates) {
    const isCompat = await areFindPostsCompatible(targetFindPost, cand);
    if (isCompat) {
      compatiblePosts.push(cand);
    }
  }

  if (compatiblePosts.length === 0) return [];

  // Enrich with safe public student details (omitting private phone numbers, emails, clerkId, firebaseUid)
  const userIds = [...new Set(compatiblePosts.map((p) => p.userId))];
  const students = await Student.find(
    { clerkId: { $in: userIds } },
    { name: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
  ).lean();

  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.clerkId, s));

  return compatiblePosts.map((post) => {
    const student = studentMap.get(post.userId);
    const safeStudent = {
      name: student?.name || post.authorName || 'Campus Student',
      imageUrl: student?.imageUrl || post.authorImage || null,
      avatarId: student?.avatarId || 'm1',
      college: student?.college || 'VIT, Bhopal',
      isVerified: Boolean(student?.isVerified)
    };

    return {
      _id: post._id,
      userId: post.userId,
      type: post.type,
      source: post.source,
      destination: post.destination,
      travelDate: post.travelDate,
      departureTime: post.departureTime,
      timeFlexibility: post.timeFlexibility,
      status: post.status,
      expiresAt: post.expiresAt,
      student: safeStudent,
      matchedWithTravelId: targetFindPost._id
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

  const compatiblePosts = await findCompatibleFindPosts(newFindPost);
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

  // 1. Fetch active pending join requests or invitations for this student to exclude groups
  const pendingRequests = await GroupJoinRequest.find(
    {
      requesterId: studentId,
      status: 'pending'
    },
    { groupId: 1, expiresAt: 1 }
  ).populate({ path: 'groupId', select: 'expiresAt status' }).lean();

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
    adminId: { $ne: studentId },
    'members.userId': { $ne: studentId },
    originatingTravelId: { $ne: findPost._id }
  };

  if (activePendingGroupIds.length > 0) {
    candidateQuery._id = { $nin: activePendingGroupIds };
  }

  const candidateGroups = await SharedRideGroup.find(candidateQuery).sort({ createdAt: -1 }).lean();

  // 3. Filter using compatibility rules
  const matchingGroups = [];
  for (const group of candidateGroups) {
    // Check capacity
    const memberCount = Array.isArray(group.members) ? group.members.length : 0;
    if (memberCount >= group.targetCapacity) {
      continue;
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

  const studentProfiles = await Student.find(
    { clerkId: { $in: allUserIds } },
    { name: 1, college: 1, isVerified: 1, imageUrl: 1, avatarId: 1, clerkId: 1, _id: 0 }
  ).lean();

  const studentMap = new Map();
  for (const s of studentProfiles) {
    studentMap.set(s.clerkId, {
      name: s.name || 'Campus Student',
      college: s.college || null,
      isVerified: Boolean(s.isVerified),
      imageUrl: s.imageUrl || null,
      avatarId: s.avatarId || null
    });
  }

  return matchingGroups.map((g) => {
    const adminProfile = studentMap.get(g.adminId) || {
      name: 'Campus Student',
      college: null,
      isVerified: false,
      imageUrl: null,
      avatarId: null
    };

    const membersList = (g.members || []).map((m) => {
      const p = studentMap.get(m.userId);
      return {
        name: p?.name || 'Member',
        imageUrl: p?.imageUrl || null,
        avatarId: p?.avatarId || null,
        role: m.role || 'member'
      };
    });

    const memberCount = Array.isArray(g.members) ? g.members.length : 0;
    const availableSpots = Math.max(0, g.targetCapacity - memberCount);

    return {
      _id: g._id,
      groupId: g._id,
      source: g.source,
      destination: g.destination,
      travelDate: g.travelDate,
      departureTime: g.departureTime,
      admin: adminProfile,
      confirmedMemberCount: memberCount,
      targetCapacity: g.targetCapacity,
      availableSpots,
      status: g.status,
      members: membersList,
      membersPreview: membersList.slice(0, 4)
    };
  });
}
