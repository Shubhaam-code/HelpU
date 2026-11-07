import { 
  findMatchesForTravel, 
  isSameCalendarDay, 
  getCanonicalCalendarDate,
  isSameDirection, 
  areLocationsMatching, 
  normalizeLocation 
} from '../src/services/matching.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== RUNNING MATCHING REGRESSION TESTS ===\n');

// 1. Date normalization tests
console.log('--- Date Normalization & Calendar Day Equality ---');
assert(getCanonicalCalendarDate('2026-11-07') === '2026-11-07', 'Canonical YYYY-MM-DD string parses directly');
assert(getCanonicalCalendarDate('07/11/2026') === '2026-11-07', 'DD/MM/YYYY string parses to 2026-11-07');
assert(getCanonicalCalendarDate('2026-11-07T00:00:00.000Z') === '2026-11-07', 'UTC midnight converts to 2026-11-07 in Asia/Kolkata');
assert(isSameCalendarDay('2026-11-07', '2026-11-07') === true, 'Same date string is equal');
assert(isSameCalendarDay('2026-11-07', '2026-11-09') === false, 'Different date (7 Nov vs 9 Nov) MUST NEVER MATCH');
assert(isSameCalendarDay('2026-11-07T00:00:00.000Z', '2026-11-07') === true, 'ISO UTC midnight and YYYY-MM-DD match');
assert(isSameCalendarDay('2026-11-07', '07/11/2026') === true, 'YYYY-MM-DD and DD/MM/YYYY match');
assert(isSameCalendarDay('2026-11-07', null) === false, 'Null date does not match');
assert(isSameCalendarDay(undefined, '2026-11-07') === false, 'Undefined date does not match');

// 2. Direction & Location matching tests
console.log('\n--- Location & Direction Tests ---');
assert(isSameDirection('Patna', 'Gaya', 'Patna', 'Gaya') === true, 'Exact same origin and destination matches');
assert(isSameDirection('Patna', 'Gaya', 'Patna', 'Ranchi') === false, 'Different destination does not match');
assert(isSameDirection('Patna', 'Gaya', 'Muzaffarpur', 'Gaya') === false, 'Different origin does not match');
assert(isSameDirection('Patna', 'Gaya', 'Gaya', 'Patna') === false, 'Opposite direction (A->B vs B->A) NEVER matches');
assert(isSameDirection('VIT Bhopal', 'Bhopal Junction', 'vit', 'bhopal railway station') === true, 'Normalized alias locations match');

// 3. Post Type Compatibility
console.log('\n--- Post Type Compatibility Rules ---');
// Request + Request must NEVER match
// In findMatchesForTravel, if travelPost.type === 'request', eligibleTypes is ['offer'] (requests are never queried)
const requestPost = {
  type: 'request',
  status: 'active',
  expiresAt: new Date(Date.now() + 86400000),
  source: 'Patna',
  destination: 'Gaya',
  travelDate: '2026-11-07',
  departureTime: 480,
  seats: 1
};

// Summary
console.log(`\n========================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nALL MATCHING UNIT TESTS PASSED SUCCESSFULLY!');
}

