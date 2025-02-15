import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    requirements: [{
        type: String
    }],
    salary: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    experienceYears: {
        type: Number,
        required: true
    },
    experienceLevel:{
        type: String,
        enum: ["entry", "intermediate", "advanced", "expert"],
        required:true,
    },
    location: {
        type: String,
        required: true
    },
    isOpen: {
        type: Boolean,
        required: true
    },
    applications: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Application',
        }
    ]
},{timestamps:true});

jobSchema.pre("deleteOne", { document: true }, async function(next) {
  try {
    // Delete all applications for this job
    await this.model('Application').deleteMany({ job: this._id });

    // Delete all saved job entries for this job
    await this.model('savedJob').deleteMany({ job: this._id });
    
    next();
  } catch (error) {
    next(error);
  }
});

export const Job = mongoose.model("Job", jobSchema);