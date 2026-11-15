import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Star,
  ThumbsUp,
  Users,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { getFacultyByName, getFacultyReviews } from '../../../lib/api';

// In-memory module cache to prevent duplicate network calls across opens
const facultyReviewCache = new Map();

export function FacultyReviewModal({ isOpen, onClose, teacher }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const teacherName = teacher?.name || '';
  const initialSummary = teacher?.reviewSummary || null;

  useEffect(() => {
    if (!isOpen || !teacherName) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = teacher?.facultyId || teacherName.toLowerCase().trim();
    if (facultyReviewCache.has(cacheKey)) {
      setData(facultyReviewCache.get(cacheKey));
      setLoading(false);
      return;
    }

    // If pre-loaded reviewSummary exists on teacher object
    if (initialSummary && initialSummary.hasReview !== false) {
      setData(initialSummary);
      facultyReviewCache.set(cacheKey, initialSummary);

      // Asynchronously fetch extra detailed reviews if available
      if (initialSummary.facultyId) {
        getFacultyReviews(initialSummary.facultyId, 1, 10)
          .then((res) => {
            if (Array.isArray(res?.data?.data) && res.data.data.length > 0) {
              const merged = {
                ...initialSummary,
                reviews: res.data.data,
                totalReviews: res.data.pagination?.total || initialSummary.totalReviews
              };
              setData(merged);
              facultyReviewCache.set(cacheKey, merged);
            }
          })
          .catch(() => {
            // keep initialSummary on error
          });
      }
      return;
    }

    // Fetch on-demand via getFacultyByName
    setLoading(true);
    setError('');

    getFacultyByName(teacherName)
      .then((res) => {
        if (res?.data?.found && res?.data?.data) {
          const faculty = res.data.data;
          const reviews = Array.isArray(faculty.reviews) ? faculty.reviews : [];

          // Actual positive percentage calculation from genuine review ratings
          const reviewsWithRating = reviews.filter(
            (r) => typeof r.rating === 'number' && !Number.isNaN(r.rating)
          );
          let positivePercentage = null;
          if (reviewsWithRating.length > 0) {
            const posCount = reviewsWithRating.filter((r) => r.rating >= 3.0).length;
            positivePercentage = Math.round((posCount / reviewsWithRating.length) * 100);
          } else if (faculty.overall_rating !== null && faculty.overall_rating !== undefined) {
            positivePercentage = Math.round((faculty.overall_rating / 5) * 100);
          }

          const resolved = {
            hasReview: true,
            facultyId: faculty.facultyId,
            name: faculty.name,
            overallRating: faculty.overall_rating,
            positivePercentage,
            totalReviews: faculty.totalReviews || reviews.length || 0,
            teachingRating: faculty.teaching_rating,
            evaluationRating: faculty.evaluation_rating,
            behaviourRating: faculty.behaviour_rating,
            internalsRating: faculty.internals_rating,
            classAverage: faculty.classAverage,
            finalRemark: faculty.finalRemark,
            reviews
          };
          setData(resolved);
          facultyReviewCache.set(cacheKey, resolved);
        } else {
          setData({ hasReview: false });
          facultyReviewCache.set(cacheKey, { hasReview: false });
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to retrieve faculty feedback.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, teacherName, teacher?.facultyId, initialSummary]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasReviewData = data && data.hasReview !== false;
  const overallRating = typeof data?.overallRating === 'number' ? data.overallRating : null;
  const positivePercentage =
    typeof data?.positivePercentage === 'number' ? data.positivePercentage : null;
  const totalReviews = data?.totalReviews || data?.reviews?.length || 0;

  const categories = [
    { label: 'Teaching Quality', score: data?.teachingRating },
    { label: 'Grading / Evaluation', score: data?.evaluationRating },
    { label: 'Behaviour & Approach', score: data?.behaviourRating },
    { label: 'Internal Marks', score: data?.internalsRating }
  ].filter((c) => typeof c.score === 'number' && c.score > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-review-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-amber-100 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
      >
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Modal Header */}
        <header className="px-5 pt-3.5 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Faculty Review & Feedback</span>
            </div>
            <h2
              id="faculty-review-title"
              className="text-base sm:text-lg font-black text-[#17233C] truncate leading-tight mt-0.5"
            >
              {data?.name || teacherName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#475569] flex items-center justify-center shrink-0 cursor-pointer transition-colors active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </header>

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-amber-200">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#854D0E]">
              <Loader2 className="w-7 h-7 animate-spin text-[#D97706]" />
              <span className="text-xs font-bold">Loading faculty feedback...</span>
            </div>
          ) : error ? (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs font-bold text-amber-900 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !hasReviewData ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="font-black text-sm text-[#17233C]">Faculty Review Not Available</h3>
              <p className="text-xs font-medium text-[#64748B] max-w-xs mx-auto">
                No verified student feedback or rating records found for {teacherName}.
              </p>
            </div>
          ) : (
            <>
              {/* Highlight Metrics Card */}
              <div className="bg-gradient-to-br from-[#FFFDF7] to-[#FEFCE8] border border-[#FEEBA4] rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
                {/* Positive Review Percentage */}
                {positivePercentage !== null ? (
                  <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 shrink-0 shadow-2xs">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5 stroke-[2.8] text-emerald-600" />
                      <span className="font-black text-lg sm:text-xl leading-none">
                        {positivePercentage}%
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 mt-0.5">
                      Positive
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-slate-100 text-[#64748B] text-xs font-bold shrink-0">
                    Rating N/A
                  </div>
                )}

                {/* Overall Rating & Review Count */}
                <div className="text-right flex-1 min-w-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <Star className="w-5 h-5 fill-[#FACC15] text-[#EAB308] shrink-0" />
                    <span className="font-black text-2xl text-[#17233C] leading-none">
                      {overallRating !== null ? overallRating.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs font-bold text-[#64748B]">/ 5.0</span>
                  </div>
                  <div className="text-[11px] font-bold text-[#64748B] flex items-center justify-end gap-1 mt-1 truncate">
                    <Users className="w-3 h-3 text-[#94A3B8]" />
                    <span>
                      {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Class Average & Final Remark Badges */}
              {(data?.finalRemark || data?.classAverage) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.finalRemark && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100/80 text-[#854D0E] border border-amber-300/80 shadow-2xs">
                      <span>{data.finalRemark}</span>
                    </span>
                  )}
                  {data.classAverage && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-[#475569] border border-slate-200">
                      Class Average: <strong className="ml-1 text-[#17233C]">{data.classAverage}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Category Breakdown Bars */}
              {categories.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#854D0E]">
                    Rating Breakdown
                  </h4>
                  <div className="space-y-2 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-3">
                    {categories.map((cat) => {
                      const pct = Math.min(100, Math.max(0, (cat.score / 5) * 100));
                      return (
                        <div key={cat.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-[#334155]">{cat.label}</span>
                            <span className="text-[#17233C] font-black">{cat.score.toFixed(1)} / 5</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#FDE047] to-[#EAB308] rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#17233C] font-black text-xs cursor-pointer active:scale-98 transition-colors shadow-2xs"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
