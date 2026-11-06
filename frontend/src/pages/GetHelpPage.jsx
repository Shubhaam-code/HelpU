import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../context/FirebaseAuthContext';
import { 
  Wrench, Search, Plus, Phone, AlertCircle, Clock, 
  MapPin, CheckCircle2, ShieldCheck, Car, Package, 
  BookOpen, Home, HelpCircle, ArrowRight, X, MessageSquare, Send, Loader2
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { openWhatsAppChat } from '../lib/whatsapp';
import { getProfile, getUnreadCount, getHelpRequests, createHelpRequest, getMyHelpRequests } from '../lib/api';

const HELP_CATEGORIES = [
  {
    id: 'emergency-travel',
    title: 'Emergency Travel',
    subtitle: 'Urgent station or night rides',
    icon: Car,
    color: '#FF572E',
    bgColor: '#FFF4ED',
    borderColor: '#FDE0D0'
  },
  {
    id: 'errands-parcels',
    title: 'Errands & Parcels',
    subtitle: 'Main Gate & city pickups',
    icon: Package,
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: '#DDD6FE'
  },
  {
    id: 'peer-tutoring',
    title: 'Notes & Tutoring',
    subtitle: 'Study files & exam prep',
    icon: BookOpen,
    color: '#16A34A',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0'
  },
  {
    id: 'hostel-luggage',
    title: 'Hostel & Luggage',
    subtitle: 'Room shifting & storage',
    icon: Home,
    color: '#EA580C',
    bgColor: '#FFF7ED',
    borderColor: '#FED7AA'
  },
  {
    id: 'lost-found',
    title: 'Lost & Found',
    subtitle: 'Report or find campus items',
    icon: HelpCircle,
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE'
  }
];

const INITIAL_REQUESTS = [];

export default function GetHelpPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [reqSubmitting, setReqSubmitting] = useState(false);

  // New Request Form State
  const [reqTitle, setReqTitle] = useState('');
  const [reqCategory, setReqCategory] = useState('emergency-travel');
  const [reqLocation, setReqLocation] = useState('Campus Main Gate');
  const [reqUrgency, setReqUrgency] = useState('Normal');
  const [reqDescription, setReqDescription] = useState('');

  // Fetch help requests from backend
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const res = await getHelpRequests({ limit: 30 });
      setRequests(res.data?.data || []);
    } catch (err) {
      console.error('Help requests fetch error:', err);
      setRequestsError('Could not load help requests. Please try again.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then(res => {
        if (!isMounted) return;
        setProfile(res.data?.data || null);
      })
      .catch(() => {});

    getUnreadCount()
      .then(res => {
        if (!isMounted) return;
        setUnreadCount(res.data?.data?.count || 0);
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const currentUserName = useMemo(() => {
    return profile?.name || user?.fullName || user?.firstName || 'Campus Student';
  }, [profile, user]);

  const currentUserAvatar = useMemo(() => {
    return profile?.avatarId || 'm1';
  }, [profile]);

  // Category id → display label map
  const CATEGORY_LABELS = {
    'emergency-travel': 'Emergency Travel',
    'errands-parcels': 'Errands & Parcels',
    'peer-tutoring': 'Notes & Tutoring',
    'hostel-luggage': 'Hostel & Luggage',
    'lost-found': 'Lost & Found',
    'other': 'Other'
  };

  // Handle New Request Submit
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqDescription.trim()) return;
    setReqSubmitting(true);
    try {
      await createHelpRequest({
        title: reqTitle.trim(),
        description: reqDescription.trim(),
        category: reqCategory,
        location: reqLocation.trim(),
        urgency: reqUrgency,
        authorName: currentUserName,
        whatsapp: profile?.phone || ''
      });
      setReqTitle('');
      setReqDescription('');
      setIsCreatingRequest(false);
      fetchRequests(); // refetch
    } catch (err) {
      console.error('Create help request error:', err);
    } finally {
      setReqSubmitting(false);
    }
  };

  // Filter requests (client-side search)
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const catLabel = CATEGORY_LABELS[req.category] || req.category || '';
      const matchCat = selectedCategory === 'All' || catLabel === selectedCategory || req.category === selectedCategory;
      const matchSearch = !searchQuery.trim() ||
        req.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.location?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [requests, selectedCategory, searchQuery]);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      unreadCount={unreadCount}
      customMobileHeader={<AppHeader title="Get Help" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-xs relative overflow-hidden p-6 sm:p-8 mb-6"
        >
          {/* Subtle warm decorative background glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FFF0E7]/70 via-[#FFF5EE]/30 to-transparent pointer-events-none rounded-r-[28px]" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-3">
                <Wrench className="w-3.5 h-3.5" />
                <span>Campus Assistance Network</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#17233C] tracking-tight leading-tight">
                How Can We <span className="text-[#FF572E]">Help You Today?</span>
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#6E7587] font-medium max-w-lg leading-relaxed">
                Connect directly with peers for emergency travel, station pickups, parcels, notes exchange, and campus services.
              </p>
            </div>

            <button
              onClick={() => setIsCreatingRequest(true)}
              className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] active:scale-[0.99] text-white rounded-full font-black text-xs sm:text-sm shadow-md shadow-[#FF572E]/25 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Request Help</span>
            </button>
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 5 SERVICE CATEGORIES CARDS                                                */}
        {/* ========================================================================= */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-[#17233C] text-base sm:text-lg">
              Explore Campus Services
            </h2>
            <button
              onClick={() => setSelectedCategory('All')}
              className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {HELP_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.title;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? 'All' : cat.title)}
                  className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white ring-2 ring-[#FF572E] border-transparent shadow-md'
                      : 'hover:bg-white hover:shadow-xs'
                  }`}
                  style={{
                    backgroundColor: isSelected ? '#FFFFFF' : cat.bgColor,
                    borderColor: cat.borderColor
                  }}
                >
                  <div>
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 shadow-2xs"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <Icon className="w-4 h-4 stroke-[2.3]" />
                    </div>
                    <h3 className="font-black text-xs sm:text-sm text-[#17233C] leading-tight">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#6E7587] mt-0.5 leading-tight">
                      {cat.subtitle}
                    </p>
                  </div>

                  <div className="self-end mt-2">
                    <div 
                      className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-2xs text-[10px] font-bold"
                      style={{ color: cat.color }}
                    >
                      →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* ========================================================================= */}
        {/* SEARCH & FILTER BAR                                                       */}
        {/* ========================================================================= */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#8C93A4]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campus help requests, locations, or notes..."
            className="w-full bg-white rounded-full py-3.5 pl-11 pr-5 text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] border border-[#F4E3D8] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 focus:border-[#FF572E] transition-all"
          />
        </div>


        {/* ========================================================================= */}
        {/* TWO-COLUMN LAYOUT: HELP REQUESTS LIST + CAMPUS DIRECTORY                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: ACTIVE REQUESTS FEED (SPAN 8) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#17233C] text-base sm:text-lg">
                  Active Help Requests ({filteredRequests.length})
                </h3>
                <p className="text-xs text-[#6E7587]">
                  Verified student requests needing quick peer coordination.
                </p>
              </div>

              {selectedCategory !== 'All' && (
                <span className="px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] text-xs font-bold">
                  {selectedCategory}
                </span>
              )}
            </div>

            {/* Requests List */}
            {requestsLoading ? (
              <div className="bg-white rounded-[26px] p-10 text-center border border-[#F4E3D8]">
                <Loader2 className="w-7 h-7 animate-spin text-[#FF572E] mx-auto mb-3" />
                <p className="text-xs text-[#6E7587] font-medium">Loading help requests...</p>
              </div>
            ) : requestsError ? (
              <div className="bg-white rounded-[26px] p-10 text-center border border-red-100">
                <p className="text-xs text-red-500 font-bold mb-2">{requestsError}</p>
                <button onClick={fetchRequests} className="px-4 py-1.5 bg-[#FF572E] text-white text-xs font-bold rounded-xl cursor-pointer">Retry</button>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="bg-white rounded-[26px] p-10 text-center border border-[#F4E3D8] max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto mb-3">
                  <Wrench className="w-6 h-6" />
                </div>
                <h3 className="font-black text-[#17233C] text-base mb-1">No Open Requests</h3>
                <p className="text-xs text-[#6E7587] mb-4">
                  Need assistance with campus travel, parcels, or notes? Create the first request!
                </p>
                <button
                  onClick={() => setIsCreatingRequest(true)}
                  className="px-5 py-2 bg-[#FF572E] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Create Help Request
                </button>
              </div>
            ) : (
              filteredRequests.map(req => {
                const reqId = req._id || req.id;
                const timeAgo = req.timeAgo || (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '');
                const catLabel = { 'emergency-travel': 'Emergency Travel', 'errands-parcels': 'Errands & Parcels', 'peer-tutoring': 'Notes & Tutoring', 'hostel-luggage': 'Hostel & Luggage', 'lost-found': 'Lost & Found', 'other': 'Other' }[req.category] || req.category || '';
                return (
                <div
                  key={reqId}
                  className="bg-white rounded-[24px] p-5 border border-[#F4E3D8]/90 shadow-xs hover:border-[#FF572E]/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Student + Urgency + Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar 
                          avatarId={req.studentAvatar} 
                          src={req.studentImage} 
                          size="md" 
                          ring 
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-[#17233C] text-sm">{req.studentName || req.authorName}</h4>
                            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                          </div>
                          <span className="text-[11px] text-[#6E7587]">{req.college || 'VIT, Bhopal'} • {timeAgo}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {req.urgency === 'High' && (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-black flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Urgent
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full bg-[#EAF8F0] text-[#16A34A] border border-[#BCECD4] text-[10px] font-black">
                          {req.status}
                        </span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h4 className="font-black text-[#17233C] text-sm sm:text-base mb-1">
                      {req.title}
                    </h4>
                    <p className="text-xs text-[#596277] leading-relaxed mb-3">
                      {req.description}
                    </p>

                    {/* Location Badge */}
                    {req.location && (
                      <div className="flex items-center gap-1.5 text-xs text-[#6E7587] font-semibold bg-[#FFFBF8] p-2 rounded-xl border border-[#F4E3D8] mb-3 w-fit">
                        <MapPin className="w-3.5 h-3.5 text-[#FF572E]" />
                        <span>{req.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#F4E3D8]">
                    <span className="text-xs font-bold text-[#FF572E]">
                      {catLabel}
                    </span>

                    {req.whatsapp ? (
                      <button
                        onClick={() => openWhatsAppChat({
                          phone: req.whatsapp,
                          name: req.studentName || req.authorName,
                          message: `Hi! Saw your request on HelpU: "${req.title}". I'm happy to help you out!`
                        })}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Offer Help on WhatsApp</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#6E7587]">Posted by {req.authorName || 'Student'}</span>
                    )}
                  </div>
                </div>
                );
              })
            )}

          </div>


          {/* RIGHT COLUMN: CAMPUS HELPLINE DIRECTORY (SPAN 4) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Campus Emergency Numbers */}
            <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5">
                <Phone className="w-4.5 h-4.5 text-[#FF572E]" />
                <h3 className="font-black text-[#17233C] text-base">Campus Helplines</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between">
                  <div>
                    <div className="font-black text-[#17233C]">Campus Security & Gate</div>
                    <div className="text-[10px] text-[#6E7587]">24/7 Gate & Main Entrance</div>
                  </div>
                  <span className="font-bold text-[#FF572E] text-xs">0755-667788</span>
                </div>

                <div className="p-3 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between">
                  <div>
                    <div className="font-black text-[#17233C]">Health Center & Ambulance</div>
                    <div className="text-[10px] text-[#6E7587]">Emergency medical pickup</div>
                  </div>
                  <span className="font-bold text-[#16A34A] text-xs">108 / Extension 204</span>
                </div>

                <div className="p-3 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] flex items-center justify-between">
                  <div>
                    <div className="font-black text-[#17233C]">Hostel Warden Desk</div>
                    <div className="text-[10px] text-[#6E7587]">Leave passes & hostel support</div>
                  </div>
                  <span className="font-bold text-[#17233C] text-xs">Extension 112</span>
                </div>
              </div>
            </div>

            {/* How Campus Help Works */}
            <div className="bg-[#FFF8F3] rounded-[26px] p-5 sm:p-6 border border-[#FDE0D0] shadow-xs">
              <h3 className="font-black text-[#17233C] text-sm sm:text-base mb-2">
                How HelpU Assistance Works
              </h3>
              <ul className="space-y-2 text-xs text-[#596277] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-bold">•</span>
                  <span>Post your requirement (ride, parcel, study help).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-bold">•</span>
                  <span>Verified batchmates respond directly with WhatsApp link.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF572E] font-bold">•</span>
                  <span>Coordinate time & pickup without middlemen fees.</span>
                </li>
              </ul>
            </div>

            {/* Need a Ride? */}
            <div className="bg-white rounded-[26px] p-5 border border-[#F4E3D8]/90 shadow-xs text-center">
              <div className="w-10 h-10 rounded-full bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mx-auto mb-2.5">
                <Car className="w-5 h-5" />
              </div>
              <h4 className="font-black text-sm text-[#17233C]">Need a Campus Ride?</h4>
              <p className="text-xs text-[#6E7587] mt-1 mb-3">
                Use our automated ride matching engine to travel with campus peers.
              </p>
              <button
                onClick={() => navigate('/rides/offer')}
                className="w-full py-2 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Offer or Request a Ride
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE HELP REQUEST                                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCreatingRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[28px] max-w-lg w-full p-6 border border-[#F4E3D8] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]">
                <h3 className="font-black text-[#17233C] text-lg">Create Help Request</h3>
                <button
                  onClick={() => setIsCreatingRequest(false)}
                  className="w-8 h-8 rounded-full bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1">
                  Request Category
                </label>
                <select
                  value={reqCategory}
                  onChange={(e) => setReqCategory(e.target.value)}
                  className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                >
                  <option value="emergency-travel">🚗 Emergency Travel</option>
                  <option value="errands-parcels">📦 Errands &amp; Parcels</option>
                  <option value="peer-tutoring">📚 Notes &amp; Tutoring</option>
                  <option value="hostel-luggage">🏠 Hostel &amp; Luggage</option>
                  <option value="lost-found">🔍 Lost &amp; Found</option>
                  <option value="other">💬 Other</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="e.g. Urgent morning ride to Bhopal Station"
                  className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={reqLocation}
                    onChange={(e) => setReqLocation(e.target.value)}
                    placeholder="e.g. Hostel Block 2 / Main Gate"
                    className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1">
                    Urgency
                  </label>
                  <select
                    value={reqUrgency}
                    onChange={(e) => setReqUrgency(e.target.value)}
                    className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl px-3 py-2 text-xs font-bold text-[#17233C] focus:outline-none focus:border-[#FF572E]"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">🚨 Urgent / High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#6E7587] uppercase block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Specify details, preferred timings, and how peers can help you..."
                  className="w-full bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl p-3 text-xs font-medium text-[#17233C] focus:outline-none focus:border-[#FF572E] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F4E3D8]">
                <button
                  type="button"
                  onClick={() => setIsCreatingRequest(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6E7587] hover:bg-[#FFFBF8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateRequest}
                  disabled={!reqTitle.trim() || !reqDescription.trim() || reqSubmitting}
                  className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {reqSubmitting ? 'Publishing...' : 'Publish Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveShell>
  );
}

