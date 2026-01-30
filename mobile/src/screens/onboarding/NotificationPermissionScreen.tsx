import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

type NotificationPermissionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NotificationPermission'>;

interface NotificationPermissionScreenProps {
  navigation: NotificationPermissionScreenNavigationProp;
}

const NotificationPermissionScreen: React.FC<NotificationPermissionScreenProps> = ({ navigation }) => {
  const [hasRequested, setHasRequested] = useState(false);

  useEffect(() => {
    // Auto-request permissions after a brief delay to show the screen
    const timer = setTimeout(() => {
      requestPermissions();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const requestPermissions = async () => {
    try {
      setHasRequested(true);
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Permissions granted, proceed to next step
        setTimeout(() => {
          navigation.navigate('CreateCollectionIntro');
        }, 500);
      } else {
        // User denied, but we still proceed (they can enable later)
        setTimeout(() => {
          navigation.navigate('CreateCollectionIntro');
        }, 500);
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      // Proceed anyway
      navigation.navigate('CreateCollectionIntro');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Wrapper sized like iOS system alert (~270pt) so simulated dialog and arrow align with it */}
        <View style={styles.alertWrapper}>
          {/* Simulated iOS Notification Alert */}
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>
              "Gastrons" Would Like to Send You Notifications
            </Text>
            <Text style={styles.alertMessage}>
              Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => navigation.navigate('CreateCollectionIntro')}
                activeOpacity={0.7}
              >
                <Text style={styles.alertButtonText}>Don't Allow</Text>
              </TouchableOpacity>
              <View style={styles.alertButtonDivider} />
              <TouchableOpacity
                style={styles.alertButton}
                onPress={requestPermissions}
                activeOpacity={0.7}
              >
                <Text style={[styles.alertButtonText, styles.alertButtonTextPrimary]}>
                  Allow
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Arrow pointing up at the Allow button (right half of dialog) */}
          <View style={styles.arrowRow}>
            <View style={styles.arrowSpacer} />
            <View style={styles.arrowTarget}>
              <Ionicons name="arrow-up" size={80} color="#CCCCCC" />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const IOS_ALERT_WIDTH = 270;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 100,
    alignItems: 'center',
  },
  alertWrapper: {
    width: IOS_ALERT_WIDTH,
  },
  alertBox: {
    backgroundColor: '#2C2C2C',
    borderRadius: 14,
    padding: 20,
    width: IOS_ALERT_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 13,
    fontWeight: '400',
    color: '#CCCCCC',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  alertButtons: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#444444',
    marginTop: 8,
  },
  alertButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonDivider: {
    width: 0.5,
    backgroundColor: '#444444',
  },
  alertButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#007AFF',
  },
  alertButtonTextPrimary: {
    fontWeight: '600',
  },
  arrowRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  arrowSpacer: {
    flex: 1,
  },
  arrowTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NotificationPermissionScreen;
