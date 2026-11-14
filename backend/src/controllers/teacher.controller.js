import { listTeachersForUser } from '../services/ffcsCatalog.service.js';

export async function listTeachersHandler(req, res) {
  try {
    const courses = await listTeachersForUser(req.userId);
    return res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('[FFCS] Failed to list teachers:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve teacher data.'
    });
  }
}
