// Simple in-memory rate limiter
const limits = new Map();

// Rate limit configuration
const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  transfer: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 transfers per hour
  conversion: { maxAttempts: 5, windowMs: 60 * 60 * 1000 }, // 5 conversions per hour
  purchase: { maxAttempts: 20, windowMs: 60 * 60 * 1000 }, // 20 purchases per hour
};

export function checkRateLimit(identifier, limitType) {
  const config = RATE_LIMITS[limitType];
  if (!config) return true;

  const key = `${limitType}:${identifier}`;
  const now = Date.now();
  
  if (!limits.has(key)) {
    limits.set(key, { attempts: 1, resetAt: now + config.windowMs });
    return true;
  }

  const record = limits.get(key);
  
  // Reset if window expired
  if (now > record.resetAt) {
    limits.set(key, { attempts: 1, resetAt: now + config.windowMs });
    return true;
  }

  // Check if limit exceeded
  if (record.attempts >= config.maxAttempts) {
    return false;
  }

  // Increment attempts
  record.attempts++;
  limits.set(key, record);
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of limits.entries()) {
    if (now > record.resetAt) {
      limits.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes
