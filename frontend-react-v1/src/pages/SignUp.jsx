import { motion } from 'framer-motion'
import { User, Mail, Lock, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import { useDispatch, useSelector } from 'react-redux'
import { clearError, clearLoading, signUp } from '../store/authSlice'

// Shadcn UI Components
import { CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const Signup = () => {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("")
  const [emailError, setEmailError] = useState("")

  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { isLoading, error } = useSelector((state) => state.auth)

  useEffect(() => {
    dispatch(clearError())
    dispatch(clearLoading())
    if (location.state?.role) {
      setRole(location.state.role)
    } else {
      navigate('/')
    }
  }, [dispatch, location.state?.role, navigate])

  const handleSignUp = async (e) => {
    e.preventDefault()

    // Custom email validation using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address")
      return
    }
    setEmailError("")

    try {
      await dispatch(signUp({ email, password, username, role })).unwrap()
      navigate("/verify-email")
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 pt-4 rounded-2xl bg-card border shadow-xl mt-6"
    >
      <CardHeader>
        <h2 className="text-3xl font-bold mb-6 text-center">Create an Account</h2>
      </CardHeader>
      <CardContent>
        {/* noValidate disables HTML5 built-in validation */}
        <form onSubmit={handleSignUp} className="space-y-6" noValidate>
          {/* Username Input */}
          <div>
            <Label htmlFor="username" className="mb-1">Username</Label>
            <div className="relative mt-2">
              <User className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              <Input
                id="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Email Input */}
          <div>
            <Label htmlFor="email" className="mb-1">Email Address</Label>
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

          {/* Password Input */}
          <div>
            <Label htmlFor="password" className="mb-1">Password</Label>
            <div className="relative mt-2">
              <Lock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* API Error */}
          {error && <p className="text-red-500 font-semibold mt-2">{error}</p>}

          {/* Password Strength Meter */}
          <PasswordStrengthMeter password={password} />

          {/* Submit Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className='mt-10'>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 cursor-pointer"
              variant="default"
            >
              {isLoading ? (
                <Loader className="animate-spin mx-auto" size={24} />
              ) : (
                "Sign Up"
              )}
            </Button>
          </motion.div>
        </form>
      </CardContent>

      {/* Redirect to Login */}
      <div className="px-8 py-4 bg-card bg-opacity-50 flex justify-center">
        <p className="text-base text-gray-400">
          Already have an account?{" "}
          <Link to={"/login"} className="text-[17px] text-primary hover:underline ml-2">
            Login
          </Link>
        </p>
      </div>
    </motion.div>
  )
}

export default Signup
