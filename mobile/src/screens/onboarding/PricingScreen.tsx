import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
// Conditionally import usePlacement
let usePlacement: any = null;
try {
  const superwallModule = require('expo-superwall');
  usePlacement = superwallModule.usePlacement;
} catch (error) {
  console.warn('Superwall not available');
  usePlacement = () => ({
    present: async () => {
      console.warn('Superwall paywall not available');
    },
  });
}

type PricingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pricing'>;

interface PricingScreenProps {
  navigation: PricingScreenNavigationProp;
}

const PricingScreen: React.FC<PricingScreenProps> = ({ navigation }) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get the placement for pricing screen - configure this in your Superwall dashboard
  // You can use different placements for monthly vs yearly, or pass attributes
  const placement = usePlacement('pricing_screen');

  const handleStartTrial = async () => {
    try {
      setIsLoading(true);
      
      // Show Superwall paywall with attributes based on selected plan
      await placement.present({
        attributes: {
          plan_type: selectedPlan,
          reminder_enabled: reminderEnabled,
        },
      });
      
      // Navigation will be handled by Superwall's purchase completion
      // or you can listen to Superwall events to navigate
    } catch (error) {
      console.error('Error presenting Superwall paywall:', error);
      Alert.alert(
        'Error',
        'Unable to load subscription options. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Navigate to main area of the app when modal is closed
    navigation.navigate('Home');
  };

  // Calculate trial end date (30 days from now)
  const getTrialEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getChargeAmount = () => {
    return selectedPlan === 'monthly' ? '$6.00' : '$60.00';
  };

  const getChargePeriod = () => {
    return selectedPlan === 'monthly' ? 'per month' : 'per year';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <Image
            source={require('../../../assets/icons/icon.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Upgrade CookThisPage</Text>

        {/* Description */}
        <Text style={styles.description}>
          Time to cancel your boring dinners by getting unrestricted access to all recipes & packs.
        </Text>

        {/* Try Free Text */}
        <Text style={styles.tryFreeText}>Try it for free for 30 days</Text>

        {/* Pricing Options */}
        <View style={styles.pricingContainer}>
          {/* Monthly Card */}
          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'monthly' && styles.pricingCardSelected
            ]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.8}
          >
            <Text style={styles.pricingTitle}>MONTHLY</Text>
            <Text style={styles.pricingAmount}>$6.00</Text>
            <Text style={styles.pricingPeriod}>/ Per Month</Text>
          </TouchableOpacity>

          {/* Yearly Card */}
          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === 'yearly' && styles.pricingCardSelected
            ]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.8}
          >
            <View style={styles.bestValueBanner}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.pricingTitle}>YEARLY</Text>
            <Text style={styles.pricingAmount}>$60.00</Text>
            <View style={styles.yearlyDetails}>
              <Text style={styles.yearlyMonthlyPrice}>/*$5.00/mo</Text>
              <Text style={styles.yearlyBilled}>Billed Annually</Text>
            </View>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save 17%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Reminder Toggle */}
        <View style={styles.reminderSection}>
          <Text style={styles.reminderText}>Remind me before my trial ends</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: '#E0E0DA', true: '#FF6B35' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0E0DA"
          />
        </View>

        {/* Trial Information */}
        <Text style={styles.trialInfo}>
          After your trial ends on {getTrialEndDate()}, you will be automatically charged {getChargeAmount()} {getChargePeriod()}.
        </Text>

        {/* Start Trial Button */}
        <TouchableOpacity
          style={[styles.startTrialButton, isLoading && styles.startTrialButtonDisabled]}
          onPress={handleStartTrial}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.startTrialButtonText}>
            {isLoading ? 'LOADING...' : 'START MY 30 DAYS FREE TRIAL'}
          </Text>
        </TouchableOpacity>

        {/* Legal Text */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            Your subscription will automatically renew unless canceled at least 24 hours before the trial ends.
          </Text>
          <Text style={styles.legalText}>
            You can cancel your subscription at any time before your trial ends to avoid being charged.
          </Text>
          <Text style={styles.legalText}>
            Go to your Apple account settings to cancel your subscription.
          </Text>
          <Text style={styles.legalText}>
            By subscribing you agree to our{' '}
            <Text style={styles.legalLink}>terms & conditions</Text>.
          </Text>
        </View>

        {/* Refresh Account Status */}
        <TouchableOpacity
          style={styles.refreshContainer}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={16} color="#1A1A1A" />
          <Text style={styles.refreshText}>REFRESH ACCOUNT STATUS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F0',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appIcon: {
    width: 80,
    height: 80,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  tryFreeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 32,
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  pricingCardSelected: {
    borderColor: '#FFD700',
  },
  bestValueBanner: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  pricingAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  pricingPeriod: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  yearlyDetails: {
    marginTop: 8,
    marginBottom: 12,
  },
  yearlyMonthlyPrice: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    marginBottom: 4,
  },
  yearlyBilled: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  saveBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  saveBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reminderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  reminderText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  trialInfo: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  startTrialButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  startTrialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  startTrialButtonDisabled: {
    opacity: 0.6,
  },
  legalSection: {
    marginBottom: 24,
  },
  legalText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  refreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
  },
});

export default PricingScreen;
