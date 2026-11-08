import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DesktopNavbar } from './DesktopNavbar';
import { DesktopSidebar } from './DesktopSidebar';
import { BottomNavigation } from './BottomNavigation';

/**
 * Helpu Unified Responsive Shell
 * 
 * Provides:
 * - Desktop top navbar with 5 core tabs + header profile access
 * - Tablet slide-out drawer
 * - Mobile fixed bottom navigation with exactly 4 items
 * - Android safe-area insets & content padding guarantees so content never overlaps navigation
 */
export function ResponsiveShell({ 
  children, 
  avatarId, 
  unreadCount = 0,
  hideSidebarOnDesktop = true,
  customMobileHeader = null
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#FFF8F3] flex flex-col font-sans text-[#17233C] antialiased selection:bg-[#FFEBE0] selection:text-[#FF572E]">
      {/* 1. Desktop & Tablet Top Navigation (or Mobile custom header if provided) */}
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

      {/* 2. Tablet Drawer Backdrop & Sidebar (< lg) */}
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
              className="absolute top-0 bottom-0 left-0 w-72 bg-[#FFF8F3] border-r border-[#F4E3D8] shadow-2xl p-4 overflow-y-auto z-10"
            >
              <div className="flex justify-between items-center mb-3 px-2 pb-2 border-b border-[#F4E3D8]/60">
                <span className="font-black text-[#17233C] text-base">Menu</span>
                <button 
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 rounded-xl text-[#6E7587] hover:bg-white hover:text-[#17233C] cursor-pointer"
                  aria-label="Close Menu"
                >
                  ✕
                </button>
              </div>
              <DesktopSidebar onCloseMobile={() => setIsMobileSidebarOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Main Content Container */}
      <div className="flex-1 w-full max-w-[1536px] mx-auto flex">
        {/* Left Sidebar on Desktop if enabled */}
        {!hideSidebarOnDesktop && (
          <div className="hidden lg:block shrink-0 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto w-64 border-r border-[#F4E3D8]/60 px-2 py-4">
            <DesktopSidebar />
          </div>
        )}

        {/* Content Area with bottom clearance so content never collides with fixed bottom navigation on mobile */}
        <main className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-10">
          {children}
        </main>
      </div>

      {/* 4. Exactly 4-Item Mobile Bottom Navigation (< md) */}
      <BottomNavigation />
    </div>
  );
}

export default ResponsiveShell;
