import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { useUser } from '../../context/FirebaseAuthContext';
import { Avatar } from '../ui/Avatar';

export function AppHeader({ title, backTo, avatarId, src, onBell, unreadCount = 0, showLogo = false }) {
  const navigate = useNavigate();
  const { user } = useUser();

  const resolvedSrc = src || user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl || user?.profileImageUrl;

  // Sub-page header (with back button)
  if (title) {
    return (
      <header className="flex items-center px-4 sm:px-5 py-2 sm:py-2.5 bg-cream/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]/50">
        {backTo && (
          <button
            onClick={() => (backTo === -1 ? navigate(-1) : navigate(backTo))}
            className="mr-2.5 p-1 -ml-1 text-navy hover:bg-white rounded-xl transition cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-navy" />
          </button>
        )}
        <h1 className="font-extrabold text-navy text-lg sm:text-xl flex-1 truncate">{title}</h1>
      </header>
    );
  }

  // Main home header
  return (
    <header className="flex items-center justify-between px-4 sm:px-5 py-1.5 sm:py-2 bg-cream/90 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]/40">
      {/* HelpU Logo from public folder (No plain text) */}
      <button 
        onClick={() => navigate('/home')}
        className="flex items-center shrink-0 focus:outline-none cursor-pointer transition-transform duration-200 active:scale-95 py-0.5"
        aria-label="HelpU Home"
      >
        <img 
          src="/logo.png" 
          alt="HelpU" 
          className="h-7.5 sm:h-8.5 w-auto max-w-[130px] sm:max-w-none object-contain select-none" 
          draggable="false"
        />
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {onBell && (
          <button
            onClick={onBell}
            className="relative p-1.5 text-navy hover:bg-white rounded-full transition-all duration-200 border border-[#F4E3D8]/80 bg-white/70 active:scale-95 focus:outline-none flex items-center justify-center cursor-pointer shadow-2xs"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-navy" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-coral text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}
        <button 
          onClick={() => navigate('/profile')}
          className="relative flex items-center p-0.5 rounded-full transition-all duration-200 hover:ring-2 hover:ring-coral/40 focus:outline-none cursor-pointer"
          aria-label="User profile"
        >
          <div className="relative rounded-full p-[1.5px] bg-gradient-to-tr from-coral/40 via-transparent to-coral/20">
            <Avatar 
              src={resolvedSrc} 
              name={user?.fullName || 'Student'} 
              email={user?.primaryEmailAddress?.emailAddress} 
              size="sm" 
              className="border border-white shadow-xs" 
            />
          </div>
        </button>
      </div>
    </header>
  );
}

export default AppHeader;

