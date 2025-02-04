import { Company } from "../models/companyModel.js";


// Controller to register a new company
export const registerCompany = async (req, res) => {
  try {
    // Assuming your VerifyToken middleware sets req.user with the user's id and role
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    // Extract company details from the request body
    const { name, description, website, location } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required!",
      });
    }

    // Create the new company record
    const company = new Company({
      name,
      description,
      website,
      location,
      userId: recruiterId, // Link the company with the recruiter
    });

    await company.save();

    return res.status(201).json({
      success: true,
      message: "Company registered successfully.",
      company,
    });
  } catch (error) {
    console.error("Error registering company:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while registering the company.",
    });
  }
};
