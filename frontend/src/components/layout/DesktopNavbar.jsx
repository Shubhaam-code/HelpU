import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Car, Users, Info, Search, Bell, Menu, X, LogOut, User, FileText, Calendar, Download, CarTaxiFront
} from 'lucide-react';
import { useUser, useFirebaseAuth } from '../../context/FirebaseAuthContext';
import { Avatar } from '../ui/Avatar';
import { getUnreadCount } from '../../lib/api';

export function DesktopNavbar({ avatarId, unreadCount = 0, onToggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useFirebaseAuth();
  
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);
  const profileContainerRef = useRef(null);

  // Sync and fetch actual unread notification count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      const count = res?.data?.unreadCount ?? res?.data?.count ?? res?.data?.data?.count;
      if (typeof count === 'number') {
        setLiveUnreadCount(count);
      }
    } catch {
      // Gracefully fall back to prop
    }
  }, []);

  useEffect(() => {
    if (typeof unreadCount === 'number' && unreadCount > 0) {
      setLiveUnreadCount(unreadCount);
    }
  }, [unreadCount]);

  useEffect(() => {
    refreshUnreadCount();
    // 10s polling fallback for real-time unread count updates
    const interval = setInterval(refreshUnreadCount, 10000);
    // Refresh count on window focus or custom 'notifications-updated' event
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
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    if (path === '/rides/offer') return location.pathname.startsWith('/rides');
    if (path === '/shared-rides') return location.pathname.startsWith('/shared-rides') || location.pathname.startsWith('/groups');
    if (path === '/matches') return location.pathname.startsWith('/match');
    if (path === '/posts') return location.pathname.startsWith('/posts');
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { label: 'Home', path: '/home', icon: Home },
    { label: 'Ride', path: '/rides/offer', icon: Car },
    { label: 'Shared Rides', path: '/shared-rides', icon: CarTaxiFront },
    { label: 'My Posts', path: '/posts', icon: FileText },
    { label: 'My Matches', path: '/matches', icon: Users },
    { label: 'About', path: '/about', icon: Info },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md border-b border-gray-100/80 px-4 lg:px-8 py-2.5 sm:py-3 transition-all">
      <div className="max-w-[1536px] mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Hamburger (Tablet) + Brand Logo */}
        <div className="flex items-center gap-3">
          {/* Tablet menu trigger */}
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-navy hover:bg-white rounded-xl transition-colors"
            aria-label="Toggle Navigation"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => navigate('/home')} 
            className="flex items-center shrink-0 cursor-pointer focus:outline-none transition-transform duration-200 hover:opacity-95 active:scale-95"
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

        {/* Center: Desktop Navigation Links (Hidden on small screens) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {navLinks.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-peach/70 text-coral shadow-sm shadow-coral/10'
                    : 'text-text-secondary hover:text-navy hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="bg-coral text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none -mt-3 -ml-0.5 shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Notifications, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="hidden xl:block relative w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rides, people, or places..."
              className="w-full bg-white rounded-full py-2 pl-10 pr-4 text-xs font-medium text-navy placeholder:text-text-secondary/70 border border-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/30 transition-all"
            />
          </form>

          {/* Notification bell */}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative p-2 sm:p-2.5 text-navy/80 hover:text-navy bg-white/80 hover:bg-white rounded-full transition-all duration-200 border border-gray-100/90 hover:border-gray-200 hover:shadow-xs active:scale-95 focus:outline-none cursor-pointer flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-navy" />
            {liveUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-coral text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {liveUnreadCount > 99 ? '99+' : liveUnreadCount}
              </span>
            )}
          </button>

          {/* User profile button & Dropdown */}
          <div className="relative" ref={profileContainerRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              aria-label="User profile menu"
              className="relative flex items-center p-0.5 rounded-full transition-all duration-200 hover:ring-2 hover:ring-coral/40 focus:outline-none focus:ring-2 focus:ring-coral/50 cursor-pointer group"
            >
              <div className="relative rounded-full p-[1.5px] bg-gradient-to-tr from-coral/40 via-transparent to-coral/20 group-hover:from-coral group-hover:to-coral transition-all">
                <Avatar 
                  src={userProfileImage} 
                  name={user?.fullName || 'Student'} 
                  email={user?.primaryEmailAddress?.emailAddress}
                  size="sm" 
                  className="border border-white shadow-xs"
                />
              </div>
            </button>

            {profileDropdownOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <Avatar 
                    src={userProfileImage}
                    name={user?.fullName || 'Student'} 
                    email={user?.primaryEmailAddress?.emailAddress} 
                    size={40} 
                    className="border border-gray-100 shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-navy text-sm truncate leading-snug">
                      {user?.fullName || 'Campus Student'}
                    </div>
                    <div className="text-xs text-text-secondary truncate mt-0.5">
                      {user?.primaryEmailAddress?.emailAddress || 'student@vitbhopal.ac.in'}
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { navigate('/profile'); setProfileDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                  >
                    <User className="w-4 h-4 text-text-secondary" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { 
                      setProfileDropdownOpen(false); 
                      window.dispatchEvent(new CustomEvent('pwa-prompt-install')); 
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#FF572E] hover:bg-[#FFF4ED] transition-colors"
                  >
                    <Download className="w-4 h-4 text-[#FF572E]" />
                    Install Helpu App
                  </button>
                </div>

                <div className="border-t border-gray-100 pt-1">
                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
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

