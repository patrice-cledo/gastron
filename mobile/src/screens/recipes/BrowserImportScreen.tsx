import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeProvider';
import { WebView } from 'react-native-webview';
import { ImportProgressModal } from '../../components/ImportProgressModal';
import { functions, db, auth } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// Check if WebView is available
const isWebViewAvailable = WebView !== undefined;

type BrowserImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BrowserImport'>;
type BrowserImportScreenRouteProp = RouteProp<RootStackParamList, 'BrowserImport'>;

const BrowserImportScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BrowserImportScreenNavigationProp>();
  const route = useRoute<BrowserImportScreenRouteProp>();
  
  const [currentUrl, setCurrentUrl] = useState('https://www.allrecipes.com');
  const [urlInput, setUrlInput] = useState('https://www.allrecipes.com');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0); // Force re-render on URL change
  const webViewRef = useRef<any>(null);
  
  // Import limit tracking
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [importsCount, setImportsCount] = useState(0);
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);
  const FREE_IMPORT_LIMIT = 5;

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getDomainFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'this page';
    }
  };

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

  const handleUrlSubmit = () => {
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    if (isValidUrl(url)) {
      setCurrentUrl(url);
      setWebViewKey(prev => prev + 1); // Force WebView to reload with new URL
    } else {
      Alert.alert('Invalid URL', 'Please enter a valid web address');
    }
  };

  const handleGoBack = () => {
    if (webViewRef.current && canGoBack) {
      webViewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webViewRef.current && canGoForward) {
      webViewRef.current.goForward();
    }
  };

  const handleReload = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
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
      
      // If subscribed, refresh import count and allow import
      if (subscribed) {
        console.log('✅ User successfully subscribed');
        // Refresh import count
        const importsQuery = query(
          collection(db, 'imports'),
          where('userId', '==', auth.currentUser?.uid)
        );
        const importsSnapshot = await getDocs(importsQuery);
        setImportsCount(importsSnapshot.size);
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

  const handleImport = async () => {
    if (!isValidUrl(currentUrl)) {
      Alert.alert('Invalid URL', 'Cannot import from this page');
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
                // Proceed with import
                await proceedWithImport();
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
    await proceedWithImport();
  };

  const proceedWithImport = async () => {
    // Show import progress modal
    setShowImportProgress(true);
    
    try {
      // Call Firebase Cloud Function startRecipeImport
      const startRecipeImportFunction = httpsCallable(functions, 'startRecipeImport');
      const result = await startRecipeImportFunction({
        url: currentUrl,
      }) as { data: { importId: string } };

      const newImportId = result.data.importId;
      setImportId(newImportId);
      
      // Update import count after successful import start
      if (!isSubscribed && auth.currentUser) {
        const [importsSnapshot, draftsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'imports'), where('userId', '==', auth.currentUser.uid))),
          getDocs(query(collection(db, 'recipeDrafts'), where('userId', '==', auth.currentUser.uid)))
        ]);
        setImportsCount(importsSnapshot.size + draftsSnapshot.size);
      }

      // Listen to import job status
      const importRef = doc(db, 'imports', newImportId);
      const unsubscribe = onSnapshot(importRef, async (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const importData = snapshot.data();
        const status = importData?.status;

        if (status === 'ready') {
          unsubscribe();
          setShowImportProgress(false);
          
          // Fetch the draft and navigate directly to WriteRecipe
          const draftId = importData?.result?.recipeDraftId;
          if (draftId) {
            try {
              const draftDoc = await getDoc(doc(db, 'recipeDrafts', draftId));
              if (draftDoc.exists()) {
                const draft = draftDoc.data();
                
                // Extract structured data from draft
                const ingredientsArray = (draft.ingredients || []).map((ing: any) => {
                  if (typeof ing === 'string') {
                    return ing;
                  }
                  return ing.raw || `${ing.quantity || ''} ${ing.unit || ''} ${ing.name || ''}`.trim();
                });
                
                const instructionsArray = (draft.instructions || []).map((inst: any) => {
                  if (typeof inst === 'string') {
                    return inst;
                  }
                  return inst.text || inst.description || '';
                });
                
                // Navigate directly to WriteRecipe with structured data
                navigation.navigate('WriteRecipe', {
                  importedData: {
                    ingredients: ingredientsArray.length > 0 ? ingredientsArray : [''],
                    instructions: instructionsArray.length > 0 ? instructionsArray : [''],
                    imageUri: draft.imageUrl || undefined,
                    title: draft.title || undefined,
                    description: draft.description || undefined,
                    notes: draft.notes || undefined,
                    servings: draft.servings || undefined,
                    prepTime: draft.prepMinutes || undefined,
                    cookTime: draft.cookMinutes || undefined,
                    nutrition: draft.nutrition || undefined,
                  },
                });
              } else {
                // Draft not found, fallback to preview screen
                navigation.navigate('RecipeImportPreview', {
                  sourceUrl: currentUrl,
                  importId: newImportId,
                });
              }
            } catch (error) {
              console.error('Error fetching draft:', error);
              // Fallback to preview screen on error
              navigation.navigate('RecipeImportPreview', {
                sourceUrl: currentUrl,
                importId: newImportId,
              });
            }
          } else {
            // No draft ID, fallback to preview screen
            navigation.navigate('RecipeImportPreview', {
              sourceUrl: currentUrl,
              importId: newImportId,
            });
          }
        } else if (status === 'failed') {
          unsubscribe();
          setShowImportProgress(false);
          const errorMessage = importData?.errorMessage || 'Import failed';
          Alert.alert('Import Failed', errorMessage, [
            { text: 'OK' },
            {
              text: 'Try Again',
              onPress: () => handleImport(),
            },
          ]);
        }
        // Status 'queued' or 'extracting' - keep showing progress
      });
    } catch (error: any) {
      console.error('Import error:', error);
      setShowImportProgress(false);
      
      let errorMessage = 'Could not start import. Please try again.';
      if (error?.code === 'unauthenticated') {
        errorMessage = 'Please sign in to import recipes.';
      } else if (error?.code === 'resource-exhausted') {
        errorMessage = error.message || 'Rate limit exceeded. Please try again later.';
      } else if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid URL. Please check the address.';
      }
      
      Alert.alert('Import Failed', errorMessage);
    }
  };

  const handleCancelImport = () => {
    setShowImportProgress(false);
    setImportId(null);
    // Note: The import job will continue processing in the background
    // but the user won't see the result unless they try importing again
  };

  const handleOpenInExternalBrowser = async () => {
    try {
      const canOpen = await Linking.canOpenURL(currentUrl);
      if (canOpen) {
        await Linking.openURL(currentUrl);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open URL');
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(currentUrl);
      Alert.alert('Link copied', 'The URL has been copied to your clipboard');
    } catch (error) {
      console.error('Error copying URL:', error);
      // Fallback if Clipboard is not available
      Alert.alert('Link copied', currentUrl);
    }
  };

  const isRootUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      // Check if pathname is empty or just "/"
      return pathname === '' || pathname === '/';
    } catch {
      return false;
    }
  };

  const isImportEnabled = isValidUrl(currentUrl) && !isRootUrl(currentUrl);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={[]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 4) }]}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {/* URL Input */}
        <View style={styles.urlInputContainer}>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={handleUrlSubmit}
            placeholder="Enter URL or search"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
          />
        </View>

        {/* Reload Button */}
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={handleReload}
          activeOpacity={0.7}
        >
          <Ionicons name="reload" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Menu Button */}
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => {
            Alert.alert(
              'Options',
              '',
              [
                { text: 'Open in External Browser', onPress: handleOpenInExternalBrowser },
                { text: 'Copy Link', onPress: handleCopyLink },
                { text: 'Cancel', style: 'cancel' },
              ],
              { cancelable: true }
            );
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navButtons}>
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={handleGoBack}
          disabled={!canGoBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={canGoBack ? '#1A1A1A' : '#CCCCCC'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={handleGoForward}
          disabled={!canGoForward}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={20} color={canGoForward ? '#1A1A1A' : '#CCCCCC'} />
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={styles.webViewContainer}>
        {!isWebViewAvailable ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF6B35" />
            <Text style={styles.errorText}>WebView not available</Text>
            <Text style={styles.errorSubtext}>
              Please rebuild the app after installing react-native-webview
            </Text>
            <Text style={styles.errorSubtext}>
              Run: npx expo prebuild or rebuild the app
            </Text>
          </View>
        ) : (
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={{ uri: currentUrl }}
            originWhitelist={['*']}
            mixedContentMode="always"
            scalesPageToFit={true}
            bounces={false}
            onNavigationStateChange={(navState) => {
              setCurrentUrl(navState.url);
              setUrlInput(navState.url);
              setCanGoBack(navState.canGoBack);
              setCanGoForward(navState.canGoForward);
              setPageTitle(navState.title || '');
              setIsLoading(navState.loading);
            }}
            onLoadStart={() => {
              setIsLoading(true);
            }}
            onLoadEnd={() => {
              setIsLoading(false);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
              setIsLoading(false);
              Alert.alert(
                'Failed to load page',
                nativeEvent.description || 'An error occurred while loading the page.',
                [
                  { text: 'OK' },
                  {
                    text: 'Open in External Browser',
                    onPress: handleOpenInExternalBrowser,
                  },
                ]
              );
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView HTTP error: ', nativeEvent);
              setIsLoading(false);
            }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsBackForwardNavigationGestures={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            style={styles.webView}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
          />
        )}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </View>

      {/* Bottom Sticky CTA */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[
              styles.importButton,
              !isImportEnabled && styles.importButtonDisabled,
            ]}
            onPress={() => {
              if (!isImportEnabled) {
                Alert.alert('Invalid URL', 'Cannot import from this page');
                return;
              }
              handleImport();
            }}
            activeOpacity={!isImportEnabled ? 1 : 0.7}
          >
            <Text style={[
              styles.importButtonText,
              !isImportEnabled && styles.importButtonTextDisabled,
            ]}>
              {isImportEnabled
                ? `Import from ${getDomainFromUrl(currentUrl)}`
                : 'Import this page'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Import Progress Modal */}
      <ImportProgressModal
        visible={showImportProgress}
        onCancel={handleCancelImport}
        importId={importId || undefined}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  topBarButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  urlInputContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  urlInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1A1A1A',
  },
  navButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  navButton: {
    padding: 8,
    marginRight: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  placeholderSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  currentUrlText: {
    marginTop: 16,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  importButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  importButtonTextDisabled: {
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

export default BrowserImportScreen;
