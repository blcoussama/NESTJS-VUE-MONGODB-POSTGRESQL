export const authorizedRoles = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
            }
            
            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Access denied. Insufficient permissions." 
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                message: "An error occurred during role authorization." 
            });
        }
    };
};