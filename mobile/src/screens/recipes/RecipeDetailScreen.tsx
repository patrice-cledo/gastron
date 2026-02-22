import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RootStackParamList } from '../../types/navigation';
import { Recipe } from '../../types/recipe';
import { starterRecipes } from '../../data/starterRecipes';
import { sampleRecipeExtended, ExtendedRecipe } from '../../data/sampleRecipe';
import { useRecipesStore } from '../../stores/recipesStore';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { GrocerySource } from '../../types/grocery';
import { BottomSheet } from '../../components/BottomSheet';
import { Toast } from '../../components/Toast';
import { db, auth, functions } from '../../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { hasActiveSubscription } from '../../services/superwall';

// Conditionally import usePlacement
let usePlacement: any = null;
try {
  const superwallModule = require('expo-superwall');
  usePlacement = superwallModule.usePlacement;
} catch (error) {
  console.warn('Superwall not available');
  usePlacement = () => ({
    registerPlacement: async () => { },
    state: { status: 'idle' },
  });
}

// Conditionally import useSuperwall
let useSuperwall: any = null;
try {
  const superwallModule = require('expo-superwall');
  useSuperwall = superwallModule.useSuperwall;
} catch (error) {
  console.warn('Superwall not available');
  useSuperwall = () => ({
    user: { subscriptionStatus: 'UNKNOWN' },
  });
}

type RecipeDetailScreenRouteProp = RouteProp<RootStackParamList, 'RecipeDetail'>;
type RecipeDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RecipeDetail'
>;

// Convert Firestore UserRecipe to client ExtendedRecipe format
const convertUserRecipeToExtended = (userRecipe: any): ExtendedRecipe => {
  // Sort steps by order to ensure they're displayed correctly
  const sortedSteps = (userRecipe.steps || [])
    .map((step: any) => ({
      id: step.id,
      order: step.order || 0,
      description: step.description || '',
      duration: step.duration,
      image: step.image,
    }))
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  // Convert equipment to ExtendedRecipeEquipment format (with images)
  const equipment = userRecipe.equipment
    ? (userRecipe.equipment || []).map((eq: any) => {
      // If it's already a string (legacy format), convert to object
      if (typeof eq === 'string') {
        return { name: eq };
      }
      // If it's an object, preserve id, name, and image
      return {
        id: eq.id,
        name: eq.name || eq,
        image: eq.image,
      };
    })
    : undefined;

  return {
    id: userRecipe.id,
    title: userRecipe.title,
    description: userRecipe.description,
    image: userRecipe.image,
    ingredients: (userRecipe.ingredients || []).map((ing: any) => ({
      id: ing.id,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
    })),
    steps: sortedSteps,
    prepTime: userRecipe.prepTime,
    cookTime: userRecipe.cookTime,
    servings: userRecipe.servings,
    nutrition: userRecipe.nutrition,
    notes: userRecipe.notes,
    userId: userRecipe.userId,
    createdAt: userRecipe.createdAt
      ? (typeof userRecipe.createdAt === 'number'
        ? new Date(userRecipe.createdAt).toISOString()
        : userRecipe.createdAt)
      : new Date().toISOString(),
    updatedAt: userRecipe.updatedAt
      ? (typeof userRecipe.updatedAt === 'number'
        ? new Date(userRecipe.updatedAt).toISOString()
        : userRecipe.updatedAt)
      : new Date().toISOString(),
    tags: Array.isArray(userRecipe.tags) ? userRecipe.tags.filter((tag: any) => tag && typeof tag === 'string' && tag.trim().length > 0) : [],
    category: userRecipe.cuisine || undefined,
    rating: 4.4, // Default rating (can be fetched separately later)
    reviewCount: 0, // Default review count
    equipment: equipment,
    // Preserve recipePack if it exists (only show if recipe is part of a pack)
    recipePack: userRecipe.recipePack && userRecipe.recipePack.id && userRecipe.recipePack.name
      ? {
        id: userRecipe.recipePack.id,
        name: userRecipe.recipePack.name,
        description: userRecipe.recipePack.description,
      }
      : undefined,
  };
};

// Get step icon based on description
const getStepIcon = (description: string): keyof typeof Ionicons.glyphMap => {
  const descLower = description.toLowerCase();
  if (descLower.includes('preheat') || descLower.includes('oven') || descLower.includes('heat')) {
    return 'flame-outline';
  }
  if (descLower.includes('arrange') || descLower.includes('place') || descLower.includes('put')) {
    return 'grid-outline';
  }
  if (descLower.includes('drizzle') || descLower.includes('pour') || descLower.includes('add')) {
    return 'water-outline';
  }
  if (descLower.includes('bake') || descLower.includes('cook') || descLower.includes('roast')) {
    return 'time-outline';
  }
  if (descLower.includes('mix') || descLower.includes('stir') || descLower.includes('combine')) {
    return 'sync-outline';
  }
  if (descLower.includes('chop') || descLower.includes('cut') || descLower.includes('slice')) {
    return 'cut-outline';
  }
  return 'restaurant-outline';
};

const RecipeDetailScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RecipeDetailScreenNavigationProp>();
  const route = useRoute<RecipeDetailScreenRouteProp>();
  const { recipeId, autoOpenMenu } = route.params;
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Auto-open recipe options if requested
  useEffect(() => {
    if (autoOpenMenu) {
      // Small delay to ensure the screen has transitioned smoothly before opening bottom sheet
      const timer = setTimeout(() => {
        setShowRecipeOptionsBottomSheet(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoOpenMenu]);
  const [servings, setServings] = useState(2);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'equipment' | 'info'>('ingredients');
  const [showMethodBottomSheet, setShowMethodBottomSheet] = useState(false);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const [selectedIngredientImage, setSelectedIngredientImage] = useState<string | null>(null);
  const [chefTipsExpanded, setChefTipsExpanded] = useState(false);
  const [showPrivateNotesModal, setShowPrivateNotesModal] = useState(false);
  const [privateNotes, setPrivateNotes] = useState('');
  const [nutritionCalculated, setNutritionCalculated] = useState(false);
  const [showRecipePackInfo, setShowRecipePackInfo] = useState(false);
  const [showFullRecipeBottomSheet, setShowFullRecipeBottomSheet] = useState(false);
  const [showAddToMenuModal, setShowAddToMenuModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week, etc.
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  const [showCollectionSelection, setShowCollectionSelection] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeTimerStepId, setActiveTimerStepId] = useState<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);
  const [pendingActionFromUpgrade, setPendingActionFromUpgrade] = useState<'cookMode' | 'instructions' | null>(null);
  const { recipes, updateRecipe } = useRecipesStore();
  const { showNutrition } = useUserPreferencesStore();
  const { mealPlans, addMealPlan } = useMealPlanStore();
  const { addItems } = useGroceriesStore();
  const { collections, addCollection, loadCollections } = useCollectionsStore();

  // Superwall subscription check
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [cookedRecipesCount, setCookedRecipesCount] = useState(0);
  const FREE_RECIPE_LIMIT = 1;

  // Check if recipe is in meal plan
  const isInMealPlan = mealPlans.some(plan => plan.recipeId === recipeId);

  // Recipe loading state
  const [recipe, setRecipe] = useState<ExtendedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Check subscription status and count cooked recipes
  useEffect(() => {
    const checkSubscriptionAndCookedCount = async () => {
      try {
        // Check subscription status
        const subscribed = hasActiveSubscription(superwall);
        setIsSubscribed(subscribed);

        // If not subscribed, count cooked recipes
        if (!subscribed && currentUserId) {
          const cookedQuery = query(
            collection(db, 'userCookedRecipes'),
            where('userId', '==', currentUserId)
          );
          const cookedSnapshot = await getDocs(cookedQuery);
          setCookedRecipesCount(cookedSnapshot.size);
        } else {
          setCookedRecipesCount(0);
        }
      } catch (error) {
        console.error('Error checking subscription/cooked count:', error);
        // Default to allowing if check fails
        setIsSubscribed(false);
        setCookedRecipesCount(0);
      }
    };

    checkSubscriptionAndCookedCount();
    // Re-check periodically
    const interval = setInterval(checkSubscriptionAndCookedCount, 5000);
    return () => clearInterval(interval);
  }, [superwall, currentUserId]);

  // Load collections when screen mounts
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Check if current user owns this recipe
  const isRecipeOwner = recipe && currentUserId && recipe.userId === currentUserId;

  // Load recipe from Firestore or local store
  // Track if we've already attempted to fetch from Firestore for tags
  const hasFetchedForTagsRef = useRef<string | null>(null);

  // Reset the ref when recipeId changes
  useEffect(() => {
    hasFetchedForTagsRef.current = null;
  }, [recipeId]);

  useEffect(() => {
    const loadRecipe = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Check starter recipes first
        const starterRecipe = starterRecipes.find((r) => r.id === recipeId);
        if (starterRecipe) {
          setRecipe({ ...starterRecipe, tags: [], category: 'Meat', rating: 4.4, reviewCount: 0, chefTips: undefined } as unknown as ExtendedRecipe);
          setIsLoading(false);
          return;
        }

        // 2. Check sample recipe
        if (recipeId === 'sample-jerk-pork') {
          setRecipe(sampleRecipeExtended);
          setIsLoading(false);
          return;
        }

        // 3. Check Zustand store (local recipes)
        const localRecipe = recipes.find((r) => r.id === recipeId);
        if (localRecipe) {
          console.log('📋 Local recipe found:', {
            id: localRecipe.id,
            title: localRecipe.title,
            tags: localRecipe.tags,
            tagsType: typeof localRecipe.tags,
            tagsIsArray: Array.isArray(localRecipe.tags),
            tagsLength: localRecipe.tags?.length,
            fullRecipe: JSON.stringify(localRecipe, null, 2),
          });

          // If tags are missing or empty, try to fetch from Firestore ONCE to get the latest data
          const hasTags = Array.isArray(localRecipe.tags) && localRecipe.tags.length > 0;
          const hasAlreadyFetched = hasFetchedForTagsRef.current === recipeId;

          if (!hasTags && !hasAlreadyFetched) {
            console.log('⚠️ Local recipe missing tags, fetching from Firestore...');
            hasFetchedForTagsRef.current = recipeId;
            // Continue to Firestore fetch below
          } else {
            // Convert Recipe to ExtendedRecipe - use local recipe even if tags are empty
            const extendedRecipe: ExtendedRecipe = {
              ...localRecipe,
              tags: Array.isArray(localRecipe.tags) ? localRecipe.tags.filter((tag: any) => tag && typeof tag === 'string' && tag.trim().length > 0) : [],
              category: undefined,
              rating: 4.4,
              reviewCount: 0,
            } as unknown as ExtendedRecipe;
            console.log('📋 Local recipe tags after conversion:', extendedRecipe.tags);
            setRecipe(extendedRecipe);
            setIsLoading(false);
            return;
          }
        }

        // 4. Fetch from Firestore
        console.log('📥 Fetching recipe from Firestore:', recipeId);
        const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));

        if (recipeDoc.exists()) {
          const userRecipe = { id: recipeDoc.id, ...recipeDoc.data() } as any;
          console.log('✅ Recipe found in Firestore:', userRecipe.title);
          console.log('📋 Recipe tags from Firestore:', userRecipe.tags);

          // Check if user has permission to view this recipe
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error('You must be logged in to view recipes');
          }

          // Check if recipe is public or user owns it
          if (userRecipe.isPublic !== true && userRecipe.userId !== currentUser.uid) {
            throw new Error('You do not have permission to view this recipe');
          }

          // Convert to ExtendedRecipe format
          const extendedRecipe = convertUserRecipeToExtended(userRecipe);
          console.log('📋 Recipe tags from Firestore (raw):', userRecipe.tags);
          console.log('📋 Recipe tags after conversion:', extendedRecipe.tags);
          console.log('📋 Recipe tags length:', extendedRecipe.tags?.length);
          console.log('📋 Recipe tags type:', typeof extendedRecipe.tags);
          console.log('📋 Recipe tags is array:', Array.isArray(extendedRecipe.tags));

          // Update local store with tags from Firestore (source of truth)
          const { updateRecipe } = useRecipesStore.getState();
          updateRecipe(recipeId, { tags: extendedRecipe.tags || [] });
          console.log('💾 Updated local store with tags from Firestore');

          setRecipe(extendedRecipe);
          setIsLoading(false);

          // Set servings from recipe if available
          if (extendedRecipe.servings) {
            setServings(extendedRecipe.servings);
          }
        } else {
          // Recipe doesn't exist in Firestore - remove it from local store if it's there
          const localRecipe = recipes.find((r) => r.id === recipeId);
          if (localRecipe) {
            console.log('🗑️ Recipe not found in Firestore, removing from local store:', recipeId);
            const { removeRecipe } = useRecipesStore.getState();
            removeRecipe(recipeId);
          }
          throw new Error('Recipe not found');
        }
      } catch (error: any) {
        console.error('❌ Error loading recipe:', error);
        setError(error.message || 'Failed to load recipe');

        // If it's a "not found" error and the recipe exists in local store, remove it
        if (error.message?.includes('not found') || error.message?.includes('Recipe not found')) {
          const localRecipe = recipes.find((r) => r.id === recipeId);
          if (localRecipe) {
            console.log('🗑️ Removing invalid recipe from local store:', recipeId);
            const { removeRecipe } = useRecipesStore.getState();
            removeRecipe(recipeId);
          }
        }

        Alert.alert('Error', error.message || 'Failed to load recipe', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipe();
  }, [recipeId, navigation]);

  // Initialize nutrition state - show nutrition if it exists
  // This hook MUST be called before any early returns
  useEffect(() => {
    if (recipe && recipe.nutrition) {
      setNutritionCalculated(true);
    }
  }, [recipe?.nutrition]);

  // Timer functionality - MUST be called before any early returns
  useEffect(() => {
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      // Clear any existing interval first
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setIsTimerRunning(false);
            setActiveTimerStepId(null);
            Alert.alert('Timer Complete', 'The timer has finished!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isTimerRunning]); // Only depend on isTimerRunning, not timerSeconds

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error || !recipe) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.colors.accent} />
          <Text style={styles.errorText}>{error || 'Recipe not found'}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  // Format timer seconds to MM:SS
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const markRecipeAsStarted = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('User not authenticated');
        return;
      }

      // Mark recipe as started/cooked in Firestore
      const cookedDocRef = doc(db, 'userCookedRecipes', `${currentUser.uid}_${recipeId}`);
      await setDoc(cookedDocRef, {
        userId: currentUser.uid,
        recipeId: recipeId,
        startedAt: new Date().toISOString(),
        cookedAt: new Date().toISOString(),
      }, { merge: true });

      console.log('✅ Recipe marked as started/cooked:', recipeId);

      // Refresh cooked recipes count
      const cookedQuery = query(
        collection(db, 'userCookedRecipes'),
        where('userId', '==', currentUser.uid)
      );
      const cookedSnapshot = await getDocs(cookedQuery);
      setCookedRecipesCount(cookedSnapshot.size);
    } catch (error) {
      console.error('❌ Error marking recipe as started:', error);
      // Continue even if save fails
    }
  };

  const handleStepByStep = () => {
    // Check if user needs to see the warning or upgrade bottom sheet
    if (!isSubscribed) {
      if (cookedRecipesCount >= 0 && cookedRecipesCount < FREE_RECIPE_LIMIT) {
        // Show alert for free users who haven't reached the limit yet
        Alert.alert(
          'Ready to smash it?',
          'You can only cook one Recipe before starting a free trial, so make it count!',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Yes',
              onPress: async () => {
                // Mark recipe as started when user confirms
                await markRecipeAsStarted();
                navigation.navigate('CookMode', { recipeId });
              },
            },
          ]
        );
      } else if (cookedRecipesCount >= FREE_RECIPE_LIMIT) {
        // Show upgrade bottom sheet for free users who have reached the limit
        setPendingActionFromUpgrade('cookMode');
        setShowUpgradeBottomSheet(true);
      } else {
        // Fallback: proceed normally
        navigation.navigate('CookMode', { recipeId });
      }
    } else {
      // Subscribed users proceed normally
      navigation.navigate('CookMode', { recipeId });
    }
  };

  const handleMethod = () => {
    // Check if user needs to see the warning or upgrade bottom sheet
    if (!isSubscribed) {
      if (cookedRecipesCount >= 0 && cookedRecipesCount < FREE_RECIPE_LIMIT) {
        // Show alert for free users who haven't reached the limit yet
        Alert.alert(
          'Ready to smash it?',
          'You can only cook one Recipe before starting a free trial, so make it count!',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Yes',
              onPress: async () => {
                // Mark recipe as started when user confirms
                await markRecipeAsStarted();
                setShowMethodBottomSheet(true);
              },
            },
          ]
        );
      } else if (cookedRecipesCount >= FREE_RECIPE_LIMIT) {
        // Show upgrade bottom sheet for free users who have reached the limit
        setPendingActionFromUpgrade('instructions');
        setShowUpgradeBottomSheet(true);
      } else {
        // Fallback: proceed normally
        setShowMethodBottomSheet(true);
      }
    } else {
      // Subscribed users proceed normally
      setShowMethodBottomSheet(true);
    }
  };

  const handleRecipeCompletion = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('User not authenticated');
        setShowCompletionModal(true);
        return;
      }

      // Save cooked status to Firestore
      const cookedDocRef = doc(db, 'userCookedRecipes', `${currentUser.uid}_${recipeId}`);
      await setDoc(cookedDocRef, {
        userId: currentUser.uid,
        recipeId: recipeId,
        cookedAt: new Date().toISOString(),
      }, { merge: true });

      // Check if this was their first recipe
      const cookedQuery = query(
        collection(db, 'userCookedRecipes'),
        where('userId', '==', currentUser.uid)
      );
      const cookedSnapshot = await getDocs(cookedQuery);
      const cookedCount = cookedSnapshot.size;

      // Check subscription status
      const isSubscribed = hasActiveSubscription(superwall);

      // If this is their first recipe and they're not subscribed, show upgrade bottom sheet
      if (cookedCount === 1 && !isSubscribed) {
        setShowUpgradeBottomSheet(true);
      } else {
        // Otherwise show normal completion modal
        setShowCompletionModal(true);
      }
    } catch (error) {
      console.error('Error saving recipe completion:', error);
      // Show completion modal even if save fails
      setShowCompletionModal(true);
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

      // Only proceed with the pending action if user successfully subscribed
      if (subscribed) {
        console.log('✅ User successfully subscribed, proceeding with action');
        if (pendingActionFromUpgrade === 'cookMode') {
          navigation.navigate('CookMode', { recipeId });
        } else if (pendingActionFromUpgrade === 'instructions') {
          setShowMethodBottomSheet(true);
        }
      } else {
        console.log('ℹ️ User did not subscribe, not proceeding with action');
      }

      setPendingActionFromUpgrade(null);
    } catch (error) {
      console.error('❌ Error presenting Superwall paywall:', error);
      // Close upgrade bottom sheet - don't proceed if there's an error
      setShowUpgradeBottomSheet(false);
      setPendingActionFromUpgrade(null);
    } finally {
      setIsLoadingUpgrade(false);
    }
  };

  const handleRateAndReview = () => {
    setShowCompletionModal(false);
    setShowUpgradeBottomSheet(false);
    navigation.navigate('RateAndReview', { recipeId });
  };

  const handleMaybeLater = () => {
    setShowCompletionModal(false);
    setShowUpgradeBottomSheet(false);
  };

  // Handle timer start/pause/stop
  const handleTimerToggle = (stepDuration: number, stepId?: string) => {
    if (isTimerRunning) {
      // Pause timer
      setIsTimerRunning(false);
    } else if (timerSeconds !== null && timerSeconds > 0 && timerSeconds < stepDuration * 60) {
      // Resume timer
      setIsTimerRunning(true);
      if (stepId) setActiveTimerStepId(stepId);
    } else {
      // Start new timer
      setTimerSeconds(stepDuration * 60);
      setIsTimerRunning(true);
      if (stepId) setActiveTimerStepId(stepId);
    }
  };

  const handleTimerStop = () => {
    setIsTimerRunning(false);
    setTimerSeconds(null);
    setActiveTimerStepId(null);
  };

  const handleAddToMenu = () => {
    setShowAddToMenuModal(true);
  };

  const handleGoToMenu = () => {
    // Find meal plan entries for this recipe
    const recipeMealPlans = mealPlans.filter(plan => plan.recipeId === recipeId);

    if (recipeMealPlans.length === 0) {
      // No meal plans found, just go to meal plan screen
      (navigation as any).navigate('Home', { screen: 'MealPlan' });
      return;
    }

    // Find the earliest scheduled date
    const earliestDate = recipeMealPlans
      .map(plan => plan.date)
      .sort()
    [0];

    // Calculate which week offset contains this date
    const targetDate = new Date(earliestDate);
    targetDate.setHours(0, 0, 0, 0);

    // Get current week's Monday
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() + mondayOffset);
    thisWeekMonday.setHours(0, 0, 0, 0);

    // Calculate difference in days
    const diffTime = targetDate.getTime() - thisWeekMonday.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Calculate week offset (0 = this week, 1 = next week, etc.)
    const weekOffset = Math.floor(diffDays / 7);

    // Navigate to meal plan with the calculated week offset
    (navigation as any).navigate('Home', {
      screen: 'MealPlan',
      params: { weekOffset: Math.max(0, weekOffset) } // Ensure non-negative
    });
  };

  const handleDaySelect = (day: string) => {
    setSelectedDay(day);
  };

  const handleConfirmAddToMenu = () => {
    if (!recipe || !selectedMealType) return;

    const newMealPlan: MealPlanItem = {
      id: `${Date.now()}-${Math.random()}`,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeImage: typeof recipe.image === 'string' ? recipe.image : undefined,
      mealType: selectedMealType,
      date: selectedDay || '', // Empty string for shelf if no date selected
      includeInGrocery: true,
      servingsOverride: servings,
    };

    console.log('📅 Adding recipe to meal plan:', {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      date: selectedDay,
      mealType: selectedMealType,
    });

    addMealPlan(newMealPlan);

    // Automatically add ingredients to groceries list if includeInGrocery is true
    if (newMealPlan.includeInGrocery && recipe.ingredients && recipe.ingredients.length > 0) {
      // Convert ExtendedRecipe ingredients to Ingredient format
      const ingredients = recipe.ingredients.map(ing => ({
        id: ing.id || `${Date.now()}-${Math.random()}`,
        name: ing.name,
        amount: ing.amount || '1',
        unit: ing.unit,
        icon: undefined, // ExtendedRecipe ingredients don't have icon
      }));

      // Adjust ingredients based on servings if recipe has servings info
      const recipeServings = recipe.servings || 4;
      const adjustedIngredients = ingredients.map(ing => ({
        ...ing,
        amount: String(Number(ing.amount) * (servings / recipeServings)),
      }));

      // Create sources for each ingredient
      const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        mealPlanEntryId: newMealPlan.id,
        amount: ing.amount,
      }));

      addItems(adjustedIngredients, recipe.id, recipe.title, servings, sources);
      console.log('🛒 Added ingredients to groceries list:', adjustedIngredients.length);
    }

    // Show success toast
    if (selectedDay) {
      // Format the selected date for display
      const selectedDate = weekDates.find(d => formatDateKey(d) === selectedDay);
      const formattedDate = selectedDate
        ? formatDayFull(selectedDate)
        : selectedDay;

      setToastMessage(`${recipe.title} added for ${formattedDate}`);
      setToastType('success');
      setToastVisible(true);
    } else {
      setToastMessage(`${recipe.title} added to planner`);
      setToastType('success');
      setToastVisible(true);
    }

    // Close modal
    setShowAddToMenuModal(false);
    setSelectedDay(null);
    setSelectedMealType(null);
    setWeekOffset(0);
  };

  const formatDayFull = (date: Date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const daySuffix = getDaySuffix(day);
    return `${dayName}, ${month} ${day}${daySuffix}`;
  };

  const handleCloseAddToMenuModal = () => {
    setShowAddToMenuModal(false);
    setSelectedDay(null);
    setSelectedMealType(null);
    setWeekOffset(0);
  };

  const handlePreviousWeek = () => {
    if (weekOffset > 0) {
      setWeekOffset(weekOffset - 1);
      setSelectedDay(null);
      setSelectedMealType(null);
    }
  };

  const handleNextWeek = () => {
    if (weekOffset < 3) {
      setWeekOffset(weekOffset + 1);
      setSelectedDay(null);
      setSelectedMealType(null);
    }
  };

  const getMealTypeColor = (mealType: string): string => {
    switch (mealType) {
      case 'breakfast':
        return '#007AFF'; // Blue
      case 'lunch':
        return '#34C759'; // Green
      case 'dinner':
        return '#FF3B30'; // Red
      case 'snack':
        return '#FF9500'; // Orange
      default:
        return '#666';
    }
  };

  const mealTypes = [
    { id: 'breakfast' as const, label: 'Breakfast', icon: 'sunny-outline' },
    { id: 'lunch' as const, label: 'Lunch', icon: 'sunny' },
    { id: 'dinner' as const, label: 'Dinner', icon: 'moon-outline' },
    { id: 'snack' as const, label: 'Snack', icon: 'gift-outline' },
  ];

  // Get week dates based on offset
  const getWeekDates = (offset: number = 0) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (offset * 7));

    // Set to midnight to avoid timezone issues
    monday.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }
    return dates;
  };

  // Helper to format date as YYYY-MM-DD (local timezone, not UTC)
  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekLabel = (offset: number) => {
    if (offset === 0) return 'THIS WEEK';
    if (offset === 1) return 'NEXT WEEK';
    return `WEEK ${offset + 1}`;
  };

  const formatDateRange = (offset: number = 0) => {
    const dates = getWeekDates(offset);
    const startDate = dates[0];
    const endDate = dates[6];

    const formatDate = (date: Date) => {
      const day = date.getDate();
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      return `${dayName} ${day}${getDaySuffix(day)} ${month}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const weekDates = getWeekDates(weekOffset);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share recipe');
  };

  const handleTwists = () => {
    // TODO: Implement twists functionality
    console.log('Show twists');
  };


  const handleAddNotes = () => {
    setShowPrivateNotesModal(true);
  };

  const handleSaveNotes = () => {
    // TODO: Save notes to recipe/store
    console.log('Saving notes:', privateNotes);
    setShowPrivateNotesModal(false);
  };

  const handleCloseNotesModal = () => {
    setShowPrivateNotesModal(false);
  };

  const handleViewPack = () => {
    // TODO: Navigate to recipe pack
    console.log('View recipe pack');
  };

  const decreaseServings = () => {
    if (servings > 1) {
      setServings(servings - 1);
    }
  };

  const increaseServings = () => {
    setServings(servings + 1);
  };

  const getIngredientIcon = (ingredientName: string, iconId?: string) => {
    // First check if we have a specific icon ID
    if (iconId) {
      const iconMap: { [key: string]: string } = {
        rice: '🌾',
        can: '🥫',
        onion: '🧅',
        carrot: '🥕',
        scallions: '🌱',
        meat: '🥩',
        spice: '🌶️',
        oil: '🫒',
      };
      if (iconMap[iconId]) return iconMap[iconId];
    }

    // Fallback to name-based detection
    const name = ingredientName.toLowerCase();
    if (name.includes('rice')) return '🌾';
    if (name.includes('coconut') || name.includes('milk')) return '🥥';
    if (name.includes('onion')) return '🧅';
    if (name.includes('carrot')) return '🥕';
    if (name.includes('scallion') || name.includes('spring onion')) return '🌱';
    if (name.includes('pork') || name.includes('meat')) return '🥩';
    if (name.includes('spice') || name.includes('seasoning')) return '🌶️';
    if (name.includes('oil')) return '🫒';
    return '📦';
  };

  const getEquipmentIcon = (equipment: string | { name: string; image?: string }): keyof typeof Ionicons.glyphMap => {
    const equipmentName = typeof equipment === 'string' ? equipment : equipment.name;
    const name = equipmentName.toLowerCase();

    // Pan and pot related
    if (name.includes('pan') || name.includes('frying pan') || name.includes('skillet')) {
      return 'restaurant-outline';
    }
    if (name.includes('saucepan') || name.includes('pot')) {
      return 'flask-outline';
    }
    if (name.includes('wok')) {
      return 'restaurant-outline';
    }

    // Knife related
    if (name.includes('knife') || name.includes('chef')) {
      return 'cut-outline';
    }
    if (name.includes('peeler')) {
      return 'cut-outline';
    }

    // Sieve and strainer
    if (name.includes('sieve') || name.includes('strainer') || name.includes('colander')) {
      return 'water-outline';
    }

    // Baking related
    if (name.includes('baking') || name.includes('parchment') || name.includes('paper')) {
      return 'document-text-outline';
    }
    if (name.includes('sheet') || name.includes('tray')) {
      return 'grid-outline';
    }
    if (name.includes('oven')) {
      return 'flame-outline';
    }

    // Mixing and preparation
    if (name.includes('bowl') || name.includes('mixing')) {
      return 'ellipse-outline';
    }
    if (name.includes('whisk')) {
      return 'sync-outline';
    }
    if (name.includes('spatula') || name.includes('spoon') || name.includes('ladle')) {
      return 'restaurant-outline';
    }
    if (name.includes('tongs')) {
      return 'hand-left-outline';
    }

    // Measuring
    if (name.includes('measuring') || name.includes('cup') || name.includes('scale')) {
      return 'scale-outline';
    }

    // Grater and other tools
    if (name.includes('grater') || name.includes('zester')) {
      return 'grid-outline';
    }
    if (name.includes('blender') || name.includes('food processor')) {
      return 'pulse-outline';
    }

    // Default
    return 'construct-outline';
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Show sticky header when scrolled past ~200px (roughly past the image)
    setShowStickyHeader(scrollY > 200);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Sticky Header */}
      {showStickyHeader && (
        <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 8) }]}>
          <TouchableOpacity
            style={styles.stickyBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.stickyTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.stickyHeaderActions}>
            {isRecipeOwner && (
              <TouchableOpacity
                style={styles.stickyEditButton}
                onPress={() => {
                  navigation.navigate('WriteRecipe', { recipeId: recipe.id });
                }}
              >
                <Ionicons name="pencil" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.stickyPlusButton}
              onPress={() => {
                setShowRecipeOptionsBottomSheet(true);
              }}
            >
              <Ionicons name="add" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Recipe Image - Full Width with Overlays */}
        <View style={styles.imageContainer}>
          {recipe.image ? (
            typeof recipe.image === 'string' ? (
              <Image source={{ uri: recipe.image }} style={styles.recipeImage} resizeMode="cover" />
            ) : (
              <Image source={recipe.image} style={styles.recipeImage} resizeMode="cover" />
            )
          ) : (
            <View style={styles.recipeImagePlaceholder}>
              <Ionicons name="image-outline" size={60} color="#E0E0E0" />
            </View>
          )}

          {/* Back Button - Overlayed on top-left */}
          <TouchableOpacity
            style={[styles.imageBackButton, { top: Math.max(insets.top, 8) + 12 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>

          {/* Edit Button - Overlayed on top-right (only if user owns recipe) */}
          {isRecipeOwner && (
            <TouchableOpacity
              style={[styles.imageEditButton, { top: Math.max(insets.top, 8) + 12 }]}
              onPress={() => {
                navigation.navigate('WriteRecipe', { recipeId: recipe.id });
              }}
            >
              <Ionicons name="pencil" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          )}

          {/* Plus Button - Overlayed on bottom-right */}
          <TouchableOpacity
            style={styles.imagePlusButton}
            onPress={() => {
              setShowRecipeOptionsBottomSheet(true);
            }}
          >
            <Ionicons name="add" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Content Body Section with Rounded Top */}
        <View style={styles.contentBodyContainer}>
          {/* Title - Below Image */}
          <View style={styles.titleContainer}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
          </View>

          {/* Tags - Less Prominent */}
          {recipe.tags && recipe.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Ionicons name="information-circle-outline" size={14} color="#666666" />
              <Text style={styles.tagsText}>
                {recipe.tags.join(' - ')}
              </Text>
            </View>
          )}

          {/* Chef Tips Section */}
          {recipe.chefTips && recipe.chefTips.length > 0 && (
            <View style={styles.chefTipsSection}>
              <TouchableOpacity
                style={styles.chefTipsHeader}
                onPress={() => setChefTipsExpanded(!chefTipsExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.chefTipsHeaderLeft}>
                  <MaterialCommunityIcons name="chef-hat" size={20} color="#1A1A1A" />
                  <Text style={styles.chefTipsTitle}>Chef Tips</Text>
                </View>
                <Ionicons
                  name={chefTipsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#1A1A1A"
                />
              </TouchableOpacity>
              {chefTipsExpanded && (
                <View style={styles.chefTipsContent}>
                  {recipe.chefTips.map((tip, index) => (
                    <View key={index} style={styles.chefTipItem}>
                      <Text style={styles.chefTipBullet}>•</Text>
                      <View style={styles.chefTipTextContainer}>
                        <Text style={styles.chefTipLabel}>
                          {tip.type === 'tip' ? 'Tip' : 'Make ahead'}
                        </Text>
                        <Text style={styles.chefTipText}>{tip.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Stats Grid - Rate, Time, Servings */}
          <View style={styles.statsGrid}>
            {/* First Row: Rate and Time */}
            <View style={styles.statsRowContainer}>
              {/* Rating */}
              <TouchableOpacity
                style={styles.statItemNoBorder}
                onPress={() => navigation.navigate('RateAndReview', { recipeId })}
              >
                <Ionicons name="star-outline" size={18} color="#1A1A1A" />
                <Text style={styles.statText}>Rate</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.statDivider} />

              {/* Time */}
              {totalTime > 0 ? (
                <View style={styles.statItemNoBorder}>
                  <Ionicons name="time-outline" size={18} color="#1A1A1A" />
                  <Text style={styles.statText}>{totalTime} mins</Text>
                </View>
              ) : (
                <View style={styles.statItemNoBorder} />
              )}
            </View>

            {/* Horizontal Divider */}
            <View style={styles.rowDivider} />

            {/* Second Row: Servings */}
            <View style={styles.servingsRow}>
              <TouchableOpacity
                style={styles.servingsButtonSmall}
                onPress={decreaseServings}
                disabled={servings <= 1}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={servings <= 1 ? '#CCCCCC' : '#1A1A1A'}
                />
              </TouchableOpacity>
              <Text style={styles.servingsTextSmall}>{servings} Servings</Text>
              <TouchableOpacity style={styles.servingsButtonSmall} onPress={increaseServings}>
                <Ionicons name="add" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
              onPress={() => setActiveTab('ingredients')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'ingredients' && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                Ingredients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'equipment' && styles.tabActive]}
              onPress={() => setActiveTab('equipment')}
            >
              <Text
                style={[styles.tabText, activeTab === 'equipment' && styles.tabTextActive]}
                numberOfLines={1}
              >
                Equipment
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'info' && styles.tabActive]}
              onPress={() => setActiveTab('info')}
            >
              <Text
                style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}
                numberOfLines={1}
              >
                Info
              </Text>
            </TouchableOpacity>
          </View>

          {/* Separator below tabs */}
          <View style={styles.sectionBottomBorder} />

          {/* Content based on active tab */}
          {activeTab === 'ingredients' && (
            <View style={styles.ingredientsList}>
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                <>
                  {(ingredientsExpanded
                    ? recipe.ingredients
                    : recipe.ingredients.slice(0, 5)
                  ).map((ingredient, index, array) => (
                    <React.Fragment key={ingredient.id}>
                      <View style={[styles.ingredientItem, index === 0 && styles.ingredientItemFirst]}>
                        <TouchableOpacity
                          onPress={() => {
                            // Use ingredient name as identifier for now
                            // TODO: Replace with actual ingredient image URL when available
                            setSelectedIngredientImage(ingredient.name);
                          }}
                        >
                          <Text style={styles.ingredientIcon}>
                            {getIngredientIcon(ingredient.name, ingredient.icon)}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.ingredientText}>
                          {ingredient.name} {ingredient.amount}
                          {ingredient.unit ? ` ${ingredient.unit}` : ''}
                        </Text>
                      </View>
                      {index < array.length - 1 && (
                        <View style={styles.ingredientSeparator}>
                          <View style={styles.separatorLine} />
                        </View>
                      )}
                    </React.Fragment>
                  ))}
                  {recipe.ingredients.length > 5 && (
                    <View style={styles.expandButtonContainer}>
                      <View style={styles.ingredientsDivider} />
                      <View style={styles.expandButtonWrapper}>
                        <TouchableOpacity
                          style={styles.expandButton}
                          onPress={() => setIngredientsExpanded(!ingredientsExpanded)}
                        >
                          <View style={styles.chevronContainer}>
                            <Ionicons
                              name={ingredientsExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#1A1A1A"
                            />
                            <Ionicons
                              name={ingredientsExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#1A1A1A"
                              style={styles.secondChevron}
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No ingredients listed</Text>
              )}
            </View>
          )}

          {activeTab === 'equipment' && (
            <View style={styles.equipmentList}>
              {recipe.equipment && recipe.equipment.length > 0 ? (
                <>
                  {(equipmentExpanded
                    ? recipe.equipment
                    : recipe.equipment.slice(0, 5)
                  ).map((item, index, array) => {
                    const equipmentName = typeof item === 'string' ? item : item.name;
                    const equipmentImage = typeof item === 'object' ? item.image : undefined;

                    return (
                      <React.Fragment key={index}>
                        <View style={[styles.equipmentItem, index === 0 && styles.equipmentItemFirst]}>
                          {equipmentImage ? (
                            <Image source={{ uri: equipmentImage }} style={styles.equipmentImage} />
                          ) : (
                            <Ionicons name={getEquipmentIcon(item)} size={20} color="#1A1A1A" />
                          )}
                          <Text style={styles.equipmentText}>{equipmentName}</Text>
                        </View>
                        {index < array.length - 1 && (
                          <View style={styles.equipmentSeparator}>
                            <View style={styles.separatorLine} />
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {recipe.equipment.length > 5 && (
                    <View style={styles.expandButtonContainer}>
                      <View style={styles.ingredientsDivider} />
                      <View style={styles.expandButtonWrapper}>
                        <TouchableOpacity
                          style={styles.expandButton}
                          onPress={() => setEquipmentExpanded(!equipmentExpanded)}
                        >
                          <View style={styles.chevronContainer}>
                            <Ionicons
                              name={equipmentExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#1A1A1A"
                            />
                            <Ionicons
                              name={equipmentExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#1A1A1A"
                              style={styles.secondChevron}
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No equipment listed</Text>
              )}
            </View>
          )}

          {activeTab === 'info' && (
            <View style={styles.infoContent}>
              {/* Recipe Description */}
              {recipe.description && (
                <View style={[styles.infoSection, styles.infoSectionFirst]}>
                  <Text style={styles.infoDescription}>{recipe.description}</Text>
                </View>
              )}

              {/* Recipe Notes */}
              {recipe.notes && (
                <View style={[styles.infoSection, !recipe.description && styles.infoSectionFirst]}>
                  <Text style={styles.infoSectionTitle}>Notes</Text>
                  <Text style={styles.infoNotesText}>{recipe.notes}</Text>
                </View>
              )}

              {/* Nutrition Section */}
              <View style={[styles.infoSection, styles.nutritionSection, !recipe.description && !recipe.notes && styles.infoSectionFirst]}>
                {nutritionCalculated && recipe.nutrition ? (
                  <>
                    <View style={styles.nutritionHeader}>
                      <Text style={styles.infoSectionTitle}>Nutrition</Text>
                    </View>
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>kcal</Text>
                        <Text style={styles.nutritionValue}>{recipe.nutrition.calories}</Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>carbs</Text>
                        <Text style={styles.nutritionValue}>{recipe.nutrition.carbs}g</Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>fat</Text>
                        <Text style={styles.nutritionValue}>{recipe.nutrition.fats}g</Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>protein</Text>
                        <Text style={styles.nutritionValue}>{recipe.nutrition.protein}g</Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>salt</Text>
                        <Text style={styles.nutritionValue}>
                          {(recipe.nutrition as any).salt !== undefined ? `${(recipe.nutrition as any).salt}g` : '-'}
                        </Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>sugar</Text>
                        <Text style={styles.nutritionValue}>
                          {(recipe.nutrition as any).sugar !== undefined ? `${(recipe.nutrition as any).sugar}g` : '-'}
                        </Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>fibre</Text>
                        <Text style={styles.nutritionValue}>
                          {(recipe.nutrition as any).fibre !== undefined ? `${(recipe.nutrition as any).fibre}g` : '-'}
                        </Text>
                      </View>
                      <View style={styles.nutritionCard}>
                        <Text style={styles.nutritionLabel}>sat fat</Text>
                        <Text style={styles.nutritionValue}>
                          {(recipe.nutrition as any).satFat !== undefined ? `${(recipe.nutrition as any).satFat}g` : '-'}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.nutritionRow}>
                    <Text style={styles.infoSectionTitle}>Nutrition</Text>
                    <TouchableOpacity
                      style={styles.calculateButton}
                      onPress={() => {
                        // TODO: Implement nutrition calculation
                        // For now, if recipe already has nutrition, show it
                        if (recipe.nutrition) {
                          setNutritionCalculated(true);
                        } else {
                          Alert.alert('Calculate Nutrition', 'Nutrition calculation will be implemented soon.');
                        }
                      }}
                    >
                      <Text style={styles.calculateButtonText}>Calculate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Recipe Pack Section - Only show if recipe is part of a pack */}
              {recipe.recipePack && recipe.recipePack.id && recipe.recipePack.name && (
                <View style={[styles.infoSection, !recipe.description && !recipe.notes && !recipe.nutrition && styles.infoSectionFirst]}>
                  <View style={styles.recipePackHeader}>
                    <Text style={styles.recipePackTitle}>
                      This recipe is part of a Recipe Pack:
                    </Text>
                    <TouchableOpacity onPress={() => setShowRecipePackInfo(true)}>
                      <Ionicons name="information-circle-outline" size={18} color="#1A1A1A" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recipePackCard}>
                    <View style={styles.recipePackCardHeader}>
                      <Text style={styles.recipePackName}>{recipe.recipePack.name}</Text>
                      <TouchableOpacity onPress={handleViewPack}>
                        <Text style={styles.viewPackLink}>view pack &gt;</Text>
                      </TouchableOpacity>
                    </View>
                    {recipe.recipePack.description && (
                      <Text style={styles.recipePackDescription}>
                        {recipe.recipePack.description}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}


          {/* You may also like section */}
          {recipes.length > 1 && (
            <View style={styles.alsoLikeSection}>
              <Text style={styles.alsoLikeTitle}>You may also like...</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {recipes.slice(0, 3).map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.alsoLikeCard}
                    onPress={() => navigation.navigate('RecipeDetail', { recipeId: r.id })}
                  >
                    {r.image && (
                      <View style={styles.alsoLikeImageContainer}>
                        {typeof r.image === 'string' ? (
                          <Image source={{ uri: r.image }} style={styles.alsoLikeImage} />
                        ) : (
                          <Image source={r.image} style={styles.alsoLikeImage} />
                        )}
                      </View>
                    )}
                    <Text style={styles.alsoLikeCardTitle}>{r.title}</Text>
                    <View style={styles.alsoLikeCardMeta}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.alsoLikeCardRating}>4.4</Text>
                      <Text style={styles.alsoLikeCardTime}>
                        {((r.prepTime || 0) + (r.cookTime || 0)) || '30'} mins
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.stepByStepButton} onPress={handleStepByStep}>
          <Ionicons name="volume-high-outline" size={20} color="#FFFFFF" />
          <Text style={styles.stepByStepButtonText}>COOK MODE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.methodButton} onPress={handleMethod}>
          <Ionicons name="list-outline" size={20} color="#FFFFFF" />
          <Text style={styles.methodButtonText}>INSTRUCTIONS</Text>
        </TouchableOpacity>
      </View>


      {/* Upgrade Bottom Sheet */}
      <BottomSheet
        visible={showUpgradeBottomSheet}
        onClose={() => {
          setShowUpgradeBottomSheet(false);
          setPendingActionFromUpgrade(null);
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
                setPendingActionFromUpgrade(null);
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

      {/* Ingredient Image Modal */}
      <Modal
        visible={selectedIngredientImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedIngredientImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedIngredientImage(null)}
          >
            <Ionicons name="close" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalContentContainer}
            activeOpacity={1}
            onPress={() => { }}
          >
            <View style={styles.modalContent}>
              {selectedIngredientImage && (
                <View style={styles.modalImageContainer}>
                  <Text style={styles.modalIngredientIcon}>
                    {(() => {
                      const ingredient = recipe.ingredients?.find(
                        (ing) => ing.name === selectedIngredientImage
                      );
                      return getIngredientIcon(
                        ingredient?.name || selectedIngredientImage,
                        ingredient?.icon
                      );
                    })()}
                  </Text>
                  {/* TODO: Replace with actual ingredient image when available */}
                  {/* <Image
                    source={{ uri: selectedIngredientImage }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  /> */}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Recipe Pack Info Bottom Sheet */}
      <BottomSheet
        visible={showRecipePackInfo}
        onClose={() => setShowRecipePackInfo(false)}
      >
        <View style={styles.recipePackInfoContent}>
          <View style={styles.recipePackInfoHeader}>
            <View style={styles.recipePackInfoTitleContainer}>
              <Text style={styles.recipePackInfoTitle}>
                What is a <Text style={styles.recipePackInfoTitleHighlight}>Recipe Pack</Text>?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.recipePackInfoCloseButton}
              onPress={() => setShowRecipePackInfo(false)}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <Text style={styles.recipePackInfoText}>
            A recipe pack helps you plan your week, reduce food waste and save you cash by sharing fresh and staple ingredients across three recipes.
          </Text>
        </View>
      </BottomSheet>

      {/* Add to Menu Bottom Sheet */}
      <BottomSheet
        visible={showAddToMenuModal}
        onClose={handleCloseAddToMenuModal}
        height="85%"
      >
        {recipe && (
          <View style={styles.addToMenuModalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.addToMenuCloseButton}
              onPress={handleCloseAddToMenuModal}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Recipe Image */}
            <View style={styles.addToMenuImageContainer}>
              {recipe.image ? (
                typeof recipe.image === 'string' ? (
                  <Image
                    source={{ uri: recipe.image }}
                    style={styles.addToMenuImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={recipe.image}
                    style={styles.addToMenuImage}
                    resizeMode="cover"
                  />
                )
              ) : (
                <View style={styles.addToMenuImagePlaceholder}>
                  <Ionicons name="restaurant" size={40} color="#CCCCCC" />
                </View>
              )}
            </View>

            {/* Recipe Title with Yellow Highlight */}
            <View style={styles.addToMenuTitleContainer}>
              <Text style={styles.addToMenuTitle}>{recipe.title}</Text>
            </View>

            {/* THIS WEEK Section */}
            <View style={styles.thisWeekSection}>
              <TouchableOpacity
                onPress={handlePreviousWeek}
                style={[
                  styles.weekNavButton,
                  weekOffset === 0 && styles.weekNavButtonDisabled
                ]}
                disabled={weekOffset === 0}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={weekOffset === 0 ? '#CCCCCC' : '#1A1A1A'}
                />
              </TouchableOpacity>
              <View style={styles.thisWeekContent}>
                <Ionicons name="calendar-outline" size={18} color="#1A1A1A" />
                <Text style={styles.thisWeekText}>{getWeekLabel(weekOffset)}</Text>
              </View>
              <TouchableOpacity
                onPress={handleNextWeek}
                style={[
                  styles.weekNavButton,
                  weekOffset >= 3 && styles.weekNavButtonDisabled
                ]}
                disabled={weekOffset >= 3}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={weekOffset >= 3 ? '#CCCCCC' : '#1A1A1A'}
                />
              </TouchableOpacity>
            </View>

            {/* Date Range */}
            <Text style={styles.dateRangeText}>{formatDateRange(weekOffset)}</Text>

            {/* Question */}
            <Text style={styles.addToMenuQuestion}>When would you like to cook this recipe? (Optional)</Text>

            {/* Day Selection Buttons */}
            <View style={styles.daySelectionContainer}>
              {weekDates.map((date, index) => {
                const dateStr = formatDateKey(date); // Use local timezone format
                const dayName = dayNames[index];
                const isSelected = selectedDay === dateStr;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected
                    ]}
                    onPress={() => handleDaySelect(dateStr)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextSelected
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                    >
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Meal Type Selection */}
            <Text style={styles.mealTypeQuestion}>What meal is this for?</Text>
            <View style={styles.mealTypeContainer}>
              {mealTypes.map((mealType) => {
                const isSelected = selectedMealType === mealType.id;
                return (
                  <TouchableOpacity
                    key={mealType.id}
                    style={[
                      styles.mealTypeButton,
                      isSelected && styles.mealTypeButtonSelected,
                      isSelected && { borderColor: getMealTypeColor(mealType.id) }
                    ]}
                    onPress={() => setSelectedMealType(mealType.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={mealType.icon as any}
                      size={20}
                      color={isSelected ? getMealTypeColor(mealType.id) : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[
                      styles.mealTypeButtonText,
                      isSelected && { color: getMealTypeColor(mealType.id), fontWeight: '600' }
                    ]}>
                      {mealType.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ADD TO PLANNER Button */}
            <TouchableOpacity
              style={[
                styles.addToMenuSubmitButton,
                !selectedMealType && styles.addToMenuSubmitButtonDisabled
              ]}
              onPress={handleConfirmAddToMenu}
              disabled={!selectedMealType}
            >
              <Text style={styles.addToMenuSubmitButtonText}>Add to planner</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* Private Notes Bottom Sheet */}
      <BottomSheet
        visible={showPrivateNotesModal}
        onClose={handleCloseNotesModal}
      >
        <View style={styles.notesModalContent}>
          <View style={styles.notesModalHeader}>
            <View style={styles.notesModalTitleContainer}>
              <Text style={styles.notesModalTitle}>Your private notes</Text>
            </View>
            <TouchableOpacity
              style={styles.notesModalCloseButton}
              onPress={handleCloseNotesModal}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.notesInputContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TextInput
              style={styles.notesTextInput}
              placeholder="Add your private notes for this recipe"
              placeholderTextColor="#999999"
              multiline
              value={privateNotes}
              onChangeText={setPrivateNotes}
              textAlignVertical="top"
              autoFocus
            />
          </KeyboardAvoidingView>
          <TouchableOpacity
            style={styles.saveNotesButton}
            onPress={handleSaveNotes}
          >
            <Text style={styles.saveNotesButtonText}>SAVE</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Method Bottom Sheet (Instructions) */}
      <BottomSheet
        visible={showMethodBottomSheet}
        onClose={() => setShowMethodBottomSheet(false)}
        height="100%"
      >
        <View style={styles.methodContent}>
          <View style={[styles.methodHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            {isTimerRunning && timerSeconds !== null && timerSeconds > 0 ? (
              <View style={styles.methodTimerDisplayInline}>
                <View style={styles.methodTimerIconCircle}>
                  <Ionicons name="time-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.methodTimerTextInline}>
                  {formatTimer(timerSeconds)}
                </Text>
              </View>
            ) : (
              <Text style={styles.methodTitle}>Instructions</Text>
            )}
            <TouchableOpacity
              style={styles.methodCloseButton}
              onPress={() => setShowMethodBottomSheet(false)}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.methodScrollView}
            contentContainerStyle={[styles.methodScrollViewContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {recipe.steps && recipe.steps.length > 0 ? (
              <View style={styles.methodStepsContainer}>
                {recipe.steps.map((step, index) => {
                  // Extract title from step description (first sentence or first few words)
                  const description = step.description || '';
                  const titleMatch = description.match(/^([^.!?]+[.!?]?)/);
                  const title = titleMatch ? titleMatch[1].trim() : `Step ${step.order || index + 1}`;
                  const remainingText = titleMatch ? description.substring(titleMatch[0].length).trim() : description;

                  return (
                    <React.Fragment key={step.id || index}>
                      <View style={styles.methodStepCard}>
                        {/* Thumbnail */}
                        <View style={styles.methodStepThumbnail}>
                          {step.image ? (
                            <Image
                              source={{ uri: step.image }}
                              style={styles.methodStepThumbnailImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.methodStepThumbnailIcon}>
                              <Ionicons name={getStepIcon(description)} size={24} color="#FF6B35" />
                            </View>
                          )}
                        </View>

                        {/* Content */}
                        <View style={styles.methodStepCardContent}>
                          {/* Title */}
                          <Text style={styles.methodStepTitle}>{title}</Text>

                          {/* Description */}
                          {remainingText && (
                            <Text style={styles.methodStepDescription}>{remainingText}</Text>
                          )}

                          {/* Timer Button */}
                          {step.duration && step.duration > 0 && (() => {
                            const stepDuration = step.duration!; // Safe because we checked above
                            const stepId = step.id || `step-${index}`;
                            const isPaused = activeTimerStepId === stepId && timerSeconds !== null && timerSeconds > 0 && timerSeconds < stepDuration * 60 && !isTimerRunning;
                            const isActiveTimer = isTimerRunning && activeTimerStepId === stepId;
                            return (
                              <View style={styles.methodTimerContainer}>
                                {isPaused ? (
                                  <View style={styles.methodTimerDisplay}>
                                    <Ionicons name="time-outline" size={16} color="#FF6B35" />
                                    <Text style={styles.methodTimerText}>
                                      {formatTimer(timerSeconds)} (Paused)
                                    </Text>
                                  </View>
                                ) : null}
                                <View style={styles.methodTimerButtonsRow}>
                                  {isActiveTimer && timerSeconds !== null ? (
                                    <>
                                      <View style={styles.methodTimerDisplayInline}>
                                        <View style={styles.methodTimerIconCircle}>
                                          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
                                        </View>
                                        <Text style={styles.methodTimerTextInline}>
                                          {formatTimer(timerSeconds)}
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        style={[styles.methodTimerButton, styles.methodTimerButtonSecondary, styles.methodTimerButtonIconOnly]}
                                        onPress={() => handleTimerToggle(stepDuration, stepId)}
                                        activeOpacity={0.8}
                                      >
                                        <Ionicons name="pause" size={16} color="#1A1A1A" />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.methodTimerButton, styles.methodTimerButtonStop, styles.methodTimerButtonIconOnly]}
                                        onPress={handleTimerStop}
                                        activeOpacity={0.8}
                                      >
                                        <Ionicons name="stop" size={16} color="#FFFFFF" />
                                      </TouchableOpacity>
                                    </>
                                  ) : isPaused ? (
                                    <TouchableOpacity
                                      style={styles.methodTimerButton}
                                      onPress={() => handleTimerToggle(stepDuration, stepId)}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="play" size={16} color="#FFFFFF" />
                                      <Text style={styles.methodTimerButtonText}>RESUME</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.methodTimerButton}
                                      onPress={() => handleTimerToggle(stepDuration, stepId)}
                                      activeOpacity={0.8}
                                    >
                                      <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                                      <Text style={styles.methodTimerButtonText}>START TIMER</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            );
                          })()}
                        </View>
                      </View>

                      {/* Separator */}
                      {index < recipe.steps.length - 1 && (
                        <View style={styles.methodStepSeparator} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No instructions available</Text>
            )}
          </ScrollView>

          {/* Complete Recipe Button */}
          <View style={[styles.methodCompleteButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={styles.methodCompleteButton}
              onPress={async () => {
                setShowMethodBottomSheet(false);
                await handleRecipeCompletion();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.methodCompleteButtonText}>COMPLETE RECIPE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Completion Modal */}
      <Modal
        visible={showCompletionModal}
        transparent
        animationType="fade"
        onRequestClose={handleMaybeLater}
      >
        <TouchableWithoutFeedback onPress={handleMaybeLater}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.completionModal}>
                {/* Checkmark in Concentric Circles */}
                <View style={styles.clocheContainer}>
                  {/* Outer circle */}
                  <View style={[styles.concentricCircle, styles.outerCircle]}>
                    {/* Middle circle */}
                    <View style={[styles.concentricCircle, styles.middleCircle]}>
                      {/* Inner circle */}
                      <View style={[styles.concentricCircle, styles.innerCircle]}>
                        {/* Checkmark */}
                        <Ionicons name="checkmark" size={60} color="#FF6B35" />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Congrats Text */}
                <Text style={styles.congratsText}>Congrats Chef!</Text>

                {/* Action Buttons */}
                <View style={styles.completionActions}>
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={handleRateAndReview}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rateButtonText}>Rate & review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.maybeLaterButton}
                    onPress={handleMaybeLater}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.maybeLaterText}>Maybe later</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Full Recipe Bottom Sheet */}
      <BottomSheet
        visible={showFullRecipeBottomSheet}
        onClose={() => setShowFullRecipeBottomSheet(false)}
      >
        <View style={styles.fullRecipeContent}>
          <View style={styles.fullRecipeHeader}>
            <Text style={styles.fullRecipeTitle}>Full Recipe</Text>
            <TouchableOpacity
              style={styles.fullRecipeCloseButton}
              onPress={() => setShowFullRecipeBottomSheet(false)}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.fullRecipeScrollView} showsVerticalScrollIndicator={false}>
            {/* Ingredients */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <View style={styles.fullRecipeSection}>
                <Text style={styles.fullRecipeSectionTitle}>Ingredients</Text>
                {recipe.ingredients.map((ingredient, index) => (
                  <View key={ingredient.id || index} style={styles.fullRecipeIngredientItem}>
                    <Text style={styles.fullRecipeIngredientText}>
                      {ingredient.amount} {ingredient.unit || ''} {ingredient.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Instructions */}
            {recipe.steps && recipe.steps.length > 0 && (
              <View style={styles.fullRecipeSection}>
                <Text style={styles.fullRecipeSectionTitle}>Instructions</Text>
                {recipe.steps.map((step, index) => (
                  <View key={step.id || index} style={styles.fullRecipeStepItem}>
                    <View style={styles.fullRecipeStepNumber}>
                      <Text style={styles.fullRecipeStepNumberText}>{step.order || index + 1}</Text>
                    </View>
                    <View style={styles.fullRecipeStepContent}>
                      <Text style={styles.fullRecipeStepDescription}>{step.description}</Text>
                      {step.image && (
                        <Image source={{ uri: step.image }} style={styles.stepImage} resizeMode="cover" />
                      )}
                      {step.duration && (
                        <View style={styles.fullRecipeStepDuration}>
                          <Ionicons name="time-outline" size={14} color="#666666" />
                          <Text style={styles.fullRecipeStepDurationText}>{step.duration} min</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Recipe Options Bottom Sheet */}
      <BottomSheet
        visible={showRecipeOptionsBottomSheet}
        onClose={() => {
          setShowRecipeOptionsBottomSheet(false);
          setShowMealTypeSelection(false);
        }}
        height="55%"
      >
        {recipe && (
          <View style={styles.recipeOptionsContent}>
            {!showMealTypeSelection ? (
              <>
                {/* Recipe Header */}
                <View style={styles.recipeOptionsHeader}>
                  <View style={styles.recipeOptionsImageContainer}>
                    {recipe.image ? (
                      typeof recipe.image === 'string' ? (
                        <Image
                          source={{ uri: recipe.image }}
                          style={styles.recipeOptionsImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Image
                          source={recipe.image}
                          style={styles.recipeOptionsImage}
                          resizeMode="cover"
                        />
                      )
                    ) : (
                      <View style={styles.recipeOptionsImagePlaceholder}>
                        <Ionicons name="restaurant-outline" size={24} color="#CCCCCC" />
                      </View>
                    )}
                  </View>
                  <View style={styles.recipeOptionsHeaderText}>
                    <Text style={styles.recipeOptionsTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.recipeOptionsTime}>
                      {((recipe.prepTime || 0) + (recipe.cookTime || 0)) || '25'} min
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.recipeOptionsCloseButton}
                    onPress={() => {
                      setShowRecipeOptionsBottomSheet(false);
                      setShowMealTypeSelection(false);
                    }}
                  >
                    <Ionicons name="close" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>

                {/* Options List */}
                <View style={styles.recipeOptionsList}>
                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      setShowMealTypeSelection(true);
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>I'll cook this today</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      setShowRecipeOptionsBottomSheet(false);
                      // Navigate to IngredientSelection with a constructed meal plan item
                      // We use a temporary ID since it's not actually in the meal plan yet
                      navigation.navigate('IngredientSelection', {
                        selectedMealPlans: [{
                          mealPlanId: `temp-${Date.now()}`,
                          recipeId: recipe.id,
                          recipeTitle: recipe.title,
                          date: new Date().toISOString().split('T')[0], // Today's date as default
                          mealType: 'dinner', // Default callback
                        }]
                      });
                    }}
                  >
                    <Ionicons name="cart-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Add to groceries</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowRecipeOptionsBottomSheet(false);
                      setShowAddToMenuModal(true);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Add to planner</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      setShowRecipeOptionsBottomSheet(false);
                      setShowCollectionSelection(true);
                    }}
                  >
                    <Ionicons name="heart-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Add to My Recipes</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      // TODO: View Recipe Pack
                      setShowRecipeOptionsBottomSheet(false);
                    }}
                  >
                    <Ionicons name="layers-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>View Recipe Pack</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      // TODO: Your recipe notes
                      setShowRecipeOptionsBottomSheet(false);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Your recipe notes</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      // TODO: Share recipe
                      setShowRecipeOptionsBottomSheet(false);
                    }}
                  >
                    <Ionicons name="share-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Share recipe</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Meal Type Selection Header with Back Button */}
                <View style={styles.mealTypeHeader}>
                  <TouchableOpacity
                    style={styles.mealTypeBackButton}
                    onPress={() => setShowMealTypeSelection(false)}
                  >
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                  <Text style={styles.mealTypeTitle}>Select meal type</Text>
                  <View style={styles.mealTypeBackButton} />
                </View>

                {/* Meal Type Options */}
                <View style={styles.mealTypeList}>
                  {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => (
                    <TouchableOpacity
                      key={mealType}
                      style={styles.mealTypeItem}
                      onPress={() => {
                        const today = new Date();
                        const todayDate = formatDateKey(today);
                        const newMealPlan: MealPlanItem = {
                          id: `meal-${Date.now()}`,
                          recipeId: recipe.id,
                          recipeTitle: recipe.title,
                          recipeImage: typeof recipe.image === 'string'
                            ? recipe.image
                            : undefined,
                          mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                          date: todayDate,
                          includeInGrocery: true,
                          servingsOverride: servings,
                        };

                        addMealPlan(newMealPlan);

                        // Automatically add ingredients to groceries list if includeInGrocery is true
                        if (newMealPlan.includeInGrocery && recipe.ingredients && recipe.ingredients.length > 0) {
                          // Convert ExtendedRecipe ingredients to Ingredient format
                          const ingredients = recipe.ingredients.map(ing => ({
                            id: ing.id || `${Date.now()}-${Math.random()}`,
                            name: ing.name,
                            amount: ing.amount || '1',
                            unit: ing.unit,
                            icon: undefined,
                          }));

                          // Adjust ingredients based on servings if recipe has servings info
                          const recipeServings = recipe.servings || 4;
                          const adjustedIngredients = ingredients.map(ing => ({
                            ...ing,
                            amount: String(Number(ing.amount) * (servings / recipeServings)),
                          }));

                          // Create sources for each ingredient
                          const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
                            recipeId: recipe.id,
                            recipeTitle: recipe.title,
                            mealPlanEntryId: newMealPlan.id,
                            amount: ing.amount,
                          }));

                          addItems(adjustedIngredients, recipe.id, recipe.title, servings, sources);
                          console.log('🛒 Added ingredients to groceries list:', adjustedIngredients.length);
                        }

                        setShowRecipeOptionsBottomSheet(false);
                        setShowMealTypeSelection(false);
                      }}
                    >
                      <Text style={styles.mealTypeItemText}>
                        {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#999999" />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </BottomSheet>

      {/* Collection Selection Bottom Sheet */}
      <BottomSheet
        visible={showCollectionSelection}
        onClose={() => {
          setShowCollectionSelection(false);
          setShowCreateCollection(false);
          setNewCollectionName('');
        }}
        height="60%"
      >
        <View style={styles.collectionsContent}>
          {!showCreateCollection ? (
            <>
              {/* Header */}
              <View style={styles.collectionSelectionHeader}>
                <Text style={styles.collectionSelectionTitle}>Select Collections</Text>
                <Text style={styles.collectionSelectionSubtitle}>A recipe can be in multiple collections</Text>
              </View>

              {/* Collection Options */}
              {collections.map((collection, index) => {
                // Support both old cookbook format and new collections array format
                const currentCollections = recipe && (recipe as any).collections
                  ? (recipe as any).collections
                  : ((recipe as any).cookbook ? [(recipe as any).cookbook] : []);
                const isSelected = Array.isArray(currentCollections) && currentCollections.includes(collection);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.collectionOption,
                      isSelected && styles.collectionOptionSelected
                    ]}
                    onPress={async () => {
                      if (!recipe) return;

                      try {
                        // Toggle collection: add if not selected, remove if selected
                        const updatedCollections = isSelected
                          ? currentCollections.filter((col: string) => col !== collection)
                          : [...currentCollections, collection];

                        // Update recipe's collections property via backend
                        const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
                        await updateRecipeFunction({
                          recipeId: recipe.id,
                          collections: updatedCollections.length > 0 ? updatedCollections : [],
                        });

                        // Update local state
                        updateRecipe(recipe.id, { collections: updatedCollections });

                        // Update recipe state
                        setRecipe({ ...recipe, collections: updatedCollections } as ExtendedRecipe);

                        // Show success toast
                        if (isSelected) {
                          setToastMessage(`Removed from "${collection}"`);
                        } else {
                          setToastMessage(`Added to "${collection}"`);
                        }
                        setToastType('success');
                        setToastVisible(true);
                      } catch (error) {
                        console.error('Error updating recipe collection:', error);
                        setToastMessage('Failed to update collection');
                        setToastType('error');
                        setToastVisible(true);
                      }
                    }}
                  >
                    <View style={styles.collectionCheckbox}>
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                    <Text style={[
                      styles.collectionOptionText,
                      isSelected && styles.collectionOptionTextSelected
                    ]}>
                      {collection}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Create New Collection */}
              <TouchableOpacity
                style={styles.createCollectionButton}
                onPress={() => setShowCreateCollection(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#1A5B3D" />
                <Text style={styles.createCollectionButtonText}>Create new cookbook</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Create Collection Input */}
              <View style={styles.createCollectionHeader}>
                <TouchableOpacity
                  style={styles.createCollectionBackButton}
                  onPress={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.createCollectionTitle}>New Collection</Text>
                <View style={{ width: 40 }} />
              </View>

              <TextInput
                style={styles.createCollectionInput}
                placeholder="Collection name"
                placeholderTextColor="#999"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />

              <TouchableOpacity
                style={[
                  styles.createCollectionSaveButton,
                  !newCollectionName.trim() && styles.createCollectionSaveButtonDisabled
                ]}
                onPress={async () => {
                  if (!newCollectionName.trim() || !recipe) return;

                  try {
                    // Create new collection
                    await addCollection(newCollectionName.trim());

                    // Get current collections (support both old and new format)
                    const currentCollections = recipe && (recipe as any).collections
                      ? (recipe as any).collections
                      : ((recipe as any).cookbook ? [(recipe as any).cookbook] : []);
                    const updatedCollections = [...currentCollections, newCollectionName.trim()];

                    // Update recipe's collections property via backend
                    const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
                    await updateRecipeFunction({
                      recipeId: recipe.id,
                      collections: updatedCollections,
                    });

                    // Update local state
                    updateRecipe(recipe.id, { collections: updatedCollections });

                    // Update recipe state
                    setRecipe({ ...recipe, collections: updatedCollections } as ExtendedRecipe);

                    setNewCollectionName('');
                    setShowCreateCollection(false);
                    setShowCollectionSelection(false);

                    // Show success toast
                    setToastMessage(`Added to "${newCollectionName.trim()}"`);
                    setToastType('success');
                    setToastVisible(true);
                  } catch (error) {
                    console.error('Error creating collection and updating recipe:', error);
                    setToastMessage('Failed to create collection');
                    setToastType('error');
                    setToastVisible(true);
                  }
                }}
                disabled={!newCollectionName.trim()}
              >
                <Text style={[
                  styles.createCollectionSaveButtonText,
                  !newCollectionName.trim() && styles.createCollectionSaveButtonTextDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </BottomSheet>

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2000}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 0,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  stickyBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginHorizontal: 12,
    textAlign: 'center',
  },
  stickyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyEditButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyPlusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 0,
    marginTop: 0,
  },
  recipeImage: {
    width: '100%',
    height: 350,
    backgroundColor: '#F5F5F0',
  },
  contentBodyContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingTop: 24,
    paddingBottom: 20,
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: 350,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBackButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageEditButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePlusButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    paddingHorizontal: 20,
    marginBottom: 0,
    paddingBottom: 16,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 0,
    gap: 6,
  },
  tagsText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  descriptionContainer: {
    backgroundColor: '#F5F5F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 0,
    width: '100%',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  actionSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-start',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  twistsItem: {
    justifyContent: 'flex-end',
  },
  notesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    gap: 8,
  },
  notesText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  nutritionCard: {
    width: '22%',
    minWidth: 70,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nutritionHeader: {
    marginBottom: 12,
  },
  calculateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  calculateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chefTipsSection: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTopBorder: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 0,
  },
  instructionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  instructionsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepDescription: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  stepDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  stepDurationText: {
    fontSize: 14,
    color: '#666666',
  },
  sectionBottomBorder: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
    // marginTop: 16,
    marginBottom: 16,
  },
  chefTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  chefTipsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chefTipsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  chefTipsContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  chefTipItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingLeft: 4,
  },
  chefTipBullet: {
    fontSize: 16,
    color: '#1A1A1A',
    marginRight: 8,
    marginTop: 2,
  },
  chefTipTextContainer: {
    flex: 1,
  },
  chefTipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  chefTipText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    lineHeight: 20,
  },
  statsGrid: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  statItemNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  statText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  servingsButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  servingsTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginHorizontal: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'transparent',
    gap: 8,
    minWidth: 0,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: '#1A1A1A',
  },
  ingredientsList: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    minHeight: 40,
  },
  ingredientItemFirst: {
    borderTopWidth: 0,
  },
  ingredientIcon: {
    fontSize: 24,
    width: 32,
  },
  ingredientText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 20,
  },
  ingredientRowWithSeparator: {
    marginVertical: 0,
  },
  ingredientSeparator: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 44,
    height: 1,
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  expandButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  ingredientsDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  expandButtonWrapper: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: -10,
  },
  secondChevron: {
    marginTop: -10,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  equipmentList: {
    paddingHorizontal: 20,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  equipmentItemFirst: {
    borderTopWidth: 0,
  },
  equipmentRowWithSeparator: {
    marginVertical: 0,
  },
  equipmentSeparator: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 44,
    height: 1,
  },
  equipmentText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
  },
  equipmentImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 0,
  },
  stepImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  recipePackSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  recipePackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recipePackTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  recipePackCard: {
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 16,
  },
  recipePackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipePackName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  viewPackLink: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  recipePackDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  alsoLikeSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  alsoLikeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  alsoLikeCard: {
    width: 200,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  alsoLikeImageContainer: {
    width: '100%',
    height: 120,
  },
  alsoLikeImage: {
    width: '100%',
    height: '100%',
  },
  alsoLikeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 12,
  },
  alsoLikeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  alsoLikeCardRating: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    marginRight: 8,
  },
  alsoLikeCardTime: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  stepByStepButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    gap: 8,
  },
  stepByStepButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    gap: 8,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  addToMenuButton: {
    flex: 1,
    backgroundColor: '#FF6B35', // Accent color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  addToMenuText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  goToMenuButton: {
    flex: 1,
    backgroundColor: '#4CAF50', // Green color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  goToMenuText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  addToMenuModalContent: {
    padding: 20,
    paddingTop: 0,
    position: 'relative',
  },
  addToMenuCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  addToMenuImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  addToMenuImage: {
    width: '100%',
    height: '100%',
  },
  addToMenuImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  addToMenuTitleContainer: {
    backgroundColor: '#CEEC2C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'center',
  },
  addToMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  thisWeekSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekNavButton: {
    padding: 8,
  },
  weekNavButtonDisabled: {
    opacity: 0.3,
  },
  thisWeekContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thisWeekText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  addToMenuQuestion: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  mealTypeQuestion: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    flex: 1,
    minWidth: '45%',
  },
  mealTypeButtonSelected: {
    borderWidth: 2,
    backgroundColor: '#FAFAFA',
  },
  mealTypeButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  daySelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 4,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#CEEC2C',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
  dayButtonTextSelected: {
    fontWeight: '400',
    color: '#1A1A1A',
  },
  addToMenuSubmitButton: {
    backgroundColor: '#CEEC2C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addToMenuSubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  addToMenuSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCloseButton: {
    position: 'absolute',
    top: '30%',
    right: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    marginTop: -16,
  },
  modalContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: Dimensions.get('window').width * 0.75,
    height: Dimensions.get('window').width * 0.75,
    padding: 20,
    alignItems: 'center',
  },
  modalImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIngredientIcon: {
    fontSize: 80,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  // Private Notes Modal Styles
  notesModalContent: {
    height: '80%',
    paddingBottom: 20,
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  notesModalTitleContainer: {
    flex: 1,
  },
  notesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderRadius: 4,
  },
  notesModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInputContainer: {
    flex: 1,
    marginBottom: 20,
  },
  notesTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 200,
    maxHeight: 400,
    textAlignVertical: 'top',
  },
  saveNotesButton: {
    backgroundColor: '#CEEC2C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNotesButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  // Info Tab Content Styles
  infoContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoSectionFirst: {
    borderTopWidth: 0,
  },
  nutritionSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 16,
    marginBottom: 32,
  },
  infoDescription: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  infoNotesText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  // Method Bottom Sheet Styles
  methodContent: {
    flex: 1,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  methodTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  methodCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodScrollView: {
    flex: 1,
  },
  methodScrollViewContent: {
    paddingBottom: 40,
  },
  methodStepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  methodStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodStepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  methodStepContent: {
    flex: 1,
    gap: 4,
  },
  methodStepDescription: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  methodStepDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  methodStepDurationText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  methodStepsContainer: {
    paddingHorizontal: 20,
  },
  methodStepCard: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 20,
  },
  methodStepThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  methodStepThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  methodStepThumbnailIcon: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodStepCardContent: {
    flex: 1,
    gap: 8,
  },
  methodStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  methodStepSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  methodTimerContainer: {
    marginTop: 12,
  },
  methodTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  methodTimerDisplayInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodTimerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTimerTextInline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B35',
    letterSpacing: 0.5,
  },
  methodTimerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F0',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  methodTimerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: 0.5,
  },
  methodTimerButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  methodTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'flex-start',
  },
  methodTimerButtonSecondary: {
    backgroundColor: '#F5F5F0',
  },
  methodTimerButtonStop: {
    backgroundColor: '#FF6B35',
  },
  methodTimerButtonIconOnly: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 20,
  },
  methodTimerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  methodTimerButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  methodCompleteButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  methodCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 24,
    width: '100%',
  },
  methodCompleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Completion Modal Styles
  completionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    minHeight: '60%',
  },
  clocheContainer: {
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  concentricCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
  },
  outerCircle: {
    width: 160,
    height: 160,
    backgroundColor: '#FFF5F0',
  },
  middleCircle: {
    width: 120,
    height: 120,
    backgroundColor: '#FFE5D9',
  },
  innerCircle: {
    width: 90,
    height: 90,
    backgroundColor: '#FFD4C4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  congratsText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 48,
    textAlign: 'center',
  },
  completionActions: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  rateButton: {
    width: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  maybeLaterButton: {
    paddingVertical: 12,
  },
  maybeLaterText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF6B35',
  },
  // Full Recipe Bottom Sheet Styles
  fullRecipeContent: {
    height: '80%',
    paddingBottom: 20,
  },
  fullRecipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  fullRecipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  fullRecipeCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRecipeScrollView: {
    flex: 1,
  },
  fullRecipeSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  fullRecipeSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  fullRecipeIngredientItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  fullRecipeIngredientText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  fullRecipeStepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  fullRecipeStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fullRecipeStepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  fullRecipeStepContent: {
    flex: 1,
    gap: 4,
  },
  fullRecipeStepDescription: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  fullRecipeStepDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  fullRecipeStepDurationText: {
    fontSize: 14,
    color: '#666666',
  },
  // Recipe Pack Info Bottom Sheet Styles
  recipePackInfoContent: {
    paddingBottom: 20,
  },
  recipePackInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  recipePackInfoTitleContainer: {
    flex: 1,
  },
  recipePackInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  recipePackInfoTitleHighlight: {
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  recipePackInfoCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipePackInfoText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  // Recipe Options Bottom Sheet Styles
  recipeOptionsContent: {
    paddingBottom: 10,
  },
  recipeOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 4,
  },
  recipeOptionsImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#F5F5F0',
  },
  recipeOptionsImage: {
    width: '100%',
    height: '100%',
  },
  recipeOptionsImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeOptionsHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  recipeOptionsCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  recipeOptionsTime: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666666',
  },
  recipeOptionsList: {
    paddingTop: 4,
  },
  recipeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  recipeOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  // Meal Type Selection Styles
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  mealTypeBackButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  mealTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  mealTypeList: {
    paddingTop: 4,
  },
  mealTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  mealTypeItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  // Collection Selection Styles
  collectionsContent: {
    paddingVertical: 8,
  },
  collectionSelectionHeader: {
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  collectionSelectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  collectionSelectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
  collectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  collectionOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  collectionCheckbox: {
    marginRight: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  collectionOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  collectionOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  createCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  createCollectionButtonText: {
    fontSize: 16,
    color: '#1A5B3D',
    fontWeight: '500',
  },
  createCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  createCollectionBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  createCollectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  createCollectionInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E0E0DA',
  },
  createCollectionSaveButton: {
    backgroundColor: '#C6ED6E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCollectionSaveButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  createCollectionSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  createCollectionSaveButtonTextDisabled: {
    color: '#999999',
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

export default RecipeDetailScreen;
