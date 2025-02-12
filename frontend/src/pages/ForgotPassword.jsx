import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Loader, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import FormInput from "../components/FormInput";
import { clearError, clearLoading, forgotPassword } from "../store/authSlice"; // Import forgotPassword thunk

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth); // Access isLoading and error states

  useEffect(() => {
    // Clear error when component mounts
    dispatch(clearError()); // Dispatch an action to clear error (define this action in your Redux slice)

    // Clear Loading when component mounts
    dispatch(clearLoading());// Dispatch an action to clear the loading (define in Redux slice)
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Dispatch forgotPassword thunk
      const resultAction = await dispatch(forgotPassword({ email }));
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
      className="max-w-md w-full bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden"
    >
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-300 to-emerald-600 text-transparent bg-clip-text">
          Forgot Password
        </h2>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit}>
            <p className="text-gray-300 mb-6 text-center">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <FormInput
              icon={Mail}
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* Error Message */}
            {error && (
              <p className="text-red-500 font-semibold mb-2">{error}</p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition duration-200"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader className="animate-spin mx-auto" size={24} />
              ) : (
                "Send Reset Link"
              )}
            </motion.button>
          </form>
        ) : (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Mail className="h-8 w-8 text-white" />
            </motion.div>
            <p className="text-gray-300 mb-6">
              If an account exists for <span className="font-semibold">{email}</span>, you will receive a password reset link shortly.
            </p>
          </div>
        )}
      </div>

      <div className="px-8 py-4 bg-gray-900 bg-opacity-50 flex justify-center">
        <Link
          to={"/login"}
          className="text-sm text-green-400 hover:underline flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
        </Link>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;
