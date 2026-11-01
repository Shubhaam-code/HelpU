import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import {
  Calendar, Car, Heart, HelpCircle, Settings, ChevronRight, Star, LogOut
} from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { Avatar } from '../components/ui/Avatar';
import { AVATARS } from '../lib/avatars';
import { getProfile, saveProfile } from '../lib/api';

function AvatarPicker({ current, onSelect }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4" onClick={(e) => e.target === e.currentTarget && onSelect(null)}>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl p-6 w-full max-w-[390px]"
      >
        <h3 className="font-bold text-navy text-lg mb-4 text-center">Choose your avatar</h3>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {AVATARS.map((av) => (
            <motion.button
              key={av.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSelect(av.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
                current === av.id ? 'bg-coral/10 ring-2 ring-coral' : 'hover:bg-gray-50'
              }`}
            >
              <Avatar avatarId={av.id} size="sm" />
              <span className="text-[9px] font-medium text-text-secondary">{av.label}</span>
            </motion.button>
          ))}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="w-full py-3 text-center text-text-secondary font-medium text-sm"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useUser();
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
    <div className="min-h-dvh bg-cream pb-24">
      {/* Campus illustration header */}
      <div className="relative h-44 overflow-hidden">
        <svg viewBox="0 0 430 176" fill="none" className="absolute inset-0 w-full h-full">
          <rect width="430" height="176" fill="#BBDFFF" />
          {/* Sky gradient */}
          <rect width="430" height="176" fill="url(#skyGrad)" />
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BBDFFF" />
              <stop offset="100%" stopColor="#E9E0FF" />
            </linearGradient>
          </defs>
          {/* Sun */}
          <circle cx="350" cy="50" r="35" fill="#FFE6CB" opacity="0.9" />
          <circle cx="350" cy="50" r="25" fill="#FF654F" opacity="0.4" />
          {/* Campus building */}
          <rect x="150" y="60" width="130" height="116" rx="4" fill="#E9E0FF" />
          <rect x="180" y="40" width="70" height="36" rx="4" fill="#C9F2DE" />
          <path d="M145 60 L215 20 L285 60" fill="#BBDFFF" />
          <rect x="192" y="100" width="20" height="30" rx="3" fill="#17233C" opacity="0.5" />
          <rect x="218" y="100" width="20" height="30" rx="3" fill="#17233C" opacity="0.5" />
          <rect x="192" y="136" width="48" height="40" rx="3" fill="#FF654F" opacity="0.6" />
          {/* Trees */}
          <circle cx="80" cy="130" r="30" fill="#C9F2DE" />
          <rect x="76" y="148" width="8" height="28" fill="#8B6914" />
          <circle cx="370" cy="120" r="25" fill="#C9F2DE" />
          <rect x="366" y="136" width="8" height="40" fill="#8B6914" />
          {/* Ground */}
          <rect x="0" y="155" width="430" height="21" fill="#C9F2DE" rx="0" />
        </svg>

        {/* Back button */}
        <AppHeader backTo={false} />
      </div>

      {/* Profile card */}
      <div className="px-5 -mt-14 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          {/* Avatar with edit button */}
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="relative mb-3"
          >
            <Avatar avatarId={profile?.avatarId} size="2xl" ring />
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-coral rounded-full border-2 border-white flex items-center justify-center shadow-sm">
              <span className="text-white text-sm">✏️</span>
            </div>
          </button>

          <h2 className="font-black text-navy text-2xl">{profile?.name || user?.fullName || 'Your Name'}</h2>
          <p className="text-text-secondary text-sm mt-0.5">
            {profile?.college ? `${profile.college} • BTech CSE` : 'Complete your profile'}
          </p>

          {/* Stats */}
          <div className="flex w-full mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {[
              { label: 'Rides', value: '12' },
              { label: 'Bookings', value: '8' },
              { label: 'Rating', value: '4.9' },
            ].map((s, i) => (
              <div key={s.label} className={`flex-1 text-center py-4 ${i < 2 ? 'border-r border-gray-100' : ''}`}>
                <div className="font-black text-navy text-xl">{s.value}</div>
                <div className="text-text-secondary text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Menu */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                onClick={() => navigate(item.path)}
                whileTap={{ backgroundColor: '#FFF9F2' }}
                className={`w-full flex items-center gap-4 px-5 py-4 ${i < menuItems.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-cream transition-colors`}
              >
                <div className="w-9 h-9 bg-cream rounded-xl flex items-center justify-center">
                  <Icon className="w-4 h-4 text-coral" />
                </div>
                <span className="flex-1 text-left font-medium text-navy text-sm">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </motion.button>
            );
          })}
        </motion.div>

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => signOut()}
          className="mt-4 w-full flex items-center justify-center gap-2 py-4 text-red-500 font-semibold text-sm hover:bg-red-50 rounded-2xl transition"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </motion.button>
      </div>

      {showAvatarPicker && (
        <AvatarPicker current={profile?.avatarId} onSelect={handleAvatarSelect} />
      )}

      <BottomNavigation />
    </div>
  );
}
