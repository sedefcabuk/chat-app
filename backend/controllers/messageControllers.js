const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Message = require("../models/messageModel");
const Chat = require("../models/chatModel");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const removedTime = chat.removedUsers?.get(req.user._id.toString());

    let messageQuery = { chat: req.params.chatId };

    if (removedTime) {
      messageQuery.createdAt = { $lt: removedTime };
    }

    const messages = await Message.find(messageQuery)
      .populate("sender", "name userName pic email")
      .populate("chat");

    res.json(messages);
  } catch (error) {
    console.error("Hata oluştu:", error);
    res.status(400).json({ message: error.message });
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Eksik veri:", req.body);
    return res
      .status(400)
      .json({ message: "Invalid data passed into request" });
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  if (chat.isGroupChat && !chat.users.includes(req.user._id)) {
    return res.status(403).json({
      message:
        "Since you are no longer a member of this group, you cannot send messages to the group.",
    });
  }

  const newMessage = {
    sender: req.user._id,
    content,
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);
    message = await message.populate("sender", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name userName pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message.toObject());
  } catch (error) {
    console.error("Mesaj gönderme hatası:", error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = { allMessages, sendMessage };
