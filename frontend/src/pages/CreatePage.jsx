import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Car, MapPin, Users, Info, ArrowRight, Sparkles, ShieldCheck 
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';

const OPTIONS = [
  { 
    id: 'offer',
    icon: Car, 
    badge: 'Share & Earn',
    badgeColor: 'bg-[#FFF0E6] text-[#FF572E] border-[#FDE0D0]',
    iconBg: 'bg-[#FFF0E6] text-[#FF572E]',
    title: 'Offer a Ride', 
    subtitle: 'Have empty vehicle seats? Share your journey with campus peers and split fuel expenses easily.', 
    tag: 'Split Fuel • Verified Peers',
    path: '/rides/offer' 
  },
  { 
    id: 'request',
    icon: MapPin, 
    badge: 'Need a Seat',
    badgeColor: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
    iconBg: 'bg-[#F5F3FF] text-[#7C3AED]',
    title: 'Request a Ride', 
    subtitle: 'Looking for a ride to airport, station, or city? Find verified students heading your way.', 
    tag: 'Affordable • Direct Pickup',
    path: '/rides/request' 
  },
  { 
    id: 'match',
    icon: Users, 
    badge: 'Smart Pairing',
    badgeColor: 'bg-[#EDFAF3] text-[#16A34A] border-[#BCECD4]',
    iconBg: 'bg-[#EDFAF3] text-[#16A34A]',
    title: 'Find a Match', 
    subtitle: 'Explore campus peers travelling along the same route and departure window in real time.', 
    tag: 'Auto Match • WhatsApp Connect',
    path: '/match' 
  },
  { 
    id: 'about',
    icon: Info, 
    badge: 'Platform Guide',
    badgeColor: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
    iconBg: 'bg-[#EFF6FF] text-[#2563EB]',
    title: 'About Helpu', 
    subtitle: 'Learn how Helpu works, peer safety verification, student community values, and campus guidelines.', 
    tag: '100% Student Verified • Safe Travel',
    path: '/about' 
  },
];

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Create Activity" backTo="/home" />}
    >
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* HERO HEADER BANNER                                                        */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-[#FFF0E6] via-[#FFF6EE] to-[#FFFBF8] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 border border-[#F4E3D8] shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#F4E3D8] text-[10px] sm:text-[11px] font-black text-[#FF572E] uppercase tracking-wider mb-2.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Helpu Campus Action</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#17233C] tracking-tight leading-tight">
              Create Campus <span className="text-[#FF572E]">Activity</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1.5 leading-relaxed">
              What would you like to initiate today? Share your empty seats, request a ride, pair with co-travellers, or explore about Helpu.
            </p>
          </div>

          {/* Cute Responsive Campus Ride Illustration */}
          <div className="hidden sm:flex items-center justify-center shrink-0 relative z-10">
            <img
              src="/car.png"
              alt="Helpu Campus Activity"
              className="w-auto max-w-[170px] lg:max-w-[210px] max-h-[120px] lg:max-h-[140px] object-contain drop-shadow-sm select-none pointer-events-none hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4 MODERN ACTION CARDS (2x2 Grid)                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {OPTIONS.map((opt, i) => {
            const Icon = opt.icon;

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(opt.path)}
                className="bg-white rounded-[26px] p-5 sm:p-6 border border-[#F4E3D8] hover:border-[#FF572E]/50 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-5 group cursor-pointer"
              >
                <div className="space-y-4">
                  {/* Top Row: Icon Container, Badge & Arrow Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl ${opt.iconBg} flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>

                    {/* Circular Action Arrow */}
                    <div className="w-9 h-9 rounded-full bg-[#FFFBF8] border border-[#F4E3D8] text-[#8C93A4] group-hover:bg-[#FF572E] group-hover:text-white group-hover:border-[#FF572E] flex items-center justify-center shadow-2xs group-hover:translate-x-0.5 transition-all duration-300">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-black text-lg sm:text-xl text-[#17233C] group-hover:text-[#FF572E] transition-colors">
                      {opt.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-1 leading-relaxed">
                      {opt.subtitle}
                    </p>
                  </div>
                </div>

                {/* Bottom Tag Strip */}
                <div className="pt-3 border-t border-[#F4E3D8]/60 flex items-center justify-between text-xs font-bold text-[#8C93A4]">
                  <span className="truncate">{opt.tag}</span>
                  <span className="text-[#FF572E] font-extrabold text-[11px] group-hover:underline">
                    Get started →
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* CAMPUS NETWORK TRUST STRIP                                                */}
        {/* ========================================================================= */}
        <div className="bg-[#FFFBF8] rounded-2xl p-4 border border-[#F4E3D8] flex items-center justify-center gap-2.5 text-center text-xs text-[#6E7587] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>100% Verified Campus Students Only • Zero Commission Peer Travel</span>
        </div>

      </div>
    </ResponsiveShell>
  );
}
