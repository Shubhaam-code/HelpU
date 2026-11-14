import {
  createSlotPost,
  updateSlotPost,
  getMySlotPosts,
  getMatchesForPost,
  getMatchDetails
} from '../services/slotMatching.service.js';
import SlotPost from '../models/SlotPost.js';
import Notification from '../models/Notification.js';

/**
 * @route   POST /api/slotmate/posts
 * @desc    Create a new slot post and calculate immediate matches
 * @access  Protected
 */
export async function createPost(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
    }

    const { courseId, courseCode, slot, teacherName, additionalNotes } = req.body;

    if (!courseId && !courseCode) {
      return res.status(400).json({
        success: false,
        message: 'Course selection is required from the course catalogue'
      });
    }

    if (!slot || typeof slot !== 'string' || !slot.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Valid slot selection is required'
      });
    }

    if (!teacherName || typeof teacherName !== 'string' || !teacherName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Teacher name is required'
      });
    }

    const result = await createSlotPost({
      userId,
      courseId,
      courseCode,
      slot,
      teacherName,
      additionalNotes
    });

    return res.status(201).json({
      success: true,
      message: 'Slot post created successfully',
      post: result.post,
      matchCount: result.matchCount
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create slot post'
    });
  }
}

/**
 * @route   GET /api/slotmate/posts/my
 * @desc    Get all active posts of logged-in student with match counts
 * @access  Protected
 */
export async function getMyPosts(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
    }

    const posts = await getMySlotPosts(userId);

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve your slot posts'
    });
  }
}

/**
 * @route   GET /api/slotmate/matches/my
 * @desc    Get all posts created by logged-in student with respective match counts
 * @access  Protected
 */
export async function getMyMatches(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
    }

    const posts = await getMySlotPosts(userId);
    const totalMatches = posts.reduce((sum, p) => sum + (p.matchCount || 0), 0);

    return res.status(200).json({
      success: true,
      totalPosts: posts.length,
      totalMatches,
      posts
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve matches'
    });
  }
}

/**
 * @route   GET /api/slotmate/posts/:postId/matches
 * @desc    Get all students matching a particular post
 * @access  Protected
 */
export async function getPostMatches(req, res) {
  try {
    const { postId } = req.params;
    const currentUserId = req.userId;

    const result = await getMatchesForPost(postId, currentUserId);

    return res.status(200).json({
      success: true,
      post: result.post,
      totalMatches: result.totalMatches,
      matches: result.matches
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve matches for post'
    });
  }
}

/**
 * @route   GET /api/slotmate/matches/:matchId
 * @desc    Get complete details of a specific match
 * @access  Protected
 */
export async function getMatchDetailsHandler(req, res) {
  try {
    const { matchId } = req.params;
    const match = await getMatchDetails(matchId);

    return res.status(200).json({
      success: true,
      match
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve match details'
    });
  }
}

/**
 * @route   PUT /api/slotmate/posts/:postId
 * @desc    Update an existing slot post and recalculate matches
 * @access  Protected
 */
export async function updatePost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
    }

    const { courseId, courseCode, slot, teacherName, additionalNotes } = req.body;

    const result = await updateSlotPost({
      postId,
      userId,
      courseId,
      courseCode,
      slot,
      teacherName,
      additionalNotes
    });

    return res.status(200).json({
      success: true,
      message: 'Slot post updated successfully',
      post: result.post,
      matchCount: result.matchCount
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update slot post'
    });
  }
}

/**
 * @route   DELETE /api/slotmate/posts/:postId
 * @desc    Delete or close an active slot post
 * @access  Protected
 */
export async function deletePost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    const post = await SlotPost.findOne({ _id: postId, userId });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or unauthorized'
      });
    }

    post.status = 'closed';
    await post.save();

    // Auto-cleanup: remove all notifications referencing this closed/deleted slot post (Problem 1)
    try {
      await Notification.deleteMany({
        $or: [
          { relatedSlotPostId: post._id },
          { 'metadata.matchId': String(post._id) },
          { 'metadata.postId': String(post._id) },
          { 'metadata.matchId': post._id },
          { 'metadata.postId': post._id }
        ]
      });
    } catch (notifErr) {
      console.warn('[DeleteSlotPost] Notification cleanup error:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Post closed successfully'
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete post'
    });
  }
}

/**
 * @route   GET /api/slotmate/posts
 * @desc    Explore active slot posts for course/slot matching (Public Preview)
 *          Strictly scrubs all student phone, email, and registration numbers.
 * @access  Public / Optional Auth
 */
export async function getPublicPosts(req, res) {
  try {
    const query = { status: 'active' };
    if (req.query.courseCode) {
      query.courseCode = req.query.courseCode.trim().toUpperCase();
    }
    if (req.query.slot) {
      query.slot = req.query.slot.trim().toUpperCase();
    }

    const posts = await SlotPost.find(query)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // Map and sanitize: Never expose student phone, whatsapp, or email to guests or general feed
    const sanitizedPosts = posts.map(p => ({
      _id: p._id,
      courseCode: p.courseCode,
      courseName: p.courseName,
      slot: p.slot,
      teacherName: p.teacherName,
      additionalNotes: p.additionalNotes || '',
      status: p.status,
      createdAt: p.createdAt,
      phone: null,
      whatsappNumber: null,
      studentEmail: null,
      student: {
        college: 'VIT',
        isVerified: true,
        phone: null,
        whatsappNumber: null,
        email: null,
        registrationNumber: null
      }
    }));

    return res.status(200).json({
      success: true,
      count: sanitizedPosts.length,
      isGuest: !req.userId,
      posts: sanitizedPosts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve slot posts'
    });
  }
}

