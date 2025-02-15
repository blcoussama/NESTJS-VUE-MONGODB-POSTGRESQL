import express from 'express';
import { registerCompany, updateCompany, deleteCompany, getRecruiterCompanies, viewCompany } from "../controllers/companyController.js"
import { VerifyToken } from '../middlewares/verifyToken.js';
import { authorizedRoles } from '../middlewares/verifyRole.js';
import uploadMultiple from '../middlewares/multer.js';

const router = express.Router();

router.post('/register', VerifyToken, authorizedRoles("recruiter"), uploadMultiple, registerCompany);
router.put('/update/:id', VerifyToken, authorizedRoles("recruiter"), uploadMultiple, updateCompany);
router.delete('/delete/:id', VerifyToken, authorizedRoles("recruiter"), deleteCompany);
router.get('/companies/:recruiterId', VerifyToken, getRecruiterCompanies);
router.get('/:id', VerifyToken, viewCompany);

export default router;