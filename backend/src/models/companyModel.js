import mongoose from "mongoose";

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
        unique: true,
        sparse: true
    },
    location:{
        type: String,
        required: true
    },
    logo: {
      type: String,
      default: "",
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
    // Find all jobs associated with this company
    const jobs = await this.model('Job').find({ company: this._id });
    
    // Delete each job individually to trigger their hooks
    for (const job of jobs) {
      await job.deleteOne(); // Triggers job's pre-delete hook
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

export const Company = mongoose.model("Company", companySchema);
