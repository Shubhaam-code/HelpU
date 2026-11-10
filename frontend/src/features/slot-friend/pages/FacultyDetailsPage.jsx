import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  GraduationCap,
  Briefcase,
  BarChart3,
  MessageSquare,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ClipboardCheck,
  Smile,
  Layers
} from 'lucide-react';

import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { RateFacultyModal } from '../components/RateFacultyModal';
import { getFacultyById, submitFacultyRating } from '../../../lib/api';
import { getFacultyInitials } from '../components/FacultyCard';
import { useUser } from '../../../context/FirebaseAuthContext';
import { useUserProfile } from '../../../hooks/useAppData';
import { useScrollRestoration } from '../../../hooks/useScrollRestoration';

/**
 * Visual color styles and icons for the four breakdown categories matching the reference design:
 */
const CATEGORY_STYLES = [
  {
    key: 'teaching_rating',
    label: 'Teaching',
    icon: GraduationCap,
    cardBg: 'bg-[#FEFCE8]/80 border-[#FEF08A]/75',
    iconColor: 'text-[#D97706]'
  },
  {
    key: 'evaluation_rating',
    label: 'Evaluation',
    icon: ClipboardCheck,
    cardBg: 'bg-[#FAF5FF]/80 border-[#E9D5FF]/75',
    iconColor: 'text-[#9333EA]'
  },
  {
    key: 'behaviour_rating',
    label: 'Behaviour',
    icon: Smile,
    cardBg: 'bg-[#F0FDF4]/80 border-[#BBF7D0]/75',
    iconColor: 'text-[#16A34A]'
  },
  {
    key: 'internals_rating',
    label: 'Internals',
    icon: Layers,
    cardBg: 'bg-[#F0F9FF]/80 border-[#BAE6FD]/75',
    iconColor: 'text-[#0284C7]'
  }
];

/**
 * Returns dynamic neutral feedback status badge styles:
 */
function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Excellent':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Good':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Average':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Needs Improvement':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'Below Expectations':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function FacultyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: profile } = useUserProfile();
  useScrollRestoration();

  const [faculty, setFaculty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Rating Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState('');

  const loadFaculty = async () => {
    try {
      setError(null);
      const res = await getFacultyById(id);
      if (res?.data?.data) {
        setFaculty(res.data.data);
      } else {
        setError('Faculty not found.');
      }
    } catch (err) {
      console.error('[FacultyDetails] Error loading faculty:', err);
      setError('Unable to load faculty details. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, [id]);

  const handleOpenFeedback = () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(`/slotmate/faculty/${id}`)}`);
      return;
    }
    setIsModalOpen(true);
  };

  const handleRatingSubmit = async (scores) => {
    setIsSubmittingRating(true);
    try {
      const res = await submitFacultyRating(id, scores);
      if (res?.data?.data) {
        setFaculty((prev) => ({
          ...prev,
          ...res.data.data
        }));
      } else {
        await loadFaculty();
      }

      setIsModalOpen(false);
      setFeedbackSuccessToast('Thank you! Your rating has been recorded.');
      setTimeout(() => setFeedbackSuccessToast(''), 4000);
    } catch (err) {
      console.error('[FacultyDetails] Rating submit error:', err);
      alert(err.response?.data?.message || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const formatScore = (val) => {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
    return Number(val).toFixed(1);
  };

  const initials = faculty ? getFacultyInitials(faculty.name) : 'FC';
  const overallFormatted = faculty?.overall_rating !== null && faculty?.overall_rating !== undefined
    ? Number(faculty.overall_rating).toFixed(2).replace(/\.?0+$/, '')
    : '—';

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between">
      {/* Toast notification */}
      {feedbackSuccessToast && (
        <div className="max-w-xl w-full mx-auto px-4 mt-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 text-xs font-bold shadow-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackSuccessToast}</span>
          </div>
        </div>
      )}

      {/* Main Scrollable Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-28">
        {/* Back navigation button */}
        <button
          type="button"
          onClick={() => navigate('/slotmate/faculty')}
          aria-label="Back to Faculty Search"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E7587] hover:text-[#17233C] active:scale-95 transition-all mb-3 cursor-pointer focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Back</span>
        </button>
        {isLoading ? (
          /* Loading Skeletons matching cards */
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#F4E3D8] p-6 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-[#F4E3D8]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-[#F4E3D8]/60 rounded-md w-3/4" />
                  <div className="h-3.5 bg-[#F4E3D8]/40 rounded-md w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-[#F4E3D8]/30 rounded-full w-36 mx-auto" />
            </div>

            <div className="bg-white rounded-3xl border border-[#F4E3D8] p-5 animate-pulse space-y-3">
              <div className="h-4 bg-[#F4E3D8]/60 rounded-md w-1/3" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-[#F4E3D8]/30 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : error || !faculty ? (
          /* Error State */
          <div className="bg-white rounded-3xl border border-[#F4E3D8] p-8 text-center mt-6 shadow-xs">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-[#17233C]">{error || 'Faculty Not Found'}</h2>
            <button
              type="button"
              onClick={() => navigate('/slotmate/faculty')}
              className="mt-4 px-5 py-2 rounded-full bg-[#FEF08A] text-[#C2410C] font-black text-xs hover:bg-[#FDE047] active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              Back to Faculty Search
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* ============================================================ */}
            {/* 1. FACULTY PROFILE CARD (Matching reference image exactly)    */}
            {/* ============================================================ */}
            <div className="bg-[#FFFDF7] rounded-3xl border border-[#FDE68A]/80 shadow-[0_4px_24px_rgba(23,35,60,0.03)] p-5 sm:p-6 relative overflow-hidden">
              {/* Golden gradient crescent accent on top-right */}
              <div className="absolute top-0 right-0 w-44 sm:w-56 h-36 bg-gradient-to-bl from-[#FDE047]/45 via-[#FEF08A]/25 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10">
                {/* Top Row: Left Details vs Right Portrait */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left Column: Name, Designation & Rating Pill */}
                  <div className="flex-1 min-w-0 pr-2">
                    <h1 className="text-xl sm:text-2xl font-black text-[#17233C] tracking-tight leading-tight truncate">
                      {faculty.name}
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#6E7587] font-semibold mt-1 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                      <span className="truncate">{faculty.designation || 'Assistant Professor'}</span>
                    </div>

                    {/* Golden Rating Pill */}
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FEF9C3] border border-[#FEF08A] shadow-2xs mt-3.5">
                      <Star className="w-4 h-4 fill-[#FACC15] text-[#FACC15] shrink-0" />
                      <span className="text-sm sm:text-base font-black text-[#17233C] tracking-tight">
                        {overallFormatted}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#6E7587]">
                        / 5.0
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Circular Faculty Portrait with double ring & graduation cap */}
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white shadow-md overflow-hidden bg-[#FEF9C3] flex items-center justify-center ring-2 ring-[#FEF08A]/80">
                      <img
                        src="/faculty-portrait-circle.png"
                        alt={faculty.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Small dark-gold circular graduation-cap badge overlapping bottom-right */}
                    <div className="absolute -bottom-1 -right-1 w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full bg-[#78350F] text-[#FEF08A] border-2 border-white flex items-center justify-center shadow-xs">
                      <GraduationCap className="w-3.5 h-3.5 text-[#FEF08A] stroke-[2.3]" />
                    </div>
                  </div>
                </div>

                {/* Subtle horizontal divider line */}
                <div className="w-full h-px bg-[#F4E3D8]/80 my-4" />

                {/* Bottom Information Pill: Overall Student Feedback */}
                <div className="flex items-center">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FEF9C3] to-[#FEF08A]/70 border border-[#FEF08A] shadow-2xs text-[#78350F] text-xs sm:text-sm font-bold">
                    <BarChart3 className="w-4 h-4 text-[#D97706] stroke-[2.5] shrink-0" />
                    <span>
                      Overall Student Feedback:{' '}
                      <strong className="font-black text-[#78350F]">
                        {faculty.status || 'Average'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* 2. RATING BREAKDOWN CARD (4 categories with 5 stars each)     */}
            {/* ============================================================ */}
            <div className="bg-white rounded-3xl border border-[#F4E3D8] shadow-[0_4px_24px_rgba(23,35,60,0.03)] p-5 sm:p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3.5">
                <BarChart3 className="w-5 h-5 text-[#F59E0B] stroke-[2.5]" />
                <h2 className="text-base sm:text-lg font-black text-[#17233C] tracking-tight">
                  Rating Breakdown
                </h2>
              </div>

              {/* Category Rows */}
              <div className="space-y-2.5">
                {CATEGORY_STYLES.map((cat) => {
                  const Icon = cat.icon;
                  const score = faculty[cat.key];
                  const formatted = formatScore(score);
                  const numScore = Number(score) || 0;

                  return (
                    <div
                      key={cat.key}
                      className={`rounded-2xl border p-3 flex items-center justify-between gap-2 shadow-2xs ${cat.cardBg}`}
                    >
                      {/* Left: Icon + Label */}
                      <div className="flex items-center gap-2.5 min-w-[95px] sm:min-w-[110px]">
                        <Icon className={`w-4 h-4 ${cat.iconColor} shrink-0 stroke-[2.3]`} />
                        <span className="font-extrabold text-xs sm:text-sm text-[#17233C]">
                          {cat.label}
                        </span>
                      </div>

                      {/* Center: 5 Stars */}
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {[1, 2, 3, 4, 5].map((starIdx) => {
                          const isFilled = starIdx <= Math.round(numScore);
                          return (
                            <Star
                              key={starIdx}
                              className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors ${
                                isFilled
                                  ? 'fill-[#FACC15] text-[#FACC15]'
                                  : 'fill-transparent text-[#D1D5DB]'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Right: Score / 5.0 */}
                      <span className="font-black text-xs sm:text-sm text-[#17233C] shrink-0 text-right min-w-[50px]">
                        {formatted} / 5.0
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================ */}
            {/* 3. GIVE FEEDBACK CARD (Matching reference image)             */}
            {/* ============================================================ */}
            <div className="bg-white rounded-3xl border border-[#F4E3D8] shadow-[0_4px_24px_rgba(23,35,60,0.03)] p-5 sm:p-6 relative overflow-hidden">
              {/* Corner soft accent */}
              <div className="absolute top-0 right-0 w-28 h-20 bg-gradient-to-bl from-[#FEF08A]/60 via-[#FDE047]/15 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-start gap-3">
                  {/* Chat Icon Box */}
                  <div className="w-11 h-11 rounded-xl bg-[#FEF9C3] border border-[#FEF08A] flex items-center justify-center text-[#78350F] shadow-2xs shrink-0">
                    <MessageSquare className="w-5 h-5 text-[#B45309]" />
                  </div>

                  {/* Texts */}
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-black text-[#17233C] leading-snug">
                      Give Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-0.5 leading-relaxed relative inline-block">
                      Your feedback is important and helps other students make better choices.
                      {/* Subtle yellow underline decorative highlight */}
                      <span className="block h-0.5 w-16 bg-[#FACC15] rounded-full mt-1" />
                    </p>
                  </div>
                </div>

                {/* Give Feedback Button */}
                <button
                  type="button"
                  onClick={handleOpenFeedback}
                  className="w-full mt-4 py-3.5 rounded-full bg-gradient-to-r from-[#FACC15] via-[#FBBF24] to-[#F59E0B] hover:brightness-105 active:scale-[0.98] text-[#17233C] font-black text-sm sm:text-base flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(250,204,21,0.35)] cursor-pointer transition-all"
                >
                  <span>Give Feedback</span>
                  <span className="text-lg">→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. SlotMate Bottom Navigation */}
      <SlotMateBottomNav active="faculty" />

      {/* 5. Rate Faculty Modal Popup (Rating 1-5 only, No written comments) */}
      <RateFacultyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        faculty={faculty}
        onSubmit={handleRatingSubmit}
        isSubmitting={isSubmittingRating}
        initialRatings={faculty?.userRating}
      />
    </div>
  );
}
