import express from 'express';
import { recruiterProfileSetup, candidateProfileSetup, viewUserProfile } from '../controllers/userController.js';
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';
import uploadMultiple from '../middlewares/multer.js';


const router = express.Router();

// SET Recruiter PROFILE
router.put('/recruiter-profile-update', VerifyToken, authorizedRoles("recruiter"), uploadMultiple, recruiterProfileSetup);

// SET Candidate PROFILE
router.put('/candidate-profile-update', VerifyToken, authorizedRoles("candidate"), uploadMultiple, candidateProfileSetup);

// View User PROFILE
router.get('/profile/:id', VerifyToken, viewUserProfile)

export default router;