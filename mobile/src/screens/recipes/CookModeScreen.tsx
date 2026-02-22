import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RootStackParamList } from '../../types/navigation';
import { Recipe, Step } from '../../types/recipe'; 
import { sampleRecipeExtended, ExtendedRecipe } from '../../../../docs/sampleRecipe';
import { IngredientIcon } from '../../components/IngredientIcon';
import { BottomSheet } from '../../components/BottomSheet';
import { useRecipesStore } from '../../stores/recipesStore';
import { db, auth } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { hasActiveSubscription } from '../../services/superwall';

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

type CookModeScreenRouteProp = RouteProp<RootStackParamList, 'CookMode'>;
type CookModeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CookMode'
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
    rating: 4.4,
    reviewCount: 0,
    equipment: equipment,
  };
};

// Extract ingredients mentioned in step description
const extractStepIngredients = (stepDescription: string, allIngredients: Recipe['ingredients']): Recipe['ingredients'] => {
  const descriptionLower = stepDescription.toLowerCase();
  return allIngredients.filter((ingredient) => {
    const nameLower = ingredient.name.toLowerCase();
    return descriptionLower.includes(nameLower);
  });
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

const CookModeScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CookModeScreenNavigationProp>();
  const route = useRoute<CookModeScreenRouteProp>();
  const { recipeId, showFullRecipe } = route.params;
  const { recipes } = useRecipesStore();

  // Recipe loading state
  const [recipe, setRecipe] = useState<ExtendedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All hooks must be called before any conditional returns (Rules of Hooks)
  const [showIngredientChecklist, setShowIngredientChecklist] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerIntervalId, setTimerIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showUpgradeBottomSheet, setShowUpgradeBottomSheet] = useState(false);
  const [showMenuBottomSheet, setShowMenuBottomSheet] = useState(false);
  const [showIngredientsBottomSheet, setShowIngredientsBottomSheet] = useState(false);
  const [showFullRecipeBottomSheet, setShowFullRecipeBottomSheet] = useState(showFullRecipe || false);
  const [audioGuideEnabled, setAudioGuideEnabled] = useState(false);
  const [ingredientsTab, setIngredientsTab] = useState<'ingredients' | 'equipment'>('ingredients');
  const [fullRecipeTab, setFullRecipeTab] = useState<'instructions' | 'ingredients'>('instructions');
  const [isLoadingUpgrade, setIsLoadingUpgrade] = useState(false);

  // Superwall hooks
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');

  const appState = useRef(AppState.currentState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepsScrollViewRef = useRef<ScrollView | null>(null);

  // Load recipe from Firestore or local store
  useEffect(() => {
    const loadRecipe = async () => {
      setIsLoading(true);
      setError(null);

      try { 

        // Check Zustand store (local recipes) - but prefer Firestore if local lacks duration
        const localRecipe = recipes.find((r) => r.id === recipeId);
        if (localRecipe) {
          // Check if local recipe steps have duration - if not, fetch from Firestore instead
          const hasDurationInSteps = localRecipe.steps?.some((step: any) => step.duration !== undefined && step.duration !== null);
          
          if (!hasDurationInSteps) {
            console.log('[CookMode] Local recipe found but steps lack duration, fetching from Firestore...');
            // Fall through to Firestore fetch below
          } else {
            // Convert Recipe to ExtendedRecipe, ensuring steps preserve duration
            const extendedRecipe: ExtendedRecipe = {
              ...localRecipe,
              steps: (localRecipe.steps || []).map((step: any) => ({
                id: step.id,
                order: step.order || 0,
                description: step.description || '',
                duration: step.duration, // Preserve duration field
                image: step.image,
              })),
              tags: Array.isArray(localRecipe.tags) ? localRecipe.tags.filter((tag: any) => tag && typeof tag === 'string' && tag.trim().length > 0) : [],
              category: undefined,
              rating: 4.4,
              reviewCount: 0,
              equipment: localRecipe.equipment ? localRecipe.equipment.map((eq: any) => ({
                id: eq.id,
                name: eq.name || eq,
                image: eq.image,
              })) : undefined,
            };
            console.log('[CookMode] Loaded from local store, steps with duration:', extendedRecipe.steps.map((s: any) => ({ order: s.order, duration: s.duration })));
            setRecipe(extendedRecipe);
            setIsLoading(false);
            return;
          }
        }

        // 4. Fetch from Firestore
        const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));
        
        if (recipeDoc.exists()) {
          const userRecipe = { id: recipeDoc.id, ...recipeDoc.data() } as any;
          
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
          console.log('[CookMode] Loaded from Firestore, steps with duration:', extendedRecipe.steps.map((s: any) => ({ order: s.order, duration: s.duration })));
          setRecipe(extendedRecipe);
        } else {
          throw new Error('Recipe not found');
        }
      } catch (error: any) {
        console.error('❌ Error loading recipe:', error);
        setError(error.message || 'Failed to load recipe');
        Alert.alert('Error', error.message || 'Failed to load recipe', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecipe();
  }, [recipeId, recipes, navigation]);

  // Show full recipe bottom sheet when showFullRecipe is true (after navigation)
  useEffect(() => {
    if (showFullRecipe) {
      // Small delay to ensure the screen is fully rendered
      const timer = setTimeout(() => {
        setShowFullRecipeBottomSheet(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showFullRecipe]);

  // Auto-scroll to current step in thumbnails (must be before early returns)
  useEffect(() => {
    if (!recipe) return;
    const sortedSteps = [...recipe.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (stepsScrollViewRef.current && sortedSteps.length > 0) {
      const stepWidth = 40 + 8; // button width + gap
      const scrollPosition = currentStepIndex * stepWidth - (Dimensions.get('window').width / 2) + (stepWidth / 2);
      stepsScrollViewRef.current.scrollTo({ x: Math.max(0, scrollPosition), animated: true });
    }
  }, [currentStepIndex, recipe]);

  // Timer management (must be before early returns)
  useEffect(() => {
    if (!recipe) return;
    const sortedSteps = [...recipe.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentStep = sortedSteps[currentStepIndex];
    
    // When switching to a step with a duration:
    // - If timer is not running, reset to the step's duration
    // - If timer is running, keep it running (don't reset)
    if (currentStep?.duration) {
      if (!isTimerRunning) {
        // Reset timer to this step's duration
        setTimerSeconds(currentStep.duration * 60); // Convert minutes to seconds
      }
    } else {
      // Step has no duration, clear timer if not running
      if (!isTimerRunning) {
        setTimerSeconds(null);
      }
    }
  }, [currentStepIndex, recipe, isTimerRunning]);

  useEffect(() => {
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setIsTimerRunning(false);
            // Timer finished - show notification
            Alert.alert('Timer Complete', `Step ${currentStepIndex + 1} timer has finished!`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, timerSeconds, currentStepIndex]);

  // Handle app state changes for background timer (must be before early returns)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isTimerRunning
      ) {
        // App has come to foreground, timer should still be running
        // Timer state is maintained by the interval
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isTimerRunning]);

  // Early returns for loading/error states (after all hooks)
  if (isLoading || !recipe) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate derived values after early returns (when recipe is guaranteed to exist)
  const sortedSteps = [...recipe.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
  const currentStep = sortedSteps[currentStepIndex];
  
  // Debug: Log current step and duration
  if (currentStep) {
    console.log('[CookMode] Current step:', {
      index: currentStepIndex,
      order: currentStep.order,
      description: currentStep.description?.substring(0, 50),
      duration: currentStep.duration,
      hasDuration: !!currentStep.duration,
    });
  }
  
  const stepIngredients = currentStep ? extractStepIngredients(currentStep.description, recipe.ingredients) : [];
  const isLastStep = currentStepIndex === sortedSteps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handlePreviousStep = () => {
    if (!isFirstStep) {
      // Don't reset timer when changing steps, keep it running
      // if (timerRef.current) {
      //   clearInterval(timerRef.current);
      //   timerRef.current = null;
      // }
      // setIsTimerRunning(false);
      // setTimerSeconds(null);
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleNextStep = async () => {
    if (!isLastStep) {
      // Don't reset timer when changing steps, keep it running
      // if (timerRef.current) {
      //   clearInterval(timerRef.current);
      //   timerRef.current = null;
      // }
      // setIsTimerRunning(false);
      // setTimerSeconds(null);
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Recipe complete - save to Firestore and check if first recipe
      await handleRecipeCompletion();
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

      // Update cooked status to Firestore (recipe was already marked as started when START was clicked)
      // This updates the cookedAt timestamp to reflect completion time
      const cookedDocRef = doc(db, 'userCookedRecipes', `${currentUser.uid}_${recipeId}`);
      await setDoc(cookedDocRef, {
        userId: currentUser.uid,
        recipeId: recipeId,
        cookedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(), // Track completion separately
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

  const handleRateAndReview = () => {
    setShowCompletionModal(false);
    setShowUpgradeBottomSheet(false);
    navigation.navigate('RateAndReview', { recipeId });
  };

  const handleMaybeLater = () => {
    setShowCompletionModal(false);
    setShowUpgradeBottomSheet(false);
    navigation.goBack();
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
      
      // Close the upgrade bottom sheet
      setShowUpgradeBottomSheet(false);
      // Show completion modal after paywall
      setShowCompletionModal(true);
    } catch (error) {
      console.error('❌ Error presenting Superwall paywall:', error);
      // Close upgrade bottom sheet and show completion modal even if error
      setShowUpgradeBottomSheet(false);
      setShowCompletionModal(true);
    } finally {
      setIsLoadingUpgrade(false);
    }
  };

  const handleIngredientPress = (ingredientId: string) => {
    setCheckedIngredients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ingredientId)) {
        newSet.delete(ingredientId);
      } else {
        newSet.add(ingredientId);
      }
      return newSet;
    });
  };

  const handleTimerToggle = () => {
    if (timerSeconds === null || timerSeconds === 0) {
      // Reset timer
      if (currentStep?.duration) {
        setTimerSeconds(currentStep.duration * 60);
        setIsTimerRunning(true);
      }
    } else {
      setIsTimerRunning((prev) => !prev);
    }
  };

  const handleTimerStop = () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (currentStep?.duration) {
      setTimerSeconds(currentStep.duration * 60);
    }
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStopwatchPress = () => {
    // Timer overlay removed - no action needed
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

  const getEquipmentIcon = (equipmentName: string): keyof typeof Ionicons.glyphMap => {
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

  const handleBack = () => {
    Alert.alert(
      'Exit Cook Mode?',
      'Your progress will be saved, but any active timers will be stopped.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            // Stop timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setIsTimerRunning(false);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleStartCooking = () => {
    // Recipe is already marked as started when user clicked "Yes" from the alert
    // Just start cooking
    setShowIngredientChecklist(false);
    setCurrentStepIndex(0);
  };

  const handleIngredientToggle = (ingredientId: string) => {
    setCheckedIngredients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ingredientId)) {
        newSet.delete(ingredientId);
      } else {
        newSet.add(ingredientId);
      }
      return newSet;
    });
  };

  // Show ingredient checklist screen first
  if (showIngredientChecklist) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={[]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.cookModeText}>Cook Mode</Text>
          </View>
          <View style={styles.headerCenter}>
            {/* Empty space for layout */}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleBack} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipe Title Below Header */}
        <View style={styles.recipeTitleContainer}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
        </View>

        {/* Ingredient Checklist Content */}
        <ScrollView 
          style={styles.checklistScrollView}
          contentContainerStyle={styles.checklistContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.checklistTitle}>Get your ingredients ready</Text>
          
          <View style={styles.ingredientsGrid}>
            {recipe.ingredients.map((ingredient) => {
              const isChecked = checkedIngredients.has(ingredient.id);
              return (
                <View
                  key={ingredient.id}
                  style={styles.ingredientChecklistItem}
                >
                  <View style={styles.ingredientIconWrapper}>
                    <TouchableOpacity
                      style={[styles.ingredientIconContainer, isChecked && styles.ingredientIconContainerChecked]}
                      onPress={() => handleIngredientToggle(ingredient.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.ingredientIconFill}>
                        <View style={styles.ingredientIconScaled}>
                          <View pointerEvents="none">
                            <IngredientIcon
                              name={ingredient.name}
                              type="whole"
                              checked={false}
                              size="large"
                              amount={ingredient.amount}
                              unit={ingredient.unit}
                            />
                          </View>
                        </View>
                        {isChecked && (
                          <View style={styles.checkmarkOverlay} pointerEvents="none">
                            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.ingredientChecklistLabel}>
                    {ingredient.amount} {ingredient.unit || ''} {ingredient.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Start Button */}
        <View style={[styles.startButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartCooking}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>START</Text>
          </TouchableOpacity>
        </View>

        {/* Full Recipe Bottom Sheet */}
        <BottomSheet
          visible={showFullRecipeBottomSheet}
          onClose={() => setShowFullRecipeBottomSheet(false)}
          height="100%"
        >
          <View style={[styles.fullRecipeContent, { paddingTop: insets.top }]}>
            <View style={styles.fullRecipeHeader}>
              <Text style={styles.fullRecipeTitle}>Instructions</Text>
              <TouchableOpacity
                style={styles.fullRecipeCloseButton}
                onPress={() => setShowFullRecipeBottomSheet(false)}
              >
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.fullRecipeScrollView} 
              contentContainerStyle={[styles.fullRecipeScrollViewContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Instructions */}
              {recipe.steps && recipe.steps.length > 0 && (
                <View style={styles.fullRecipeSection}>
                  {recipe.steps.map((step, index) => {
                    // Extract title from step description (first sentence or first few words)
                    const description = step.description || '';
                    const titleMatch = description.match(/^([^.!?]+[.!?]?)/);
                    const title = titleMatch ? titleMatch[1].trim() : `Step ${step.order || index + 1}`;
                    const remainingText = titleMatch ? description.substring(titleMatch[0].length).trim() : description;
                    
                    return (
                      <React.Fragment key={step.id || index}>
                        <View style={styles.fullRecipeStepCard}>
                          {/* Thumbnail */}
                          <View style={styles.fullRecipeStepThumbnail}>
                            {step.image ? (
                              <Image 
                                source={{ uri: step.image }} 
                                style={styles.fullRecipeStepThumbnailImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.fullRecipeStepThumbnailIcon}>
                                <Ionicons name={getStepIcon(description)} size={24} color="#FF6B35" />
                              </View>
                            )}
                          </View>
                          
                          {/* Content */}
                          <View style={styles.fullRecipeStepCardContent}>
                            {/* Title */}
                            <Text style={styles.fullRecipeStepTitle}>{title}</Text>
                            
                            {/* Description */}
                            {remainingText && (
                              <Text style={styles.fullRecipeStepDescription}>{remainingText}</Text>
                            )}
                            
                            {/* Timer Button */}
                            {step.duration && step.duration > 0 && (
                              <TouchableOpacity
                                style={styles.fullRecipeTimerButton}
                                onPress={() => {
                                  // Start timer for this step
                                  if (step.duration) {
                                    setTimerSeconds(step.duration * 60);
                                    setIsTimerRunning(true);
                                  }
                                }}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.fullRecipeTimerButtonText}>START TIMER</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        
                        {/* Separator */}
                        {index < recipe.steps.length - 1 && (
                          <View style={styles.fullRecipeStepSeparator} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            
            {/* Complete Recipe Button */}
            <View style={[styles.fullRecipeCompleteButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <TouchableOpacity
                style={styles.fullRecipeCompleteButton}
                onPress={async () => {
                  setShowFullRecipeBottomSheet(false);
                  await handleRecipeCompletion();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.fullRecipeCompleteButtonText}>COMPLETE RECIPE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  if (!currentStep) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No steps available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={[]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          {/* Stopwatch or Cook Mode */}
          {timerSeconds !== null && timerSeconds > 0 ? (
            <TouchableOpacity
              style={styles.stopwatchButton}
              onPress={handleStopwatchPress}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color="#1A1A1A" />
              <Text style={styles.stopwatchText}>{formatTimer(timerSeconds)}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cookModeText}>Cook Mode</Text>
          )}
        </View>
        <View style={styles.headerCenter}>
          {/* Empty space for layout */}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowMenuBottomSheet(true)} style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBack} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Recipe Title Below Header */}
      <View style={styles.recipeTitleContainer}>
        <Text style={styles.recipeTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Step Image or Large Step Icon */}
        {currentStep.image ? (
          <Image 
            source={{ uri: currentStep.image }} 
            style={styles.stepImage} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.stepIconContainer}>
            <Ionicons name={getStepIcon(currentStep.description)} size={80} color="#FF6B35" />
          </View>
        )}

        {/* Step Title */}
        <Text style={styles.stepTitle}>Step {currentStep.order || currentStepIndex + 1}</Text>

        {/* Instruction Text */}
        <Text style={styles.instructionText}>{currentStep.description}</Text>

        {/* Related Ingredient Chips */}
        {stepIngredients.length > 0 && (
          <View style={styles.ingredientsContainer}>
            {stepIngredients.map((ingredient) => (
              <View
                key={ingredient.id}
                style={[
                  styles.ingredientChip,
                  checkedIngredients.has(ingredient.id) && styles.ingredientChipChecked,
                ]}
              >
                <IngredientIcon
                  name={ingredient.name}
                  type="whole"
                  checked={checkedIngredients.has(ingredient.id)}
                  onPress={() => handleIngredientPress(ingredient.id)}
                  size="small"
                />
                <Text
                  style={[
                    styles.ingredientChipText,
                    checkedIngredients.has(ingredient.id) && styles.ingredientChipTextChecked,
                  ]}
                >
                  {ingredient.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action Area (Bottom) */}
      <View
        style={[
          styles.actionArea,
          {
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        {/* Timer Section */}
        {/* Timer and Start Button */}
        {currentStep?.duration && (
          <View style={styles.timerSection}>
            <View style={styles.timerDisplay}>
              <Ionicons name="time-outline" size={24} color="#FF6B35" />
              <Text style={styles.timerText}>
                {formatTimer(timerSeconds !== null ? timerSeconds : currentStep.duration * 60)}
              </Text>
            </View>
            <View style={styles.timerControls}>
              {isTimerRunning ? (
                <TouchableOpacity
                  style={styles.timerPauseButton}
                  onPress={handleTimerToggle}
                >
                  <Ionicons name="pause" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : timerSeconds !== null && timerSeconds > 0 && timerSeconds < (currentStep.duration * 60) ? (
                <TouchableOpacity
                  style={styles.timerPauseButton}
                  onPress={handleTimerToggle}
                >
                  <Ionicons name="play" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.timerButton, styles.timerButtonPrimary]}
                  onPress={handleTimerToggle}
                >
                  <Ionicons name="play" size={20} color="#FFFFFF" />
                  <Text style={styles.timerButtonText}>Start Timer</Text>
                </TouchableOpacity>
              )}
              {(isTimerRunning || (timerSeconds !== null && timerSeconds > 0 && timerSeconds < (currentStep.duration * 60))) && (
                <TouchableOpacity
                  style={[styles.timerButton, styles.timerButtonSecondary]}
                  onPress={handleTimerStop}
                >
                  <Ionicons name="stop" size={20} color="#FF6B35" />
                  <Text style={[styles.timerButtonText, styles.timerButtonTextSecondary]}>
                    Stop
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSecondary, isFirstStep && styles.navButtonDisabled]}
            onPress={handlePreviousStep}
            disabled={isFirstStep}
          >
            <Ionicons name="chevron-back" size={24} color={isFirstStep ? '#999' : '#1A1A1A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRecipe]}
            onPress={() => setShowFullRecipeBottomSheet(true)}
          >
            <Text style={styles.navButtonRecipeText}>Instructions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, isLastStep ? styles.navButtonComplete : styles.navButtonPrimary]}
            onPress={handleNextStep}
          >
            {isLastStep ? (
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            ) : (
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Step Navigation Thumbnails */}
        <View style={styles.stepsThumbnailsContainer}>
          <ScrollView
            ref={stepsScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepsThumbnailsContent}
          >
            {sortedSteps.map((step, index) => {
              const stepNumber = step.order || index + 1;
              const isActive = index === currentStepIndex;
              return (
                <TouchableOpacity
                  key={step.id || index}
                  style={[
                    styles.stepThumbnail,
                    isActive && styles.stepThumbnailActive,
                  ]}
                  onPress={() => setCurrentStepIndex(index)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.stepThumbnailText,
                    isActive && styles.stepThumbnailTextActive,
                  ]}>
                    {stepNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Upgrade Bottom Sheet */}
      <BottomSheet
        visible={showUpgradeBottomSheet}
        onClose={() => {
          setShowUpgradeBottomSheet(false);
          setShowCompletionModal(true);
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
                setShowCompletionModal(true);
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

      {/* Menu Bottom Sheet */}
      <BottomSheet
        visible={showMenuBottomSheet}
        onClose={() => setShowMenuBottomSheet(false)}
        height="35%"
      >
        <View style={styles.menuBottomSheetContent}>
          {/* Close Button */}
          <View style={styles.menuBottomSheetHeader}>
            <View style={styles.menuBottomSheetHeaderSpacer} />
            <TouchableOpacity
              style={styles.menuBottomSheetCloseButton}
              onPress={() => setShowMenuBottomSheet(false)}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Audio Guide */}
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="volume-high-outline" size={24} color="#1A1A1A" />
              <Text style={styles.menuItemText}>Audio Guide</Text>
            </View>
            <TouchableOpacity
              onPress={() => setAudioGuideEnabled(!audioGuideEnabled)}
              style={styles.toggleContainer}
            >
              <Text style={[styles.toggleText, audioGuideEnabled && styles.toggleTextActive]}>
                {audioGuideEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ingredients */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenuBottomSheet(false);
              setShowIngredientsBottomSheet(true);
            }}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="bag-outline" size={24} color="#1A1A1A" />
              <Text style={styles.menuItemText}>Ingredients</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>

          {/* Report an Error */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubble-outline" size={24} color="#1A1A1A" />
              <Text style={styles.menuItemText}>Report an Error</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Ingredients Bottom Sheet */}
      <BottomSheet
        visible={showIngredientsBottomSheet}
        onClose={() => setShowIngredientsBottomSheet(false)}
        height="75%"
      >
        <View style={styles.ingredientsBottomSheetContent}>
          {/* Tabs */}
          <View style={styles.ingredientsTabs}>
            <TouchableOpacity
              style={[styles.ingredientsTab, ingredientsTab === 'ingredients' && styles.ingredientsTabActive]}
              onPress={() => setIngredientsTab('ingredients')}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={ingredientsTab === 'ingredients' ? '#1A1A1A' : '#666666'}
              />
              <Text style={[styles.ingredientsTabText, ingredientsTab === 'ingredients' && styles.ingredientsTabTextActive]}>
                INGREDIENTS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ingredientsTab, ingredientsTab === 'equipment' && styles.ingredientsTabActive]}
              onPress={() => setIngredientsTab('equipment')}
            >
              <Ionicons
                name="construct-outline"
                size={18}
                color={ingredientsTab === 'equipment' ? '#1A1A1A' : '#666666'}
              />
              <Text style={[styles.ingredientsTabText, ingredientsTab === 'equipment' && styles.ingredientsTabTextActive]}>
                EQUIPMENT
              </Text>
            </TouchableOpacity>
          </View>

          {/* Separator below tabs */}
          <View style={styles.ingredientsBottomSheetSeparator} />

          {/* Content */}
          {ingredientsTab === 'ingredients' ? (
            <View style={styles.ingredientsList}>
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                recipe.ingredients.map((ingredient, index, array) => (
                  <React.Fragment key={ingredient.id}>
                    <View style={styles.ingredientListItem}>
                      <TouchableOpacity
                        onPress={() => {
                          // TODO: Handle ingredient image tap
                        }}
                      >
                        <Text style={styles.ingredientIcon}>
                          {getIngredientIcon(ingredient.name, ingredient.icon)}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.ingredientName}>
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
                ))
              ) : (
                <Text style={styles.emptyText}>No ingredients listed</Text>
              )}
            </View>
          ) : (
            <View style={styles.equipmentList}>
              {recipe.equipment && recipe.equipment.length > 0 ? (
                recipe.equipment.map((item, index, array) => {
                  const equipmentName = typeof item === 'string' ? item : item.name;
                  const equipmentImage = typeof item === 'object' ? item.image : undefined;
                  
                  return (
                    <React.Fragment key={index}>
                      <View style={styles.equipmentItem}>
                        {equipmentImage ? (
                          <Image source={{ uri: equipmentImage }} style={styles.equipmentImage} />
                        ) : (
                          <Ionicons name={getEquipmentIcon(equipmentName)} size={20} color="#1A1A1A" />
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
                })
              ) : (
                <Text style={styles.emptyText}>No equipment listed</Text>
              )}
            </View>
          )}
        </View>
      </BottomSheet>

      {/* Full Recipe Bottom Sheet */}
      <BottomSheet
        visible={showFullRecipeBottomSheet}
        onClose={() => setShowFullRecipeBottomSheet(false)}
        height="100%"
      >
        <View style={[styles.fullRecipeContent, { paddingTop: insets.top }]}>
          <View style={styles.fullRecipeHeader}>
            <Text style={styles.fullRecipeTitle}>Full Recipe</Text>
            <TouchableOpacity
              style={styles.fullRecipeCloseButton}
              onPress={() => setShowFullRecipeBottomSheet(false)}
            >
              <Ionicons name="close" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          
          {/* Tabs */}
          <View style={styles.fullRecipeTabs}>
            <TouchableOpacity
              style={[styles.fullRecipeTab, fullRecipeTab === 'instructions' && styles.fullRecipeTabActive]}
              onPress={() => setFullRecipeTab('instructions')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={fullRecipeTab === 'instructions' ? '#1A1A1A' : '#666666'}
              />
              <Text style={[styles.fullRecipeTabText, fullRecipeTab === 'instructions' && styles.fullRecipeTabTextActive]}>
                INSTRUCTIONS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fullRecipeTab, fullRecipeTab === 'ingredients' && styles.fullRecipeTabActive]}
              onPress={() => setFullRecipeTab('ingredients')}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={fullRecipeTab === 'ingredients' ? '#1A1A1A' : '#666666'}
              />
              <Text style={[styles.fullRecipeTabText, fullRecipeTab === 'ingredients' && styles.fullRecipeTabTextActive]}>
                INGREDIENTS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Separator below tabs */}
          <View style={styles.fullRecipeSeparator} />

          <ScrollView 
            style={styles.fullRecipeScrollView} 
            contentContainerStyle={[styles.fullRecipeScrollViewContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {fullRecipeTab === 'instructions' ? (
              /* Instructions */
              recipe.steps && recipe.steps.length > 0 && (
                <View style={styles.fullRecipeSection}>
                  {recipe.steps.map((step, index) => {
                    // Extract title from step description (first sentence or first few words)
                    const description = step.description || '';
                    const titleMatch = description.match(/^([^.!?]+[.!?]?)/);
                    const title = titleMatch ? titleMatch[1].trim() : `Step ${step.order || index + 1}`;
                    const remainingText = titleMatch ? description.substring(titleMatch[0].length).trim() : description;
                    
                    return (
                      <React.Fragment key={step.id || index}>
                        <View style={styles.fullRecipeStepCard}>
                          {/* Thumbnail */}
                          <View style={styles.fullRecipeStepThumbnail}>
                            {step.image ? (
                              <Image 
                                source={{ uri: step.image }} 
                                style={styles.fullRecipeStepThumbnailImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.fullRecipeStepThumbnailIcon}>
                                <Ionicons name={getStepIcon(description)} size={24} color="#FF6B35" />
                              </View>
                            )}
                          </View>
                          
                          {/* Content */}
                          <View style={styles.fullRecipeStepCardContent}>
                            {/* Title */}
                            <Text style={styles.fullRecipeStepTitle}>{title}</Text>
                            
                            {/* Description */}
                            {remainingText && (
                              <Text style={styles.fullRecipeStepDescription}>{remainingText}</Text>
                            )}
                            
                            {/* Timer Button */}
                            {step.duration && step.duration > 0 && (
                              <TouchableOpacity
                                style={styles.fullRecipeTimerButton}
                                onPress={() => {
                                  // Start timer for this step
                                  if (step.duration) {
                                    setTimerSeconds(step.duration * 60);
                                    setIsTimerRunning(true);
                                  }
                                }}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.fullRecipeTimerButtonText}>START TIMER</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        
                        {/* Separator */}
                        {index < recipe.steps.length - 1 && (
                          <View style={styles.fullRecipeStepSeparator} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              )
            ) : (
              /* Ingredients */
              <View style={styles.fullRecipeSection}>
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  recipe.ingredients.map((ingredient, index, array) => (
                    <React.Fragment key={ingredient.id}>
                      <View style={styles.fullRecipeIngredientItem}>
                        <TouchableOpacity
                          onPress={() => {
                            // TODO: Handle ingredient image tap
                          }}
                        >
                          <Text style={styles.fullRecipeIngredientIcon}>
                            {getIngredientIcon(ingredient.name, ingredient.icon)}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.fullRecipeIngredientText}>
                          {ingredient.name} {ingredient.amount}
                          {ingredient.unit ? ` ${ingredient.unit}` : ''}
                        </Text>
                      </View>
                      {index < array.length - 1 && (
                        <View style={styles.fullRecipeIngredientSeparator}>
                          <View style={styles.separatorLine} />
                        </View>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No ingredients listed</Text>
                )}
              </View>
            )}
          </ScrollView>
          
          {/* Complete Recipe Button - Only show on instructions tab */}
          {fullRecipeTab === 'instructions' && (
            <View style={[styles.fullRecipeCompleteButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <TouchableOpacity
                style={styles.fullRecipeCompleteButton}
                onPress={async () => {
                  setShowFullRecipeBottomSheet(false);
                  await handleRecipeCompletion();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.fullRecipeCompleteButtonText}>COMPLETE RECIPE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '500',
  },
  backButton: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  stopwatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 182, 193, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  stopwatchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cookModeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  recipeTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    padding: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  stepIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  stepImage: {
    width: 280,
    height: 280,
    borderRadius: 20,
    marginBottom: 32,
    backgroundColor: '#F5F5F0',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
  },
  ingredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ingredientChipChecked: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  ingredientChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  ingredientChipTextChecked: {
    color: '#2E7D32',
    textDecorationLine: 'line-through',
  },
  stepsThumbnailsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  stepsThumbnailsContent: {
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stepThumbnailActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1A1A1A',
  },
  stepThumbnailText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  stepThumbnailTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  actionArea: {
    paddingHorizontal: 24,
    paddingTop: 24,
    // borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  timerPauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  timerButtonPrimary: {
    backgroundColor: '#FF6B35',
  },
  timerButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerButtonTextSecondary: {
    color: '#FF6B35',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  navButtonSecondary: {
    backgroundColor: '#F5F5F0',
  },
  navButtonPrimary: {
    backgroundColor: '#1A1A1A',
  },
  navButtonComplete: {
    backgroundColor: '#4CAF50',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  navButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
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
  // Menu Bottom Sheet Styles
  menuBottomSheetContent: {
    paddingBottom: 20,
  },
  menuBottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  menuBottomSheetHeaderSpacer: {
    flex: 1,
  },
  menuBottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  toggleContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F0',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  toggleTextActive: {
    color: '#4CAF50',
  },
  // Ingredients Bottom Sheet Styles
  ingredientsBottomSheetContent: {
    flex: 1,
    paddingBottom: 20,
  },
  ingredientsTabs: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  ingredientsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ingredientsTabActive: {
    backgroundColor: '#F5F5F0',
    borderColor: 'transparent',
  },
  ingredientsTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  ingredientsTabTextActive: {
    color: '#1A1A1A',
  },
  ingredientsBottomSheetSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
  },
  ingredientsList: {
    flex: 1,
  },
  ingredientListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    minHeight: 40,
  },
  ingredientIcon: {
    fontSize: 24,
    width: 32,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 20,
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
  equipmentList: {
    flex: 1,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    minHeight: 40,
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
  equipmentSeparator: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 44,
    height: 1,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 40,
  },
  // Ingredient Checklist Screen Styles
  checklistScrollView: {
    flex: 1,
  },
  checklistContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  checklistTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 32,
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  ingredientChecklistItem: {
    flex: 1,
    minWidth: '48%',
    maxWidth: '48%',
    alignItems: 'center',
    marginBottom: 24,
  },
  ingredientIconWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ingredientIconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ingredientIconContainerChecked: {
    backgroundColor: '#FFF5F0',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  ingredientIconFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ingredientIconScaled: {
    transform: [{ scale: 2.5 }], // Scale up the 48px icon to ~120px
    borderRadius: 60,
    overflow: 'hidden',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(129, 199, 132, 0.4)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  ingredientChecklistLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 16,
  },
  startButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 12,
  },
  viewRecipeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#F5F5F0',
  },
  viewRecipeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  startButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  navButtonRecipe: {
    backgroundColor: '#F5F5F0',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  navButtonRecipeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Full Recipe Bottom Sheet Styles
  fullRecipeContent: {
    flex: 1,
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
  fullRecipeTabs: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  fullRecipeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fullRecipeTabActive: {
    backgroundColor: '#F5F5F0',
    borderColor: 'transparent',
  },
  fullRecipeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  fullRecipeTabTextActive: {
    color: '#1A1A1A',
  },
  fullRecipeSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  fullRecipeScrollView: {
    flex: 1,
  },
  fullRecipeScrollViewContent: {
    paddingBottom: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    minHeight: 40,
  },
  fullRecipeIngredientIcon: {
    fontSize: 24,
    width: 32,
  },
  fullRecipeIngredientText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 20,
  },
  fullRecipeIngredientSeparator: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 44,
    height: 1,
  },
  fullRecipeStepCard: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 20,
  },
  fullRecipeStepThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  fullRecipeStepThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  fullRecipeStepThumbnailIcon: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRecipeStepCardContent: {
    flex: 1,
    gap: 8,
  },
  fullRecipeStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  fullRecipeStepDescription: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  fullRecipeStepSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
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
  fullRecipeTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  fullRecipeTimerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  fullRecipeCompleteButtonContainer: {
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
  fullRecipeCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 24,
    width: '100%',
  },
  fullRecipeCompleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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

export default CookModeScreen;

