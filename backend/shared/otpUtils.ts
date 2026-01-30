/**
 * OTP Utility Functions
 * 
 * Handles OTP generation, hashing, and verification
 */

import * as crypto from 'crypto';

/**
 * Generate a 6-digit OTP code
 */
export function generateOtp(): string {
  // Generate random number between 100000 and 999999
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}

/**
 * Hash an OTP code using SHA-256 with a salt
 * Never store plaintext OTPs
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(otp + salt)
    .digest('hex');
}

/**
 * Generate a random salt for OTP hashing
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verify an OTP code against a hash
 */
export function verifyOtp(otp: string, otpHash: string, salt: string): boolean {
  const computedHash = hashOtp(otp, salt);
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(otpHash)
  );
}

/**
 * Hash an IP address for rate limiting (one-way, no recovery)
 */
export function hashIp(ip: string): string {
  // Use a salt that's consistent but not reversible
  // In production, you might want to use a secret key here
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production';
  return crypto
    .createHash('sha256')
    .update(ip + salt)
    .digest('hex');
}

/**
 * Extract domain from email for logging (e.g., gmail.com)
 */
export function extractEmailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : 'unknown';
}
