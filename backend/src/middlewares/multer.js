import multer from 'multer';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    console.log("Incoming file:", {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname
    });
    
    if (file.fieldname === 'profilePicture') {
      // Only allow image files for profile picture
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Not an image! Please upload only images for the profile picture.'), false);
      }
    } else if (file.fieldname === 'resume') {
      // Allow PDF, DOC, DOCX for resume uploads
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type for resume. Only PDF, DOC, or DOCX files are allowed.'), false);
      }
    } else {
      cb(new Error('Unexpected field: ' + file.fieldname), false);
    }
  }
});

// Export a middleware function to handle multiple fields
const uploadMultiple = (req, res, next) => {
  // Expect fields: profilePicture and resume (each maximum 1 file)
  const multiUpload = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
  ]);
  
  multiUpload(req, res, function(err) {
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

export default uploadMultiple;
