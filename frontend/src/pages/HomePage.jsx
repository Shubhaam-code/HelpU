import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { Search } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { SearchBar } from '../components/ui/SearchBar';
import { ActionWidget } from '../components/ui/ActionWidget';
import { BookingCard } from '../components/ui/BookingCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { CampusHeroIllustration } from '../components/ui/CampusHeroIllustration';

// Desktop Widgets
import { SmartMatchWidget } from '../components/dashboard/SmartMatchWidget';
import { AvailableRidesWidget } from '../components/dashboard/AvailableRidesWidget';
import { 
  MatchActivityWidget, 
  UpcomingBookingWidget, 
  CommunityActivityWidget, 
  TravelMatchPromoWidget 
} from '../components/dashboard/RightSidebarWidgets';

import { getProfile, getMyBookings, getUnreadCount, getTravels } from '../lib/api';

// "Going Home?" promo card for Mobile
function MobilePromoCard({ onClick }) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="bg-peach rounded-2xl p-4 flex items-center justify-between cursor-pointer overflow-hidden relative"
    >
      <div className="z-10">
        <div className="text-lg mb-1">🏠</div>
        <div className="font-bold text-navy text-base">Going Home?</div>
        <div className="text-text-secondary text-xs mt-1">
          Share a ride. Save cost.<br />Travel together.
        </div>
      </div>
      <div className="text-6xl">🚕</div>
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [rides, setRides] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [searchVal, setSearchVal] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, bookingsRes, notifRes, travelsRes] = await Promise.allSettled([
        getProfile(),
        getMyBookings(),
        getUnreadCount(),
        getTravels({ limit: 4 })
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data?.data);
      }
      if (bookingsRes.status === 'fulfilled') {
        setBookings(bookingsRes.value.data?.data?.slice(0, 3) || []);
      }
      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.data?.data?.count || 0);
      }
      if (travelsRes.status === 'fulfilled') {
        setRides(travelsRes.value.data?.data || travelsRes.value.data?.travels || []);
      }
    } catch (err) {
      console.error('Home data fetch error:', err);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const firstName = profile?.name?.split(' ')[0] || user?.firstName || 'Student';

  // Mobile action widgets (4 items)
  const mobileActions = [
    { icon: '🚗', title: 'Offer a Ride', subtitle: 'Share your journey', color: 'peach', path: '/rides/offer' },
    { icon: '📍', title: 'Request a Ride', subtitle: 'Find a ride easily', color: 'lavender', path: '/rides/request' },
    { icon: '🤝', title: 'Find a Match', subtitle: 'Get travel buddies', color: 'mint', path: '/match' },
    { icon: '🔧', title: 'Get Help', subtitle: 'Campus services', color: 'sky', path: '/help' },
  ];

  // Desktop action widgets (5 items matching Desktop reference image)
  const desktopActions = [
    { icon: '🚗', title: 'Offer a Ride', subtitle: 'Share your journey', color: 'peach', path: '/rides/offer' },
    { icon: '📍', title: 'Request a Ride', subtitle: 'Find a ride easily', color: 'lavender', path: '/rides/request' },
    { icon: '👥', title: 'Find a Match', subtitle: 'Get the best travel buddy', color: 'match', path: '/match' },
    { icon: '🔧', title: 'Get Help', subtitle: 'Campus services', color: 'mint', path: '/help' },
    { icon: '👥', title: 'Community', subtitle: 'Meet & connect', color: 'sky', path: '/community' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  return (
    <ResponsiveShell 
      avatarId={profile?.avatarId} 
      unreadCount={unreadCount}
      customMobileHeader={
        <AppHeader
          avatarId={profile?.avatarId}
          onBell={() => navigate('/notifications')}
          unreadCount={unreadCount}
        />
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        
        {/* ========================================================================= */}
        {/* DESKTOP & TABLET VIEW (md: and up) - Following Desktop Reference exactly   */}
        {/* ========================================================================= */}
        <div className="hidden md:block">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Center / Main Column (8 cols on XL, full on MD/LG) */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* 1. Welcome Hero Banner matching reference image */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100/80 relative overflow-hidden flex flex-col md:flex-row items-center justify-between"
              >
                <div className="z-10 py-2">
                  <h1 className="font-black text-navy text-3xl lg:text-4xl tracking-tight leading-tight">
                    Hey {firstName}! 👋
                  </h1>
                  <p className="text-text-secondary text-sm lg:text-base mt-2 font-medium">
                    How can we help you today?
                  </p>
                </div>

                {/* Campus Art Illustration */}
                <div className="w-full md:w-80 lg:w-96 shrink-0 mt-4 md:mt-0">
                  <CampusHeroIllustration />
                </div>
              </motion.div>

              {/* 2. Full-width Rounded Search Bar */}
              <form onSubmit={handleSearch} className="relative w-full">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search rides, people, or places..."
                  className="w-full bg-white rounded-full py-4 pl-14 pr-6 text-sm font-medium text-navy placeholder:text-text-secondary border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/30 transition-all"
                />
              </form>

              {/* 3. Five Action Widgets in a Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {desktopActions.map((action) => (
                  <ActionWidget
                    key={action.title}
                    icon={action.icon}
                    title={action.title}
                    subtitle={action.subtitle}
                    color={action.color}
                    onClick={() => navigate(action.path)}
                  />
                ))}
              </div>

              {/* 4. Two-Column Row: Smart Match + Available Rides Near You */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <SmartMatchWidget />
                <AvailableRidesWidget rides={rides} />
              </div>

              {/* On tablet (< xl), show the right sidebar widgets stacked below */}
              <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <MatchActivityWidget />
                <UpcomingBookingWidget booking={bookings[0]} />
                <CommunityActivityWidget />
                <TravelMatchPromoWidget />
              </div>

            </div>

            {/* Right Column on Desktop (4 cols on XL) */}
            <div className="hidden xl:block xl:col-span-4 space-y-5 sticky top-[80px]">
              <MatchActivityWidget />
              <UpcomingBookingWidget booking={bookings[0]} />
              <CommunityActivityWidget />
              <TravelMatchPromoWidget />
            </div>

          </div>
        </div>


        {/* ========================================================================= */}
        {/* MOBILE VIEW (< md) - Preserves Mobile Reference 1 & 2 layout exactly     */}
        {/* ========================================================================= */}
        <div className="md:hidden space-y-5 pb-8">
          
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-black text-navy text-2xl">
              Hey {firstName} 👋
            </h1>
            <p className="text-text-secondary text-sm">How can we help you today?</p>
          </motion.div>

          {/* Search */}
          <SearchBar />

          {/* 2x2 Action grid */}
          <div className="grid grid-cols-2 gap-3">
            {mobileActions.map((a) => (
              <ActionWidget
                key={a.path}
                icon={a.icon}
                title={a.title}
                subtitle={a.subtitle}
                color={a.color}
                arrow={false}
                onClick={() => navigate(a.path)}
              />
            ))}
          </div>

          {/* Going Home promo */}
          <MobilePromoCard onClick={() => navigate('/rides')} />

          {/* Upcoming Bookings */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-navy text-lg">Upcoming Bookings</h2>
              <button
                onClick={() => navigate('/bookings')}
                className="text-coral font-semibold text-sm cursor-pointer"
              >
                View All
              </button>
            </div>

            {loadingBookings ? (
              <LoadingSkeleton count={2} />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon="🎫"
                title="No upcoming bookings"
                subtitle="Book a ride and it'll appear here."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((b) => (
                  <BookingCard
                    key={b._id}
                    booking={b}
                    onPress={() => navigate(`/bookings/${b._id}`)}
                  />
                ))}
              </div>
            )}
          </section>

        </div>

      </div>
    </ResponsiveShell>
  );
}
