const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// POST /auth/register → Register new account
router.post('/register', authController.register);

// POST /auth/login → Login, receive JWT tokens
router.post('/login', authController.login);

// POST /auth/logout → Invalidate refresh token
router.post('/logout', authController.logout);

// POST /auth/refresh → Get new access token
router.post('/refresh', authController.refresh);

// GET /auth/me → Get current user profile
// Note: This route is protected by the requireAuth middleware
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
