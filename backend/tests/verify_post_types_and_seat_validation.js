import Travel from '../src/models/Travel.js';

console.log('=== VERIFYING POST TYPES & SEAT VALIDATION RULES ===\n');

async function runTests() {
  // 1. Test model pre-validate hook on request post
  const requestTravel = new Travel({
    userId: 'test_user_1',
    type: 'request',
    source: 'VIT Bhopal',
    destination: 'Bhopal Railway Station',
    travelDate: new Date('2026-11-20'),
    departureTime: 480,
    timeFlexibility: 30,
    seats: 5 // Client maliciously/accidentally sends 5 seats
  });

  // Run async validation which invokes pre-validate middleware
  await requestTravel.validate();
  console.log('1. Direct Mongoose validation for REQUEST with 5 seats:');
  console.log('   Seats automatically forced to 1:', requestTravel.seats === 1, `(actual: ${requestTravel.seats})`);
  if (requestTravel.seats !== 1) {
    console.error('FAIL: REQUEST post seats was not forced to 1');
    process.exit(1);
  }

  // 2. Test OFFER post with 1 seat
  const offer1 = new Travel({
    userId: 'test_user_2',
    type: 'offer',
    source: 'VIT Bhopal',
    destination: 'Bhopal Railway Station',
    travelDate: new Date('2026-11-20'),
    departureTime: 480,
    timeFlexibility: 30,
    seats: 1
  });
  await offer1.validate();
  console.log('2. OFFER post with 1 seat: valid = true');

  // 3. Test OFFER post with 6 seats
  const offer6 = new Travel({
    userId: 'test_user_3',
    type: 'offer',
    source: 'VIT Bhopal',
    destination: 'Bhopal Railway Station',
    travelDate: new Date('2026-11-20'),
    departureTime: 480,
    timeFlexibility: 30,
    seats: 6
  });
  await offer6.validate();
  console.log('3. OFFER post with 6 seats: valid = true');

  // 4. Test OFFER post with 7 seats (exceeds max limit 6)
  const offer7 = new Travel({
    userId: 'test_user_4',
    type: 'offer',
    source: 'VIT Bhopal',
    destination: 'Bhopal Railway Station',
    travelDate: new Date('2026-11-20'),
    departureTime: 480,
    timeFlexibility: 30,
    seats: 7
  });
  let err7 = null;
  try {
    await offer7.validate();
  } catch (e) {
    err7 = e;
  }
  console.log('4. OFFER post with 7 seats rejected by model: rejected =', Boolean(err7?.errors?.seats));
  if (!err7?.errors?.seats) {
    console.error('FAIL: OFFER with 7 seats should be rejected');
    process.exit(1);
  }

  // 5. Test OFFER post with 0 seats (below min 1)
  const offer0 = new Travel({
    userId: 'test_user_5',
    type: 'offer',
    source: 'VIT Bhopal',
    destination: 'Bhopal Railway Station',
    travelDate: new Date('2026-11-20'),
    departureTime: 480,
    timeFlexibility: 30,
    seats: 0
  });
  let err0 = null;
  try {
    await offer0.validate();
  } catch (e) {
    err0 = e;
  }
  console.log('5. OFFER post with 0 seats rejected by model: rejected =', Boolean(err0?.errors?.seats));
  if (!err0?.errors?.seats) {
    console.error('FAIL: OFFER with 0 seats should be rejected');
    process.exit(1);
  }

  console.log('\nALL 5 BACKEND MODEL VALIDATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
