import dotenv from 'dotenv';
dotenv.config();

import Redis from 'ioredis';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedisConfig, getSanitizedRedisUrl, createRedisConnection, resolveRedisUrl, hasRedisConfigured } from '../src/config/redis.js';
import {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  addNotificationJob,
  closeNotificationQueue
} from '../src/queues/notification.queue.js';
import {
  startNotificationWorker,
  closeNotificationWorker,
  processNotificationJob
} from '../src/workers/notification.worker.js';
import {
  NOTIFICATION_JOB_TYPES,
  buildTestNotificationPayload
} from '../src/jobs/notification.jobs.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runBullMQRedisTests() {
  console.log('================================================================');
  console.log('TEST SUITE: BullMQ + Redis Cloud Integration');
  console.log('================================================================\n');

  // Step 1: Environment Variable Check
  console.log('>>> 1. Environment Variable & Credentials Safety <<<');
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) {
    console.error('ERROR: Redis configuration is missing in backend/.env.');
    console.error('Please configure REDIS_URL or REDIS_HOST/PORT/PASSWORD in backend/.env and re-run.');
    process.exit(1);
  }

  const sanitizedUrl = getSanitizedRedisUrl(redisUrl);
  console.log(`Configured Redis: ${sanitizedUrl}`);
  const pass = process.env.REDIS_PASSWORD || (redisUrl.includes('@') ? new URL(redisUrl.replace('rediss://', 'https://')).password : '');
  if (pass) {
    assert(!sanitizedUrl.includes(pass), 'Redis password is not exposed in sanitized URL');
  } else {
    assert(true, 'Redis password check skipped (no password)');
  }
  assert(redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'), 'Resolved Redis URL has valid redis/rediss scheme');

  // Step 2: Direct Redis Ping
  console.log('\n>>> 2. Redis Cloud Connectivity & TLS Check <<<');
  const directClient = createRedisConnection();
  try {
    const pong = await directClient.ping();
    assert(pong === 'PONG', 'Direct Redis ping returned PONG');
    console.log('  [INFO] Redis server responded to PING successfully.');
  } finally {
    await directClient.quit();
  }

  // Step 3: Queue & Worker Initialization
  console.log('\n>>> 3. BullMQ Queue & Worker Initialization <<<');
  const queue = getNotificationQueue();
  assert(queue.name === NOTIFICATION_QUEUE_NAME, `Queue created with name "${NOTIFICATION_QUEUE_NAME}"`);

  // Initialize QueueEvents for tracking job lifecycle
  const { redisUrl: eventUrl, options: eventOptions } = getRedisConfig();
  const queueEvents = new QueueEvents(NOTIFICATION_QUEUE_NAME, {
    connection: new Redis(eventUrl, eventOptions)
  });
  await queueEvents.waitUntilReady();
  assert(queueEvents !== null, 'QueueEvents listener connected and ready');

  // Start Worker
  const worker = startNotificationWorker();
  assert(worker !== null, 'Worker initialized and running');

  // Step 4: Successful Test Job Processing
  console.log('\n>>> 4. Successful Test Job Processing <<<');
  const testPayload = buildTestNotificationPayload({
    recipientId: 'student_clerk_test_123',
    message: 'Welcome to CampusPool ride sharing!'
  });

  const jobA = await addNotificationJob(
    NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION,
    testPayload,
    { jobId: `test-success-${Date.now()}` }
  );
  assert(jobA.id !== undefined, `Job enqueued with ID: ${jobA.id}`);

  // Wait for job completion
  const completedResult = await jobA.waitUntilFinished(queueEvents, 10000);
  assert(completedResult.success === true, 'Job completed with success: true');
  assert(completedResult.recipientId === 'student_clerk_test_123', 'Job result matches recipient ID');

  const stateA = await jobA.getState();
  assert(stateA === 'completed', 'Job final state is "completed"');

  // Step 5: Failed Job Retry Behavior Test
  console.log('\n>>> 5. Job Retry Behavior with Exponential Backoff <<<');
  const retryPayload = buildTestNotificationPayload({
    recipientId: 'student_clerk_retry_user',
    message: 'Testing transient retry failure',
    shouldFail: true // Fails on attempt 0, succeeds on attempt 1
  });

  const jobB = await addNotificationJob(
    NOTIFICATION_JOB_TYPES.TEST_NOTIFICATION,
    retryPayload,
    {
      jobId: `test-retry-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 }
    }
  );

  const retryResult = await jobB.waitUntilFinished(queueEvents, 15000);
  assert(retryResult.success === true, 'Job with transient failure recovered and completed');
  const freshJobB = await queue.getJob(jobB.id);
  assert(freshJobB.attemptsMade >= 1, `Job verified retry attempt (attemptsMade: ${freshJobB.attemptsMade})`);

  // Step 6: Graceful Shutdown
  console.log('\n>>> 6. Graceful Shutdown Test <<<');
  await queueEvents.close();
  await closeNotificationWorker();
  await closeNotificationQueue();
  assert(true, 'Worker, Queue, and Event connections shut down gracefully without errors');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed (100%)`);
  console.log('================================================================\n');
}

runBullMQRedisTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[FATAL] Test execution failed:', err);
    process.exit(1);
  });
