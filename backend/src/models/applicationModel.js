import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    job:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Job',
        required:true
    },
    applicant:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    status:{
        type:String,
        enum:['pending', 'accepted', 'rejected', 'withdrawn'],
        default:'pending'
    },
    resume: {
        type:String,
        required:true
    },
    skills: [
        {
            type: String,
            required: true
        }
    ],
    experienceYears: {
        type: Number,
        required: true
    },
    experienceLevel:{
        type: String,
        enum: ["entry", "intermediate", "advanced", "expert"],
        required:true,
    },

},{timestamps:true});

// TTL index: documents with a non-null expiresAt will be deleted when expiresAt is reached.
applicationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Application  = mongoose.model("Application", applicationSchema);