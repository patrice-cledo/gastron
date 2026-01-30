import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { hasActiveSubscription } from '../../services/superwall';

// Conditionally import useSuperwall
let useSuperwall: any = null;
try {
  const superwallModule = require('expo-superwall');
  useSuperwall = superwallModule.useSuperwall;
} catch (error) {
  console.warn('Superwall not available');
  useSuperwall = () => ({
    user: { subscriptionStatus: 'UNKNOWN' },
    openSubscriptionManagement: async () => {
      console.warn('Subscription management not available');
    },
  });
}

type ManageSubscriptionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ManageSubscription'>;

interface ManageSubscriptionScreenProps {
  navigation: ManageSubscriptionScreenNavigationProp;
}

const ManageSubscriptionScreen: React.FC<ManageSubscriptionScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const superwall = useSuperwall();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = () => {
      const subscribed = hasActiveSubscription(superwall);
      setIsSubscribed(subscribed);
    };
    
    checkSubscription();
    
    // Listen to subscription status changes
    // You can also use Superwall events to update this in real-time
    const interval = setInterval(checkSubscription, 5000);
    
    return () => clearInterval(interval);
  }, [superwall]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleManageWithApple = async () => {
    try {
      setIsLoading(true);
      
      // Open subscription management
      // Superwall provides a method to open the subscription management screen
      await superwall.openSubscriptionManagement();
      
      // Refresh subscription status after returning
      setIsSubscribed(hasActiveSubscription(superwall));
    } catch (error) {
      console.error('Error opening subscription management:', error);
      Alert.alert(
        'Error',
        'Unable to open subscription management. Please try again or manage your subscription in the App Store settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get subscription info from Superwall user object
  const subscriptionInfo = superwall.user.subscriptionStatus;
  const trialEndDate = subscriptionInfo === 'TRIAL' 
    ? 'Active trial' 
    : subscriptionInfo === 'ACTIVE'
    ? 'Active subscription'
    : 'No active subscription';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Status Section */}
        <View style={styles.contentSection}>
          <Text style={styles.mainText}>
            You're signed up via <Text style={styles.appleHighlight}>Apple</Text>
          </Text>
          
          <Text style={styles.infoText}>
            Subscription Status: {subscriptionInfo || 'Unknown'}
          </Text>
          
          {isSubscribed ? (
            <Text style={styles.infoText}>
              Your subscription is active. You can manage or cancel it below.
            </Text>
          ) : (
            <>
              <Text style={styles.infoText}>
                {trialEndDate}
              </Text>
              <Text style={styles.infoText}>
                After this date, your subscription will automatically renew.
              </Text>
            </>
          )}
        </View>

        {/* Call to Action */}
        <View style={styles.actionSection}>
          <Text style={styles.actionPrompt}>TAP TO MANAGE YOUR ACCOUNT</Text>
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-down" size={32} color="#1A1A1A" />
          </View>
        </View>
      </ScrollView>

      {/* Manage with Apple Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.manageButton, isLoading && styles.manageButtonDisabled]}
          onPress={handleManageWithApple}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Ionicons name="logo-apple" size={24} color="#1A1A1A" />
          <Text style={styles.manageButtonText}>
            {isLoading ? 'LOADING...' : 'MANAGE WITH APPLE'}
          </Text>
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
  mainText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
    lineHeight: 28,
  },
  appleHighlight: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 12,
    lineHeight: 24,
  },
  actionSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  actionPrompt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  arrowContainer: {
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
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  manageButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  manageButtonDisabled: {
    opacity: 0.6,
  },
});

export default ManageSubscriptionScreen;
