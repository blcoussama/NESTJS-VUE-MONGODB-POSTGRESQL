import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const OnBoarding = () => {
    const navigate = useNavigate();
    const handleRoleSelection = (role) => {
        navigate('/signup', { state: { role } });
    }
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <h2 className="text-3xl font-bold mb-6 text-center text-white">
                Choose Your Role
            </h2>
            <div className="flex space-x-6">
                <motion.button
                    className="py-3 px-6 bg-blue-500 text-white font-bold rounded-lg shadow-lg hover:bg-blue-600 transition duration-200"
                    whileHover={{ scale: 1.1 }}
                    onClick={() => handleRoleSelection('recruiter')}
                >
                    Recruiter
                </motion.button>
                <motion.button
                    className="py-3 px-6 bg-green-500 text-white font-bold rounded-lg shadow-lg hover:bg-green-600 transition duration-200"
                    whileHover={{ scale: 1.1 }}
                    onClick={() => handleRoleSelection('candidate')}
                >
                    Candidate
                </motion.button>
            </div>
        </motion.div>
    );
};

export default OnBoarding;