import { normalizeCredentials, parseCredentialString } from '../src/config/firebase.js';

console.log('=== TESTING CREDENTIAL PARSER SCENARIOS ===');

const mockServiceAccount = {
  project_id: 'helpu-bae0b',
  client_email: 'firebase-adminsdk-test@helpu-bae0b.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5\\n-----END PRIVATE KEY-----\\n'
};

// 1. Direct JSON test
const jsonStr = JSON.stringify(mockServiceAccount);
const res1 = parseCredentialString(jsonStr);
console.log('1. Direct JSON parsed:', !!res1, res1?.project_id === 'helpu-bae0b');
console.log('   Private key newlines normalized:', res1?.private_key.includes('\n') && !res1?.private_key.includes('\\n'));

// 2. Base64 encoded test
const b64Str = Buffer.from(jsonStr).toString('base64');
const res2 = parseCredentialString(b64Str);
console.log('2. Base64 string parsed:', !!res2, res2?.project_id === 'helpu-bae0b');

// 3. Wrapped in double quotes test (common Render UI paste mistake)
const wrappedQuotes = `"${b64Str}"`;
const res3 = parseCredentialString(wrappedQuotes);
console.log('3. Double-quote wrapped base64 parsed:', !!res3, res3?.project_id === 'helpu-bae0b');

// 4. Raw JSON with literal escaped newlines
const wrappedJsonQuotes = `"${jsonStr.replace(/"/g, '\\"')}"`;
const res4 = parseCredentialString(jsonStr);
console.log('4. Normalization preserves credentials:', !!res4 && res4.client_email === mockServiceAccount.client_email);

if (res1 && res2 && res3 && res4) {
  console.log('\nALL 4 CREDENTIAL PARSER TESTS PASSED!');
  process.exit(0);
} else {
  console.error('\nFAIL: One or more parser tests failed');
  process.exit(1);
}
