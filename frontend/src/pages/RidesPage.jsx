import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Filter, ArrowUpDown, MapPin, 
  Car, Calendar, Users, ShieldCheck, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { RideCard } from '../components/ui/RideCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { getTravels } from '../lib/api';

const TABS = ['All Matches', 'Matching Offers', 'Matching Requests'];
const SORT_OPTIONS = [
  { id: 'latest', label: 'Latest Posted' },
  { id: 'date_asc', label: 'Departure: Earliest' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'seats_desc', label: 'Most Seats Available' }
];

export default function RidesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'offers' || tabParam === 'Matching Offers') return 'Matching Offers';
    if (tabParam === 'requests' || tabParam === 'Matching Requests') return 'Matching Requests';
    return 'All Matches';
  });

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || searchParams.get('to') || '');
  const [sortBy, setSortBy] = useState('latest');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPostedTravel, setHasPostedTravel] = useState(true);
  const [activeRoutes, setActiveRoutes] = useState([]);

  // Sync activeTab when query param ?tab= changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'offers' || tabParam === 'Matching Offers') {
      setActiveTab('Matching Offers');
    } else if (tabParam === 'requests' || tabParam === 'Matching Requests') {
      setActiveTab('Matching Requests');
    } else if (tabParam === 'all' || tabParam === 'All Matches') {
      setActiveTab('All Matches');
    }
    const searchVal = searchParams.get('search') || searchParams.get('to');
    if (searchVal !== null && searchVal !== undefined) {
      setSearchQuery(searchVal);
    }
  }, [searchParams]);

  const fetchRides = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (activeTab === 'Matching Offers') params.type = 'offer';
      if (activeTab === 'Matching Requests') params.type = 'request';
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getTravels(params);
      const data = res.data?.data || res.data?.travels || res.data || [];
      setHasPostedTravel(res.data?.hasPostedTravel !== false);
      setActiveRoutes(res.data?.activeRoutes || []);
      setRides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Rides fetch error:', err);
      setError(err.message || 'Could not load rides. Please check your connection.');
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  // Client-side sorting
  const processedRides = useMemo(() => {
    let list = [...rides];

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'price_asc') {
        return (a.pricePerSeat || 350) - (b.pricePerSeat || 350);
      }
      if (sortBy === 'seats_desc') {
        const aSeats = typeof a.seats === 'number' ? (a.seats - (a.bookedSeats || 0)) : (a.availableSeats || 1);
        const bSeats = typeof b.seats === 'number' ? (b.seats - (b.bookedSeats || 0)) : (b.availableSeats || 1);
        return bSeats - aSeats;
      }
      if (sortBy === 'date_asc') {
        const dateA = a.travelDate ? new Date(a.travelDate).getTime() : 0;
        const dateB = b.travelDate ? new Date(b.travelDate).getTime() : 0;
        return dateA - dateB;
      }
      // default: latest
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return list;
  }, [rides, sortBy]);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Campus Rides" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* HERO BANNER SECTION (HelpU Design System)                                 */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 border border-[#F4E3D8] shadow-xs relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[11px] font-black text-[#FF572E] mb-3 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                Verified Campus Ride Sharing
              </span>
              <h1 className="font-black text-[#17233C] text-2xl sm:text-3xl lg:text-4xl tracking-tight leading-tight">
                Find or Share <span className="text-[#FF572E]">Campus Rides</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#596277] font-medium mt-2 leading-relaxed">
                Connect with verified college peers, split travel and cab expenses, and commute safely to railway stations, airports, or home.
              </p>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-5 py-3 rounded-2xl bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Offer a Ride</span>
              </button>
              <button
                onClick={() => navigate('/bookings')}
                className="px-5 py-3 rounded-2xl bg-white hover:bg-[#FFF7F2] text-[#17233C] font-black text-xs sm:text-sm border border-[#F4E3D8] flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <span>My Bookings</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* CONTROLS BAR: SEARCH, TABS, QUICK FILTERS & SORT                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8]/90 shadow-xs space-y-4">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Type Tabs: All | Offers | Requests */}
            <div className="inline-flex bg-[#FFFBF8] p-1 rounded-2xl border border-[#F4E3D8] shadow-2xs self-start">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#FF572E] text-white shadow-xs'
                      : 'text-[#6E7587] hover:text-[#17233C]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search Input Bar */}
            <div className="flex-1 max-w-md relative">
              <Search className="w-4 h-4 text-[#8C93A4] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route (e.g. Bhopal Station, Airport, VIT)..."
                className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-[#17233C] focus:outline-none focus:border-[#FF572E] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C93A4] hover:text-[#17233C]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <ArrowUpDown className="w-4 h-4 text-[#FF572E] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E] cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIDES LISTING GRID / LOADING / ERROR / EMPTY STATES                      */}
        {/* ========================================================================= */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <LoadingSkeleton count={6} />
            </div>
          ) : error ? (
            <div className="bg-white rounded-[26px] p-10 text-center border border-red-100 max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-[#17233C] text-base">Failed to Load Rides</h3>
              <p className="text-xs text-[#6E7587] leading-relaxed">{error}</p>
              <button
                onClick={fetchRides}
                className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Loading</span>
              </button>
            </div>
          ) : !hasPostedTravel ? (
            <div className="bg-white rounded-[32px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl shadow-inner">
                🎯
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-lg sm:text-xl">Smart Matching Campus Rides</h3>
                <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Helpu protects campus privacy by matching rides intelligently. You will only see verified peers traveling on your <strong>same route, direction, date, and schedule</strong>!
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => navigate('/rides/offer')}
                  className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Offer a Ride
                </button>
                <button
                  onClick={() => navigate('/bookings')}
                  className="px-6 py-2.5 bg-white hover:bg-[#FFF7F2] text-[#17233C] font-black text-xs sm:text-sm border border-[#F4E3D8] rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  My Bookings
                </button>
              </div>
            </div>
          ) : processedRides.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                🔍
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-lg">No Matching Rides Right Now</h3>
                <p className="text-xs text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                  {searchQuery
                    ? 'No rides match your active search keyword.'
                    : 'Currently no peers have posted a ride matching your exact route, direction, date, and schedule. As soon as someone posts, it will appear here!'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#6E7587] hover:bg-[#FFFBF8] border border-[#F4E3D8] cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
                <button
                  onClick={() => navigate('/rides/offer')}
                  className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Offer a Ride
                </button>
                <button
                  onClick={() => navigate('/bookings')}
                  className="px-5 py-2.5 bg-white hover:bg-[#FFF7F2] text-[#17233C] font-bold text-xs border border-[#F4E3D8] rounded-xl cursor-pointer"
                >
                  My Bookings
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeRoutes.length > 0 && (
                <div className="flex items-center gap-2 p-3 px-4 rounded-2xl bg-[#FFF6EE] border border-[#F4E3D8] text-xs font-bold text-[#FF572E]">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    Matching your active route:{' '}
                    <span className="text-[#17233C]">
                      {activeRoutes.map((r) => `${r.source} → ${r.destination}`).join(' | ')}
                    </span>
                  </span>
                </div>
              )}
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {processedRides.map((ride) => (
                  <RideCard
                    key={ride._id || ride.id}
                    travel={ride}
                    onPress={() => navigate(`/rides/${ride._id || ride.id}`)}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
