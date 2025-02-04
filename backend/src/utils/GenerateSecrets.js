import crypto from "crypto";

// Generate a 64-character random string for JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString("hex");

// Generate a 64-character random string for REFRESH_SECRET
const refreshSecret = crypto.randomBytes(32).toString("hex");

console.log("JWT_SECRET:", jwtSecret);
console.log("REFRESH_SECRET:", refreshSecret);