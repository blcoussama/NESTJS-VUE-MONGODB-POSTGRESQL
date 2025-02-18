/* eslint-disable react/prop-types */
import { motion } from "framer-motion";

const LoadingSpinner = ({ widthClass = "w-16", heightClass = "h-16", containerClass = "h-screen" }) => {
  return (
    <div className={`flex ${containerClass} items-center justify-center`}>
      <motion.div
        className={`${widthClass} ${heightClass} rounded-full border-4 border-t-4 border-t-primary border-primary/30`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

export default LoadingSpinner;
