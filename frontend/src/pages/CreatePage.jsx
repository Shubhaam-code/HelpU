import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MapPin, Users, Info, ArrowRight, Sparkles, ShieldCheck, 
  IndianRupee, Zap, MessageCircle, GraduationCap, BookOpen, Check
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';

// Crisp Car Outline Icon matching the app design
function ButtonCarIcon({ className = "w-6 h-6 stroke-[2.2]" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

const ACTIVITY_CARDS = [
  {
    id: 'offer',
    title: 'Offer a Ride',
    subtitle: 'Have empty vehicle seats? Share your journey with campus peers and split fuel expenses easily.',
    path: '/rides/offer',
    icon: ButtonCarIcon,
    iconBg: 'bg-[#FFF0E6]',
    iconColor: 'text-[#FF572E]',
    arrowBg: 'bg-[#FFFBF8]',
    arrowBorder: 'border border-[#F4E3D8]',
    arrowColor: 'text-[#FF572E]',
    chipBg: 'bg-[#FFF8F3]',
    chipBorder: 'border border-[#FEE6D8]',
    waveColor: 'bg-gradient-to-t from-[#FFEBE0]/50 to-transparent',
    chips: [
      { label: 'Split Fuel', icon: IndianRupee },
      { label: 'Verified Peers', icon: ShieldCheck },
      { label: 'Save More', icon: Users },
    ],
  },
  {
    id: 'request',
    title: 'Find a Ride',
    subtitle: 'Looking for a ride to airport, station, or city? Find verified students heading your way.',
    path: '/rides/request',
    icon: MapPin,
    iconBg: 'bg-[#F5F3FF]',
    iconColor: 'text-[#7C3AED]',
    arrowBg: 'bg-[#FAF5FF]',
    arrowBorder: 'border border-[#DDD6FE]',
    arrowColor: 'text-[#7C3AED]',
    chipBg: 'bg-[#FAF5FF]',
    chipBorder: 'border border-[#EDE9FE]',
    waveColor: 'bg-gradient-to-t from-[#F3E8FF]/60 to-transparent',
    chips: [
      { label: 'Affordable', icon: IndianRupee },
      { label: 'Direct Pickup', icon: MapPin },
      { label: 'Safe Travel', icon: ShieldCheck },
    ],
  },
  {
    id: 'match',
    title: 'Find a Match',
    subtitle: 'Explore campus peers travelling along the same route and departure window in real time.',
    path: '/match',
    icon: Users,
    iconBg: 'bg-[#EAF8F0]',
    iconColor: 'text-[#16A34A]',
    arrowBg: 'bg-[#F0FAF4]',
    arrowBorder: 'border border-[#C6EFD9]',
    arrowColor: 'text-[#16A34A]',
    chipBg: 'bg-[#F0FAF4]',
    chipBorder: 'border border-[#C6EFD9]',
    waveColor: 'bg-gradient-to-t from-[#EBF9F1]/60 to-transparent',
    chips: [
      { label: 'Auto Match', icon: Zap },
      { label: 'WhatsApp Connect', icon: MessageCircle },
      { label: 'Verified Peers', icon: Check },
    ],
  },
  {
    id: 'about',
    title: 'About Helpu',
    subtitle: 'Learn how Helpu works, peer safety verification, student community values, and campus guidelines.',
    path: '/about',
    icon: Info,
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#2563EB]',
    arrowBg: 'bg-[#F0F7FF]',
    arrowBorder: 'border border-[#BFDBFE]',
    arrowColor: 'text-[#2563EB]',
    chipBg: 'bg-[#EFF6FF]',
    chipBorder: 'border border-[#DBEAFE]',
    waveColor: 'bg-gradient-to-t from-[#EFF6FF]/60 to-transparent',
    chips: [
      { label: 'How It Works', icon: GraduationCap },
      { label: 'Safety & Verification', icon: ShieldCheck },
      { label: 'Guidelines', icon: BookOpen },
    ],
  },
];

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      customMobileHeader={<AppHeader title="Create Activity" backTo="/home" />}
    >
      <div className="w-full max-w-xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-1.5 pb-20 sm:pt-4 sm:pb-12 space-y-3 sm:space-y-3.5">
        
        {/* ========================================================================= */}
        {/* HERO BANNER CARD (Polished layout matching reference)                     */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs overflow-hidden p-4 sm:p-5"
        >
          {/* Subtle warm cream background glow at top */}
          <div className="absolute top-0 right-0 left-0 h-24 bg-gradient-to-b from-[#FFF5EE]/70 to-transparent pointer-events-none" />

          {/* Top Badge */}
          <div className="relative z-10 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FF572E]" />
            <span>HELPU CAMPUS ACTION</span>
          </div>

          {/* Content Row: Heading & Subtitle on Left, Illustration on Right */}
          <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Left: Heading & Subtitle */}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-[#17233C] text-[21px] min-[390px]:text-[23px] sm:text-3xl leading-[1.18] tracking-tight">
                Create Campus <br />
                <span className="text-[#FF572E]">
                  Activity
                </span>
              </h1>

              <p className="text-xs sm:text-[13px] text-[#6E7587] font-medium leading-relaxed mt-1.5 max-w-[190px] min-[390px]:max-w-[215px] sm:max-w-xs">
                Share a ride, request a ride, find a match, or learn more about Helpu.
              </p>
            </div>

            {/* Right: Prominent post.png Illustration */}
            <div className="shrink-0 w-[160px] min-[380px]:w-[178px] min-[410px]:w-[195px] sm:w-[225px] md:w-[250px] -mr-1 sm:-mr-1 flex justify-end items-center">
              <img
                src="/post.png"
                alt="Helpu Campus Action"
                className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-xs"
              />
            </div>

          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 4 ACTIVITY CARDS (Stacked list matching reference)                        */}
        {/* ========================================================================= */}
        <div className="space-y-3 sm:space-y-3.5">
          {ACTIVITY_CARDS.map((card, i) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => navigate(card.path)}
                className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] hover:border-[#FF572E]/40 shadow-xs relative overflow-hidden cursor-pointer transition-all duration-200 space-y-3"
              >
                {/* Subtle decorative bottom-right wave gradient */}
                <div className={`absolute bottom-0 right-0 w-44 h-10 ${card.waveColor} rounded-tl-full pointer-events-none opacity-60`} />

                {/* Top Row: Icon Container on Left, Text in Middle, Circular Arrow on Right */}
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}>
                    <Icon className="w-6 h-6 stroke-[2.2]" />
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="font-extrabold text-base sm:text-lg text-[#17233C] leading-snug">
                      {card.title}
                    </h3>
                    <p className="text-xs text-[#6E7587] font-medium leading-relaxed mt-0.5">
                      {card.subtitle}
                    </p>
                  </div>

                  <div className={`w-8 h-8 rounded-full ${card.arrowBg} ${card.arrowBorder} ${card.arrowColor} flex items-center justify-center shrink-0 shadow-2xs mt-1`}>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                {/* Bottom Row: 3 Feature Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1 relative z-10">
                  {card.chips.map((chip, idx) => {
                    const ChipIcon = chip.icon;
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${card.chipBg} ${card.chipBorder} text-[11px] font-bold text-[#17233C]`}
                      >
                        <ChipIcon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                        <span>{chip.label}</span>
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>


        {/* ========================================================================= */}
        {/* TRUST FOOTER (Exact match to reference)                                   */}
        {/* ========================================================================= */}
        <div className="bg-[#F0FAF4] rounded-2xl p-3 sm:p-3.5 border border-[#C6EFD9] flex items-center justify-center gap-2 text-center text-[11px] sm:text-xs text-[#16A34A] font-extrabold mt-3">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>100% Verified Campus Students Only • Zero Commission • Safe Travel</span>
        </div>

      </div>
    </ResponsiveShell>
  );
}
