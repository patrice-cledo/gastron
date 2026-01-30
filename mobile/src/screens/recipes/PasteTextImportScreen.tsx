import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeProvider';
import { ImportProgressModal } from '../../components/ImportProgressModal';
import * as ImagePicker from 'expo-image-picker';
import { functions, db, auth } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { hasActiveSubscription } from '../../services/superwall';
import { BottomSheet } from '../../components/BottomSheet';

// Conditionally import useSuperwall and usePlacement
let useSuperwall: any = null;
let usePlacement: any = null;
try {
  const superwallModule = require('expo-superwall');
  useSuperwall = superwallModule.useSuperwall;
  usePlacement = superwallModule.usePlacement;
} catch (error) {
  console.warn('Superwall not available');
  useSuperwall = () => ({
    user: { subscriptionStatus: 'UNKNOWN' },
  });
  usePlacement = () => ({
    registerPlacement: async () => {},
    state: { status: 'idle' },
  });
}

type PasteTextImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PasteTextImport'>;

const PasteTextImportScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PasteTextImportScreenNavigationProp>();
  
  const [rawText, setRawText] = useState('');
  const [source, setSource] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseJobId, setParseJobId] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  
  // Import limit tracking
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [importsCount, setImportsCount] = useState(0);
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);
  const FREE_IMPORT_LIMIT = 5;

  const MIN_TEXT_LENGTH = 50;
  const canParse = rawText.trim().length >= MIN_TEXT_LENGTH;

  useEffect(() => {
    // Auto-focus text input when screen loads
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  // Check subscription status and count imports
  useEffect(() => {
    const checkSubscriptionAndImportCount = async () => {
      try {
        // Check subscription status
        const subscribed = hasActiveSubscription(superwall);
        setIsSubscribed(subscribed);

        // If not subscribed, count imports and recipe drafts (for text imports)
        if (!subscribed && auth.currentUser) {
          const [importsSnapshot, draftsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser.uid))),
            getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser.uid)))
          ]);
          setImportsCount(importsSnapshot.size + draftsSnapshot.size);
        } else {
          setImportsCount(0);
        }
      } catch (error) {
        console.error('Error checking subscription/import count:', error);
        setIsSubscribed(false);
        setImportsCount(0);
      }
    };

    checkSubscriptionAndImportCount();
    // Re-check periodically
    const interval = setInterval(checkSubscriptionAndImportCount, 5000);
    return () => clearInterval(interval);
  }, [superwall]);

  const handleClear = () => {
    Alert.alert(
      'Clear Text',
      'Are you sure you want to clear all text?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setRawText('');
            setSource('');
          },
        },
      ]
    );
  };

  const handleUpgrade = async () => {
    try {
      setIsLoadingUpgrade(true);
      console.log('🎯 Attempting to present Superwall paywall for placement: trial-offer');
      
      // Show Superwall paywall using registerPlacement
      await placement.registerPlacement({
        placement: 'trial-offer',
      });
      
      console.log('✅ Superwall paywall presentation completed');
      
      // Check if user successfully subscribed after paywall
      const subscribed = hasActiveSubscription(superwall);
      
      // Close the upgrade bottom sheet
      setShowUpgradeBottomSheet(false);
      
      // If subscribed, refresh import count
      if (subscribed) {
        console.log('✅ User successfully subscribed');
        const [importsSnapshot, draftsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser?.uid))),
          getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser?.uid)))
        ]);
        setImportsCount(importsSnapshot.size + draftsSnapshot.size);
      } else {
        console.log('ℹ️ User did not subscribe');
      }
    } catch (error) {
      console.error('❌ Error presenting Superwall paywall:', error);
      setShowUpgradeBottomSheet(false);
    } finally {
      setIsLoadingUpgrade(false);
    }
  };

  const getSubscriptionAndImportCount = async (): Promise<{ subscribed: boolean; count: number }> => {
    try {
      const subscribed = hasActiveSubscription(superwall);
      if (subscribed || !auth.currentUser) {
        return { subscribed, count: 0 };
      }
      const [importsSnapshot, draftsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser!.uid))),
        getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser!.uid)))
      ]);
      return { subscribed: false, count: importsSnapshot.size + draftsSnapshot.size };
    } catch (e) {
      return { subscribed: false, count: 0 };
    }
  };

  const handleParse = async () => {
    if (!canParse) {
      Alert.alert('Text too short', `Please paste at least ${MIN_TEXT_LENGTH} characters of recipe text.`);
      return;
    }

    // Re-check subscription and count at tap time so we don't rely on stale state
    const { subscribed, count } = await getSubscriptionAndImportCount();
    setIsSubscribed(subscribed);
    setImportsCount(count);

    // Check import limit for free users
    if (!subscribed) {
      if (count >= 0 && count < FREE_IMPORT_LIMIT) {
        // Show alert for free users who haven't reached the limit yet
        Alert.alert(
          'Ready to import?',
          `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Yes',
              onPress: async () => {
                // Proceed with parse
                await proceedWithParse();
              },
            },
          ]
        );
        return;
      } else if (count >= FREE_IMPORT_LIMIT) {
        // Show upgrade bottom sheet for free users who have reached the limit
        setShowUpgradeBottomSheet(true);
        return;
      }
    }

    // Subscribed users or fallback: proceed with parse
    await proceedWithParse();
  };

  const proceedWithParse = async () => {
    setIsParsing(true);
    
    try {
      // Call Firebase Cloud Function parseRecipeFromText
      const parseRecipeFromText = httpsCallable(functions, 'parseRecipeFromTextFunction');
      const result = await parseRecipeFromText({
        rawText: rawText.trim(),
        source: source || 'Pasted text',
      }) as { data: { draftId: string; confidence: number; warnings?: string[] } };

      setParseJobId(result.data.draftId);
      setIsParsing(false);
      
      // Update import count after successful parse
      if (!isSubscribed && auth.currentUser) {
        const [importsSnapshot, draftsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser.uid))),
          getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser.uid)))
        ]);
        setImportsCount(importsSnapshot.size + draftsSnapshot.size);
      }
      
      // Navigate to preview screen
      navigation.navigate('RecipeImportPreview', {
        sourceUrl: source || 'Pasted text',
        importId: result.data.draftId,
        rawText: rawText,
      });
    } catch (error: any) {
      console.error('Parse error:', error);
      setIsParsing(false);
      
      let errorMessage = 'Could not parse the recipe. Please try again or check your connection.';
      if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid input. Please check your recipe text.';
      } else if (error?.code === 'unauthenticated') {
        errorMessage = 'Please sign in to import recipes.';
      } else if (error?.code === 'resource-exhausted') {
        errorMessage = error.message || 'Rate limit exceeded. Please try again later.';
      }
      
      Alert.alert(
        'Parsing Failed',
        errorMessage,
        [
          { text: 'OK' },
          {
            text: 'Try Manual Entry',
            onPress: () => {
              navigation.navigate('WriteRecipe');
            },
          },
        ]
      );
    }
  };

  const handleCancelParse = () => {
    setIsParsing(false);
    setParseJobId(null);
    // TODO: Cancel the parsing job if it was started
  };

  const showImagePickerOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleChooseFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Photo',
        '',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Library', onPress: handleChooseFromLibrary },
        ],
        { cancelable: true }
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // TODO: Process image to extract ingredients text using OCR
        // For now, we can navigate to a screen that processes the image
        // or add OCR functionality here
        Alert.alert('Image Captured', 'OCR functionality will be added to extract text from the image.');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // TODO: Process image to extract ingredients text using OCR
        // For now, we can navigate to a screen that processes the image
        // or add OCR functionality here
        Alert.alert('Image Selected', 'OCR functionality will be added to extract text from the image.');
      }
    } catch (error) {
      console.error('Error choosing image:', error);
      Alert.alert('Error', 'Failed to choose image. Please try again.');
    }
  };

  const characterCount = rawText.length;
  const remainingChars = Math.max(0, MIN_TEXT_LENGTH - characterCount);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={[]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paste recipe text</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={showImagePickerOptions}
              style={styles.imageButton}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={24} color="#FF6B35" />
              <Ionicons name="add-circle" size={16} color="#FF6B35" style={styles.addIcon} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Text Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Recipe Text</Text>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              value={rawText}
              onChangeText={setRawText}
              placeholder="Ingredients:
- 2 cups flour
- 1 tsp salt
- 1 tsp sugar

Instructions:
1. Mix dry ingredients
2. Bake at 350°F for 30 minutes"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.characterCountContainer}>
              <Text style={[
                styles.characterCount,
                characterCount < MIN_TEXT_LENGTH && styles.characterCountWarning
              ]}>
                {characterCount < MIN_TEXT_LENGTH
                  ? `${remainingChars} more characters needed`
                  : `${characterCount} characters`}
              </Text>
            </View>
          </View>

          {/* Source Input (Optional) */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Source (optional)</Text>
            <TextInput
              style={styles.sourceInput}
              value={source}
              onChangeText={setSource}
              placeholder="URL or note about where this recipe came from"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Info Message */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.infoText}>
              Paste your recipe text here. We'll automatically detect ingredients and instructions.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.clearButton, !rawText && styles.clearButtonDisabled]}
            onPress={handleClear}
            disabled={!rawText}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.clearButtonText,
              !rawText && styles.clearButtonTextDisabled
            ]}>
              Clear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.parseButton,
              (!canParse || isParsing) && styles.parseButtonDisabled,
            ]}
            onPress={handleParse}
            disabled={!canParse || isParsing}
            activeOpacity={0.7}
          >
            {isParsing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.parseButtonText,
                !canParse && styles.parseButtonTextDisabled,
              ]}>
                Parse Recipe
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Parsing Progress Modal */}
      <ImportProgressModal
        visible={isParsing}
        onCancel={handleCancelParse}
        importId={parseJobId || undefined}
      />

      {/* Upgrade Bottom Sheet */}
      <BottomSheet
        visible={showUpgradeBottomSheet}
        onClose={() => {
          setShowUpgradeBottomSheet(false);
        }}
        height="50%"
      >
        <View style={styles.upgradeBottomSheetContent}>
          {/* Close Button */}
          <View style={styles.upgradeBottomSheetHeader}>
            <View style={styles.upgradeBottomSheetHeaderSpacer} />
            <TouchableOpacity
              style={styles.upgradeBottomSheetCloseButton}
              onPress={() => {
                setShowUpgradeBottomSheet(false);
              }}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Lock Icon */}
          <View style={styles.upgradeIconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color="#1A1A1A" />
          </View>

          {/* Headline */}
          <Text style={styles.upgradeHeadline}>Upgrade to get unlimited access to SousChef</Text>

          {/* Decorative Arrow */}
          <View style={styles.upgradeArrowContainer}>
            <Ionicons name="arrow-down" size={24} color="#1A1A1A" />
          </View>

          {/* Upgrade Button */}
          <View style={[styles.upgradeButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              disabled={isLoadingUpgrade}
              activeOpacity={0.8}
            >
              {isLoadingUpgrade ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                  <Text style={styles.upgradeButtonText}>UPGRADE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageButton: {
    position: 'relative',
    padding: 4,
  },
  addIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  inputSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 300,
    maxHeight: 500,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  characterCountContainer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
  },
  characterCountWarning: {
    color: '#FF6B35',
  },
  sourceInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonDisabled: {
    backgroundColor: '#F5F5F0',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  clearButtonTextDisabled: {
    color: '#999',
  },
  parseButton: {
    flex: 2,
    backgroundColor: '#FF6B35',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parseButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  parseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  parseButtonTextDisabled: {
    color: '#999',
  },
  // Upgrade Bottom Sheet Styles
  upgradeBottomSheetContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  upgradeBottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  upgradeBottomSheetHeaderSpacer: {
    flex: 1,
  },
  upgradeBottomSheetCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  upgradeHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 28,
  },
  upgradeArrowContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  upgradeButtonContainer: {
    paddingTop: 8,
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default PasteTextImportScreen;
