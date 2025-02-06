import express from 'express';
import { deleteJob, postJob, updateJob } from "../controllers/jobController.js"
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';

const router = express.Router();

router.post('/post', VerifyToken, authorizedRoles("recruiter"), postJob);
router.put('/update/:id', VerifyToken, authorizedRoles("recruiter"), updateJob);
router.delete('/delete/:id', VerifyToken, authorizedRoles("recruiter"), deleteJob);

export default router;