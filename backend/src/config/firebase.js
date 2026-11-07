import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let firebaseAdminApp = null;
let hasPushCredentials = false;
let isConfigured = false;
let mockAuthInstance = null;
let mockMessagingInstance = null;

/**
 * Normalizes service account credentials object and validates private_key.
 * Safely converts escaped newlines ('\\n') to actual newlines.
 */
export function normalizeCredentials(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const projectId = obj.project_id || obj.projectId || process.env.FIREBASE_PROJECT_ID || 'helpu-bae0b';
  const clientEmail = obj.client_email || obj.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = obj.private_key || obj.privateKey || process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Normalize private key line breaks (convert escaped '\\n' to real newlines)
  if (typeof privateKey === 'string') {
    privateKey = privateKey.trim();
    // Strip leading/trailing quotes if wrapped
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    // Replace literal escaped \n with actual newline
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
  }

  if (
    !privateKey.includes('-----BEGIN PRIVATE KEY-----') &&
    !privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')
  ) {
    console.warn('[FirebaseAdmin] Private key does not contain expected PEM header.');
    return null;
  }

  return {
    ...obj,
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  };
}

/**
 * Safely parses raw credential string from environment variables
 * Supports plain JSON string and base64 encoded JSON string
 */
export function parseCredentialString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();

  // Strip wrapping quotes if user pasted '"..."' into cloud dashboard
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // 1. Try parsing direct JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeCredentials(parsed);
    } catch (e) {
      // Attempt repair for unescaped newlines in private_key
      try {
        const repaired = trimmed.replace(/\r?\n/g, '\\n');
        const parsed = JSON.parse(repaired);
        return normalizeCredentials(parsed);
      } catch (repairErr) {
        console.warn('[FirebaseAdmin] Failed to parse JSON from credential string:', e.message);
      }
    }
  }

  // 2. Try parsing base64 decoded string
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8').trim();
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      const parsed = JSON.parse(decoded);
      return normalizeCredentials(parsed);
    }
  } catch (e) {
    // Not valid base64
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

  // Strategy 1: Environment variable FIREBASE_SERVICE_ACCOUNT_KEY (direct JSON or base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    credentials = parseCredentialString(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (credentials) {
      console.log('[FirebaseAdmin] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    }
  }

  // Strategy 2: Individual environment variables
  if (!credentials && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credentials = normalizeCredentials({
      project_id: process.env.FIREBASE_PROJECT_ID || 'helpu-bae0b',
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY
    });
    if (credentials) {
      console.log('[FirebaseAdmin] Loaded credentials from individual environment variables (FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).');
    }
  }

  // Strategy 3: Render Secret Files (Render mounts secret files at /etc/secrets/)
  if (!credentials) {
    const renderSecretPaths = [
      '/etc/secrets/firebase-service-account.json',
      '/etc/secrets/serviceAccountKey.json',
      '/etc/secrets/FIREBASE_SERVICE_ACCOUNT_KEY'
    ];
    for (const secretPath of renderSecretPaths) {
      if (fs.existsSync(secretPath)) {
        try {
          const raw = fs.readFileSync(secretPath, 'utf-8');
          credentials = parseCredentialString(raw) || normalizeCredentials(JSON.parse(raw));
          if (credentials) {
            console.log(`[FirebaseAdmin] Loaded credentials from Render secret file: ${secretPath}`);
            break;
          }
        } catch (e) {
          console.warn(`[FirebaseAdmin] Error reading Render secret file ${secretPath}:`, e.message);
        }
      }
    }
  }

  // Strategy 4: File path from FIREBASE_SERVICE_ACCOUNT_PATH
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
        credentials = parseCredentialString(fileContent) || normalizeCredentials(JSON.parse(fileContent));
        if (credentials) {
          console.log(`[FirebaseAdmin] Loaded credentials from file path: ${filePath}`);
        }
      } else {
        console.warn(`[FirebaseAdmin] Credential file not found at: ${filePath}`);
      }
    } catch (err) {
      console.warn('[FirebaseAdmin] Error reading credentials from path:', err.message);
    }
  }

  // Strategy 5: Standard local default file locations
  if (!credentials) {
    const defaultFilenames = ['firebase-service-account.json', 'serviceAccountKey.json'];
    const searchDirs = [
      process.cwd(),
      path.resolve(process.cwd(), 'backend'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')
    ];

    for (const filename of defaultFilenames) {
      for (const dir of searchDirs) {
        const candidatePath = path.resolve(dir, filename);
        if (fs.existsSync(candidatePath)) {
          try {
            const fileContent = fs.readFileSync(candidatePath, 'utf-8');
            credentials = parseCredentialString(fileContent) || normalizeCredentials(JSON.parse(fileContent));
            if (credentials) {
              console.log(`[FirebaseAdmin] Loaded credentials from local file: ${candidatePath}`);
              break;
            }
          } catch (err) {
            console.warn(`[FirebaseAdmin] Error reading credentials from ${candidatePath}:`, err.message);
          }
        }
      }
      if (credentials) break;
    }
  }

  // Initialize with Certificate Credentials if found
  if (credentials) {
    try {
      firebaseAdminApp = initializeApp({
        credential: cert(credentials),
        projectId: credentials.project_id
      });
      hasPushCredentials = true;
      isConfigured = true;
      console.log(`[FirebaseAdmin] Successfully initialized Firebase Admin for project: "${credentials.project_id || 'unknown'}"`);

      // Verify Google OAuth2 access token asynchronously (verification check only)
      try {
        firebaseAdminApp.options.credential.getAccessToken().then((token) => {
          console.log(`[FirebaseAdmin] Google OAuth2 access token verified successfully! Firebase Cloud Messaging is READY (expires in ${token.expires_in}s).`);
        }).catch((tokenErr) => {
          console.warn('[FirebaseAdmin] OAuth2 access token verification notice:', tokenErr.message);
        });
      } catch (e) {
        // non-fatal check
      }

      return firebaseAdminApp;
    } catch (initErr) {
      console.error('[FirebaseAdmin] Failed to initialize Firebase Admin with credentials:', initErr.message);
    }
  }

  // Strategy 6: Fallback: Cloud Project Initialization without private cert (enables public key token verification only)
  const projectId = process.env.FIREBASE_PROJECT_ID || 'helpu-bae0b';
  try {
    firebaseAdminApp = initializeApp({ projectId });
    isConfigured = true;
    hasPushCredentials = false;
    console.warn(
      `[FirebaseAdmin] NOTICE: Initialized Firebase Admin in AUTH-ONLY mode for project: "${projectId}". ` +
      'Push notification delivery requires FIREBASE_SERVICE_ACCOUNT_KEY in your Render dashboard environment variables.'
    );
    return firebaseAdminApp;
  } catch (projErr) {
    console.error('[FirebaseAdmin] Failed to initialize Firebase Admin with projectId:', projErr.message);
  }

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
  if (!app || !hasPushCredentials) return null;
  try {
    return getMessaging(app);
  } catch (err) {
    console.warn('[FirebaseAdmin] Error getting Firebase Messaging service:', err.message);
    return null;
  }
}

/**
 * Testing helper to inject a mock auth instance
 */
export function setMockAuth(mock) {
  mockAuthInstance = mock;
}

/**
 * Resets testing mock auth instance
 */
export function resetMockAuth() {
  mockAuthInstance = null;
}

/**
 * Returns Firebase Auth instance, or null if unconfigured
 */
export function getFirebaseAuth() {
  if (mockAuthInstance) return mockAuthInstance;
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch (err) {
    console.warn('[FirebaseAdmin] Error getting Firebase Auth service:', err.message);
    return null;
  }
}

/**
 * Returns true if Firebase Admin SDK is successfully authenticated with push credentials
 */
export function isFirebaseConfigured() {
  if (mockMessagingInstance || mockAuthInstance) return true;
  return isConfigured && Boolean(firebaseAdminApp) && hasPushCredentials;
}

export function hasValidFirebaseCredentials() {
  return hasPushCredentials;
}

export default {
  initFirebaseAdmin,
  getFirebaseAdmin,
  getFirebaseAuth,
  getFirebaseMessaging,
  isFirebaseConfigured,
  hasValidFirebaseCredentials,
  normalizeCredentials,
  parseCredentialString
};
