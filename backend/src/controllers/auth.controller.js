const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const z = require('zod');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

// Helpers for token generation
const generateAccessToken = (user) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_123';
  return jwt.sign({ id: user._id, role: user.role, email: user.email }, secret, { expiresIn: '15m' });
};

const generateRefreshToken = (user) => {
  const secret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123';
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// Zod schemas
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['admin', 'user']).optional()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string()
});

exports.register = async (req, res) => {
  try {
    const parsedData = registerSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation error", errors: parsedData.error.errors });
    }

    const { name, email, password, role } = parsedData.data;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create user (password is hashed automatically by pre-save hook)
    const newUser = new User({
      name,
      email,
      passwordHash: password,
      role: role || 'user'
    });

    await newUser.save();

    await createAuditLog(newUser._id, ACTIONS.USER_REGISTERED, 'user', newUser._id, {
      name: newUser.name, email: newUser.email, role: newUser.role,
    });

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    setRefreshCookie(res, refreshToken);

    // Don't return the password hash
    const userResponse = newUser.toJSON();
    delete userResponse.passwordHash;

    return res.status(201).json({
      message: "User registered successfully",
      accessToken,
      user: userResponse
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const parsedData = loginSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation error", errors: parsedData.error.errors });
    }

    const { email, password } = parsedData.data;

    // Find user and explicitly select passwordHash
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    setRefreshCookie(res, refreshToken);

    // Strip passwordHash before returning
    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: userResponse
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.status(200).json({ message: "Logged out successfully" });
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const secret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123';
    
    // Verify token
    const decoded = jwt.verify(refreshToken, secret);

    // Check if user still exists and is active
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ message: "User no longer active or valid" });
    }

    // Issue new access token
    const newAccessToken = generateAccessToken(user);
    
    return res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Refresh Token Error:", error);
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

exports.getMe = async (req, res) => {
  try {
    // req.user is set by the requireAuth middleware
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("GetMe Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
