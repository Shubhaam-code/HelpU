import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, useUser, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AnimatePresence } from 'framer-motion';

import { setTokenGetter } from './lib/api';

// Pages
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import RidesPage from './pages/RidesPage';
import OfferRidePage from './pages/OfferRidePage';
import RideDetailsPage from './pages/RideDetailsPage';
import BookSeatPage from './pages/BookSeatPage';
import BookingDetailsPage from './pages/BookingDetailsPage';
import BookingsListPage from './pages/BookingsListPage';
import MatchPage from './pages/MatchPage';
import MatchPreferencesPage from './pages/MatchPreferencesPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import MatchSuccessPage from './pages/MatchSuccessPage';
import ChatConversationPage from './pages/ChatConversationPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import CreatePage from './pages/CreatePage';
import CommunityPage from './pages/CommunityPage';
import GetHelpPage from './pages/GetHelpPage';
import AboutPage from './pages/AboutPage';
import StaticInfoPage from './pages/StaticInfoPage';

// Token injector component
function TokenInjector() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
  return null;
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-navy rounded-2xl flex items-center justify-center">
            <span className="text-white font-black text-xl">H</span>
          </div>
          <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  if (!isSignedIn) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <TokenInjector />
      <Routes>
        {/* Public Landing & Authentication */}
        <Route path="/" element={<OnboardingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/login" element={<AuthPage initialMode="signIn" />} />
        <Route path="/signup" element={<AuthPage initialMode="signUp" />} />
        <Route path="/sign-in/*" element={<AuthPage initialMode="signIn" />} />
        <Route path="/sign-up/*" element={<AuthPage initialMode="signUp" />} />

        {/* Protected */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/rides" element={<ProtectedRoute><RidesPage /></ProtectedRoute>} />
        <Route path="/rides/offer" element={<ProtectedRoute><OfferRidePage /></ProtectedRoute>} />
        <Route path="/rides/request" element={<ProtectedRoute><OfferRidePage /></ProtectedRoute>} />
        <Route path="/rides/:id" element={<ProtectedRoute><RideDetailsPage /></ProtectedRoute>} />
        <Route path="/book/:id" element={<ProtectedRoute><BookSeatPage /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><BookingsListPage /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailsPage /></ProtectedRoute>} />
        <Route path="/match" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
        <Route path="/match/preferences" element={<ProtectedRoute><MatchPreferencesPage /></ProtectedRoute>} />
        <Route path="/match/success" element={<ProtectedRoute><MatchSuccessPage /></ProtectedRoute>} />
        <Route path="/match/:id" element={<ProtectedRoute><MatchDetailsPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
        <Route path="/chat/:id" element={<ProtectedRoute><ChatConversationPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />

        {/* Community, Help & About dedicated pages */}
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><GetHelpPage /></ProtectedRoute>} />
        <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
        <Route path="/saved" element={<ProtectedRoute><StaticInfoPage title="Saved Rides" subtitle="You haven't bookmarked any rides yet. Save frequent trips for quick booking!" icon="❤️" /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><StaticInfoPage title="Account Settings" subtitle="Manage notification preferences, privacy, verified student IDs, and security." icon="⚙️" /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><StaticInfoPage title="Help & Support" subtitle="Have questions or feedback? Our 24/7 campus support team is here to assist you." icon="💬" /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
