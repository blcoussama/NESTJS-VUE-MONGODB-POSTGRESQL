import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Redux hooks
import { clearError, clearLoading, verifyEmail } from "../store/authSlice"; // Import verifyEmail thunk

const EmailVerification = () => {
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef([]);
    const navigate = useNavigate();

    const dispatch = useDispatch();
    const { isLoading, error } = useSelector((state) => state.auth); // Select loading and error states from Redux

    useEffect(() => {
        // Clear error when component mounts
        dispatch(clearError()); // Dispatch an action to clear error (define this action in your Redux slice)

        // Clear Loading when component mounts
        dispatch(clearLoading());// Dispatch an action to clear the loading (define in Redux slice)
      }, [dispatch]);

    const handleChange = (index, value) => {
        const newCode = [...code];

        // Handle single character input
        if (value.length === 1) {
            newCode[index] = value;
            setCode(newCode);

            // Move focus to the next input field if value is entered
            if (value && index < 5) {
                inputRefs.current[index + 1].focus();
            }
        } else if (value === "") {
            // Handle backspace (empty input)
            newCode[index] = "";
            setCode(newCode);

            // Move focus to the previous input field if backspace is pressed
            if (index > 0) {
                inputRefs.current[index - 1].focus();
            }
        }
    };

    const handlePaste = (index, e) => {
        const pastedValue = e.clipboardData.getData("Text");

        // Handle the paste of up to 6 digits
        const pastedCode = pastedValue.slice(0, 6).split("");
        const newCode = [...code];
        
        // Insert pasted code into the state
        pastedCode.forEach((digit, idx) => {
            newCode[index + idx] = digit;
        });
        setCode(newCode);

        // Focus on the last non-empty input or the next empty one after paste
        const lastFilledIndex = newCode.findLastIndex((digit) => digit !== "");
        const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
        inputRefs.current[focusIndex].focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    // Auto submit when all fields are filled
    useEffect(() => {
        if (code.every((digit) => digit !== "")) {
            handleSubmit(new Event("submit"));
        }
    }, [code]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const verificationCode = code.join("");

        try {
            // Dispatch verifyEmail action
            const resultAction = await dispatch(verifyEmail({ code: verificationCode })).unwrap();

            // Handle successful email verification
            if (verifyEmail.fulfilled.match(resultAction)) {
                const user = resultAction.payload.user; // Assuming the user data is in the payload
                switch (user.role) {
                    case "recruiter":
                        navigate("/recruiter-profile-update");
                        break;
                    case "candidate":
                        navigate("/candidate-profile-update");
                        break;
                    default:
                        navigate("/");
                    break;
                }
            }
        } catch (err) {
            console.error("Error during email verification:", err);
        }
    };

    return (
        <div className="max-w-md w-full bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md"
            >
                <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-300 to-emerald-600 text-transparent bg-clip-text">
                    Verify Your Email
                </h2>
                <p className="text-center text-gray-300 mb-6">
                    Enter the 6-digit code sent to your email address.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex justify-between">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={(e) => handlePaste(index, e)} // Listen for paste event
                                className="w-12 h-12 text-center text-2xl font-bold bg-gray-700 text-white border-2 border-gray-600 rounded-lg focus:border-green-500 focus:outline-none"
                            />
                        ))}
                    </div>

                    {/* Error Message */}
                    {error && <p className="text-red-500 font-semibold mt-2">{error}</p>}

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={isLoading || code.some((digit) => !digit)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50"
                    >
                        {isLoading ? "Verifying..." : "Verify Email"}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

export default EmailVerification;
