import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

type ShareExtensionInstructionsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShareExtensionInstructions'>;

interface ShareExtensionInstructionsScreenProps {
  navigation: ShareExtensionInstructionsScreenNavigationProp;
}

const ShareExtensionInstructionsScreen: React.FC<ShareExtensionInstructionsScreenProps> = ({ navigation }) => {
  const handleContinue = () => {
    navigation.navigate('ShareExtensionComplete');
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
            <View style={styles.instructionContent}>
              <Text style={styles.instructionText}>
                Swipe to the right and press{' '}
                <Text style={styles.instructionHighlight}>... More</Text>
              </Text>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" style={styles.instructionIcon} />
            </View>
          </View>

          <View style={styles.instruction}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionText}>
                Tap <Text style={styles.instructionHighlight}>Edit</Text> and find Gastrons
              </Text>
            </View>
          </View>

          <View style={styles.instruction}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionText}>
                Tap the <Text style={styles.instructionHighlight}>⊕</Text> icon and reorder
              </Text>
              <View style={styles.plusIcon}>
                <Ionicons name="add-circle" size={24} color="#4CAF50" />
              </View>
            </View>
          </View>
        </View>

        {/* Simulated Share Sheet */}
        <View style={styles.shareSheetContainer}>
          <View style={styles.shareSheet}>
            {/* Share Sheet Header */}
            <View style={styles.shareSheetHeader}>
              <Text style={styles.shareSheetDone}>Done</Text>
              <Text style={styles.shareSheetTitle}>Apps</Text>
              <Text style={styles.shareSheetEdit}>Edit</Text>
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
                  <View style={styles.shareSheetAppIconContainer}>
                    <View style={styles.shareSheetAppIconAdd}>
                      <Ionicons name="add-circle" size={20} color="#34C759" />
                    </View>
                    <View style={[styles.shareSheetAppIcon, { backgroundColor: '#1A1A1A' }]}>
                      <Ionicons name="bookmark" size={20} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={styles.shareSheetAppName}>Gastrons</Text>
                </View>
                <View style={styles.shareSheetApp}>
                  <View style={styles.shareSheetAppIconContainer}>
                    <View style={styles.shareSheetAppIconAdd}>
                      <Ionicons name="add-circle" size={20} color="#34C759" />
                    </View>
                    <View style={[styles.shareSheetAppIcon, { backgroundColor: '#CEEC2C' }]}>
                      <Ionicons name="document-text" size={20} color="#000000" />
                    </View>
                  </View>
                  <Text style={styles.shareSheetAppName}>Notes</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color="#1A1A1A" />
          <Text style={styles.actionButtonText}>Setup Share</Text>
        </TouchableOpacity>
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
  instructionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 24,
    flex: 1,
  },
  instructionHighlight: {
    fontWeight: '700',
  },
  instructionIcon: {
    marginLeft: 8,
  },
  plusIcon: {
    marginLeft: 8,
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
  shareSheetEdit: {
    fontSize: 17,
    fontWeight: '400',
    color: '#007AFF',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  shareSheetApp: {
    alignItems: 'center',
    width: 80,
  },
  shareSheetAppIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareSheetAppIconAdd: {
    position: 'absolute',
    left: -8,
    top: -8,
    zIndex: 1,
  },
  shareSheetAppIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSheetAppName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#000000',
    marginTop: 4,
    textAlign: 'center',
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

export default ShareExtensionInstructionsScreen;
