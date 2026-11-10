import { useState } from 'react';
import { Star, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'teachingRating', label: 'Teaching', description: 'Subject knowledge, clarity & explanation' },
  { id: 'evaluationRating', label: 'Evaluation', description: 'Exam checking fairness & grading' },
  { id: 'behaviourRating', label: 'Behaviour', description: 'Approachability, attitude & student interaction' },
  { id: 'internalsRating', label: 'Internals', description: 'Lab & internal marks distribution' }
];

/**
 * RateFacultyModal
 * Modal popup for students to submit integer ratings (1-5) across the four mandatory categories:
 * Teaching, Evaluation, Behaviour, and Internals.
 * Strictly NO written text reviews or comment fields.
 */
export function RateFacultyModal({
  isOpen,
  onClose,
  faculty,
  onSubmit,
  isSubmitting,
  initialRatings = null
}) {
  const [ratings, setRatings] = useState({
    teachingRating: initialRatings?.teachingRating || 0,
    evaluationRating: initialRatings?.evaluationRating || 0,
    behaviourRating: initialRatings?.behaviourRating || 0,
    internalsRating: initialRatings?.internalsRating || 0
  });

  const [hoveredStars, setHoveredStars] = useState({
    teachingRating: 0,
    evaluationRating: 0,
    behaviourRating: 0,
    internalsRating: 0
  });

  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleStarClick = (categoryId, starNumber) => {
    setRatings((prev) => ({ ...prev, [categoryId]: starNumber }));
    setValidationError('');
  };

  const handleStarMouseEnter = (categoryId, starNumber) => {
    setHoveredStars((prev) => ({ ...prev, [categoryId]: starNumber }));
  };

  const handleStarMouseLeave = (categoryId) => {
    setHoveredStars((prev) => ({ ...prev, [categoryId]: 0 }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Check that all 4 categories are selected (1-5)
    for (const cat of CATEGORIES) {
      if (!ratings[cat.id] || ratings[cat.id] < 1 || ratings[cat.id] > 5) {
        setValidationError(`Please rate the "${cat.label}" category (1 to 5 stars).`);
        return;
      }
    }

    setValidationError('');
    onSubmit({
      teachingRating: ratings.teachingRating,
      evaluationRating: ratings.evaluationRating,
      behaviourRating: ratings.behaviourRating,
      internalsRating: ratings.internalsRating
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-faculty-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#F4E3D8] shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#F8EFE7]">
          <div>
            <h2 id="rate-faculty-title" className="text-xl sm:text-2xl font-black text-[#17233C] tracking-tight">
              Rate Your Faculty
            </h2>
            <p className="text-xs sm:text-sm text-[#6E7587] font-medium mt-0.5">
              Share your experience for <span className="font-bold text-[#17233C]">{faculty?.name}</span> by rating these four categories.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rating dialog"
            className="p-1 rounded-full text-[#9CA3AF] hover:text-[#17233C] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 4 Rating Sections */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {CATEGORIES.map((cat) => {
            const currentRating = ratings[cat.id];
            const hovered = hoveredStars[cat.id];
            const activeStar = hovered || currentRating;

            return (
              <div
                key={cat.id}
                className="bg-[#FFFDF9] rounded-2xl border border-[#F4E3D8] p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-extrabold text-sm text-[#17233C]">
                    {cat.label}
                  </span>
                  <span className="text-xs font-black text-[#C2410C]">
                    {currentRating > 0 ? `${currentRating} / 5` : 'Not rated'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starNum) => {
                    const isFilled = starNum <= activeStar;
                    return (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => handleStarClick(cat.id, starNum)}
                        onMouseEnter={() => handleStarMouseEnter(cat.id, starNum)}
                        onMouseLeave={() => handleStarMouseLeave(cat.id)}
                        aria-label={`Rate ${cat.label} ${starNum} out of 5 stars`}
                        className="p-1.5 rounded-lg hover:bg-[#FEF9C3]/50 transition-transform active:scale-110 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                            isFilled
                              ? 'fill-[#FACC15] text-[#FACC15] drop-shadow-xs'
                              : 'fill-transparent text-[#D1D5DB]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-[#F8EFE7]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-3 rounded-full border border-[#F4E3D8] text-xs sm:text-sm font-bold text-[#6E7587] hover:bg-[#FFFDF9] hover:text-[#17233C] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#FACC15] via-[#FBBF24] to-[#F59E0B] hover:brightness-105 active:scale-[0.98] text-[#17233C] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(250,204,21,0.35)] cursor-pointer transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#17233C]" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Rating</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RateFacultyModal;

