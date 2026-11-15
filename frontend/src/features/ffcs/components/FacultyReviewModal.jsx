import React, { useEffect, useState } from 'react';
import {
  X,
  BookOpen,
  ThumbsUp,
  GraduationCap,
  BarChart3,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { getFacultyByName } from '../../../lib/api';

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
            finalRemark: faculty.finalRemark
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
  const facultyDisplayName = data?.name || teacherName || 'Faculty Review';
  const overallRating =
    typeof data?.overallRating === 'number' && !Number.isNaN(data.overallRating)
      ? data.overallRating
      : null;

  const formatScore = (val) => {
    if (typeof val === 'number' && !Number.isNaN(val) && val > 0) {
      return val.toFixed(1);
    }
    return 'N/A';
  };

  const hasScore = (val) => typeof val === 'number' && !Number.isNaN(val) && val > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-review-title"
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[385px] sm:max-w-[430px] bg-[#FFFDF7] rounded-3xl shadow-[0_20px_50px_rgba(23,35,60,0.18)] border border-amber-200/80 p-4 sm:p-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
      >
        {/* Top Header: Title + Close Button (overall rating removed as requested) */}
        <div className="flex items-start justify-between gap-2.5 pb-3 border-b border-amber-100">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#D97706]">
              <Sparkles className="w-3 h-3 text-[#D97706]" />
              <span>Faculty Ratings</span>
            </div>
            <h3
              id="faculty-review-title"
              className="text-base sm:text-lg font-black text-[#17233C] tracking-tight leading-snug truncate mt-0.5"
              title={facultyDisplayName}
            >
              {facultyDisplayName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="pt-3.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#D97706]" />
              <p className="text-xs font-bold text-slate-400">Loading rating metrics...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 space-y-2">
              <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
              <p className="text-xs font-bold text-rose-600">{error}</p>
            </div>
          ) : !hasReviewData ? (
            <div className="text-center py-5 space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-black text-[#17233C]">
                Faculty Review Not Available
              </h4>
              <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                No ratings or review data recorded for this faculty yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Clean Horizontal 4-Column Rating Layout */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {/* 1. Review Teaching: Soft blue circular icon + BookOpen */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white border border-blue-100/90 shadow-2xs transition-all hover:border-blue-200">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-1.5 shadow-2xs">
                    <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-[#17233C] tracking-tight leading-tight">
                    {formatScore(data?.teachingRating)}
                    {hasScore(data?.teachingRating) && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 ml-0.5">/5</span>
                    )}
                  </div>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-[#64748B] mt-1 leading-tight line-clamp-2">
                    Review Teaching
                  </span>
                </div>

                {/* 2. Behavior: Green circular icon + ThumbsUp */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white border border-emerald-100/90 shadow-2xs transition-all hover:border-emerald-200">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-1.5 shadow-2xs">
                    <ThumbsUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-[#17233C] tracking-tight leading-tight">
                    {formatScore(data?.behaviourRating)}
                    {hasScore(data?.behaviourRating) && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 ml-0.5">/5</span>
                    )}
                  </div>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-[#64748B] mt-1 leading-tight line-clamp-2">
                    Behavior
                  </span>
                </div>

                {/* 3. Internal Rating: Soft orange circular icon + GraduationCap */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white border border-amber-100/90 shadow-2xs transition-all hover:border-amber-200">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-1.5 shadow-2xs">
                    <GraduationCap className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-[#17233C] tracking-tight leading-tight">
                    {formatScore(data?.internalsRating)}
                    {hasScore(data?.internalsRating) && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 ml-0.5">/5</span>
                    )}
                  </div>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-[#64748B] mt-1 leading-tight line-clamp-2">
                    Internal Rating
                  </span>
                </div>

                {/* 4. Review Evaluation: Soft purple circular icon + BarChart3 */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white border border-purple-100/90 shadow-2xs transition-all hover:border-purple-200">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mb-1.5 shadow-2xs">
                    <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="text-xs sm:text-sm font-black text-[#17233C] tracking-tight leading-tight">
                    {formatScore(data?.evaluationRating)}
                    {hasScore(data?.evaluationRating) && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 ml-0.5">/5</span>
                    )}
                  </div>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-[#64748B] mt-1 leading-tight line-clamp-2">
                    Review Evaluation
                  </span>
                </div>
              </div>

              {/* Optional Subtle Remarks Tag (if available) */}
              {data?.finalRemark && (
                <div className="text-center pt-0.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-[#854D0E] border border-amber-200">
                    {data.finalRemark}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
