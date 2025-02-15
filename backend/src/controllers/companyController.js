import { Company } from "../models/companyModel.js";
import { User } from "../models/userModel.js";
import mongoose from "mongoose";
import cloudinary from "../utils/Cloudinary.js";
import { validateUrl } from "../utils/Validator.js";

// Controller to register a new company
export const registerCompany = async (req, res) => {
  try {
    const recruiterId = req.user?.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    const { name, description, website, location } = req.body;

    // Enhanced validation
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name is required!",
      });
    }

    if (!location?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company location is required!",
      });
    }

    if (website && !validateUrl(website)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid website URL",
      });
    }

    // Case-insensitive company name check
    const companyByName = await Company.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (companyByName) {
      return res.status(400).json({ 
        success: false, 
        message: "Company with this name already exists!" 
      });
    }

    if (website) {
      const companyByWebsite = await Company.findOne({ 
        website: { $regex: new RegExp(`^${website}$`, 'i') }
      });
      
      if (companyByWebsite) {
        return res.status(400).json({ 
          success: false, 
          message: "Company with this website already exists!" 
        });
      }
    }

    // Process logo upload with enhanced validation
    let logoUrl = "";
    if (req.files?.logo?.[0]) {
      const logoFile = req.files.logo[0];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (logoFile.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: "Logo file size must be less than 5MB"
        });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(logoFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Logo must be in JPG, PNG, or WebP format"
        });
      }

      try {
        const b64Logo = Buffer.from(logoFile.buffer).toString("base64");
        const dataURILogo = `data:${logoFile.mimetype};base64,${b64Logo}`;
        
        const uploadLogoResult = await cloudinary.uploader.upload(dataURILogo, {
          folder: "company_logos",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto:good" }
          ]
        });
        
        logoUrl = uploadLogoResult.secure_url;
      } catch (uploadError) {
        console.error("Logo upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading company logo",
          error: uploadError.message
        });
      }
    }

    // Using sessions for transaction management
    const session = await mongoose.startSession();
    let savedCompany;
    
    try {
      await session.withTransaction(async () => {
        // Create and save company
        const company = new Company({
          name: name.trim(),
          description: description?.trim(),
            website: website?.trim() ? website.trim().toLowerCase() : undefined, // Fixed line
          location: location.trim(),
          userId: recruiterId,
          logo: logoUrl
        });
        
        savedCompany = await company.save({ session });
        
        // Update user's companies list
        await User.findByIdAndUpdate(
          recruiterId,
          { $push: { "profile.companies": company._id } },
          { new: true, session }
        );
      });
      
      await session.endSession();
      
      return res.status(201).json({
        success: true,
        message: "Company registered successfully.",
        company: savedCompany,
      });
    } catch (transactionError) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        await session.endSession();
        throw transactionError;
      }
  } catch (error) {
    console.error("Error registering company:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while registering the company.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Controller to update an existing company
export const updateCompany = async (req, res) => {
  try {
    const recruiterId = req.user?.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    const { id } = req.params;
    const { name, description, website, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format."
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found."
      });
    }

    if (company.userId.toString() !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this company."
      });
    }

    // Validate required fields
    if (name && !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name cannot be empty!"
      });
    }

    if (location && !location.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company location cannot be empty!"
      });
    }

    if (website && !validateUrl(website)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid website URL"
      });
    }

    // Check for name uniqueness if name is being updated
    if (name && name !== company.name) {
      const existingCompany = await Company.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: "Company with this name already exists!"
        });
      }
    }

    // Check for website uniqueness if website is being updated
    if (website && website !== company.website) {
      const existingCompany = await Company.findOne({
        _id: { $ne: id },
        website: { $regex: new RegExp(`^${website}$`, 'i') }
      });
      
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: "Company with this website already exists!"
        });
      }
    }

    // Process logo upload if provided
    if (req.files?.logo?.[0]) {
      const logoFile = req.files.logo[0];
      const maxSize = 5 * 1024 * 1024;
      
      if (logoFile.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: "Logo file size must be less than 5MB"
        });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(logoFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Logo must be in JPG, PNG, or WebP format"
        });
      }

      try {
        // Delete old logo from Cloudinary if exists
        if (company.logo) {
          const publicId = company.logo.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`company_logos/${publicId}`);
        }

        const b64Logo = Buffer.from(logoFile.buffer).toString("base64");
        const dataURILogo = `data:${logoFile.mimetype};base64,${b64Logo}`;
        
        const uploadLogoResult = await cloudinary.uploader.upload(dataURILogo, {
          folder: "company_logos",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto:good" }
          ]
        });
        
        company.logo = uploadLogoResult.secure_url;
      } catch (uploadError) {
        console.error("Logo upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading company logo",
          error: uploadError.message
        });
      }
    }

    // Update fields if provided
    if (name) company.name = name.trim();
    if (description !== undefined) company.description = description?.trim();
    if (website) company.website = website?.trim() ? website.trim().toLowerCase() : undefined;
    if (location) company.location = location.trim();

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Controller to delete a company
export const deleteCompany = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const recruiterId = req.user?.userId;
    if (!recruiterId) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. User not found." 
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format."
      });
    }

    await session.withTransaction(async () => {
      const company = await Company.findById(id).session(session);
      if (!company) {
        throw new Error("Company not found.");
      }

      if (company.userId.toString() !== recruiterId) {
        throw new Error("You are not authorized to delete this company.");
      }

      // Delete logo from Cloudinary if exists
      if (company.logo) {
        const publicId = company.logo.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`company_logos/${publicId}`);
      }

      await company.deleteOne({ session });

      // Remove company reference from user's profile
      await User.findByIdAndUpdate(
        recruiterId,
        { $pull: { "profile.companies": id } },
        { new: true, session }
      );
    });

    await session.endSession();

    return res.status(200).json({
      success: true,
      message: "Company deleted successfully."
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    console.error("Error deleting company:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while deleting the company.",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Controller to get companies for the recruiter
export const getRecruiterCompanies = async (req, res) => {
  try {
    const recruiterId = req.params.recruiterId; // Now coming from URL params

    if (!recruiterId) {
      return res.status(400).json({
        success: false,
        message: "Recruiter ID is required in the URL parameters.",
      });
    }

    // Validate the recruiter ID format
    if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recruiter ID format.",
      });
    }

    // Find companies associated with the provided recruiter ID
    const companies = await Company.find({ userId: recruiterId })
      .select('-__v')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    console.error("Error retrieving companies:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving companies.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Controller to view a single company
export const viewCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format."
      });
    }

    const company = await Company.findById(id).select('-__v');
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
      message: "An error occurred while retrieving the company.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};