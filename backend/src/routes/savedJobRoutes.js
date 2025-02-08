import express from 'express';
import { VerifyToken } from '../middlewares/verifyToken.js';
import { getSavedJobs, saveJob, unsaveJob } from '../controllers/savedJobController.js';

const router = express.Router();

router.post('/save/:jobId', VerifyToken, saveJob);
router.delete('/unsave/:jobId', VerifyToken, unsaveJob);
router.get('/all', VerifyToken, getSavedJobs);

export default router;