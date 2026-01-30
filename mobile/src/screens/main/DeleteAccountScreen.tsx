import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { auth } from '../../services/firebase';
import { signOut, deleteUser } from 'firebase/auth';

type DeleteAccountScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DeleteAccount'>;

interface DeleteAccountScreenProps {
  navigation: DeleteAccountScreenNavigationProp;
}

const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleCancelSubscription = () => {
    // TODO: Navigate to subscription cancellation
    // This would typically open the subscription management screen
    navigation.navigate('ManageSubscription');
  };

  const handleStay = () => {
    navigation.goBack();
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const user = auth.currentUser;
              if (user) {
                // TODO: Delete user data from Firestore first
                // Then delete the auth account
                await deleteUser(user);
                // Navigation will be handled by App.tsx auth state listener
              }
            } catch (error: any) {
              console.error('Error deleting account:', error);
              Alert.alert(
                'Error',
                error.message || 'Failed to delete account. Please try again.',
              );
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Status Section */}
        <View style={styles.contentSection}>
          <Text style={styles.statusText}>
            Your subscriptions status is <Text style={styles.activeText}>ACTIVE</Text>
          </Text>
          
          <Text style={styles.infoText}>
            You need to cancel your paid subscription before deleting your account.
          </Text>
          
          <Text style={styles.humorousText}>
            (Because no one likes surprise charges, right?)
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelSubscriptionButton}
          onPress={handleCancelSubscription}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelSubscriptionButtonText}>CANCEL MY SUBSCRIPTION</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.stayButton}
          onPress={handleStay}
          activeOpacity={0.8}
        >
          <Text style={styles.stayButtonText}>ACTUALLY, I'LL STAY</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  contentSection: {
    marginBottom: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 24,
    lineHeight: 26,
  },
  activeText: {
    color: '#34C759',
    fontWeight: '700',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 12,
    lineHeight: 24,
  },
  humorousText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  cancelSubscriptionButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSubscriptionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stayButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  stayButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default DeleteAccountScreen;
