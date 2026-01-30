import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useModal } from '../context/ModalContext';
import { navigationRef } from '../navigation/navigationRef';
import { usePhotoImportStore } from '../stores/photoImportStore';
import { ImportProgressModal } from './ImportProgressModal';
import { BottomSheet } from './BottomSheet';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { hasActiveSubscription } from '../services/superwall';

let useSuperwall: any = null;
let usePlacement: any = null;
try {
  const superwallModule = require('expo-superwall');
  useSuperwall = superwallModule.useSuperwall;
  usePlacement = superwallModule.usePlacement;
} catch {
  useSuperwall = () => ({ user: { subscriptionStatus: 'UNKNOWN' } });
  usePlacement = () => ({ registerPlacement: async () => {}, state: { status: 'idle' } });
}

const FREE_IMPORT_LIMIT = 5;

export const ImportModal: React.FC = () => {
  const { isImportModalVisible, hideImportModal } = useModal();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(300)).current;
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);
  const { 
    status, 
    uploadProgress, 
    startPhotoImport, 
    cancelImport, 
    reset,
    currentImportId 
  } = usePhotoImportStore();

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
    } catch {
      return { subscribed: false, count: 0 };
    }
  };

  const handleUpgrade = async () => {
    try {
      setIsLoadingUpgrade(true);
      await placement.registerPlacement({ placement: 'trial-offer' });
      const subscribed = hasActiveSubscription(superwall);
      setShowUpgradeBottomSheet(false);
      if (subscribed && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('WriteRecipe');
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
      setShowUpgradeBottomSheet(false);
    } finally {
      setIsLoadingUpgrade(false);
    }
  };

  React.useEffect(() => {
    if (isImportModalVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isImportModalVisible, slideAnim]);

  const showCameraOptions = () => {
    hideImportModal();
    // Wait for modal to close before showing ActionSheet
    setTimeout(() => {
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
    }, 300);
  };

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
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const { subscribed, count } = await getSubscriptionAndImportCount();
        hideImportModal();
        if (!subscribed && count >= FREE_IMPORT_LIMIT) {
          setShowUpgradeBottomSheet(true);
          return;
        }
        if (!subscribed && count < FREE_IMPORT_LIMIT) {
          Alert.alert(
            'Ready to import?',
            `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Yes', onPress: () => startPhotoImport(imageUri) },
            ]
          );
          return;
        }
        startPhotoImport(imageUri);
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
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const { subscribed, count } = await getSubscriptionAndImportCount();
        hideImportModal();
        if (!subscribed && count >= FREE_IMPORT_LIMIT) {
          setShowUpgradeBottomSheet(true);
          return;
        }
        if (!subscribed && count < FREE_IMPORT_LIMIT) {
          Alert.alert(
            'Ready to import?',
            `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Yes', onPress: () => startPhotoImport(imageUri) },
            ]
          );
          return;
        }
        startPhotoImport(imageUri);
      }
    } catch (error) {
      console.error('Error choosing image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Navigate to preview when import is ready
  useEffect(() => {
    if (status === 'ready' && currentImportId) {
      // Get the recipe draft ID from Firestore
      // Navigate to preview with importId - it will fetch the draft
      if (navigationRef.current?.isReady()) {
        navigationRef.current.navigate('RecipeImportPreview', {
          importId: currentImportId,
          sourceUrl: undefined,
          rawText: undefined,
        });
      }
      reset();
    }
  }, [status, currentImportId, reset]);

  // Show error alert
  useEffect(() => {
    if (status === 'failed') {
      const error = usePhotoImportStore.getState().error;
      if (error) {
        Alert.alert(
          'Import Failed',
          error,
          [
            { text: 'OK', onPress: () => reset() },
          ]
        );
      }
    }
  }, [status, reset]);

  const handleOptionPress = (option: 'browser' | 'camera' | 'paste' | 'scratch') => {
    if (option === 'camera') {
      showCameraOptions();
    } else if (option === 'scratch') {
      hideImportModal();
      setTimeout(async () => {
        const { subscribed, count } = await getSubscriptionAndImportCount();
        if (!subscribed && count >= FREE_IMPORT_LIMIT) {
          setShowUpgradeBottomSheet(true);
          return;
        }
        if (!subscribed && count < FREE_IMPORT_LIMIT) {
          Alert.alert(
            'Ready to create?',
            `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes',
                onPress: () => {
                  if (navigationRef.current?.isReady()) {
                    navigationRef.current.navigate('WriteRecipe');
                  }
                },
              },
            ]
          );
          return;
        }
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('WriteRecipe');
        }
      }, 300);
    } else if (option === 'browser') {
      hideImportModal();
      setTimeout(async () => {
        const { subscribed, count } = await getSubscriptionAndImportCount();
        if (!subscribed && count >= FREE_IMPORT_LIMIT) {
          setShowUpgradeBottomSheet(true);
          return;
        }
        if (!subscribed && count < FREE_IMPORT_LIMIT) {
          Alert.alert(
            'Ready to import?',
            `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes',
                onPress: () => {
                  if (navigationRef.current?.isReady()) {
                    navigationRef.current.navigate('BrowserImport');
                  }
                },
              },
            ]
          );
          return;
        }
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('BrowserImport');
        }
      }, 300);
    } else if (option === 'paste') {
      hideImportModal();
      setTimeout(async () => {
        const { subscribed, count } = await getSubscriptionAndImportCount();
        if (!subscribed && count >= FREE_IMPORT_LIMIT) {
          setShowUpgradeBottomSheet(true);
          return;
        }
        if (!subscribed && count < FREE_IMPORT_LIMIT) {
          Alert.alert(
            'Ready to import?',
            `You can only import ${FREE_IMPORT_LIMIT} recipes before starting a free trial, so make it count!`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes',
                onPress: () => {
                  if (navigationRef.current?.isReady()) {
                    navigationRef.current.navigate('PasteTextImport');
                  }
                },
              },
            ]
          );
          return;
        }
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('PasteTextImport');
        }
      }, 300);
    } else {
      hideImportModal();
    }
  };

  if (!isImportModalVisible && !showUpgradeBottomSheet) {
    return null;
  }

  return (
    <>
    {isImportModalVisible && (
    <Modal
      visible={isImportModalVisible}
      transparent
      animationType="none"
      onRequestClose={hideImportModal}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={hideImportModal}
        />
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 24),
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
              <View style={styles.handle} />
              
              <View style={styles.header}>
                <Text style={styles.title}>Import recipe</Text>
                <TouchableOpacity onPress={hideImportModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsContainer}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionPress('browser')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIconContainer}>
                      <Ionicons name="globe-outline" size={24} color="#1A1A1A" />
                    </View>
                    <Text style={styles.optionText}>Browser</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionPress('camera')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIconContainer}>
                      <Ionicons name="camera-outline" size={24} color="#1A1A1A" />
                    </View>
                    <Text style={styles.optionText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => handleOptionPress('paste')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIconContainer}>
                      <Ionicons name="clipboard-outline" size={24} color="#1A1A1A" />
                    </View>
                    <Text style={styles.optionText}>Paste Text</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.separator}>
                  <Text style={styles.separatorText}>or</Text>
                </View>

                <TouchableOpacity
                  style={styles.scratchButton}
                  onPress={() => handleOptionPress('scratch')}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="create-outline" size={24} color="#1A1A1A" />
                  </View>
                  <Text style={styles.optionText}>Write from scratch</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
        
        {/* Photo Import Progress Modal */}
        <ImportProgressModal
          visible={status === 'uploading' || status === 'queued' || status === 'ocr' || status === 'extracting' || status === 'ready' || status === 'failed'}
          onCancel={() => {
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
                    }
                  },
                ]
              );
            } else {
              cancelImport();
              reset();
            }
          }}
          importId={currentImportId || undefined}
          status={status}
          uploadProgress={uploadProgress}
        />
    </Modal>
    )}

    {/* Upgrade Bottom Sheet (e.g. when limit reached from Camera or From scratch) */}
    {showUpgradeBottomSheet && (
      <BottomSheet
        visible={showUpgradeBottomSheet}
        onClose={() => setShowUpgradeBottomSheet(false)}
        height="50%"
      >
        <View style={styles.upgradeBottomSheetContent}>
          <View style={styles.upgradeBottomSheetHeader}>
            <View style={styles.upgradeBottomSheetHeaderSpacer} />
            <TouchableOpacity
              style={styles.upgradeBottomSheetCloseButton}
              onPress={() => setShowUpgradeBottomSheet(false)}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <View style={styles.upgradeIconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color="#1A1A1A" />
          </View>
          <Text style={styles.upgradeHeadline}>Upgrade to get unlimited access to SousChef</Text>
          <View style={styles.upgradeArrowContainer}>
            <Ionicons name="arrow-down" size={24} color="#1A1A1A" />
          </View>
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
    )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D0D0D0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  optionIconContainer: {
    marginBottom: 6,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  separator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  separatorText: {
    fontSize: 14,
    color: '#999',
  },
  scratchButton: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
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
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

