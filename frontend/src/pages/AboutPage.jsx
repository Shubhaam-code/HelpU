import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Info, ShieldCheck, Car, Users, Sparkles, Heart, 
  MapPin, CheckCircle2, ArrowRight, Zap, Target, 
  Award, MessageSquare, IndianRupee
} from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { getProfile, getUnreadCount } from '../lib/api';

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Verify College Identity',
    description: 'Sign up with your official university credentials (.ac.in or college domain) to ensure 100% peer trust.',
    icon: ShieldCheck,
    color: '#FF572E'
  },
  {
    step: '02',
    title: 'Post or Find a Ride',
    description: 'Choose your route (e.g. Campus to Railway Station, Airport, or Mall), date, time, and available vehicle seats.',
    icon: Car,
    color: '#8B5CF6'
  },
  {
    step: '03',
    title: 'Smart Matching & WhatsApp Connect',
    description: 'Our system instantly matches you with batchmates heading the same way. Coordinate pickup directly on WhatsApp.',
    icon: MessageSquare,
    color: '#16A34A'
  },
  {
    step: '04',
    title: 'Travel & Split Costs',
    description: 'Travel safely together, split fuel expenses transparently, and make meaningful connections on your journey.',
    icon: IndianRupee,
    color: '#2563EB'
  }
];

const CORE_VALUES = [
  {
    title: 'Student-First Economy',
    description: 'We believe campus travel should be affordable for every student. Zero commission fees — fuel split is 100% peer-to-peer.',
    icon: IndianRupee
  },
  {
    title: 'Safety & Trust',
    description: 'No outsiders or unknown drivers. Every user is verified with student email IDs and college department records.',
    icon: ShieldCheck
  },
  {
    title: 'Sustainable Commute',
    description: 'Empty car and auto seats mean fewer vehicles on the road, lowering our campus carbon footprint and traffic.',
    icon: Sparkles
  },
  {
    title: 'Close-Knit Campus',
    description: 'Transform mundane transit into conversations, peer networking, exam revisions, and lasting college friendships.',
    icon: Heart
  }
];

export default function AboutPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then(res => {
        if (!isMounted) return;
        setProfile(res.data?.data || null);
      })
      .catch(() => {});

    getUnreadCount()
      .then(res => {
        if (!isMounted) return;
        setUnreadCount(res.data?.data?.count || 0);
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  return (
    <ResponsiveShell
      hideSidebarOnDesktop={true}
      avatarId={profile?.avatarId}
      unreadCount={unreadCount}
      customMobileHeader={<AppHeader title="About HelpU" backTo={false} />}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8 sm:space-y-10">
        
        {/* ========================================================================= */}
        {/* 1. HERO SECTION                                                           */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[28px] border border-[#F4E3D8]/90 shadow-xs relative overflow-hidden p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          {/* Subtle warm decorative glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#FFF0E7]/80 via-[#FFF5EE]/40 to-transparent pointer-events-none rounded-r-[28px]" />

          <div className="relative z-10 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBE0] text-[#FF572E] font-bold text-xs mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About HelpU Platform</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#17233C] tracking-tight leading-tight">
              Built for Students, <br />
              <span className="text-[#FF572E]">by Students.</span>
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-[#6E7587] font-medium leading-relaxed">
              HelpU is the premier student carpooling, campus peer matching, and assistance network connecting verified college peers across Bhopal and beyond.
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-6">
              <button
                onClick={() => navigate('/rides/offer')}
                className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-full shadow-md shadow-[#FF572E]/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Offer a Ride</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/community')}
                className="px-6 py-3 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] text-[#17233C] font-bold text-xs sm:text-sm rounded-full shadow-2xs transition-all cursor-pointer"
              >
                Join Community
              </button>
            </div>
          </div>

          <div className="relative z-10 w-full md:w-[45%] flex items-center justify-center">
            <img
              src="/webpage.png"
              alt="HelpU Campus Students"
              className="w-full max-h-[220px] sm:max-h-[260px] object-contain drop-shadow-sm select-none pointer-events-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </motion.div>


        {/* ========================================================================= */}
        {/* 2. THE PROBLEM & WHY HELPU EXISTS                                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* Card: The Campus Dilemma */}
          <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#17233C] mb-2">
                The Campus Travel Problem
              </h2>
              <p className="text-xs sm:text-sm text-[#596277] leading-relaxed mb-4">
                Colleges situated outside city boundaries often face steep transportation challenges: surge auto fares, overpriced private cabs, irregular buses, and safety worries during late-night journeys.
              </p>
            </div>

            <div className="p-3.5 bg-red-50/60 rounded-2xl border border-red-100 text-xs text-red-700 font-semibold">
              Students were paying ₹400–₹800 per one-way trip to Bhopal Railway Station alone!
            </div>
          </div>

          {/* Card: The HelpU Solution */}
          <div className="bg-white rounded-[26px] p-6 sm:p-8 border border-[#F4E3D8]/90 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#EAF8F0] text-[#16A34A] flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#17233C] mb-2">
                The HelpU Solution
              </h2>
              <p className="text-xs sm:text-sm text-[#596277] leading-relaxed mb-4">
                HelpU connects students travelling on identical routes. Instead of travelling alone in an empty vehicle or booking separate cabs, peers share rides, split fuel evenly, and coordinate directly on WhatsApp.
              </p>
            </div>

            <div className="p-3.5 bg-[#EAF8F0] rounded-2xl border border-[#BCECD4] text-xs text-[#16A34A] font-extrabold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cuts daily commute costs by up to 75% safely!</span>
            </div>
          </div>

        </div>


        {/* ========================================================================= */}
        {/* 3. HOW HELPU WORKS (4 STEP CARDS)                                         */}
        {/* ========================================================================= */}
        <div>
          <div className="text-center max-w-md mx-auto mb-6">
            <span className="text-xs font-bold text-[#FF572E] uppercase tracking-wider">
              Simple & Seamless
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#17233C] mt-1">
              How HelpU Works
            </h2>
            <p className="text-xs sm:text-sm text-[#6E7587] mt-1">
              From verified sign-in to arriving safely at your destination.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS_STEPS.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-[24px] p-6 border border-[#F4E3D8]/90 shadow-xs hover:border-[#FF572E]/40 hover:shadow-sm transition-all flex flex-col justify-between relative"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs"
                        style={{ backgroundColor: `${s.color}15`, color: s.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-2xl font-black text-[#F4E3D8]">{s.step}</span>
                    </div>

                    <h3 className="font-black text-[#17233C] text-sm sm:text-base mb-1.5">
                      {s.title}
                    </h3>
                    <p className="text-xs text-[#596277] leading-relaxed">
                      {s.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F4E3D8]/60 flex items-center gap-1.5 text-[11px] font-bold text-[#FF572E]">
                    <span>Step {s.step}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* ========================================================================= */}
        {/* 4. CORE VALUES / PILLARS                                                  */}
        {/* ========================================================================= */}
        <div className="bg-[#FFF8F3] rounded-[28px] p-6 sm:p-8 lg:p-10 border border-[#FDE0D0]">
          <div className="text-center max-w-md mx-auto mb-8">
            <span className="text-xs font-bold text-[#FF572E] uppercase tracking-wider">
              Our Core Principles
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#17233C] mt-1">
              Why Students Trust HelpU
            </h2>
            <p className="text-xs sm:text-sm text-[#6E7587] mt-1">
              Every design and safety decision is built to protect and serve college peers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CORE_VALUES.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-[#FDE0D0] shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-[#17233C] text-sm mb-1">{val.title}</h3>
                  <p className="text-xs text-[#596277] leading-relaxed">{val.description}</p>
                </div>
              );
            })}
          </div>
        </div>


        {/* ========================================================================= */}
        {/* 5. TRUST & SAFETY SECTION                                                 */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-[28px] p-6 sm:p-8 border border-[#F4E3D8]/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-[#16A34A] font-black text-xs uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Campus Verified Guarantee</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#17233C] leading-snug">
              Safety is not an afterthought, it is our foundation.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#596277] leading-relaxed">
              Every HelpU account requires authentic college email verification. We enforce mutual community accountability and direct peer WhatsApp matching so you always know who you are traveling with.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => navigate('/rides/offer')}
              className="px-6 py-3 bg-[#FF572E] hover:bg-[#E64A22] text-white font-black text-xs sm:text-sm rounded-full shadow-md shadow-[#FF572E]/25 transition-all text-center cursor-pointer"
            >
              Offer a Campus Ride
            </button>
            <button
              onClick={() => navigate('/match')}
              className="px-6 py-3 bg-[#FFFBF8] hover:bg-[#FFEBE0] text-[#FF572E] border border-[#F4E3D8] font-black text-xs sm:text-sm rounded-full shadow-2xs transition-all text-center cursor-pointer"
            >
              Find a Travel Match
            </button>
          </div>
        </div>

      </div>
    </ResponsiveShell>
  );
}

