import dotenv from 'dotenv';
dotenv.config();

import { startNotificationWorker, closeNotificationWorker } from './src/workers/notification.worker.js';
import { hasRedisConfigured } from './src/config/redis.js';

if (!hasRedisConfigured()) {
  console.warn('[Worker] Warning: Redis configuration (REDIS_URL or REDIS_HOST) is not set. Worker will not start.');
} else {
  console.log('[Worker] Initializing CampusPool BullMQ background worker...');
  startNotificationWorker();
}

async function handleShutdown(signal) {
  console.log(`\n[Worker] Received ${signal}. Initiating graceful shutdown...`);
  try {
    await closeNotificationWorker();
    console.log('[Worker] Graceful shutdown completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Worker] Error during worker shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
