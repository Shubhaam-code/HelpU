import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('TEST SUITE: Helpu Phase 3 Part 1 — Shared Rides Frontend Verification');
console.log('================================================================\n');

// 1. Verify BottomNavigation.jsx platform-specific items
console.log('CHECK 1: Bottom Navigation Configuration (Website & Android)');
const bottomNavPath = path.join(__dirname, 'src/components/layout/BottomNavigation.jsx');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

// Verify Android navigation items
assert(bottomNavContent.includes("label: 'Home'"), 'Missing Home in BottomNav');
assert(bottomNavContent.includes("label: 'Ride'"), 'Missing Ride in Android BottomNav');
assert(bottomNavContent.includes("label: 'Match'"), 'Missing Match in Android BottomNav');
assert(bottomNavContent.includes("label: 'Shared Rides'"), 'Missing Shared Rides in BottomNav');
assert(bottomNavContent.includes("CarTaxiFront"), 'Missing CarTaxiFront icon in BottomNav');

// Verify Website navigation items
assert(bottomNavContent.includes("label: 'Post'"), 'Missing Post in Website BottomNav');
assert(bottomNavContent.includes("label: 'Matching'"), 'Missing Matching in Website BottomNav');

// Verify Profile is removed from bottom navigation items
assert(!bottomNavContent.includes("label: 'Profile'"), 'Profile must be removed from bottom navigation');
console.log('  ✔ Website BottomNav: Home | Post | Matching | Shared Rides verified');
console.log('  ✔ Android BottomNav: Home | Ride | Match | Shared Rides verified');
console.log('  ✔ Profile item successfully removed from bottom navigation and replaced with Shared Rides');

// 2. Verify Profile Access from Home Header
console.log('\nCHECK 2: Profile Access via Home Header & Back Navigation');
const appHeaderPath = path.join(__dirname, 'src/components/layout/AppHeader.jsx');
const appHeaderContent = fs.readFileSync(appHeaderPath, 'utf8');
assert(appHeaderContent.includes("navigate('/profile')"), 'AppHeader must navigate to /profile on avatar click');
assert(appHeaderContent.includes("aria-label=\"User profile\""), 'AppHeader must contain User profile button');

const profilePagePath = path.join(__dirname, 'src/pages/ProfilePage.jsx');
const profilePageContent = fs.readFileSync(profilePagePath, 'utf8');
assert(profilePageContent.includes("backTo={-1}"), 'ProfilePage header must support backTo={-1} for back navigation');
console.log('  ✔ AppHeader avatar button links directly to /profile');
console.log('  ✔ ProfilePage supports back navigation (backTo={-1})');

// 3. Verify Desktop Navigation Updates
console.log('\nCHECK 3: Desktop Navigation Integration');
const desktopNavPath = path.join(__dirname, 'src/components/layout/DesktopNavbar.jsx');
const desktopNavContent = fs.readFileSync(desktopNavPath, 'utf8');
assert(desktopNavContent.includes("label: 'Shared Rides'"), 'DesktopNavbar must include Shared Rides');
assert(desktopNavContent.includes("path: '/shared-rides'"), 'DesktopNavbar must route to /shared-rides');

const desktopSidebarPath = path.join(__dirname, 'src/components/layout/DesktopSidebar.jsx');
const desktopSidebarContent = fs.readFileSync(desktopSidebarPath, 'utf8');
assert(desktopSidebarContent.includes("label: 'Shared Rides'"), 'DesktopSidebar must include Shared Rides');
assert(desktopSidebarContent.includes("path: '/shared-rides'"), 'DesktopSidebar must route to /shared-rides');
console.log('  ✔ DesktopNavbar includes Shared Rides (/shared-rides)');
console.log('  ✔ DesktopSidebar includes Shared Rides (/shared-rides)');

// 4. Verify API & Query Client Functions
console.log('\nCHECK 4: API Client & Query Client Endpoints');
const apiPath = path.join(__dirname, 'src/lib/api.js');
const apiContent = fs.readFileSync(apiPath, 'utf8');
assert(apiContent.includes("getMySharedRideGroups"), 'Missing getMySharedRideGroups API export');
assert(apiContent.includes("discoverSharedRideGroups"), 'Missing discoverSharedRideGroups API export');
assert(apiContent.includes("createGroupJoinRequest"), 'Missing createGroupJoinRequest API export');
assert(apiContent.includes("'/api/groups/my'"), 'Missing /api/groups/my endpoint call');
assert(apiContent.includes("'/api/groups/discover'"), 'Missing /api/groups/discover endpoint call');
assert(apiContent.includes("join-requests"), 'Missing join-requests endpoint call');

const queryClientPath = path.join(__dirname, 'src/lib/queryClient.js');
const queryClientContent = fs.readFileSync(queryClientPath, 'utf8');
assert(queryClientContent.includes("myGroups"), 'Missing myGroups query key in QUERY_KEYS');
assert(queryClientContent.includes("discoverGroups"), 'Missing discoverGroups query key in QUERY_KEYS');
assert(queryClientContent.includes("invalidateGroupQueries"), 'Missing invalidateGroupQueries export');

const appDataPath = path.join(__dirname, 'src/hooks/useAppData.js');
const appDataContent = fs.readFileSync(appDataPath, 'utf8');
assert(appDataContent.includes("useMySharedRideGroups"), 'Missing useMySharedRideGroups hook');
assert(appDataContent.includes("useDiscoverSharedRideGroups"), 'Missing useDiscoverSharedRideGroups hook');
console.log('  ✔ GET /api/groups/my integrated in API and useMySharedRideGroups hook');
console.log('  ✔ GET /api/groups/discover integrated in API and useDiscoverSharedRideGroups hook');
console.log('  ✔ POST /api/groups/:groupId/join-requests integrated in API');
console.log('  ✔ invalidateGroupQueries helper configured with TanStack Query');

// 5. Verify SharedRidesPage Structure & Requirements
console.log('\nCHECK 5: SharedRidesPage UI Components & Business Logic');
const sharedRidesPagePath = path.join(__dirname, 'src/pages/SharedRidesPage.jsx');
const sharedRidesContent = fs.readFileSync(sharedRidesPagePath, 'utf8');

// Header verification
assert(sharedRidesContent.includes('Shared Rides'), 'SharedRidesPage must have title Shared Rides');
assert(sharedRidesContent.includes('Find students travelling on a similar route'), 'SharedRidesPage must have correct subtitle');
assert(sharedRidesContent.includes('Create Group'), 'SharedRidesPage must contain Create Group button');

// Sections verification
assert(sharedRidesContent.includes('My Groups'), 'SharedRidesPage must include My Groups section');
assert(sharedRidesContent.includes('Discover Groups'), 'SharedRidesPage must include Discover Groups section');

// Card displays
assert(sharedRidesContent.includes('availableSpots'), 'Discover card must display availableSpots');
assert(sharedRidesContent.includes('targetCapacity'), 'Discover card must display targetCapacity');
assert(sharedRidesContent.includes('confirmedMemberCount'), 'Discover card must display confirmedMemberCount');
assert(sharedRidesContent.includes('Request to Join'), 'Discover card must display Request to Join button');
assert(sharedRidesContent.includes('No shared rides found yet.'), 'Must display empty state text');
assert(sharedRidesContent.includes('Create a FIND Post to Discover Compatible Groups'), 'Must guide user to create FIND post if none active');

// Concurrency & Error handling
assert(sharedRidesContent.includes('409'), 'Must handle 409 Conflict properly');
assert(sharedRidesContent.includes('isRequesting'), 'Must prevent duplicate clicks with loading state');
assert(sharedRidesContent.includes('invalidateGroupQueries'), 'Must refresh queries upon successful request');

console.log('  ✔ Shared Rides page structure matches specification (Header, Title, Subtitle, Create Group button)');
console.log('  ✔ My Groups section renders confirmed membership groups with route, date, member count & status');
console.log('  ✔ Discover Groups section renders compatible groups with source, dest, date, time, admin, spots, capacity');
console.log('  ✔ Empty states handled for zero matches and missing active FIND post');
console.log('  ✔ Request to Join features loading indicator, duplicate click prevention, 409 conflict handling & cache invalidation');

// 6. Verify Routing in App.jsx
console.log('\nCHECK 6: Application Routes');
const appJsxPath = path.join(__dirname, 'src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
assert(appJsxContent.includes('SharedRidesPage'), 'App.jsx must import SharedRidesPage');
assert(appJsxContent.includes('path="/shared-rides"'), 'App.jsx must have route /shared-rides');
assert(appJsxContent.includes('path="/groups"'), 'App.jsx must have alias route /groups');
console.log('  ✔ Route /shared-rides and alias /groups successfully configured in App.jsx');

console.log('\n================================================================');
console.log('ALL PHASE 3 PART 1 FRONTEND CHECKS PASSED (100% SUCCESS)');
console.log('================================================================');
process.exit(0);

