import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { auth, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';

let nativeFirebaseAuth: ReturnType<typeof require> | null = null;
try {
  nativeFirebaseAuth = require('@react-native-firebase/auth').default;
} catch {
  nativeFirebaseAuth = null;
}

type PhoneLoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhoneLogin'>;

interface PhoneLoginScreenProps {
  navigation: PhoneLoginScreenNavigationProp;
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10 && !input.startsWith('+')) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (input.trim().startsWith('+')) return '+' + digits;
  return '+1' + digits;
}

const PhoneLoginScreen: React.FC<PhoneLoginScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'PhoneLogin'>>();
  const nextScreen = route.params?.nextScreen ?? 'Home';
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<{ confirm: (code: string) => Promise<unknown> } | null>(null);

  const handleSendCode = useCallback(async () => {
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) {
      setError('Enter a valid phone number (e.g. +1 650 555 1234)');
      return;
    }
    if (!nativeFirebaseAuth) {
      setError(
        'Phone sign-in requires a development build. Run: npx expo run:ios (or run:android).'
      );
      return;
    }
    setLoading(true);
    try {
      const confirmation = await nativeFirebaseAuth().signInWithPhoneNumber(normalized);
      confirmationRef.current = confirmation;
      setStep('code');
      setError(null);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to send code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleSignInWithIdToken = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const exchange = httpsCallable<
          { idToken: string },
          { customToken: string }
        >(functions, 'exchangePhoneIdTokenForCustomToken');
        const result = await exchange({ idToken });
        const customToken = result.data.customToken;
        await signInWithCustomToken(auth, customToken);
        if (nativeFirebaseAuth) nativeFirebaseAuth().signOut();
        setLoading(false);
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: nextScreen }] })
        );
      } catch (err: unknown) {
        setLoading(false);
        const message = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Sign in failed';
        setError(message);
      }
    },
    [navigation, nextScreen]
  );

  const handleVerifyCode = useCallback(async () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError('Session expired. Tap Back and try again.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await confirmation.confirm(codeString);
      const idToken = await nativeFirebaseAuth!().currentUser?.getIdToken();
      if (!idToken) {
        setError('Could not get session. Try again.');
        setLoading(false);
        return;
      }
      await handleSignInWithIdToken(idToken);
    } catch (err: unknown) {
      setLoading(false);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Invalid or expired code';
      setError(msg);
    }
  }, [code, handleSignInWithIdToken]);

  const handleBack = () => {
    if (step === 'code') {
      setStep('phone');
      setCode(['', '', '', '', '', '']);
      confirmationRef.current = null;
      setError(null);
    } else {
      navigation.goBack();
    }
  };

  if (!nativeFirebaseAuth) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors?.background || '#FFFFFF' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color={theme.colors?.black || '#1E293B'} />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.colors?.black || '#1E293B' }]}>
            Sign in with phone
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors?.lightText || '#8A8A8A' }]}>
            Phone sign-in requires a development build (native Firebase). Run:{' '}
            <Text style={styles.code}>npx expo run:ios</Text> or{' '}
            <Text style={styles.code}>npx expo run:android</Text>, then try again. It does not work in Expo Go.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors?.background || '#FFFFFF' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color={theme.colors?.black || '#1E293B'} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {step === 'phone' ? (
          <>
            <Text style={[styles.title, { color: theme.colors?.black || '#1E293B' }]}>
              Sign in with phone
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors?.lightText || '#8A8A8A' }]}>
              Enter your number and we’ll send a verification code.
            </Text>
            <TextInput
              style={[styles.input, { borderColor: theme.colors?.lightGray || '#D4D4CE', color: theme.colors?.black || '#1E293B' }]}
              placeholder="+1 650 555 1234"
              placeholderTextColor={theme.colors?.lightText || '#8A8A8A'}
              value={phone}
              onChangeText={(t) => { setPhone(t); setError(null); }}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors?.gastronButton || '#E0EB60' }]}
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1E293B" />
              ) : (
                <>
                  <Ionicons name="call" size={20} color="#1E293B" />
                  <Text style={styles.primaryButtonText}>Send code</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.colors?.black || '#1E293B' }]}>
              Enter code
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors?.lightText || '#8A8A8A' }]}>
              We sent a 6-digit code to {phone}
            </Text>
            <View style={styles.codeRow}>
              {code.map((digit, i) => (
                <TextInput
                  key={i}
                  style={[styles.codeInput, { borderColor: theme.colors?.lightGray || '#D4D4CE', color: theme.colors?.black || '#1E293B' }]}
                  value={digit}
                  onChangeText={(t) => {
                    const n = t.replace(/\D/g, '').slice(0, 1);
                    const next = [...code];
                    next[i] = n;
                    setCode(next);
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                />
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors?.gastronButton || '#E0EB60' }]}
              onPress={handleVerifyCode}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#1E293B" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: { padding: 8, marginLeft: 8 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  code: { fontFamily: 'monospace', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 20,
    textAlign: 'center',
  },
  errorText: { color: '#C53030', fontSize: 14, marginBottom: 12 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
});

export default PhoneLoginScreen;
