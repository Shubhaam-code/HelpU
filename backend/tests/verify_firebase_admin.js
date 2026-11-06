import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import {
  initFirebaseAdmin,
  getFirebaseAdmin,
  getFirebaseMessaging,
  isFirebaseConfigured
} from '../src/config/firebase.js';

console.log('--- TEST 1: Direct firebase-admin imports ---');
console.log('initializeApp type:', typeof initializeApp);
console.log('getMessaging type:', typeof getMessaging);
console.log('getApps initial count:', getApps().length);
console.log('PASS: firebase-admin imports successfully.\n');

console.log('--- TEST 2: Graceful unconfigured state ---');
const configuredBefore = isFirebaseConfigured();
console.log('isFirebaseConfigured before init:', configuredBefore);

const app = initFirebaseAdmin();
console.log('initFirebaseAdmin() returned:', app);

const adminInstance = getFirebaseAdmin();
console.log('getFirebaseAdmin() returned:', adminInstance);

const messagingInstance = getFirebaseMessaging();
console.log('getFirebaseMessaging() returned:', messagingInstance);

const configuredAfter = isFirebaseConfigured();
console.log('isFirebaseConfigured after init:', configuredAfter);

if (configuredAfter === false && adminInstance === null && messagingInstance === null) {
  console.log('PASS: Graceful unconfigured state verified without throwing exceptions.\n');
} else {
  console.error('FAIL: Expected null instances in unconfigured state.');
  process.exit(1);
}

console.log('--- ALL STEP 1 VERIFICATION TESTS PASSED ---');

