import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initFirebaseAdmin } from './src/config/firebase.js';

import mongoose from 'mongoose';
import { closeNotificationQueue } from './src/queues/notification.queue.js';
import { startOutboxProcessor, stopOutboxProcessor } from './src/services/outbox.service.js';

const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK safely
initFirebaseAdmin();

// Connect to Database
connectDB().then(() => {
  // Start periodic outbox processor after DB is connected
  startOutboxProcessor({ intervalMs: 5000 });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown handling
async function handleServerShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      stopOutboxProcessor();
      await closeNotificationQueue();
      await mongoose.disconnect();
      console.log('[Server] Database connections closed.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleServerShutdown('SIGTERM'));
process.on('SIGINT', () => handleServerShutdown('SIGINT'));

