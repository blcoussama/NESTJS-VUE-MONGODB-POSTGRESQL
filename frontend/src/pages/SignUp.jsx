import { motion } from 'framer-motion'
import FormInput from '../components/FormInput'
import { User, Mail, Lock, Loader} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation  } from 'react-router-dom'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import { useDispatch, useSelector } from "react-redux"; // Import hooks for Redux
import { clearError, clearLoading, signUp } from "../store/authSlice"; // Import the signUp thunk

const Signup = () => {

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState("")

    const location = useLocation()
    const navigate = useNavigate()

    const dispatch = useDispatch(); // Get the dispatch function from the Redux store
    const { isLoading, error } = useSelector((state) => state.auth) // Access Redux state

    useEffect(() => {
        // Clear error when component mounts
        dispatch(clearError()); // Dispatch an action to clear error (define this action in your Redux slice)

        // Clear Loading when component mounts
        dispatch(clearLoading());// Dispatch an action to clear the loading (define in Redux slice)

        // Set the role from the navigation state
        if (location.state?.role) {
            setRole(location.state.role);
        } else {
            // If no role is provided, redirect back to RoleSelection
            navigate('/');
        }

    }, [dispatch, location.state.role, navigate]);

    const handleSignUp = async(e) => {
        e.preventDefault()

        try {
            // Dispatch SignUp Action from redux AuthSlice
            await dispatch(signUp({ email, password, username, role})).unwrap();

            // Handle successfull Sign-Up
            navigate("/verify-email");

        } catch (error) {
            console.log(error);            
        }
    }

    return (
        <motion.div
            initial={{opacity:0, y:20}}
            animate={{opacity:1, y:0}}
            transition={{duration:0.5}}
            className="max-w-md w-full bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden"
        >
            <div className="p-8">
                <h2 className='text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-300 to-emerald-600 text-transparent bg-clip-text'>
                    Create an Account
                </h2>

                <form onSubmit={handleSignUp}>

                    <FormInput icon={User} 
                    type="text" 
                    placeholder="username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)} />

                    <FormInput icon={Mail} 
                        type="email" 
                        placeholder="Email Address" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)} 
                    />

                    <FormInput icon={Lock} 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                    />

                    {/* API Error */}
                    {error && (<p className="text-red-500 font-semibold mt-2">{error}</p>)}

                    {/* PASSWORD STRENGTH METER */}
                    <PasswordStrengthMeter password={password} />
                    <motion.button 
                        className="mt-5 w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 
						text-white font-bold rounded-lg shadow-lg hover:from-green-600
						hover:to-emerald-700 focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-offset-2
                        focus:ring-offset-gray-900 transition duration-200"
                        whileHover={{ scale: 1.02}}
                        whileTap={{ scale: 0.98}}
                        type='submit'
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader className='animate-spin mx-auto' size={24} /> : "Sign Up"}      
                    </motion.button>
                </form>
            </div>

            <div className='px-8 py-4 bg-gray-900 bg-opacity-50 flex justify-center'>
                <p className='text-sm text-gray-400'>
                    Already Have an Account?{" "}
                    <Link to={"/login"} className='text-base text-green-400 hover:underline ml-2'>Login</Link>
                </p>
            </div>
        </motion.div>
    )
}

export default Signup