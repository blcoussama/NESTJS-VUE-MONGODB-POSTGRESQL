import { Company } from "../models/companyModel.js";
import { User } from "../models/userModel.js";
import mongoose from "mongoose";


// Controller to register a new company
export const registerCompany = async (req, res) => {
  try {

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

    const companyByName = await Company.findOne({ name });
    if(companyByName) {
      return res.status(400).json({ success: false, message: "Company with this Name already exists!" });
    }

    const companyByWebsite = await Company.findOne({ website });
    if(companyByWebsite) {
      return res.status(400).json({ success: false, message: "Company with this Website already exists!" });
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

    // Update the recruiter's profile to include this new company
    await User.findByIdAndUpdate(
      recruiterId,
      { $push: { "profile.companies": company._id } },
      { new: true }  // Optionally, return the updated document
    );

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

export const updateCompany = async (req, res) => {
  try {

    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    // Get the company id from the URL parameters
    const { id } = req.params;
    // Extract the company details to update from the request body
    const { name, description, website, location } = req.body;

    // Find the company by its id
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found."
      });
    }

    // Ensure that the recruiter owns this company
    if (company.userId.toString() !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this company."
      });
    }

    // Update only the fields provided
    if (name) company.name = name;
    if (description) company.description = description;
    if (website) company.website = website;
    if (location) company.location = location;

    // Save the updated company document
    await company.save();

    return res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      company,
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the company.",
    });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    // Recruiter ID from the token
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    // Get the company id from the URL parameters
    const { id } = req.params;

    // Validate company ID format (optional but recommended)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid company ID format." });
    }

    // Find the company by its id
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found."
      });
    }

    // Verify that the recruiter owns this company
    if (company.userId.toString() !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this company."
      });
    }

    // Delete the company document using deleteOne() (triggers pre-remove hooks if any)
    await company.deleteOne();

    // Remove the company ObjectId from the recruiter's profile.companies array
    await User.findByIdAndUpdate(
      recruiterId,
      { $pull: { "profile.companies": id } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Company deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the company."
    });
  }
};



export const getRecruiterCompanies = async (req, res) => {
  try {
    // Use recruiter id from token (VerifyToken and authorizedRoles are applied in the route)
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    // Find companies where userId matches the recruiter id
    const companies = await Company.find({ userId: recruiterId });
    return res.status(200).json({
      success: true,
      companies,
    });
  } catch (error) {
    console.error("Error retrieving companies for recruiter:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving companies."
    });
  }
};


export const getCompanyById = async (req, res) => {
  try {
    // The company id is provided as a URL parameter
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found."
      });
    }

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error) {
    console.error("Error retrieving company:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving the company."
    });
  }
};






