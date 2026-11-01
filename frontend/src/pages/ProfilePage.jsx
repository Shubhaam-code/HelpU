import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Calendar, Car, Heart, HelpCircle, Settings, ChevronRight, LogOut
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { AVATARS } from '../lib/avatars';
import { getProfile, saveProfile } from '../lib/api';

function AvatarPicker({ current, onSelect }) {
  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs" 
      onClick={(e) => e.target === e.currentTarget && onSelect(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="font-extrabold text-navy text-lg mb-4 text-center">
          Choose Your Campus Avatar
        </h3>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {AVATARS.map((av) => (
            <motion.button
              key={av.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSelect(av.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all cursor-pointer ${
                current === av.id ? 'bg-coral/10 ring-2 ring-coral' : 'hover:bg-cream'
              }`}
            >
              <Avatar avatarId={av.id} size="sm" />
              <span className="text-[10px] font-bold text-navy">{av.label}</span>
            </motion.button>
          ))}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="w-full py-2.5 text-center text-text-secondary font-bold text-xs hover:text-navy cursor-pointer"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await getProfile();
      setProfile(res.data?.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleAvatarSelect = async (avatarId) => {
    if (!avatarId) { setShowAvatarPicker(false); return; }
    try {
      await saveProfile({ ...profile, avatarId });
      setProfile((p) => ({ ...p, avatarId }));
    } catch (err) {
      console.error(err);
    }
    setShowAvatarPicker(false);
  };

  const menuItems = [
    { icon: Calendar, label: 'My Bookings', path: '/bookings' },
    { icon: Car, label: 'My Offers & Requests', path: '/rides' },
    { icon: Heart, label: 'Saved Rides', path: '/saved' },
    { icon: HelpCircle, label: 'Help & Support', path: '/support' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <ResponsiveShell
      avatarId={profile?.avatarId}
      customMobileHeader={<AppHeader title="Profile" backTo={false} />}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 lg:py-8">
        
        {/* Profile Card Container */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
          
          {/* Header Banner Illustration */}
          <div className="relative h-44 sm:h-52 bg-gradient-to-r from-sky via-lavender to-peach overflow-hidden">
            <svg viewBox="0 0 430 176" fill="none" className="absolute inset-0 w-full h-full object-cover">
              <circle cx="350" cy="50" r="35" fill="#FFE6CB" opacity="0.9" />
              <rect x="150" y="60" width="130" height="116" rx="4" fill="#E9E0FF" />
              <rect x="180" y="40" width="70" height="36" rx="4" fill="#C9F2DE" />
              <path d="M145 60 L215 20 L285 60" fill="#BBDFFF" />
              <circle cx="80" cy="130" r="30" fill="#C9F2DE" />
              <circle cx="370" cy="120" r="25" fill="#C9F2DE" />
              <rect x="0" y="155" width="430" height="21" fill="#C9F2DE" />
            </svg>
          </div>

          {/* Profile Details */}
          <div className="px-6 pb-8 -mt-16 sm:-mt-20 relative z-10 flex flex-col items-center">
            
            {/* Avatar with edit badge */}
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="relative group cursor-pointer"
            >
              <Avatar avatarId={profile?.avatarId} size="2xl" ring />
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-coral rounded-full border-2 border-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <span className="text-white text-xs">✏️</span>
              </div>
            </button>

            <h2 className="font-black text-navy text-2xl sm:text-3xl mt-3">
              {profile?.name || user?.fullName || 'Shubham Narayan'}
            </h2>
            <p className="text-text-secondary text-sm font-medium mt-1">
              {profile?.college ? `${profile.college} • BTech CSE` : 'VIT Bhopal • BTech CSE'}
            </p>

            {/* Stats Row */}
            <div className="flex w-full max-w-md mt-6 bg-cream/60 rounded-2xl border border-gray-100 overflow-hidden divide-x divide-gray-100">
              {[
                { label: 'Rides', value: '12' },
                { label: 'Bookings', value: '8' },
                { label: 'Rating', value: '4.9 ★' },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center py-3.5">
                  <div className="font-black text-navy text-lg sm:text-xl">{s.value}</div>
                  <div className="text-text-secondary text-[11px] font-bold mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Menu Links */}
            <div className="w-full mt-6 bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-cream/40 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 bg-cream rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-coral" />
                    </div>
                    <span className="flex-1 font-bold text-navy text-sm">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </button>
                );
              })}
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => signOut()}
              className="mt-6 w-full max-w-xs flex items-center justify-center gap-2 py-3.5 text-red-500 font-bold text-sm bg-red-50/70 hover:bg-red-50 rounded-2xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>

          </div>

        </div>

      </div>

      {showAvatarPicker && (
        <AvatarPicker current={profile?.avatarId} onSelect={handleAvatarSelect} />
      )}
    </ResponsiveShell>
  );
}
