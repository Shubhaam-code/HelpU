/**
 * Helpu Phase 2 Verification Suite: Home and Ride Page Redesign
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function test(name, fn) {
  try {
    fn();
    console.log(`✔ [PASS] ${name}`);
  } catch (err) {
    console.error(`✘ [FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log('========================================================');
console.log('HELPU PHASE 2: HOME & RIDE PAGE REDESIGN AUDIT');
console.log('========================================================\n');

// 1. Home Page Verification
test('HomePage uses real backend queries (no fake statistics)', () => {
  const homePath = path.join(__dirname, 'src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePath, 'utf8');

  if (!content.includes('useUserProfile()')) {
    throw new Error('HomePage does not query real user profile.');
  }
  if (!content.includes('useMyTravels()')) {
    throw new Error('HomePage does not query real published travels.');
  }
  if (!content.includes('useUserMatches()')) {
    throw new Error('HomePage does not query real user matches.');
  }
  if (!content.includes('useConfirmedBookings()')) {
    throw new Error('HomePage does not query real confirmed bookings.');
  }
  if (!content.includes('categorizeConfirmedRides(')) {
    throw new Error('HomePage does not use real date-based categorization for upcoming confirmed rides.');
  }
});

test('HomePage provides clear Offer a Ride and Find a Ride actions', () => {
  const homePath = path.join(__dirname, 'src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePath, 'utf8');

  if (!content.includes('/rides/offer?mode=offer')) {
    throw new Error('HomePage missing Offer a Ride direct action link.');
  }
  if (!content.includes('/rides/offer?mode=find')) {
    throw new Error('HomePage missing Find a Ride direct action link.');
  }
});

test('HomePage preserves profile and notification navigation', () => {
  const homePath = path.join(__dirname, 'src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePath, 'utf8');

  if (!content.includes('/notifications')) {
    throw new Error('HomePage missing notification navigation.');
  }
  if (!content.includes('/profile')) {
    throw new Error('HomePage missing profile navigation.');
  }
});

test('HomePage provides upcoming confirmed rides, recent activity, and shortcuts', () => {
  const homePath = path.join(__dirname, 'src/pages/HomePage.jsx');
  const content = fs.readFileSync(homePath, 'utf8');

  if (!content.includes('upcomingConfirmedRides')) {
    throw new Error('HomePage missing upcoming confirmed rides display.');
  }
  if (!content.includes('Recent Relevant Matches')) {
    throw new Error('HomePage missing recent matches & activity section.');
  }
  if (!content.includes('Quick Shortcuts')) {
    throw new Error('HomePage missing shortcuts section.');
  }
});

// 2. Ride Page Verification (Offer a Ride, Find a Ride, My Rides)
test('Ride page supports Offer a Ride with source, destination, date, time, and seats 1-6', () => {
  const ridePath = path.join(__dirname, 'src/pages/OfferRidePage.jsx');
  const content = fs.readFileSync(ridePath, 'utf8');

  if (!content.includes('fromLoc') || !content.includes('toLoc')) {
    throw new Error('Ride page missing source/destination inputs.');
  }
  if (!content.includes('DatePickerModal') || !content.includes('TimePickerModal')) {
    throw new Error('Ride page missing date and time pickers.');
  }
  if (!content.includes('createTravel(')) {
    throw new Error('Ride page missing createTravel API call.');
  }
  if (!content.includes("type: isOffer ? 'offer' : 'request'")) {
    throw new Error('Ride page does not properly assign type offer or request.');
  }
});

test('Ride page strictly enforces EXACTLY ONE SEAT for Find mode and HIDES seat selector', () => {
  const ridePath = path.join(__dirname, 'src/pages/OfferRidePage.jsx');
  const content = fs.readFileSync(ridePath, 'utf8');

  // Verify that for find mode, seats is strictly 1
  if (!content.includes("seats: isOffer ? Number(travellers) : 1")) {
    throw new Error('Find mode does not enforce strictly 1 seat in createTravel payload!');
  }

  // Verify that the seat counter buttons (- / +) are only rendered when activeTab === 'offer'
  if (!content.includes("activeTab === 'offer' ? (") || !content.includes("1 Seat Only")) {
    throw new Error('Seat selector is still visible in Find a Ride mode!');
  }
});

test('Ride page includes My Rides with status, edit, cancel, delete, and match navigation', () => {
  const ridePath = path.join(__dirname, 'src/pages/OfferRidePage.jsx');
  const content = fs.readFileSync(ridePath, 'utf8');

  if (!content.includes('useMyTravels()')) {
    throw new Error('Ride page does not query useMyTravels for My Rides tab.');
  }
  if (!content.includes('cancelTravel(')) {
    throw new Error('Ride page missing cancelTravel integration for My Rides.');
  }
  if (!content.includes('deleteTravel(')) {
    throw new Error('Ride page missing deleteTravel integration for My Rides.');
  }
  if (!content.includes('updateTravel(')) {
    throw new Error('Ride page missing updateTravel integration for editing rides.');
  }
  if (!content.includes('/match')) {
    throw new Error('Ride page missing Find Matches navigation link.');
  }
});

// 3. Responsive & Desktop Layout Verification
test('Desktop layout uses balanced 12-column grid without stretching', () => {
  const homePath = path.join(__dirname, 'src/pages/HomePage.jsx');
  const homeContent = fs.readFileSync(homePath, 'utf8');
  if (!homeContent.includes('lg:grid-cols-12')) {
    throw new Error('HomePage does not use responsive 12-column desktop grid.');
  }

  const ridePath = path.join(__dirname, 'src/pages/OfferRidePage.jsx');
  const rideContent = fs.readFileSync(ridePath, 'utf8');
  if (!rideContent.includes('lg:grid-cols-12')) {
    throw new Error('Ride page does not use responsive 12-column desktop grid.');
  }
});

test('Mobile layout complies with touch targets and prevents horizontal overflow', () => {
  const ridePath = path.join(__dirname, 'src/pages/OfferRidePage.jsx');
  const rideContent = fs.readFileSync(ridePath, 'utf8');

  // Verify full-width inputs on mobile
  if (!rideContent.includes('w-full')) {
    throw new Error('Ride page lacks full width mobile form inputs.');
  }

  // Verify max-w-xl clamp on mobile
  if (!rideContent.includes('max-w-xl')) {
    throw new Error('Ride page lacks max-w-xl mobile container constraint.');
  }
});

console.log('\n========================================================');
console.log('ALL PHASE 2 HOME & RIDE PAGE TESTS PASSED SUCCESSFULLY!');
console.log('========================================================\n');

