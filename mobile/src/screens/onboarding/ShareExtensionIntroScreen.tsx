import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

type ShareExtensionIntroScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShareExtensionIntro'>;

interface ShareExtensionIntroScreenProps {
  navigation: ShareExtensionIntroScreenNavigationProp;
}

const ShareExtensionIntroScreen: React.FC<ShareExtensionIntroScreenProps> = ({ navigation }) => {
  const handleContinue = () => {
    navigation.navigate('ShareExtensionInstructions');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Simulated Phone with Dialog */}
        <View style={styles.phoneContainer}>
          <View style={styles.phoneFrame}>
            {/* Phone Status Bar */}
            <View style={styles.phoneStatusBar}>
              <View style={styles.phoneNotch} />
            </View>
            
            {/* Phone Content - Blurred Background */}
            <View style={styles.phoneContent}>
              {/* Dialog Box */}
              <View style={styles.dialogBox}>
                <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>Let's set up the Gastrons shortcut!</Text>
                  <View style={styles.dialogIcon}>
                    <Ionicons name="bookmark" size={32} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.dialogSubtitle}>
                  Save content instantly from any app using the share extension.
                </Text>
              </View>

              {/* Curved Arrow */}
              <View style={styles.arrowContainer}>
                <View style={styles.curvedArrow} />
              </View>

              {/* App Icon on Home Screen */}
              <View style={styles.appIconContainer}>
                <View style={styles.appIcon}>
                  <Ionicons name="bookmark" size={40} color="#FFFFFF" />
                </View>
                <Text style={styles.appIconLabel}>Gastrons</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Button - pinned at very bottom */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color="#1A1A1A" />
          <Text style={styles.actionButtonText}>Let's do it</Text>
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
    alignItems: 'center',
  },
  phoneContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  phoneFrame: {
    width: 280,
    height: 500,
    backgroundColor: '#000000',
    borderRadius: 40,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  phoneStatusBar: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNotch: {
    width: 120,
    height: 30,
    backgroundColor: '#000000',
    borderRadius: 15,
  },
  phoneContent: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 32,
    padding: 20,
    position: 'relative',
  },
  dialogBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dialogTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginRight: 12,
  },
  dialogIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    lineHeight: 20,
  },
  arrowContainer: {
    position: 'absolute',
    bottom: 120,
    right: 40,
    width: 100,
    height: 100,
  },
  curvedArrow: {
    width: 80,
    height: 80,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#4A9EFF',
    borderRadius: 0,
    transform: [{ rotate: '-45deg' }],
  },
  appIconContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    alignItems: 'center',
  },
  appIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appIconLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default ShareExtensionIntroScreen;
