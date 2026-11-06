import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// 1. Load backend .env
dotenv.config({ path: path.resolve(backendDir, '.env') });

console.log('=== VERIFYING FIREBASE ADMIN SDK INITIALIZATION ===\n');

// 2. Check service account file existence
const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
console.log('1. FIREBASE_SERVICE_ACCOUNT_PATH in .env:', envPath);

const resolvedPath = path.resolve(backendDir, envPath || './firebase-service-account.json');
const fileExists = fs.existsSync(resolvedPath);
console.log(`2. File exists at "${resolvedPath}":`, fileExists);

if (!fileExists) {
  console.error('FAIL: Service account JSON file not found on disk.');
  process.exit(1);
}

// 3. Import and initialize Firebase Admin
import {
  initFirebaseAdmin,
  getFirebaseAdmin,
  getFirebaseMessaging,
  isFirebaseConfigured
} from '../src/config/firebase.js';

const app = initFirebaseAdmin();
const configured = isFirebaseConfigured();
const messaging = getFirebaseMessaging();

console.log('\n3. Initialization Results:');
console.log('- Firebase App Initialized:', Boolean(app));
console.log('- isFirebaseConfigured():', configured);
console.log('- Firebase Messaging Service Ready:', Boolean(messaging));
console.log('- Firebase App Name:', app?.name || 'none');

if (configured && app && messaging) {
  console.log('\nSUCCESS: Firebase Admin SDK initialized successfully with service account credentials!');
  console.log('All credentials and private keys remained secure (unprinted).');
  process.exit(0);
} else {
  console.error('\nFAIL: Firebase Admin SDK could not be initialized.');
  process.exit(1);
}

