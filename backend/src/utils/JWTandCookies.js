import jwt from 'jsonwebtoken'

export const GenerateAccessTokenAndSetCookie = (res, user) => {
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: "15m"
    })

    res.cookie("AccessToken", token, {
        httpOnly: true, // prevents XSS Attacks
        secure: process.env.NODE_ENV === "production", // works only in production
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // prevents CSRF Attacks
        maxAge:  15 * 60 * 1000 // 15 minutes
    })

    return token
}

export const GenerateRefreshTokenAndSetCookie = (res, user) => {
    const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_SECRET, {
        expiresIn: "7d", 
    });

    res.cookie("RefreshToken", refreshToken, {
        httpOnly: true, // Prevent XSS attacks
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // Prevent CSRF attacks
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return refreshToken;
};