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
  const student = match.student || match.creator || {};
  const studentId = student.clerkId || student.id || match.userId;
  
  const bookingInfo = activeBookingStatusByTravelId[travelId] || 
                      (studentId ? activeBookingStatusByTravelId[`sender_${studentId}`] : null);

  return (
    <MatchCard
      match={match}
      bookingStatus={bookingInfo}
      onPress={() => navigate(`/rides/${travelId}`)}
    />
  );
}

export default CompactMatchCard;
