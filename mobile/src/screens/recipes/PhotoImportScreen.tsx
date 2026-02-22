import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usePhotoImportStore } from '../../stores/photoImportStore';
import { ImportProgressModal } from '../../components/ImportProgressModal';
import { navigationRef } from '../../navigation/navigationRef';
import { db, auth } from '../../services/firebase';
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
    registerPlacement: async () => { },
    state: { status: 'idle' },
  });
}

type PhotoImportScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PhotoImport'
>;

const PhotoImportScreen: React.FC<PhotoImportScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const {
    status,
    uploadProgress,
    error,
    startPhotoImport,
    cancelImport,
    reset,
    currentImportId
  } = usePhotoImportStore();

  // Import limit tracking
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [importsCount, setImportsCount] = useState(0);
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);
  const FREE_IMPORT_LIMIT = 5;

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

  // Navigate to preview when import is ready
  useEffect(() => {
    if (status !== 'ready' || !currentImportId) return;

    const run = async () => {
      // Get the recipe draft ID from Firestore
      // For now, navigate to preview with importId - it will fetch the draft
      navigation.replace('RecipeImportPreview', {
        importId: currentImportId,
        sourceUrl: undefined,
        rawText: undefined,
      });
      reset();

      // Update import count after successful import
      if (!isSubscribed && auth.currentUser) {
        const [importsSnapshot, draftsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser.uid))),
          getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser.uid)))
        ]);
        setImportsCount(importsSnapshot.size + draftsSnapshot.size);
      }
    };

    run();
  }, [status, currentImportId, navigation, reset, isSubscribed]);

  // Show error alert
  useEffect(() => {
    if (status === 'failed' && error) {
      Alert.alert(
        'Import Failed',
        error,
        [
          { text: 'OK', onPress: () => reset() },
          {
            text: 'Try Again',
            onPress: () => {
              reset();
              if (selectedImage) {
                startPhotoImport(selectedImage);
              }
            }
          },
        ]
      );
    }
  }, [status, error, reset, selectedImage, startPhotoImport]);

  const handleTakePhoto = async () => {
    try {
      const { status: permissionStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85, // Compress for upload
        aspect: [3, 4], // Vertical/portrait frame
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status: permissionStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85, // Compress for upload
        aspect: [3, 4], // Vertical/portrait frame
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error choosing image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
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

  const handleStartImport = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first.');
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
              onPress: () => {
                startPhotoImport(selectedImage);
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

    // Subscribed users or fallback: proceed with import
    startPhotoImport(selectedImage);
  };

  const handleCancel = () => {
    if (status === 'uploading' || status === 'queued' || status === 'ocr' || status === 'extracting') {
      Alert.alert(
        'Cancel Import?',
        'Are you sure you want to cancel this import?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              cancelImport();
              reset();
              setSelectedImage(null);
            }
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isProcessing = status === 'uploading' || status === 'queued' || status === 'ocr' || status === 'extracting';
  const showProgressModal = isProcessing || status === 'ready' || status === 'failed';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import from Photo</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {!selectedImage ? (
          <View style={styles.placeholderContainer}>
            <Ionicons name="camera-outline" size={64} color="#999" />
            <Text style={styles.placeholderText}>
              Select a photo or screenshot of a recipe
            </Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: theme.colors.accent }]}
              onPress={showImagePickerOptions}
              activeOpacity={0.7}
            >
              <Text style={styles.selectButtonText}>Select Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />

            {!isProcessing && (
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={showImagePickerOptions}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal-outline" size={20} color="#1A1A1A" />
                  <Text style={styles.changeButtonText}>Change Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.importButton, { backgroundColor: theme.colors.accent }]}
                  onPress={handleStartImport}
                  activeOpacity={0.7}
                >
                  <Text style={styles.importButtonText}>Start Import</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'uploading' && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.progressText}>
                  Uploading... {Math.round(uploadProgress)}%
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Progress Modal */}
      <ImportProgressModal
        visible={showProgressModal}
        onCancel={handleCancel}
        importId={currentImportId || undefined}
        status={status}
        uploadProgress={uploadProgress}
      />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 40,
  },
  selectButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageContainer: {
    flex: 1,
    gap: 20,
  },
  previewImage: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#F5F5F0',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  changeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F0',
    borderRadius: 24,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  importButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
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

export default PhotoImportScreen;
