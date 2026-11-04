import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { 
  Car, Calendar, Clock, MapPin, Plus, 
  Eye, RefreshCw, AlertCircle, ArrowRight, Check,
  ChevronRight, MoreVertical, ShieldCheck, Sparkles, Filter
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[11px] font-black text-[#FF572E] uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                Student Mobility Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
              My Posts
            </h1>
            <p className="text-xs sm:text-sm text-[#6E7587] mt-0.5">
              All your published rides, together in one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh your posts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF572E]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => navigate('/rides/offer')}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-black rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
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
          <div className="flex items-center gap-1.5 min-w-max">
            {filterTabs.map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#17233C] text-white shadow-xs font-black'
                      : 'bg-transparent text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFFBF8]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
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
                className="bg-white rounded-[24px] p-5 border border-[#F4E3D8] animate-pulse space-y-4"
              >
                <div className="h-5 bg-gray-200 rounded-md w-1/4" />
                <div className="h-12 bg-gray-100 rounded-xl" />
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
              className="px-5 py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredTravels.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-[28px] p-8 sm:p-12 text-center border border-[#F4E3D8] max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
              <Car className="w-8 h-8 text-[#FF572E]" />
            </div>
            <div>
              <h3 className="font-black text-xl text-[#17233C]">
                {activeFilter === 'all' ? 'No posts yet!' : `No ${activeFilter} posts found`}
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                {activeFilter === 'all'
                  ? 'Your published offers and requests will appear here.'
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
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
                  className="bg-white rounded-[24px] border border-[#F4E3D8] p-5 shadow-xs hover:shadow-md hover:border-[#FF572E]/40 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3.5">
                    {/* Top Header: Badges & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Offer / Request Type Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isOffer
                              ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                              : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                          }`}
                        >
                          {isOffer ? 'Ride Offer' : 'Passenger Request'}
                        </span>

                        {/* Status Badge */}
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                            <span>Active</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                            Completed
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                            Cancelled
                          </span>
                        )}
                        {!isActive && !isCompleted && !isCancelled && isExpired && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                            Expired
                          </span>
                        )}
                      </div>

                      {/* Price per seat if offer */}
                      {isOffer && travel.pricePerSeat > 0 && (
                        <span className="text-[#FF572E] font-black text-sm font-mono">
                          ₹{travel.pricePerSeat}/seat
                        </span>
                      )}
                    </div>

                    {/* Route Typography */}
                    <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-[#17233C] text-sm sm:text-base">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                        <span className="truncate">{travel.source}</span>
                      </div>
                      <div className="pl-1 border-l-2 border-dashed border-[#F4E3D8] ml-1 my-0.5 py-0.5">
                        <span className="text-[10px] text-[#FF572E] font-bold">Direction</span>
                      </div>
                      <div className="flex items-center gap-2 font-black text-[#17233C] text-sm sm:text-base">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                        <span className="truncate">{travel.destination}</span>
                      </div>
                    </div>

                    {/* Schedule & Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#6E7587] pt-1 border-t border-[#F4E3D8]/60">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                        <span className="font-bold text-[#17233C]">
                          {formatTravelDate(travel.travelDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-[#6E7587] shrink-0" />
                        <span>{formatMinutesToTime(travel.departureTime)}</span>
                      </div>
                    </div>

                    {/* Seat & Vehicle Details */}
                    <div className="flex items-center justify-between text-xs text-[#6E7587] font-semibold pt-0.5">
                      <div>
                        {isOffer ? (
                          <span className="text-[#16A34A]">
                            🟢 <strong>{availableSeats}</strong> of {travel.seats} seats available
                          </span>
                        ) : (
                          <span className="text-[#FF572E]">
                            🟣 <strong>{travel.seats || 1}</strong> seat(s) requested
                          </span>
                        )}
                      </div>

                      {travel.createdAt && (
                        <span className="text-[11px] text-[#A0A6B5]">
                          Posted {formatCreatedDate(travel.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* Requests info badge if any */}
                    {travel.requestsCount > 0 && (
                      <div className="px-3 py-1.5 bg-[#FFF4ED] rounded-xl border border-[#FDE0D0] text-xs font-bold text-[#17233C] flex items-center justify-between">
                        <span>Requests Received:</span>
                        <span className="text-[#FF572E] font-black">
                          {travel.requestsCount} ({travel.pendingRequestsCount || 0} pending)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-3 border-t border-[#F4E3D8]/70">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => navigate(`/rides/${travel._id}`)}
                      className="w-full py-2.5 px-4 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] hover:text-[#FF572E] font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#6E7587]" />
                      <span>View Details</span>
                    </button>
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

