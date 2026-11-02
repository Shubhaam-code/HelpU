import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import CommunityPost from '../models/Community.js';

const router = express.Router();

/**
 * @route   GET /api/community/posts
 * @desc    Get paginated community posts (optional category filter)
 * @access  Protected
 */
router.get('/posts', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const category = req.query.category;

    const filter = {};
    if (category && category !== 'All Posts') {
      filter.category = category;
    }

    const [posts, total] = await Promise.all([
      CommunityPost.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommunityPost.countDocuments(filter)
    ]);

    // Attach isLiked flag for the requesting user
    const userId = req.userId;
    const enriched = posts.map((p) => ({
      ...p,
      likeCount: p.likes.length,
      commentCount: p.comments.length,
      isLiked: p.likes.includes(userId)
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts', error: error.message });
  }
});

/**
 * @route   POST /api/community/posts
 * @desc    Create a new community post
 * @access  Protected
 */
router.post('/posts', requireAuth, async (req, res) => {
  try {
    const { content, category, whatsapp, authorName, college } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const post = await CommunityPost.create({
      authorId: req.userId,
      authorName: authorName?.trim() || 'Student',
      college: college?.trim() || 'VIT, Bhopal',
      content: content.trim(),
      category: category || 'General',
      whatsapp: whatsapp?.trim() || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
        ...post.toObject(),
        likeCount: 0,
        commentCount: 0,
        isLiked: false
      }
    });
  } catch (error) {
    console.error('Error creating community post:', error);
    return res.status(500).json({ success: false, message: 'Failed to create post', error: error.message });
  }
});

/**
 * @route   PATCH /api/community/posts/:id/like
 * @desc    Toggle like on a community post
 * @access  Protected
 */
router.patch('/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const userId = req.userId;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      data: {
        likeCount: post.likes.length,
        isLiked: !alreadyLiked
      }
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle like', error: error.message });
  }
});

/**
 * @route   POST /api/community/posts/:id/comments
 * @desc    Add a comment to a community post
 * @access  Protected
 */
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text, authorName } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const post = await CommunityPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = {
      authorId: req.userId,
      authorName: authorName?.trim() || 'Student',
      text: text.trim()
    };

    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Comment added',
      data: newComment,
      commentCount: post.comments.length
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, message: 'Failed to add comment', error: error.message });
  }
});

/**
 * @route   DELETE /api/community/posts/:id
 * @desc    Delete a community post (owner only)
 * @access  Protected
 */
router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.authorId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Not your post' });
    }

    await post.deleteOne();

    return res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete post', error: error.message });
  }
});

export default router;

