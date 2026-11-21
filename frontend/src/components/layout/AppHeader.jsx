import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { useUser } from '../../context/FirebaseAuthContext';
import { useAuthProfile } from '../../context/AuthProfileContext';
import { Avatar } from '../ui/Avatar';

/**
 * Helpu Mobile & Desktop Application Header
 * 
 * Features:
 * - Responsive: Mobile edge-to-edge + Desktop centered container
 * - Home header: Logo + Notification bell with unread badge + Direct profile access
 * - Sub-page header: Back button + Title + Optional right actions
 * - Smooth backdrop blur & consistent border styling
 * - Supports theme="blue" for FFCS Light Blue mode without altering default PoolMate/SlotMate look
 */
export function AppHeader({ 
  title, 
  backTo, 
  avatarId, 
  src, 
  onBell, 
  unreadCount = 0, 
  showLogo = false,
  rightAction = null,
  profileRoute = '/profile',
  onAvatar = null,
  theme = 'default'
}) {
  const navigate = useNavigate();
  const { user } = useUser();
  const { profile } = useAuthProfile();

  const isBlueTheme = theme === 'blue' || theme === 'ffcs';
  const isSlotmateTheme = theme === 'slotmate' || theme === 'amber' || theme === 'yellow';

  const resolvedSrc = src || profile?.imageUrl || user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl || user?.profileImageUrl;
  const resolvedName = profile?.name || user?.fullName || 'Student';

  // Sub-page header (with back button)
  if (title) {
    return (
      <header className={`px-3.5 sm:px-6 py-2.5 backdrop-blur-md sticky top-0 z-30 border-b ${
        isBlueTheme
          ? 'bg-[#F0F7FF]/95 border-[#DBEAFE]'
          : isSlotmateTheme
          ? 'bg-[#FFF9EA]/95 border-[#FDE68A]'
          : 'bg-[#FFF8F3]/95 border-[#F4E3D8]'
      }`}>
        <div className="w-full max-w-xl lg:max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {backTo !== undefined && (
              <button
                type="button"
                onClick={() => (typeof backTo === 'function' ? backTo() : backTo === -1 ? navigate(-1) : navigate(backTo))}
                className={`p-1.5 -ml-1.5 text-[#17233C] hover:bg-white rounded-xl border border-transparent transition-colors cursor-pointer shrink-0 ${
                  isBlueTheme
                    ? 'hover:border-[#DBEAFE]'
                    : isSlotmateTheme
                    ? 'hover:border-[#FDE68A]'
                    : 'hover:border-[#F4E3D8]'
                }`}
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
        </div>
      </header>
    );
  }

  // Main Home header
  return (
    <header className={`px-3.5 sm:px-6 py-2 backdrop-blur-md sticky top-0 z-30 border-b ${
      isBlueTheme 
        ? 'bg-[#F0F7FF]/95 border-[#DBEAFE]' 
        : isSlotmateTheme
        ? 'bg-[#FFF9EA]/95 border-[#FDE68A]'
        : 'bg-[#FFF8F3]/95 border-[#F4E3D8]'
    }`}>
      <div className="w-full max-w-xl lg:max-w-4xl mx-auto flex items-center justify-between">
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
            className="h-7 sm:h-8 w-auto object-contain select-none" 
            draggable="false"
          />
        </button>

        {/* Right actions: Notifications Bell + Header Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {onBell && (
            <button
              type="button"
              onClick={onBell}
              className={`relative p-2 text-[#17233C] bg-white rounded-full transition-all duration-150 border shadow-2xs active:scale-95 focus:outline-none flex items-center justify-center cursor-pointer ${
                isBlueTheme
                  ? 'hover:bg-[#EFF6FF] border-[#BFDBFE]'
                  : isSlotmateTheme
                  ? 'hover:bg-[#FEF3C7] border-[#FDE68A]'
                  : 'hover:bg-[#FFF9F5] border-[#F4E3D8]'
              }`}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-[#17233C]" />
              {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs ${
                  isSlotmateTheme ? 'bg-[#D97706]' : 'bg-[#FF572E]'
                }`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Profile Avatar */}
          <button 
            type="button"
            onClick={onAvatar ? onAvatar : () => navigate(profileRoute || '/profile')}
            className={`relative flex items-center p-0.5 rounded-full transition-all duration-150 focus:outline-none cursor-pointer active:scale-95 ${
              isBlueTheme
                ? 'hover:ring-2 hover:ring-[#3B82F6]/40'
                : isSlotmateTheme
                ? 'hover:ring-2 hover:ring-[#F59E0B]/40'
                : 'hover:ring-2 hover:ring-[#FF572E]/40'
            }`}
            aria-label="User Profile"
          >
            <div className={`relative rounded-full p-[1.5px] ${
              isBlueTheme
                ? 'bg-gradient-to-tr from-[#3B82F6]/50 via-transparent to-[#3B82F6]/30'
                : isSlotmateTheme
                ? 'bg-gradient-to-tr from-[#F59E0B]/50 via-transparent to-[#FBBF24]/30'
                : 'bg-gradient-to-tr from-[#FF572E]/40 via-transparent to-[#FF572E]/20'
            }`}>
              <Avatar 
                src={user ? resolvedSrc : null} 
                name={user ? resolvedName : 'Guest Mode'} 
                email={user?.primaryEmailAddress?.emailAddress} 
                size="sm" 
                className="border border-white shadow-xs" 
              />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
