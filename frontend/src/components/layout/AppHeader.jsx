import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function AppHeader({ title, backTo, avatarId, onBell, unreadCount = 0, showLogo = false }) {
  const navigate = useNavigate();

  // Sub-page header (with back button)
  if (title) {
    return (
      <header className="flex items-center px-5 py-4 bg-cream sticky top-0 z-30">
        {backTo && (
          <button
            onClick={() => (backTo === -1 ? navigate(-1) : navigate(backTo))}
            className="mr-3 p-1 -ml-1 hover:bg-gray-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5 text-navy" />
          </button>
        )}
        <h1 className="font-bold text-navy text-xl flex-1">{title}</h1>
      </header>
    );
  }

  // Main home header
  return (
    <header className="flex items-center justify-between px-5 py-4 bg-cream sticky top-0 z-30">
      {/* HelpU Logo */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-navy rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-black text-lg leading-none">H</span>
        </div>
        <span className="font-black text-navy text-xl tracking-tight">HelpU</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {onBell && (
          <button
            onClick={onBell}
            className="relative p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <Bell className="w-5 h-5 text-navy" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-coral rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}
        {avatarId !== undefined && (
          <button onClick={() => navigate('/profile')}>
            <Avatar avatarId={avatarId} size="sm" ring />
          </button>
        )}
      </div>
    </header>
  );
}

export default AppHeader;
