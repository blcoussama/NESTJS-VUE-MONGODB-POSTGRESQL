import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import FormInput from "../components/FormInput";
import { Loader, Lock } from "lucide-react";
import { clearError, clearLoading, resetPassword } from "../store/authSlice";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState(""); // State to hold form validation errors

  const dispatch = useDispatch();
  const { token } = useParams(); // Get reset token from URL
  const navigate = useNavigate();

  const { isLoading, error } = useSelector((state) => state.auth); // Access Redux state

   useEffect(() => {
    // Clear error when component mounts
    dispatch(clearError()); // Dispatch an action to clear error (define this action in your Redux slice)

    // Clear Loading when component mounts
          dispatch(clearLoading());// Dispatch an action to clear the loading (define in Redux slice)

  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(""); // Reset form error on new submission

    // Client-side form validation
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      // Dispatch resetPassword thunk
      const resultAction = await dispatch(resetPassword({ token, password }));

      if (resetPassword.fulfilled.match(resultAction)) {
          navigate("/login"); // Redirect to login after success
      } else {
        console.error(resultAction.payload || "Password reset failed.");
      }
    } catch (err) {
      console.error("Unexpected error during password reset:", err);
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
          Reset Password
        </h2>

        {/* Backend Errors */}
        {error && <p className="text-red-500 font-semibold mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          {/* New Password Input */}
          <FormInput
            icon={Lock}
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Confirm New Password Input */}
          <FormInput
            icon={Lock}
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {/* Client-side Form Validation Errors */}
          {formError && <p className="text-red-500 font-semibold mb-2">{formError}</p>}

          {/* Submit Button */}
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
              "Set New Password"
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

export default ResetPasswordPage;
