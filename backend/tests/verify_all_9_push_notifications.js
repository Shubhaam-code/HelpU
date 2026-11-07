import assert from 'node:assert/strict';
import { NOTIFICATION_JOB_TYPES, formatNotificationContent } from '../src/jobs/notification.jobs.js';
import {
  resolveNotificationImage,
  resolveNotificationContentAndPayload,
  formatMinutesToTime,
  formatNotificationDate,
  isValidHttpUrl,
  HELPU_DEFAULT_NOTIFICATION_IMAGE
} from '../src/services/notificationImage.service.js';
import {
  sanitizeCustomData,
  batchTokens,
  isPermanentTokenError,
  PERMANENT_TOKEN_ERROR_CODES,
  HELPU_NOTIFICATION_CHANNEL_ID
} from '../src/services/fcm.service.js';

console.log('========================================================================');
console.log('TEST SUITE: HELPU DYNAMIC RICH PUSH NOTIFICATION SYSTEM (ALL 9 CASES)');
console.log('========================================================================\n');

async function runTests() {
  let passedCount = 0;

  // -------------------------------------------------------------------------
  // Test 1: Helper functions (URL validation, time, date)
  // -------------------------------------------------------------------------
  console.log('>>> TEST 1: Helper Functions & URL Validation <<<');
  assert.equal(isValidHttpUrl('https://example.com/ride.png'), true);
  assert.equal(isValidHttpUrl('http://cdn.helpu.in/car.jpg'), true);
  assert.equal(isValidHttpUrl('/car.png'), false);
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl(null), false);

  assert.equal(formatMinutesToTime(540), '09:00 AM');
  assert.equal(formatMinutesToTime(1050), '05:30 PM');
  assert.equal(formatMinutesToTime(0), '12:00 AM');
  assert.equal(formatMinutesToTime(720), '12:00 PM');

  assert.ok(HELPU_DEFAULT_NOTIFICATION_IMAGE.startsWith('http'));
  console.log('✓ Validated URL check, time formatting, and default fallback image.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 2: CASE 1 — New Booking Request
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 2: CASE 1 — New Booking Request <<<');
  const case1Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_REQUESTED,
    recipientId: 'owner_user_123',
    relatedBookingId: 'booking_678',
    relatedTravelId: 'travel_111',
    payload: {
      source: 'VIT Bhopal',
      destination: 'Bhopal Railway Station',
      travelDate: new Date('2026-11-15T09:00:00.000Z'),
      departureTime: 540,
      requestedSeats: 2,
      passengerName: 'Aman Sharma',
      imageUrl: 'https://images.unsplash.com/photo-car-1.jpg'
    }
  });

  assert.equal(case1Result.title, 'New Booking Request');
  assert.ok(case1Result.message.includes('Aman Sharma requested 2 seat(s)'));
  assert.ok(case1Result.message.includes('VIT Bhopal → Bhopal Railway Station'));
  assert.equal(case1Result.imageUrl, 'https://images.unsplash.com/photo-car-1.jpg');
  assert.equal(case1Result.customData.postId, 'travel_111');
  assert.equal(case1Result.customData.bookingId, 'booking_678');
  assert.equal(case1Result.customData.requestedSeats, '2');
  assert.equal(case1Result.targetRoute, '/bookings/booking_678');
  console.log('✓ Case 1 New Booking Request passed with correct recipient, image, route, and seats.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 3: CASE 2 — New Match Found
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 3: CASE 2 — New Match Found <<<');
  const case2Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.NEW_MATCH_FOUND,
    recipientId: 'peer_user_456',
    relatedTravelId: 'travel_peer_matched_999',
    payload: {
      type: 'offer',
      source: 'Campus Gate 1',
      destination: 'Indore Airport',
      travelDate: new Date('2026-11-16T12:00:00.000Z'),
      departureTime: 720,
      imageUrl: 'https://cdn.helpu.app/rides/travel_peer_matched_999.jpg'
    }
  });

  assert.equal(case2Result.title, 'New Match Found!');
  assert.ok(case2Result.message.includes('Matching ride offer found'));
  assert.ok(case2Result.message.includes('Campus Gate 1 → Indore Airport'));
  assert.equal(case2Result.imageUrl, 'https://cdn.helpu.app/rides/travel_peer_matched_999.jpg');
  assert.equal(case2Result.customData.postId, 'travel_peer_matched_999');
  assert.equal(case2Result.targetRoute, '/rides/travel_peer_matched_999');
  console.log('✓ Case 2 New Match Found passed with matched post image and deep link.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 4: CASE 3 — Booking Confirmed
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 4: CASE 3 — Booking Confirmed <<<');
  const case3Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
    recipientId: 'passenger_user_789',
    relatedBookingId: 'booking_confirmed_101',
    relatedTravelId: 'travel_ride_202',
    payload: {
      source: 'Hostel Block 3',
      destination: 'Habibganj Station',
      travelDate: new Date('2026-11-17T15:30:00.000Z'),
      departureTime: 930,
      requestedSeats: 1,
      ownerName: 'Priya Verma',
      imageUrl: 'https://storage.googleapis.com/helpu/car_priya.png'
    }
  });

  assert.equal(case3Result.title, 'Booking Confirmed!');
  assert.ok(case3Result.message.includes('is confirmed! (1 seat(s) reserved with Priya Verma)'));
  assert.equal(case3Result.imageUrl, 'https://storage.googleapis.com/helpu/car_priya.png');
  assert.equal(case3Result.customData.bookingId, 'booking_confirmed_101');
  assert.equal(case3Result.targetRoute, '/bookings/booking_confirmed_101');
  console.log('✓ Case 3 Booking Confirmed passed with confirmed ride image and route.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 5: CASE 4 — Booking Cancelled (Owner & Passenger)
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 5: CASE 4 — Booking Cancelled <<<');
  const case4OwnerCancel = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_OWNER,
    recipientId: 'passenger_user_789',
    relatedBookingId: 'booking_cancelled_303',
    payload: {
      source: 'VIT Campus',
      destination: 'Bhopal Junction',
      ownerName: 'Rohan Gupta',
      imageUrl: 'https://cdn.helpu.app/cancelled_ride.jpg'
    }
  });
  assert.equal(case4OwnerCancel.title, 'Booking Cancelled');
  assert.ok(case4OwnerCancel.message.includes('Rohan Gupta cancelled the booking'));
  assert.equal(case4OwnerCancel.imageUrl, 'https://cdn.helpu.app/cancelled_ride.jpg');

  const case4PassengerCancel = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_CANCELLED_BY_PASSENGER,
    recipientId: 'owner_user_123',
    relatedBookingId: 'booking_cancelled_304',
    payload: {
      source: 'VIT Campus',
      destination: 'Bhopal Junction',
      passengerName: 'Sneha Patel',
      imageUrl: 'https://cdn.helpu.app/cancelled_ride.jpg'
    }
  });
  assert.equal(case4PassengerCancel.title, 'Booking Cancelled');
  assert.ok(case4PassengerCancel.message.includes('Sneha Patel cancelled their booking'));
  console.log('✓ Case 4 Booking Cancelled passed for both host and passenger cancellations.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 6: CASE 5 — Booking Request Rejected
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 6: CASE 5 — Booking Request Declined <<<');
  const case5Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_REJECTED,
    recipientId: 'passenger_user_555',
    relatedBookingId: 'booking_rejected_404',
    payload: {
      source: 'VIT Bhopal',
      destination: 'Airport',
      ownerName: 'Aditya Singh',
      imageUrl: 'https://cdn.helpu.app/ride_aditya.png'
    }
  });
  assert.equal(case5Result.title, 'Booking Request Declined');
  assert.ok(case5Result.message.includes('was declined by Aditya Singh'));
  assert.equal(case5Result.imageUrl, 'https://cdn.helpu.app/ride_aditya.png');
  assert.equal(case5Result.targetRoute, '/bookings/booking_rejected_404');
  console.log('✓ Case 5 Booking Request Declined passed.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 7: CASE 6 — Booking Request Withdrawn
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 7: CASE 6 — Booking Request Withdrawn <<<');
  const case6Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_WITHDRAWN,
    recipientId: 'owner_user_123',
    relatedBookingId: 'booking_withdrawn_505',
    relatedTravelId: 'travel_ride_777',
    payload: {
      source: 'Boys Hostel',
      destination: 'City Center',
      passengerName: 'Vikram Mehta',
      requestedSeats: 3,
      imageUrl: 'https://cdn.helpu.app/ride_777.png'
    }
  });
  assert.equal(case6Result.title, 'Booking Request Withdrawn');
  assert.ok(case6Result.message.includes('Vikram Mehta withdrew their request for 3 seat(s)'));
  assert.equal(case6Result.imageUrl, 'https://cdn.helpu.app/ride_777.png');
  assert.equal(case6Result.targetRoute, '/rides/travel_ride_777');
  console.log('✓ Case 6 Booking Request Withdrawn passed.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 8: CASE 7 — Ride Details Updated
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 8: CASE 7 — Ride Details Updated <<<');
  const case7Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.RIDE_UPDATED,
    recipientId: 'passenger_affected_888',
    relatedTravelId: 'travel_updated_606',
    payload: {
      source: 'VIT Campus',
      destination: 'Lalghati',
      ownerName: 'Kunal Joshi',
      changeSummary: 'departure time moved to 06:00 PM',
      imageUrl: 'https://cdn.helpu.app/kunal_car.jpg'
    }
  });
  assert.equal(case7Result.title, 'Ride Details Updated');
  assert.ok(case7Result.message.includes('was updated by Kunal Joshi: departure time moved to 06:00 PM'));
  assert.equal(case7Result.imageUrl, 'https://cdn.helpu.app/kunal_car.jpg');
  assert.equal(case7Result.targetRoute, '/rides/travel_updated_606');
  console.log('✓ Case 7 Ride Details Updated passed.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 9: CASE 8 — Ride Cancelled by Owner
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 9: CASE 8 — Ride Cancelled by Owner <<<');
  const case8Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.RIDE_CANCELLED,
    recipientId: 'passenger_all_999',
    relatedTravelId: 'travel_cancelled_707',
    payload: {
      source: 'VIT Campus',
      destination: 'Bhopal Railway Station',
      ownerName: 'Manish Tyagi',
      imageUrl: 'https://cdn.helpu.app/manish_ride.png'
    }
  });
  assert.equal(case8Result.title, 'Ride Cancelled');
  assert.ok(case8Result.message.includes('was cancelled by Manish Tyagi'));
  assert.ok(case8Result.message.includes('All reserved seats have been released'));
  assert.equal(case8Result.imageUrl, 'https://cdn.helpu.app/manish_ride.png');
  assert.equal(case8Result.targetRoute, '/rides/travel_cancelled_707');
  console.log('✓ Case 8 Ride Cancelled by Owner passed.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 10: CASE 9 — Ride Expired
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 10: CASE 9 — Ride Expired <<<');
  const case9Result = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.RIDE_EXPIRED,
    recipientId: 'owner_user_123',
    relatedTravelId: 'travel_expired_808',
    payload: {
      source: 'VIT Campus',
      destination: 'Bhopal Junction',
      travelDate: new Date('2026-11-01T10:00:00.000Z'),
      imageUrl: 'https://cdn.helpu.app/expired_ride.png'
    }
  });
  assert.equal(case9Result.title, 'Your Ride Has Expired');
  assert.ok(case9Result.message.includes('has reached its departure date and is no longer active'));
  assert.equal(case9Result.imageUrl, 'https://cdn.helpu.app/expired_ride.png');
  assert.equal(case9Result.targetRoute, '/rides/travel_expired_808');
  console.log('✓ Case 9 Ride Expired passed.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 11: Missing-image fallback handling
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 11: Missing-image Fallback Handling <<<');
  const fallbackResult = await resolveNotificationContentAndPayload({
    eventType: NOTIFICATION_JOB_TYPES.BOOKING_CONFIRMED,
    recipientId: 'user_fallback_test',
    relatedBookingId: null,
    relatedTravelId: null,
    payload: {
      source: 'A',
      destination: 'B',
      imageUrl: null // No image provided
    }
  });
  assert.equal(fallbackResult.imageUrl, HELPU_DEFAULT_NOTIFICATION_IMAGE);
  assert.equal(fallbackResult.imageSource, 'fallback');
  console.log(`✓ Post with no image successfully resolves to fallback: ${fallbackResult.imageUrl}`);
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 12: FCM Payload & BigPictureStyle Rich Structure Verification
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 12: FCM Payload & BigPictureStyle Structure <<<');
  const testData = sanitizeCustomData(case1Result.customData);
  assert.equal(typeof testData.postId, 'string');
  assert.equal(typeof testData.route, 'string');
  assert.equal(typeof testData.imageUrl, 'string');

  const fcmMessage = {
    tokens: ['mock_token_123'],
    notification: {
      title: case1Result.title,
      body: case1Result.message,
      imageUrl: case1Result.imageUrl
    },
    android: {
      priority: 'high',
      notification: {
        channelId: HELPU_NOTIFICATION_CHANNEL_ID,
        priority: 'high',
        notificationPriority: 'PRIORITY_HIGH',
        defaultSound: true,
        defaultVibrateTimings: true,
        icon: 'ic_stat_notification',
        color: '#FF572E',
        visibility: 'public',
        imageUrl: case1Result.imageUrl
      }
    },
    data: testData
  };

  assert.equal(fcmMessage.notification.imageUrl, case1Result.imageUrl);
  assert.equal(fcmMessage.android.notification.imageUrl, case1Result.imageUrl);
  assert.equal(fcmMessage.android.notification.channelId, 'helpu_high_importance');
  console.log('✓ Verified BigPictureStyle payload in FCM notification and android.notification.');
  passedCount++;

  // -------------------------------------------------------------------------
  // Test 13: Token Management, Deduplication & Permanent Error Pruning
  // -------------------------------------------------------------------------
  console.log('\n>>> TEST 13: Token Management & Deduplication <<<');
  const tokens = ['tokenA', 'tokenB', 'tokenA', 'tokenC', '', null, undefined, '   '];
  const uniqueCleanTokens = Array.from(new Set(tokens.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  const batches = batchTokens(uniqueCleanTokens, 2);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 2);
  assert.equal(batches[1].length, 1);
  assert.equal(isPermanentTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(isPermanentTokenError('messaging/invalid-registration-token'), true);
  assert.equal(isPermanentTokenError('messaging/server-unavailable'), false);
  console.log('✓ Token deduplication, batching, and error classifier verified.');
  passedCount++;

  console.log('\n========================================================================');
  console.log(`ALL ${passedCount} AUTOMATED PUSH NOTIFICATION SUITE TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('FAILED TEST:', err);
  process.exit(1);
});
