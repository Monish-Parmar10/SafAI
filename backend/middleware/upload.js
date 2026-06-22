const multer = require('multer');

// Use memoryStorage — files go into req.file.buffer, never touch disk
// We upload the buffer directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

const uploadSingle = upload.single('photo');
const uploadCompletion = upload.single('afterPhoto');

module.exports = { uploadSingle, uploadCompletion };
