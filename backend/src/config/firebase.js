import { initializeApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let firebaseAdminApp = null;
let isConfigured = false;

/**
 * Parses raw service account credential string from env
 * Supports both plain JSON string and base64 encoded JSON string
 */
function parseCredentialString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Try parsing direct JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      console.warn('[FirebaseAdmin] Failed to parse JSON from FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // Try parsing base64 decoded string
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (decoded.trim().startsWith('{')) {
      return JSON.parse(decoded);
    }
  } catch (e) {
    // Not valid base64 JSON
  }

  return null;
}

/**
 * Initialize Firebase Admin SDK safely with multiple credential strategies.
 * Gracefully handles missing credentials without crashing the server.
 */
export function initFirebaseAdmin() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  // Check if an app is already initialized in this process
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAdminApp = existingApps[0];
    isConfigured = true;
    console.log('[FirebaseAdmin] Reusing existing Firebase Admin app instance.');
    return firebaseAdminApp;
  }

  let credentials = null;

  // Strategy 1: Environment variable with raw JSON or base64 JSON (recommended for cloud like Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credentials = parseCredentialString(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (credentials) {
      console.log('[FirebaseAdmin] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    }
  }

  // Strategy 2: File path from environment variable (e.g. FIREBASE_SERVICE_ACCOUNT_PATH)
  if (!credentials && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      let filePath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (!fs.existsSync(filePath)) {
        // Fallback: resolve relative to backend package root directory
        const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
        const altPath = path.resolve(backendDir, process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        if (fs.existsSync(altPath)) {
          filePath = altPath;
        }
      }

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        credentials = JSON.parse(fileContent);
        console.log(`[FirebaseAdmin] Loaded credentials from file path: ${filePath}`);
      } else {
        console.warn(`[FirebaseAdmin] Credential file not found at: ${filePath}`);
      }
    } catch (err) {
      console.warn('[FirebaseAdmin] Error reading credentials from path:', err.message);
    }
  }

  // Strategy 3: Standard default service account file location
  if (!credentials) {
    const defaultLocalPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(defaultLocalPath)) {
      try {
        const fileContent = fs.readFileSync(defaultLocalPath, 'utf-8');
        credentials = JSON.parse(fileContent);
        console.log('[FirebaseAdmin] Loaded credentials from default local ./serviceAccountKey.json');
      } catch (err) {
        console.warn('[FirebaseAdmin] Error reading default local serviceAccountKey.json:', err.message);
      }
    }
  }

  // Strategy 4: Google Application Default Credentials (GCP environment)
  if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      firebaseAdminApp = initializeApp({
        credential: applicationDefault()
      });
      isConfigured = true;
      console.log('[FirebaseAdmin] Initialized Firebase Admin via Google Application Default Credentials.');
      return firebaseAdminApp;
    } catch (gcpErr) {
      console.warn('[FirebaseAdmin] GCP Application Default Credentials failed:', gcpErr.message);
    }
  }

  // Initialize if credentials found
  if (credentials) {
    try {
      firebaseAdminApp = initializeApp({
        credential: cert(credentials)
      });
      isConfigured = true;
      console.log(`[FirebaseAdmin] Successfully initialized Firebase Admin for project: "${credentials.project_id || 'unknown'}"`);
      return firebaseAdminApp;
    } catch (initErr) {
      console.error('[FirebaseAdmin] Failed to initialize Firebase Admin with credentials:', initErr.message);
    }
  }

  // Graceful fallback: Do NOT crash the server
  console.warn(
    '[FirebaseAdmin] NOTICE: No Firebase service account credentials configured. ' +
    'Push notification features will safely no-op until FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH is set in backend/.env'
  );

  return null;
}

/**
 * Returns the initialized Firebase Admin instance, or null if unconfigured
 */
export function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    initFirebaseAdmin();
  }
  return firebaseAdminApp;
}

let mockMessagingInstance = null;

/**
 * Testing helper to inject a mock messaging instance
 */
export function setMockMessaging(mock) {
  mockMessagingInstance = mock;
}

/**
 * Resets testing mock messaging instance
 */
export function resetMockMessaging() {
  mockMessagingInstance = null;
}

/**
 * Returns Firebase Messaging instance, or null if unconfigured
 */
export function getFirebaseMessaging() {
  if (mockMessagingInstance) return mockMessagingInstance;
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (err) {
    console.warn('[FirebaseAdmin] Error getting Firebase Messaging service:', err.message);
    return null;
  }
}

/**
 * Returns true if Firebase Admin SDK is successfully authenticated and configured
 */
export function isFirebaseConfigured() {
  if (mockMessagingInstance) return true;
  return isConfigured && Boolean(firebaseAdminApp);
}

export default {
  initFirebaseAdmin,
  getFirebaseAdmin,
  getFirebaseMessaging,
  isFirebaseConfigured
};
