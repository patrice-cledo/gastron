import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

type ShareExtensionCompleteScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShareExtensionComplete'>;

interface ShareExtensionCompleteScreenProps {
  navigation: ShareExtensionCompleteScreenNavigationProp;
}

const ShareExtensionCompleteScreen: React.FC<ShareExtensionCompleteScreenProps> = ({ navigation }) => {
  const handleTryAgain = () => {
    navigation.navigate('ShareExtensionInstructions');
  };

  const handleDone = () => {
    // Navigate to Pricing screen (Superwall paywall)
    navigation.navigate('Pricing');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Add Gastrons to the Share Menu</Text>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instruction}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>
              Swipe to the right and press{' '}
              <Text style={styles.instructionHighlight}>... More</Text>
            </Text>
          </View>

          <View style={styles.instruction}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>
              Tap <Text style={styles.instructionHighlight}>Edit</Text> and find Gastrons
            </Text>
          </View>

          <View style={styles.instruction}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>
              Tap the <Text style={styles.instructionHighlight}>⊕</Text> icon and reorder
            </Text>
          </View>
        </View>

        {/* Simulated Share Sheet */}
        <View style={styles.shareSheetContainer}>
          <View style={styles.shareSheet}>
            {/* Share Sheet Header */}
            <View style={styles.shareSheetHeader}>
              <Text style={styles.shareSheetDone}>Done</Text>
              <Text style={styles.shareSheetTitle}>Apps</Text>
            </View>

            {/* Favorites Section */}
            <View style={styles.shareSheetSection}>
              <Text style={styles.shareSheetSectionTitle}>Favorites</Text>
              <View style={styles.shareSheetApps}>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIcon}>
                    <Ionicons name="share-outline" size={24} color="#007AFF" />
                  </View>
                  <Text style={styles.shareSheetAppName}>AirDrop</Text>
                </View>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIcon}>
                    <Ionicons name="chatbubble" size={24} color="#34C759" />
                  </View>
                  <Text style={styles.shareSheetAppName}>Messages</Text>
                </View>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIcon}>
                    <Ionicons name="mail" size={24} color="#007AFF" />
                  </View>
                  <Text style={styles.shareSheetAppName}>Mail</Text>
                </View>
              </View>
            </View>

            {/* Suggestions Section */}
            <View style={styles.shareSheetSection}>
              <Text style={styles.shareSheetSectionTitle}>Suggestions</Text>
              <View style={styles.shareSheetApps}>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIconAdd}>
                    <Ionicons name="add-circle" size={20} color="#34C759" />
                  </View>
                  <View style={[styles.shareSheetAppIcon, { backgroundColor: '#1A1A1A' }]}>
                    <Ionicons name="bookmark" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.shareSheetAppName}>Gastrons</Text>
                  <View style={styles.toggleSwitch}>
                    <View style={styles.toggleSwitchOff} />
                  </View>
                </View>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIconAdd}>
                    <Ionicons name="add-circle" size={20} color="#34C759" />
                  </View>
                  <View style={[styles.shareSheetAppIcon, { backgroundColor: '#CEEC2C' }]}>
                    <Ionicons name="document-text" size={20} color="#000000" />
                  </View>
                  <Text style={styles.shareSheetAppName}>Notes</Text>
                  <View style={styles.toggleSwitch}>
                    <View style={[styles.toggleSwitchOff, styles.toggleSwitchOn]} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.tryAgainButton}
            onPress={handleTryAgain}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.tryAgainButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#1A1A1A" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  instructionsContainer: {
    marginBottom: 32,
  },
  instruction: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  instructionNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  instructionHighlight: {
    fontWeight: '700',
  },
  shareSheetContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  shareSheet: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  shareSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shareSheetDone: {
    fontSize: 17,
    fontWeight: '400',
    color: '#007AFF',
  },
  shareSheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  shareSheetSection: {
    marginBottom: 24,
  },
  shareSheetSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  shareSheetApps: {
    gap: 16,
  },
  shareSheetApp: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  shareSheetAppIconAdd: {
    marginRight: 12,
  },
  shareSheetAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shareSheetAppName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },
  toggleSwitch: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: '#E5E5EA',
    padding: 2,
  },
  toggleSwitchOff: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#FFFFFF',
  },
  toggleSwitchOn: {
    marginLeft: 'auto',
    backgroundColor: '#34C759',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  tryAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A3A3A',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  tryAgainButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default ShareExtensionCompleteScreen;
