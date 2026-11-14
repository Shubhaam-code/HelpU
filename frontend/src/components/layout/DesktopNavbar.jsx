import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Car, Users, CarTaxiFront, Info, Search, Bell, Menu, X, LogOut, User, FileText, Download, CheckCircle2, CalendarDays
} from 'lucide-react';
import { useUser, useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { useAuthProfile } from '../../context/AuthProfileContext';
import { Avatar } from '../ui/Avatar';
import { getUnreadCount } from '../../lib/api';

/**
 * Helpu Desktop Navigation Header
 * Exactly FIVE navigation items:
 * 1. Home
 * 2. Ride
 * 3. Matching
 * 4. Group
 * 5. About (visible only on desktop)
 * 
 * Features:
 * - Professional branding & responsive layout
 * - High-contrast active pill states
 * - Global search bar & notification bell with live badge
 * - Header profile access with quick menu
 */
const DESKTOP_NAV_ITEMS = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/rides/offer', icon: Car, label: 'Ride' },
  { path: '/match', icon: Users, label: 'Matching' },
  { path: '/shared-rides', icon: CarTaxiFront, label: 'Group' },
  { path: '/about', icon: Info, label: 'About' },
];

export function DesktopNavbar({ avatarId, unreadCount = 0, onToggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useFirebaseAuth();
  const { profile } = useAuthProfile();
  const resolvedDisplayName = profile?.name || user?.fullName || 'Campus Student';
  
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);
  const profileContainerRef = useRef(null);

  // Sync and fetch actual unread notification count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount({ module: 'poolmate' });
      const count = res?.data?.unreadCount ?? res?.data?.count ?? res?.data?.data?.count;
      if (typeof count === 'number') {
        setLiveUnreadCount(count);
      }
    } catch {
      // Gracefully fall back
    }
  }, []);

  useEffect(() => {
    if (typeof unreadCount === 'number' && unreadCount > 0) {
      setLiveUnreadCount(unreadCount);
    }
  }, [unreadCount]);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 15000);
    const handleUpdate = () => refreshUnreadCount();
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [refreshUnreadCount, location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileContainerRef.current && !profileContainerRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const userProfileImage = user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl || user?.profileImageUrl;

  const isActive = (path) => {
    const current = location.pathname;
    if (path === '/home') {
      return current === '/home' || current === '/';
    }
    if (path === '/rides/offer') {
      return current.startsWith('/rides') || current.startsWith('/book');
    }
    if (path === '/match') {
      return current.startsWith('/match') || current.startsWith('/matches');
    }
    if (path === '/shared-rides') {
      return current.startsWith('/shared-rides') || current.startsWith('/groups');
    }
    if (path === '/about') {
      return current.startsWith('/about');
    }
    return current.startsWith(path);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFF8F3]/95 backdrop-blur-md border-b border-[#F4E3D8] px-4 lg:px-8 py-2.5 transition-all">
      <div className="max-w-[1536px] mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Hamburger (for tablet drawer) + Helpu Brand Logo */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button 
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 text-[#17233C] hover:bg-white rounded-xl border border-[#F4E3D8] transition-colors cursor-pointer"
              aria-label="Toggle Navigation Drawer"
            >
              {isSidebarOpen ? <X className="w-5 h-5 text-[#17233C]" /> : <Menu className="w-5 h-5 text-[#17233C]" />}
            </button>
          )}

          <button 
            type="button"
            onClick={() => navigate('/home')} 
            className="flex items-center shrink-0 cursor-pointer focus:outline-none transition-transform duration-150 hover:opacity-95 active:scale-95"
            aria-label="HelpU Home"
          >
            <img 
              src="/logo.png" 
              alt="HelpU" 
              className="h-8 sm:h-9 w-auto object-contain select-none" 
              draggable="false"
            />
          </button>
        </div>

        {/* Center: EXACTLY FIVE Desktop Navigation Links */}
        <nav aria-label="Desktop Navigation" className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer select-none ${
                  active
                    ? 'bg-[#FFEBE0] text-[#FF572E] font-black border border-[#FDD0BE] shadow-xs'
                    : 'text-[#6E7587] hover:text-[#17233C] hover:bg-white/80 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#FF572E]' : 'text-[#6E7587]'}`} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Notifications, Profile Access */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Quick search input */}
          <form onSubmit={handleSearchSubmit} className="hidden xl:block relative w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C93A4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destination or routes..."
              className="w-full bg-white rounded-full py-2 pl-9.5 pr-4 text-xs font-semibold text-[#17233C] placeholder:text-[#8C93A4] border border-[#F4E3D8] shadow-2xs focus:outline-none focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/15 transition-all"
            />
          </form>

          {/* Notification bell */}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative p-2 sm:p-2.5 text-[#17233C] bg-white hover:bg-[#FFF9F5] rounded-full transition-all duration-150 border border-[#F4E3D8] shadow-2xs active:scale-95 focus:outline-none cursor-pointer flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-[#17233C]" />
            {liveUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#FF572E] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {liveUnreadCount > 99 ? '99+' : liveUnreadCount}
              </span>
            )}
          </button>

          {/* Header Profile Access & Dropdown */}
          <div className="relative" ref={profileContainerRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              aria-label="User profile menu"
              className="relative flex items-center p-0.5 rounded-full transition-all duration-150 hover:ring-2 hover:ring-[#FF572E]/40 focus:outline-none cursor-pointer group"
            >
              <div className="relative rounded-full p-[1.5px] bg-gradient-to-tr from-[#FF572E]/40 via-transparent to-[#FF572E]/20 group-hover:from-[#FF572E] group-hover:to-[#FF572E] transition-all">
                <Avatar 
                  src={profile?.imageUrl || userProfileImage} 
                  name={resolvedDisplayName} 
                  email={profile?.email || user?.primaryEmailAddress?.emailAddress}
                  size="sm" 
                  className="border border-white shadow-xs"
                />
              </div>
            </button>

            {profileDropdownOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#F4E3D8] py-2 z-50 animate-in fade-in slide-in-from-top-2"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-[#F4E3D8]/60 flex items-center gap-3">
                  <Avatar 
                    src={profile?.imageUrl || userProfileImage}
                    name={resolvedDisplayName} 
                    email={profile?.email || user?.primaryEmailAddress?.emailAddress} 
                    size={38} 
                    className="border border-[#F4E3D8] shadow-2xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[#17233C] text-xs truncate leading-snug">
                      {resolvedDisplayName}
                    </div>
                    <div className="text-[11px] text-[#6E7587] truncate mt-0.5 font-medium">
                      {profile?.email || user?.primaryEmailAddress?.emailAddress || 'student@vitbhopal.ac.in'}
                    </div>
                  </div>
                </div>

                {/* Dropdown links */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => { navigate('/profile'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-[#17233C] hover:bg-[#FFF8F3] transition-colors cursor-pointer text-left"
                  >
                    <User className="w-4 h-4 text-[#FF572E]" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/slot-friend'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-[#17233C] hover:bg-[#FFF8F3] transition-colors cursor-pointer text-left"
                  >
                    <CalendarDays className="w-4 h-4 text-[#0284C7]" />
                    <span className="flex-1">SlotMate</span>
                    <span className="text-[9px] font-black uppercase bg-[#EAF5FF] text-[#0284C7] px-1.5 py-0.2 rounded-full">New</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/posts'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-[#17233C] hover:bg-[#FFF8F3] transition-colors cursor-pointer text-left"
                  >
                    <FileText className="w-4 h-4 text-[#6E7587]" />
                    <span>My Posts & Rides</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/confirmed-rides'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-[#17233C] hover:bg-[#FFF8F3] transition-colors cursor-pointer text-left"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                    <span>Confirmed Bookings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setProfileDropdownOpen(false); 
                      window.dispatchEvent(new CustomEvent('pwa-prompt-install')); 
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-extrabold text-[#FF572E] hover:bg-[#FFEBE0]/50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-4 h-4 text-[#FF572E]" />
                    <span>Install Helpu App</span>
                  </button>
                </div>

                {/* Sign Out */}
                <div className="border-t border-[#F4E3D8]/60 pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}

export default DesktopNavbar;
