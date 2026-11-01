import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel from '../src/models/Travel.js';

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
    sid: 'sess_test_travel_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const userA = 'user_travel_student_A';
const userB = 'user_travel_student_B';
const tokenA = generateTestToken(userA);
const tokenB = generateTestToken(userB);

async function runTests() {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuspool');

  // Clean test travel posts
  await Travel.deleteMany({ userId: { $in: [userA, userB] } });

  const port = 5003;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('====================================================');
  console.log('TEST SUITE: CampusPool Travel APIs');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1: POST /api/travels
    // ----------------------------------------------------
    console.log('>>> TEST 1: POST /api/travels <<<');

    // 1a. Missing token
    const resNoToken = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'offer', source: 'Hostel A', destination: 'Metro', travelDate: '2026-11-05', departureTime: 540, timeFlexibility: 30, seats: 2 })
    });
    console.log('1a. POST without token status:', resNoToken.status);
    console.log('    Response:', await resNoToken.json());

    // 1b. UserA creates ride offer
    const resOffer = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        type: 'offer',
        source: 'Campus Gate 1',
        destination: 'New Delhi Railway Station',
        travelDate: '2026-11-05',
        departureTime: 570, // 09:30 AM
        timeFlexibility: 30,
        seats: 3
      })
    });
    const offerData = await resOffer.json();
    console.log('\n1b. UserA creates ride offer status:', resOffer.status);
    console.log('    Saved Offer Post:\n', JSON.stringify(offerData, null, 2));
    const offerId = offerData.data._id;

    // 1c. UserB creates ride request
    const resRequest = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        type: 'request',
        source: 'IGI Airport Terminal 3',
        destination: 'Campus Hostel Block B',
        travelDate: '2026-11-06',
        departureTime: 1020, // 05:00 PM
        timeFlexibility: 60,
        seats: 1
      })
    });
    const requestData = await resRequest.json();
    console.log('\n1c. UserB creates ride request status:', resRequest.status);
    console.log('    Saved Request Post:\n', JSON.stringify(requestData, null, 2));
    const requestId = requestData.data._id;

    // ----------------------------------------------------
    // TEST 2: GET /api/travels (Active feed excluding self)
    // ----------------------------------------------------
    console.log('\n>>> TEST 2: GET /api/travels (Feed excluding creator\'s own posts) <<<');

    // UserA views feed (should see UserB's post, NOT UserA's offer)
    const resFeedA = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const feedA = await resFeedA.json();
    console.log('2a. UserA feed status:', resFeedA.status, '| Total items:', feedA.count);
    console.log('    Items seen by UserA (UserId check):', feedA.data.map(p => ({ id: p._id, creator: p.userId, type: p.type })));

    // UserB views feed (should see UserA's post, NOT UserB's request)
    const resFeedB = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const feedB = await resFeedB.json();
    console.log('2b. UserB feed status:', resFeedB.status, '| Total items:', feedB.count);
    console.log('    Items seen by UserB (UserId check):', feedB.data.map(p => ({ id: p._id, creator: p.userId, type: p.type })));

    // ----------------------------------------------------
    // TEST 3: GET /api/travels/my (User's own posts)
    // ----------------------------------------------------
    console.log('\n>>> TEST 3: GET /api/travels/my <<<');

    // UserA's own posts
    const resMyA = await fetch(`${baseUrl}/api/travels/my`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const myA = await resMyA.json();
    console.log('3a. UserA my posts status:', resMyA.status, '| Total items:', myA.count);
    console.log('    UserA posts:', myA.data.map(p => ({ id: p._id, type: p.type, source: p.source, destination: p.destination })));

    // UserB's own posts
    const resMyB = await fetch(`${baseUrl}/api/travels/my`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const myB = await resMyB.json();
    console.log('3b. UserB my posts status:', resMyB.status, '| Total items:', myB.count);
    console.log('    UserB posts:', myB.data.map(p => ({ id: p._id, type: p.type, source: p.source, destination: p.destination })));

    // ----------------------------------------------------
    // TEST 4: PATCH /api/travels/:id/status
    // ----------------------------------------------------
    console.log('\n>>> TEST 4: PATCH /api/travels/:id/status <<<');

    // 4a. Invalid MongoDB ID
    const resInvalidId = await fetch(`${baseUrl}/api/travels/not_a_valid_mongo_id/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    console.log('4a. Invalid Mongo ID status:', resInvalidId.status);
    console.log('    Response:', await resInvalidId.json());

    // 4b. Invalid status value
    const resInvalidStatus = await fetch(`${baseUrl}/api/travels/${offerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    console.log('\n4b. Invalid status value status:', resInvalidStatus.status);
    console.log('    Response:', await resInvalidStatus.json());

    // 4c. Forbidden update: UserA tries to update UserB's post
    const resForbidden = await fetch(`${baseUrl}/api/travels/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}` // UserA trying to modify UserB's post
      },
      body: JSON.stringify({ status: 'completed' })
    });
    console.log('\n4c. Unauthorized update by non-owner status:', resForbidden.status);
    console.log('    Response:', await resForbidden.json());

    // 4d. Valid update: UserA marks their own post as "completed"
    const resValidUpdate = await fetch(`${baseUrl}/api/travels/${offerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    console.log('\n4d. Owner updates status to "completed" status:', resValidUpdate.status);
    console.log('    Response:\n', JSON.stringify(await resValidUpdate.json(), null, 2));

    // 4e. Verify GET /api/travels feed now filters out the completed post
    const resFeedAfter = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const feedAfter = await resFeedAfter.json();
    console.log('\n4e. UserB feed after UserA completed their offer (should be 0 active offers):', feedAfter.count);

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Cleanup test records
    await Travel.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
    server.close();
    console.log('\nAll tests completed and test records cleaned up.');
  }
}

runTests();
