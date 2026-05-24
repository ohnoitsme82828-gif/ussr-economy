// Database-backed rate limiter for production reliability
import pool from './db.js';

// Rate limit configuration
const RATE_LIMITS = {
  login: { maxAttempts: 5, windowSeconds: 900 }, // 5 attempts per 15 minutes
  transfer: { maxAttempts: 10, windowSeconds: 3600 }, // 10 transfers per hour
  conversion: { maxAttempts: 5, windowSeconds: 3600 }, // 5 conversions per hour
  purchase: { maxAttempts: 20, windowSeconds: 3600 }, // 20 purchases per hour
};

export async function checkRateLimit(identifier, limitType) {
  try {
    const config = RATE_LIMITS[limitType];
    if (!config) return true;

    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
    const key = `${limitType}:${identifier}`;

    // Count attempts in the time window
    const result = await pool.query(
      `SELECT COUNT(*) as attempts FROM rate_limits 
       WHERE limit_key = $1 AND created_at > $2`,
      [key, windowStart]
    );

    const attempts = parseInt(result.rows[0]?.attempts || 0);

    // Check if limit exceeded
    if (attempts >= config.maxAttempts) {
      return false;
    }

    // Record this attempt
    await pool.query(
      `INSERT INTO rate_limits (limit_key, created_at) VALUES ($1, $2)`,
      [key, now]
    );

    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open) to avoid blocking users
    return true;
  }
}

// Clean up old rate limit entries periodically (every 1 hour)
setInterval(async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await pool.query(
      `DELETE FROM rate_limits WHERE created_at < $1`,
      [oneHourAgo]
    );
  } catch (error) {
    console.error('Rate limit cleanup error:', error);
  }
}, 60 * 60 * 1000);
