import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useFirebaseAuth } from '../context/FirebaseAuthContext';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import {
  Calendar, Car, Heart, HelpCircle, ChevronRight, LogOut,
  ShieldCheck, Mail, Phone, GraduationCap, BookOpen, Edit3, CheckCircle2,
  ArrowRight, Sparkles, X, User as UserIcon, Download, MessageCircle, ChevronDown
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { saveProfile } from '../lib/api';
import { useAuthProfile } from '../context/AuthProfileContext';
import { useUserProfile, useMyTravels, useMyBookings } from '../hooks/useAppData';
import { queryClient, QUERY_KEYS, invalidateProfileQueries } from '../lib/queryClient';

const COUNTRIES = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useFirebaseAuth();
  const { setWhatsAppNumber: setContextWhatsAppNumber } = useAuthProfile();

  // TanStack Query cached data flow (Instant navigation, zero full-page spinners on return visits)
  const { data: cachedProfile, isLoading: profileLoading } = useUserProfile();
  const { data: myTravels = [], isLoading: travelsLoading } = useMyTravels();
  const { data: myBookings = [], isLoading: bookingsLoading } = useMyBookings();

  // Profile data & counts derived from cache
  const profile = cachedProfile || null;
  const ridesCount = Array.isArray(myTravels) ? myTravels.length : 0;
  const bookingsCount = Array.isArray(myBookings) ? myBookings.length : 0;
  const loading = profileLoading && !cachedProfile;

  // Edit profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWhatsAppNumber, setEditWhatsAppNumber] = useState('');
  const [editWhatsAppCountry, setEditWhatsAppCountry] = useState('IN');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [editCollege, setEditCollege] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sync edit form with cached profile data
  useEffect(() => {
    if (cachedProfile) {
      setEditName(cachedProfile.name || user?.fullName || '');
      
      const savedNumber = (cachedProfile.whatsappNumber || cachedProfile.phone || user?.primaryPhoneNumber?.phoneNumber || '').trim();
      if (savedNumber) {
        try {
          const parsed = parsePhoneNumber(savedNumber);
          if (parsed && parsed.nationalNumber) {
            setEditWhatsAppNumber(parsed.nationalNumber);
            setEditWhatsAppCountry(parsed.country || 'IN');
          } else {
            setEditWhatsAppNumber(savedNumber.replace(/[^\d]/g, ''));
            setEditWhatsAppCountry('IN');
          }
        } catch {
          try {
            const parsedIN = parsePhoneNumber(savedNumber, 'IN');
            setEditWhatsAppNumber(parsedIN?.nationalNumber || savedNumber.replace(/[^\d]/g, ''));
            setEditWhatsAppCountry(parsedIN?.country || 'IN');
          } catch {
            setEditWhatsAppNumber(savedNumber.replace(/[^\d]/g, ''));
            setEditWhatsAppCountry('IN');
          }
        }
      } else {
        setEditWhatsAppNumber('');
        setEditWhatsAppCountry('IN');
      }

      setEditCollege(cachedProfile.college || 'VIT, Bhopal');
      setEditCourse(cachedProfile.course || 'B.Tech Computer Science');
      setEditBio(cachedProfile.bio || '');
    }
  }, [cachedProfile, user]);

  // Handle Edit Profile Save
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const payload = {
        name: editName.trim() || user?.fullName || 'Campus Student',
        email: profile?.email || user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '',
        college: editCollege.trim(),
        course: editCourse.trim(),
        bio: editBio.trim(),
        imageUrl: user?.imageUrl || profile?.imageUrl || ''
      };

      // Validate and canonicalize single WhatsApp number
      const rawNumber = editWhatsAppNumber.trim();
      if (rawNumber) {
        if (!isValidPhoneNumber(rawNumber, editWhatsAppCountry)) {
          const countryName = COUNTRIES.find(c => c.code === editWhatsAppCountry)?.name || 'the selected country';
          setSaveError(`Please enter a valid phone number for ${countryName}.`);
          setIsSaving(false);
          return;
        }
        const parsed = parsePhoneNumber(rawNumber, editWhatsAppCountry);
        const e164 = parsed.number; // e.g. +919876543210
        payload.whatsappNumber = e164;
        payload.phone = e164; // Keep both fields 100% in sync in database
        payload.whatsappCountryCode = editWhatsAppCountry;
      } else {
        // Clearing number
        payload.whatsappNumber = '';
        payload.phone = '';
      }

      const res = await saveProfile(payload);
      const updated = res.data?.data || payload;
      
      // Update TanStack Query cache immediately
      queryClient.setQueryData(QUERY_KEYS.profile(user?.id), updated);
      invalidateProfileQueries();
      
      if (setContextWhatsAppNumber) {
        setContextWhatsAppNumber(payload.whatsappNumber || '');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 1000);
    } catch (err) {
      console.error('Save profile error:', err);
      let msg = 'Failed to update profile.';
      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        msg = 'Server took too long to respond. The server may be waking up, please try again in a moment.';
      } else if (err.response) {
        msg = err.response.data?.message || (err.response.status === 401 ? 'Session expired. Please sign in again.' : 'Failed to update profile.');
      } else if (err.request || err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        msg = 'Unable to connect. Please check your internet connection and try again.';
      } else if (err.message) {
        msg = err.message;
      }
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const navMenuItems = [
    { icon: Car, label: 'Offers & Requests', subtitle: 'Manage your campus travel posts', path: '/rides/offer' },
    { icon: Download, label: 'Install Helpu App', subtitle: 'Fast offline access & home screen alerts', onClick: () => window.dispatchEvent(new CustomEvent('pwa-prompt-install')) },
    { icon: Heart, label: 'Saved Rides', subtitle: 'Frequently used routes & bookmarks', path: '/saved' },
    { icon: HelpCircle, label: 'Campus Help & Support', subtitle: 'Campus assistance and student FAQs', path: '/help' },
  ];

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      customMobileHeader={
        <AppHeader 
          title="Student Profile" 
          backTo={-1} 
          src={profile?.imageUrl || user?.imageUrl}
        />
      }
    >
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 space-y-3 sm:space-y-4 lg:space-y-4">
        
        {/* ========================================================================= */}
        {/* 1. HERO PROFILE CARD (Matching Reference Image 1)                         */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-[22px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden"
        >
          {/* Campus Illustration Background Header */}
          <div className="h-28 sm:h-36 lg:h-44 relative overflow-hidden bg-gradient-to-br from-[#FFF7F0] via-[#FFE8D6] to-[#FFF5ED]">
            <div 
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage: 'url(/assets/footer-campus.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat'
              }}
            />
            {/* Soft gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/40 pointer-events-none" />
          </div>

          {/* Profile Content */}
          <div className="px-4 sm:px-6 pb-4 sm:pb-5 -mt-8 sm:-mt-12 lg:-mt-14 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
              
              {/* Avatar + Name Details */}
              <div className="flex items-center sm:items-end gap-3 sm:gap-4 min-w-0">
                {/* Avatar with Orange Ring & Verified Checkmark Badge */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] border-[#FF572E] bg-[#FF572E]/10 p-0 shadow-md flex items-center justify-center overflow-hidden">
                    <Avatar 
                      src={user?.imageUrl || profile?.imageUrl}
                      name={profile?.name || user?.fullName}
                      email={profile?.email || user?.primaryEmailAddress?.emailAddress}
                      size="full"
                      className="w-full h-full aspect-square object-cover"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#16A34A] border-2 border-white flex items-center justify-center shadow-md z-10 pointer-events-none">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white stroke-[2.8]" />
                  </div>
                </div>

                {/* Name, Badge, College, Email */}
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="font-black text-[#17233C] text-base sm:text-xl lg:text-2xl tracking-tight truncate">
                      {profile?.name || user?.fullName || 'Campus Student'}
                    </h1>
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-white bg-[#16A34A] px-2.5 py-0.5 rounded-full shadow-2xs shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                      <span>Verified Student</span>
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs text-[#6E7587]">
                    <div className="flex items-center gap-1.5 truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-[#FF572E] shrink-0" />
                      <span className="font-bold text-[#17233C] text-[11px] sm:text-xs truncate">{profile?.college || 'VIT, Bhopal'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-[#8C93A4] shrink-0" />
                      <span className="font-medium text-[10.5px] sm:text-xs truncate max-w-[220px] sm:max-w-xs md:max-w-md">
                        {user?.primaryEmailAddress?.emailAddress || profile?.email}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit Profile Button */}
              <div className="shrink-0 flex justify-end pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2 bg-[#FF572E] hover:bg-[#E64A22] active:scale-95 text-white rounded-full text-xs font-black shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Edit Profile</span>
                </button>
              </div>

            </div>
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 2. THREE STATISTIC CARDS (Side-by-side on all screens)                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          
          {/* Card 1: Rides Offered */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="bg-white rounded-[18px] sm:rounded-[22px] p-2.5 sm:p-4 border border-[#F4E3D8] shadow-xs flex flex-col items-center text-center justify-between"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center shrink-0 mb-1 sm:mb-2">
              <Car className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#17233C] leading-none mb-1">
                {ridesCount}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] leading-tight">
                Rides Offered
              </div>
            </div>
          </motion.div>

          {/* Card 2: Campus Bookings */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="bg-white rounded-[18px] sm:rounded-[22px] p-2.5 sm:p-4 border border-[#F4E3D8] shadow-xs flex flex-col items-center text-center justify-between"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0 mb-1 sm:mb-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-black text-xl sm:text-2xl text-[#17233C] leading-none mb-1">
                {bookingsCount}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] leading-tight">
                Campus Bookings
              </div>
            </div>
          </motion.div>

          {/* Card 3: Student Verification (Active) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="bg-white rounded-[18px] sm:rounded-[22px] p-2.5 sm:p-4 border border-[#F4E3D8] shadow-xs flex flex-col items-center text-center justify-between"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0 mb-1 sm:mb-2">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="font-black text-lg sm:text-2xl text-[#16A34A] leading-none mb-1">
                Active
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] leading-tight">
                Student Verification
              </div>
            </div>
          </motion.div>

        </div>


        {/* ========================================================================= */}
        {/* 4. ABOUT ME SECTION (Responsive)                                           */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="bg-white rounded-[16px] sm:rounded-[20px] lg:rounded-[24px] p-3 sm:p-4 lg:p-5 border border-[#F4E3D8]/90 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-2.5 sm:mb-3">
            <h3 className="font-black text-[#17233C] text-sm sm:text-base flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF572E]" />
              <span>About Me</span>
            </h3>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs sm:text-sm font-bold text-[#FF572E] hover:underline cursor-pointer"
            >
              {profile?.bio ? 'Edit' : 'Add'}
            </button>
          </div>

          {profile?.bio ? (
            <div className="p-3 sm:p-3.5 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8]">
              <p className="text-xs sm:text-sm text-[#17233C] font-medium leading-relaxed">
                {profile.bio}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full p-3 sm:p-3.5 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-dashed border-[#F4E3D8] hover:border-[#FF572E]/40 hover:bg-white cursor-pointer transition-all group"
            >
              <p className="text-xs sm:text-sm text-[#6E7587] group-hover:text-[#FF572E] font-medium text-center">
                💬 Add something about yourself
              </p>
            </button>
          )}
        </motion.div>


        {/* ========================================================================= */}
        {/* 5. ACADEMIC & CONTACT DETAILS (Responsive Layout)                          */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-white rounded-[16px] sm:rounded-[20px] lg:rounded-[24px] p-3 sm:p-4 lg:p-5 border border-[#F4E3D8]/90 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base lg:text-lg font-black text-[#17233C]">
              Academic & Contact Details
            </h2>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs sm:text-sm font-bold text-[#FF572E] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5 text-xs sm:text-sm">
            
            <div className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/30 transition-colors">
              <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] uppercase tracking-wide mb-0.5">
                  Full Name
                </div>
                <div className="font-black text-[#17233C] truncate">
                  {profile?.name || user?.fullName || 'Campus Student'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/30 transition-colors">
              <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] uppercase tracking-wide mb-0.5">
                  College Email
                </div>
                <div className="font-black text-[#17233C] truncate">
                  {user?.primaryEmailAddress?.emailAddress || profile?.email || 'student@vitbhopal.ac.in'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/30 transition-colors">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] uppercase tracking-wide mb-0.5">
                  WhatsApp Number
                </div>
                <div className="font-black text-[#17233C] flex items-center gap-1.5">
                  <img
                    src="/whatsapp.svg"
                    alt="WhatsApp"
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <span className="truncate">{profile?.whatsappNumber || profile?.phone || 'Not added yet'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/30 transition-colors">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] uppercase tracking-wide mb-0.5">
                  College / Institution
                </div>
                <div className="font-black text-[#17233C] truncate">
                  {profile?.college || 'VIT, Bhopal'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-[#FFFBF8] rounded-lg sm:rounded-xl border border-[#F4E3D8] hover:border-[#FF572E]/30 transition-colors lg:col-span-2">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF572E] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-xs font-bold text-[#6E7587] uppercase tracking-wide mb-0.5">
                  Program & Course
                </div>
                <div className="font-black text-[#17233C]">
                  {profile?.course || 'B.Tech - Computer Science & Engineering'}
                </div>
              </div>
            </div>

          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 6. QUICK NAVIGATION (Responsive Grid)                                      */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="bg-white rounded-[16px] sm:rounded-[20px] lg:rounded-[24px] p-3 sm:p-4 lg:p-5 border border-[#F4E3D8]/90 shadow-sm hover:shadow-md transition-all"
        >
          <h3 className="font-black text-[#17233C] text-sm sm:text-base lg:text-lg mb-3 sm:mb-3.5">
            Quick Navigation
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            {navMenuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.onClick) item.onClick();
                    else if (item.path) navigate(item.path);
                  }}
                  className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 hover:bg-[#FFFBF8] rounded-lg sm:rounded-xl transition-all cursor-pointer group border border-transparent hover:border-[#F4E3D8]"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#FFF4ED] text-[#FF572E] group-hover:bg-[#FF572E] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                    <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-black text-xs sm:text-sm text-[#17233C] group-hover:text-[#FF572E] transition-colors">
                      {item.label}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-[#6E7587] font-medium line-clamp-1">
                      {item.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#6E7587] group-hover:text-[#FF572E] transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 7. SIGN OUT BUTTON (Responsive)                                            */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="pt-1 pb-3 sm:pb-4 flex justify-center"
        >
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 font-black text-xs sm:text-sm border border-red-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Sign Out</span>
          </button>
        </motion.div>

      </div>


      {/* ========================================================================= */}
      {/* EDIT PROFILE MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditing && (
          <div 
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setIsEditing(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-6 sm:p-8 max-w-lg w-full border border-[#F4E3D8] shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[#F4E3D8]/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-[#17233C] text-base sm:text-lg">
                    Edit Student Profile
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-8 h-8 rounded-full bg-[#FFFBF8] hover:bg-[#F4E3D8] text-[#6E7587] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all"
                    required
                  />
                </div>

                {/* Single Canonical WhatsApp Number Field */}
                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1.5 flex items-center gap-1.5">
                    <img
                      src="/whatsapp.svg"
                      alt="WhatsApp"
                      className="w-4 h-4 object-contain"
                    />
                    <span>WhatsApp Number</span>
                  </label>
                  
                  {/* Country Selector */}
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl text-left text-xs font-semibold text-[#17233C] hover:bg-white hover:border-[#FF572E]/40 transition-all focus:outline-none"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{COUNTRIES.find(c => c.code === editWhatsAppCountry)?.flag || '🇮🇳'}</span>
                        <span className="font-bold">{COUNTRIES.find(c => c.code === editWhatsAppCountry)?.name || 'India'}</span>
                        <span className="text-[#6E7587]">({COUNTRIES.find(c => c.code === editWhatsAppCountry)?.dial || '+91'})</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[#6E7587] transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown */}
                    {showCountryDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-[#F4E3D8] rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setEditWhatsAppCountry(country.code);
                              setShowCountryDropdown(false);
                              setSaveError('');
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#17233C] hover:bg-[#FFF7F2] transition-colors text-left"
                          >
                            <span className="text-base">{country.flag}</span>
                            <span className="flex-1 font-bold">{country.name}</span>
                            <span className="text-[#6E7587]">{country.dial}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Number Input */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#FFF2EB] border border-[#FCD8C5] rounded-xl text-xs font-black text-[#17233C] select-none shrink-0">
                      <span>{COUNTRIES.find(c => c.code === editWhatsAppCountry)?.dial || '+91'}</span>
                    </div>
                    <input
                      type="tel"
                      value={editWhatsAppNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setEditWhatsAppNumber(value);
                        setSaveError('');
                      }}
                      placeholder="9876543210"
                      className="flex-1 bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-[#6E7587] mt-1.5 flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Used for instant ride coordination with confirmed students.</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                    College / Campus
                  </label>
                  <input
                    type="text"
                    value={editCollege}
                    onChange={(e) => setEditCollege(e.target.value)}
                    placeholder="VIT, Bhopal"
                    className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1.5">
                    Program / Course
                  </label>
                  <input
                    type="text"
                    value={editCourse}
                    onChange={(e) => setEditCourse(e.target.value)}
                    placeholder="B.Tech Computer Science"
                    className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all"
                  />
                </div>

                {/* Bio / About Me (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-[#17233C] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-[#FF572E]" />
                      <span>About Me (Optional)</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#6E7587]">
                      {editBio.length}/200
                    </span>
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => {
                      if (e.target.value.length <= 200) {
                        setEditBio(e.target.value);
                      }
                    }}
                    placeholder="Share your travel preferences, hobbies, or something interesting about yourself..."
                    rows={3}
                    className="w-full bg-[#FFFBF8] rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-semibold text-[#17233C] border border-[#F4E3D8] focus:border-[#FF572E] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/15 transition-all resize-none"
                  />
                  <p className="text-[11px] text-[#6E7587] mt-1.5">
                    💡 This helps other students know you better for campus carpooling
                  </p>
                </div>

                {saveError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">
                    {saveError}
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-3 rounded-xl bg-[#EDFAF3] text-[#16A34A] text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Profile updated successfully!</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-xs font-bold text-[#6E7587] hover:text-[#17233C] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white font-bold text-xs rounded-full shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </ResponsiveShell>
  );
}
