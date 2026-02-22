import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, CommonActions, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { colors } from '../../theme/colors';
import { functions } from '../../services/firebase';
import { auth } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';

type CodeVerificationScreenRouteProp = RouteProp<RootStackParamList, 'CodeVerification'>;
type CodeVerificationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CodeVerification'>;

interface CodeVerificationScreenProps {
  navigation: CodeVerificationScreenNavigationProp;
}

const CodeVerificationScreen: React.FC<CodeVerificationScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const route = useRoute<CodeVerificationScreenRouteProp>();
  const email = route.params?.email || '';
  const firstName = route.params?.firstName || '';
  const nextScreen = (route.params?.nextScreen as string) ?? 'Home';
  const challengeId = route.params?.challengeId;
  const isSignup = nextScreen === 'Pricing'; // used for API: send firstName only on signup

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [currentChallengeId, setCurrentChallengeId] = useState<string | undefined>(challengeId);
  const VALID_CODE = '000000'; // For testing/fallback

  // Update challengeId when route params change
  useEffect(() => {
    if (challengeId) {
      setCurrentChallengeId(challengeId);
    }
  }, [challengeId]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const numericText = text.replace(/[^0-9]/g, '');

    if (numericText.length > 1) {
      // Handle paste: fill multiple inputs
      const digits = numericText.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);

      // Focus the next empty input or the last one
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Single character input
      const newCode = [...code];
      newCode[index] = numericText;
      setCode(newCode);

      // Auto-focus next input
      if (numericText && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    const codeString = code.join('');

    if (!codeString || codeString.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code.');
      return;
    }

    // If no challengeId, fall back to test code (for development)
    if (!currentChallengeId) {
      if (codeString === VALID_CODE) {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: nextScreen }] })
        );
      } else {
        Alert.alert('Invalid Code', 'Please check your code and try again. For testing, use: 000000');
      }
      return;
    }

    setIsVerifying(true);

    try {
      console.log('Verifying OTP:', {
        challengeId: currentChallengeId,
        codeLength: codeString.length,
        nextScreen,
        firstName: isSignup ? firstName : undefined,
      });

      // Call verifyEmailOtp Cloud Function
      const verifyEmailOtp = httpsCallable(functions, 'verifyEmailOtp');
      const result = await verifyEmailOtp({
        challengeId: currentChallengeId,
        otpCode: codeString,
        firstName: isSignup ? firstName : undefined, // Only send firstName for signup
      }) as { data: { customToken: string; userId: string; email: string; isNewUser: boolean } };

      console.log('OTP verification successful:', {
        userId: result.data.userId,
        isNewUser: result.data.isNewUser,
      });

      // Sign in with the custom token
      await signInWithCustomToken(auth, result.data.customToken);

      console.log('Signed in successfully');

      setIsVerifying(false);

      // Navigate to the screen the caller specified
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: nextScreen }] })
      );
    } catch (error: any) {
      setIsVerifying(false);

      console.error('OTP verification error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Full error:', JSON.stringify(error, null, 2));

      let errorMessage = 'Invalid code. Please try again.';
      if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid code format.';
      } else if (error?.code === 'not-found') {
        errorMessage = 'Code expired or invalid. Please request a new code.';
      } else if (error?.code === 'failed-precondition') {
        errorMessage = 'This code has already been used.';
      } else if (error?.code === 'deadline-exceeded') {
        errorMessage = 'Code has expired. Please request a new code.';
      } else if (error?.code === 'resource-exhausted') {
        errorMessage = 'Too many attempts. Please request a new code.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert('Verification Failed', errorMessage);

      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) {
      Alert.alert('Please Wait', `Please wait ${resendCooldown} seconds before requesting a new code.`);
      return; // Still in cooldown
    }

    if (!email) {
      Alert.alert('Error', 'Email address is required.');
      return;
    }

    setIsResending(true);

    try {
      console.log('Resending OTP for email:', email.trim().toLowerCase());

      // Call requestEmailOtp Cloud Function again
      const requestEmailOtp = httpsCallable(functions, 'requestEmailOtp');
      const result = await requestEmailOtp({
        email: email.trim().toLowerCase(),
      }) as { data: { challengeId: string; message: string } };

      console.log('Resend successful, new challengeId:', result.data.challengeId);

      setIsResending(false);
      setResendCooldown(60); // 60 second cooldown

      // Update challengeId in state
      setCurrentChallengeId(result.data.challengeId);

      Alert.alert('Code Sent', 'A new code has been sent to your email.');

      // Clear current code
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      setIsResending(false);

      console.error('Resend error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Full error:', JSON.stringify(error, null, 2));

      let errorMessage = 'Failed to resend code. Please try again.';
      if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid email address.';
      } else if (error?.code === 'resource-exhausted') {
        errorMessage = error.message || 'Too many requests. Please try again later.';
      } else if (error?.code === 'internal') {
        errorMessage = 'Unable to send code. Please try again later.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    }
  };

  const handleTryDifferentEmail = () => {
    navigation.goBack();
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Security Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Ionicons name="shield-checkmark" size={40} color={colors.primaryDark} />
            </View>
          </View>

          {/* Instruction Text */}
          <Text style={styles.instructionText}>We sent a magic code to</Text>

          {/* Email Display */}
          <View style={styles.emailContainer}>
            <Ionicons name="mail" size={16} color="#1A1A1A" />
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Code Input Boxes */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isCodeComplete || isVerifying) && styles.verifyButtonDisabled
            ]}
            onPress={handleVerify}
            disabled={!isCodeComplete || isVerifying}
            activeOpacity={0.8}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <TouchableOpacity
            style={styles.resendContainer}
            onPress={handleResend}
            disabled={resendCooldown > 0 || isResending}
            activeOpacity={0.7}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <Ionicons name="refresh" size={16} color={resendCooldown > 0 ? "#CCCCCC" : "#1A1A1A"} />
            )}
            <Text style={[
              styles.resendText,
              resendCooldown > 0 && styles.resendTextDisabled
            ]}>
              {resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : 'Resend code'}
            </Text>
          </TouchableOpacity>

          {/* OR Separator */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>OR</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Try Different Email */}
          <TouchableOpacity
            style={styles.differentEmailContainer}
            onPress={handleTryDifferentEmail}
            activeOpacity={0.7}
          >
            <Ionicons name="paper-plane" size={16} color="#1A1A1A" />
            <Text style={styles.differentEmailText}>Try a different email address</Text>
          </TouchableOpacity>

          {/* Privacy Message */}
          <View style={styles.privacyContainer}>
            <Ionicons name="lock-closed" size={16} color="#4A4A4A" />
            <Text style={styles.privacyText}>
              Your data is encrypted in transit and at rest
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#E8F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  codeInputFilled: {
    borderColor: colors.primaryDark,
  },
  verifyButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  resendText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  resendTextDisabled: {
    color: '#CCCCCC',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  separatorText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    marginHorizontal: 16,
    textTransform: 'uppercase',
  },
  differentEmailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  differentEmailText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4A4A4A',
  },
});

export default CodeVerificationScreen;
