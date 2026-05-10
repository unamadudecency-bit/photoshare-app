const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { photos } = require('../db');
const { uploadPhoto, deletePhoto } = require('../storage');
const { analyzeImage } = require('../vision');
const { verifyToken, requireCreator } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// CREATE photo (creator only)
router.post('/', verifyToken, requireCreator, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    // 1. Upload to Blob (or local fs in mock mode)
    const { blobName, url } = await uploadPhoto(
      req.file.buffer, req.file.mimetype, req.file.originalname
    );

    // 2. Analyse with Computer Vision (advanced feature)
    const analysis = await analyzeImage(url);

    // 3. Persist metadata
    const photo = {
      id: uuidv4(),
      creatorId: req.user.id,
      creatorName: req.user.email,
      title: req.body.title || 'Untitled',
      caption: req.body.caption || '',
      location: req.body.location || '',
      people: req.body.people
        ? req.body.people.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      blobName,
      url,
      autoTags: analysis.autoTags,
      autoCaption: analysis.autoCaption,
      categories: analysis.categories,
      ratingSum: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString()
    };
    await photos.items.create(photo);
    res.status(201).json(photo);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
});

// LIST photos (with optional search)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let querySpec;
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      querySpec = {
        query: `SELECT * FROM c WHERE
                  LOWER(c.title) LIKE @t OR
                  LOWER(c.caption) LIKE @t OR
                  LOWER(c.location) LIKE @t OR
                  EXISTS(SELECT VALUE t FROM t IN c.autoTags WHERE LOWER(t.name) LIKE @t)
                ORDER BY c._ts DESC`,
        parameters: [{ name: '@t', value: term }]
      };
    } else {
      querySpec = { query: 'SELECT * FROM c ORDER BY c._ts DESC' };
    }
    const { resources } = await photos.items.query(querySpec).fetchAll();
    res.json(resources);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to list photos' });
  }
});

// GET single photo
router.get('/:id', async (req, res) => {
  try {
    const { resources } = await photos.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.params.id }]
      })
      .fetchAll();
    if (resources.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(resources[0]);
  } catch (err) {
    console.error('Get error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// RATE photo
router.post('/:id/rate', verifyToken, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating 1-5 required' });
    }

    const { resources } = await photos.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.params.id }]
      })
      .fetchAll();
    if (resources.length === 0) return res.status(404).json({ error: 'Not found' });

    const photo = resources[0];
    photo.ratingSum = (photo.ratingSum || 0) + rating;
    photo.ratingCount = (photo.ratingCount || 0) + 1;

    await photos.items.upsert(photo);
    res.json({ avgRating: photo.ratingSum / photo.ratingCount, count: photo.ratingCount });
  } catch (err) {
    console.error('Rate error:', err);
    res.status(500).json({ error: 'Failed to rate' });
  }
});

// DELETE (creator only, own photos)
router.delete('/:id', verifyToken, requireCreator, async (req, res) => {
  try {
    const { resources } = await photos.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.params.id }]
      })
      .fetchAll();
    const photo = resources[0];
    if (!photo) return res.status(404).json({ error: 'Not found' });
    if (photo.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Not your photo' });
    }

    await deletePhoto(photo.blobName);
    await photos.item(photo.id, photo.creatorId).delete();
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;