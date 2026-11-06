import { getAuth as getClerkAuth } from '@clerk/express';
import { getFirebaseAuth } from '../config/firebase.js';
import Student from '../models/Student.js';

/**
 * Helper to inspect if a JWT is a Firebase-issued token
 */
function isFirebaseToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return (
      (typeof payload.iss === 'string' && payload.iss.includes('securetoken.google.com')) ||
      Boolean(payload.firebase)
    );
  } catch {
    return false;
  }
}

/**
 * Middleware to verify that the request is authenticated with Firebase or Clerk.
 * Dual-auth supports seamless transition:
 * 1. Checks Bearer token in Authorization header.
 *    - If identified as a Firebase token, verifies via Firebase Admin SDK.
 *    - Rejects invalid/expired Firebase tokens immediately (prevents accidental Clerk fallback).
 *    - Enforces email_verified for account linking/access.
 *    - Resolves existing Student (by firebaseUid or email) to map canonical req.userId.
 * 2. Falls back to Clerk authentication if the token is not a Firebase token or if Clerk cookies are present.
 * Rejects unauthenticated requests with a 401 status (or 403 if email is unverified).
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const isBearer = authHeader && authHeader.startsWith('Bearer ');
  const bearerToken = isBearer ? authHeader.split('Bearer ')[1]?.trim() : null;

  // 1. If a Bearer token is provided and matches Firebase token structure, process via Firebase
  if (bearerToken && isFirebaseToken(bearerToken)) {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error: Firebase Auth is not initialized'
      });
    }

    try {
      const decodedToken = await firebaseAuth.verifyIdToken(bearerToken);
      if (decodedToken && decodedToken.uid) {
        // Safety requirement: Never automatically link or authenticate accounts with unverified email
        if (decodedToken.email && decodedToken.email_verified === false) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Email address must be verified to authenticate'
          });
        }

        // Map Firebase user to canonical application user ID (Student.clerkId)
        let student = await Student.findOne({ firebaseUid: decodedToken.uid });

        // If not found by firebaseUid, attempt safe linking by verified email
        if (!student && decodedToken.email && decodedToken.email_verified) {
          const lowerEmail = decodedToken.email.toLowerCase();
          student = await Student.findOne({ email: lowerEmail });
          if (student) {
            // Link this verified Firebase UID to the existing student record
            student.firebaseUid = decodedToken.uid;
            await Student.updateOne(
              { _id: student._id },
              { $set: { firebaseUid: decodedToken.uid } }
            );
          }
        }

        // Canonical ID resolution:
        // Existing students retain their original clerkId (e.g. 'user_...') so all their
        // travels, bookings, and notifications remain 100% matched.
        // Brand-new students without a pre-existing clerkId get 'firebase_' + uid.
        const canonicalUserId = student?.clerkId || `firebase_${decodedToken.uid}`;

        req.userId = canonicalUserId;
        req.firebaseUser = decodedToken;
        req.firebaseUid = decodedToken.uid;
        req.authType = 'firebase';

        return next();
      }
    } catch (firebaseErr) {
      // An explicit Firebase token failed verification (expired, invalid signature, or revoked).
      // Security guard: Reject immediately. Do NOT accidentally fall back to Clerk.
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired Firebase authentication token'
      });
    }
  }

  // 2. Fallback to Clerk authentication for temporary dual-auth compatibility
  try {
    let clerkAuth = null;
    if (req.auth && typeof req.auth === 'object' && req.auth.userId) {
      clerkAuth = req.auth;
    } else {
      clerkAuth = getClerkAuth(req);
    }

    if (clerkAuth && clerkAuth.userId) {
      req.userId = clerkAuth.userId;
      req.auth = clerkAuth;
      req.authType = 'clerk';
      return next();
    }
  } catch (clerkErr) {
    // Clerk verification failed
  }

  // 3. Both authentications failed
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Missing or invalid authentication token'
  });
};
