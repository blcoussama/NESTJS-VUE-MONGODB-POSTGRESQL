import { PASSWORD_RESET_REQUEST_TEMPLATE, PASSWORD_RESET_SUCCESS_TEMPLATE, VERIFICATION_EMAIL_TEMPLATE } from "./emailTemplates.js"
import { sgMail, sender } from './sendgridConfig.js';


export const SendVerificationEmail = async(email, verificationToken ) => {
    const msg = {
        to: email, // Dynamic email address
        from: sender,
        subject: 'Verify Your Email',
        html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}", verificationToken), // Dynamic content
        category: "Email Verification",
    };

    try {
        await sgMail.send(msg);
        console.log(`Verification Email sent successfully to: ${email}`);
    } catch (error) {
        console.error("Error sending verification email", error);
        throw new Error(`Error sending verification email: ${error.message}`);
    }
}
 
export const SendWelcomeEmail = async (email, username) => {
    const msg = {
        to: email, // Dynamic email address
        from: sender,
        subject: 'Welcome to Node.JS AUTH!',
        html: ` 
            <p>Hi ${username},</p>
            <p>Welcome to Node.JS AUTH! We're excited to have you on board.</p>
            <p>If you have any questions, feel free to reach out.</p>
            <p>Best regards,<br />The Node.JS AUTH Team</p>
        `,
        category: "Welcome Email",
    };

    try {
        await sgMail.send(msg);
        console.log(`Welcome Email sent successfully to: ${email}`);
    } catch (error) {
        console.error("Error sending welcome email", error);
        throw new Error(`Error sending welcome email: ${error.message}`);
    }
};

export const SendPasswordResetEmail = async (email, resetURL) => {
    const msg = {
        to: email, // Dynamic email address
        from: sender,
        subject: 'Reset Your Password',
        html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL), // Dynamic content
        category: "Password Reset",
    };

    try {
        await sgMail.send(msg);
        console.log(`Password Reset Email sent successfully to: ${email}`);
    } catch (error) {
        console.error("Error sending password reset email", error);
        throw new Error(`Error sending password reset email: ${error.message}`);
    }
};

export const SendPasswordResetSuccessEmail = async (email) => {
    const msg = {
        to: email, // Dynamic email address
        from: sender,
        subject: 'Password Reset Successfully!',
        html: PASSWORD_RESET_SUCCESS_TEMPLATE, // Static content
        category: "Password Reset Success",
    };

    try {
        await sgMail.send(msg);
        console.log(`Password Reset Success Email sent successfully to: ${email}`);
    } catch (error) {
        console.error("Error sending password reset success email", error);
        throw new Error(`Error sending password reset success email: ${error.message}`);
    }
};