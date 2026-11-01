import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Travel, { calculateExpiresAt } from '../src/models/Travel.js';

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
    sid: 'sess_expiry_test_' + userId
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(encodedHeader + '.' + encodedPayload);
  const signature = sign.sign(privateKey, 'base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const userA = 'user_expiry_viewer_A';
const userB = 'user_expiry_creator_B';
const tokenA = generateTestToken(userA);
const tokenB = generateTestToken(userB);

async function testExpiry() {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuspool');

  // Clean test records
  await Travel.deleteMany({ userId: { $in: [userA, userB] } });

  const port = 5005;
  const server = app.listen(port);
  const baseUrl = `http://localhost:${port}`;

  console.log('====================================================');
  console.log('TEST SUITE: Automatic Expiry for Travel Posts');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // 1. Verify MongoDB TTL Index
    // ----------------------------------------------------
    console.log('>>> 1. Verifying MongoDB TTL Index Configuration <<<');
    const indexes = await Travel.collection.listIndexes().toArray();
    const ttlIndex = indexes.find(idx => idx.name === 'expiresAt_1');
    console.log('TTL Index Found:', !!ttlIndex);
    console.log('TTL Index Details:', JSON.stringify(ttlIndex, null, 2));

    // ----------------------------------------------------
    // 2. Create Future Post (Tomorrow)
    // ----------------------------------------------------
    console.log('\n>>> 2. Create Travel Post for Tomorrow (Future Post) <<<');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

    const resTomorrow = await fetch(`${baseUrl}/api/travels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        type: 'offer',
        source: 'Main Campus',
        destination: 'Central Station',
        travelDate: tomorrowDateStr,
        departureTime: 600, // 10:00 AM
        timeFlexibility: 60,
        seats: 3
      })
    });
    const tomorrowData = await resTomorrow.json();
    console.log('POST /api/travels (Tomorrow) Status:', resTomorrow.status);
    console.log('Created Post ID:', tomorrowData.data._id);
    console.log('Travel Date:', tomorrowData.data.travelDate);
    console.log('Calculated expiresAt (UTC):', tomorrowData.data.expiresAt);
    const expiresAtDate = new Date(tomorrowData.data.expiresAt);
    console.log('Calculated expiresAt (Asia/Kolkata):', expiresAtDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

    // ----------------------------------------------------
    // 3. Verify Tomorrow\'s Post is Visible in Both APIs
    // ----------------------------------------------------
    console.log('\n>>> 3. Verify Future Post Visibility in GET APIs <<<');
    // In Public Feed for UserA
    const resFeed = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const feedData = await resFeed.json();
    const visibleInFeed = feedData.data.some(p => p._id === tomorrowData.data._id);
    console.log('Visible in GET /api/travels (Public Feed):', visibleInFeed, `(Feed items count: ${feedData.count})`);

    // In My Posts for UserB
    const resMy = await fetch(`${baseUrl}/api/travels/my`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const myData = await resMy.json();
    const visibleInMy = myData.data.some(p => p._id === tomorrowData.data._id);
    console.log('Visible in GET /api/travels/my (Creator View):', visibleInMy, `(My items count: ${myData.count})`);

    // ----------------------------------------------------
    // 4. Create Expired Test Post (expiresAt in the Past)
    // ----------------------------------------------------
    console.log('\n>>> 4. Create Test Post with expiresAt in the Past <<<');
    const pastTravelDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const pastExpiresAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (in past)

    const expiredDoc = await Travel.create({
      userId: userB,
      type: 'request',
      source: 'Airport Terminal 1',
      destination: 'Campus Hostel',
      travelDate: pastTravelDate,
      departureTime: 720,
      timeFlexibility: 30,
      seats: 1,
      status: 'active',
      expiresAt: pastExpiresAt
    });
    console.log('Created Expired Post ID in MongoDB:', expiredDoc._id);
    console.log('Expired Post expiresAt:', expiredDoc.expiresAt.toISOString());
    console.log('Is expiresAt <= now?:', expiredDoc.expiresAt <= new Date());

    // ----------------------------------------------------
    // 5. Verify Expired Post is Hidden from Both GET APIs
    // ----------------------------------------------------
    console.log('\n>>> 5. Verify Expired Post is Hidden from Both GET APIs <<<');

    // Check GET /api/travels
    const resFeedAfterExpired = await fetch(`${baseUrl}/api/travels`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const feedAfterExpired = await resFeedAfterExpired.json();
    const expiredInFeed = feedAfterExpired.data.some(p => p._id === expiredDoc._id.toString());
    console.log('Expired Post visible in GET /api/travels?:', expiredInFeed ? 'YES (UNEXPECTED)' : 'NO (CORRECTLY HIDDEN)');

    // Check GET /api/travels/my
    const resMyAfterExpired = await fetch(`${baseUrl}/api/travels/my`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const myAfterExpired = await resMyAfterExpired.json();
    const expiredInMy = myAfterExpired.data.some(p => p._id === expiredDoc._id.toString());
    console.log('Expired Post visible in GET /api/travels/my?:', expiredInMy ? 'YES (UNEXPECTED)' : 'NO (CORRECTLY HIDDEN)');

    // Check MongoDB Document Persistence (Query vs TTL Physical Deletion)
    console.log('\n>>> 6. Document in MongoDB vs TTL Asynchronous Deletion <<<');
    const existsInDb = await Travel.findById(expiredDoc._id);
    console.log('Document still present in MongoDB before TTL worker sweep?:', existsInDb !== null);
    console.log('Explanation: Application-level filter (expiresAt: { $gt: now }) hides it immediately,');
    console.log('while MongoDB TTL background monitor asynchronously purges expired documents periodically.');

  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    // Cleanup
    await Travel.deleteMany({ userId: { $in: [userA, userB] } });
    await mongoose.disconnect();
    server.close();
    console.log('\nCleanup finished.');
  }
}

testExpiry();
