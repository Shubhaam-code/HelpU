/**
 * Deterministic teacher avatar assignment for Helpu Faculty Search.
 * Maps a faculty's unique identifier (facultyId, _id, or name) to one of the 10
 * supplied avatar assets (/avatars/faculty-avatar-1.png .. 10.png).
 *
 * Guarantees consistent avatar rendering across searches, page reloads, and device switches
 * without altering the underlying MongoDB data.
 */
export function getFacultyAvatar(faculty) {
  if (!faculty) return '/avatars/faculty-avatar-1.png';

  const seed = (faculty.facultyId || faculty._id || faculty.name || 'VITB-0001').toString();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = (Math.abs(hash) % 10) + 1;
  return `/avatars/faculty-avatar-${index}.png`;
}

export default getFacultyAvatar;

