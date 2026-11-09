import { getFirebaseAuth } from '../config/firebase.js';
import Student from '../models/Student.js';

/**
 * Core authentication identity resolution helper.
 * Resolves Firebase ID token, enforces verified emails, safely links or creates Student records,
 * and preserves legacy Clerk IDs and non-destructive profile attributes.
 */
export async function resolveAuthIdentity(bearerToken) {
  if (!bearerToken) {
    return { success: true, user: null };
  }

  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return {
      success: false,
      status: 500,
      message: 'Internal server error: Firebase Auth is not initialized'
    };
  }

  let decodedToken;
  try {
    decodedToken = await firebaseAuth.verifyIdToken(bearerToken);
  } catch (verifyErr) {
    return {
      success: false,
      status: 401,
      message: 'Unauthorized: Invalid or expired Firebase authentication token'
    };
  }

  if (!decodedToken || !decodedToken.uid) {
    return {
      success: false,
      status: 401,
      message: 'Unauthorized: Invalid Firebase authentication token'
    };
  }

  // Safety Requirement 1: Reject unverified emails
  if (decodedToken.email && decodedToken.email_verified === false) {
    return {
      success: false,
      status: 403,
      message: 'Forbidden: Email address must be verified to authenticate'
    };
  }

  // Safety Requirement 2: Search existing Student by firebaseUid or canonical clerkId
  let student = await Student.findOne({
    $or: [{ firebaseUid: decodedToken.uid }, { clerkId: decodedToken.uid }]
  });

  // Safety Requirement 3: Safe Account Linking by Verified Email
  if (!student && decodedToken.email && decodedToken.email_verified === true) {
    const lowerEmail = decodedToken.email.toLowerCase();
    const existingByEmail = await Student.findOne({ email: lowerEmail });

    if (existingByEmail) {
      // Conflict check: Never overwrite an existing different firebaseUid
      if (existingByEmail.firebaseUid && existingByEmail.firebaseUid !== decodedToken.uid) {
        return {
          success: false,
          status: 409,
          message: 'Conflict: An account with this email is already linked to another Firebase UID'
        };
      }

      // Safe linking: Only link the new verified firebaseUid; preserve legacy clerkId, registrationNumber, etc.
      await Student.updateOne(
        { _id: existingByEmail._id },
        { $set: { firebaseUid: decodedToken.uid } }
      );
      existingByEmail.firebaseUid = decodedToken.uid;
      student = existingByEmail;
    }
  }

  // Safety Requirement 4: Concurrent-safe first-time student record creation
  if (!student && decodedToken.email) {
    const canonicalUserId = `firebase_${decodedToken.uid}`;
    try {
      const studentName = decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Campus Student');
      student = await Student.create({
        clerkId: canonicalUserId,
        firebaseUid: decodedToken.uid,
        name: studentName,
        email: decodedToken.email.toLowerCase(),
        phone: decodedToken.phone_number || '',
        whatsappNumber: decodedToken.phone_number || '',
        imageUrl: decodedToken.picture || '',
        college: 'VIT',
        isVerified: Boolean(decodedToken.email_verified)
      });
    } catch (createErr) {
      // If concurrent request won the insert race or unique key hit
      student = await Student.findOne({
        $or: [
          { firebaseUid: decodedToken.uid },
          { clerkId: canonicalUserId },
          { email: decodedToken.email.toLowerCase() }
        ]
      });

      if (!student) {
        console.error('[Auth Middleware] Unexpected error during Student record creation:', createErr);
        return {
          success: false,
          status: 500,
          message: 'Internal server error while resolving student identity'
        };
      }
    }
  }

  // Safety Requirement 5: Canonical ID Resolution (Preserves legacy Clerk 'user_...' IDs)
  const canonicalUserId =
    student?.clerkId ||
    (decodedToken.uid.startsWith('firebase_') || decodedToken.uid.startsWith('user_')
      ? decodedToken.uid
      : `firebase_${decodedToken.uid}`);

  return {
    success: true,
    user: {
      userId: canonicalUserId,
      firebaseUser: decodedToken,
      firebaseUid: decodedToken.uid,
      student
    }
  };
}

/**
 * Enforces mandatory authentication.
 * Returns 401 Unauthorized (or 403 / 409) if missing, invalid, or conflicting.
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

  const result = await resolveAuthIdentity(bearerToken);
  if (!result.success) {
    return res.status(result.status || 401).json({
      success: false,
      message: result.message
    });
  }

  if (!result.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing authentication credentials'
    });
  }

  req.userId = result.user.userId;
  req.firebaseUser = result.user.firebaseUser;
  req.firebaseUid = result.user.firebaseUid;
  req.student = result.user.student;
  req.authType = 'firebase';

  return next();
};

/**
 * Optional Authentication Middleware.
 * Allows unauthenticated visitors (req.userId = null, req.authType = 'guest').
 * If an Authorization header is provided:
 * - Must be a valid, verified token.
 * - If invalid, expired, unverified or conflicting: strictly rejects with 401/403/409 (never silently treated as trusted).
 * - If valid: attaches authenticated identity.
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  // Unauthenticated guest request
  if (!authHeader || !authHeader.trim()) {
    req.userId = null;
    req.firebaseUser = null;
    req.firebaseUid = null;
    req.student = null;
    req.authType = 'guest';
    return next();
  }

  const isBearer = authHeader.startsWith('Bearer ');
  const bearerToken = isBearer ? authHeader.split('Bearer ')[1]?.trim() : null;

  if (!bearerToken) {
    // Malformed token provided
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Malformed Authorization header'
    });
  }

  const result = await resolveAuthIdentity(bearerToken);
  if (!result.success) {
    // Do NOT silently treat invalid credentials as a guest!
    return res.status(result.status || 401).json({
      success: false,
      message: result.message
    });
  }

  if (result.user) {
    req.userId = result.user.userId;
    req.firebaseUser = result.user.firebaseUser;
    req.firebaseUid = result.user.firebaseUid;
    req.student = result.user.student;
    req.authType = 'firebase';
  } else {
    req.userId = null;
    req.authType = 'guest';
  }

  return next();
};
