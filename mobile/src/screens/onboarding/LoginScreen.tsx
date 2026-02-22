import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  const handleEmailLogin = () => {
    navigation.navigate('EmailLogin');
  };

  const handlePhoneLogin = () => {
    navigation.navigate('PhoneLogin');
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google login
    console.log('Google login');
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple login
    console.log('Apple login');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.black} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {/* Continue with Email Button */}
        <TouchableOpacity
          style={[styles.emailButton, { backgroundColor: theme.colors.gastronButton }]}
          onPress={handleEmailLogin}
          activeOpacity={0.8}
        >
          <Ionicons name="mail" size={20} color={theme.colors.black} />
          <Text style={[styles.emailButtonText, { color: theme.colors.black }]}>Continue with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          onPress={handlePhoneLogin}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={20} color="#1A1A1A" />
          <Text style={styles.socialButtonText}>Continue with Phone</Text>
        </TouchableOpacity>

        {/* OR Separator */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OR</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Continue with Google Button */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleGoogleLogin}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-google" size={20} color="#1A1A1A" />
          <Text style={styles.socialButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Continue with Apple Button */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleAppleLogin}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-apple" size={20} color="#1A1A1A" />
          <Text style={styles.socialButtonText}>Continue with Apple</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    justifyContent: 'center',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 24,
    gap: 8,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
});

export default LoginScreen;
