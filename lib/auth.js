import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Read JWT secret from environment. Do NOT throw at import time —
// throwing prevents serverless functions from loading and yields empty 5xx responses.
// Instead, log a clear error and allow runtime checks to return JSON errors.
const JWT_SECRET = process.env.JWT_SECRET || null;
if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET environment variable is not set. Authentication will fail until set.');
}
const JWT_EXPIRY_HOURS = Math.min(parseInt(process.env.JWT_EXPIRY_HOURS) || 168, 168); // Cap at 168 hours (7 days) max

// Hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured; cannot generate tokens');
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role_name,
    is_admin: user.is_admin,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${JWT_EXPIRY_HOURS}h`,
  });
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware to extract user from request
export function getUserFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    return verifyToken(token);
  } catch (error) {
    return null;
  }
}

// Check if user is admin
export function requireAdmin(user) {
  if (!user || !user.is_admin) {
    throw new Error('Admin access required');
  }
}
