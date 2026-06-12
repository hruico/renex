const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { createAuditLog, ACTIONS } = require('../utils/auditLog');

const generateAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_ACCESS_SECRET || 'dev_access_secret_123',
    { expiresIn: '15m' }
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123',
    { expiresIn: '7d' }
  );

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

const registerSchema = z.object({
  name:     z.string().min(2).max(255),
  email:    z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

exports.register = async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });

    const { name, email, password } = parsed.data;

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = new User({ name, email, passwordHash: password, role: 'user' });
    await user.save();

    await createAuditLog(user._id, ACTIONS.USER_REGISTERED, 'user', user._id, { name: user.name, email: user.email });

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    return res.status(201).json({ message: 'User registered successfully', accessToken, user: userResponse });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation error', errors: parsed.error.errors });

    const { email, password } = parsed.data;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    return res.status(200).json({ message: 'Login successful', accessToken, user: userResponse });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  return res.status(200).json({ message: 'Logged out successfully' });
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token provided' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(403).json({ message: 'User no longer active' });

    return res.status(200).json({ accessToken: generateAccessToken(user) });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ user });
  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
