import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Loader, Lock } from "lucide-react";
import { clearError, clearLoading, resetPassword } from "../store/authSlice";

// Shadcn UI Components
import { CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState(""); // Client-side validation errors

  const dispatch = useDispatch();
  const { token } = useParams(); // Reset token from URL
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    dispatch(clearLoading());
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Client-side validation
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    try {
      await dispatch(resetPassword({ token, password })).unwrap();
      // If we reach here, the reset was successful
      navigate("/login", { state: { message: "Password reset successfully. Please log in." } });
    } catch (err) {
      console.error("Error during password reset:", err);
      setFormError(err || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 mt-20 rounded-2xl bg-card border shadow-xl"
    >
      <CardHeader>
        <h2 className="text-3xl font-bold mb-6 text-center">Reset Password</h2>
      </CardHeader>
      <CardContent>
        {/* Server-side error from Redux */}
        {error && <p className="text-red-500 font-semibold mb-4">{error}</p>}
        {/* Client-side or caught error */}
        {formError && <p className="text-red-500 font-semibold mb-4">{formError}</p>}
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* New Password Input */}
          <div>
            <Label htmlFor="password" className="mb-1">
              New Password
            </Label>
            <div className="relative mt-2">
              <Lock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              <Input
                id="password"
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Confirm New Password Input */}
          <div>
            <Label htmlFor="confirmPassword" className="mb-1">
              Confirm New Password
            </Label>
            <div className="relative mt-2">
              <Lock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 cursor-pointer"
              variant="default"
            >
              {isLoading ? (
                <Loader className="animate-spin mx-auto" size={24} />
              ) : (
                "Set New Password"
              )}
            </Button>
          </motion.div>
        </form>
      </CardContent>
    </motion.div>
  );
};

export default ResetPasswordPage;