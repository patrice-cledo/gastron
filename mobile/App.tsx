import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
import { SUPERWALL_API_KEYS, identifyUser, resetUser } from './src/services/superwall';

// Conditionally import Superwall - will be null if native module isn't available
let SuperwallProvider: any = null;
let useSuperwall: any = null;

try {
  const superwallModule = require('expo-superwall');
  SuperwallProvider = superwallModule.SuperwallProvider;
  useSuperwall = superwallModule.useSuperwall;
} catch (error) {
  console.warn('⚠️ Superwall native module not available. Make sure you run: npx expo run:ios');
  // Create a no-op provider for development
  SuperwallProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  useSuperwall = () => {
    console.warn('Superwall not available - using mock');
    return {
      identify: async () => {},
      reset: async () => {},
      user: { subscriptionStatus: 'UNKNOWN' },
      openSubscriptionManagement: async () => {},
    };
  };
}

import { RootStackParamList } from './src/types/navigation';
import { navigationRef } from './src/navigation/navigationRef';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { ModalProvider } from './src/context/ModalContext';
// Initialize Firebase (connects to emulators in dev)
import './src/services/firebase';
import { ImportModal } from './src/components/ImportModal';
import { ImportProgressModal } from './src/components/ImportProgressModal';
import { usePhotoImportStore } from './src/stores/photoImportStore';
import { TabNavigator } from './src/navigation/TabNavigator';
// Onboarding screens
import WelcomeScreen from './src/screens/onboarding/WelcomeScreen';
import GetStartedScreen from './src/screens/onboarding/GetStartedScreen';
import DietaryPreferencesScreen from './src/screens/onboarding/DietaryPreferencesScreen';
import ServingsScreen from './src/screens/onboarding/ServingsScreen';
import CuisinesScreen from './src/screens/onboarding/CuisinesScreen';
import RecipeSourcesScreen from './src/screens/onboarding/RecipeSourcesScreen';
import IngredientsScreen from './src/screens/onboarding/IngredientsScreen';
import HelpNeededScreen from './src/screens/onboarding/HelpNeededScreen';
import OtherHelpScreen from './src/screens/onboarding/OtherHelpScreen';
import FeaturedRecipesScreen from './src/screens/onboarding/FeaturedRecipesScreen';
import SignUpScreen from './src/screens/onboarding/SignUpScreen';
import EmailSignUpScreen from './src/screens/onboarding/EmailSignUpScreen';
import LoginScreen from './src/screens/onboarding/LoginScreen';
import EmailLoginScreen from './src/screens/onboarding/EmailLoginScreen';
import CodeVerificationScreen from './src/screens/onboarding/CodeVerificationScreen';
import NotificationIntroScreen from './src/screens/onboarding/NotificationIntroScreen';
import NotificationPermissionScreen from './src/screens/onboarding/NotificationPermissionScreen';
import CreateCollectionIntroScreen from './src/screens/onboarding/CreateCollectionIntroScreen';
import CreateCollectionFormScreen from './src/screens/onboarding/CreateCollectionFormScreen';
import CollectionCreatedScreen from './src/screens/onboarding/CollectionCreatedScreen';
import ShareExtensionIntroScreen from './src/screens/onboarding/ShareExtensionIntroScreen';
import ShareExtensionInstructionsScreen from './src/screens/onboarding/ShareExtensionInstructionsScreen';
import ShareExtensionCompleteScreen from './src/screens/onboarding/ShareExtensionCompleteScreen';
import PricingScreen from './src/screens/onboarding/PricingScreen';

// Recipe screens
import RecipeDetailScreen from './src/screens/recipes/RecipeDetailScreen';
import CookModeScreen from './src/screens/recipes/CookModeScreen';
import BrowserImportScreen from './src/screens/recipes/BrowserImportScreen';
import PasteTextImportScreen from './src/screens/recipes/PasteTextImportScreen';
import PhotoImportScreen from './src/screens/recipes/PhotoImportScreen';
import RecipeImportPreviewScreen from './src/screens/recipes/RecipeImportPreviewScreen';
import WriteRecipeScreen from './src/screens/recipes/WriteRecipeScreen';
import RecipeInfoScreen from './src/screens/recipes/RecipeInfoScreen';
import RecipeNutritionScreen from './src/screens/recipes/RecipeNutritionScreen';
import RateAndReviewScreen from './src/screens/recipes/RateAndReviewScreen';
import InspirationScreen from './src/screens/recipes/InspirationScreen';
import StarterRecipesScreen from './src/screens/recipes/StarterRecipesScreen';
import TrendingRecipesScreen from './src/screens/recipes/TrendingRecipesScreen';
import SearchScreen from './src/screens/recipes/SearchScreen';
import IngredientSearchScreen from './src/screens/recipes/IngredientSearchScreen';

// Main screens
import ChooseRecipesScreen from './src/screens/main/ChooseRecipesScreen';
import IngredientSelectionScreen from './src/screens/main/IngredientSelectionScreen';
import MenuScreen from './src/screens/main/MenuScreen';
import WantToCookScreen from './src/screens/main/WantToCookScreen';
import SettingsScreen from './src/screens/main/SettingsScreen';
import ProfileScreen from './src/screens/main/ProfileScreen';
import IntolerancesScreen from './src/screens/main/IntolerancesScreen';
import FavouriteCuisinesScreen from './src/screens/main/FavouriteCuisinesScreen';
import DislikesAllergiesScreen from './src/screens/main/DislikesAllergiesScreen';
import ManageSubscriptionScreen from './src/screens/main/ManageSubscriptionScreen';
import DeleteAccountScreen from './src/screens/main/DeleteAccountScreen';
import NotificationsScreen from './src/screens/main/NotificationsScreen';
import ChallengesScreen from './src/screens/main/ChallengesScreen';
import ChallengeDetailScreen from './src/screens/main/ChallengeDetailScreen';
import AddShoppingItemScreen from './src/screens/main/AddShoppingItemScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Inner component that can use Superwall hooks
function AppContent() {
  const photoImportStatus = usePhotoImportStore((state) => state.status);
  const photoImportProgress = usePhotoImportStore((state) => state.uploadProgress);
  const currentImportId = usePhotoImportStore((state) => state.currentImportId);
  const cancelImport = usePhotoImportStore((state) => state.cancelImport);
  const reset = usePhotoImportStore((state) => state.reset);
  
  const isProcessing = photoImportStatus === 'uploading' || 
                       photoImportStatus === 'queued' || 
                       photoImportStatus === 'ocr' || 
                       photoImportStatus === 'extracting' || 
                       photoImportStatus === 'ready' || 
                       photoImportStatus === 'failed';

  // Auth state management
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasInitialAuthCheck, setHasInitialAuthCheck] = useState(false);
  
  // Only call useSuperwall hook if it's available (will be called inside provider when available)
  let superwall: any = null;
  try {
    if (useSuperwall) {
      superwall = useSuperwall();
    }
  } catch (error) {
    // Hook called outside provider - use mock
    console.warn('Superwall hook called outside provider, using mock');
    superwall = {
      identify: async () => {},
      reset: async () => {},
      user: { subscriptionStatus: 'UNKNOWN' },
      openSubscriptionManagement: async () => {},
    };
  }

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? `User logged in: ${user.email}` : 'User logged out');
      const authenticated = !!user;
      setIsAuthenticated(authenticated);
      
      // Sync Superwall user identification (if available)
      if (superwall) {
        if (authenticated && user?.uid) {
          await identifyUser(superwall, user.uid);
        } else {
          await resetUser(superwall);
        }
      }
      
      // Mark initial auth check as complete
      if (!hasInitialAuthCheck) {
        setHasInitialAuthCheck(true);
        setIsAuthReady(true);
      } else {
        // Only handle navigation on logout. Never navigate on login.
        // CodeVerification owns post–sign-in navigation (Pricing for signup, Home for login).
        // Navigating here on login was racing with CodeVerification and sending users to Home.
        if (!authenticated && navigationRef.current?.isReady()) {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            })
          );
        }
      }
    });

    return () => unsubscribe();
  }, [hasInitialAuthCheck]);

  // Show loading screen while checking auth state
  if (!isAuthReady) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
          <ThemeProvider>
            <ModalProvider>
                  <NavigationContainer ref={navigationRef}>
                  <Stack.Navigator
                    initialRouteName={isAuthenticated ? "Home" : "Welcome"}
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: '#1A1A1A' },
                    }}
                  >
                <Stack.Screen 
                  name="Welcome" 
                  component={WelcomeScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="GetStarted" 
                  component={GetStartedScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFD700' },
                  }}
                />
                <Stack.Screen 
                  name="DietaryPreferences" 
                  component={DietaryPreferencesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Servings" 
                  component={ServingsScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Cuisines" 
                  component={CuisinesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="RecipeSources" 
                  component={RecipeSourcesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Ingredients" 
                  component={IngredientsScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="HelpNeeded" 
                  component={HelpNeededScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="OtherHelp" 
                  component={OtherHelpScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="FeaturedRecipes" 
                  component={FeaturedRecipesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="SignUp" 
                  component={SignUpScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="EmailSignUp" 
                  component={EmailSignUpScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Login" 
                  component={LoginScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="EmailLogin" 
                  component={EmailLoginScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="CodeVerification" 
                  component={CodeVerificationScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                {/* Post-signup onboarding flow */}
                <Stack.Screen 
                  name="NotificationIntro" 
                  component={NotificationIntroScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="NotificationPermission" 
                  component={NotificationPermissionScreen}
                  options={{
                    contentStyle: { backgroundColor: '#000000' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="CreateCollectionIntro" 
                  component={CreateCollectionIntroScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="CreateCollectionForm" 
                  component={CreateCollectionFormScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="CollectionCreated" 
                  component={CollectionCreatedScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="ShareExtensionIntro" 
                  component={ShareExtensionIntroScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="ShareExtensionInstructions" 
                  component={ShareExtensionInstructionsScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="ShareExtensionComplete" 
                  component={ShareExtensionCompleteScreen}
                  options={{
                    contentStyle: { backgroundColor: '#1A1A1A' },
                    headerShown: false,
                  }}
                />
                <Stack.Screen 
                  name="Pricing" 
                  component={PricingScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="Home" 
                  component={TabNavigator}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="RecipeDetail" 
                  component={RecipeDetailScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="CookMode" 
                  component={CookModeScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="RateAndReview" 
                  component={RateAndReviewScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen 
                  name="Inspiration" 
                  component={InspirationScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFF9C4' },
                  }}
                />
                <Stack.Screen 
                  name="BrowserImport" 
                  component={BrowserImportScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="PasteTextImport" 
                  component={PasteTextImportScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="PhotoImport" 
                  component={PhotoImportScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="RecipeImportPreview" 
                  component={RecipeImportPreviewScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="WriteRecipe" 
                  component={WriteRecipeScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="RecipeInfo" 
                  component={RecipeInfoScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="RecipeNutrition" 
                  component={RecipeNutritionScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="StarterRecipes" 
                  component={StarterRecipesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#F5F5F0' },
                  }}
                />
                <Stack.Screen 
                  name="ChooseRecipes" 
                  component={ChooseRecipesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="IngredientSelection" 
                  component={IngredientSelectionScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Menu" 
                  component={MenuScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="WantToCook" 
                  component={WantToCookScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Settings" 
                  component={SettingsScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Explore" 
                  component={TrendingRecipesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Search" 
                  component={SearchScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Profile" 
                  component={ProfileScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Intolerances" 
                  component={IntolerancesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="FavouriteCuisines" 
                  component={FavouriteCuisinesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="DislikesAllergies" 
                  component={DislikesAllergiesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="ManageSubscription" 
                  component={ManageSubscriptionScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="DeleteAccount" 
                  component={DeleteAccountScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="IngredientSearch" 
                  component={IngredientSearchScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Notifications" 
                  component={NotificationsScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="Challenges" 
                  component={ChallengesScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                <Stack.Screen 
                  name="ChallengeDetail" 
                  component={ChallengeDetailScreen}
                  options={{
                    contentStyle: { backgroundColor: '#B8E6D3' },
                  }}
                />
                <Stack.Screen 
                  name="AddShoppingItem" 
                  component={AddShoppingItemScreen}
                  options={{
                    contentStyle: { backgroundColor: '#FFFFFF' },
                  }}
                />
                  </Stack.Navigator>
                </NavigationContainer>
                <ImportModal />
                <ImportProgressModal
                  visible={isProcessing}
                  onCancel={() => {
                    if (photoImportStatus === 'uploading' || photoImportStatus === 'queued' || photoImportStatus === 'ocr' || photoImportStatus === 'extracting') {
                      cancelImport();
                      reset();
                    } else {
                      cancelImport();
                      reset();
                    }
                  }}
                  importId={currentImportId || undefined}
                  status={photoImportStatus}
                  uploadProgress={photoImportProgress}
                />
                <StatusBar style="dark" />
              </ModalProvider>
        </ThemeProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  // Always wrap with SuperwallProvider if available, even with empty keys
  // This ensures the hook context is available
  if (SuperwallProvider) {
    return (
      <SuperwallProvider
        apiKeys={SUPERWALL_API_KEYS.ios && SUPERWALL_API_KEYS.android ? SUPERWALL_API_KEYS : { ios: '', android: '' }}
        options={{
          shouldObservePurchases: true,
          maxConfigRetryCount: 4,
          useMockReviews: __DEV__,
        }}
      >
        <AppContent />
      </SuperwallProvider>
    );
  }
  
  // Fallback: render app without Superwall (for development/testing)
  console.warn('⚠️ Running without Superwall. To enable: npx expo run:ios');
  return <AppContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

