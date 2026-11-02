import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import HelpRequest from '../models/HelpRequest.js';

const router = express.Router();

/**
 * @route   GET /api/help/requests
 * @desc    Get all open help requests (paginated)
 * @access  Protected
 */
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const status = req.query.status || 'Open';

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const [requests, total] = await Promise.all([
      HelpRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      HelpRequest.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: { total, page, pages: Math.ceil(total / limit), limit }
    });
  } catch (error) {
    console.error('Error fetching help requests:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch help requests', error: error.message });
  }
});

/**
 * @route   GET /api/help/requests/my
 * @desc    Get help requests created by the logged-in user
 * @access  Protected
 */
router.get('/requests/my', requireAuth, async (req, res) => {
  try {
    const requests = await HelpRequest.find({ authorId: req.userId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching my help requests:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch your help requests', error: error.message });
  }
});

/**
 * @route   POST /api/help/requests
 * @desc    Create a new help request
 * @access  Protected
 */
router.post('/requests', requireAuth, async (req, res) => {
  try {
    const { title, description, category, location, urgency, whatsapp, authorName } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    const helpRequest = await HelpRequest.create({
      authorId: req.userId,
      authorName: authorName?.trim() || 'Student',
      title: title.trim(),
      description: description.trim(),
      category: category || 'other',
      location: location?.trim() || '',
      urgency: urgency === 'High' ? 'High' : 'Normal',
      whatsapp: whatsapp?.trim() || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Help request created successfully',
      data: helpRequest
    });
  } catch (error) {
    console.error('Error creating help request:', error);
    return res.status(500).json({ success: false, message: 'Failed to create help request', error: error.message });
  }
});

/**
 * @route   PATCH /api/help/requests/:id/status
 * @desc    Update status of a help request (owner only)
 * @access  Protected
 */
router.patch('/requests/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Open', 'InProgress', 'Resolved'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const helpRequest = await HelpRequest.findById(req.params.id);
    if (!helpRequest) {
      return res.status(404).json({ success: false, message: 'Help request not found' });
    }

    if (helpRequest.authorId !== req.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Not your help request' });
    }

    helpRequest.status = status;
    await helpRequest.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: helpRequest
    });
  } catch (error) {
    console.error('Error updating help request status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
});

export default router;

