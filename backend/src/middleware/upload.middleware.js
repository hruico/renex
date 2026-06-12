const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Files are stored locally in the backend/uploads/assets directory
    cb(null, 'uploads/assets/');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    cb(null, 'asset-' + Date.now() + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

// Create the multer instance
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max size
  }
});

module.exports = upload;
