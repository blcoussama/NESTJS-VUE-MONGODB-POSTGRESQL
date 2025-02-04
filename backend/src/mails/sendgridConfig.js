import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config(); 

// Set up SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Sender configuration
export const sender = {
    email: 'belcadioussama.eng@gmail.com', // Replace with your verified sender email address
    name: "Belcadi Oussama", // Your name or company name
};

// Export sgMail client to use in other parts of your app
export { sgMail };