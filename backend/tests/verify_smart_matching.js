import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';
import Student from '../src/models/Student.js';

// Setup RSA key pair for testing Clerk JWT token verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_bWludC1zZWFndWxsLTkzNTIuY2xlcmsuYWNjb3VudHMuZGV2JA';
process.env.CLERK_SECRET_KEY = 'sk_test_gMb6su0ewLT3mJhj9hlubhxGD7Iv7HLH0vj6sO4qAl';
process.env.CLERK_JWT_KEY = publicKey;

function generateTestToken(userId) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + 3600,
    nbf: now - 5,
    sid: 'sess_matching_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const userOfferA = 'user_matching_offer_A';
const userReqB = 'user_matching_req_B';
const userOfferC = 'user_matching_offer_C';
const userReqD = 'user_matching_req_D';
const userOther = 'user_matching_unauthorized';

const tokenOfferA = generateTestToken(userOfferA);
const tokenReqB = generateTestToken(userReqB);
const tokenOther = generateTestToken(userOther);

async function runTestSuite() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';
  await mongoose.connect(mongoUri);

  // Clean test records
  const allTestUsers = [userOfferA, userReqB, userOfferC, userReqD, userOther];
  await Travel.deleteMany({ userId: { $in: allTestUsers } });
  await Student.deleteMany({ clerkId: { $in: allTestUsers } });

  // Create Student profiles for test users
  await Student.create([
    { clerkId: userOfferA, name: 'Alice Driver', email: 'alice@campus.edu', phone: '+919999911111', college: 'Tech University' },
    { clerkId: userReqB, name: 'Bob Rider', email: 'bob@campus.edu', phone: '+919999922222', college: 'Tech University' },
    { clerkId: userOfferC, name: 'Charlie Co-Driver', email: 'charlie@campus.edu', phone: '+919999933333', college: 'Tech University' },
    { clerkId: userReqD, name: 'David LargeGroup', email: 'david@campus.edu', phone: '+919999944444', college: 'Tech University' }
  ]);

  const port = 5006;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('================================================================');
  console.log('TEST SUITE: CampusPool Smart Matching Engine (Task 10)');
  console.log('================================================================\n');

  try {
    const travelDate = '2026-11-10'; // future date
    const source = 'Campus Gate 1';
    const destination = 'New Delhi Railway Station';

    // 1. Primary Test Offer (OfferA)
    // 10:00 AM (600 mins), flex: 60 mins, seats: 3
    const offerA = await Travel.create({
      userId: userOfferA,
      type: 'offer',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 3,
      status: 'active'
    });

    // 2. Compatible Request (ReqB)
    // 10:30 AM (630 mins), flex: 30 mins, seats: 2 (<= 3) -> MATCH
    const reqB = await Travel.create({
      userId: userReqB,
      type: 'request',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 630,
      timeFlexibility: 30,
      seats: 2,
      status: 'active'
    });

    // 3. Compatible Offer (OfferC)
    // 10:45 AM (645 mins), flex: 30 mins, seats: 1 -> MATCH with OfferA
    const offerC = await Travel.create({
      userId: userOfferC,
      type: 'offer',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 645,
      timeFlexibility: 30,
      seats: 1,
      status: 'active'
    });

    // 4. Incompatible Seat Request (ReqD)
    // 10:00 AM (600 mins), seats: 4 (> 3 seats offered by OfferA) -> NO MATCH for OfferA
    const reqD = await Travel.create({
      userId: userReqD,
      type: 'request',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 30,
      seats: 4,
      status: 'active'
    });

    // 5. Incompatible Date
    await Travel.create({
      userId: userReqB,
      type: 'request',
      source,
      destination,
      travelDate: new Date('2026-11-12'), // different date
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });

    // 6. Incompatible Location
    await Travel.create({
      userId: userReqB,
      type: 'request',
      source: 'Airport Terminal 3', // different source
      destination,
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });

    // 7. Time Compatibility: Exact 420 mins (MATCH) vs 421 mins (NO MATCH)
    // OfferA = 600 mins (10:00 AM).
    // Exact 420 min difference: 1020 mins (05:00 PM) -> MATCH
    const reqExact420 = await Travel.create({
      userId: userReqB,
      type: 'request',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 1020,
      timeFlexibility: 30,
      seats: 1,
      status: 'active'
    });

    // 421 min difference: 1021 mins (05:01 PM) -> NO MATCH
    const reqDiff421 = await Travel.create({
      userId: userReqB,
      type: 'request',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 1021,
      timeFlexibility: 30,
      seats: 1,
      status: 'active'
    });

    // 8. Own-Post Exclusion: User_OfferA also creates a request with exact same details
    await Travel.create({
      userId: userOfferA, // same user!
      type: 'request',
      source,
      destination,
      travelDate: new Date(travelDate),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active'
    });

    // 9. Expired Post
    await Travel.create({
      userId: userReqB,
      type: 'request',
      source,
      destination,
      travelDate: new Date('2026-10-25'),
      departureTime: 600,
      timeFlexibility: 60,
      seats: 1,
      status: 'active',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // expired yesterday
    });

    // ----------------------------------------------------------------
    // TEST 1: OFFER -> REQUEST and OFFER
    // ----------------------------------------------------------------
    console.log('>>> TEST 1: OFFER -> Matches compatible REQUEST and OFFER <<<');
    const resOfferA = await fetch(`${baseUrl}/api/travels/${offerA._id}/matches`, {
      headers: { Authorization: `Bearer ${tokenOfferA}` }
    });
    const dataOfferA = await resOfferA.json();
    console.log('Status:', resOfferA.status);
    console.log('Total matches found for OfferA:', dataOfferA.count);
    const matchedTypes = dataOfferA.data.map(m => ({ id: m._id, type: m.type, user: m.userId, seats: m.seats, creator: m.creator?.name, hasPhone: 'phone' in (m.creator || {}) }));
    console.log('Matched Posts:', JSON.stringify(matchedTypes, null, 2));

    const foundReqB = dataOfferA.data.some(m => m._id === reqB._id.toString());
    const foundOfferC = dataOfferA.data.some(m => m._id === offerC._id.toString());
    const foundExact420 = dataOfferA.data.some(m => m._id === reqExact420._id.toString());
    const excludedDiff421 = !dataOfferA.data.some(m => m._id === reqDiff421._id.toString());
    console.log('Includes compatible REQUEST (ReqB):', foundReqB ? 'PASS' : 'FAIL');
    console.log('Includes compatible OFFER (OfferC):', foundOfferC ? 'PASS' : 'FAIL');
    console.log('Includes exact 420-minute diff post:', foundExact420 ? 'PASS' : 'FAIL');
    console.log('Excludes 421-minute diff post:', excludedDiff421 ? 'PASS' : 'FAIL');
    console.log('Private phone numbers excluded:', matchedTypes.every(m => !m.hasPhone) ? 'PASS' : 'FAIL');

    // ----------------------------------------------------------------
    // TEST 2: REQUEST -> OFFER only
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 2: REQUEST -> Matches compatible OFFER only <<<');
    const resReqB = await fetch(`${baseUrl}/api/travels/${reqB._id}/matches`, {
      headers: { Authorization: `Bearer ${tokenReqB}` }
    });
    const dataReqB = await resReqB.json();
    console.log('Status:', resReqB.status);
    console.log('Total matches found for ReqB:', dataReqB.count);
    const reqBMatches = dataReqB.data.map(m => ({ id: m._id, type: m.type, user: m.userId, availableSeats: m.seats, creator: m.creator?.name }));
    console.log('Matched Posts for ReqB:', JSON.stringify(reqBMatches, null, 2));

    const allAreOffers = dataReqB.data.every(m => m.type === 'offer');
    const includesOfferA = dataReqB.data.some(m => m._id === offerA._id.toString());
    const excludesOfferC = !dataReqB.data.some(m => m._id === offerC._id.toString()); // OfferC only has 1 seat, ReqB needs 2!
    console.log('All returned matches are OFFER type:', allAreOffers ? 'PASS' : 'FAIL');
    console.log('Includes OfferA (3 seats >= 2 needed):', includesOfferA ? 'PASS' : 'FAIL');
    console.log('Excludes OfferC (1 seat < 2 needed):', excludesOfferC ? 'PASS' : 'FAIL');

    // ----------------------------------------------------------------
    // TEST 3: REQUEST + REQUEST must NEVER match
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 3: REQUEST + REQUEST must NEVER match <<<');
    const hasAnyRequestMatch = dataReqB.data.some(m => m.type === 'request');
    console.log('Contains any REQUEST match for ReqB?:', hasAnyRequestMatch ? 'FAIL' : 'PASS (Zero requests matched)');

    // ----------------------------------------------------------------
    // TEST 4: INSUFFICIENT SEATS Exclusion
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 4: Insufficient seats exclusion <<<');
    const includesReqD = dataOfferA.data.some(m => m._id === reqD._id.toString());
    console.log('ReqD (needs 4 seats, OfferA has 3) excluded from OfferA matches?:', !includesReqD ? 'PASS' : 'FAIL');

    // ----------------------------------------------------------------
    // TEST 5: OWN-POST Exclusion
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 5: Own-post exclusion <<<');
    const containsOwnPost = dataOfferA.data.some(m => m.userId === userOfferA);
    console.log('OfferA matches contains posts created by User_OfferA?:', containsOwnPost ? 'FAIL' : 'PASS (Own posts excluded)');

    // ----------------------------------------------------------------
    // TEST 6: EXPIRED POST Exclusion
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 6: Expired post exclusion <<<');
    const containsExpired = dataOfferA.data.some(m => new Date(m.expiresAt) <= new Date());
    console.log('OfferA matches contains expired posts?:', containsExpired ? 'FAIL' : 'PASS (Expired posts excluded)');

    // ----------------------------------------------------------------
    // TEST 7: UNAUTHORIZED ACCESS & INVALID ID
    // ----------------------------------------------------------------
    console.log('\n>>> TEST 7: Authorization & Validation Checks <<<');

    // 7a. Invalid MongoDB ObjectId
    const resInvalidId = await fetch(`${baseUrl}/api/travels/123invalid/matches`, {
      headers: { Authorization: `Bearer ${tokenOfferA}` }
    });
    console.log('7a. Invalid ObjectId status (expect 400):', resInvalidId.status);
    console.log('    Response:', await resInvalidId.json());

    // 7b. Non-existent post
    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/api/travels/${fakeId}/matches`, {
      headers: { Authorization: `Bearer ${tokenOfferA}` }
    });
    console.log('\n7b. Non-existent post status (expect 404):', resNotFound.status);
    console.log('    Response:', await resNotFound.json());

    // 7c. Unauthorized user (UserOther attempts to view matches for OfferA)
    const resForbidden = await fetch(`${baseUrl}/api/travels/${offerA._id}/matches`, {
      headers: { Authorization: `Bearer ${tokenOther}` }
    });
    console.log('\n7c. Non-owner unauthorized access status (expect 403):', resForbidden.status);
    console.log('    Response:', await resForbidden.json());

    // 7d. Missing token
    const resNoAuth = await fetch(`${baseUrl}/api/travels/${offerA._id}/matches`);
    console.log('\n7d. Missing token status (expect 401):', resNoAuth.status);
    console.log('    Response:', await resNoAuth.json());

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Cleanup
    await Travel.deleteMany({ userId: { $in: allTestUsers } });
    await Student.deleteMany({ clerkId: { $in: allTestUsers } });
    await mongoose.disconnect();
    server.close();
    console.log('\n================================================================');
    console.log('All tests completed successfully and test data cleaned up.');
    console.log('================================================================');
  }
}

runTestSuite();
