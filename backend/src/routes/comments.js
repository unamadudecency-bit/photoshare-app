const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { comments } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// List comments for a photo
router.get('/:photoId', async (req, res) => {
  try {
    const { resources } = await comments.items
      .query({
        query: 'SELECT * FROM c WHERE c.photoId = @p ORDER BY c._ts DESC',
        parameters: [{ name: '@p', value: req.params.photoId }]
      })
      .fetchAll();
    res.json(resources);
  } catch (err) {
    console.error('List comments error:', err);
    res.status(500).json({ error: 'Failed to list comments' });
  }
});

// Add comment
router.post('/:photoId', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length === 0) {
      return res.status(400).json({ error: 'Comment required' });
    }
    const c = {
      id: uuidv4(),
      photoId: req.params.photoId,
      userId: req.user.id,
      userEmail: req.user.email,
      text,
      createdAt: new Date().toISOString()
    };
    await comments.items.create(c);
    res.status(201).json(c);
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;