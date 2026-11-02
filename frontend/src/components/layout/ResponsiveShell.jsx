import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DesktopNavbar } from './DesktopNavbar';
import { DesktopSidebar } from './DesktopSidebar';
import { BottomNavigation } from './BottomNavigation';

export function ResponsiveShell({ 
  children, 
  avatarId, 
  unreadCount = 0,
  hideSidebarOnDesktop = false,
  customMobileHeader = null
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-cream flex flex-col font-sans text-navy antialiased">
      {/* 1. Desktop & Tablet Top Navigation (or Mobile fallback if no custom header) */}
      {customMobileHeader ? (
        <>
          <div className="hidden md:block">
            <DesktopNavbar 
              avatarId={avatarId} 
              unreadCount={unreadCount}
              onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              isSidebarOpen={isMobileSidebarOpen}
            />
          </div>
          <div className="md:hidden">
            {customMobileHeader}
          </div>
        </>
      ) : (
        <DesktopNavbar 
          avatarId={avatarId} 
          unreadCount={unreadCount}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isSidebarOpen={isMobileSidebarOpen}
        />
      )}

      {/* 3. Tablet Drawer Backdrop & Sidebar (< lg) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-0 bottom-0 left-0 w-72 bg-cream shadow-2xl p-4 overflow-y-auto z-10"
            >
              <div className="flex justify-between items-center mb-2 px-2">
                <span className="font-extrabold text-navy text-lg">Menu</span>
                <button 
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 rounded-xl text-text-secondary hover:bg-white"
                >
                  ✕
                </button>
              </div>
              <DesktopSidebar onCloseMobile={() => setIsMobileSidebarOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Main Body Container */}
      <div className="flex-1 w-full max-w-[1536px] mx-auto flex">
        {/* Left Sidebar on Desktop (>= lg) */}
        {!hideSidebarOnDesktop && (
          <div className="hidden lg:block shrink-0 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
            <DesktopSidebar />
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 min-w-0 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* 5. Mobile Bottom Navigation (< md) */}
      <BottomNavigation />
    </div>
  );
}

export default ResponsiveShell;

