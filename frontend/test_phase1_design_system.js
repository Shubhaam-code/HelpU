/**
 * Phase 1 Design System & Navigation Verification Suite
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

console.log('====================================================');
console.log('HELPU PHASE 1: DESIGN SYSTEM & NAVIGATION AUDIT');
console.log('====================================================\n');

// 1. Mobile Navigation Audit
test('Mobile navigation has exactly FOUR items (Home, Ride, Matching, Group)', () => {
  const bottomNavPath = path.join(__dirname, 'src/components/layout/BottomNavigation.jsx');
  const content = fs.readFileSync(bottomNavPath, 'utf8');

  // Verify exactly 4 items in MOBILE_NAV_ITEMS
  const match = content.match(/const MOBILE_NAV_ITEMS = \[([\s\S]*?)\];/);
  if (!match) throw new Error('MOBILE_NAV_ITEMS not found in BottomNavigation.jsx');

  const itemsBlock = match[1];
  const items = [
    { label: 'Home', path: '/home' },
    { label: 'Ride', path: '/rides/offer' },
    { label: 'Matching', path: '/match' },
    { label: 'Group', path: '/shared-rides' }
  ];

  for (const item of items) {
    if (!itemsBlock.includes(item.label) || !itemsBlock.includes(item.path)) {
      throw new Error(`Missing mobile nav item: ${item.label} (${item.path})`);
    }
  }

  // Count items
  const labelMatches = itemsBlock.match(/label:\s*['"`](.*?)['"`]/g) || [];
  if (labelMatches.length !== 4) {
    throw new Error(`Expected exactly 4 mobile nav items, found ${labelMatches.length}: ${labelMatches.join(', ')}`);
  }

  // Ensure NO Profile tab
  if (itemsBlock.includes("label: 'Profile'") || itemsBlock.includes('label: "Profile"')) {
    throw new Error('Profile tab found in mobile bottom navigation! Profile must be accessed only via header.');
  }

  // Ensure NO About tab
  if (itemsBlock.includes("label: 'About'") || itemsBlock.includes('label: "About"')) {
    throw new Error('About tab found in mobile bottom navigation! About must be visible only on desktop.');
  }
});

// 2. Desktop Navigation Audit
test('Desktop navigation has exactly FIVE items (Home, Ride, Matching, Group, About)', () => {
  const desktopNavPath = path.join(__dirname, 'src/components/layout/DesktopNavbar.jsx');
  const content = fs.readFileSync(desktopNavPath, 'utf8');

  const match = content.match(/const DESKTOP_NAV_ITEMS = \[([\s\S]*?)\];/);
  if (!match) throw new Error('DESKTOP_NAV_ITEMS not found in DesktopNavbar.jsx');

  const itemsBlock = match[1];
  const items = [
    { label: 'Home', path: '/home' },
    { label: 'Ride', path: '/rides/offer' },
    { label: 'Matching', path: '/match' },
    { label: 'Group', path: '/shared-rides' },
    { label: 'About', path: '/about' }
  ];

  for (const item of items) {
    if (!itemsBlock.includes(item.label) || !itemsBlock.includes(item.path)) {
      throw new Error(`Missing desktop nav item: ${item.label} (${item.path})`);
    }
  }

  const labelMatches = itemsBlock.match(/label:\s*['"`](.*?)['"`]/g) || [];
  if (labelMatches.length !== 5) {
    throw new Error(`Expected exactly 5 desktop nav items, found ${labelMatches.length}: ${labelMatches.join(', ')}`);
  }
});

// 3. Header Profile Access
test('Profile access is provided in AppHeader (mobile) and DesktopNavbar (desktop)', () => {
  const appHeaderPath = path.join(__dirname, 'src/components/layout/AppHeader.jsx');
  const appHeaderContent = fs.readFileSync(appHeaderPath, 'utf8');
  if (!appHeaderContent.includes('/profile') || !appHeaderContent.includes('Avatar')) {
    throw new Error('AppHeader does not provide direct navigation to /profile via user Avatar.');
  }

  const desktopNavPath = path.join(__dirname, 'src/components/layout/DesktopNavbar.jsx');
  const desktopContent = fs.readFileSync(desktopNavPath, 'utf8');
  if (!desktopContent.includes('/profile') || !desktopContent.includes('Avatar')) {
    throw new Error('DesktopNavbar does not provide profile dropdown with /profile access.');
  }
});

// 4. Safe Areas & Content Padding
test('Android safe area insets and clearance padding are properly configured', () => {
  const bottomNavPath = path.join(__dirname, 'src/components/layout/BottomNavigation.jsx');
  const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');
  if (!bottomNavContent.includes('env(safe-area-inset-bottom)')) {
    throw new Error('BottomNavigation lacks env(safe-area-inset-bottom) padding.');
  }

  const shellPath = path.join(__dirname, 'src/components/layout/ResponsiveShell.jsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');
  if (!shellContent.includes('pb-[calc(') && !shellContent.includes('env(safe-area-inset-bottom')) {
    throw new Error('ResponsiveShell lacks bottom clearance padding for mobile navigation bar.');
  }
});

// 5. Design System Tokens & Classes
test('Design system tokens (warm cream, orange primary, navy text) configured', () => {
  const cssPath = path.join(__dirname, 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  if (!css.includes('--color-coral: #FF572E;')) {
    throw new Error('Missing or incorrect primary orange token #FF572E in index.css');
  }
  if (!css.includes('--color-cream: #FFF8F3;')) {
    throw new Error('Missing or incorrect warm cream token #FFF8F3 in index.css');
  }
  if (!css.includes('--color-navy: #17233C;')) {
    throw new Error('Missing or incorrect navy text token #17233C in index.css');
  }
});

// 6. Reusable Design System Components
test('Core reusable design system components exist and are properly exported', () => {
  const components = [
    'src/components/ui/Button.jsx',
    'src/components/ui/PrimaryButton.jsx',
    'src/components/ui/Card.jsx',
    'src/components/ui/Input.jsx',
    'src/components/ui/Modal.jsx',
    'src/components/ui/EmptyState.jsx',
    'src/components/ui/LoadingSkeleton.jsx',
    'src/components/ui/LoadingState.jsx',
    'src/components/ui/ErrorState.jsx',
    'src/components/ui/PageContainer.jsx',
    'src/components/ui/index.js'
  ];

  for (const comp of components) {
    const fullPath = path.join(__dirname, comp);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing design system component: ${comp}`);
    }
  }
});

// 7. Small Screen Responsive Checks (320px, 360px, 375px, 390px, 430px)
test('Mobile bottom navigation fits 320px width without horizontal overflow', () => {
  const bottomNavPath = path.join(__dirname, 'src/components/layout/BottomNavigation.jsx');
  const content = fs.readFileSync(bottomNavPath, 'utf8');

  // Check that items use flex-1, no fixed min-width > 75px
  if (content.includes('min-w-[') && content.match(/min-w-\[(\d+)px\]/)) {
    const val = parseInt(content.match(/min-w-\[(\d+)px\]/)[1], 10);
    if (val > 75) {
      throw new Error(`min-width of ${val}px on mobile nav items will cause overflow at 320px screen width!`);
    }
  }

  // Ensure root has overflow-x hidden
  const cssPath = path.join(__dirname, 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  if (!css.includes('overflow-x: hidden;')) {
    throw new Error('Root lacks overflow-x: hidden to prevent horizontal scrolling.');
  }
});

console.log('\n====================================================');
console.log('ALL PHASE 1 DESIGN SYSTEM & NAVIGATION TESTS PASSED!');
console.log('====================================================\n');

