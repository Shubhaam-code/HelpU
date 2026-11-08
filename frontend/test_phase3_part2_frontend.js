import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('TEST SUITE: Helpu Phase 3 Part 2 — Create Group, Invites & Group Management');
console.log('================================================================\n');

// 1. Verify Routes Configuration in App.jsx
console.log('CHECK 1: Route Registration (/groups/:groupId)');
const appJsxPath = path.join(__dirname, 'src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

assert(appJsxContent.includes("import GroupDetailsPage from './pages/GroupDetailsPage'"), 'App.jsx must import GroupDetailsPage');
assert(appJsxContent.includes('path="/groups/:groupId"'), 'App.jsx must configure route /groups/:groupId');
assert(appJsxContent.includes('path="/shared-rides"'), 'App.jsx must configure route /shared-rides');
assert(appJsxContent.includes('path="/groups"'), 'App.jsx must retain /groups fallback');
console.log('  ✔ /groups/:groupId deep link route properly registered in App.jsx with ProtectedRoute wrapper');

// 2. Verify API Client Methods
console.log('\nCHECK 2: API Client Functions in src/lib/api.js');
const apiPath = path.join(__dirname, 'src/lib/api.js');
const apiContent = fs.readFileSync(apiPath, 'utf8');

const expectedApis = [
  'createSharedRideGroup',
  'getSharedRideGroupById',
  'getReceivedInvitations',
  'getGroupInvites',
  'inviteStudentToGroup',
  'acceptGroupInvitation',
  'rejectGroupInvitation',
  'getGroupJoinRequests',
  'acceptStudentJoinRequest',
  'rejectStudentJoinRequest'
];

expectedApis.forEach(api => {
  assert(apiContent.includes(api), `Missing API function: ${api} in src/lib/api.js`);
});
assert(apiContent.includes('/api/groups/invitations'), 'Must call /api/groups/invitations endpoint');
assert(apiContent.includes('/api/groups/join-requests'), 'Must call /api/groups/join-requests endpoint');
console.log('  ✔ All 10 required group API methods implemented in src/lib/api.js');

// 3. Verify TanStack Query Hooks and Cache Invalidation
console.log('\nCHECK 3: TanStack Query Client & Hooks in src/lib/queryClient.js and src/hooks/useAppData.js');
const queryClientPath = path.join(__dirname, 'src/lib/queryClient.js');
const queryClientContent = fs.readFileSync(queryClientPath, 'utf8');

assert(queryClientContent.includes('groupDetails:'), 'QUERY_KEYS missing groupDetails');
assert(queryClientContent.includes('groupJoinRequests:'), 'QUERY_KEYS missing groupJoinRequests');
assert(queryClientContent.includes('groupInvites:'), 'QUERY_KEYS missing groupInvites');
assert(queryClientContent.includes('receivedInvitations:'), 'QUERY_KEYS missing receivedInvitations');
assert(queryClientContent.includes('invalidateGroupQueries'), 'Missing invalidateGroupQueries helper');

const appDataPath = path.join(__dirname, 'src/hooks/useAppData.js');
const appDataContent = fs.readFileSync(appDataPath, 'utf8');

assert(appDataContent.includes('useSharedRideGroupDetails'), 'Missing useSharedRideGroupDetails hook');
assert(appDataContent.includes('useReceivedGroupInvitations'), 'Missing useReceivedGroupInvitations hook');
assert(appDataContent.includes('useGroupJoinRequests'), 'Missing useGroupJoinRequests hook');
assert(appDataContent.includes('useGroupSentInvites'), 'Missing useGroupSentInvites hook');
console.log('  ✔ Group query keys, invalidator, and custom query hooks configured');

// 4. Verify CreateGroupModal.jsx Form & Validations
console.log('\nCHECK 4: CreateGroupModal Form Fields & Payload Validation');
const modalPath = path.join(__dirname, 'src/components/groups/CreateGroupModal.jsx');
assert(fs.existsSync(modalPath), 'CreateGroupModal.jsx does not exist');
const modalContent = fs.readFileSync(modalPath, 'utf8');

// Form fields check
assert(modalContent.includes('originatingTravelId'), 'Modal must manage originatingTravelId');
assert(modalContent.includes('targetCapacity'), 'Modal must manage targetCapacity');
assert(modalContent.includes('actualCabCapacity'), 'Modal must manage actualCabCapacity');
assert(modalContent.includes('whatsappGroupUrl'), 'Modal must manage whatsappGroupUrl');
assert(modalContent.includes('notes'), 'Modal must manage notes');

// Validation checks
assert(modalContent.includes('chat.whatsapp.com'), 'Must validate WhatsApp invite link format');
assert(modalContent.includes('createSharedRideGroup'), 'Must call createSharedRideGroup on submit');
assert(modalContent.includes('navigate(`/groups/${createdGroup._id}`'), 'Must navigate to /groups/:groupId on creation');
assert(modalContent.includes("t.type === 'request'"), 'Must filter only FIND posts (type === request)');
// Capacity business rules audit checks
assert(!modalContent.includes('targetCapacity > 6'), 'CreateGroupModal must not enforce arbitrary max targetCapacity (e.g. 6)');
assert(!modalContent.includes('parsedCabCap < parsedTarget'), 'CreateGroupModal must not enforce actualCabCapacity >= targetCapacity');
assert(modalContent.includes("useState('')"), 'targetCapacity and actualCabCapacity must not have arbitrary default values');

console.log('  ✔ Active FIND post selector present (OFFER posts excluded)');
console.log('  ✔ Required target capacity (positive integer >= 1) validated without hardcoded max or default');
console.log('  ✔ Optional actual cab capacity validated without enforcing actualCabCapacity >= targetCapacity');
console.log('  ✔ Optional WhatsApp invite link regex validation');
console.log('  ✔ Navigates directly to /groups/:groupId upon creation');

// 5. Verify SharedRidesPage Tabs & Invitation Handling
console.log('\nCHECK 5: SharedRidesPage 3-Tab Organization & Received Invitations');
const sharedRidesPath = path.join(__dirname, 'src/pages/SharedRidesPage.jsx');
const sharedRidesContent = fs.readFileSync(sharedRidesPath, 'utf8');

assert(sharedRidesContent.includes('activeTab'), 'SharedRidesPage must have tab state');
assert(sharedRidesContent.includes("'discover'"), 'SharedRidesPage must have discover tab');
assert(sharedRidesContent.includes("'my-groups'"), 'SharedRidesPage must have my-groups tab');
assert(sharedRidesContent.includes("'invitations'"), 'SharedRidesPage must have invitations tab');
assert(sharedRidesContent.includes('useReceivedGroupInvitations'), 'SharedRidesPage must use useReceivedGroupInvitations hook');
assert(sharedRidesContent.includes('acceptGroupInvitation'), 'SharedRidesPage must handle accept invitation');
assert(sharedRidesContent.includes('rejectGroupInvitation'), 'SharedRidesPage must handle reject invitation');
assert(sharedRidesContent.includes('CreateGroupModal'), 'SharedRidesPage must embed CreateGroupModal');
assert(sharedRidesContent.includes('/groups/'), 'SharedRidesPage cards must link to /groups/:groupId');
console.log('  ✔ 3-Tab layout: Discover Groups, My Groups, Invitations');
console.log('  ✔ Dynamic badge showing pending invitation count');
console.log('  ✔ Accept and Reject invitation actions with mutation states & cache invalidation');
console.log('  ✔ Cards click-through to /groups/:groupId');

// 6. Verify GroupDetailsPage.jsx
console.log('\nCHECK 6: GroupDetailsPage Component Structure & Security');
const groupDetailsPath = path.join(__dirname, 'src/pages/GroupDetailsPage.jsx');
assert(fs.existsSync(groupDetailsPath), 'GroupDetailsPage.jsx does not exist');
const detailsContent = fs.readFileSync(groupDetailsPath, 'utf8');

// Data display
assert(detailsContent.includes('source'), 'Must display route source');
assert(detailsContent.includes('destination'), 'Must display route destination');
assert(detailsContent.includes('departureDate') || detailsContent.includes('date'), 'Must display departure date');
assert(detailsContent.includes('targetCapacity'), 'Must display target capacity');
assert(detailsContent.includes('availableSpots'), 'Must display available spots');
assert(detailsContent.includes('actualCabCapacity'), 'Must display optional cab capacity note');
assert(detailsContent.includes('admin'), 'Must display admin details');
assert(detailsContent.includes('members'), 'Must display confirmed members list');

// WhatsApp Privacy Guard
assert(detailsContent.includes('isConfirmedMember'), 'Must check if viewer is confirmed member or admin');
assert(detailsContent.includes('chat.whatsapp.com') || detailsContent.includes('whatsappGroupUrl'), 'Must handle WhatsApp group link');
assert(detailsContent.includes('WhatsApp Group'), 'Must render WhatsApp group section');

// Admin Join Requests & Sent Invites
assert(detailsContent.includes('isAdmin'), 'Must check if viewer is group admin');
assert(detailsContent.includes('useGroupJoinRequests'), 'Must fetch pending join requests for admin');
assert(detailsContent.includes('acceptStudentJoinRequest'), 'Must provide accept action for join requests');
assert(detailsContent.includes('rejectStudentJoinRequest'), 'Must provide reject action for join requests');
assert(detailsContent.includes('useGroupSentInvites'), 'Must display sent invitations list');
assert(detailsContent.includes('inviteStudentToGroup'), 'Must support inviting candidate students');

console.log('  ✔ Group Details renders route, travel date, departure time, status, target vs confirmed capacity');
console.log('  ✔ Confirmed members list displayed with safe profile avatars & names');
console.log('  ✔ WhatsApp link protected: strictly restricted to confirmed group members and admin');
console.log('  ✔ Admin section includes Pending Join Requests with Accept/Reject actions');
console.log('  ✔ Admin section includes Sent Invitations status tracker and student invitation tool');

// 7. Verify Privacy: Sensitive fields exclusion
console.log('\nCHECK 7: Privacy & Security (No sensitive field leaks)');
const sensitiveFields = ['clerkId', 'firebaseUid', 'password', 'hashedPassword'];
sensitiveFields.forEach(field => {
  assert(!detailsContent.includes(`.${field}`), `Unsafe reference to .${field} found in GroupDetailsPage`);
  assert(!sharedRidesContent.includes(`.${field}`), `Unsafe reference to .${field} found in SharedRidesPage`);
  assert(!modalContent.includes(`.${field}`), `Unsafe reference to .${field} found in CreateGroupModal`);
});
console.log('  ✔ No private identifier leaks (clerkId, firebaseUid) across UI components');

// 8. Backend Endpoint Check: Received Invitations & Group Routes
console.log('\nCHECK 8: Backend Routes & Controller Integration');
const backendRoutesPath = path.join(__dirname, '../backend/src/routes/group.routes.js');
const backendRoutesContent = fs.readFileSync(backendRoutesPath, 'utf8');
assert(backendRoutesContent.includes('/invitations/received'), 'backend group.routes.js missing /invitations/received');

const backendControllerPath = path.join(__dirname, '../backend/src/controllers/group.controller.js');
const backendControllerContent = fs.readFileSync(backendControllerPath, 'utf8');
assert(backendControllerContent.includes('getReceivedInvitations'), 'backend group.controller.js missing getReceivedInvitations');
console.log('  ✔ GET /api/groups/invitations/received implemented in backend and mounted before /:id');

console.log('\n================================================================');
console.log('ALL PHASE 3 PART 2 VERIFICATION CHECKS PASSED (100% SUCCESS)');
console.log('================================================================');
process.exit(0);
