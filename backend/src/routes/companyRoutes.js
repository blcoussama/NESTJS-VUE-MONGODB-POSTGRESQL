import express from 'express';
import { registerCompany, updateCompany, deleteCompany, getRecruiterCompanies, viewCompany } from "../controllers/companyController.js"
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';

const router = express.Router();

router.post('/register', VerifyToken, authorizedRoles("recruiter"), registerCompany);
router.put('/update/:id', VerifyToken, authorizedRoles("recruiter"), updateCompany);
router.delete('/delete/:id', VerifyToken, authorizedRoles("recruiter"), deleteCompany);
router.get('/companies', VerifyToken, authorizedRoles("recruiter"), getRecruiterCompanies);
router.get('/:id', VerifyToken, viewCompany);

export default router;