import { Job } from "../models/jobModel.js";
import { Company } from "../models/companyModel.js";
import mongoose from "mongoose";

// Helper function to validate salary
const isValidSalary = (salary) => {
  if (typeof salary === "number") return true; // Fixed salary
  if (
    Array.isArray(salary) &&
    salary.length === 2 &&
    typeof salary[0] === "number" &&
    typeof salary[1] === "number" &&
    salary[0] <= salary[1]
  ) {
    return true; // Salary range
  }
  return salary === "discutable"; // Negotiable salary
};

// Controller to post a new job
export const postJob = async (req, res) => {
  try {
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
    }

    const {
      title,
      description,
      requirements,
      salary,
      experienceYears,
      experienceLevel,
      location,
      isOpen,
      company
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      salary === undefined ||
      experienceYears === undefined ||
      !experienceLevel ||
      !location ||
      !company
    ) {
      return res.status(400).json({ success: false, message: "Missing one or more required fields." });
    }

    // Validate company ID format
    if (!mongoose.Types.ObjectId.isValid(company)) {
      return res.status(400).json({ success: false, message: "Invalid company ID format." });
    }

    // Validate salary
    if (!isValidSalary(salary)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary format. Must be a number, range array, or 'discutable'."
      });
    }

    // Validate experienceLevel enum
    const allowedExperienceLevels = ["entry", "intermediate", "advanced", "expert"];
    if (!allowedExperienceLevels.includes(experienceLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid experience level. Allowed values are: entry, intermediate, advanced, expert."
      });
    }

    // Check for duplicate job within 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const existingJob = await Job.findOne({
      title,
      company,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    if (existingJob) {
      return res.status(400).json({
        success: false,
        message: "A similar job has already been posted in the last 7 days. Please update the existing job instead."
      });
    }

    // Verify company ownership
    const companyDoc = await Company.findById(company);
    if (!companyDoc) {
      return res.status(404).json({ success: false, message: "Company not found." });
    }
    if (companyDoc.userId.toString() !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to post a job for this company."
      });
    }

    // Ensure requirements is an array
    const formattedRequirements = Array.isArray(requirements)
      ? requirements
      : requirements.split(',').map(skill => skill.trim());

    // Create new job
    const job = new Job({
      title,
      description,
      requirements: formattedRequirements,
      salary,
      experienceYears,
      experienceLevel,
      location,
      isOpen,
      company,
      created_by: recruiterId
    });

    await job.save();

    return res.status(201).json({
      success: true,
      message: "Job posted successfully.",
      job
    });
  } catch (error) {
    console.error("Error posting job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while posting the job." });
  }
};

// Controller to update an existing job
export const updateJob = async (req, res) => {
  try {
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
    }

    const { id } = req.params; // Make sure the route parameter is named 'id'

    // Find the job
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    // Verify job ownership
    if (job.created_by.toString() !== recruiterId) {
      return res.status(403).json({ success: false, message: "You are not authorized to update this job." });
    }

    // If salary is provided in the update, validate it
    if (req.body.salary !== undefined && !isValidSalary(req.body.salary)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary format. Must be a number, range array, or 'discutable'."
      });
    }

    // If experienceLevel is provided, validate it
    if (req.body.experienceLevel) {
      const allowedExperienceLevels = ["entry", "intermediate", "advanced", "expert"];
      if (!allowedExperienceLevels.includes(req.body.experienceLevel)) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience level. Allowed values are: entry, intermediate, advanced, expert."
        });
      }
    }

    // If requirements is provided, ensure it is an array
    if (req.body.requirements) {
      req.body.requirements = Array.isArray(req.body.requirements)
        ? req.body.requirements
        : req.body.requirements.split(',').map(skill => skill.trim());
    }

    // Update job details using provided fields
    Object.assign(job, req.body);
    // No need to manually update updatedAt; Mongoose's timestamps will handle it

    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job updated successfully.",
      job
    });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while updating the job." });
  }
};


// Controller to delete a job
export const deleteJob = async (req, res) => {
  try {
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized. User not found." });
    }

    const { id } = req.params; // Job ID from the URL

    // Validate job ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid job ID format." });
    }

    // Find the job
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    // Verify job ownership
    if (job.created_by.toString() !== recruiterId) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this job." });
    }

    // Delete the job document using deleteOne()
    await job.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while deleting the job." });
  }
};