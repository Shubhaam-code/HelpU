import React from 'react';

/**
 * Teacher & Classroom Lecture Icon
 * Matching user's reference: Professor pointing to board with student audience.
 */
export function TeacherClassroomIcon({ className = 'w-6 h-6', ...props }) {
  return (
    <svg
      viewBox="3 2.5 27.5 24.5"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Teacher Head */}
      <circle cx="8" cy="7" r="2.8" />

      {/* Teacher Body with Pointer Arm */}
      <path
        d="M8.2 11.2c-2.3 0-4.2 1.9-4.2 4.2v2.8c0 .6.5 1 1 1h.5v6.8c0 .6.5 1.1 1.1 1.1h1c.6 0 1-.5 1-1v-6.5h.8v6.5c0 .6.5 1 1 1h1c.6 0 1.1-.5 1.1-1.1v-6.8h.5c.6 0 1-.4 1-1v-2.2l4.8-1.5c.5-.2.8-.7.6-1.2-.2-.5-.7-.8-1.2-.6L12.4 13c-.9-.9-2.3-1.8-4.2-1.8z"
      />

      {/* Presentation Whiteboard */}
      <rect x="14" y="4" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
      {/* 3 Text lines on board */}
      <line x1="17" y1="7" x2="25.5" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="17" y1="9.5" x2="25.5" y2="9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="17" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Board Stand / Mount */}
      <path d="M19 15v1.5h5V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {/* Students in front (3 Audience silhouettes) */}
      {/* Student 1 (Left) */}
      <circle cx="14.5" cy="20" r="1.8" />
      <path d="M12 26c0-1.8 1.1-2.8 2.5-2.8s2.5 1 2.5 2.8H12z" />

      {/* Student 2 (Center) */}
      <circle cx="20" cy="19.5" r="1.8" />
      <path d="M17.5 26c0-2 1.1-3 2.5-3s2.5 1 2.5 3H17.5z" />

      {/* Student 3 (Right) */}
      <circle cx="25.5" cy="20" r="1.8" />
      <path d="M23 26c0-1.8 1.1-2.8 2.5-2.8s2.5 1 2.5 2.8H23z" />
    </svg>
  );
}
