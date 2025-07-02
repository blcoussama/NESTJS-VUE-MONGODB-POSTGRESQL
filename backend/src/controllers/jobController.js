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

    const { id } = req.params;
    const {
      title,
      description,
      requirements,
      salary,
      experienceYears,
      experienceLevel,
      location,
    } = req.body;

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

    // Validate required fields
    if (
      !title ||
      !description ||
      salary === undefined ||
      experienceYears === undefined ||
      !experienceLevel ||
      !location
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
      isOpen: true,
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

    const { id, companyId } = req.params; // Make sure the route parameter is named 'id'

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID format."
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found."
      });
    }

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


export const getJobsByRecruiter = async (req, res) => {
  try {
    const { recruiterId } = req.params; // Recruiter ID is now taken from the request params

    // Validate recruiterId format
    if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
      return res.status(400).json({ success: false, message: "Invalid recruiter ID format." });
    }

    const jobs = await Job.find({ created_by: recruiterId }).sort({ createdAt: -1 }).populate("company", "name logo");

    return res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching recruiter jobs:", error);
    return res.status(500).json({ success: false, message: "An error occurred while fetching recruiter jobs." });
  }
};


export const getAllJobs = async (req, res) => {
  try {
    // Extract query parameters for filtering and pagination
    const {
      search,
      location,
      experienceLevel,
      salary,      // this can be "discutable" if the user wants negotiable jobs
      salaryMin,
      salaryMax,
      page = 1,
      limit = 9
    } = req.query;

    // Build a filter object; for example, only show open jobs
    const filter = { isOpen: true };

    // Search filter on job title (case-insensitive)
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    // Location filter (case-insensitive)
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Experience level filter
    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }

    // Salary filtering
    // If the query parameter 'salary' is provided as "discutable", filter for that.
    if (salary && salary.toLowerCase() === "discutable") {
      filter.salary = "discutable";
    } else if (salaryMin || salaryMax) {
      // Otherwise, if salaryMin or salaryMax is provided, assume a numeric filter.
      filter.salary = {};
      if (salaryMin) filter.salary.$gte = Number(salaryMin);
      if (salaryMax) filter.salary.$lte = Number(salaryMax);
    }
    
    // Execute the query with pagination and sort the results (newest first)
    const jobs = await Job.find(filter)
      .populate("company", "name location logo")  // Optionally populate company details
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get the total count for pagination
    const totalJobs = await Job.countDocuments(filter);

    return res.status(200).json({
      success: true,
      jobs,
      totalPages: Math.ceil(totalJobs / limit),
      currentPage: Number(page)
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching jobs."
    });
  }
};



export const viewJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid job ID format." });
    }

    const job = await Job.findById(id)
    .populate("company", "name location logo")
    .populate({path: "applications", select: "applicant"}); // Populate company details
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    return res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("Error fetching job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while fetching the job." });
  }
};


export const getJobsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ success: false, message: "Invalid company ID format." });
    }

    const jobs = await Job.find({ company: companyId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching jobs for company:", error);
    return res.status(500).json({ success: false, message: "An error occurred while fetching company jobs." });
  }
};