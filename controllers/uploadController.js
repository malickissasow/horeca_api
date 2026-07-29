const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../config/db');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueName = `cv_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter (PDF, DOC, DOCX, IMAGES)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];
  const allowedExtensions = /\.(pdf|doc|docx|png|jpg|jpeg|webp)$/i;

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PDF, Word (DOC/DOCX) et Images (JPG, PNG) sont autorisés'), false);
  }
};

exports.upload = multer({ storage, fileFilter });


exports.handleCvUpload = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier CV n’a été téléversé' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'ID de l’utilisateur requis' });
    }

    const relativeUrl = `/uploads/${req.file.filename}`;

    await pool.promise().query(
      'UPDATE users SET cv_attached = TRUE, cv_url = ? WHERE id = ?',
      [relativeUrl, userId]
    );

    res.json({
      success: true,
      message: 'Fichier CV téléversé avec succès !',
      cvUrl: relativeUrl
    });
  } catch (error) {
    console.error('handleCvUpload error:', error);
    res.status(500).json({ error: 'Erreur lors de l’envoi du CV' });
  }
};
