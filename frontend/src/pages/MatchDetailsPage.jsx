import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Calendar, Users, MessageSquare } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/utils';
import { openWhatsAppChat } from '../lib/whatsapp';
import { getTravelById } from '../lib/api';

export default function MatchDetailsPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [match, setMatch] = useState(state?.match || null);
  const [loading, setLoading] = useState(!state?.match && Boolean(id));

  useEffect(() => {
    if (!state?.match && id) {
      setLoading(true);
      getTravelById(id)
        .then((res) => {
          const t = res.data?.data || res.data;
          if (t) {
            setMatch({
              _id: t._id,
              name: t.student?.name || t.studentName || 'Campus Peer',
              avatarId: t.student?.avatarId || t.studentAvatarId || 'm1',
              rating: t.student?.rating || t.rating || '4.9',
              college: t.student?.college || 'Verified Campus Peer',
              from: t.from,
              to: t.to,
              departureTime: t.departureTime,
              seats: t.availableSeats || 2,
              pricePerSeat: t.pricePerSeat || 0,
              about: t.carModel ? `Travelling by ${t.carModel}. Connect on WhatsApp!` : 'Campus travel match. Connect on WhatsApp!',
              phone: t.student?.phone || ''
            });
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, state?.match]);

  if (loading) {
    return (
      <ResponsiveShell customMobileHeader={<AppHeader title="Match Details" backTo={-1} />}>
        <div className="max-w-xl mx-auto px-4 py-8">
          <LoadingSkeleton count={3} />
        </div>
      </ResponsiveShell>
    );
  }

  if (!match) {
    return (
      <ResponsiveShell customMobileHeader={<AppHeader title="Match Details" backTo={-1} />}>
        <div className="max-w-xl mx-auto px-4 py-12">
          <EmptyState
            icon="🤝"
            title="Match not found"
            subtitle="This match may no longer be available. Explore active campus rides."
            action={
              <PrimaryButton variant="coral" onClick={() => navigate('/match')} fullWidth={false} className="px-6">
                Browse Matches
              </PrimaryButton>
            }
          />
        </div>
      </ResponsiveShell>
    );
  }

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Match Details" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
        {/* Hero avatar with cloud background */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-peach rounded-3xl p-8 flex flex-col items-center text-center"
        >
          <div className="relative mb-3">
            <Avatar avatarId={match.avatarId} size="2xl" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          </div>
          <h2 className="font-black text-navy text-xl">{match.name}</h2>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-navy">{match.rating}</span>
          </div>
          <p className="text-text-secondary text-sm mt-1">{match.college}</p>
        </motion.div>

        {/* Status / Reliability */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: 'Community', value: 'Verified ✓' },
              { label: 'Rating', value: `${match.rating || '4.9'} ★` },
              { label: 'Seats', value: `${match.seats || 1} Open` },
            ].map((s) => (
              <div key={s.label} className="text-center px-2">
                <div className="font-black text-navy text-base sm:text-lg">{s.value}</div>
                <div className="text-text-secondary text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Route details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3"
        >
          {[
            { icon: <MapPin className="w-4 h-4 text-coral" />, text: `${match.from} → ${match.to}` },
            { icon: <Calendar className="w-4 h-4 text-coral" />, text: formatDate(match.departureTime) },
            { icon: <Users className="w-4 h-4 text-coral" />, text: `${match.seats || 1} Seats Available` },
            { icon: <span className="text-coral font-bold text-sm">₹</span>, text: match.pricePerSeat ? `₹${match.pricePerSeat} per seat` : 'Split Travel Cost' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-navy">
              {row.icon}
              <span>{row.text}</span>
            </div>
          ))}
        </motion.div>

        {/* About */}
        {match.about && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <h3 className="font-bold text-navy mb-2">About {match.name?.split(' ')[0]}</h3>
            <p className="text-text-secondary text-sm leading-relaxed">{match.about}</p>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => openWhatsAppChat({
              phone: match.phone,
              name: match.name,
              route: `${match.from} → ${match.to}`
            })}
            className="flex-1 py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm shadow-[#25D366]/20 transition-all cursor-pointer"
          >
            <img src="/whatsapp.png" alt="WhatsApp" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.currentTarget.src = '/whatsapp.svg'; }} />
            <span>Chat on WhatsApp</span>
          </button>
          <PrimaryButton
            variant="coral"
            onClick={() => {
              const travelId = match?._id || match?.id;
              if (travelId && travelId !== 'match') {
                navigate(`/rides/${travelId}`, { state: { travel: match } });
              } else {
                navigate('/rides/offer');
              }
            }}
            className="flex-1"
            fullWidth={false}
          >
            Book Seat
          </PrimaryButton>
        </div>
      </div>
    </ResponsiveShell>
  );
}

