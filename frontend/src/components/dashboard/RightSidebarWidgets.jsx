import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, CheckCircle, Clock, Heart, MessageCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

// 1. Your Match Activity
export function MatchActivityWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div 
        onClick={() => navigate('/match')}
        className="flex items-center justify-between mb-3.5 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-coral" />
          <h3 className="font-extrabold text-navy text-base group-hover:text-coral transition-colors">
            Your Match Activity
          </h3>
        </div>
        <span className="text-coral font-bold text-sm">→</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Matches */}
        <div className="bg-peach/40 rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 font-extrabold text-navy text-sm">
            <Users className="w-3.5 h-3.5 text-coral" />
            <span>5</span>
          </div>
          <span className="text-[10px] font-semibold text-text-secondary mt-0.5">Matches</span>
        </div>

        {/* Confirmed */}
        <div className="bg-mint/50 rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 font-extrabold text-navy text-sm">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span>3</span>
          </div>
          <span className="text-[10px] font-semibold text-text-secondary mt-0.5">Confirmed</span>
        </div>

        {/* Pending */}
        <div className="bg-yellow-50 rounded-2xl p-2.5 text-center flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 font-extrabold text-navy text-sm">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>2</span>
          </div>
          <span className="text-[10px] font-semibold text-text-secondary mt-0.5">Pending</span>
        </div>
      </div>
    </div>
  );
}

// 2. Upcoming Booking
export function UpcomingBookingWidget({ booking }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-navy text-base">
          Upcoming Booking
        </h3>
        <button 
          onClick={() => navigate('/bookings')}
          className="text-xs font-bold text-coral hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All</span>
          <span>→</span>
        </button>
      </div>

      <div 
        onClick={() => navigate('/bookings/1')}
        className="flex items-center justify-between p-3 rounded-2xl hover:bg-cream/50 transition-colors border border-gray-50 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Avatar avatarId={booking?.driverAvatarId || 'm3'} size="md" />
          <div>
            <div className="font-bold text-navy text-sm">
              {booking?.route || 'Bhopal → VIT'}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              {booking?.time || 'Tomorrow, 8:00 AM'}
            </div>
          </div>
        </div>

        <span className="bg-mint text-green-800 text-[11px] font-bold px-3 py-1 rounded-full">
          Confirmed
        </span>
      </div>
    </div>
  );
}

// 3. Community Post Activity
export function CommunityActivityWidget() {
  const navigate = useNavigate();
  const [likes, setLikes] = useState(12);
  const [hasLiked, setHasLiked] = useState(false);

  const toggleLike = (e) => {
    e.stopPropagation();
    setHasLiked(!hasLiked);
    setLikes(prev => hasLiked ? prev - 1 : prev + 1);
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-navy text-base">
          Community
        </h3>
        <button 
          onClick={() => navigate('/community')}
          className="text-xs font-bold text-coral hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All</span>
          <span>→</span>
        </button>
      </div>

      <div className="p-3.5 rounded-2xl bg-cream/40 border border-gray-100/70">
        <div className="flex items-center gap-2.5 mb-2">
          <Avatar avatarId="m2" size="sm" />
          <div>
            <div className="font-bold text-navy text-xs">Ankit Mishra</div>
            <div className="text-[10px] text-text-secondary">2h ago</div>
          </div>
        </div>

        <p className="text-xs text-navy font-medium leading-relaxed mb-3">
          Anyone going to Bhopal this weekend? 2 seats available in my car. 🚗
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <button 
              onClick={toggleLike}
              className={`flex items-center gap-1 hover:text-coral transition-colors cursor-pointer ${
                hasLiked ? 'text-coral font-bold' : ''
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-coral text-coral' : ''}`} />
              <span>{likes}</span>
            </button>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>4</span>
            </span>
          </div>

          <button 
            onClick={() => navigate('/rides')}
            className="px-3 py-1 bg-coral text-white text-[11px] font-bold rounded-full hover:bg-coral/90 transition-colors shadow-xs cursor-pointer"
          >
            Join Ride
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. Find Your Travel Match Promo Widget
export function TravelMatchPromoWidget() {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate('/match')}
      className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative z-10">
          <div className="w-9 h-9 rounded-2xl bg-coral/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">
            🎯
          </div>
          <h4 className="font-extrabold text-navy text-base leading-snug">
            Find Your Travel Match
          </h4>
          <p className="text-text-secondary text-xs mt-1.5 leading-relaxed max-w-[200px]">
            Match with people on the same route, save cost and travel together.
          </p>
        </div>

        {/* Map graphic on right */}
        <div className="shrink-0 w-20 h-20 -mr-2 -mt-1">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Folded Map Shape */}
            <path d="M15 30 L45 20 L75 30 L95 22 L95 72 L75 80 L45 70 L15 80 Z" fill="#C9F2DE" />
            <path d="M45 20 L75 30 L75 80 L45 70 Z" fill="#BBDFFF" opacity="0.6" />
            <path d="M15 30 L45 20 L45 70 L15 80 Z" fill="#FFE6CB" opacity="0.4" />
            {/* Map Path Line */}
            <path d="M25 60 Q50 40 75 55" stroke="#FF654F" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
            {/* Map Pin */}
            <circle cx="68" cy="40" r="12" fill="#FF654F" />
            <circle cx="68" cy="40" r="4" fill="white" />
            <path d="M68 52 L62 43 L74 43 Z" fill="#FF654F" />
          </svg>
        </div>
      </div>
    </div>
  );
}
