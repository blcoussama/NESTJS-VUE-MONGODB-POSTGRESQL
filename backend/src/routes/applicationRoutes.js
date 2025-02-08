import express from 'express';
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';
import { acceptApplication, applyForJob, getCandidateApplications, getJobApplications, rejectApplication, withdrawApplication } from '../controllers/applicationController.js';

const router = express.Router();

router.post('/apply/:jobId', VerifyToken, authorizedRoles("candidate"), applyForJob);
router.get('/job/:jobId', VerifyToken, authorizedRoles("recruiter"), getJobApplications);
router.put("/accept/:id", VerifyToken, authorizedRoles("recruiter"), acceptApplication);
router.put("/reject/:id", VerifyToken, authorizedRoles("recruiter"), rejectApplication);
router.get('/my-applications', VerifyToken, authorizedRoles("candidate"), getCandidateApplications);
router.put("/withdraw/:id", VerifyToken, authorizedRoles("candidate"), withdrawApplication);



export default router;