Design Doc Addendum: OTP Delivery via Loops.so (Transactional Email)
Purpose

OTP codes are delivered to users via Loops.so using a transactional email template. Firebase Cloud Functions generate the OTP and call Loops’ transactional API to send the code to the user’s email address.

Requirements

OTP email must send within a few seconds in normal conditions

OTP email should be minimal, readable, and spam-resistant

Delivery failures must be handled gracefully (retry + user messaging)

No OTP values stored in logs or plaintext DB fields

1) Loops Setup
1.1 Transactional Template

Create a transactional email in Loops with variables:

otp_code (string, 6 digits)

expires_minutes (number)

app_name (string, optional)

support_email (optional)

Recommended subject:

Your login code: {{otp_code}} (or omit the code in subject for privacy)

Recommended body:

“Your code is {{otp_code}}. It expires in {{expires_minutes}} minutes.”

“If you didn’t request this, ignore this email.”

1.2 API Key Management

Store Loops API key in Firebase Functions config or secret manager:

Preferred: Functions secrets

Fallback: functions.config() if you’re not using secrets yet

2) Cloud Function Integration
2.1 requestEmailOtp changes

After generating OTP + writing the otpChallenges/{challengeId} doc:

Call Loops transactional send endpoint with:

email: user email

transactionalId (template ID)

data: variables

Payload example (conceptual):

{
  "email": "user@example.com",
  "transactionalId": "YOUR_TEMPLATE_ID",
  "dataVariables": {
    "otp_code": "123456",
    "expires_minutes": 10,
    "app_name": "CookThisPage"
  }
}

2.2 Error handling rules

If Loops send fails:

Mark challenge status as failed_delivery OR delete it (choose one)

Return a client-safe error: OTP_SEND_FAILED

Do not reveal provider errors to the client (log internally)

Retry policy:

1 immediate retry for transient errors (timeouts/5xx)

If still failing: return error and let user retry

Logging:

Log only:

challengeId

domain (e.g. gmail.com)

delivery status

Never log otp_code

3) Rate Limiting and Deliverability Guardrails

Because OTP email can be abused:

Rate limit per email: e.g. 5 per hour

Rate limit per IP hash (if available): e.g. 20 per hour

Enforce resend cooldown in client: 60 seconds

Add optional suppression for obvious disposable domains (v1.1)

Deliverability UX:

OTP screen copy includes:

“Check spam/junk”

“It can take up to a minute”

Resend button becomes available after cooldown

4) Security Notes

OTP values exist only:

in-memory during function execution

in the email payload to Loops

OTP stored in Firestore only as:

salted hash + expiry + counters

Loops API key must never reach client

5) Testing Checklist (Loops)

Happy path send + verify

Loops downtime (5xx) returns OTP_SEND_FAILED

Timeout triggers retry once

Rate limit blocks rapid requests

Ensure logs never include OTP code