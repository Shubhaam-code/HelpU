import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import travelRoutes from './routes/travel.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import communityRoutes from './routes/community.routes.js';
import helpRoutes from './routes/help.routes.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CampusPool API is running'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/travels', travelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/help', helpRoutes);

export default app;


