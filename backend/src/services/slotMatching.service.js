
import mongoose from 'mongoose';
import SlotPost from '../models/SlotPost.js';
import Course from '../models/Course.js';
import Student from '../models/Student.js';
import Notification from '../models/Notification.js';
import { sendPushToUser } from './fcm.service.js';

/**
 * Normalizes course name by trimming and collapsing multiple spaces.
 */
export function normalizeCourseName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalizes course code by trimming, removing inner spaces, and converting to uppercase.
 * Example: "CSE 2001" -> "CSE2001", "bio1001" -> "BIO1001"
 */
export function normalizeCourseCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Parses a slot string into an array of distinct normalized uppercase slot tokens.
 * Handles comma-separated, slash-separated, or space-separated slots.
 * Example: "C12, C13" -> ['C12', 'C13']
 * Example: "B11" -> ['B11']
 */
export function parseSlotTokens(slot) {
  if (!slot || typeof slot !== 'string') return [];
  return Array.from(
    new Set(
      slot
        .split(/[,/;+]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

/**
 * Normalizes slot name to canonical format (uppercase, trimmed, comma-separated tokens).
 */
export function normalizeSlot(slot) {
  if (!slot || typeof slot !== 'string') return '';
  const tokens = parseSlotTokens(slot);
  return tokens.length > 0 ? tokens.join(', ') : slot.trim().toUpperCase();
}

/**
 * Builds the comprehensive MongoDB query for finding compatible matches for a post.
 * 
 * Rules:
 * 1. Same Course Code (normalized & case-insensitive).
 * 2. Same Slot (any overlapping slot token, e.g. "C12, C13" matches "C12" or "C13").
 * 3. Different Student (never matches self posts, handles both raw UID and 'firebase_' prefix).
 * 4. Active status only.
 * 5. Teacher names can differ and are NEVER used as a filter.
 */
export function buildMatchingQuery(post, currentUserId) {
  const normCode = normalizeCourseCode(post.courseCode);
  const postTokens = post.slotTokens && post.slotTokens.length > 0
    ? post.slotTokens
    : parseSlotTokens(post.slot);
  const cleanSlot = normalizeSlot(post.slot);

  // Collect all variations of current student's user IDs to exclude self-matching
  const excludeIds = new Set();
  if (post.userId) {
    excludeIds.add(post.userId);
    const raw = post.userId.replace(/^firebase_/, '');
    excludeIds.add(raw);
    excludeIds.add(`firebase_${raw}`);
  }
  if (currentUserId) {
    excludeIds.add(currentUserId);
    const rawCurr = currentUserId.replace(/^firebase_/, '');
    excludeIds.add(rawCurr);
    excludeIds.add(`firebase_${rawCurr}`);
  }

  // Course condition: match either normalizedCourseCode, exact courseCode, or case-insensitive regex
  const courseConditions = [
    { normalizedCourseCode: normCode },
    { courseCode: normCode }
  ];
  if (normCode) {
    // Regex that matches with or without space, e.g. "BIO1001" or "BIO 1001"
    const spacedPattern = normCode.replace(/([A-Z]+)(\d+)/i, '$1\\s*$2');
    courseConditions.push({ courseCode: new RegExp(`^\\s*${spacedPattern}\\s*$`, 'i') });
  }

  // Slot condition: match if ANY token is shared
  const slotConditions = [];
  if (postTokens.length > 0) {
    slotConditions.push({ slotTokens: { $in: postTokens } });
    slotConditions.push({ slot: { $in: postTokens } });
    for (const token of postTokens) {
      slotConditions.push({
        slot: new RegExp(`(^|[,\\s/+]|\\b)${token}([,\\s/+]|\\b|$)`, 'i')
      });
    }
  }
  if (cleanSlot) {
    slotConditions.push({ slot: cleanSlot });
  }

  return {
    _id: { $ne: post._id },
    userId: { $nin: Array.from(excludeIds) },
    status: 'active',
    $and: [
      { $or: courseConditions },
      { $or: slotConditions }
    ]
  };
}

/**
 * Counts the active matching posts for a given slot post.
 */
export async function countMatchesForPost(post) {
  if (!post) return 0;
  const query = buildMatchingQuery(post);
  const count = await SlotPost.countDocuments(query);
  return count;
}

/**
 * Creates a new Slot Post.
 * Validates course against Course catalogue, prevents duplicate active posts for same course + slot.
 */
export async function createSlotPost({
  userId,
  courseId,
  courseCode,
  slot,
  teacherName,
  additionalNotes
}) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!courseId && !courseCode) {
    throw new Error('Course selection is required');
  }

  // 1. Validate course against the official Course catalogue
  let course = null;
  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course && courseCode) {
    const normSearchCode = normalizeCourseCode(courseCode);
    course = await Course.findOne({
      $or: [
        { courseCode: courseCode.trim().toUpperCase() },
        { courseCode: normSearchCode }
      ]
    });
  }

  if (!course) {
    throw new Error('Selected course does not exist in the official course catalogue');
  }

  const cleanSlot = normalizeSlot(slot);
  const slotTokens = parseSlotTokens(slot);
  if (!cleanSlot || slotTokens.length === 0) {
    throw new Error('Valid slot selection is required');
  }

  const cleanTeacher = (teacherName || '').trim();
  if (!cleanTeacher) {
    throw new Error('Teacher name is required');
  }

  const normCourseCode = normalizeCourseCode(course.courseCode);

  // 2. Prevent duplicate active post for the exact same student, course and slot
  const existingActivePost = await SlotPost.findOne({
    userId,
    $or: [
      { normalizedCourseCode: normCourseCode },
      { courseCode: course.courseCode }
    ],
    $or: [
      { slotTokens: { $all: slotTokens } },
      { slot: cleanSlot }
    ],
    status: 'active'
  });

  if (existingActivePost) {
    const error = new Error(`You already have an active post for ${course.courseCode} in slot ${cleanSlot}`);
    error.statusCode = 409;
    throw error;
  }

  // 3. Save post in MongoDB
  const newPost = new SlotPost({
    userId,
    courseId: course._id,
    courseCode: course.courseCode,
    normalizedCourseCode: normCourseCode,
    courseName: course.courseName,
    slot: cleanSlot,
    slotTokens,
    teacherName: cleanTeacher,
    additionalNotes: (additionalNotes || '').trim(),
    status: 'active'
  });

  const savedPost = await newPost.save();

  // 4. Calculate current match count
  const matchCount = await countMatchesForPost(savedPost);

  // 5. Automatically notify matched peers without blocking response
  notifyMatchedPeers(savedPost).catch((err) =>
    console.warn('[SlotMate Notification Warning]:', err.message)
  );

  return {
    post: savedPost,
    matchCount
  };
}

/**
 * Automatically creates in-app notifications and sends push notifications
 * when an eligible match is discovered between students.
 * Idempotent: Uses deterministic eventId to strictly prevent duplicate notifications.
 */
export async function notifyMatchedPeers(savedPost) {
  if (!savedPost) return;

  try {
    // Find all active matching posts created by other students
    const query = buildMatchingQuery(savedPost);
    const matchingPosts = await SlotPost.find(query);

    if (!matchingPosts || matchingPosts.length === 0) return;

    // Resolve creator student's details
    const creatorStudent = await resolveStudentProfile(savedPost.userId);
    const creatorName = creatorStudent?.name || 'A classmate';
    const creatorAvatar = creatorStudent?.imageUrl || '';

    const NOTIF_TITLE = 'New Slot Match Found!';
    const NOTIF_BODY = 'You have found a student studying the same course and slot. Connect now!';

    for (const peerPost of matchingPosts) {
      // Resolve peer student's details
      const peerStudent = await resolveStudentProfile(peerPost.userId);
      const peerName = peerStudent?.name || 'A classmate';
      const peerAvatar = peerStudent?.imageUrl || '';

      // 1. Notify the peer post owner about this new match
      const eventIdPeer = `slotmatch_notify_${peerPost._id}_${savedPost._id}`;
      const peerPostId = String(peerPost._id);
      const savedPostId = String(savedPost._id);
      const peerRoute = `/slotmate/matches?postId=${peerPostId}`;

      const peerMetadata = {
        courseCode: peerPost.courseCode || savedPost.courseCode,
        courseName: peerPost.courseName || savedPost.courseName || '',
        slot: savedPost.slot,
        matchedStudentId: String(creatorStudent?._id || savedPost.userId),
        matchedStudentName: creatorName,
        matchedStudentAvatar: creatorAvatar,
        matchId: savedPostId,
        postId: peerPostId,
        route: peerRoute,
        module: 'slotmate'
      };

      // 1. In-app notification for peer post owner (upsert to strictly prevent duplicates)
      await Notification.updateOne(
        { eventId: eventIdPeer },
        {
          $setOnInsert: {
            recipientId: peerPost.userId,
            eventId: eventIdPeer,
            type: 'SLOT_MATCH_FOUND',
            module: 'slotmate',
            title: NOTIF_TITLE,
            message: NOTIF_BODY,
            imageUrl: creatorAvatar,
            relatedSlotPostId: peerPost._id,
            metadata: peerMetadata,
            isRead: false
          }
        },
        { upsert: true }
      ).catch((err) => console.warn('[SlotMate Notification DB Save Error]:', err.message));

      // 2. In-app notification for the creator about the existing matching post
      const eventIdCreator = `slotmatch_notify_${savedPost._id}_${peerPost._id}`;
      const creatorRoute = `/slotmate/matches?postId=${savedPostId}`;

      const creatorMetadata = {
        courseCode: savedPost.courseCode || peerPost.courseCode,
        courseName: savedPost.courseName || peerPost.courseName || '',
        slot: peerPost.slot,
        matchedStudentId: String(peerStudent?._id || peerPost.userId),
        matchedStudentName: peerName,
        matchedStudentAvatar: peerAvatar,
        matchId: peerPostId,
        postId: savedPostId,
        route: creatorRoute,
        module: 'slotmate'
      };

      await Notification.updateOne(
        { eventId: eventIdCreator },
        {
          $setOnInsert: {
            recipientId: savedPost.userId,
            eventId: eventIdCreator,
            type: 'SLOT_MATCH_FOUND',
            module: 'slotmate',
            title: NOTIF_TITLE,
            message: NOTIF_BODY,
            imageUrl: peerAvatar,
            relatedSlotPostId: savedPost._id,
            metadata: creatorMetadata,
            isRead: false
          }
        },
        { upsert: true }
      ).catch((err) => console.warn('[SlotMate Notification DB Save Error]:', err.message));

      // 3. Dispatch real mobile push notifications in parallel (non-blocking)
      Promise.allSettled([
        sendPushToUser(
          peerPost.userId,
          {
            title: NOTIF_TITLE,
            body: NOTIF_BODY
          },
          {
            type: 'SLOT_MATCH_FOUND',
            module: 'slotmate',
            courseCode: String(peerMetadata.courseCode),
            courseName: String(peerMetadata.courseName),
            slot: String(peerMetadata.slot),
            matchedStudentId: String(peerMetadata.matchedStudentId),
            matchedStudentName: String(creatorName),
            matchId: savedPostId,
            postId: peerPostId,
            route: peerRoute
          }
        ),
        sendPushToUser(
          savedPost.userId,
          {
            title: NOTIF_TITLE,
            body: NOTIF_BODY
          },
          {
            type: 'SLOT_MATCH_FOUND',
            module: 'slotmate',
            courseCode: String(creatorMetadata.courseCode),
            courseName: String(creatorMetadata.courseName),
            slot: String(creatorMetadata.slot),
            matchedStudentId: String(creatorMetadata.matchedStudentId),
            matchedStudentName: String(peerName),
            matchId: peerPostId,
            postId: savedPostId,
            route: creatorRoute
          }
        )
      ]).catch((err) => console.warn('[SlotMate Push Dispatch Error]:', err.message));
    }
  } catch (err) {
    console.warn('[SlotMate notifyMatchedPeers Error]:', err.message);
  }
}

/**
 * Updates an existing Slot Post.
 * Re-validates course, slot, teacher, prevents conflicting duplicate active posts for the student.
 */
export async function updateSlotPost({
  postId,
  userId,
  courseId,
  courseCode,
  slot,
  teacherName,
  additionalNotes
}) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid post ID format');
    error.statusCode = 400;
    throw error;
  }

  const post = await SlotPost.findOne({ _id: postId, userId });
  if (!post) {
    const error = new Error('Slot post not found or unauthorized');
    error.statusCode = 404;
    throw error;
  }

  // 1. If course changed or specified
  let course = null;
  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  } else if (courseCode) {
    const normSearchCode = normalizeCourseCode(courseCode);
    course = await Course.findOne({
      $or: [
        { courseCode: courseCode.trim().toUpperCase() },
        { courseCode: normSearchCode }
      ]
    });
  }

  if (course) {
    post.courseId = course._id;
    post.courseCode = course.courseCode;
    post.normalizedCourseCode = normalizeCourseCode(course.courseCode);
    post.courseName = course.courseName;
  }

  // 2. Validate Slot
  const targetSlot = slot ? normalizeSlot(slot) : post.slot;
  const targetTokens = slot ? parseSlotTokens(slot) : (post.slotTokens || parseSlotTokens(post.slot));
  if (!targetSlot || targetTokens.length === 0) {
    throw new Error('Valid slot selection is required');
  }

  // Check duplicate: another active post with same course and slot for this student
  const normCourse = post.normalizedCourseCode || normalizeCourseCode(post.courseCode);
  const duplicate = await SlotPost.findOne({
    _id: { $ne: post._id },
    userId,
    $or: [
      { normalizedCourseCode: normCourse },
      { courseCode: post.courseCode }
    ],
    $or: [
      { slotTokens: { $all: targetTokens } },
      { slot: targetSlot }
    ],
    status: 'active'
  });

  if (duplicate) {
    const error = new Error(`You already have another active post for ${post.courseCode} in slot ${targetSlot}`);
    error.statusCode = 409;
    throw error;
  }

  post.slot = targetSlot;
  post.slotTokens = targetTokens;

  // 3. Validate Teacher
  if (teacherName !== undefined) {
    const cleanTeacher = (teacherName || '').trim();
    if (!cleanTeacher) {
      throw new Error('Teacher name is required');
    }
    post.teacherName = cleanTeacher;
  }

  // 4. Additional Notes
  if (additionalNotes !== undefined) {
    post.additionalNotes = (additionalNotes || '').trim();
  }

  post.status = 'active';
  const savedPost = await post.save();

  // 5. Recalculate match count
  const matchCount = await countMatchesForPost(savedPost);

  return {
    post: savedPost,
    matchCount
  };
}

/**
 * Retrieves all active posts created by the logged-in student,
 * populated with real-time match count for each post.
 */
export async function getMySlotPosts(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const rawUid = userId.replace(/^firebase_/, '');
  const userIds = [userId, rawUid, `firebase_${rawUid}`];

  const posts = await SlotPost.find({
    userId: { $in: userIds },
    status: 'active'
  }).sort({ createdAt: -1 });

  // Calculate match counts for all posts
  const postsWithCounts = await Promise.all(
    posts.map(async (post) => {
      const matchCount = await countMatchesForPost(post);
      const postObj = post.toObject();
      return {
        ...postObj,
        matchCount
      };
    })
  );

  return postsWithCounts;
}

/**
 * Finds or resolves student profile for a given userId.
 * Supports MongoDB Student collection, and falls back to Firebase Admin SDK to auto-upsert if missing.
 */
export async function resolveStudentProfile(userId) {
  if (!userId) return null;

  const rawUid = userId.replace(/^firebase_/, '');
  const candidateIds = [userId, rawUid, `firebase_${rawUid}`];

  const query = {
    $or: [
      { clerkId: { $in: candidateIds } },
      { firebaseUid: { $in: candidateIds } }
    ]
  };

  if (mongoose.Types.ObjectId.isValid(userId)) {
    query.$or.push({ _id: userId });
  }

  let student = await Student.findOne(query).select(
    'name email phone whatsappNumber college isVerified imageUrl'
  );

  if (student) return student;

  // Fallback: Query Firebase Admin SDK and auto-create the missing Student profile
  try {
    const { getFirebaseAuth } = await import('../config/firebase.js');
    const auth = getFirebaseAuth();
    if (auth && rawUid) {
      const fbUser = await auth.getUser(rawUid).catch(() => null);
      if (fbUser) {
        const studentName = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Campus Student');
        const phone = fbUser.phoneNumber || '';
        try {
          student = await Student.create({
            clerkId: `firebase_${rawUid}`,
            firebaseUid: rawUid,
            name: studentName,
            email: fbUser.email ? fbUser.email.toLowerCase() : '',
            phone,
            whatsappNumber: phone,
            imageUrl: fbUser.photoURL || '',
            college: 'VIT',
            isVerified: Boolean(fbUser.emailVerified)
          });
        } catch (insertErr) {
          student = await Student.findOne({
            $or: [{ clerkId: `firebase_${rawUid}` }, { firebaseUid: rawUid }]
          });
        }
        if (student) return student;
      }
    }
  } catch (fbErr) {
    // Ignore fallback errors and continue
  }

  return null;
}

/**
 * Retrieves all matched students for a specific post.
 * Matching rules:
 * - Same courseCode (normalized & case-insensitive)
 * - Same slot (overlapping slot tokens)
 * - Different student (userId != post.userId)
 * - Active status
 * - Teacher name is NOT a filter
 */
export async function getMatchesForPost(postId, currentUserId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    const error = new Error('Invalid post ID format');
    error.statusCode = 400;
    throw error;
  }

  const post = await SlotPost.findById(postId);
  if (!post || post.status !== 'active') {
    const error = new Error('Slot post not found or is no longer active');
    error.statusCode = 404;
    throw error;
  }

  const query = buildMatchingQuery(post, currentUserId);
  const matchingPosts = await SlotPost.find(query).sort({ createdAt: -1 });

  // Resolve student profiles and format matched results
  const matches = await Promise.all(
    matchingPosts.map(async (matchPost) => {
      const student = await resolveStudentProfile(matchPost.userId);
      const isSameTeacher =
        matchPost.teacherName.toLowerCase().trim() === post.teacherName.toLowerCase().trim();

      return {
        matchId: matchPost._id,
        postId: matchPost._id,
        userId: matchPost.userId,
        studentName: student?.name || 'Classmate',
        studentEmail: student?.email || '',
        studentCollege: student?.college || 'VIT Student',
        isVerified: student?.isVerified ?? true,
        profileImage: student?.imageUrl || '',
        courseCode: matchPost.courseCode,
        courseName: matchPost.courseName,
        slot: matchPost.slot,
        teacherName: matchPost.teacherName,
        isSameTeacher,
        additionalNotes: matchPost.additionalNotes || '',
        whatsappNumber: student?.whatsappNumber || student?.phone || '',
        phone: student?.phone || '',
        createdAt: matchPost.createdAt
      };
    })
  );

  return {
    post,
    matches,
    totalMatches: matches.length
  };
}

/**
 * Retrieves complete details of a specific match post.
 */
export async function getMatchDetails(matchId) {
  if (!matchId || !mongoose.Types.ObjectId.isValid(matchId)) {
    const error = new Error('Invalid match ID format');
    error.statusCode = 400;
    throw error;
  }

  const matchPost = await SlotPost.findById(matchId);
  if (!matchPost) {
    const error = new Error('Match post not found');
    error.statusCode = 404;
    throw error;
  }

  const student = await resolveStudentProfile(matchPost.userId);

  return {
    matchId: matchPost._id,
    userId: matchPost.userId,
    studentName: student?.name || 'Classmate',
    studentEmail: student?.email || '',
    studentCollege: student?.college || 'VIT Student',
    isVerified: student?.isVerified ?? true,
    profileImage: student?.imageUrl || '',
    courseCode: matchPost.courseCode,
    courseName: matchPost.courseName,
    slot: matchPost.slot,
    teacherName: matchPost.teacherName,
    additionalNotes: matchPost.additionalNotes || '',
    whatsappNumber: student?.whatsappNumber || student?.phone || '',
    phone: student?.phone || '',
    status: matchPost.status,
    createdAt: matchPost.createdAt
  };
}
