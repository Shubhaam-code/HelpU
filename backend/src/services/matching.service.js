import Travel from '../models/Travel.js';
import Student from '../models/Student.js';

/**
 * Escapes regex special characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if two Date objects/strings fall on the exact same calendar day in Asia/Kolkata timezone.
 */
export function isSameCalendarDay(date1, date2) {
  if (!date1 || !date2) return false;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(date1)) === formatter.format(new Date(date2));
}

/**
 * Rule-based Smart Matching Engine for CampusPool.
 * 
 * Rules:
 * 1. When an OFFER is queried: finds compatible REQUEST and OFFER posts.
 * 2. When a REQUEST is queried: finds compatible OFFER posts only.
 * 3. Never match a student's post with their own post.
 * 4. Both posts must be active and unexpired (expiresAt > now).
 * 5. Travel date must match on the same calendar day in Asia/Kolkata.
 * 6. Source and Destination must match exactly (trimmed, case-insensitive).
 * 7. Time compatibility rule: Math.abs(timeA - timeB) <= flexibilityA + flexibilityB.
 * 8. For OFFER + REQUEST: Offer's available seats must be >= Request's required seats.
 * 9. For OFFER + OFFER: Compatible if date, source, destination, and time match.
 * 10. REQUEST + REQUEST never matches.
 * 11. Never exposes private phone numbers.
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

  // 1. Determine eligible candidate types:
  // - OFFER matches with REQUEST and OFFER
  // - REQUEST matches with OFFER only
  // - REQUEST + REQUEST never matches
  let eligibleTypes = [];
  if (travelPost.type === 'offer') {
    eligibleTypes = ['request', 'offer'];
  } else if (travelPost.type === 'request') {
    eligibleTypes = ['offer'];
  } else {
    return [];
  }

  // 2. Fetch unexpired, active candidate posts from other users with matching endpoints
  const candidates = await Travel.find({
    _id: { $ne: travelPost._id },
    userId: { $ne: travelPost.userId },
    status: 'active',
    expiresAt: { $gt: now },
    type: { $in: eligibleTypes },
    source: new RegExp(`^${escapeRegex(travelPost.source.trim())}$`, 'i'),
    destination: new RegExp(`^${escapeRegex(travelPost.destination.trim())}$`, 'i')
  }).sort({ createdAt: -1 });

  // 3. Apply rule-based filter
  const matchedPosts = [];

  for (const candidate of candidates) {
    // Rule: Same calendar day (Asia/Kolkata timezone)
    if (!isSameCalendarDay(travelPost.travelDate, candidate.travelDate)) {
      continue;
    }

    // Rule: Time compatibility using both students' flexibility:
    // Math.abs(timeA - timeB) <= flexibilityA + flexibilityB
    const timeDiff = Math.abs(travelPost.departureTime - candidate.departureTime);
    const totalFlexibility = travelPost.timeFlexibility + candidate.timeFlexibility;
    if (timeDiff > totalFlexibility) {
      continue;
    }

    // Rule: Seat compatibility
    if (travelPost.type === 'offer' && candidate.type === 'request') {
      // Offer must have enough seats for the request
      if (candidate.seats > travelPost.seats) {
        continue;
      }
    } else if (travelPost.type === 'request' && candidate.type === 'offer') {
      // Candidate offer must have enough seats for current request
      if (candidate.seats < travelPost.seats) {
        continue;
      }
    }
    // Note: OFFER + OFFER has no seat inventory transfer/combination check

    matchedPosts.push(candidate);
  }

  if (matchedPosts.length === 0) {
    return [];
  }

  // 4. Attach public creator details (Phone numbers strictly excluded for privacy)
  const userIds = [...new Set(matchedPosts.map((p) => p.userId))];
  const students = await Student.find(
    { clerkId: { $in: userIds } },
    { name: 1, email: 1, college: 1, isVerified: 1, clerkId: 1, _id: 0 }
  );

  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.clerkId, s));

  return matchedPosts.map((post) => {
    const postObj = post.toObject ? post.toObject() : { ...post };
    const student = studentMap.get(post.userId);
    return {
      ...postObj,
      creator: student
        ? {
            name: student.name,
            email: student.email,
            college: student.college,
            isVerified: student.isVerified
          }
        : null
    };
  });
}
