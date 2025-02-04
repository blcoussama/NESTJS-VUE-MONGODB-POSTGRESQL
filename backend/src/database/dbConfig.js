import mongoose from "mongoose"

export const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("MONGO DB Connected Successfully.");
    } catch (error) {
        console.log("Error Connection to Mongo Database: ", error.message);
        process.exit(1) // for failure, If is 0 then status code Success.
    }
}