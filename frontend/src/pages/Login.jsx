import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Loader } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearError, clearLoading, login } from "../store/authSlice";

// Shadcn UI Components
import { CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    dispatch(clearLoading());
  }, [dispatch]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await dispatch(login({ email, password })).unwrap();
      navigate("/");
    } catch (err) {
      console.error("Unexpected error during login:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 mt-16 rounded-2xl bg-card border shadow-xl"
    >
      <CardHeader>
        <h2 className="text-3xl font-bold mb-6 text-center">Login</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-6" noValidate>
          {/* Email Input */}
          <div>
            <Label htmlFor="email" className="text-base">
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
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <Label htmlFor="password" className="text-base">
              Password
            </Label>
            <div className="relative mt-2">
              <Lock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="flex items-center mb-6">
            <Link
              to="/forgot-password"
              className="text-sm hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* API Error */}
          {error && (
            <p className="text-red-500 font-semibold mb-2">{error}</p>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isLoading} className="w-full cursor-pointer">
            {isLoading ? (
              <Loader className="animate-spin mx-auto" size={24} />
            ) : (
              "Login"
            )}
          </Button>
        </form>
      </CardContent>

      {/* Redirect to Sign-Up */}
      <div className="px-8 py-4 flex justify-center">
        <p className="text-sm">
          <span className="text-gray-400">Don&apos;t have an account?</span>{" "}
          <Link
            to="/"
            className="text-base hover:underline ml-2"
          >
            Create an Account
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default Login;
