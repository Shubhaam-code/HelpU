import React, { Component, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useUser, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
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
import MatchPage from './pages/MatchPage';
import MyMatchesPage from './pages/MyMatchesPage';
import MatchPreferencesPage from './pages/MatchPreferencesPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import MatchSuccessPage from './pages/MatchSuccessPage';
import ChatConversationPage from './pages/ChatConversationPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import CreatePage from './pages/CreatePage';
import MyPostsPage from './pages/MyPostsPage';
import CommunityPage from './pages/CommunityPage';
import GetHelpPage from './pages/GetHelpPage';
import AboutPage from './pages/AboutPage';
import StaticInfoPage from './pages/StaticInfoPage';

// PWA Utilities & Banners
import { OfflineBanner } from './components/ui/OfflineBanner';
import { InstallPwaPrompt } from './components/ui/InstallPwaPrompt';
import { WhatsAppOnboardingCheck } from './components/auth/WhatsAppOnboardingCheck';

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

// Token injector & Profile picture auto-synchronization
function TokenInjector() {
  const { getToken } = useAuth();
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      getProfile()
        .then((res) => {
          const p = res.data?.data;
          const currentImg = user.imageUrl || '';
          const email = p?.email || user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
          const name = p?.name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Campus Student';
          const canonicalNumber = p?.whatsappNumber || p?.phone || user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || '';

          if ((!p || !p.imageUrl || (currentImg && p.imageUrl !== currentImg)) && email) {
            const syncPayload = {
              name,
              email,
              college: p?.college || 'VIT, Bhopal',
              imageUrl: currentImg
            };
            // Never pass blank phone numbers during background image sync
            if (canonicalNumber) {
              syncPayload.phone = canonicalNumber;
              syncPayload.whatsappNumber = canonicalNumber;
            }
            saveProfile(syncPayload).catch((err) => console.warn('Failed to sync profile image:', err));
          }
        })
        .catch(() => {});
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}

// Protected route wrapper:
// Seamlessly verifies Clerk authentication AND WhatsApp onboarding status
// BEFORE rendering any protected page, completely eliminating Home page flicker.
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  const { isProfileLoading, hasWhatsApp, isSkipped } = useAuthProfile();
  const location = useLocation();

  // 1. Show clean Helpu loading screen while Clerk or Profile status is resolving
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

  // 2. Unauthenticated users redirected to /auth
  if (!isSignedIn) {
    return <Navigate to="/auth" replace />;
  }

  const isOnWhatsAppSetup = location.pathname === '/whatsapp-setup';

  // 3. User does NOT have WhatsApp number and has NOT skipped:
  // Redirect IMMEDIATELY to /whatsapp-setup BEFORE Home or any protected page ever mounts!
  if (!hasWhatsApp && !isSkipped) {
    if (isOnWhatsAppSetup) {
      return children;
    }
    return <Navigate to="/whatsapp-setup" replace />;
  }

  // 4. User ALREADY has WhatsApp number and attempts to open /whatsapp-setup:
  if (isOnWhatsAppSetup && hasWhatsApp) {
    return <Navigate to="/home" replace />;
  }

  // 5. User has completed setup or skipped: render requested protected route
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProfileProvider>
        <OfflineBanner />
        <InstallPwaPrompt />
        <TokenInjector />
        <WhatsAppOnboardingCheck />
        <Routes>
          {/* Public Landing & Authentication */}
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage initialMode="signIn" />} />
          <Route path="/signup" element={<AuthPage initialMode="signUp" />} />
          <Route path="/sign-in/*" element={<AuthPage initialMode="signIn" />} />
          <Route path="/sign-up/*" element={<AuthPage initialMode="signUp" />} />

          {/* WhatsApp Onboarding */}
          <Route path="/whatsapp-setup" element={<ProtectedRoute><WhatsAppOnboardingPage /></ProtectedRoute>} />

          {/* Protected */}
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/rides" element={<ProtectedRoute><Navigate to="/rides/offer" replace /></ProtectedRoute>} />
          <Route path="/rides/offer" element={<ProtectedRoute><OfferRidePage /></ProtectedRoute>} />
          <Route path="/rides/request" element={<ProtectedRoute><OfferRidePage /></ProtectedRoute>} />
          <Route path="/rides/:id" element={<ProtectedRoute><RideDetailsPage /></ProtectedRoute>} />
          <Route path="/book/:id" element={<ProtectedRoute><BookSeatPage /></ProtectedRoute>} />
          {/* Bookings route removed as per request: gracefully redirected to /posts */}
          <Route path="/bookings" element={<ProtectedRoute><Navigate to="/posts" replace /></ProtectedRoute>} />
          <Route path="/bookings/:id" element={<ProtectedRoute><Navigate to="/posts" replace /></ProtectedRoute>} />
          <Route path="/match" element={<ProtectedRoute><MyMatchesPage /></ProtectedRoute>} />
          <Route path="/matches" element={<ProtectedRoute><MyMatchesPage /></ProtectedRoute>} />
          <Route path="/match/my" element={<ProtectedRoute><MyMatchesPage /></ProtectedRoute>} />
          <Route path="/match/explore" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
          <Route path="/match/preferences" element={<ProtectedRoute><MatchPreferencesPage /></ProtectedRoute>} />
          <Route path="/match/success" element={<ProtectedRoute><MatchSuccessPage /></ProtectedRoute>} />
          <Route path="/match/:id" element={<ProtectedRoute><MatchDetailsPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
          <Route path="/chat/:id" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProfileProvider>
    </ErrorBoundary>
  );
}
