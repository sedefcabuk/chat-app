const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true, // AES ile şifrelenmiş mesaj içeriği
    },
    encryptedKey: {
      type: String,
      required: true, // RSA ile şifrelenmiş AES anahtarı
    },
    iv: {
      type: String,
      required: true, // AES şifrelemesi için kullanılan IV (Initialization Vector)
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
