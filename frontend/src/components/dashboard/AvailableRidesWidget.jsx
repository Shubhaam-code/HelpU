import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, Calendar } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

const DEFAULT_RIDES = [
  {
    id: '1',
    name: 'Aman Verma',
    rating: 4.8,
    type: 'Offer • Car',
    from: 'VIT',
    to: 'Bhopal',
    date: 'Sun, 2 Nov • 8:00 AM',
    seats: '3 seats',
    price: '₹350',
    avatarId: 'm1',
  },
  {
    id: '2',
    name: 'Priya Singh',
    rating: 4.9,
    type: 'Offer • Car',
    from: 'VIT',
    to: 'Indore',
    date: 'Sun, 2 Nov • 9:30 AM',
    seats: '2 seats',
    price: '₹600',
    avatarId: 'f1',
  },
  {
    id: '3',
    name: 'Karan Raj',
    rating: 4.7,
    type: 'Request • Need Ride',
    from: 'Bhopal',
    to: 'VIT',
    date: 'Sun, 2 Nov • 6:00 PM',
    seats: '1 seat',
    price: '',
    avatarId: 'm4',
  },
];

export function AvailableRidesWidget({ rides = [] }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState({});

  const displayRides = rides.length > 0 ? rides.slice(0, 3) : DEFAULT_RIDES;

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-navy text-base">
          Available Rides Near You
        </h3>
        <button 
          onClick={() => navigate('/rides')}
          className="text-xs font-bold text-coral hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All</span>
          <span>→</span>
        </button>
      </div>

      {/* Rides List */}
      <div className="space-y-3">
        {displayRides.map((ride) => (
          <div
            key={ride.id || ride._id}
            onClick={() => navigate(`/rides/${ride.id || ride._id}`)}
            className="p-3 rounded-2xl hover:bg-cream/50 transition-colors border border-gray-50 flex items-center justify-between gap-3 cursor-pointer group"
          >
            {/* Left: Avatar + Details */}
            <div className="flex items-center gap-3 min-w-0">
              <Avatar avatarId={ride.avatarId || ride.studentAvatarId || 'm1'} size="md" />
              
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-navy text-sm truncate">{ride.name || ride.studentName}</span>
                  <span className="flex items-center text-xs font-bold text-navy">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-0.5" />
                    {ride.rating || '4.8'}
                  </span>
                </div>

                <div className="text-[11px] text-text-secondary mt-0.5">
                  {ride.type || (ride.travelType === 'offer' ? 'Offer • Car' : 'Request • Need Ride')}
                </div>

                <div className="font-bold text-navy text-xs mt-1">
                  {ride.from} → {ride.to}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                  <Calendar className="w-3 h-3 text-text-secondary/70" />
                  <span>{ride.date || 'Sun, 2 Nov • 8:00 AM'}</span>
                </div>
              </div>
            </div>

            {/* Right: Seats badge, Price & Favorite */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={(e) => toggleFavorite(ride.id || ride._id, e)}
                className="text-text-secondary/40 hover:text-coral transition-colors p-1"
                aria-label="Add to favorites"
              >
                <Heart 
                  className={`w-4 h-4 ${favorites[ride.id || ride._id] ? 'fill-coral text-coral' : ''}`} 
                />
              </button>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                ride.type?.includes('Request') 
                  ? 'bg-peach/60 text-orange-700' 
                  : 'bg-mint text-green-800'
              }`}>
                {ride.seats || `${ride.availableSeats || 2} seats`}
              </span>

              {ride.price && (
                <span className="font-extrabold text-navy text-xs">
                  {ride.price}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AvailableRidesWidget;

