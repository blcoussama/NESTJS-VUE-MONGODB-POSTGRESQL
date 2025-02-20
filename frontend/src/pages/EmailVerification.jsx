import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearError, clearLoading, verifyEmail } from "../store/authSlice";

// Shadcn UI Components
import { CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EmailVerification = () => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    dispatch(clearLoading());
  }, [dispatch]);

  const handleChange = (index, value) => {
    const newCode = [...code];

    // Accept only a single character
    if (value.length === 1) {
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input if available
      if (index < 5) {
        inputRefs.current[index + 1].focus();
      }
    } else if (value === "") {
      newCode[index] = "";
      setCode(newCode);

      // If empty (backspace), focus previous input if exists
      if (index > 0) {
        inputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (index, e) => {
    const pastedValue = e.clipboardData.getData("Text");
    const pastedCode = pastedValue.slice(0, 6).split("");
    const newCode = [...code];

    pastedCode.forEach((digit, idx) => {
      newCode[index + idx] = digit;
    });
    setCode(newCode);

    const lastFilledIndex = newCode.findLastIndex((digit) => digit !== "");
    const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
    inputRefs.current[focusIndex].focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Auto-submit when all six digits are filled
  useEffect(() => {
    if (code.every((digit) => digit !== "")) {
      handleSubmit(new Event("submit"));
    }
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const verificationCode = code.join("");

    try {
      const resultAction = await dispatch(verifyEmail({ code: verificationCode })).unwrap();

      if (verifyEmail.fulfilled.match(resultAction)) {
        const user = resultAction.payload.user;
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 mt-30 rounded-2xl bg-card border shadow-xl"
    >
      <CardHeader>
        <h2 className="text-3xl font-bold mb-6 text-center">Verify Your Email</h2>
      </CardHeader>
      <CardContent>
        <p className="text-center text-[15px] mb-6">
          Enter the 6-digit code sent to your email address.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="flex justify-between">
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={(e) => handlePaste(index, e)}
                className="w-12 h-12 text-center font-bold"
              />
            ))}
          </div>

          {error && <p className="text-red-500 font-semibold">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading || code.some((digit) => !digit)}
            className="w-full cursor-pointer"
          >
            {isLoading ? "Verifying..." : "Verify Email"}
          </Button>
        </form>
      </CardContent>
    </motion.div>
  );
};

export default EmailVerification;
