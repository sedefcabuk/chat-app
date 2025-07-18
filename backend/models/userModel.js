const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config(); // .env dosyasını yükle

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
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Kullanıcı kaydedilmeden önce çalışır
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
