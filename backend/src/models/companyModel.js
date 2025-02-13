import mongoose from "mongoose";
import { Job } from "./jobModel.js"; // Ensure correct import; be cautious about circular dependencies

const companySchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        unique: true
    },
    description:{
        type: String, 
    },
    website:{
        type: String,
        unique: true
    },
    location:{
        type: String,
        required: true
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Pre-remove middleware to cascade delete associated jobs
companySchema.pre("deleteOne", { document: true }, async function(next) {
  try {
    // 'this' refers to the company document being removed
    await this.model('Job').deleteMany({ company: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

export const Company = mongoose.model("Company", companySchema);
