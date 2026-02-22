/**
 * OTP Authentication Cloud Functions
 *
 * Functions:
 * - requestEmailOtp: Request OTP code via email
 * - verifyEmailOtp: Verify OTP and create/get Firebase Auth user
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  OtpChallenge,
  COLLECTIONS,
} from "../../shared/types";
import {
  generateOtp,
  hashOtp,
  generateSalt,
  verifyOtp,
  hashIp,
  extractEmailDomain,
} from "../../shared/otpUtils";
import {
  sendOtpEmailWithRetry,
} from "../../shared/loopsClient";

// Firebase Admin is initialized in index.ts before this module is imported
// No need to initialize here

const db = admin.firestore();
const auth = admin.auth();

// Configuration
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const RATE_LIMIT_EMAIL_PER_HOUR = 5;
const RATE_LIMIT_IP_PER_HOUR = 20;
const RESEND_COOLDOWN_SECONDS = 60;

// Get Loops.so configuration from environment
// In production, use Firebase Functions secrets
function getLoopsConfig(): { apiKey: string; transactionalId: string } {
  // For emulator/development, use environment variables or defaults
  const apiKey = process.env.LOOPS_API_KEY || "";
  const transactionalId = process.env.LOOPS_TRANSACTIONAL_ID || "";

  if (!apiKey || !transactionalId) {
    console.warn("Loops.so configuration missing. OTP emails will fail.");
  }

  return {apiKey, transactionalId};
}

interface RequestOtpRequest {
  email: string;
}

interface VerifyOtpRequest {
  challengeId: string;
  otpCode: string;
  firstName?: string; // Optional, for new user signup
}

/**
 * Request OTP code via email
 *
 * Generates OTP, stores hashed challenge, sends email via Loops.so
 */
export const requestEmailOtp = onCall(
  {
    enforceAppCheck: false,
    maxInstances: 10,
  },
  async (request) => {
    const data = request.data as RequestOtpRequest;
    const {email} = data;

    // Validate email
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HttpsError("invalid-argument", "Invalid email format");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailDomain = extractEmailDomain(normalizedEmail);

    // Get IP for rate limiting (if available)
    // Note: In Cloud Functions v2, IP might not be directly available
    // For emulator, we'll use a placeholder
    const rawRequest = (request as any).rawRequest;
    const clientIp = rawRequest?.ip ||
      rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      rawRequest?.connection?.remoteAddress ||
      "unknown";
    const ipHash = hashIp(clientIp);

    // Check rate limits
    const rateLimitCheck = await checkRateLimits(normalizedEmail, ipHash);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        rateLimitCheck.message || "Rate limit exceeded. Please try again later."
      );
    }

    // Check for recent challenge (resend cooldown)
    const recentChallenge = await checkResendCooldown(normalizedEmail);
    if (recentChallenge) {
      const secondsRemaining = Math.ceil(
        (recentChallenge.createdAt + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
      );
      throw new HttpsError(
        "resource-exhausted",
        `Please wait ${secondsRemaining} seconds before requesting a new code.`
      );
    }

    // Generate OTP
    const otpCode = generateOtp();
    const salt = generateSalt();
    const otpHash = hashOtp(otpCode, salt);

    // Store salt with challenge for verification

    // Calculate expiry
    const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

    // Create challenge document
    const challengeRef = db.collection(COLLECTIONS.otpChallenges).doc();
    const challengeId = challengeRef.id;

    const challenge: Omit<OtpChallenge, "id"> & { salt: string } = {
      email: normalizedEmail,
      otpHash,
      salt, // Store salt for verification
      expiresAt,
      status: "pending",
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      createdAt: Date.now(),
      ipHash,
    };

    try {
      // Write challenge to Firestore
      await challengeRef.set(challenge);

      // Send OTP email via Loops.so
      const loopsConfig = getLoopsConfig();
      if (!loopsConfig.apiKey || !loopsConfig.transactionalId) {
        // In development/emulator, log the OTP instead of sending
        console.log(`[DEV] OTP for ${normalizedEmail}: ${otpCode} (expires in ${OTP_EXPIRY_MINUTES} minutes)`);

        return {
          challengeId,
          message: "OTP code logged to console (development mode)",
        };
      }

      const emailResult = await sendOtpEmailWithRetry(
        loopsConfig.apiKey,
        normalizedEmail,
        otpCode,
        loopsConfig.transactionalId,
        OTP_EXPIRY_MINUTES
      );

      if (!emailResult.success) {
        // Mark challenge as failed delivery
        await challengeRef.update({
          status: "failed_delivery",
        });

        // Log error (but don't expose to client)
        console.error(`Failed to send OTP email to ${emailDomain}:`, emailResult.error);

        throw new HttpsError(
          "internal",
          "Failed to send verification code. Please try again."
        );
      }

      // Log success (without OTP code)
      console.log(`OTP sent to ${emailDomain}, challengeId: ${challengeId}`);

      return {
        challengeId,
        message: "Verification code sent to your email",
      };
    } catch (error: any) {
      // Clean up challenge if email send failed
      if (error instanceof HttpsError && error.code === "internal") {
        try {
          await challengeRef.delete();
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }
);

/**
 * Verify OTP code and create/get Firebase Auth user
 */
export const verifyEmailOtp = onCall(
  {
    enforceAppCheck: false,
    maxInstances: 10,
  },
  async (request) => {
    const data = request.data as VerifyOtpRequest;
    const {challengeId, otpCode, firstName} = data;

    // Validate inputs
    if (!challengeId || typeof challengeId !== "string") {
      throw new HttpsError("invalid-argument", "challengeId is required");
    }

    if (!otpCode || typeof otpCode !== "string") {
      throw new HttpsError("invalid-argument", "otpCode is required");
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otpCode)) {
      throw new HttpsError("invalid-argument", "OTP code must be 6 digits");
    }

    // Get challenge from Firestore
    const challengeRef = db.collection(COLLECTIONS.otpChallenges).doc(challengeId);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
      throw new HttpsError("not-found", "Invalid or expired verification code");
    }

    const challenge = {id: challengeDoc.id, ...challengeDoc.data()} as OtpChallenge;

    // Check if already verified
    if (challenge.status === "verified") {
      throw new HttpsError("failed-precondition", "This code has already been used");
    }

    // Check if expired
    if (challenge.status === "expired" || Date.now() > challenge.expiresAt) {
      await challengeRef.update({status: "expired"});
      throw new HttpsError("deadline-exceeded", "Verification code has expired");
    }

    // Check if too many attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      await challengeRef.update({status: "expired"});
      throw new HttpsError(
        "resource-exhausted",
        "Too many verification attempts. Please request a new code."
      );
    }

    // Verify OTP
    const salt = challenge.salt;
    if (!salt) {
      throw new HttpsError("internal", "Invalid challenge format");
    }

    const isValid = verifyOtp(otpCode, challenge.otpHash, salt);

    // Increment attempts
    await challengeRef.update({
      attempts: challenge.attempts + 1,
    });

    if (!isValid) {
      // Check if this was the last attempt
      if (challenge.attempts + 1 >= challenge.maxAttempts) {
        await challengeRef.update({status: "expired"});
        throw new HttpsError(
          "invalid-argument",
          "Invalid code. Maximum attempts reached. Please request a new code."
        );
      }
      throw new HttpsError(
        "invalid-argument",
        `Invalid code. ${challenge.maxAttempts - challenge.attempts - 1} attempts remaining.`
      );
    }

    // OTP is valid - mark as verified
    await challengeRef.update({
      status: "verified",
      verifiedAt: Date.now(),
    });

    // Get or create Firebase Auth user
    let user;
    let isNewUser = false;
    try {
      // Try to get existing user by email
      user = await auth.getUserByEmail(challenge.email);
    } catch (error: any) {
      // Check if Auth emulator is not running
      if (error.code === "app/network-error" || error.code === "auth/configuration-not-found") {
        const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
        console.error("❌ Auth emulator connection error:", error.message);
        console.error("   Make sure the Auth emulator is running on:", emulatorHost || "127.0.0.1:9099");
        console.error("   Restart emulators with: npm run firebase:emulators");
        throw new HttpsError(
          "unavailable",
          "Auth emulator is not running. Please start the emulators with: npm run firebase:emulators"
        );
      }

      // User doesn't exist, create new one
      if (error.code === "auth/user-not-found") {
        isNewUser = true;
        user = await auth.createUser({
          email: challenge.email,
          emailVerified: true, // OTP verification confirms email
          displayName: firstName || undefined, // Set display name if provided
        });
      } else {
        throw error;
      }
    }

    // For new users, create/update user profile in Firestore
    if (isNewUser && firstName) {
      const userProfileRef = db.collection(COLLECTIONS.users).doc(user.uid);
      await userProfileRef.set({
        userId: user.uid,
        email: user.email,
        firstName: firstName,
        displayName: firstName,
        createdAt: Date.now(),
      }, {merge: true});
      console.log(`Created user profile for ${user.uid} with firstName: ${firstName}`);
    }

    // Create custom token for the user
    const customToken = await auth.createCustomToken(user.uid);

    // Log success (without sensitive data)
    console.log(`OTP verified for ${extractEmailDomain(challenge.email)}, userId: ${user.uid}, isNewUser: ${isNewUser}`);

    return {
      customToken,
      userId: user.uid,
      email: user.email,
      isNewUser: isNewUser || (!user.metadata.creationTime ||
        user.metadata.creationTime === user.metadata.lastSignInTime),
    };
  }
);

/**
 * Check rate limits for email and IP
 */
async function checkRateLimits(
  email: string,
  ipHash: string
): Promise<{ allowed: boolean; message?: string }> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Check email rate limit
  const emailChallenges = await db
    .collection(COLLECTIONS.otpChallenges)
    .where("email", "==", email)
    .where("createdAt", ">=", oneHourAgo)
    .get();

  if (emailChallenges.size >= RATE_LIMIT_EMAIL_PER_HOUR) {
    return {
      allowed: false,
      message: "Too many requests. Please wait before requesting another code.",
    };
  }

  // Check IP rate limit
  const ipChallenges = await db
    .collection(COLLECTIONS.otpChallenges)
    .where("ipHash", "==", ipHash)
    .where("createdAt", ">=", oneHourAgo)
    .get();

  if (ipChallenges.size >= RATE_LIMIT_IP_PER_HOUR) {
    return {
      allowed: false,
      message: "Too many requests from this location. Please try again later.",
    };
  }

  return {allowed: true};
}

/**
 * Check if user can resend (cooldown period)
 */
async function checkResendCooldown(
  email: string
): Promise<OtpChallenge | null> {
  const now = Date.now();
  const cooldownStart = now - RESEND_COOLDOWN_SECONDS * 1000;

  const recentChallenges = await db
    .collection(COLLECTIONS.otpChallenges)
    .where("email", "==", email)
    .where("createdAt", ">=", cooldownStart)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (recentChallenges.empty) {
    return null;
  }

  const recent = recentChallenges.docs[0].data() as OtpChallenge;
  return recent;
}

/**
 * Exchange a Firebase ID token (from phone sign-in in WebView) for a custom token
 * so the React Native app can sign in with signInWithCustomToken.
 */
export const exchangePhoneIdTokenForCustomToken = onCall(
  {
    enforceAppCheck: false,
    maxInstances: 10,
  },
  async (request) => {
    const data = request.data as { idToken?: string };
    const {idToken} = data;

    if (!idToken || typeof idToken !== "string") {
      throw new HttpsError("invalid-argument", "idToken is required");
    }

    try {
      const decoded = await auth.verifyIdToken(idToken);
      const customToken = await auth.createCustomToken(decoded.uid);
      return {customToken};
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/argument-error" || err.message?.includes("Decoding")) {
        throw new HttpsError("invalid-argument", "Invalid or expired ID token");
      }
      throw new HttpsError("internal", "Failed to create session");
    }
  }
);
