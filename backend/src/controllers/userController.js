import { User } from "../models/userModel.js";
import cloudinary from "../utils/Cloudinary.js";
import mongoose from "mongoose";

export const recruiterProfileSetup = async (req, res) => {
  try {
    // Use userId from the token
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
    }

    const { firstName, lastName } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: "First name and last name are required!" });
    }

    // Find the user by id from the token
    const user = await User.findById(recruiterId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "User email is not verified!" });
    }

    if (user.role !== "recruiter") {
      return res.status(403).json({ success: false, message: "Access denied. User is not a recruiter!" });
    }

    // Handle profile picture upload if a file was provided
    if (req.file) {
      try {
        console.log("File received:", {
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalName: req.file.originalname
        });

        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        
        console.log("Attempting to upload to Cloudinary...");
        
        // Upload to Cloudinary with additional options
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "profile_pictures",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
          transformation: [{ width: 500, height: 500, crop: "fill" }]
        });

        console.log("Cloudinary upload successful:", uploadResult.secure_url);
        // Save the Cloudinary URL to the user's profile
        user.profile.profilePicture = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Detailed Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading profile picture",
          error: uploadError.message
        });
      }
    }

    // Update profile fields
    user.profile.firstName = firstName;
    user.profile.lastName = lastName;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Recruiter profile set up successfully.",
      user: {
        ...user._doc,
        password: undefined,
        profile: {
          profilePicture: user.profile.profilePicture,
          firstName,
          lastName,
          description: undefined,
          skills: undefined,
          resume: undefined,
        }
      }
    });
  } catch (error) {
    console.error("Error during recruiter profile setup:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during the recruiter profile setup.",
      error: error.message
    });
  }
};


export const candidateProfileSetup = async (req, res) => {
  try {
    // Use userId from the token
    const candidateId = req.user && req.user.userId;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
    }
 
    const { firstName, lastName, description, skills } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: "First name and last name are required!" });
    }

    // Find the user by id from the token
    const user = await User.findById(candidateId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "User email is not verified!" });
    }
    if (user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Access denied. User is not a candidate!" });
    }

    // Process profile picture if provided; otherwise, clear the field.
    if (req.files && req.files.profilePicture && req.files.profilePicture.length > 0) {
      try {
        const profilePicFile = req.files.profilePicture[0];
        console.log("Profile Picture File received:", {
          mimetype: profilePicFile.mimetype,
          size: profilePicFile.size,
          originalName: profilePicFile.originalname
        });

        const b64 = Buffer.from(profilePicFile.buffer).toString("base64");
        const dataURI = "data:" + profilePicFile.mimetype + ";base64," + b64;

        console.log("Attempting to upload profile picture to Cloudinary...");
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "profile_pictures",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
          transformation: [{ width: 500, height: 500, crop: "fill" }]
        });

        console.log("Profile picture upload successful:", uploadResult.secure_url);
        user.profile.profilePicture = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Detailed Cloudinary profile picture upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading profile picture",
          error: uploadError.message
        });
      }
    } else {
      // Clear the profile picture field if no file provided
      user.profile.profilePicture = "";
    }

    // Process resume if provided; otherwise, clear the field.
    if (req.files && req.files.resume && req.files.resume.length > 0) {
      try {
        const resumeFile = req.files.resume[0];
        console.log("Resume File received:", {
          mimetype: resumeFile.mimetype,
          size: resumeFile.size,
          originalName: resumeFile.originalname
        });

        // Only allow PDF for resume uploads
        if (resumeFile.mimetype !== "application/pdf") {
          return res.status(400).json({
            success: false,
            message: "Invalid file type for resume. Only PDF files are allowed."
          });
        }

        const b64 = Buffer.from(resumeFile.buffer).toString("base64");
        const dataURI = "data:" + resumeFile.mimetype + ";base64," + b64;

        console.log("Attempting to upload resume to Cloudinary...");
        
        // Use resource_type 'raw' for PDFs and force output format to pdf.
        const uploadOptions = {
          folder: "resumes",
          resource_type: 'auto',
          allowed_formats: ['pdf'],
          // Set public_id to the original file name (without extension) to preserve the name
          public_id: resumeFile.originalname.split('.')[0],
          transformation: [{ format: 'pdf' }]
        };

        const resumeUploadResult = await cloudinary.uploader.upload(dataURI, uploadOptions);

        console.log("Resume upload successful:", resumeUploadResult.secure_url);
        user.profile.resume = resumeUploadResult.secure_url;
      } catch (uploadError) {
        console.error("Detailed Cloudinary resume upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading resume",
          error: uploadError.message
        });
      }
    } else {
      // Clear the resume field if no file provided
      user.profile.resume = "";
    }

    // Update other profile fields
    user.profile.firstName = firstName;
    user.profile.lastName = lastName;
    user.profile.description = description || "";
    if (skills) {
      user.profile.skills = Array.isArray(skills)
        ? skills
        : skills.split(',').map(skill => skill.trim());
    } else {
      user.profile.skills = [];
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Candidate profile set up successfully.",
      user: {
        ...user._doc,
        password: undefined,
        profile: {
          profilePicture: user.profile.profilePicture,
          resume: user.profile.resume,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          description: user.profile.description,
          skills: user.profile.skills,
          companies: undefined
        }
      },
    });
  } catch (error) {
    console.error("Error during candidate profile setup:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during the candidate profile setup."
    });
  }
};


export const viewUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate the userId format (optional but recommended)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format." });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found."
      });
    }

    // Create a copy of the profile data
    let profileData = { ...user.profile.toObject() };

    if (user.role === "recruiter") {
      // For recruiters, remove candidate-specific fields
      delete profileData.skills;
      delete profileData.description;
      delete profileData.resume; // Don't show resume for recruiters
    }

    if (user.role === "candidate") {
      // For candidates, remove recruiter-specific fields and the resume (for privacy)
      delete profileData.companies;
    }

    return res.status(200).json({
      success: true,
      message: "User Profile Information:",
      user: {
        profile: profileData
      }
    });
  } catch (error) {
    console.error("GetUserProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while accessing the user profile."
    });
  }
};