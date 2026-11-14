import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDatabaseReady, getDatabaseState } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import travelRoutes from './routes/travel.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import communityRoutes from './routes/community.routes.js';
import helpRoutes from './routes/help.routes.js';
import groupRoutes from './routes/group.routes.js';
import slotmateRoutes from './routes/slotmate.routes.js';
import facultyRoutes from './routes/faculty.routes.js';
import curriculumRoutes from './routes/curriculum.routes.js';
import adminCurriculumRoutes from './routes/adminCurriculum.routes.js';
import ffcsCourseRoutes from './routes/ffcsCourse.routes.js';
import teacherRoutes from './routes/teacher.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static assets with HTTP caching (7 days browser cache, 1 day stale-while-revalidate)
const staticAssetOptions = {
  maxAge: '7d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }
};
app.use('/images', express.static(path.join(__dirname, '../public/images'), staticAssetOptions));
app.use('/public', express.static(path.join(__dirname, '../public'), staticAssetOptions));

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CampusPool API is running'
  });
});

// Database readiness guard: fail fast with 503 instead of buffering for 10s
// and returning an opaque 500 when MongoDB is not connected.
app.use('/api', (req, res, next) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable: database is not connected yet. Please try again in a moment.',
      databaseState: getDatabaseState()
    });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/travels', travelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/slotmate', slotmateRoutes);
app.use('/api/faculty', facultyRoutes);

// FFCS curriculum, course registration and teacher APIs
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/admin/curriculum', adminCurriculumRoutes);
app.use('/api/courses', ffcsCourseRoutes);
app.use('/api/teachers', teacherRoutes);

export default app;
