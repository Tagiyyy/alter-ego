const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const settings = require('../services/settings');

// Configure multer for background image uploads
settings.ensureBackgroundsDir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, settings.BACKGROUNDS_DIR);
  },
  filename: (req, file, cb) => {
    const relationship = req.params.relationship;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${relationship}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image format'));
    }
  },
});

// Get current settings + available relationship options
router.get('/', (req, res) => {
  const current = settings.loadSettings();
  res.json({
    settings: current,
    relationshipOptions: settings.RELATIONSHIP_OPTIONS,
  });
});

// Update relationship setting
router.put('/relationship', (req, res) => {
  const { relationship } = req.body;
  if (!relationship) {
    return res.status(400).json({ error: 'relationship is required' });
  }

  try {
    const updated = settings.setRelationship(relationship);
    res.json({ settings: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get background image URL for a relationship
router.get('/background/:relationship', (req, res) => {
  const url = settings.getBackgroundImage(req.params.relationship);
  res.json({ url });
});

// Upload background image for a relationship
router.post('/background/:relationship', upload.single('image'), (req, res) => {
  const { relationship } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    settings.setBackgroundImage(relationship, req.file.filename);
    const url = `/img/backgrounds/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete background image for a relationship
router.delete('/background/:relationship', (req, res) => {
  try {
    settings.removeBackgroundImage(req.params.relationship);
    res.json({ url: null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
