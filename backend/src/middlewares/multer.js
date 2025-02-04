import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Log the incoming file details
    console.log("Incoming file:", {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname
    });

    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload only images.'), false);
    }
  }
}).single('profilePicture');

// Wrap multer middleware to handle errors
const uploadMiddleware = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err);
      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message
      });
    } else if (err) {
      console.error("Other upload error:", err);
      return res.status(400).json({
        success: false,
        message: "Error uploading file",
        error: err.message
      });
    }
    next();
  });
};

export default uploadMiddleware;