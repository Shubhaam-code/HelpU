import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, Calendar } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function AvailableRidesWidget({ rides = [] }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState({});

  const displayRides = Array.isArray(rides) ? rides.slice(0, 3) : [];

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

      {/* Rides List or Empty State */}
      {displayRides.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-6 px-3 bg-cream/40 rounded-2xl border border-dashed border-[#F4E3D8] my-auto">
          <div className="w-10 h-10 rounded-full bg-peach flex items-center justify-center text-lg mb-2">
            🚗
          </div>
          <h4 className="font-bold text-navy text-sm">No Active Rides Yet</h4>
          <p className="text-text-secondary text-xs mt-1 max-w-[220px]">
            Be the first campus student to offer or request a ride today!
          </p>
          <button
            onClick={() => navigate('/rides/offer')}
            className="mt-3 px-4 py-1.5 bg-coral text-white text-xs font-bold rounded-xl shadow-xs hover:bg-coral/90 cursor-pointer"
          >
            Offer a Ride
          </button>
        </div>
      ) : (
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
                    <span className="font-bold text-navy text-sm truncate">{ride.student?.name || ride.name || 'Campus Student'}</span>
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
                    <span>{ride.date || 'Campus Schedule'}</span>
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

                {(ride.price || ride.pricePerSeat) && (
                  <span className="font-extrabold text-navy text-xs">
                    {ride.price || `₹${ride.pricePerSeat}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AvailableRidesWidget;

