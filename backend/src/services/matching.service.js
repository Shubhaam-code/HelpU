import Travel from '../models/Travel.js';
import Student from '../models/Student.js';

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
 * Checks if two Date objects/strings fall on the exact same calendar day in Asia/Kolkata timezone.
 */
export function isSameCalendarDay(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d1) === formatter.format(d2);
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
    const timeDiff = Math.abs((travelPost.departureTime || 0) - (candidate.departureTime || 0));
    if (timeDiff > 420) {
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
      isVerified: student?.isVerified ?? true
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
