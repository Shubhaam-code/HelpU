import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Users, Star, MessageCircle, Sliders, CheckCircle } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { MatchCard } from '../components/ui/MatchCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { EmptyState } from '../components/ui/EmptyState';
import { MatchActivityWidget } from '../components/dashboard/RightSidebarWidgets';
import { Avatar } from '../components/ui/Avatar';

// Discover Illustration
function CampusCharactersArt() {
  return (
    <svg viewBox="0 0 300 220" fill="none" className="w-64 max-w-full mx-auto">
      <circle cx="100" cy="85" r="24" fill="#FDBCB4" />
      <ellipse cx="100" cy="70" rx="24" ry="10" fill="#17233C" />
      <ellipse cx="82" cy="78" rx="5" ry="10" fill="#17233C" />
      <ellipse cx="100" cy="118" rx="20" ry="18" fill="#FF654F" />
      <rect x="86" y="108" width="10" height="12" rx="4" fill="#FDBCB4" />
      <circle cx="93" cy="85" r="2.5" fill="#1a1a1a" />
      <circle cx="107" cy="85" r="2.5" fill="#1a1a1a" />
      <path d="M93 93 Q100 98 107 93" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <rect x="76" y="108" width="16" height="22" rx="5" fill="#C9F2DE" />

      <circle cx="200" cy="85" r="24" fill="#F1A77D" />
      <ellipse cx="200" cy="70" rx="24" ry="10" fill="#1a1a1a" />
      <ellipse cx="182" cy="76" rx="4" ry="14" fill="#1a1a1a" />
      <ellipse cx="218" cy="76" rx="4" ry="14" fill="#1a1a1a" />
      <ellipse cx="200" cy="118" rx="20" ry="18" fill="#17233C" />
      <rect x="186" y="108" width="10" height="12" rx="4" fill="#F1A77D" />
      <circle cx="193" cy="85" r="2.5" fill="#1a1a1a" />
      <circle cx="207" cy="85" r="2.5" fill="#1a1a1a" />
      <path d="M193 93 Q200 98 207 93" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Ring connector */}
      <circle cx="150" cy="100" r="20" stroke="#FF654F" strokeWidth="3" strokeDasharray="6 3" fill="white" />
      <text x="142" y="106" fontSize="16">🔗</text>

      <text x="50" y="50" fontSize="16">✨</text>
      <text x="240" y="50" fontSize="16">✨</text>
      <text x="145" y="30" fontSize="18">⭐</text>
    </svg>
  );
}

const MOCK_MATCHES = [
  { 
    _id: '1', 
    name: 'Priya Singh', 
    avatarId: 'f1', 
    rating: '4.9', 
    college: 'BTech CSE • VIT',
    from: 'VIT, Bhopal', 
    to: 'Bhopal Railway Station', 
    departureTime: new Date(Date.now() + 86400000).toISOString(), 
    status: 'matched',
    seats: 2,
    pricePerSeat: 350,
    about: 'Travelling to Bhopal. Friendly and verified co-traveller!'
  },
  { 
    _id: '2', 
    name: 'Aman Verma', 
    avatarId: 'm1', 
    rating: '4.8', 
    college: 'BTech ECE • VIT',
    from: 'VIT, Bhopal', 
    to: 'Indore', 
    departureTime: new Date(Date.now() + 86400000 * 2).toISOString(), 
    status: 'matched',
    seats: 3,
    pricePerSeat: 600,
    about: 'Car pooling to Indore. Regular traveller.'
  },
  { 
    _id: '3', 
    name: 'Karan Raj', 
    avatarId: 'm4', 
    rating: '4.7', 
    college: 'MCA • VIT',
    from: 'Bhopal', 
    to: 'VIT', 
    departureTime: new Date(Date.now() + 86400000).toISOString(), 
    status: 'matched',
    seats: 1,
    pricePerSeat: 300,
    about: 'Return trip to campus.'
  },
  { 
    _id: '4', 
    name: 'Neha Gupta', 
    avatarId: 'f3', 
    rating: '4.9', 
    college: 'BTech IT • VIT',
    from: 'VIT', 
    to: 'Bhopal Airport', 
    departureTime: new Date(Date.now() + 86400000 * 3).toISOString(), 
    status: 'pending',
    seats: 2,
    pricePerSeat: 400,
    about: 'Looking for female co-travellers to airport.'
  },
];

export default function MatchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Discover');
  const [selectedMatch, setSelectedMatch] = useState(MOCK_MATCHES[0]);

  const TABS = ['Discover', 'My Matches', 'Requests'];

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Match" backTo={false} />}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        
        {/* Tabs Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-white rounded-2xl p-1 shadow-xs border border-gray-100 max-w-md w-full">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-coral text-white shadow-xs font-bold' 
                    : 'text-text-secondary hover:text-navy'
                }`}
              >
                {tab}
                {tab === 'My Matches' && (
                  <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === tab ? 'bg-white text-coral' : 'bg-coral text-white'
                  }`}>
                    {MOCK_MATCHES.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Desktop Filter shortcut */}
          <button
            onClick={() => navigate('/match/preferences')}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-gray-100 text-xs font-bold text-navy hover:bg-cream transition-colors cursor-pointer shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-coral" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'Discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left / Center: Wide Discovery Canvas */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-3xl p-6 lg:p-10 shadow-sm border border-gray-100/80 text-center flex flex-col items-center">
                  <CampusCharactersArt />

                  <h2 className="font-black text-navy text-2xl lg:text-3xl mt-4 mb-2">
                    Find Your Travel Match ✨
                  </h2>
                  <p className="text-text-secondary text-sm lg:text-base max-w-md mb-6 leading-relaxed">
                    Get matched with campus peers travelling on the exact same route, date and time. Safe, verified and cost-effective.
                  </p>

                  {/* Criteria Chips */}
                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                      { icon: '📍', text: 'Same Route' },
                      { icon: '🕐', text: 'Similar Time' },
                      { icon: '✅', text: 'Verified Users' },
                      { icon: '🎓', text: 'Same College' },
                    ].map((c) => (
                      <div 
                        key={c.text} 
                        className="flex items-center gap-1.5 px-4 py-2 bg-cream rounded-full border border-gray-100 text-xs font-bold text-navy shadow-xs"
                      >
                        <span>{c.icon}</span>
                        <span>{c.text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    <PrimaryButton
                      variant="coral"
                      onClick={() => navigate('/match/preferences')}
                      className="flex-1"
                    >
                      Find a Match →
                    </PrimaryButton>
                    <PrimaryButton
                      variant="outlineNavy"
                      onClick={() => setActiveTab('My Matches')}
                      className="flex-1"
                    >
                      View Existing Matches
                    </PrimaryButton>
                  </div>
                </div>

                {/* Popular campus match routes */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-extrabold text-navy text-base mb-4">
                    Popular Travel Match Routes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { from: 'VIT, Bhopal', to: 'Bhopal Railway Station', time: 'Every Weekend', matches: '14 Active' },
                      { from: 'VIT, Bhopal', to: 'Raja Bhoj Airport', time: 'Friday & Sunday', matches: '8 Active' },
                      { from: 'VIT, Bhopal', to: 'Indore City', time: 'Long Weekends', matches: '6 Active' },
                      { from: 'VIT, Bhopal', to: 'DB City Mall', time: 'Saturdays', matches: '12 Active' },
                    ].map((r) => (
                      <div
                        key={r.to}
                        onClick={() => navigate('/match/preferences')}
                        className="p-3.5 rounded-2xl bg-cream/40 border border-gray-100 hover:border-coral/40 transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-navy text-xs">{r.from} → {r.to}</div>
                          <div className="text-[10px] text-text-secondary mt-0.5">{r.time}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint text-green-800">
                          {r.matches}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Activity stats & Travel Buddy Tips */}
              <div className="lg:col-span-4 space-y-5">
                <MatchActivityWidget />

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h4 className="font-extrabold text-navy text-sm mb-3">
                    💡 Match Tips for Campus
                  </h4>
                  <ul className="space-y-2 text-xs text-text-secondary leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-coral font-bold">•</span>
                      Set a flexible time window of ±30 mins to get 3x more potential matches.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-coral font-bold">•</span>
                      Always check verified student badges and mutual rides before confirming.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-coral font-bold">•</span>
                      Use in-app messaging to coordinate pickup spots like Campus Main Gate.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'My Matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left / Center Matches Grid (8 cols) */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MOCK_MATCHES.map((m) => (
                    <div 
                      key={m._id}
                      onClick={() => setSelectedMatch(m)}
                      className={`cursor-pointer transition-all ${
                        selectedMatch?._id === m._id ? 'ring-2 ring-coral rounded-3xl' : ''
                      }`}
                    >
                      <MatchCard
                        match={m}
                        onPress={() => {
                          setSelectedMatch(m);
                          if (window.innerWidth < 1024) {
                            navigate(`/match/${m._id}`, { state: { match: m } });
                          }
                        }}
                        onChat={() => navigate(`/chat/${m._id}`)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Active Match Inspector (Desktop & Laptop >= lg) */}
              <div className="hidden lg:block lg:col-span-4 sticky top-[80px]">
                {selectedMatch ? (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex flex-col items-center text-center">
                      <Avatar avatarId={selectedMatch.avatarId} size="xl" ring />
                      <h3 className="font-extrabold text-navy text-lg mt-3">{selectedMatch.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-navy">{selectedMatch.rating}</span>
                        <span>•</span>
                        <span>{selectedMatch.college}</span>
                      </div>
                      <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mint text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Verified Student
                      </span>
                    </div>

                    <div className="bg-cream/60 rounded-2xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Route:</span>
                        <span className="font-bold text-navy">{selectedMatch.from} → {selectedMatch.to}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Seats:</span>
                        <span className="font-bold text-navy">{selectedMatch.seats} Available</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Price:</span>
                        <span className="font-extrabold text-coral">₹{selectedMatch.pricePerSeat}/seat</span>
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed italic">
                      "{selectedMatch.about}"
                    </p>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => navigate(`/chat/${selectedMatch._id}`)}
                        className="flex-1 py-2.5 bg-white border border-gray-200 text-navy font-bold text-xs rounded-2xl hover:bg-gray-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4 text-coral" />
                        <span>Message</span>
                      </button>
                      <button
                        onClick={() => navigate('/book/match', { state: { travel: selectedMatch } })}
                        className="flex-1 py-2.5 bg-coral text-white font-bold text-xs rounded-2xl hover:bg-coral/90 cursor-pointer shadow-xs"
                      >
                        Book Seat
                      </button>
                    </div>
                  </div>
                ) : (
                  <MatchActivityWidget />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'Requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto"
            >
              <EmptyState
                icon="📨"
                title="No match requests yet"
                subtitle="When students going your way send a travel request, you'll see them right here."
                action={
                  <PrimaryButton
                    variant="coral"
                    onClick={() => setActiveTab('Discover')}
                    fullWidth={false}
                    className="px-8"
                  >
                    Discover Buddies
                  </PrimaryButton>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </ResponsiveShell>
  );
}
