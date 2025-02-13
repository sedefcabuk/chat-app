const asyncHandler = require("express-async-handler");
const CryptoJS = require("crypto-js");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const dotenv = require("dotenv");

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY; // Daha güvenli bir yöntem için .env kullanabilirsiniz

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name userName pic email")
      .populate("chat");

    // Mesajları çözerek istemciye düz metin olarak gönder
    const decryptedMessages = messages.map((msg) => {
      return {
        ...msg.toObject(), // Mongoose dökümanını düz JS objesine çeviriyoruz
        content: decryptMessage(msg.content), // İçeriği çözüyoruz
      };
    });

    res.json(decryptedMessages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  const encryptedContent = encryptMessage(content); // Mesajı şifrele

  var newMessage = {
    sender: req.user._id,
    content: encryptedContent, // Şifrelenmiş içerik kaydediliyor
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

    // Mesajı çözüp istemciye düz metin olarak gönder
    res.json({
      ...message.toObject(),
      content: decryptMessage(message.content),
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Mesaj Şifreleme Fonksiyonu
const encryptMessage = (message) => {
  return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
};

// Mesaj Çözme Fonksiyonu
const decryptMessage = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = { allMessages, sendMessage };
