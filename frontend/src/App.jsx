import React, { Component, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useUser } from './context/FirebaseAuthContext';
import { AnimatePresence } from 'framer-motion';

import { setTokenGetter, getProfile, saveProfile } from './lib/api';
import { AuthProfileProvider, useAuthProfile } from './context/AuthProfileContext';
import StartupVideoIntro from './components/ui/StartupVideoIntro';

// Pages
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import WhatsAppOnboardingPage from './pages/WhatsAppOnboardingPage';
import HomePage from './pages/HomePage';
import OfferRidePage from './pages/OfferRidePage';
import RideDetailsPage from './pages/RideDetailsPage';
import BookSeatPage from './pages/BookSeatPage';
import BookingDetailsPage from './pages/BookingDetailsPage';
import ConfirmedRidesPage from './pages/ConfirmedRidesPage';
import MatchPage from './pages/MatchPage';
import MyMatchesPage from './pages/MyMatchesPage';
import MatchPreferencesPage from './pages/MatchPreferencesPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import MatchSuccessPage from './pages/MatchSuccessPage';
import ChatConversationPage from './pages/ChatConversationPage';
import ProfilePage from './pages/ProfilePage';
import SharedRidesPage from './pages/SharedRidesPage';
import GroupDetailsPage from './pages/GroupDetailsPage';
import NotificationsPage from './pages/NotificationsPage';
import CreatePage from './pages/CreatePage';
import MyPostsPage from './pages/MyPostsPage';
import CommunityPage from './pages/CommunityPage';
import GetHelpPage from './pages/GetHelpPage';
import AboutPage from './pages/AboutPage';
import StaticInfoPage from './pages/StaticInfoPage';
import InstallAppPage from './pages/InstallAppPage';

// Find Your Slot Friend Feature Module
import { 
  SlotFriendProvider, 
  SlotFriendHomePage, 
  CreateSlotPostPage, 
  SlotMatchesPage, 
  SlotStudentProfilePage,
  SlotMateProfilePage,
  SlotMateNotificationsPage,
  FacultySearchPage,
  FacultyDetailsPage
} from './features/slot-friend';

// FFCS (Faculty & Course Selection) Module
import {
  FFCSProvider,
  FFCSHome,
  AddCourseScreen,
  AddedCoursesScreen,
  SelectFacultyScreen,
  FFCSTimeTableScreen,
  FFCSSettingsScreen
} from './features/ffcs';

// PWA Utilities & Banners
import { OfflineBanner } from './components/ui/OfflineBanner';
import { InstallPwaPrompt } from './components/ui/InstallPwaPrompt';
import { InAppNotificationBanner } from './components/ui/InAppNotificationBanner';
import { initMobileNativeBridge, hideNativeSplashScreen } from './mobile/mobileBridge';
import { syncDeviceTokenWithBackend, unregisterDeviceTokenFromBackend } from './mobile/pushNotifications';
import { useNetworkSync } from './hooks/useNetworkSync';

// Top-level Error Boundary to catch any child component crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('HelpU App ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[#FFF8F3] p-4 text-center">
          <div className="bg-white rounded-[28px] p-8 border border-[#F4E3D8] shadow-md max-w-md w-full">
            <div className="w-14 h-14 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center text-2xl mx-auto mb-4">
              ⚠️
            </div>
            <h2 className="font-black text-[#17233C] text-xl mb-2">Something went wrong</h2>
            <p className="text-xs text-[#6E7587] mb-6 leading-relaxed">
              We encountered an unexpected display issue. Don't worry, your data is safe.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.href = '/home'; }}
                className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Return to Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-white border border-[#F4E3D8] text-[#17233C] font-bold text-xs rounded-xl hover:bg-[#FFF7F2] transition-colors cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Token injector & FCM Token sync
function TokenInjector() {
  const { getToken } = useAuth();
  const { user, isLoaded, isSignedIn } = useUser();
  const previousUserIdRef = React.useRef(null);

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Synchronize FCM device push token with backend on login, refresh, or account switch
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user?.id) {
      previousUserIdRef.current = user.id;
      syncDeviceTokenWithBackend(user);
    } else if (!isSignedIn && previousUserIdRef.current) {
      previousUserIdRef.current = null;
      unregisterDeviceTokenFromBackend();
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}

// Native mobile runtime bridge initializer (Status Bar, Back Button, Keyboard, Push Notifications)
function MobileBridgeInitializer() {
  const navigate = useNavigate();
  useNetworkSync(); // Phase 6: Network reconnect → stale query revalidation

  useEffect(() => {
    const cleanup = initMobileNativeBridge({ navigate });
    return cleanup;
  }, [navigate]);

  return null;
}

// Protected route wrapper:
// Seamlessly verifies Firebase authentication AND WhatsApp onboarding status
// BEFORE rendering any strictly protected page.
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  const { isProfileLoading, hasWhatsApp } = useAuthProfile();
  const location = useLocation();

  // 1. Show lightweight inline data-loading state (no full-screen Helpu logo blocker)
  if (!isLoaded || (isSignedIn && isProfileLoading)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream px-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white border border-[#F4E3D8] shadow-xs text-xs font-bold text-[#17233C]">
          <div className="w-4 h-4 border-2 border-coral border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Data loading...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated users redirected to /auth with return path preserved
  if (!isSignedIn) {
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTarget}`} replace />;
  }

  const isOnWhatsAppSetup = location.pathname === '/whatsapp-setup';

  // 3. User does NOT have WhatsApp number:
  // Redirect to /whatsapp-setup preserving return path
  if (!hasWhatsApp) {
    if (isOnWhatsAppSetup) {
      return children;
    }
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/whatsapp-setup?returnTo=${returnTarget}`} replace />;
  }

  // 4. User ALREADY has WhatsApp number and attempts to open /whatsapp-setup:
  if (isOnWhatsAppSetup && hasWhatsApp) {
    return <Navigate to="/home" replace />;
  }

  // 5. User has completed setup: render requested protected route
  return children;
}

// Guest-friendly route wrapper:
// Allows unauthenticated guests to explore, view public previews, and fill draft forms.
// If authenticated, ensures WhatsApp onboarding is completed.
// CRITICAL: When a signed-in user is on /whatsapp-setup (mid-form), do NOT redirect them away
// even if hasWhatsApp briefly becomes truthy from a background profile event.
// The WhatsAppOnboardingPage handles its own navigation after successful save.
function GuestFriendlyRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  const { isProfileLoading, hasWhatsApp } = useAuthProfile();
  const location = useLocation();

  // Wait only briefly for local Firebase auth SDK initialization without blocking on backend cold start
  if (!isLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream px-4">
        <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white border border-[#F4E3D8] shadow-xs text-xs font-bold text-[#17233C]">
          <div className="w-4 h-4 border-2 border-coral border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Data loading...</span>
        </div>
      </div>
    );
  }

  const isOnWhatsAppSetup = location.pathname === '/whatsapp-setup';

  // If unauthenticated guest, allow exploring and draft editing
  if (!isSignedIn) {
    return children;
  }

  // If backend profile is still loading (slow/waking up), render the static page immediately
  // instead of hiding the UI behind a full-screen logo splash.
  if (isProfileLoading) {
    return children;
  }

  // If signed in without WhatsApp: redirect to onboarding (unless already there)
  if (!hasWhatsApp) {
    if (isOnWhatsAppSetup) {
      // Stay on the onboarding page — form is in progress, do NOT redirect mid-form
      return children;
    }
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/whatsapp-setup?returnTo=${returnTarget}`} replace />;
  }

  // If signed-in user has completed onboarding and manually navigates to setup, redirect home
  if (isOnWhatsAppSetup && hasWhatsApp) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

// In-memory fallback tracking so intro plays once per app launch session
let hasIntroPlayedSession = false;
try {
  hasIntroPlayedSession = sessionStorage.getItem('helpu_startup_intro_played') === 'true';
} catch {
  // ignore
}

function AppShell() {
  const location = useLocation();
  const isInstallRoute = location.pathname === '/install-app' || location.pathname === '/install';

  // Dedicated minimal standalone installation page: bypasses all splash, intros, and app shells
  if (isInstallRoute) {
    return (
      <Routes>
        <Route path="/install-app" element={<InstallAppPage />} />
        <Route path="/install" element={<InstallAppPage />} />
        <Route path="*" element={<InstallAppPage />} />
      </Routes>
    );
  }

  const { isLoaded, isSignedIn } = useUser();
  const [introCompleted, setIntroCompleted] = useState(() => hasIntroPlayedSession);

  // If user is already authenticated once auth resolves, skip intro immediately
  useEffect(() => {
    if (isLoaded && isSignedIn && !introCompleted) {
      try {
        sessionStorage.setItem('helpu_startup_intro_played', 'true');
      } catch {}
      hasIntroPlayedSession = true;
      setIntroCompleted(true);
      hideNativeSplashScreen(200);
    }
  }, [isLoaded, isSignedIn, introCompleted]);

  // If user is already past intro (or returning from auth), ensure native splash is dismissed
  useEffect(() => {
    if (isLoaded && (isSignedIn || introCompleted)) {
      hideNativeSplashScreen(200);
    }
  }, [isLoaded, isSignedIn, introCompleted]);

  const handleIntroComplete = useCallback(() => {
    try {
      sessionStorage.setItem('helpu_startup_intro_played', 'true');
    } catch {}
    hasIntroPlayedSession = true;
    setIntroCompleted(true);
    hideNativeSplashScreen(200);
  }, []);

  // Show intro only for logged-out guests on startup if not yet played this session
  const shouldPlayIntro = isLoaded && !isSignedIn && !introCompleted;

  // While Firebase Auth is initializing on initial launch, display matching #EFD7A2 poster
  // so there is zero transition flash of a logo or white screen when the native splash cross-fades
  if (!isLoaded && !hasIntroPlayedSession) {
    return (
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center select-none"
        style={{ backgroundColor: '#EFD7A2' }}
      >
        <img
          src="/videos/helpu-intro-poster.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover pointer-events-none"
          style={{ backgroundColor: '#EFD7A2' }}
        />
      </div>
    );
  }

  return (
    <>
      {shouldPlayIntro && (
        <StartupVideoIntro onComplete={handleIntroComplete} />
      )}
      <MobileBridgeInitializer />
      <OfflineBanner />
      <InstallPwaPrompt />
      <InAppNotificationBanner />
      <TokenInjector />
      <Routes>
      {/* Public Standalone App Installation Route */}
      <Route path="/install-app" element={<InstallAppPage />} />
      <Route path="/install" element={<InstallAppPage />} />

      {/* Public Landing & Authentication */}
      <Route path="/" element={<OnboardingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage initialMode="signIn" />} />
      <Route path="/signup" element={<AuthPage initialMode="signUp" />} />
      <Route path="/sign-in/*" element={<AuthPage initialMode="signIn" />} />
      <Route path="/sign-up/*" element={<AuthPage initialMode="signUp" />} />
      <Route path="/oauth-callback" element={<Navigate to="/slotmate" replace />} />
      <Route path="/callback" element={<Navigate to="/slotmate" replace />} />

      {/* WhatsApp / Student Profile Onboarding (Guest-Friendly) */}
      <Route path="/whatsapp-setup" element={<GuestFriendlyRoute><WhatsAppOnboardingPage /></GuestFriendlyRoute>} />

      {/* Guest-Friendly Exploration & Form Pages */}
      <Route path="/home" element={<GuestFriendlyRoute><HomePage /></GuestFriendlyRoute>} />
      <Route path="/rides" element={<Navigate to="/rides/offer" replace />} />
      <Route path="/rides/offer" element={<GuestFriendlyRoute><OfferRidePage /></GuestFriendlyRoute>} />
      <Route path="/rides/request" element={<GuestFriendlyRoute><OfferRidePage /></GuestFriendlyRoute>} />
      <Route path="/rides/:id" element={<GuestFriendlyRoute><RideDetailsPage /></GuestFriendlyRoute>} />
      <Route path="/slotmate" element={<GuestFriendlyRoute><SlotFriendHomePage /></GuestFriendlyRoute>} />
      <Route path="/slotmate/create" element={<GuestFriendlyRoute><CreateSlotPostPage /></GuestFriendlyRoute>} />
      <Route path="/slot-friend" element={<GuestFriendlyRoute><SlotFriendHomePage /></GuestFriendlyRoute>} />
      <Route path="/slot-friend/create" element={<GuestFriendlyRoute><CreateSlotPostPage /></GuestFriendlyRoute>} />
      <Route path="/match" element={<GuestFriendlyRoute><MyMatchesPage /></GuestFriendlyRoute>} />
      <Route path="/matches" element={<GuestFriendlyRoute><MyMatchesPage /></GuestFriendlyRoute>} />
      <Route path="/match/my" element={<GuestFriendlyRoute><MyMatchesPage /></GuestFriendlyRoute>} />
      <Route path="/match/explore" element={<GuestFriendlyRoute><MatchPage /></GuestFriendlyRoute>} />
      <Route path="/match/preferences" element={<GuestFriendlyRoute><MatchPreferencesPage /></GuestFriendlyRoute>} />
      <Route path="/match/success" element={<GuestFriendlyRoute><MatchSuccessPage /></GuestFriendlyRoute>} />
      <Route path="/match/:id" element={<GuestFriendlyRoute><MatchDetailsPage /></GuestFriendlyRoute>} />
      <Route path="/slotmate/matches" element={<GuestFriendlyRoute><SlotMatchesPage /></GuestFriendlyRoute>} />
      <Route path="/slot-friend/matches" element={<GuestFriendlyRoute><SlotMatchesPage /></GuestFriendlyRoute>} />

      {/* Strictly Protected User Features */}
      <Route path="/book/:id" element={<ProtectedRoute><RideDetailsPage /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute><Navigate to="/posts" replace /></ProtectedRoute>} />
      <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailsPage /></ProtectedRoute>} />
      <Route path="/confirmed-rides" element={<ProtectedRoute><ConfirmedRidesPage /></ProtectedRoute>} />
      <Route path="/rides/confirmed" element={<ProtectedRoute><ConfirmedRidesPage /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
      <Route path="/chat/:id" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
      <Route path="/profile" element={<GuestFriendlyRoute><ProfilePage /></GuestFriendlyRoute>} />
      <Route path="/shared-rides" element={<GuestFriendlyRoute><SharedRidesPage /></GuestFriendlyRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Navigate to="/shared-rides" replace /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />

      {/* Posts, Help & About dedicated pages */}
      <Route path="/posts" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
      <Route path="/my-rides" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
      <Route path="/rides/my" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
      <Route path="/community" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><GetHelpPage /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
      <Route path="/saved" element={<ProtectedRoute><StaticInfoPage title="Saved Rides" subtitle="You haven't bookmarked any rides yet. Save frequent trips for quick booking!" icon="❤️" /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><StaticInfoPage title="Help & Support" subtitle="Have questions or feedback? Our 24/7 campus support team is here to assist you." icon="💬" /></ProtectedRoute>} />

      {/* SlotMate Protected Match & Notification Pages */}
      <Route path="/slotmate/my-posts" element={<Navigate to="/slotmate/matches" replace />} />
      <Route path="/slotmate/notifications" element={<ProtectedRoute><SlotMateNotificationsPage /></ProtectedRoute>} />
      <Route path="/slotmate/student/:studentId" element={<ProtectedRoute><SlotStudentProfilePage /></ProtectedRoute>} />
      <Route path="/slotmate/profile" element={<GuestFriendlyRoute><SlotMateProfilePage /></GuestFriendlyRoute>} />

      {/* SlotMate Faculty Search & Review Pages */}
      <Route path="/slotmate/faculty" element={<GuestFriendlyRoute><FacultySearchPage /></GuestFriendlyRoute>} />
      <Route path="/slotmate/faculty/:id" element={<GuestFriendlyRoute><FacultyDetailsPage /></GuestFriendlyRoute>} />
      <Route path="/faculty" element={<Navigate to="/slotmate/faculty" replace />} />
      <Route path="/faculty/:id" element={<Navigate to="/slotmate/faculty/:id" replace />} />
      <Route path="/slot-friend/faculty" element={<Navigate to="/slotmate/faculty" replace />} />
      <Route path="/slot-friend/faculty/:id" element={<Navigate to="/slotmate/faculty/:id" replace />} />

      <Route path="/slot-friend/my-posts" element={<Navigate to="/slotmate/matches" replace />} />
      <Route path="/slot-friend/notifications" element={<ProtectedRoute><SlotMateNotificationsPage /></ProtectedRoute>} />
      <Route path="/slot-friend/student/:studentId" element={<ProtectedRoute><SlotStudentProfilePage /></ProtectedRoute>} />
      <Route path="/slot-friend/profile" element={<GuestFriendlyRoute><SlotMateProfilePage /></GuestFriendlyRoute>} />

      {/* FFCS - Faculty & Course Selection Module Routes */}
      <Route path="/slotmate/ffcs" element={<GuestFriendlyRoute><FFCSHome /></GuestFriendlyRoute>} />
      <Route path="/slotmate/ffcs/add" element={<GuestFriendlyRoute><AddCourseScreen /></GuestFriendlyRoute>} />
      <Route path="/slotmate/ffcs/courses" element={<GuestFriendlyRoute><AddedCoursesScreen /></GuestFriendlyRoute>} />
      <Route path="/slotmate/ffcs/faculty/:courseCode" element={<GuestFriendlyRoute><SelectFacultyScreen /></GuestFriendlyRoute>} />
      <Route path="/slotmate/ffcs/timetable" element={<GuestFriendlyRoute><FFCSTimeTableScreen /></GuestFriendlyRoute>} />
      <Route path="/slotmate/ffcs/settings" element={<Navigate to="/slotmate/ffcs/timetable" replace />} />
      <Route path="/ffcs" element={<Navigate to="/slotmate/ffcs" replace />} />
      <Route path="/ffcs/*" element={<Navigate to="/slotmate/ffcs" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProfileProvider>
        <SlotFriendProvider>
          <FFCSProvider>
            <AppShell />
          </FFCSProvider>
        </SlotFriendProvider>
      </AuthProfileProvider>
    </ErrorBoundary>
  );
}
