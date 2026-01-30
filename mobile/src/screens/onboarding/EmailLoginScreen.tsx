import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';

type EmailLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EmailLogin'>;

interface EmailLoginScreenProps {
  navigation: EmailLoginScreenNavigationProp;
}

const EmailLoginScreen: React.FC<EmailLoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendMagicCode = async () => {
    if (!email.trim()) {
      return;
    }

    // Clear any previous errors
    setErrorMessage(null);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Calling requestEmailOtp for email:', email.trim().toLowerCase());
      // Call requestEmailOtp Cloud Function
      const requestEmailOtp = httpsCallable(functions, 'requestEmailOtp');
      console.log('Function reference created, calling...');
      const result = await requestEmailOtp({
        email: email.trim().toLowerCase(),
      }) as { data: { challengeId: string; message: string } };
      console.log('OTP request successful, challengeId:', result.data.challengeId);

      setIsLoading(false);
      setErrorMessage(null);

      // Navigate to code verification with challengeId
      navigation.navigate('CodeVerification', {
        email: email.trim().toLowerCase(),
        firstName: '',
        challengeId: result.data.challengeId,
        nextScreen: 'Home',
      });
    } catch (error: any) {
      setIsLoading(false);
      
      console.error('OTP request error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error details:', error?.details);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      // Extract error message from Firebase Functions error
      let message = 'Failed to send code. Please try again.';
      
      // Firebase Functions errors can have the message in different places
      if (error?.code === 'invalid-argument') {
        message = error.message || error.details || 'Invalid email address.';
      } else if (error?.code === 'resource-exhausted') {
        // Rate limit error - use the message from backend which includes wait time
        message = error.message || error.details || 'Too many requests. Please wait before requesting another code.';
      } else if (error?.code === 'internal') {
        message = 'Unable to send code. Please try again later.';
      } else if (error?.code === 'not-found') {
        message = 'Function not found. Please check if the backend is running.';
      } else if (error?.details) {
        message = error.details;
      } else if (error?.message) {
        message = error.message;
      }

      // Show error in UI banner
      setErrorMessage(message);
      
      // Also show alert as fallback
      Alert.alert('Error', message);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isFormValid = email.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputWrapper, styles.inputWrapperFocused]}>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#999999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Send Magic Code Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isFormValid || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMagicCode}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>Send the magic code</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Back Link */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backLinkText}>Back</Text>
          </TouchableOpacity>

          {/* Privacy Message */}
          <View style={styles.privacyContainer}>
            <Ionicons name="lock-closed" size={16} color="#4A4A4A" />
            <Text style={styles.privacyText}>
              Your data is encrypted in transit and at rest
            </Text>
          </View>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerContent}>
              <Ionicons name="alert-circle" size={20} color="#FF3B30" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={() => setErrorMessage(null)}
                style={styles.errorBannerClose}
              >
                <Ionicons name="close" size={18} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    paddingTop: 60,
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A4A4A',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: '#4CAF50',
  },
  input: {
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 14,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backLink: {
    alignItems: 'center',
    marginBottom: 32,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4A4A4A',
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4A4A4A',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  errorBannerClose: {
    padding: 4,
  },
});

export default EmailLoginScreen;
