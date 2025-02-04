import express from 'express';
import { recruiterProfileSetup, candidateProfileSetup, viewUserProfile } from '../controllers/userController.js';
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';
import uploadMiddleware from '../middlewares/multer.js';


const router = express.Router();

// SET Recruiter PROFILE
router.put('/recruiter-profile', VerifyToken, authorizedRoles("recruiter"), uploadMiddleware, recruiterProfileSetup);

// SET Candidate PROFILE
router.put('/candidate-profile', VerifyToken, authorizedRoles("candidate"), uploadMiddleware, candidateProfileSetup);

// Get User PROFILE
router.get('/profile/:id', VerifyToken, viewUserProfile)

export default router;