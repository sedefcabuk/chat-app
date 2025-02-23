const asyncHandler = require("express-async-handler");
const CryptoJS = require("crypto-js");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const dotenv = require("dotenv");

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;

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

    const decryptedMessages = messages.map((msg) => ({
      ...msg.toObject(),
      content: decryptMessage(msg.content),
    }));

    res.json(decryptedMessages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
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

  const encryptedContent = encryptMessage(content);

  var newMessage = {
    sender: req.user._id,
    content: encryptedContent,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name userName pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json({
      ...message.toObject(),
      content: decryptMessage(message.content),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const encryptMessage = (message) => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
};

const decryptMessage = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = { allMessages, sendMessage };
