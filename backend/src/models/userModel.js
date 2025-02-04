import mongoose from 'mongoose'

const userSchema = mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ["recruiter", "candidate"]
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {    
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profile: {
        profilePicture: {
            type: String,
            default: ""
        },
        firstName: { 
            type: String, 
        },
        lastName: { 
            type: String, 
        },
        description: {
            type: String
        },
        skills: [
            {
                type: String
            }
        ],
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company"  
        }
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    refreshToken: {
        type: String,
        default: null,
    },
    verificationToken: String,
    verificationTokenExpiresAt: Date,
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,

}, {timestamps: true}) 

export const User = mongoose.model("User", userSchema)