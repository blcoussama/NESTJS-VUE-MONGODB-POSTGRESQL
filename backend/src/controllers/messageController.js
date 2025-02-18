import { Message } from "../models/messageModel.js";
import { User } from "../models/userModel.js"
import cloudinary from "../utils/Cloudinary.js";


export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user.userId; // Use userId here
        const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
        res.status(200).json(users);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ success: false, message: "Error in getUsersForSidebar" });
    }
};


export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        // Use req.user.userId because that's what the middleware sets
        const myId = req.user.userId;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Error in getMessages controller" });
    }
};


export const sendMessages = async (req, res) => {
  try {
    const { text } = req.body;
    const { id: receiverId } = req.params;
    // Use req.user.userId as set by your auth middleware
    const senderId = req.user.userId;

    // Validate that the receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    let imageUrl = '';

    // Handle image upload if present
    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "message_images",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [
            { quality: "auto" },
            { fetch_format: "auto" }
          ]
        });

        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading image",
          error: uploadError.message
        });
      }
    }

    // Validate that either text or image is present
    if (!text && !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Message must contain either text or an image"
      });
    }

    // Create and save the message
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl
    });

    await newMessage.save();

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message
    });
  }
};


export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the message by ID
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // If the message has an image, attempt to delete it from Cloudinary.
    if (message.image) {
      // Assuming your image URL is like:
      // https://res.cloudinary.com/<cloud_name>/upload/v<version>/message_images/<publicId>.<ext>
      // We can extract the public_id using string manipulation.
      const urlParts = message.image.split('/');
      // Get the filename with extension (last part)
      const fileName = urlParts.pop();
      // Optionally, if your folder structure is more complex, you might need to join more segments.
      // Here we assume the image is stored in the "message_images" folder.
      const publicId = `message_images/${fileName.split('.')[0]}`;
      
      // Call Cloudinary to delete the image
      await cloudinary.uploader.destroy(publicId);
    }

    // Remove the message from the database
    await message.deleteOne();

    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ success: false, message: "Error deleting message", error: error.message });
  }
};