import jwt from "jsonwebtoken";

// Middleware to verify JWT token
export const VerifyToken = (req, res, next) => {
    try {
        // Check if token exists
        const token = req.cookies.AccessToken;
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized: No token provided." });
        }

        // Verify the token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    return res.status(401).json({ success: false, message: "Unauthorized: Token expired." });
                } else {
                    return res.status(401).json({ success: false, message: "Unauthorized: Invalid token." });
                }
            }

            // Attach user info to the request object
            req.user = { userId: decoded.userId, role: decoded.role };
            next();
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "An error occurred while verifying the token." });
    }
};
