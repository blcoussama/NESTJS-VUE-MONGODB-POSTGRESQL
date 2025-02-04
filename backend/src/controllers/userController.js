import { User } from "../models/userModel.js";
import cloudinary from "../utils/Cloudinary.js";

export const recruiterProfileSetup = async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required!" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "User email is not verified!" });
    }

    if (user.role !== "recruiter") {
      return res.status(403).json({ success: false, message: "Access denied. User is not an admin!" });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: "First name and last name are required!" });
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
          transformation: [
            { width: 500, height: 500, crop: "fill" }
          ]
        });

        console.log("Cloudinary upload successful:", uploadResult.secure_url);

        // Save the Cloudinary URL to the user's profile
        user.profile.profilePicture = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Detailed Cloudinary upload error:", {
          message: uploadError.message,
          error: uploadError
        });
        return res.status(500).json({
          success: false,
          message: "Error uploading profile picture",
          error: uploadError.message
        });
      }
    }

    // Update other profile fields
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


// Recruiter Dashboard Handler
export const candidateProfileSetup = async (req, res) => {
  try {
    const { email, firstName, lastName, description, skills } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required!" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "User email is not verified!" });
    }

    if (user.role !== "candidate") {
      return res.status(403).json({ success: false, message: "Access denied. User is not an admin!" });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: "First name and last name are required!" });
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
          transformation: [
            { width: 500, height: 500, crop: "fill" }
          ]
        });

        console.log("Cloudinary upload successful:", uploadResult.secure_url);

        // Save the Cloudinary URL to the user's profile
        user.profile.profilePicture = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Detailed Cloudinary upload error:", {
          message: uploadError.message,
          error: uploadError
        });
        return res.status(500).json({
          success: false,
          message: "Error uploading profile picture",
          error: uploadError.message
        });
      }
    }

    // Set up the candidate's profile information
    user.profile.firstName = firstName;
    user.profile.lastName = lastName;

    if (description) {
      user.profile.description = description;
    }
    if (skills) {
      user.profile.skills = Array.isArray(skills) ? skills : skills.split(',').map(skill => skill.trim());
    } 

    // Save the updated user document
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Candidate profile set up successfully.",
      user: {
        ...user._doc,
        password: undefined, // Exclude sensitive information
      },
    });
  } catch (error) {
    console.error("Error during candidate profile setup:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred during the candidate profile setup.",
    });
  }
};

export const viewUserProfile = async (req, res) => {
  try {
    const userId = req.params.id
    const user = await User.findById(userId);

    if(!user) {
      return res.status(404).json({
        message: "Profile not Found.",
        success: false
      })
    }

    // Create a copy of the profile data
    let profileData = { ...user.profile.toObject() };

    // For recruiters, remove the skills field if it's empty or simply remove it regardless
    if (user.role === "recruiter") {
      delete profileData.skills;
    }

    return res.status(200).json({ success: true, message: "User Profile Informations:",
      user: {
        profile: profileData
      }
    });
  } catch (error) {
    console.error("GetUserProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during accessing the user profile."
    });
  }
}