const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const NodeRSA = require("node-rsa");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

// Anahtarları dosyalardan oku

const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    userName: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    pic: {
      type: String,
      required: true,
      default:
        "https://res.cloudinary.com/dtjdbkgef/image/upload/v1738679375/images_f2svo3.png",
    },
    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    publicKey: { type: String },
    privateKey: { type: String },
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Kullanıcı kaydedilmeden önce çalışır
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (!this.publicKey || !this.privateKey) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
    });

    const publicEncryptKey = new NodeRSA(publicKey);
    const encryptedPrivateKey = publicEncryptKey.encrypt(privateKey, "base64");

    this.publicKey = publicKey;
    this.privateKey = encryptedPrivateKey;
  }

  next();
});

// Private key'i çözme fonksiyonu
userSchema.methods.decryptPrivateKey = function () {
  const privateDecryptKey = new NodeRSA(privateKey);
  const decryptedPrivateKey = privateDecryptKey.decrypt(
    this.privateKey,
    "utf8"
  );
  return decryptedPrivateKey;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
