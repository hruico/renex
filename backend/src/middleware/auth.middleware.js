const jwt = require('jsonwebtoken');

// requireAuth middleware
exports.requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No access token provided or invalid format' });
    }

    const token = authHeader.split(' ')[1];
    
    // Hardcoded fallback for dev if .env is missing
    const secret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_123';
    
    const decoded = jwt.verify(token, secret);
    
    // Attach user payload to request
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid access token' });
  }
};

// requireAdmin middleware
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
  
  next();
};
