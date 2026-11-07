import { useNavigate } from 'react-router-dom';
import { MatchCard } from './MatchCard';

/**
 * CompactMatchCard provides matching cards strictly following Reference Image 2.
 */
export function CompactMatchCard({ 
  match, 
  onContactWhatsApp, 
  activeBookingStatusByTravelId = {} 
}) {
  const navigate = useNavigate();
  if (!match) return null;

  const travelId = match._id?.toString() || match.id?.toString();

  return (
    <MatchCard
      match={match}
      onPress={() => navigate(`/rides/${travelId}`)}
    />
  );
}

export default CompactMatchCard;
