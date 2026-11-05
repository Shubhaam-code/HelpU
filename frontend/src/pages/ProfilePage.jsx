import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/clerk-react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import {
  Calendar, Car, Heart, HelpCircle, ChevronRight, LogOut,
  ShieldCheck, Mail, Phone, GraduationCap, BookOpen, Edit3, CheckCircle2,
  ArrowRight, Sparkles, X, User as UserIcon, Download, MessageCircle, ChevronDown
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { getProfile, saveProfile, getMyBookings, getMyTravels } from '../lib/api';
import { useAuthProfile } from '../context/AuthProfileContext';

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
  const { signOut } = useClerk();
  const { setWhatsAppNumber: setContextWhatsAppNumber } = useAuthProfile();

  // Data states
  const [profile, setProfile] = useState(null);
  const [ridesCount, setRidesCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [profRes, bookingsRes, travelsRes] = await Promise.allSettled([
        getProfile(),
        getMyBookings(),
        getMyTravels(),
      ]);

      if (profRes.status === 'fulfilled') {
        const p = profRes.value.data?.data;
        setProfile(p);
        setEditName(p?.name || user?.fullName || '');
        
        // Resolve canonical saved number from whatsappNumber or phone
        const savedNumber = (p?.whatsappNumber || p?.phone || user?.primaryPhoneNumber?.phoneNumber || '').trim();
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
        
        setEditCollege(p?.college || 'VIT, Bhopal');
        setEditCourse(p?.course || 'B.Tech Computer Science');
        setEditBio(p?.bio || '');
      }
      if (bookingsRes.status === 'fulfilled') {
        const bList = bookingsRes.value.data?.data || bookingsRes.value.data?.bookings || [];
        setBookingsCount(Array.isArray(bList) ? bList.length : 0);
      }
      if (travelsRes.status === 'fulfilled') {
        const list = travelsRes.value.data?.data || travelsRes.value.data?.travels || [];
        setRidesCount(Array.isArray(list) ? list.length : 0);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
      setProfile(updated);
      
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
      setSaveError(err.response?.data?.message || err.message || 'Failed to update profile.');
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
          backTo={false} 
          src={profile?.imageUrl || user?.imageUrl}
        />
      }
    >
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. HERO PROFILE CARD                                                      */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-[32px] border border-[#F4E3D8]/90 shadow-xs overflow-hidden"
        >
          {/* Warm decorative cover banner with cta-road.png background */}
          <div className="h-32 sm:h-40 bg-gradient-to-r from-[#FFF0E7] via-[#FFE5D8] to-[#FFF5ED] relative overflow-hidden">
            {/* Background Image - positioned lower with increased opacity */}
            <div 
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage: 'url(/assets/cta-road.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center bottom',
                backgroundRepeat: 'no-repeat'
              }}
            />
            {/* Lighter gradient overlay for better visibility */}
            <div className="absolute right-0 top-0 bottom-0 w-2/3 bg-gradient-to-l from-white/20 to-transparent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#FF572E]/8 blur-xl pointer-events-none" />
            <div className="absolute top-4 right-5 sm:right-7 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 text-[#FF572E] text-xs font-black shadow-xs backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Verified Student</span>
              </span>
            </div>
          </div>

          {/* Profile Details Container */}
          <div className="px-6 sm:px-8 pb-7 -mt-16 sm:-mt-20 relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            
            {/* Avatar & Names */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <div className="relative">
                <Avatar 
                  src={user?.imageUrl || profile?.imageUrl}
                  name={profile?.name || user?.fullName}
                  email={profile?.email || user?.primaryEmailAddress?.emailAddress}
                  size={96}
                  ring
                  className="shadow-md border-4 border-white"
                />
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#16A34A] border-2 border-white flex items-center justify-center text-white text-[10px] shadow-xs">
                  ✓
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="font-black text-[#17233C] text-xl sm:text-2xl tracking-tight">
                    {profile?.name || user?.fullName || 'Campus Student'}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#3B82F6] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ID Verified</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#6E7587]">
                  <span className="flex items-center gap-1 font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 text-[#FF572E]" />
                    <span>{profile?.college || 'VIT, Bhopal'}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-semibold text-[#17233C]">
                    <Mail className="w-3.5 h-3.5 text-[#8C93A4]" />
                    <span className="truncate max-w-[200px]">{user?.primaryEmailAddress?.emailAddress || profile?.email}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Edit Profile CTA */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-[#FFF7F2] text-[#17233C] hover:text-[#FF572E] border border-[#F4E3D8] hover:border-[#FF572E]/40 rounded-full text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#FF572E]" />
                <span>Edit Profile</span>
              </button>
            </div>

          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 2. STATS ROW (3 CLEAN CARDS)                                              */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          
          <div className="bg-white rounded-[24px] p-5 border border-[#F4E3D8]/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center shrink-0">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-black text-2xl text-[#17233C] block leading-tight">
                {ridesCount}
              </span>
              <span className="text-xs font-bold text-[#6E7587]">
                Rides Offered
              </span>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-[#F4E3D8]/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-black text-2xl text-[#17233C] block leading-tight">
                {bookingsCount}
              </span>
              <span className="text-xs font-bold text-[#6E7587]">
                Campus Bookings
              </span>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-[#F4E3D8]/90 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-black text-2xl text-[#16A34A] block leading-tight">
                Active
              </span>
              <span className="text-xs font-bold text-[#6E7587]">
                Student Verification
              </span>
            </div>
          </div>

        </div>


        {/* ========================================================================= */}
        {/* 2.5. PERSONAL BIO SECTION (OPTIONAL)                                      */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#FF572E] flex items-center justify-center shrink-0">
                <MessageCircle className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-black text-[#17233C] text-sm sm:text-base">
                  About Me
                </h3>
                <p className="text-[10px] sm:text-xs text-[#6E7587] font-medium">
                  Share something about yourself (optional)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
            >
              {profile?.bio ? 'Edit' : 'Add'}
            </button>
          </div>

          {profile?.bio ? (
            <div className="p-4 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <p className="text-sm text-[#17233C] font-medium leading-relaxed">
                {profile.bio}
              </p>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditing(true)}
              className="p-4 bg-[#FFFBF8] rounded-2xl border border-dashed border-[#F4E3D8] hover:border-[#FF572E]/40 hover:bg-white cursor-pointer transition-all group"
            >
              <p className="text-xs text-[#6E7587] group-hover:text-[#FF572E] font-medium text-center">
                💬 Click to add a personal message about your travel preferences, hobbies, or campus life
              </p>
            </div>
          )}
        </motion.div>


        {/* ========================================================================= */}
        {/* 3. PROFILE INFORMATION & VERIFIED DETAILS CARD                            */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-[#F4E3D8]/90 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#F4E3D8]/70 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#17233C]">
                Academic & Contact Details
              </h2>
              <p className="text-xs text-[#6E7587] font-medium mt-0.5">
                Verified campus credentials for carpooling and ridesharing trust.
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-[#FF572E] hover:underline cursor-pointer"
            >
              Edit Details
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block mb-1">
                Full Name
              </span>
              <span className="font-extrabold text-[#17233C] text-sm block">
                {profile?.name || user?.fullName || 'Campus Student'}
              </span>
            </div>

            <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block mb-1">
                College Email Address
              </span>
              <span className="font-extrabold text-[#17233C] text-sm block truncate">
                {user?.primaryEmailAddress?.emailAddress || profile?.email || 'student@vitbhopal.ac.in'}
              </span>
            </div>

            <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block mb-1">
                WhatsApp Number
              </span>
              <div className="flex items-center gap-2">
                <img
                  src="/whatsapp.svg"
                  alt="WhatsApp"
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="font-extrabold text-[#17233C] text-sm block">
                  {profile?.whatsappNumber || profile?.phone || 'Not added yet'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block mb-1">
                College / Institution
              </span>
              <span className="font-extrabold text-[#17233C] text-sm block">
                {profile?.college || 'VIT, Bhopal'}
              </span>
            </div>

            <div className="p-3.5 bg-[#FFFBF8] rounded-2xl border border-[#F4E3D8] sm:col-span-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E7587] block mb-1">
                Program & Course
              </span>
              <span className="font-extrabold text-[#17233C] text-sm block">
                {profile?.course || 'B.Tech - Computer Science & Engineering'}
              </span>
            </div>

          </div>
        </div>


        {/* ========================================================================= */}
        {/* 4. QUICK LINKS / MENU                                                     */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-[#F4E3D8]/90 shadow-xs">
          <h3 className="font-black text-[#17233C] text-base mb-4 px-2">
            Quick Navigation
          </h3>

          <div className="divide-y divide-[#F4E3D8]/60">
            {navMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  onClick={() => {
                    if (item.onClick) item.onClick();
                    else if (item.path) navigate(item.path);
                  }}
                  className="flex items-center justify-between p-3.5 hover:bg-[#FFFBF8] rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF4ED] text-[#FF572E] group-hover:bg-[#FF572E] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                      <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[#17233C] text-xs sm:text-sm group-hover:text-[#FF572E] transition-colors">
                        {item.label}
                      </h4>
                      <p className="text-[11px] text-[#6E7587]">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="w-7 h-7 rounded-full bg-white border border-[#F4E3D8] flex items-center justify-center text-[#6E7587] group-hover:text-[#FF572E] group-hover:border-[#FF572E]/40 shadow-2xs transition-all">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* ========================================================================= */}
        {/* 5. LOGOUT BUTTON                                                          */}
        {/* ========================================================================= */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs sm:text-sm transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>

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
