import express from 'express'
import { SignUp, VerifyEmail, Login, Logout, ForgotPassword, ResetPassword, CheckAuth, RefreshToken } from '../controllers/authController.js'
import { VerifyToken } from '../middlewares/verifyToken.js'

const router = express.Router()

router.get("/check-auth", VerifyToken, CheckAuth)

router.post("/signup", SignUp)
router.post("/verify-email", VerifyEmail)
router.post("/login", Login)
router.post("/logout", Logout)
router.post("/forgot-password", ForgotPassword)
router.post("/reset-password/:token", ResetPassword)

router.post("/refresh-token", RefreshToken);

export default router 