import { getFirebaseAuth } from '../config/firebase.js';
import Student from '../models/Student.js';

/**
 * Middleware to verify that the request is authenticated with Firebase ID token.
 * 1. Checks Bearer token in Authorization header.
 * 2. Verifies token cryptographically via Firebase Admin SDK.
 * 3. Enforces email_verified for account security.
 * 4. Resolves existing Student (by firebaseUid or verified email) to map canonical req.userId.
 * 5. Attaches canonical req.userId, req.firebaseUser, and req.firebaseUid to request object.
 * Rejects unauthenticated requests with a 401 status (or 403 if email is unverified).
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const isBearer = authHeader && authHeader.startsWith('Bearer ');
  const bearerToken = isBearer ? authHeader.split('Bearer ')[1]?.trim() : null;

  if (!bearerToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid authentication token'
    });
  }

  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error: Firebase Auth is not initialized'
    });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(bearerToken);
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid Firebase authentication token'
      });
    }

    // Safety requirement: Reject unverified email if email property is provided
    if (decodedToken.email && decodedToken.email_verified === false) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Email address must be verified to authenticate'
      });
    }

    // Map Firebase user to canonical application user ID (Student.clerkId)
    let student = await Student.findOne({
      $or: [{ firebaseUid: decodedToken.uid }, { clerkId: decodedToken.uid }]
    });

    // If not found by firebaseUid or clerkId, attempt safe linking by verified email
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
    // Existing students retain their original canonical ID (stored in clerkId, e.g. 'user_...')
    // so all their historical travels, bookings, and notifications remain 100% matched.
    // Brand-new students without a pre-existing record get canonical ID:
    const canonicalUserId =
      student?.clerkId ||
      (decodedToken.uid.startsWith('firebase_') || decodedToken.uid.startsWith('user_')
        ? decodedToken.uid
        : `firebase_${decodedToken.uid}`);

    req.userId = canonicalUserId;
    req.firebaseUser = decodedToken;
    req.firebaseUid = decodedToken.uid;
    req.authType = 'firebase';

    return next();
  } catch (firebaseErr) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired Firebase authentication token'
    });
  }
};
