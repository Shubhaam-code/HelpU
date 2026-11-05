/**
 * Socket.IO real-time notification abstraction service.
 * Supports emitting real-time updates when Socket.IO server is attached,
 * with safe graceful fallback when not available.
 */

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
  if (io) {
    console.log('[Socket.IO] Real-time notification server attached.');
  }
}

export function getSocketIO() {
  return ioInstance;
}

export function emitRealtimeNotification(recipientId, notification) {
  if (!ioInstance || !recipientId) return false;
  try {
    ioInstance.to(`user_${recipientId}`).emit('notification', notification);
    ioInstance.to(recipientId).emit('notification', notification);
    return true;
  } catch (err) {
    console.warn('[Socket.IO] Failed to emit real-time notification:', err.message);
    return false;
  }
}

