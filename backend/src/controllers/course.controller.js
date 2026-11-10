import { searchCourses } from '../services/courseCatalogue.service.js';

/**
 * Controller to search courses in the catalogue.
 * Endpoint: GET /api/slotmate/courses?q=data
 */
export async function getCourses(req, res) {
  try {
    const query = req.query.q || req.query.search || req.query.query || '';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 500;

    const courses = await searchCourses(query, limit);

    return res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve courses',
      error: error.message
    });
  }
}

