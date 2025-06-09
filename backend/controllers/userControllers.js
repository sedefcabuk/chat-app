const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");
const jwt = require("jsonwebtoken");

// GET /api/user?search=
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { userName: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

// POST /api/user/
const registerUser = asyncHandler(async (req, res) => {
  const { name, userName, email, password, pic, publicKey } = req.body;

  if (!name || !userName || !email || !password || !publicKey) {
    res.status(400);
    throw new Error("Lütfen gerekli alanları doldurun");
  }

  const userNameExists = await User.findOne({ userName });
  if (userNameExists) {
    res.status(400);
    throw new Error("Kullanıcı zaten kullanılıyor");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("Email zaten kullanılıyor");
  }

  const user = await User.create({
    name,
    userName,
    email,
    password,
    pic,
    publicKey,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      publicKey: user.publicKey, // Public key'i gönderiyoruz
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

// POST /api/users/login
const authUser = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const user = await User.findOne({
    $or: [{ userName: identifier }, { email: identifier }],
  });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      publicKey: user.publicKey,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid Username/Email or Password");
  }
});

const updateProfile = async (req, res) => {
  try {
    const { name, userName, email, pic } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı!" });
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({ message: "Geçersiz e-posta formatı!" });
    }

    const existingUserName = await User.findOne({ userName });
    if (
      existingUserName &&
      existingUserName._id.toString() !== user._id.toString()
    ) {
      return res
        .status(400)
        .json({ message: "Kullanıcı adı zaten kullanılıyor!" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: "E-posta zaten kullanılıyor!" });
    }

    user.name = name || user.name;
    user.userName = userName || user.userName;
    user.email = email || user.email;
    user.pic = pic || user.pic;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      pic: user.pic,
      publicKey: user.publicKey,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Profil güncellenirken hata oluştu!" });
  }
};

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Lütfen tüm alanları doldurun!" });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "Kullanıcı bulunamadı!" });
  }

  const isMatch = await user.matchPassword(oldPassword);

  if (!isMatch) {
    return res.status(400).json({ message: "Eski şifre yanlış!" });
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: "Şifre başarıyla güncellendi!" });
});

module.exports = {
  allUsers,
  registerUser,
  authUser,
  updateProfile,
  changePassword,
};
