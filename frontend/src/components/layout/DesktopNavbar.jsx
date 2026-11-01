import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Car, Users, Wrench, Info, Search, Bell, ChevronDown, Menu, X, LogOut, User, Settings
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { Avatar } from '../ui/Avatar';

export function DesktopNavbar({ avatarId, unreadCount = 0, onToggleSidebar, isSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  
  const [ridesDropdownOpen, setRidesDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { label: 'Home', path: '/home', icon: Home },
    { label: 'Rides', path: '/rides', icon: Car, hasDropdown: true },
    { label: 'Match', path: '/match', icon: Users, badge: 'New' },
    { label: 'Community', path: '/community', icon: Users },
    { label: 'Get Help', path: '/help', icon: Wrench },
    { label: 'About', path: '/about', icon: Info },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/rides?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md border-b border-gray-100/80 px-4 lg:px-8 py-3 transition-all">
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
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
          >
            <div className="w-9 h-9 bg-navy rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xl leading-none">H</span>
            </div>
            <span className="font-black text-navy text-2xl tracking-tight">HelpU</span>
          </button>
        </div>

        {/* Center: Desktop Navigation Links (Hidden on small screens) */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {navLinks.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            if (item.hasDropdown) {
              return (
                <div key={item.label} className="relative">
                  <button
                    onClick={() => setRidesDropdownOpen(!ridesDropdownOpen)}
                    onMouseEnter={() => setRidesDropdownOpen(true)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
                      active
                        ? 'bg-peach/70 text-coral'
                        : 'text-text-secondary hover:text-navy hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                  </button>

                  {/* Dropdown Menu */}
                  {ridesDropdownOpen && (
                    <div 
                      onMouseLeave={() => setRidesDropdownOpen(false)}
                      className="absolute top-full left-0 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                    >
                      <button
                        onClick={() => { navigate('/rides'); setRidesDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                      >
                        Explore Rides
                      </button>
                      <button
                        onClick={() => { navigate('/rides/offer'); setRidesDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                      >
                        Offer a Ride
                      </button>
                      <button
                        onClick={() => { navigate('/rides/request'); setRidesDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                      >
                        Request a Ride
                      </button>
                      <button
                        onClick={() => { navigate('/bookings'); setRidesDropdownOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                      >
                        My Bookings
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
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
        <div className="flex items-center gap-3">
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
            onClick={() => navigate('/notifications')}
            className="relative p-2.5 text-navy hover:bg-white rounded-full transition-colors shadow-sm bg-white/70 border border-gray-100"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-navy" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-coral rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* User profile button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-0.5 hover:ring-2 hover:ring-coral/30 rounded-full transition-all focus:outline-none cursor-pointer"
            >
              <Avatar avatarId={avatarId || 'm1'} size="sm" ring />
            </button>

            {profileDropdownOpen && (
              <div 
                onMouseLeave={() => setProfileDropdownOpen(false)}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="font-bold text-navy text-sm truncate">{user?.fullName || 'Student'}</div>
                  <div className="text-xs text-text-secondary truncate">{user?.primaryEmailAddress?.emailAddress}</div>
                </div>

                <button
                  onClick={() => { navigate('/profile'); setProfileDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                >
                  <User className="w-4 h-4 text-text-secondary" />
                  My Profile
                </button>
                <button
                  onClick={() => { navigate('/bookings'); setProfileDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                >
                  <Car className="w-4 h-4 text-text-secondary" />
                  My Bookings
                </button>
                <button
                  onClick={() => { navigate('/settings'); setProfileDropdownOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-cream transition-colors"
                >
                  <Settings className="w-4 h-4 text-text-secondary" />
                  Settings
                </button>

                <div className="border-t border-gray-50 mt-1 pt-1">
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

