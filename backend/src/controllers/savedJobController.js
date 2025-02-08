import mongoose from "mongoose";
import { savedJob } from "../models/savedJobModel.js";
import { Job } from "../models/jobModel.js";

/**
 * Save a job
 */
export const saveJob = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID format." });
    }

    // Check if the job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    // Check if job is already saved
    const existingSavedJob = await savedJob.findOne({ job: jobId, user: userId });
    if (existingSavedJob) {
      return res.status(400).json({ success: false, message: "Job is already saved." });
    }

    // Save the job
    const newSavedJob = new savedJob({
      job: jobId,
      user: userId,
    });
    await newSavedJob.save();

    return res.status(201).json({
      success: true,
      message: "Job saved successfully.",
      savedJob: newSavedJob,
    });
  } catch (error) {
    console.error("Error saving job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while saving the job." });
  }
};

/**
 * Unsave a job
 */
export const unsaveJob = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID format." });
    }

    // Find and delete the saved job entry
    const deletedSavedJob = await savedJob.findOneAndDelete({ job: jobId, user: userId });
    if (!deletedSavedJob) {
      return res.status(404).json({ success: false, message: "Saved job not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Job unsaved successfully.",
    });
  } catch (error) {
    console.error("Error unsaving job:", error);
    return res.status(500).json({ success: false, message: "An error occurred while unsaving the job." });
  }
};

/**
 * Get all saved jobs for a user
 */
export const getSavedJobs = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // Retrieve saved jobs and populate job details
    const savedJobs = await savedJob.find({ user: userId }).populate("job");

    return res.status(200).json({
      success: true,
      savedJobs,
    });
  } catch (error) {
    console.error("Error retrieving saved jobs:", error);
    return res.status(500).json({ success: false, message: "An error occurred while retrieving saved jobs." });
  }
};
