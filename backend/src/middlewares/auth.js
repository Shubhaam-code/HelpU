import { getAuth } from '@clerk/express';

/**
 * Middleware to verify that the request is authenticated with Clerk.
 * Rejects unauthenticated requests with a 401 status.
 * Attaches the authenticated Clerk userId and auth details to the request.
 */
export const requireAuth = (req, res, next) => {
  const auth = getAuth(req);

  if (!auth || !auth.userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid authentication token'
    });
  }

  // Extract and attach Clerk userId for downstream route handlers
  req.userId = auth.userId;
  req.auth = auth;

  next();
};
