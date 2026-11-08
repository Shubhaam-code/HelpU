import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { useUser } from '../../context/FirebaseAuthContext';
import { Avatar } from '../ui/Avatar';

/**
 * Helpu Mobile Application Header
 * 
 * Features:
 * - Home header: Logo + Notification bell with unread badge + Direct profile access
 * - Sub-page header: Back button with accessible touch target + Title + Optional right actions
 * - Smooth backdrop blur & consistent border styling
 */
export function AppHeader({ 
  title, 
  backTo, 
  avatarId, 
  src, 
  onBell, 
  unreadCount = 0, 
  showLogo = false,
  rightAction = null 
}) {
  const navigate = useNavigate();
  const { user } = useUser();

  const resolvedSrc = src || user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl || user?.profileImageUrl;

  // Sub-page header (with back button)
  if (title) {
    return (
      <header className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {backTo !== undefined && (
            <button
              type="button"
              onClick={() => (backTo === -1 ? navigate(-1) : navigate(backTo))}
              className="p-1.5 -ml-1.5 text-[#17233C] hover:bg-white rounded-xl border border-transparent hover:border-[#F4E3D8] transition-colors cursor-pointer shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-[#17233C]" />
            </button>
          )}
          <h1 className="font-extrabold text-[#17233C] text-base sm:text-lg truncate">
            {title}
          </h1>
        </div>

        {rightAction && (
          <div className="shrink-0 ml-2">
            {rightAction}
          </div>
        )}
      </header>
    );
  }

  // Main Home header
  return (
    <header className="flex items-center justify-between px-4 sm:px-5 py-2 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]">
      {/* HelpU Brand Logo */}
      <button 
        type="button"
        onClick={() => navigate('/home')}
        className="flex items-center shrink-0 focus:outline-none cursor-pointer transition-transform duration-150 active:scale-95 py-0.5"
        aria-label="HelpU Home"
      >
        <img 
          src="/logo.png" 
          alt="HelpU" 
          className="h-7.5 sm:h-8.5 w-auto max-w-[130px] sm:max-w-none object-contain select-none" 
          draggable="false"
        />
      </button>

      {/* Right actions: Notifications Bell + Header Profile Avatar */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {onBell && (
          <button
            type="button"
            onClick={onBell}
            className="relative p-2 text-[#17233C] bg-white hover:bg-[#FFF9F5] rounded-full transition-all duration-150 border border-[#F4E3D8] shadow-2xs active:scale-95 focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-[#17233C]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#FF572E] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Profile Avatar: One tap to /profile */}
        <button 
          type="button"
          onClick={() => navigate('/profile')}
          className="relative flex items-center p-0.5 rounded-full transition-all duration-150 hover:ring-2 hover:ring-[#FF572E]/40 focus:outline-none cursor-pointer active:scale-95"
          aria-label="User Profile"
        >
          <div className="relative rounded-full p-[1.5px] bg-gradient-to-tr from-[#FF572E]/40 via-transparent to-[#FF572E]/20">
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
