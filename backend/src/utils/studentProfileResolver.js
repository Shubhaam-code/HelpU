import mongoose from 'mongoose';
import Student from '../models/Student.js';

/**
 * Strips leading 'firebase_' prefix from a canonical user ID if present.
 */
export function stripFirebasePrefix(id) {
  if (!id || typeof id !== 'string') return '';
  return id.trim().replace(/^firebase_/, '');
}

/**
 * Returns all candidate ID formats for matching against clerkId / firebaseUid / Travel.userId.
 */
export function getCandidateUserIds(userId) {
  if (!userId || typeof userId !== 'string') return [];
  const trimmed = userId.trim();
  if (!trimmed) return [];
  const raw = stripFirebasePrefix(trimmed);
  const set = new Set([trimmed]);
  if (raw) {
    set.add(raw);
    set.add(`firebase_${raw}`);
  }
  return Array.from(set);
}

/**
 * Compares two user IDs safely across 'firebase_<uid>' and raw '<uid>' forms.
 */
export function isSameUserId(a, b) {
  if (!a || !b) return false;
  const sa = String(a).trim();
  const sb = String(b).trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const ra = stripFirebasePrefix(sa);
  const rb = stripFirebasePrefix(sb);
  return Boolean(ra && rb && ra === rb);
}

/**
 * Builds a normalized lookup Set containing both raw UID and 'firebase_' variants.
 */
export function buildUserIdSet(userIds = []) {
  const set = new Set();
  for (const id of userIds) {
    for (const v of getCandidateUserIds(id)) {
      set.add(v);
    }
  }
  return set;
}

/**
 * Checks whether any variant of userId exists in the lookup Set.
 */
export function isUserInSet(userId, set) {
  if (!userId || !set || set.size === 0) return false;
  if (set.has(userId)) return true;
  const raw = stripFirebasePrefix(userId);
  return set.has(raw) || set.has(`firebase_${raw}`);
}

/**
 * Formats a safe public student object, strictly stripping clerkId, firebaseUid, and Mongo _id.
 */
export function formatSafePublicStudent(studentDoc, { fallbackName = 'Student', includeContact = false } = {}) {
  const rawName = studentDoc?.name && typeof studentDoc.name === 'string' ? studentDoc.name.trim() : '';
  const result = {
    name: rawName || fallbackName,
    imageUrl: studentDoc?.imageUrl || null,
    avatarId: studentDoc?.avatarId || 'm1',
    college: studentDoc?.college || null,
    branch: studentDoc?.branch || studentDoc?.course || null,
    isVerified: Boolean(studentDoc?.isVerified)
  };

  if (includeContact) {
    result.email = studentDoc?.email || '';
    result.phone = studentDoc?.whatsappNumber || studentDoc?.phone || '';
    result.whatsappNumber = studentDoc?.whatsappNumber || studentDoc?.phone || '';
  }

  return result;
}

/**
 * Batch-resolves student profiles across both clerkId and firebaseUid variants.
 * Returns a Map keyed by every known ID variant for O(1) lookup.
 */
export async function resolveStudentProfilesMap(userIds = [], { includeContact = false } = {}) {
  const studentMap = new Map();
  const variantSet = buildUserIdSet(userIds);
  if (variantSet.size === 0) return studentMap;

  const variants = Array.from(variantSet);
  const projection = {
    name: 1,
    college: 1,
    branch: 1,
    course: 1,
    isVerified: 1,
    imageUrl: 1,
    avatarId: 1,
    clerkId: 1,
    firebaseUid: 1,
    _id: 0
  };

  if (includeContact) {
    projection.phone = 1;
    projection.whatsappNumber = 1;
    projection.email = 1;
  }

  const students = await Student.find(
    {
      $or: [
        { clerkId: { $in: variants } },
        { firebaseUid: { $in: variants } }
      ]
    },
    projection
  ).lean();

  for (const s of students) {
    if (s.clerkId) {
      for (const v of getCandidateUserIds(s.clerkId)) {
        studentMap.set(v, s);
      }
    }
    if (s.firebaseUid) {
      for (const v of getCandidateUserIds(s.firebaseUid)) {
        studentMap.set(v, s);
      }
    }
  }

  return studentMap;
}

/**
 * Looks up a student profile from a resolved Map using any ID variant.
 */
export function getStudentFromMap(studentMap, userId) {
  if (!studentMap || !userId) return null;
  if (studentMap.has(userId)) return studentMap.get(userId);
  const raw = stripFirebasePrefix(userId);
  return studentMap.get(raw) || studentMap.get(`firebase_${raw}`) || null;
}

/**
 * Resolves a single Student document across clerkId / firebaseUid variants (optional transaction session).
 */
export async function resolveSingleStudent(userId, { session = null, lean = false } = {}) {
  const variants = getCandidateUserIds(userId);
  if (variants.length === 0) return null;

  const orClauses = [
    { clerkId: { $in: variants } },
    { firebaseUid: { $in: variants } }
  ];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    orClauses.push({ _id: userId });
  }

  let query = Student.findOne({ $or: orClauses });
  if (session) query = query.session(session);
  if (lean) query = query.lean();
  return query;
}

