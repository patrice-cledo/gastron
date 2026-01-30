# OTP Authentication Backend Implementation

## Overview

This document describes the backend implementation for OTP (One-Time Password) authentication using email delivery via Loops.so, as specified in `docs/design/004-otp-authentication.md`.

## Architecture

### Components

1. **Cloud Functions** (`functions/src/auth.ts`):
   - `requestEmailOtp`: Generates OTP, stores challenge, sends email
   - `verifyEmailOtp`: Verifies OTP and creates/returns Firebase Auth token

2. **Shared Utilities** (`shared/`):
   - `otpUtils.ts`: OTP generation, hashing, verification
   - `loopsClient.ts`: Loops.so transactional email client

3. **Data Model** (`shared/types.ts`):
   - `OtpChallenge`: Firestore document structure
   - `OtpChallengeStatus`: Status enum

4. **Security**:
   - Firestore rules for `otpChallenges` collection
   - Rate limiting (per email and per IP)
   - Resend cooldown (60 seconds)

## Data Model

### OtpChallenge Document

```typescript
{
  id: string;                    // Document ID
  email: string;                 // Normalized email (lowercase)
  otpHash: string;               // SHA-256 hash of OTP + salt
  salt: string;                  // Random salt for hashing
  expiresAt: number;             // Timestamp (10 minutes from creation)
  status: 'pending' | 'verified' | 'expired' | 'failed_delivery';
  attempts: number;              // Verification attempts (max 3)
  maxAttempts: number;           // Usually 3
  createdAt: number;            // Timestamp
  verifiedAt?: number;           // Timestamp when verified
  ipHash?: string;              // Hashed IP for rate limiting
}
```

## API Functions

### `requestEmailOtp`

**Input:**
```typescript
{
  email: string;
}
```

**Output:**
```typescript
{
  challengeId: string;
  message: string;
}
```

**Behavior:**
1. Validates email format
2. Checks rate limits (5 per hour per email, 20 per hour per IP)
3. Checks resend cooldown (60 seconds)
4. Generates 6-digit OTP
5. Hashes OTP with random salt
6. Stores challenge in Firestore
7. Sends email via Loops.so (or logs in dev mode)
8. Returns challengeId

**Errors:**
- `invalid-argument`: Invalid email format
- `resource-exhausted`: Rate limit exceeded or cooldown active
- `internal`: Email delivery failed

### `verifyEmailOtp`

**Input:**
```typescript
{
  challengeId: string;
  otpCode: string;  // 6 digits
}
```

**Output:**
```typescript
{
  customToken: string;  // Firebase Auth custom token
  userId: string;
  email: string;
  isNewUser: boolean;
}
```

**Behavior:**
1. Validates inputs
2. Retrieves challenge from Firestore
3. Checks status (not already verified, not expired)
4. Checks attempt limit (max 3)
5. Verifies OTP using stored hash and salt
6. Marks challenge as verified
7. Gets or creates Firebase Auth user
8. Creates and returns custom token

**Errors:**
- `invalid-argument`: Invalid challengeId or OTP format
- `not-found`: Challenge doesn't exist
- `failed-precondition`: Challenge already used
- `deadline-exceeded`: Challenge expired
- `resource-exhausted`: Too many attempts

## Configuration

### Environment Variables / Secrets

The functions use the following configuration (via environment variables or Firebase Functions secrets):

- `LOOPS_API_KEY`: Loops.so API key
- `LOOPS_TRANSACTIONAL_ID`: Loops.so transactional template ID
- `IP_HASH_SALT`: Salt for IP hashing (optional, defaults to 'default-salt-change-in-production')

### Setting Up Secrets (Production)

```bash
# Set Loops API key
firebase functions:secrets:set LOOPS_API_KEY

# Set Loops transactional template ID
firebase functions:secrets:set LOOPS_TRANSACTIONAL_ID

# Set IP hash salt (optional)
firebase functions:secrets:set IP_HASH_SALT
```

### Development Mode

If `LOOPS_API_KEY` or `LOOPS_TRANSACTIONAL_ID` are not set, the function will:
- Log the OTP to console: `[DEV] OTP for email@example.com: 123456`
- Return success (for testing without email service)

## Rate Limiting

### Limits

- **Per Email**: 5 OTP requests per hour
- **Per IP**: 20 OTP requests per hour
- **Resend Cooldown**: 60 seconds between requests for same email

### Implementation

Rate limits are enforced by querying Firestore for recent challenges:
- Queries use `email` + `createdAt` index
- Queries use `ipHash` + `createdAt` index
- Cooldown checks most recent challenge for email

## Security Features

1. **OTP Hashing**: OTPs are never stored in plaintext, only SHA-256 hashes
2. **Salt Storage**: Each challenge has a unique salt stored with the hash
3. **Constant-Time Comparison**: Uses `crypto.timingSafeEqual` to prevent timing attacks
4. **IP Hashing**: IP addresses are hashed (one-way) for rate limiting
5. **No OTP Logging**: OTP codes are never logged (only challengeId, domain, status)
6. **Attempt Limiting**: Max 3 verification attempts per challenge
7. **Expiry**: OTPs expire after 10 minutes
8. **Single Use**: Challenges marked as 'verified' cannot be reused

## Firestore Rules

```javascript
match /otpChallenges/{challengeId} {
  // Users can read challenges for their email (for status checks)
  allow read: if isAuthenticated() && 
    resource.data.email == request.auth.token.email;
  // Only Cloud Functions can create/update/delete (via admin SDK)
  allow write: if false;
}
```

## Firestore Indexes

Required indexes (already added to `firestore.indexes.json`):

1. `otpChallenges` collection:
   - `email` (ASC) + `createdAt` (DESC) - for rate limiting and cooldown
   - `ipHash` (ASC) + `createdAt` (DESC) - for IP rate limiting

## Loops.so Integration

### Email Template Variables

The Loops.so transactional template should support these variables:

- `otp_code`: 6-digit OTP code
- `expires_minutes`: Expiry time (10)
- `app_name`: "CookThisPage"
- `support_email`: "support@cookthispage.com"

### API Endpoint

The implementation uses:
- **Endpoint**: `https://app.loops.so/api/v1/transactional`
- **Method**: POST
- **Auth**: Bearer token (API key)
- **Retry**: 1 automatic retry for transient errors (5xx, timeouts)

## Testing

### Development Testing

1. Start emulators:
   ```bash
   npm run firebase:emulators
   ```

2. Call `requestEmailOtp`:
   ```bash
   curl -X POST http://localhost:5001/cookthispage/us-central1/requestEmailOtp \
     -H "Content-Type: application/json" \
     -d '{"data":{"email":"test@example.com"}}'
   ```

3. Check console logs for OTP (in dev mode)

4. Call `verifyEmailOtp`:
   ```bash
   curl -X POST http://localhost:5001/cookthispage/us-central1/verifyEmailOtp \
     -H "Content-Type: application/json" \
     -d '{"data":{"challengeId":"...","otpCode":"123456"}}'
   ```

### Production Testing

1. Set up Loops.so:
   - Create transactional template
   - Get API key and template ID
   - Set secrets in Firebase

2. Test email delivery:
   - Request OTP for real email
   - Verify email arrives
   - Verify OTP works

## Error Handling

### Client-Safe Errors

All errors returned to clients are safe and don't expose:
- Internal implementation details
- Provider-specific errors (Loops.so errors)
- OTP values
- Rate limit details (just "rate limit exceeded")

### Internal Logging

Logs include:
- Challenge IDs
- Email domains (e.g., "gmail.com")
- Delivery status
- User IDs (after verification)

Logs never include:
- OTP codes
- Plaintext IP addresses
- Full email addresses (only domains)

## Next Steps

1. **Frontend Integration**: Update frontend to call these functions
2. **Loops.so Setup**: Create email template and configure secrets
3. **Testing**: Test with real emails in staging environment
4. **Monitoring**: Set up alerts for delivery failures
5. **Cleanup**: Add scheduled function to delete expired challenges
