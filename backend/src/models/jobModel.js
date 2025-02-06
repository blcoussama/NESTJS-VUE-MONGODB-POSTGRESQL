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

export const Job = mongoose.model("Job", jobSchema);