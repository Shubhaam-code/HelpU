import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Car, Calendar, Clock, MapPin, Plus, 
  Eye, RefreshCw, AlertCircle, ArrowRight, Check,
  ChevronRight, MoreVertical, ShieldCheck, Sparkles, Filter,
  Users, IndianRupee, Inbox, CheckCircle2, Ticket, Trash2, Pencil, X,
  AlertTriangle, CheckCheck, Ban
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { DatePickerModal } from '../components/ui/DatePickerModal';
import { TimePickerModal } from '../components/ui/TimePickerModal';
import { getMyTravels, updateTravel, deleteTravel, cancelTravel } from '../lib/api';
import { useMyTravels } from '../hooks/useAppData';
import { invalidateRideQueries } from '../lib/queryClient';

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
 * Convert minutes from midnight to HH:MM for HTML time input
 */
function minutesToTimeString(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '08:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert HH:MM time string from HTML input to minutes from midnight
 */
function timeStringToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 480;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + (m || 0);
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

export default function MyPostsPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  // TanStack Query cached travel posts (Instant navigation, 0ms return visits, zero full-page spinners)
  const { 
    data: cachedTravels = [], 
    isLoading: travelsLoading, 
    isFetching: isRefreshingTravels, 
    error: queryError, 
    refetch: refetchTravels 
  } = useMyTravels();

  const [travels, setTravels] = useState([]);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'expired' | 'completed' | 'cancelled' | 'offers' | 'requests'

  // Keep local travels in sync with TanStack Query cached list
  useEffect(() => {
    if (cachedTravels) {
      setTravels(cachedTravels);
    }
  }, [cachedTravels]);

  // Loading skeleton only on initial visit when memory cache is empty
  const loading = travelsLoading && travels.length === 0;

  // Post cancellation states
  const [postToCancel, setPostToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Post deletion states
  const [postToDelete, setPostToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null); // { type: 'success' | 'error', text: '' }

  // Auto-dismiss feedback message after 4.5 seconds
  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = setTimeout(() => {
      setFeedbackMsg(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  // Handle ride cancellation confirmation
  const handleConfirmCancel = async () => {
    if (!postToCancel) return;
    setIsCancelling(true);
    try {
      await cancelTravel(postToCancel._id);
      setTravels((prev) =>
        prev.map((t) => (t._id === postToCancel._id ? { ...t, status: 'cancelled' } : t))
      );
      invalidateRideQueries();
      setFeedbackMsg({
        type: 'success',
        text: 'Ride cancelled successfully. All passenger bookings were cancelled and passengers notified.'
      });
      setPostToCancel(null);
    } catch (err) {
      console.error('Failed to cancel ride:', err);
      setFeedbackMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to cancel ride. Please try again.'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle post deletion confirmation
  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    const targetId = postToDelete._id;
    setIsDeleting(true);
    try {
      await deleteTravel(targetId);
      // Immediately remove from UI list
      setTravels((prev) => prev.filter((t) => t._id !== targetId));
      invalidateRideQueries();
      setFeedbackMsg({
        type: 'success',
        text: 'Post deleted successfully!'
      });
      setPostToDelete(null);
    } catch (err) {
      console.error('Failed to delete post:', err);
      // If 404, the post is already removed from MongoDB. Safely update UI.
      const is404 = err?.status === 404 || err?.response?.status === 404 || err?.message?.includes('404');
      if (is404) {
        setTravels((prev) => prev.filter((t) => t._id !== targetId));
        invalidateRideQueries();
        setFeedbackMsg({
          type: 'success',
          text: 'Post removed from your list.'
        });
        setPostToDelete(null);
      } else {
        setFeedbackMsg({
          type: 'error',
          text: err?.response?.data?.message || err?.message || 'Failed to delete post. Please try again.'
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Post editing states
  const [postToEdit, setPostToEdit] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editFormData, setEditFormData] = useState({
    source: '',
    destination: '',
    travelDate: '',
    timeStr: '08:00',
    departureTime: 480,
    timeFlexibility: 30,
    seats: 1,
    pricePerSeat: 350,
    carModel: '',
    status: 'active',
    bookedSeats: 0,
    type: 'offer'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Open edit modal with pre-filled ride data
  const openEditModal = (travel) => {
    const now = new Date();
    const isExpired = travel.status === 'expired' || (travel.status === 'active' && new Date(travel.expiresAt) <= now);
    if (travel.status === 'cancelled' || travel.status === 'completed' || isExpired) {
      alert(`Cannot edit a ride that is ${travel.status === 'cancelled' ? 'cancelled' : travel.status === 'completed' ? 'completed' : 'expired'}.`);
      return;
    }

    const dateFormatted = travel.travelDate
      ? new Date(travel.travelDate).toISOString().split('T')[0]
      : '';
    const timeStr = minutesToTimeString(travel.departureTime);
    setEditFormData({
      source: travel.source || '',
      destination: travel.destination || '',
      travelDate: dateFormatted,
      timeStr,
      departureTime: travel.departureTime || 480,
      timeFlexibility: travel.timeFlexibility || 30,
      seats: travel.seats || 1,
      pricePerSeat: travel.pricePerSeat ?? 350,
      carModel: travel.carModel || '',
      status: travel.status || 'active',
      bookedSeats: travel.bookedSeats || 0,
      type: travel.type || 'offer'
    });
    setEditError('');
    setPostToEdit(travel);
  };

  // Submit and save updated ride details to MongoDB
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!postToEdit) return;
    setIsSavingEdit(true);
    setEditError('');

    const departureMinutes = timeStringToMinutes(editFormData.timeStr);

    try {
      const payload = {
        source: editFormData.source.trim(),
        destination: editFormData.destination.trim(),
        travelDate: editFormData.travelDate,
        departureTime: departureMinutes,
        timeFlexibility: Number(editFormData.timeFlexibility) || 30,
        seats: Number(editFormData.seats) || 1,
        pricePerSeat: Number(editFormData.pricePerSeat) || 0,
        carModel: editFormData.carModel.trim(),
        status: editFormData.status
      };

      const res = await updateTravel(postToEdit._id, payload);
      const updated = res?.data?.data || { ...postToEdit, ...payload };

      // Immediately update the UI without requiring page refresh
      setTravels((prev) => prev.map((t) => (t._id === postToEdit._id ? { ...t, ...updated } : t)));
      invalidateRideQueries();

      setFeedbackMsg({
        type: 'success',
        text: 'Post updated successfully!'
      });
      setPostToEdit(null);
    } catch (err) {
      console.error('Failed to update post:', err);
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update post. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Manual refresh handler delegating to TanStack Query
  const fetchPosts = useCallback(async () => {
    setError(null);
    try {
      await refetchTravels();
    } catch (err) {
      console.error('Error fetching my travel posts:', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load your posts.');
    }
  }, [refetchTravels]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Compute counts for all lifecycle filters
  const counts = useMemo(() => {
    const now = new Date();
    const isRideExpired = (t) => t.status === 'expired' || (t.status === 'active' && new Date(t.expiresAt) <= now);
    return {
      all: travels.length,
      active: travels.filter((t) => t.status === 'active' && !isRideExpired(t)).length,
      expired: travels.filter(isRideExpired).length,
      completed: travels.filter((t) => t.status === 'completed').length,
      cancelled: travels.filter((t) => t.status === 'cancelled').length,
      offers: travels.filter((t) => t.type === 'offer').length,
      requests: travels.filter((t) => t.type === 'request').length,
    };
  }, [travels]);

  // Filtered travels list
  const filteredTravels = useMemo(() => {
    const now = new Date();
    const isRideExpired = (t) => t.status === 'expired' || (t.status === 'active' && new Date(t.expiresAt) <= now);

    return travels.filter((t) => {
      if (activeFilter === 'active') return t.status === 'active' && !isRideExpired(t);
      if (activeFilter === 'expired') return isRideExpired(t);
      if (activeFilter === 'completed') return t.status === 'completed';
      if (activeFilter === 'cancelled') return t.status === 'cancelled';
      if (activeFilter === 'offers') return t.type === 'offer';
      if (activeFilter === 'requests') return t.type === 'request';
      return true; // 'all'
    });
  }, [travels, activeFilter]);

  const filterTabs = [
    { id: 'all', label: 'All Rides', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'expired', label: 'Expired', count: counts.expired },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'offers', label: 'Offers', count: counts.offers },
    { id: 'requests', label: 'Requests', count: counts.requests },
  ];

  // Helper to render consistent status badge
  const renderRideStatusBadge = (travel) => {
    const now = new Date();
    const isExpired = travel.status === 'expired' || (travel.status === 'active' && new Date(travel.expiresAt) <= now);

    if (travel.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
          <Ban className="w-3 h-3" />
          Cancelled
        </span>
      );
    }
    if (travel.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-200">
          <CheckCheck className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }
    // Active
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="My Posts & Rides" backTo="/home" />}
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
              My <span className="text-[#FF572E]">Rides &amp; Posts</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1.5 leading-relaxed">
              Track your published ride offers, travel requests, manage bookings, and review historical rides.
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

        {/* Feedback Alert (Success / Error) */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold border shadow-xs ${
                feedbackMsg.type === 'success'
                  ? 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                className="text-[#6E7587] hover:text-[#17233C] text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                {activeFilter === 'all' ? 'No rides yet!' : `No ${activeFilter} rides found`}
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7587] mt-1.5 max-w-sm mx-auto leading-relaxed">
                {activeFilter === 'all'
                  ? 'Your published ride offers and requests will appear here.'
                  : `You currently have no rides in the ${activeFilter} category.`}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#FF572E]/20 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create a Ride</span>
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
              const isExpired = travel.status === 'expired' || (travel.status === 'active' && new Date(travel.expiresAt) <= now);
              const isActive = travel.status === 'active' && !isExpired;
              const isCompleted = travel.status === 'completed';
              const isCancelled = travel.status === 'cancelled';

              return (
                <motion.div
                  key={travel._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-[26px] border p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4.5 group ${
                    isActive 
                      ? 'border-[#F4E3D8] hover:border-[#FF572E]/40' 
                      : isCancelled
                      ? 'border-rose-200 bg-rose-50/15'
                      : isCompleted
                      ? 'border-blue-200 bg-blue-50/15'
                      : 'border-amber-200 bg-amber-50/15'
                  }`}
                >
                  <div className="space-y-4">
                    
                    {/* Top Row: Student Profile, Type Badge, Lifecycle Status */}
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

                      {/* Type Badge & Lifecycle Status Badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isOffer
                            ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                            : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                        }`}>
                          {isOffer ? 'Offer' : 'Request'}
                        </span>

                        {renderRideStatusBadge(travel)}

                        {/* Delete Post Button (Owner only) */}
                        {(!travel.userId || travel.userId === user?.id) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPostToDelete(travel);
                            }}
                            className="w-7 h-7 rounded-full bg-[#FFF4ED] hover:bg-red-50 text-[#8C93A4] hover:text-red-500 border border-[#FDE0D0] hover:border-red-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs group/del ml-0.5"
                            title="Delete this post"
                            aria-label="Delete this post"
                          >
                            <Trash2 className="w-3.5 h-3.5 group-hover/del:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Highlighted Booking Info Strip */}
                    <div className="px-3.5 py-2 bg-[#FFF4ED] rounded-xl text-xs font-bold text-[#FF572E] border border-[#FDE0D0] flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">🎯</span>
                        <span className="truncate">
                          {isOffer
                            ? `Offer: ${travel.source} → ${travel.destination}`
                            : `Request: ${travel.source} → ${travel.destination}`}
                        </span>
                      </div>
                      {travel.requestsCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate('/bookings?tab=received')}
                          className="px-2 py-0.5 rounded-full bg-white text-[#FF572E] hover:bg-[#FF572E] hover:text-white text-[10px] font-black border border-[#FDE0D0] shrink-0 transition-colors cursor-pointer"
                          title="View received passenger bookings"
                        >
                          {travel.requestsCount} {travel.requestsCount === 1 ? 'Booking' : 'Bookings'}
                          {travel.acceptedRequestsCount > 0 ? ` (${travel.acceptedRequestsCount} Confirmed)` : ''}
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#8C93A4] font-semibold shrink-0">
                          0 Bookings
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

                  {/* Actions Row: View Details, Edit Post, Cancel Ride */}
                  <div className="pt-3 border-t border-[#F4E3D8]/70 flex items-center gap-2">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => navigate(`/rides/${travel._id}`)}
                      className="flex-1 py-2.5 px-3 bg-[#FFFBF8] hover:bg-[#FFF4ED] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] font-bold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8C93A4]" />
                      <span className="truncate">Details</span>
                    </button>

                    {/* Edit Post (Only enabled if active & unexpired) */}
                    {(!travel.userId || travel.userId === user?.id) && isActive && (
                      <button
                        type="button"
                        onClick={() => openEditModal(travel)}
                        className="flex-1 py-2.5 px-3 bg-[#FFF4ED] hover:bg-[#FFE8DC] border border-[#FDE0D0] hover:border-[#FF572E]/50 text-[#FF572E] font-black text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Edit Post"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="truncate">Edit</span>
                      </button>
                    )}

                    {/* Cancel Ride Button (Only enabled if active & unexpired) */}
                    {(!travel.userId || travel.userId === user?.id) && isActive && (
                      <button
                        type="button"
                        onClick={() => setPostToCancel(travel)}
                        className="flex-1 py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Cancel this ride"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span className="truncate">Cancel Ride</span>
                      </button>
                    )}

                    {/* If Expired, Completed, or Cancelled: Show status badge indicator instead of action */}
                    {!isActive && (
                      <div className="flex-1 py-2 px-3 bg-gray-50 border border-gray-200 text-[#8C93A4] font-bold text-xs rounded-xl flex items-center justify-center gap-1">
                        <span>{isExpired ? 'Ride Expired' : isCompleted ? 'Completed' : 'Cancelled'}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* EDIT POST MODAL                                                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {postToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[28px] border border-[#F4E3D8] shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] flex items-center justify-center">
                    <Pencil className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#17233C] leading-snug">
                      Edit Travel Post
                    </h3>
                    <p className="text-xs text-[#8C93A4] font-semibold">
                      {editFormData.type === 'offer' ? 'Ride Offer' : 'Passenger Request'} • Updates saved to MongoDB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPostToEdit(null)}
                  className="w-8 h-8 rounded-full bg-[#FFFBF8] hover:bg-gray-100 text-[#8C93A4] hover:text-[#17233C] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Alert in Modal */}
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Notice if bookings exist */}
              {editFormData.bookedSeats > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                  <strong>Notice:</strong> This ride has {editFormData.bookedSeats} confirmed booked seat(s). Route &amp; date are protected. Total seats cannot be less than {editFormData.bookedSeats}.
                </div>
              )}

              {/* Edit Form */}
              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Route Inputs (Source & Destination) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      Pickup Location
                    </label>
                    <input
                      type="text"
                      required
                      disabled={editFormData.bookedSeats > 0}
                      value={editFormData.source}
                      onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                      placeholder="e.g. VIT Bhopal"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      Drop Location
                    </label>
                    <input
                      type="text"
                      required
                      disabled={editFormData.bookedSeats > 0}
                      value={editFormData.destination}
                      onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                      placeholder="e.g. Bhopal Station"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      Travel Date
                    </label>
                    <div
                      onClick={() => {
                        if (editFormData.bookedSeats === 0) {
                          setShowEditDatePicker(true);
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] flex items-center justify-between ${
                        editFormData.bookedSeats > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'cursor-pointer hover:border-[#FF572E]'
                      }`}
                    >
                      <span>{editFormData.travelDate ? formatTravelDate(editFormData.travelDate) : 'Select Date'}</span>
                      <Calendar className="w-4 h-4 text-[#FF572E]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      Departure Time
                    </label>
                    <div
                      onClick={() => setShowEditTimePicker(true)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] flex items-center justify-between cursor-pointer hover:border-[#FF572E]"
                    >
                      <span>{editFormData.timeStr ? formatMinutesToTime(timeStringToMinutes(editFormData.timeStr)) : 'Select Time'}</span>
                      <Clock className="w-4 h-4 text-[#FF572E]" />
                    </div>
                  </div>
                </div>

                {/* Seats & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      {editFormData.type === 'offer' ? 'Total Available Seats' : 'Seats Needed'}
                    </label>
                    <input
                      type="number"
                      required
                      min={editFormData.bookedSeats || 1}
                      max={8}
                      value={editFormData.seats}
                      onChange={(e) => setEditFormData({ ...editFormData, seats: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                    />
                  </div>

                  {editFormData.type === 'offer' ? (
                    <div>
                      <label className="block text-xs font-black text-[#17233C] mb-1">
                        Price Per Seat (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editFormData.pricePerSeat}
                        onChange={(e) => setEditFormData({ ...editFormData, pricePerSeat: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                      />
                    </div>
                  ) : null}
                </div>

                {/* Vehicle Model (for Offer) */}
                {editFormData.type === 'offer' && (
                  <div>
                    <label className="block text-xs font-black text-[#17233C] mb-1">
                      Vehicle / Model
                    </label>
                    <input
                      type="text"
                      value={editFormData.carModel}
                      onChange={(e) => setEditFormData({ ...editFormData, carModel: e.target.value })}
                      placeholder="e.g. Creta, Omni, Swift"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                    />
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-[#F4E3D8]/80">
                  <button
                    type="button"
                    disabled={isSavingEdit}
                    onClick={() => setPostToEdit(null)}
                    className="flex-1 py-3 px-4 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs transition-all shadow-md shadow-[#FF572E]/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CANCEL RIDE CONFIRMATION MODAL                                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {postToCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[28px] border border-[#F4E3D8] shadow-2xl max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                  <Ban className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-[#17233C] leading-snug">
                    Cancel Ride?
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1 leading-relaxed">
                    Are you sure you want to cancel this ride? All confirmed and pending bookings for this ride will be cancelled, and affected passengers will be notified.
                  </p>
                </div>
              </div>

              {/* Route Summary Box */}
              <div className="bg-[#FFF8F4] border border-[#FDE0D0] rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-black text-[#17233C]">
                  <span className="capitalize">{postToCancel.source}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E] stroke-[2.5]" />
                  <span className="capitalize">{postToCancel.destination}</span>
                </div>
                <div className="text-[11px] text-[#8C93A4] flex items-center gap-2 font-semibold">
                  <span>{formatTravelDate(postToCancel.travelDate)}</span>
                  <span>•</span>
                  <span>{postToCancel.type === 'offer' ? 'Ride Offer' : 'Passenger Request'}</span>
                  {postToCancel.bookedSeats > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-[#FF572E] font-bold">{postToCancel.bookedSeats} booked seat(s)</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setPostToCancel(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Keep Ride
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleConfirmCancel}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-md shadow-rose-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Yes, Cancel Ride</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION POPUP MODAL                                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[28px] border border-[#F4E3D8] shadow-2xl max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-[#17233C] leading-snug">
                    Delete Post?
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1 leading-relaxed">
                    Are you sure you want to delete this post? This will permanently remove it from the platform.
                  </p>
                </div>
              </div>

              {/* Route Summary Box */}
              <div className="bg-[#FFF8F4] border border-[#FDE0D0] rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-black text-[#17233C]">
                  <span className="capitalize">{postToDelete.source}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF572E] stroke-[2.5]" />
                  <span className="capitalize">{postToDelete.destination}</span>
                </div>
                <div className="text-[11px] text-[#8C93A4] flex items-center gap-2 font-semibold">
                  <span>{formatTravelDate(postToDelete.travelDate)}</span>
                  <span>•</span>
                  <span>{postToDelete.type === 'offer' ? 'Ride Offer' : 'Passenger Request'}</span>
                  {postToDelete.pricePerSeat && (
                    <>
                      <span>•</span>
                      <span className="text-[#FF572E] font-bold">₹{postToDelete.pricePerSeat}/seat</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPostToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md shadow-red-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Delete Post</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Date Picker Modal for Ride Editing */}
      <DatePickerModal
        isOpen={showEditDatePicker}
        onClose={() => setShowEditDatePicker(false)}
        value={editFormData.travelDate}
        onChange={(newDate) => {
          setEditFormData({ ...editFormData, travelDate: newDate });
          setShowEditDatePicker(false);
        }}
        title="Select New Travel Date"
      />

      {/* Modern Time Picker Modal for Ride Editing */}
      <TimePickerModal
        isOpen={showEditTimePicker}
        onClose={() => setShowEditTimePicker(false)}
        value={editFormData.timeStr}
        onChange={(newTime) => {
          setEditFormData({ ...editFormData, timeStr: newTime });
          setShowEditTimePicker(false);
        }}
        title="Select New Departure Time"
      />
    </ResponsiveShell>
  );
}
