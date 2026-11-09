import React, { Component, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useUser } from './context/FirebaseAuthContext';
import { AnimatePresence } from 'framer-motion';

import { setTokenGetter, getProfile, saveProfile } from './lib/api';
import { AuthProfileProvider, useAuthProfile } from './context/AuthProfileContext';

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

// Find Your Slot Friend Feature Module
import { 
  SlotFriendProvider, 
  SlotFriendHomePage, 
  CreateSlotPostPage, 
  SlotMatchesPage, 
  SlotStudentProfilePage,
  SlotMateProfilePage,
  SlotMateNotificationsPage
} from './features/slot-friend';

// PWA Utilities & Banners
import { OfflineBanner } from './components/ui/OfflineBanner';
import { InstallPwaPrompt } from './components/ui/InstallPwaPrompt';
import { InAppNotificationBanner } from './components/ui/InAppNotificationBanner';
import { initMobileNativeBridge } from './mobile/mobileBridge';
import { syncDeviceTokenWithBackend, unregisterDeviceTokenFromBackend } from './mobile/pushNotifications';

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

  // 1. Show clean Helpu loading screen while Auth or Profile status is resolving
  if (!isLoaded || (isSignedIn && isProfileLoading)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-5">
          <img
            src="/logo.png"
            alt="Helpu"
            className="h-10 sm:h-12 w-auto object-contain select-none"
            draggable="false"
          />
          <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
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
function GuestFriendlyRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  const { isProfileLoading, hasWhatsApp } = useAuthProfile();
  const location = useLocation();

  if (!isLoaded || (isSignedIn && isProfileLoading)) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-5">
          <img
            src="/logo.png"
            alt="Helpu"
            className="h-10 sm:h-12 w-auto object-contain select-none"
            draggable="false"
          />
          <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const isOnWhatsAppSetup = location.pathname === '/whatsapp-setup';

  // If unauthenticated guest, allow exploring and draft editing
  if (!isSignedIn) {
    return children;
  }

  // If signed-in user already has WhatsApp and visits setup page, redirect to home
  if (isOnWhatsAppSetup && hasWhatsApp) {
    return <Navigate to="/home" replace />;
  }

  // If signed in, ensure WhatsApp onboarding is completed
  if (!hasWhatsApp) {
    if (isOnWhatsAppSetup) {
      return children;
    }
    const returnTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/whatsapp-setup?returnTo=${returnTarget}`} replace />;
  }

  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProfileProvider>
        <SlotFriendProvider>
          <MobileBridgeInitializer />
          <OfflineBanner />
          <InstallPwaPrompt />
          <InAppNotificationBanner />
          <TokenInjector />
          <Routes>
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

          <Route path="/slot-friend/my-posts" element={<Navigate to="/slotmate/matches" replace />} />
          <Route path="/slot-friend/notifications" element={<ProtectedRoute><SlotMateNotificationsPage /></ProtectedRoute>} />
          <Route path="/slot-friend/student/:studentId" element={<ProtectedRoute><SlotStudentProfilePage /></ProtectedRoute>} />
          <Route path="/slot-friend/profile" element={<GuestFriendlyRoute><SlotMateProfilePage /></GuestFriendlyRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SlotFriendProvider>
      </AuthProfileProvider>
    </ErrorBoundary>
  );
}
