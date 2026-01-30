import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

// Conditionally import usePlacement and useSuperwall
let usePlacement: any = null;
let useSuperwall: any = null;
try {
  const superwallModule = require('expo-superwall');
  usePlacement = superwallModule.usePlacement;
  useSuperwall = superwallModule.useSuperwall;
} catch (error) {
  console.warn('Superwall not available');
  // Mock hook that returns a placement object with registerPlacement method
  usePlacement = () => {
    return {
      registerPlacement: async () => {
        console.warn('Superwall paywall not available - native module not loaded');
      },
      state: { status: 'idle' },
    };
  };
  useSuperwall = () => {
    return {
      user: { subscriptionStatus: 'UNKNOWN' },
    };
  };
}

type CollectionCreatedScreenRouteProp = RouteProp<RootStackParamList, 'CollectionCreated'>;
type CollectionCreatedScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CollectionCreated'>;

interface CollectionCreatedScreenProps {
  navigation: CollectionCreatedScreenNavigationProp;
}

const CollectionCreatedScreen: React.FC<CollectionCreatedScreenProps> = ({ navigation }) => {
  const route = useRoute<CollectionCreatedScreenRouteProp>();
  const collectionName = route.params?.collectionName || 'Collection';
  const confettiAnim = new Animated.Value(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if Superwall is available
  let superwall: any = null;
  try {
    if (useSuperwall) {
      superwall = useSuperwall();
    }
  } catch (error) {
    console.warn('Superwall hook not available:', error);
  }
  
  // Get the placement - must match the placement name in your Superwall dashboard
  // usePlacement returns { registerPlacement: Function, state: PaywallState }
  let placement: any = null;
  try {
    if (usePlacement) {
      placement = usePlacement('trial-offer');
      console.log('📦 Placement object:', placement);
      console.log('📦 Placement.registerPlacement type:', typeof placement?.registerPlacement);
    } else {
      console.warn('⚠️ usePlacement hook is not available');
    }
  } catch (error) {
    console.error('❌ Error getting placement:', error);
  }
  
  // Fallback if placement is invalid
  if (!placement || typeof placement?.registerPlacement !== 'function') {
    console.warn('⚠️ Placement is invalid, using fallback');
    placement = {
      registerPlacement: async () => {
        console.warn('Superwall placement not available - check if native module is loaded and placement name is correct');
        Alert.alert(
          'Superwall Not Available',
          'The paywall is not available. Make sure you are running a development build (npx expo run:ios) and that the placement "trial-offer" exists in your Superwall dashboard.',
          [{ text: 'OK' }]
        );
      },
    };
  }

  useEffect(() => {
    // Animate confetti
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      
      console.log('🎯 Attempting to present Superwall paywall for placement: trial-offer');
      console.log('🔍 Superwall status:', superwall ? 'Available' : 'Not available');
      console.log('🔍 Placement status:', placement ? 'Available' : 'Not available');
      
      // Show Superwall paywall using registerPlacement
      // registerPlacement requires an object with the placement name
      await placement.registerPlacement({
        placement: 'trial-offer',
      });
      
      console.log('✅ Superwall paywall presentation completed');
      
      // Navigation will be handled by Superwall's purchase completion
      // or navigate to Home after paywall is dismissed
      navigation.navigate('Home');
    } catch (error) {
      console.error('❌ Error presenting Superwall paywall:', error);
      // Safely log error details (errors may have circular references or missing properties)
      if (error instanceof Error) {
        console.error('Error message:', error.message || 'No error message');
        // Only log stack if it exists and is a string
        if (error.stack && typeof error.stack === 'string') {
          console.error('Error stack:', error.stack);
        } else {
          console.error('Error stack: Not available');
        }
      } else {
        console.error('Error object:', error);
      }
      // Navigate to Home even if there's an error
      navigation.navigate('Home');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Simulated App Screen */}
        <View style={styles.simulatedScreen}>
          <View style={styles.simulatedHeader}>
            <Text style={styles.simulatedTime}>9:41</Text>
            <View style={styles.simulatedStatusIcons}>
              <Ionicons name="cellular" size={12} color="#000000" />
              <Ionicons name="wifi" size={12} color="#000000" style={styles.statusIcon} />
              <Ionicons name="battery-full" size={12} color="#000000" style={styles.statusIcon} />
            </View>
          </View>
          
          <View style={styles.simulatedContent}>
            <View style={styles.collectionHeader}>
              <View style={styles.collectionIcon}>
                <Ionicons name="grid" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.collectionTitle}>{collectionName}</Text>
            </View>
            
            <View style={styles.metricsContainer}>
              <View style={styles.metric}>
                <Ionicons name="bookmark" size={16} color="#666666" />
                <Text style={styles.metricText}>0 saves</Text>
              </View>
              <View style={styles.metric}>
                <Ionicons name="checkmark-circle" size={16} color="#666666" />
                <Text style={styles.metricText}>0 UZD</Text>
              </View>
              <View style={styles.metric}>
                <Ionicons name="grid" size={16} color="#666666" />
                <Text style={styles.metricText}>0 extracts</Text>
              </View>
            </View>
            
            <Text style={styles.promptText}>You didn't add a prompt did ya?</Text>
          </View>
        </View>

        {/* Confetti Animation */}
        <Animated.View
          style={[
            styles.confettiContainer,
            {
              opacity: confettiAnim,
              transform: [
                {
                  scale: confettiAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.confetti,
                {
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF6B9D'][i % 5],
                  left: `${(i * 5) % 100}%`,
                  top: `${(i * 7) % 100}%`,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Success Message */}
        <View style={styles.successContainer}>
          <View style={styles.folderIcon}>
            <Ionicons name="folder" size={60} color="#4A9EFF" />
          </View>
          <Text style={styles.successTitle}>
            Collection Created! 🎉
          </Text>
          <Text style={styles.successDescription}>
            You can add more collections anytime from the home screen or when sharing items to Gastrons.
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button - pinned at very bottom */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Loading...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  simulatedScreen: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    minHeight: 200,
  },
  simulatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  simulatedTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  simulatedStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusIcon: {
    marginLeft: 4,
  },
  simulatedContent: {
    paddingHorizontal: 8,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  collectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  promptText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    fontStyle: 'italic',
  },
  confettiContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    height: 300,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  folderIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#4A9EFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  actions: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default CollectionCreatedScreen;
