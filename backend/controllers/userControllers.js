const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");
const cloudinary = require("../config/cloudinary");
const jwt = require("jsonwebtoken");

//@description     Get or Search all users
//@route           GET /api/user?search=
//@access          Public
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

//@description     Register new user
//@route           POST /api/user/
//@access          Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, userName, email, password, pic } = req.body;

  if (!name || !userName || !email || !password) {
    res.status(400);
    throw new Error("Please Enter all the Fields");
  }

  const userNameExists = await User.findOne({ userName });

  if (userNameExists) {
    res.status(400);
    throw new Error("Username already exists");
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("Email already exists");
  }

  const user = await User.create({
    name,
    userName,
    email,
    password,
    pic,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

//@description     Auth the user
//@route           POST /api/users/login
//@access          Public
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
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid Username/Email or Password");
  }
});
const updateProfile = async (req, res) => {
  try {
    const { name, userName, pic } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı!" });
    }

    user.name = name || user.name;
    user.userName = userName || user.userName;
    user.pic = pic || user.pic;

    await user.save();

    // Güncellenmiş kullanıcıya **token ekledik!**
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      _id: user._id,
      name: user.name,
      userName: user.userName,
      email: user.email,
      pic: user.pic,
      token, // ✅ Yeni token burada
    });
  } catch (error) {
    res.status(500).json({ message: "Profil güncellenirken hata oluştu!" });
  }
};

module.exports = {
  allUsers,
  registerUser,
  authUser,
  updateProfile,
};
