import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

type OtherHelpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'OtherHelp'>;

interface OtherHelpScreenProps {
  navigation: OtherHelpScreenNavigationProp;
}

const OtherHelpScreen: React.FC<OtherHelpScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    if (response.trim().length > 0) {
      // Pass the response back to HelpNeededScreen
      navigation.navigate('HelpNeeded', { otherResponse: response.trim() });
    } else {
      navigation.goBack();
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleClear = () => {
    setResponse('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.content}>
          {/* Input Field with Back Arrow */}
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={handleBack} style={styles.inputBackButton}>
              <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type your response here"
                placeholderTextColor="#999999"
                value={response}
                onChangeText={setResponse}
                multiline
                autoFocus
              />
              {response.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <Ionicons name="close" size={20} color="#1A1A1A" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Info Message */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle" size={20} color="#4A4A4A" />
            <Text style={styles.infoText}>
              Please let us know and we'll do our best to cater to what you need help with.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            response.trim().length === 0 && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={response.trim().length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>SUBMIT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBarFilled: {
    backgroundColor: '#FFD700',
  },
  progressBarEmpty: {
    backgroundColor: '#E0E0E0',
  },
  skipButton: {
    padding: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 36,
    maxHeight: 80,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#4A4A4A',
    lineHeight: 20,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  submitButton: {
    backgroundColor: '#4A4A4A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default OtherHelpScreen;
