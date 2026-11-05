import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Car, Calendar, Clock, MapPin, Plus, 
  Eye, RefreshCw, AlertCircle, ArrowRight, Check,
  ChevronRight, MoreVertical, ShieldCheck, Sparkles, Filter,
  Users, IndianRupee, Inbox, CheckCircle2, Ticket
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { getMyTravels } from '../lib/api';

/**
 * Format minutes from midnight into 12-hour AM/PM format
 */
function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format date string nicely (e.g. Thu, 6 Nov 2026)
 */
function formatTravelDate(dateStr) {
  if (!dateStr) return 'Upcoming';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Upcoming';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format created date relative or short
 */
function formatCreatedDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

export default function MyPostsPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [travels, setTravels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'offers' | 'requests' | 'active' | 'completed' | 'cancelled'

  // Fetch logged-in user's own published travel posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyTravels();
      const list = res?.data?.data || [];
      setTravels(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error fetching my travel posts:', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load your posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Compute counts for filters
  const counts = useMemo(() => {
    const now = new Date();
    return {
      all: travels.length,
      offers: travels.filter((t) => t.type === 'offer').length,
      requests: travels.filter((t) => t.type === 'request').length,
      active: travels.filter((t) => t.status === 'active' && new Date(t.expiresAt) > now).length,
      completed: travels.filter((t) => t.status === 'completed').length,
      cancelled: travels.filter((t) => t.status === 'cancelled').length,
    };
  }, [travels]);

  // Filtered travels list
  const filteredTravels = useMemo(() => {
    const now = new Date();
    return travels.filter((t) => {
      if (activeFilter === 'offers') return t.type === 'offer';
      if (activeFilter === 'requests') return t.type === 'request';
      if (activeFilter === 'active') return t.status === 'active' && new Date(t.expiresAt) > now;
      if (activeFilter === 'completed') return t.status === 'completed';
      if (activeFilter === 'cancelled') return t.status === 'cancelled';
      return true; // 'all'
    });
  }, [travels, activeFilter]);

  const filterTabs = [
    { id: 'all', label: 'All Posts', count: counts.all },
    { id: 'offers', label: 'Offers', count: counts.offers },
    { id: 'requests', label: 'Requests', count: counts.requests },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Posts" backTo="/home" />}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
        
        {/* ========================================================================= */}
        {/* PAGE HEADER & PRIMARY ACTION                                              */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[32px] p-6 sm:p-7 border border-[#F4E3D8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[11px] font-black text-[#FF572E] uppercase tracking-wider mb-2.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Mobility Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#17233C] tracking-tight leading-tight">
              My <span className="text-[#FF572E]">Posts</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1.5 leading-relaxed">
              Track your published ride offers, passenger travel requests, and manage passenger bookings.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="w-11 h-11 rounded-2xl bg-white border border-[#F4E3D8] text-[#17233C] hover:text-[#FF572E] hover:bg-[#FFF7F2] flex items-center justify-center shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh your posts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FF572E]' : ''}`} />
            </button>

            <button
              onClick={() => navigate('/rides/offer')}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-2xl shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create New Post</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FILTER BAR                                                                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-[#F4E3D8]/90 shadow-2xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {filterTabs.map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#17233C] text-white shadow-xs font-black'
                      : 'bg-transparent text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFFBF8]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#FFF4ED] text-[#FF572E]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* POSTS LISTING / LOADING / ERROR / EMPTY STATES                            */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8] animate-pulse space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-gray-200 rounded-md w-1/4" />
                  <div className="h-5 bg-gray-200 rounded-md w-1/6" />
                </div>
                <div className="h-16 bg-gray-100 rounded-2xl" />
                <div className="h-8 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-[28px] p-8 text-center border border-red-200 max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-[#17233C]">Unable to Load Posts</h3>
              <p className="text-xs text-red-600 mt-1 max-w-sm mx-auto">{error}</p>
            </div>
            <button
              onClick={fetchPosts}
              className="px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredTravels.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-[28px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl shadow-2xs">
              <Car className="w-8 h-8 text-[#FF572E]" />
            </div>
            <div>
              <h3 className="font-black text-xl text-[#17233C]">
                {activeFilter === 'all' ? 'No posts yet!' : `No ${activeFilter} posts found`}
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                {activeFilter === 'all'
                  ? 'Your published ride offers and requests will appear here.'
                  : `You currently have no ${activeFilter} rides in this category.`}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Your First Post</span>
              </button>
            </div>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {filteredTravels.map((travel) => {
              const isOffer = travel.type === 'offer';
              const booked = travel.bookedSeats || 0;
              const availableSeats = Math.max(0, (travel.seats || 1) - booked);
              const now = new Date();
              const isExpired = new Date(travel.expiresAt) <= now;
              const isActive = travel.status === 'active' && !isExpired;
              const isCompleted = travel.status === 'completed';
              const isCancelled = travel.status === 'cancelled';

              return (
                <motion.div
                  key={travel._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[26px] border border-[#F4E3D8] p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#FF572E]/40 transition-all duration-300 flex flex-col justify-between gap-4.5 group"
                >
                  <div className="space-y-4">
                    
                    {/* Top Row: Student Profile, Verification Badge, Campus & Type Badge */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          avatarId={travel.authorAvatar || 'm1'}
                          src={user?.imageUrl}
                          name={user?.fullName || travel.authorName}
                          size="md"
                          ring
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm sm:text-base text-[#17233C] truncate leading-tight">
                            {user?.fullName || travel.authorName || 'Campus Student'}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#16A34A] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                            <span className="truncate">{travel.college || 'VIT, Bhopal'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Type Badge & Active Status */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isOffer
                            ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                            : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                        }`}>
                          {isOffer ? 'Ride Offer' : 'Passenger Request'}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" title="Active" />
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#475569]">
                            Done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Highlighted Co-Travel or Request Information Strip */}
                    <div className="px-3.5 py-2 bg-[#FFF4ED] rounded-xl text-xs font-bold text-[#FF572E] border border-[#FDE0D0] flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">🎯</span>
                        <span className="truncate">
                          {isOffer
                            ? `Co-travel offer on your route (${travel.source} → ${travel.destination})`
                            : `Passenger travel request (${travel.source} → ${travel.destination})`}
                        </span>
                      </div>
                      {travel.requestsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-white text-[#FF572E] text-[10px] font-black border border-[#FDE0D0] shrink-0">
                          {travel.requestsCount} {travel.requestsCount === 1 ? 'Request' : 'Requests'}
                        </span>
                      )}
                    </div>

                    {/* Pickup & Drop Section with Centered Arrow & Compact Schedule Info */}
                    <div className="bg-[#FFFBF8] rounded-2xl p-3.5 sm:p-4 border border-[#F4E3D8]/80 space-y-3">
                      {/* Pickup & Drop with Route Arrow */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Pickup */}
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block mb-1">
                            Pickup
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                            <span className="font-extrabold text-[#17233C] text-sm sm:text-base truncate capitalize" title={travel.source}>
                              {travel.source}
                            </span>
                          </div>
                        </div>

                        {/* Centered Route Arrow */}
                        <div className="flex flex-col items-center justify-center shrink-0 px-2">
                          <div className="w-8 h-8 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] flex items-center justify-center shadow-2xs group-hover:scale-105 group-hover:border-[#FF572E]/40 transition-all">
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        </div>

                        {/* Drop */}
                        <div className="min-w-0 flex-1 text-right">
                          <span className="text-[10px] font-black text-[#8C93A4] uppercase tracking-wider block mb-1">
                            Drop
                          </span>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-extrabold text-[#17233C] text-sm sm:text-base truncate capitalize" title={travel.destination}>
                              {travel.destination}
                            </span>
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                          </div>
                        </div>
                      </div>

                      {/* Divider & Date/Time/Seats Row */}
                      <div className="border-t border-[#F4E3D8]/60 pt-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#6E7587] min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                          <span className="truncate">
                            {formatTravelDate(travel.travelDate)} • {formatMinutesToTime(travel.departureTime) || 'Flexible'}
                          </span>
                        </div>

                        <div className={`font-bold shrink-0 text-xs ${isOffer ? 'text-[#16A34A]' : 'text-[#FF572E]'}`}>
                          {isOffer ? `${availableSeats} seat(s) left` : `${travel.seats || 1} seat(s) needed`}
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Information & Price Row */}
                    <div className="flex items-center justify-between text-xs px-1 font-semibold text-[#6E7587]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Car className="w-4 h-4 text-[#8C93A4] shrink-0" />
                        <span className="truncate">{travel.carModel || (isOffer ? 'Campus Carpool' : 'Passenger Request')}</span>
                      </div>

                      {isOffer && (
                        <div className="text-right shrink-0">
                          <span className="text-[#FF572E] font-black text-base sm:text-lg font-mono">
                            ₹{travel.pricePerSeat || 350}
                          </span>
                          <span className="text-xs text-[#8C93A4] font-medium font-sans">/seat</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row: View Details and Book Seat (Where applicable) */}
                  <div className="pt-3 border-t border-[#F4E3D8]/70 flex items-center gap-2.5">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => navigate(`/rides/${travel._id}`)}
                      className="flex-1 py-2.5 px-4 bg-[#FFFBF8] hover:bg-[#FFF4ED] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] font-bold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8C93A4]" />
                      <span>View Details</span>
                    </button>

                    {/* Book Seat / Review Requests */}
                    {isOffer ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (travel.pendingRequestsCount > 0) {
                            navigate('/bookings?tab=received');
                          } else {
                            navigate(`/rides/${travel._id}`);
                          }
                        }}
                        className="flex-1 py-2.5 px-4 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>{travel.pendingRequestsCount > 0 ? `Review (${travel.pendingRequestsCount})` : 'Book Seat'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/rides/${travel._id}`)}
                        className="flex-1 py-2.5 px-4 bg-[#17233C] hover:bg-[#233252] text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>View Request</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </ResponsiveShell>
  );
}

