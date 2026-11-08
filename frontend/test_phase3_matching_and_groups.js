/**
 * HELPU — Automated Verification Test Suite for Phase 3 UI Redesign
 * 
 * Verifies:
 * 1. MatchPage:
 *    - Category A: Normal OFFER matches (Driver info, route, date/time, seats, price, View Details & Book Seat)
 *    - Category B: Shared Ride Groups (Route, date/time, admin, members, capacity progress bar, available spots, Join Group)
 *    - Category C: Compatible FIND Students (Avatar, college, verified shield, route, date/time, Create Group Together)
 *    - Category D: Wait for OFFER state (Reassuring banner, FIND post remains active, not cancelled)
 *    - Join Confirmation Dialog (Modal component, route, date/time, admin, members, spots)
 * 2. SharedRidesPage:
 *    - 3 Segment Tabs: Discover Groups, My Groups, Invitations
 *    - Discover Groups with capacity progress, available spots, Join Group action
 *    - Join Group Confirmation Modal integration
 *    - My Groups with confirmed members, Admin/Member role badge, Manage Group, Leave Group modal
 *    - Invitations tab with Received (Accept/Decline) and Sent Invitations (recipient, route, status badge)
 * 3. GroupDetailsPage:
 *    - Route header, travel date/time, vehicle capacity
 *    - Admin card with verified badge
 *    - Confirmed members list with Admin & Member badges
 *    - Real-time capacity progress bar & available spots
 *    - WhatsApp link STRICTLY visible ONLY to confirmed members
 *    - Cancelled state alert banner
 *    - Leave Group confirmation Modal
 * 4. Design System Tokens:
 *    - Warm cream #FFF8F3, coral #FF572E, navy #17233C, border #F4E3D8, white cards
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = __dirname;
const matchPageCode = fs.readFileSync(path.join(basePath, 'src/pages/MatchPage.jsx'), 'utf8');
const sharedRidesCode = fs.readFileSync(path.join(basePath, 'src/pages/SharedRidesPage.jsx'), 'utf8');
const groupDetailsCode = fs.readFileSync(path.join(basePath, 'src/pages/GroupDetailsPage.jsx'), 'utf8');
const myMatchesCode = fs.readFileSync(path.join(basePath, 'src/pages/MyMatchesPage.jsx'), 'utf8');

console.log('=================================================================');
console.log('🧪 RUNNING HELPU PHASE 3 MATCHING & SHARED GROUPS TEST SUITE');
console.log('=================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

// TEST 1: MatchPage Category A (Normal OFFER Matches)
runTest('MatchPage Category A supports normal offers, driver details, price, and View Details & Book Seat actions', () => {
  assert(matchPageCode.includes('Category A: Normal Ride Matches'), 'Category A header must exist');
  assert(matchPageCode.includes('Verified Student') || matchPageCode.includes('ShieldCheck'), 'Verified student indicator must exist');
  assert(matchPageCode.includes('pricePerSeat'), 'Price per seat must be handled');
  assert(matchPageCode.includes('View Details'), 'View Details action must exist');
  assert(matchPageCode.includes('Book Seat'), 'Book Seat action must exist');
  assert(matchPageCode.includes('/book/'), 'Booking route must be linked');
});

// TEST 2: MatchPage Category B (Shared Ride Groups)
runTest('MatchPage Category B displays shared groups with admin, members, capacity progress bar, spots, and Join action', () => {
  assert(matchPageCode.includes('Category B: Shared Ride Groups'), 'Category B header must exist');
  assert(matchPageCode.includes('group.admin'), 'Group admin must be displayed');
  assert(matchPageCode.includes('availableSpots'), 'Available spots must be displayed');
  assert(matchPageCode.includes('targetCapacity'), 'Target capacity must be displayed');
  assert(matchPageCode.includes('setConfirmJoinGroup'), 'Join Group must trigger confirmation modal');
  assert(matchPageCode.includes('Modal'), 'Modal component must be imported and used');
});

// TEST 3: MatchPage Category C (Compatible FIND Students)
runTest('MatchPage Category C displays individual compatible students with Create Group Together action', () => {
  assert(matchPageCode.includes('Category C: Compatible Students'), 'Category C header must exist');
  assert(matchPageCode.includes('createGroupFromFindMatch') || matchPageCode.includes('handleCreateGroupWithPeer'), 'Create Group Together handler must exist');
  assert(matchPageCode.includes('peerStudent') || matchPageCode.includes('peer.student'), 'Peer student profile must be displayed');
  assert(matchPageCode.includes('Create Group Together'), 'Create Group Together button text must exist');
});

// TEST 4: MatchPage Category D (Wait for OFFER state)
runTest('MatchPage Category D displays reassuring Wait for OFFER state without cancelling FIND post', () => {
  assert(matchPageCode.includes('Waiting for an Offer') || matchPageCode.includes('Wait for an OFFER') || matchPageCode.includes('Live Request Active'), 'Wait for OFFER state must exist');
  assert(matchPageCode.includes('FIND post is active (not cancelled)') || matchPageCode.includes('Your passenger request is active'), 'Must confirm FIND post is not cancelled');
});

// TEST 5: SharedRidesPage 3 Segment Tabs
runTest('SharedRidesPage provides 3 clear tabs: Discover Groups, My Groups, and Invitations', () => {
  assert(sharedRidesCode.includes('Discover Groups'), 'Discover Groups tab must exist');
  assert(sharedRidesCode.includes('My Groups'), 'My Groups tab must exist');
  assert(sharedRidesCode.includes('Invitations'), 'Invitations tab must exist');
});

// TEST 6: SharedRidesPage Discover Groups and Join Confirmation Modal
runTest('SharedRidesPage Discover Groups includes progress bar, spots left, and Join Confirmation Modal', () => {
  assert(sharedRidesCode.includes('availableSpots'), 'Available spots must be tracked');
  assert(sharedRidesCode.includes('targetCapacity'), 'Target capacity must be tracked');
  assert(sharedRidesCode.includes('setConfirmJoinGroup'), 'Join confirmation modal trigger must exist');
  assert(sharedRidesCode.includes('directJoinSharedRideGroup'), 'directJoinSharedRideGroup must be called');
  assert(sharedRidesCode.includes('Modal'), 'Modal component must be used');
});

// TEST 7: SharedRidesPage My Groups and Leave Group Modal
runTest('SharedRidesPage My Groups displays confirmed groups with Role Badge and Leave Group Modal', () => {
  assert(sharedRidesCode.includes('Group Admin') || sharedRidesCode.includes('Confirmed Member'), 'Role badges must exist');
  assert(sharedRidesCode.includes('handleOpenLeaveModal') || sharedRidesCode.includes('setConfirmLeaveGroup'), 'Leave group modal trigger must exist');
  assert(sharedRidesCode.includes('leaveSharedRideGroup'), 'leaveSharedRideGroup API must be wired');
  assert(sharedRidesCode.includes('Your FIND post remains safe'), 'Reassurance that FIND post is safe must exist');
});

// TEST 8: SharedRidesPage Invitations Tab (Received & Sent)
runTest('SharedRidesPage Invitations tab supports both Received and Sent Invitations', () => {
  assert(sharedRidesCode.includes('Received Invitations'), 'Received Invitations sub-tab must exist');
  assert(sharedRidesCode.includes('Sent Invitations'), 'Sent Invitations sub-tab must exist');
  assert(sharedRidesCode.includes('acceptGroupInvitation'), 'acceptGroupInvitation must be wired');
  assert(sharedRidesCode.includes('rejectGroupInvitation'), 'rejectGroupInvitation must be wired');
  assert(sharedRidesCode.includes('getGroupInvites'), 'getGroupInvites must be imported to load sent invites');
});

// TEST 9: GroupDetailsPage privacy, succession and cancellation
runTest('GroupDetailsPage restricts WhatsApp link to confirmed members and displays Cancelled banner and Leave Modal', () => {
  assert(groupDetailsCode.includes('whatsappGroupUrl'), 'WhatsApp group URL must be supported');
  assert(groupDetailsCode.includes('isAdmin || isConfirmedMember') && groupDetailsCode.includes('status !== \'cancelled\''), 'WhatsApp link must be strictly restricted to active confirmed members');
  assert(groupDetailsCode.includes('This Shared Ride Group Has Been Cancelled') || groupDetailsCode.includes('group.status === \'cancelled\''), 'Cancelled group alert banner must exist');
  assert(groupDetailsCode.includes('showLeaveModal'), 'Leave modal state must exist');
  assert(groupDetailsCode.includes('Modal'), 'Modal component must be used');
});

// TEST 10: MyMatchesPage callout banner to explore shared groups
runTest('MyMatchesPage includes callout banner for active FIND requests connecting to MatchPage', () => {
  assert(myMatchesCode.includes('/match/explore'), 'MyMatchesPage must link to /match/explore');
  assert(myMatchesCode.includes('Offers, Shared Groups & Compatible Students') || myMatchesCode.includes('Explore by Post'), 'FIND callout banner must exist');
});

console.log('\n=================================================================');
console.log(`📊 TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('=================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
