import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Loader, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { clearError, clearLoading, forgotPassword } from "../store/authSlice";

// Shadcn UI Components
import { CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    dispatch(clearLoading());
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Custom email validation using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");

    try {
      const resultAction = await dispatch(forgotPassword({ email })).unwrap();
      if (forgotPassword.fulfilled.match(resultAction)) {
        setIsSubmitted(true);
      }
    } catch (err) {
      console.error("Error sending password reset link:", err);
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
        <h2 className="text-3xl font-bold mb-6 text-center">
          Forgot Password
        </h2>
      </CardHeader>
      <CardContent>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <p className="text-center mb-6">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
            <div>
              <Label htmlFor="email" className="mb-1">
                Email Address
              </Label>
              <div className="relative mt-2">
                <Mail className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              {emailError && <p className="text-red-500 font-semibold mt-2">{emailError}</p>}
            </div>

            {error && <p className="text-red-500 font-semibold mb-2">{error}</p>}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4"
                variant="default"
              >
                {isLoading ? (
                  <Loader className="animate-spin mx-auto" size={24} />
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </motion.div>
          </form>
        ) : (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Mail className="h-8 w-8 text-white" />
            </motion.div>
            <p className="text-gray-500 mb-6">
              You will receive a password reset link shortly.
            </p>
          </div>
        )}
      </CardContent>
      <div className="px-8 py-4 bg-card bg-opacity-50 flex justify-center">
        <Link
          to="/login"
          className="text-sm hover:underline flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
        </Link>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;
