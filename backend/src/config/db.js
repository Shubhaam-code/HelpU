import mongoose from 'mongoose';

const RETRY_DELAY_MS = 5000;
const SERVER_SELECTION_TIMEOUT_MS = 10000;

let connectionPromise = null;

/**
 * Connect to MongoDB with automatic retry.
 *
 * Mongoose does NOT retry the initial connection if it fails, which leaves the
 * server running while every query buffers for 10s and then fails with a
 * generic 500. Retrying here keeps the API usable as soon as the database
 * becomes reachable again.
 */
const connectDB = async () => {
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuspool';

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB connection error: ${error.message}`);
      console.warn(`[MongoDB] Retrying connection in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      connectionPromise = null;
      return connectDB();
    }
  })();

  return connectionPromise;
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected. Mongoose will attempt to reconnect automatically.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected successfully.');
});

mongoose.connection.on('error', (error) => {
  console.error(`[MongoDB] Connection error: ${error.message}`);
});

/**
 * True when the connection is ready to serve queries.
 */
export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const getDatabaseState = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
  return states[mongoose.connection.readyState] || 'unknown';
};

export default connectDB;
