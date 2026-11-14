import React from 'react';

/**
 * Lightweight, accessible pulse skeleton loader for Course Cards.
 * Used on FIRST VISIT to prevent layout shift and blank screen flash.
 */
export function CourseSkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-amber-100/70 p-3.5 shadow-2xs animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
          {/* Circular Badge Skeleton */}
          <div className="w-8 h-8 rounded-full bg-amber-100/80 shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            {/* Title / Code Skeleton */}
            <div className="h-4 bg-slate-200/80 rounded w-28" />
            <div className="h-3 bg-slate-100 rounded w-44" />
          </div>
        </div>
        {/* Right Tag Skeleton */}
        <div className="w-16 h-6 bg-amber-50 rounded-lg shrink-0 border border-amber-100" />
      </div>
    </div>
  );
}

/**
 * Lightweight pulse skeleton loader for Faculty selection list.
 */
export function TeacherSkeletonRow() {
  return (
    <div className="flex items-center justify-between px-3.5 py-3 border-b border-amber-50 animate-pulse">
      <div className="flex items-center gap-3 flex-1 pr-2">
        <div className="w-4.5 h-4.5 rounded-full bg-slate-200 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-slate-200/90 rounded w-32" />
          <div className="h-2.5 bg-slate-100 rounded w-16" />
        </div>
      </div>
      <div className="space-y-1 flex flex-col items-end">
        <div className="w-16 h-5 bg-amber-100/70 rounded-md" />
        <div className="w-12 h-3 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

