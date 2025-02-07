import express from 'express';
import { deleteJob, getAllJobs, getJobsByCompany, getJobsByRecruiter, postJob, updateJob, viewJob } from "../controllers/jobController.js"
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';

const router = express.Router();

router.post('/post', VerifyToken, authorizedRoles("recruiter"), postJob);
router.put('/update/:id', VerifyToken, authorizedRoles("recruiter"), updateJob);
router.delete('/delete/:id', VerifyToken, authorizedRoles("recruiter"), deleteJob);
router.get('/posted-jobs/:recruiterId', VerifyToken, getJobsByRecruiter);
router.get('/all', VerifyToken, getAllJobs)
router.get('/:id', VerifyToken, viewJob);
router.get('/company-jobs/:companyId', VerifyToken, getJobsByCompany);



export default router;