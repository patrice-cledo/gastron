/**
 * Loops.so Transactional Email Client
 * 
 * Handles sending OTP emails via Loops.so transactional API
 */

const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

interface LoopsSendRequest {
  email: string;
  transactionalId: string;
  dataVariables: {
    code: string; // Loops.so template expects 'code' variable
    otp_code?: string; // Keep for backward compatibility
    expires_minutes: number;
    app_name?: string;
    support_email?: string;
  };
}

interface LoopsResponse {
  success?: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send OTP email via Loops.so
 * 
 * @param apiKey - Loops API key (from secrets/config)
 * @param email - Recipient email
 * @param otpCode - 6-digit OTP code (plaintext, only exists in memory)
 * @param transactionalId - Loops template ID
 * @param expiresMinutes - OTP expiry time in minutes
 * @returns Promise resolving to success status
 */
export async function sendOtpEmail(
  apiKey: string,
  email: string,
  otpCode: string,
  transactionalId: string,
  expiresMinutes: number = 10
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `${LOOPS_API_BASE}/transactional`;

  const payload: LoopsSendRequest = {
    email,
    transactionalId,
    dataVariables: {
      code: otpCode, // Loops.so template expects 'code'
      otp_code: otpCode, // Keep for backward compatibility
      expires_minutes: expiresMinutes,
      app_name: 'CookThisPage',
      support_email: 'support@cookthispage.com',
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Loops API error: ${response.status}`;
      
      // Try to parse error if it's JSON
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Use raw text if not JSON
        errorMessage = errorText || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json() as LoopsResponse;
    
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    // Network errors, timeouts, etc.
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Retry sending OTP email once for transient errors
 */
export async function sendOtpEmailWithRetry(
  apiKey: string,
  email: string,
  otpCode: string,
  transactionalId: string,
  expiresMinutes: number = 10
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // First attempt
  const firstAttempt = await sendOtpEmail(
    apiKey,
    email,
    otpCode,
    transactionalId,
    expiresMinutes
  );

  if (firstAttempt.success) {
    return firstAttempt;
  }

  // Check if it's a transient error (5xx, timeout)
  const isTransient = firstAttempt.error?.includes('timeout') ||
    firstAttempt.error?.includes('5') ||
    firstAttempt.error?.includes('network');

  if (isTransient) {
    // Wait a bit before retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retry once
    return await sendOtpEmail(
      apiKey,
      email,
      otpCode,
      transactionalId,
      expiresMinutes
    );
  }

  // Non-transient error, return failure
  return firstAttempt;
}
