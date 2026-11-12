import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { useAuthProfile } from '../context/AuthProfileContext';
import { 
  savePoolMateDraft, 
  getPoolMateDraft, 
  clearPoolMateDraft, 
  generateIdempotencyKey 
} from '../utils/guestDraft';
import { GuestAuthPromptModal } from '../components/auth/GuestAuthPromptModal';
import {
  MapPin, Calendar, Clock, Users, ArrowUpDown,
  Search, Check, Sparkles, ChevronDown, User,
  ShieldCheck, ArrowRight, IndianRupee,
  CheckCircle2, X, FileText, Car, CarTaxiFront,
  Pencil, Trash2, Ban, RefreshCw, AlertCircle, Eye
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { DatePickerModal } from '../components/ui/DatePickerModal';
import { TimePickerModal } from '../components/ui/TimePickerModal';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import { LocationInput } from '../components/ui/LocationInput';
import { createTravel, updateTravel, deleteTravel, cancelTravel } from '../lib/api';
import { useMyTravels } from '../hooks/useAppData';
import { invalidateRideQueries } from '../lib/queryClient';

const POPULAR_LOCATIONS = [
  'VIT, Bhopal',
  'Bhopal Railway Station',
  'Rani Kamlapati Station (RKMP)',
  'Bhopal Airport (BHO)',
  'Indore (Bhawarkua / Bypass)',
  'Lalghati, Bhopal',
  'MP Nagar Zone 1',
  'Sehore Bus Stand',
  'Ashta Toll Plaza',
];

const ROUTE_PRESETS = [
  { from: 'VIT, Bhopal', to: 'Bhopal Railway Station', label: 'Campus ➔ Bhopal Station' },
  { from: 'VIT, Bhopal', to: 'Bhopal Airport (BHO)', label: 'Campus ➔ Airport' },
  { from: 'Bhopal Railway Station', to: 'VIT, Bhopal', label: 'Bhopal Station ➔ Campus' },
  { from: 'VIT, Bhopal', to: 'Indore (Bhawarkua / Bypass)', label: 'Campus ➔ Indore' },
];

function formatDateDisplay(dStr) {
  if (!dStr) return 'Select Date';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dStr;
}

function formatTimeDisplay(tStr) {
  if (!tStr) return 'Select Time';
  const parts = tStr.split(':');
  if (parts.length >= 2) {
    let hh = parseInt(parts[0], 10);
    const mm = parts[1].padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${mm} ${ampm}`;
  }
  return tStr;
}

/**
 * Format travel date string nicely (e.g. Thu, 6 Nov)
 */
function formatTravelDate(dateStr) {
  if (!dateStr) return 'Upcoming';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Upcoming';
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return 'Upcoming';
  }
}

function formatMinutesToTime(minutes) {
  const minNum = Number(minutes);
  if (typeof minutes === 'undefined' || minutes === null || isNaN(minNum)) return 'Flexible';
  const h = Math.floor(minNum / 60);
  const m = minNum % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function OfferRidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { profile } = useAuthProfile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: 'offer' | 'find' | 'my-rides'
  const initialMode = 
    searchParams.get('tab') === 'my-rides' || searchParams.get('mode') === 'my-rides'
      ? 'my-rides'
      : (location.pathname.includes('/request') || searchParams.get('mode') === 'request' || searchParams.get('mode') === 'find')
      ? 'find'
      : 'offer';

  const [activeTab, setActiveTab] = useState(initialMode);

  // Sync mode with route and URL query params
  useEffect(() => {
    if (searchParams.get('tab') === 'my-rides' || searchParams.get('mode') === 'my-rides') {
      setActiveTab('my-rides');
    } else if (location.pathname.includes('/request') || searchParams.get('mode') === 'request' || searchParams.get('mode') === 'find') {
      setActiveTab('find');
    } else {
      setActiveTab('offer');
    }
  }, [location.pathname, searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'offer') {
      setSearchParams({ mode: 'offer' });
    } else if (tab === 'find') {
      setSearchParams({ mode: 'find' });
    } else {
      setSearchParams({ tab: 'my-rides' });
    }
  };

  // Form states with persistent draft & URL search param support
  const [fromLoc, setFromLoc] = useState(() => {
    const urlFrom = searchParams.get('from');
    if (urlFrom) return urlFrom;
    try {
      const draft = JSON.parse(sessionStorage.getItem('helpu_active_route_draft') || '{}');
      if (draft.from) return draft.from;
    } catch {}
    return 'VIT, Bhopal';
  });

  const [toLoc, setToLoc] = useState(() => {
    const urlTo = searchParams.get('to') || searchParams.get('search');
    if (urlTo) return urlTo;
    try {
      const draft = JSON.parse(sessionStorage.getItem('helpu_active_route_draft') || '{}');
      if (draft.to) return draft.to;
    } catch {}
    return 'Bhopal Railway Station';
  });

  // Keep session route draft in sync with user edits
  useEffect(() => {
    try {
      sessionStorage.setItem('helpu_active_route_draft', JSON.stringify({ from: fromLoc, to: toLoc }));
    } catch {}
  }, [fromLoc, toLoc]);

  // Sync route if URL query parameters change (e.g. from Home shortcuts)
  useEffect(() => {
    const urlFrom = searchParams.get('from');
    const urlTo = searchParams.get('to') || searchParams.get('search');
    if (urlFrom) setFromLoc(urlFrom);
    if (urlTo) setToLoc(urlTo);
  }, [searchParams]);

  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('08:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [travellers, setTravellers] = useState(2); // Seats for offer mode
  const [pricePerSeat, setPricePerSeat] = useState('350');
  const [vehicleModel, setVehicleModel] = useState('Car');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Post success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);

  const { isSignedIn } = useUser();
  const { hasWhatsApp } = useAuthProfile();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const idempotencyKeyRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Restore PoolMate guest draft on mount
  useEffect(() => {
    const draft = getPoolMateDraft();
    if (draft && draft.data) {
      const d = draft.data;
      if (d.fromLoc) setFromLoc(d.fromLoc);
      if (d.toLoc) setToLoc(d.toLoc);
      if (d.date) setDate(d.date);
      if (d.time) setTime(d.time);
      if (d.travellers) setTravellers(d.travellers);
      if (d.pricePerSeat) setPricePerSeat(d.pricePerSeat);
      if (d.vehicleModel) setVehicleModel(d.vehicleModel);
      if (d.notes) setNotes(d.notes);
      if (d.gender) setGender(d.gender);
      if (d.activeTab) setActiveTab(d.activeTab);
      setIsDraftRestored(true);
    }
  }, []);

  // My Rides query & state
  const { data: rawTravels, isLoading: travelsLoading, refetch: refetchTravels } = useMyTravels();
  const myTravels = Array.isArray(rawTravels) ? rawTravels : [];
  const [postToEdit, setPostToEdit] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    date: '',
    timeStr: '08:00',
    seats: 1,
    pricePerSeat: 350,
    notes: ''
  });

  const handleSwapLocations = () => {
    const temp = fromLoc;
    setFromLoc(toLoc);
    setToLoc(temp);
  };

  const applyPreset = (preset) => {
    setFromLoc(preset.from);
    setToLoc(preset.to);
  };

  // Submit Handler: Posts real ride Offer or Find request with guest protection & idempotency
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!fromLoc.trim() || !toLoc.trim()) {
      setError('Please specify departure and destination locations.');
      return;
    }
    if (fromLoc.trim().toLowerCase() === toLoc.trim().toLowerCase()) {
      setError('Departure and destination locations must be different.');
      return;
    }
    if (!date) {
      setError('Please select a travel date.');
      return;
    }

    // 1. If guest, save draft and prompt Google authentication
    if (!isSignedIn) {
      savePoolMateDraft({
        fromLoc: fromLoc.trim(),
        toLoc: toLoc.trim(),
        date,
        time,
        travellers,
        pricePerSeat,
        vehicleModel,
        notes,
        gender,
        activeTab
      }, location.pathname + location.search, activeTab);
      setShowAuthModal(true);
      return;
    }

    // 2. If authenticated but missing WhatsApp, preserve draft & route to onboarding
    if (!hasWhatsApp) {
      savePoolMateDraft({
        fromLoc: fromLoc.trim(),
        toLoc: toLoc.trim(),
        date,
        time,
        travellers,
        pricePerSeat,
        vehicleModel,
        notes,
        gender,
        activeTab
      }, location.pathname + location.search, activeTab);
      navigate(`/whatsapp-setup?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    // 3. User is authenticated and verified: EXPLICIT CONFIRMATION SUBMISSION
    if (loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      let departureMinutes = 480;
      if (time) {
        const [hh, mm] = time.split(':').map(Number);
        departureMinutes = hh * 60 + (mm || 0);
      }

      const isOffer = activeTab === 'offer';

      const payload = {
        source: fromLoc.trim(),
        destination: toLoc.trim(),
        travelDate: date,
        departureTime: departureMinutes,
        timeFlexibility: 30,
        seats: isOffer ? Number(travellers) : 1, // FIND is strictly 1 seat
        pricePerSeat: isOffer ? (Number(pricePerSeat) || 0) : 0,
        carModel: isOffer ? (vehicleModel.trim() || 'Campus Ride') : 'Find Ride',
        type: isOffer ? 'offer' : 'request',
        notes: notes.trim(),
        gender: gender || null,
        authorImage: profile?.imageUrl || user?.imageUrl || null,
        authorName: profile?.name || user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || null,
        authorEmail: profile?.email || user?.primaryEmailAddress?.emailAddress || null,
      };

      // Generate or reuse UUID idempotency key for this submission attempt
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = generateIdempotencyKey();
      }

      const options = {
        headers: {
          'Idempotency-Key': idempotencyKeyRef.current
        }
      };

      // Controlled retry with backoff for transient 503 or network glitches
      let res;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await createTravel(payload, options);
          break;
        } catch (callErr) {
          if (callErr.response?.status === 503 && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 750));
            continue;
          }
          throw callErr;
        }
      }

      const createdPost = res?.data?.data || res?.data;
      idempotencyKeyRef.current = null;
      clearPoolMateDraft();
      setIsDraftRestored(false);
      invalidateRideQueries();

      setCreatedSummary({
        id: createdPost?._id || createdPost?.id,
        type: isOffer ? 'offer' : 'request',
        source: fromLoc.trim(),
        destination: toLoc.trim(),
        travelDate: date,
        time: time || '08:00',
        seats: isOffer ? Number(travellers) : 1,
        pricePerSeat: isOffer ? (Number(pricePerSeat) || 0) : 0,
        carModel: isOffer ? (vehicleModel.trim() || 'Campus Ride') : 'Find Ride',
        gender: gender || null,
        notes: notes.trim(),
      });

      setShowSuccessModal(true);
    } catch (err) {
      console.error('Ride post error:', err);
      if (err.response?.status === 409) {
        setError('A ride submission is currently being processed. Please wait a moment.');
      } else if (err.response?.status === 503) {
        setError('Verification service is momentarily busy. Please try again in a few seconds.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to post ride. Please try again.');
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Cancel ride post
  const handleCancelPost = async (travelId) => {
    if (!window.confirm('Are you sure you want to cancel this ride post? Any bookings will be notified.')) {
      return;
    }
    try {
      await cancelTravel(travelId);
      invalidateRideQueries();
      refetchTravels();
      setFeedbackMsg({ type: 'success', text: 'Ride post cancelled successfully.' });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to cancel post.' });
    }
  };

  // Delete ride post
  const handleDeletePost = async (travelId) => {
    if (!window.confirm('Are you sure you want to delete this ride post completely?')) {
      return;
    }
    try {
      await deleteTravel(travelId);
      invalidateRideQueries();
      refetchTravels();
      setFeedbackMsg({ type: 'success', text: 'Ride post deleted.' });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete post.' });
    }
  };

  // Open edit modal
  const handleOpenEdit = (travel) => {
    let formattedDate = '';
    if (travel?.travelDate) {
      try {
        const d = new Date(travel.travelDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      } catch {
        formattedDate = '';
      }
    }
    const totalMinutes = typeof travel?.departureTime === 'number' && !isNaN(travel.departureTime) ? travel.departureTime : 480;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setEditFormData({
      date: formattedDate,
      timeStr,
      seats: travel?.type === 'request' ? 1 : (travel?.seats || 1),
      pricePerSeat: travel?.pricePerSeat ?? 350,
      notes: travel?.notes || ''
    });
    setPostToEdit(travel);
  };

  // Save edited ride post
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!postToEdit) return;
    setIsEditing(true);
    try {
      const [hh, mm] = editFormData.timeStr.split(':').map(Number);
      const departureMinutes = hh * 60 + (mm || 0);

      await updateTravel(postToEdit._id, {
        travelDate: editFormData.date,
        departureTime: departureMinutes,
        seats: postToEdit.type === 'request' ? 1 : Number(editFormData.seats),
        pricePerSeat: postToEdit.type === 'request' ? 0 : Number(editFormData.pricePerSeat),
        notes: editFormData.notes.trim()
      });

      invalidateRideQueries();
      refetchTravels();
      setPostToEdit(null);
      setFeedbackMsg({ type: 'success', text: 'Ride updated successfully!' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update ride.');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={
        <AppHeader 
          title="Ride" 
          backTo="/home"
        />
      }
    >
      <div className="w-full max-w-xl lg:max-w-6xl xl:max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-2 pb-6 sm:pt-4 sm:pb-10 space-y-4 sm:space-y-6">

        {/* ========================================================================= */}
        {/* TOP SEGMENT TABS: OFFER A RIDE | FIND A RIDE | MY RIDES                   */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[22px] p-1.5 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-1 max-w-md mx-auto">
          {/* Tab 1: Offer a Ride */}
          <button
            type="button"
            onClick={() => handleTabChange('offer')}
            className={`flex-1 py-2.5 px-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeTab === 'offer'
                ? 'bg-[#FF572E] text-white shadow-sm shadow-[#FF572E]/25'
                : 'text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F3]'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Offer a Ride</span>
          </button>

          {/* Tab 2: Find a Ride */}
          <button
            type="button"
            onClick={() => handleTabChange('find')}
            className={`flex-1 py-2.5 px-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeTab === 'find'
                ? 'bg-[#FF572E] text-white shadow-sm shadow-[#FF572E]/25'
                : 'text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F3]'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Find a Ride</span>
          </button>

          {/* Tab 3: My Rides */}
          <button
            type="button"
            onClick={() => handleTabChange('my-rides')}
            className={`flex-1 py-2.5 px-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none ${
              activeTab === 'my-rides'
                ? 'bg-[#FF572E] text-white shadow-sm shadow-[#FF572E]/25'
                : 'text-[#6E7587] hover:text-[#17233C] hover:bg-[#FFF8F3]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Rides ({myTravels.length})</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div className={`p-3 rounded-2xl text-xs font-bold text-center border animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* Restored Draft Review Banner */}
        {isDraftRestored && activeTab !== 'my-rides' && (
          <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-[#92400E]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span><strong>Draft restored:</strong> Please review your travel details before clicking '{activeTab === 'offer' ? 'Publish Offer' : 'Submit Request'}'.</span>
            </div>
            <button 
              type="button"
              onClick={() => {
                clearPoolMateDraft();
                setIsDraftRestored(false);
              }} 
              className="text-[#B45309] font-bold underline hover:no-underline text-[11px] shrink-0 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: MY RIDES TAB                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'my-rides' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#F4E3D8]/60">
              <div>
                <h2 className="font-black text-[#17233C] text-lg sm:text-xl">
                  My Published Rides
                </h2>
                <p className="text-xs text-[#6E7587] font-medium">
                  Review your active travel plans, manage passenger bookings, and discover matching peers.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTabChange('offer')}
                leftIcon={<Car className="w-3.5 h-3.5" />}
              >
                Post New Ride
              </Button>
            </div>

            {travelsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-44 bg-white rounded-[24px] border border-[#F4E3D8] animate-pulse" />
                ))}
              </div>
            ) : myTravels.length === 0 ? (
              <div className="bg-white rounded-[28px] border border-[#F4E3D8] p-8 text-center space-y-3 max-w-md mx-auto shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto text-2xl">
                  🚗
                </div>
                <div>
                  <h3 className="font-black text-base text-[#17233C]">No Rides Published Yet</h3>
                  <p className="text-xs text-[#6E7587] mt-1">
                    You haven't posted any travel offers or passenger requests. Share your route to find matching peers!
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleTabChange('offer')}>
                    Offer a Ride
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleTabChange('find')}>
                    Find a Ride
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {myTravels.map((travel) => {
                  const isOffer = travel.type === 'offer';
                  const dateDisplay = formatTravelDate(travel.travelDate);
                  const timeDisplay = formatMinutesToTime(travel.departureTime);
                  const isCancelled = travel.status === 'cancelled';
                  const isCompleted = travel.status === 'completed';
                  const isExpired = travel.status === 'expired';
                  const isActive = travel.status === 'active';

                  return (
                    <motion.div
                      key={travel._id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[24px] border border-[#F4E3D8] hover:border-[#FF572E]/40 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
                    >
                      <div className="space-y-3">
                        {/* Top: Type Badge & Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isOffer
                              ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]'
                              : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                          }`}>
                            {isOffer ? `Offer (${travel.bookedSeats || 0}/${travel.seats} Booked)` : 'Find Request (1 Seat)'}
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isCompleted
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {travel.status}
                          </span>
                        </div>

                        {/* Route Box */}
                        <div className="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8]/80 text-xs space-y-2">
                          <div className="flex items-center gap-2 font-black text-sm text-[#17233C]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                            <span className="truncate">{travel.source}</span>
                            <span className="text-[#FF572E]">→</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF572E] shrink-0" />
                            <span className="truncate">{travel.destination}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#6E7587] pt-1.5 border-t border-[#F4E3D8]/60 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                              <span>{dateDisplay}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[#17233C]">
                              <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                              <span>{timeDisplay}</span>
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        {isOffer && (
                          <div className="flex items-center justify-between text-xs text-[#6E7587] font-bold px-1">
                            <span>Vehicle: {travel.carModel || 'Campus Ride'}</span>
                            <span className="text-[#FF572E] font-black">₹{travel.pricePerSeat}/seat</span>
                          </div>
                        )}

                        {travel.notes && (
                          <p className="text-[11px] text-[#6E7587] italic px-1 truncate">
                            "{travel.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2.5 border-t border-[#F4E3D8]/70 flex items-center justify-between gap-2">
                        {/* Details Button */}
                        <button
                          type="button"
                          onClick={() => navigate(`/rides/${travel._id || travel.id}`)}
                          className="py-2 px-3 bg-[#FFFBF8] hover:bg-[#FFF4ED] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#8C93A4]" />
                          <span>Details</span>
                        </button>

                        {/* Primary Action: Find Matches */}
                        <button
                          type="button"
                          onClick={() => navigate('/match')}
                          className="flex-1 py-2 px-3 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Find Matches</span>
                        </button>

                        {/* Secondary Actions */}
                        {isActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(travel)}
                              title="Edit Ride"
                              className="p-2 rounded-xl border border-[#F4E3D8] hover:bg-[#FFF9F5] text-[#17233C] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelPost(travel._id)}
                              title="Cancel Ride"
                              className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {(isCancelled || isCompleted || isExpired) && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(travel._id)}
                            title="Delete Post"
                            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: FORM FOR OFFER OR FIND A RIDE                                     */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            
            {/* MAIN FORM COLUMN (7 COLS ON DESKTOP, FULL WIDTH ON MOBILE) */}
            <div className="lg:col-span-7 space-y-4">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-4 sm:p-6 space-y-4"
              >
                {/* Form Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]/70">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shrink-0">
                      {activeTab === 'offer' ? <Car className="w-5 h-5 stroke-[2.4]" /> : <Search className="w-5 h-5 stroke-[2.4]" />}
                    </div>
                    <div>
                      <h2 className="font-black text-[#17233C] text-base sm:text-lg leading-tight">
                        {activeTab === 'offer' ? 'Offer a Vehicle Ride' : 'Find a Passenger Ride'}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-[#6E7587] font-medium">
                        {activeTab === 'offer' 
                          ? 'Share available seats in your car or bike with verified campus peers.' 
                          : 'Post a travel request for single passenger seat matching.'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                    activeTab === 'offer' ? 'bg-[#EDFAF3] text-[#16A34A] border border-[#BCECD4]' : 'bg-[#FFF4ED] text-[#FF572E] border border-[#FDE0D0]'
                  }`}>
                    {activeTab === 'offer' ? 'Offering Seats' : 'Requesting Seat'}
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Route Box: From & To with Floating Central Swap */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#17233C]">
                      Route <span className="text-[#FF572E]">*</span>
                    </label>

                    <div className="relative bg-white rounded-2xl border border-[#F4E3D8] shadow-2xs">
                      {/* From Departure */}
                      <LocationInput
                        id="from-location-input"
                        label="Departure Location"
                        value={fromLoc}
                        onChange={setFromLoc}
                        placeholder="VIT, Bhopal"
                        dotColor="green"
                        required={true}
                        locations={POPULAR_LOCATIONS}
                        className="border-b border-[#F4E3D8]"
                      />

                      {/* Swap Button */}
                      <button
                        type="button"
                        onClick={handleSwapLocations}
                        title="Swap Origin and Destination"
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-[#F4E3D8] text-[#FF572E] hover:bg-[#FFF7F2] active:scale-90 shadow-sm flex items-center justify-center cursor-pointer transition-all"
                      >
                        <ArrowUpDown className="w-4 h-4 stroke-[2.4]" />
                      </button>

                      {/* To Destination */}
                      <LocationInput
                        id="to-location-input"
                        label="Destination Location"
                        value={toLoc}
                        onChange={setToLoc}
                        placeholder="Bhopal Railway Station"
                        dotColor="orange"
                        required={true}
                        locations={POPULAR_LOCATIONS}
                      />
                    </div>
                  </div>

                  {/* Schedule: Travel Date & Departure Time Pickers */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    {/* Date Picker Button */}
                    <div 
                      onClick={() => setShowDatePicker(true)}
                      className="bg-white rounded-2xl p-3 border border-[#F4E3D8] hover:border-[#FF572E]/60 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-1">
                        <Calendar className="w-3.5 h-3.5 text-[#FF572E]" />
                        <span>Travel Date</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                          {formatDateDisplay(date)}
                        </span>
                        <ChevronDown className="w-4 h-4 text-[#8C93A4] shrink-0" />
                      </div>
                    </div>

                    {/* Time Picker Button */}
                    <div 
                      onClick={() => setShowTimePicker(true)}
                      className="bg-white rounded-2xl p-3 border border-[#F4E3D8] hover:border-[#FF572E]/60 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#FF572E]" />
                        <span>Departure Time</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                          {formatTimeDisplay(time)}
                        </span>
                        <ChevronDown className="w-4 h-4 text-[#8C93A4] shrink-0" />
                      </div>
                    </div>
                  </div>

                  {/* Capacity & Price Row */}
                  {activeTab === 'offer' ? (
                    <div className="bg-white rounded-2xl p-3.5 border border-[#F4E3D8] flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 stroke-[2.4]" />
                        </div>
                        <div>
                          <h4 className="font-black text-xs sm:text-sm text-[#17233C] leading-none">
                            Available Seats
                          </h4>
                          <p className="text-[11px] text-[#6E7587] font-medium mt-0.5">
                            Max seats for co-travellers
                          </p>
                        </div>
                      </div>

                      {/* Stepper + Price Input */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-[#FFFBF8] rounded-xl px-2.5 py-1 border border-[#F4E3D8]">
                          <span className="font-black text-[#FF572E] text-xs">₹</span>
                          <input
                            type="number"
                            value={pricePerSeat}
                            onChange={(e) => setPricePerSeat(e.target.value)}
                            placeholder="350"
                            className="w-12 text-xs font-black text-[#17233C] focus:outline-none bg-transparent"
                            title="Fuel Contribution per seat"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTravellers((prev) => Math.max(1, prev - 1))}
                            className="w-7 h-7 rounded-lg bg-white border border-[#F4E3D8] text-[#17233C] hover:bg-[#FFEBE0] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            −
                          </button>
                          <span className="font-black text-[#17233C] text-sm min-w-[18px] text-center">
                            {travellers}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTravellers((prev) => Math.min(6, prev + 1))}
                            className="w-7 h-7 rounded-lg bg-[#FF572E] text-white hover:bg-[#E64A22] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 shadow-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Find Mode: Fixed Strictly to 1 Seat. No Seat Selector shown */
                    <div className="bg-[#FFFBF8] rounded-2xl p-3.5 border border-[#F4E3D8] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 stroke-[2.4]" />
                        </div>
                        <div>
                          <h4 className="font-black text-xs sm:text-sm text-[#17233C] leading-none">
                            Passenger Request
                          </h4>
                          <p className="text-[11px] text-[#6E7587] font-medium mt-0.5">
                            FIND requests are strictly for 1 individual passenger
                          </p>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-xl bg-[#EDFAF3] border border-[#BCECD4] text-[#16A34A] text-xs font-black shadow-2xs">
                        1 Seat Only
                      </span>
                    </div>
                  )}

                  {/* Gender Preference */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#17233C]">
                      Co-traveler Gender Preference <span className="text-[#8C93A4] font-normal">(Optional)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Male Only', val: 'Male', emoji: '👨' },
                        { label: 'Female Only', val: 'Female', emoji: '👩' },
                        { label: 'Any / Flexible', val: '', emoji: '🤝' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setGender(gender === item.val ? '' : item.val)}
                          className={`py-2 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            gender === item.val
                              ? 'border-[#FF572E] bg-[#FFF8F3] text-[#FF572E] ring-1 ring-[#FF572E]'
                              : 'border-[#F4E3D8] bg-white text-[#17233C] hover:border-[#FF572E]/40'
                          }`}
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes / Luggage / Pickup Points */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#17233C]">
                      Trip Notes & Instructions <span className="text-[#8C93A4] font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={
                        activeTab === 'offer'
                          ? 'Add luggage capacity, exact campus gate pickup, or AC availability...'
                          : 'Mention backpack/trolley size, flexibility in timing, or preferred pickup spot...'
                      }
                      maxLength={300}
                      className="w-full rounded-xl bg-white border border-[#F4E3D8] p-3 text-xs font-semibold text-[#17233C] placeholder:text-[#8C93A4] placeholder:font-normal focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15 outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth={true}
                    isLoading={loading}
                    disabled={loading}
                    leftIcon={activeTab === 'offer' ? <Car className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                  >
                    {activeTab === 'offer' ? 'Publish Ride Offer →' : 'Publish Ride Request →'}
                  </Button>

                </form>
              </motion.div>
            </div>

            {/* SIDEBAR COLUMN (5 COLS ON DESKTOP, STACKED BELOW ON MOBILE) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* MY ACTIVE RIDES QUICK PREVIEW CARD */}
              <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F4E3D8]/60">
                  <h3 className="font-black text-sm text-[#17233C]">
                    Your Published Rides ({myTravels.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange('my-rides')}
                    className="text-xs font-extrabold text-[#FF572E] hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                {myTravels.slice(0, 2).map((t) => (
                  <div
                    key={t._id}
                    onClick={() => handleTabChange('my-rides')}
                    className="p-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] hover:border-[#FF572E]/40 cursor-pointer space-y-1 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs font-black text-[#17233C]">
                      <span className="truncate">{t.source} → {t.destination}</span>
                      <span className="text-[10px] font-bold text-[#FF572E] shrink-0 uppercase">{t.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#6E7587]">
                      <span>{formatTravelDate(t.travelDate)} • {formatMinutesToTime(t.departureTime)}</span>
                      <span className="font-bold text-[#16A34A]">{t.status}</span>
                    </div>
                  </div>
                ))}

                {myTravels.length === 0 && (
                  <p className="text-xs text-[#8C93A4] py-1 text-center font-medium">
                    No rides published yet.
                  </p>
                )}
              </div>

              {/* CAMPUS TRAVEL GUIDELINE */}
              <div className="bg-[#FFF8F3] rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-[#17233C]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Student Safety Standards</span>
                </div>
                <p className="text-xs text-[#6E7587] leading-relaxed font-medium">
                  All Helpu drivers and passengers are verified university students. Co-ordinate easily via WhatsApp once your booking or group match is confirmed.
                </p>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SUCCESS CONFIRMATION MODAL                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showSuccessModal && createdSummary && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-md w-full p-6 border border-[#F4E3D8] shadow-2xl space-y-4 relative"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full text-[#6E7587] hover:text-[#17233C] hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-[#EDFAF3] border border-[#BCECD4] text-[#16A34A] flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.4]" />
                </div>
                <h3 className="font-black text-xl text-[#17233C]">
                  {createdSummary.type === 'offer' ? 'Ride Offer Published!' : 'Ride Request Published!'}
                </h3>
                <p className="text-xs text-[#6E7587] leading-relaxed font-medium">
                  Your trip is live! Verified students travelling on your route can now discover you or join your group.
                </p>
              </div>

              <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-black text-[#17233C]">
                  <span className="truncate">{createdSummary.source}</span>
                  <span className="text-[#FF572E] px-2">→</span>
                  <span className="truncate">{createdSummary.destination}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#F4E3D8]/60 text-[#6E7587] font-semibold text-[11px]">
                  <span>{formatTravelDate(createdSummary.travelDate)} • {createdSummary.time}</span>
                  <span className="font-black text-[#FF572E]">{createdSummary.seats} {createdSummary.seats === 1 ? 'Seat' : 'Seats'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowSuccessModal(false);
                    handleTabChange('my-rides');
                  }}
                >
                  View My Rides
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/match');
                  }}
                  leftIcon={<Search className="w-4 h-4" />}
                >
                  Find Matches
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* EDIT MODAL FOR PUBLISHED RIDE                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(postToEdit)}
        onClose={() => setPostToEdit(null)}
        title="Edit Ride Post"
        subtitle={postToEdit ? `${postToEdit.source} → ${postToEdit.destination}` : ''}
      >
        {postToEdit && (
          <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-xs font-bold text-[#17233C] mb-1">Travel Date</label>
              <input
                type="date"
                required
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                className="w-full rounded-xl bg-white border border-[#F4E3D8] p-2.5 font-bold text-[#17233C] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17233C] mb-1">Departure Time (HH:MM)</label>
              <input
                type="time"
                required
                value={editFormData.timeStr}
                onChange={(e) => setEditFormData({ ...editFormData, timeStr: e.target.value })}
                className="w-full rounded-xl bg-white border border-[#F4E3D8] p-2.5 font-bold text-[#17233C] outline-none"
              />
            </div>

            {postToEdit.type === 'offer' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1">Seats Available</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={editFormData.seats}
                    onChange={(e) => setEditFormData({ ...editFormData, seats: e.target.value })}
                    className="w-full rounded-xl bg-white border border-[#F4E3D8] p-2.5 font-bold text-[#17233C] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1">Price / Seat (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={editFormData.pricePerSeat}
                    onChange={(e) => setEditFormData({ ...editFormData, pricePerSeat: e.target.value })}
                    className="w-full rounded-xl bg-white border border-[#F4E3D8] p-2.5 font-bold text-[#17233C] outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#17233C] mb-1">Notes</label>
              <textarea
                rows={2}
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                maxLength={300}
                className="w-full rounded-xl bg-white border border-[#F4E3D8] p-2.5 font-semibold text-[#17233C] outline-none resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button variant="secondary" size="sm" onClick={() => setPostToEdit(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isEditing}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Date & Time Picker Modals */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={date}
        selectedDate={date}
        onChange={(newDate) => {
          setDate(newDate);
          setShowDatePicker(false);
        }}
        onSelectDate={(newDate) => {
          setDate(newDate);
          setShowDatePicker(false);
        }}
      />

      <TimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        value={time}
        selectedTime={time}
        onChange={(newTime) => {
          setTime(newTime);
          setShowTimePicker(false);
        }}
        onSelectTime={(newTime) => {
          setTime(newTime);
          setShowTimePicker(false);
        }}
      />
      {/* Guest Authentication Prompt Modal */}
      <GuestAuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        moduleName="PoolMate"
        returnPath={location.pathname + location.search}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          setIsDraftRestored(true);
        }}
      />
    </ResponsiveShell>
  );
}
