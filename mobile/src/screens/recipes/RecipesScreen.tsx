import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Animated, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';
import { useTheme } from '../../theme/ThemeProvider';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { GrocerySource } from '../../types/grocery';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { sampleRecipe } from '../../data/sampleRecipe';
import { starterRecipes } from '../../data/starterRecipes';
import { BottomSheet } from '../../components/BottomSheet';
import { Toast } from '../../components/Toast';
import { Recipe } from '../../types/recipe';
import { useModal } from '../../context/ModalContext';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, db, auth, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RecipesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Recipes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RecipesScreenProps {
  navigation: RecipesScreenNavigationProp;
}

const RecipesScreen: React.FC<RecipesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { recipes, addRecipe, setRecipes, updateRecipe, loadRecipesFromFirebase } = useRecipesStore();
  const { collections, addCollection } = useCollectionsStore();
  const { mealPlans, addMealPlan } = useMealPlanStore();
  const { items: groceryItems, recipes: groceryRecipes, addItems } = useGroceriesStore();
  const { showImportModal } = useModal();
  const { dietaryPreference, intolerances, favouriteCuisines, dislikesAllergies } = useUserPreferencesStore();
  const { readMessageIds } = useNotificationsStore();

  const [notificationIds, setNotificationIds] = useState<string[]>([]);
  const hasUnread = notificationIds.some(id => !readMessageIds.includes(id));

  console.log('[DEBUG NOTIFICATIONS] RecipesScreen render:', {
    notificationIdsCount: notificationIds.length,
    readMessageIdsCount: readMessageIds.length,
    hasUnread,
    firstFewNotificationIds: notificationIds.slice(0, 3)
  });

  useEffect(() => {
    // Listen for incoming notifications to update the unread dot
    const q = query(
      collection(db, 'notifications'),
      orderBy('scheduledFor', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids: string[] = [];
      const now = new Date();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledFor = (data.scheduledFor as Timestamp)?.toDate();
        // Only count as unread if it's already scheduled to be sent
        if (scheduledFor && scheduledFor <= now) {
          ids.push(doc.id);
        }
      });
      console.log(`[DEBUG NOTIFICATIONS] Snapshot listener found ${ids.length} valid notifications.`);
      setNotificationIds(ids);
    }, (error) => {
      console.error('RecipesScreen notification listener error:', error);
    });
    return () => unsubscribe();
  }, []);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterBy, setFilterBy] = useState<'recipes' | 'packs'>('recipes');
  const [showAddToMenuModal, setShowAddToMenuModal] = useState(false);
  const [selectedRecipeForMenu, setSelectedRecipeForMenu] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [imageUrls, setImageUrls] = useState<{ [recipeId: string]: string }>({});
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSousChefMenu, setShowSousChefMenu] = useState(false);
  const [showInspirationBottomSheet, setShowInspirationBottomSheet] = useState(false);
  const [showInspirationAnimation, setShowInspirationAnimation] = useState(true);
  const [filteredInspirationRecipes, setFilteredInspirationRecipes] = useState<Recipe[]>([]);
  const [isLoadingInspiration, setIsLoadingInspiration] = useState(false);
  const [showUseUpIngredientsBottomSheet, setShowUseUpIngredientsBottomSheet] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [useUpIngredientsResultsShown, setUseUpIngredientsResultsShown] = useState(false);
  const [useUpIngredientsRecipes, setUseUpIngredientsRecipes] = useState<Recipe[]>([]);
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);
  const [challengeProgress, setChallengeProgress] = useState<{ [key: string]: number }>({});
  const [showMealPlanBottomSheet, setShowMealPlanBottomSheet] = useState(false);
  const [mealPlanQuantity, setMealPlanQuantity] = useState(3);
  const [selectedDietaryPreference, setSelectedDietaryPreference] = useState<string>('');
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [dislikeSearchQuery, setDislikeSearchQuery] = useState('');
  const [mealPlanGenerated, setMealPlanGenerated] = useState(false);
  const [isGeneratingMealPlan, setIsGeneratingMealPlan] = useState(false);
  const [generatedMealPlanRecipes, setGeneratedMealPlanRecipes] = useState<Recipe[]>([]);
  const [mealPlanServings, setMealPlanServings] = useState<{ [recipeId: string]: number }>({});
  const [showIngredientSearchScreen, setShowIngredientSearchScreen] = useState(false);
  const [ingredientSearchScreenQuery, setIngredientSearchScreenQuery] = useState('');
  const [selectedSearchIngredients, setSelectedSearchIngredients] = useState<string[]>([]);
  const [ingredientSearchContext, setIngredientSearchContext] = useState<'use-up' | 'meal-plan'>('use-up');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showCollectionSelection, setShowCollectionSelection] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedRecipeForCollection, setSelectedRecipeForCollection] = useState<Recipe | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Challenges state
  interface Challenge {
    id: string;
    title: string;
    description: string;
    participants: number;
    profileEmoji: string;
    backgroundColor: string;
    recipeCount: number;
  }
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Refresh recipes (pull-to-refresh or when switching back to this tab)
  const handleRefresh = useCallback(async () => {
    if (!auth.currentUser) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    try {
      await loadRecipesFromFirebase();
    } catch (error) {
      console.error('Error refreshing recipes:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRecipesFromFirebase]);

  // When user switches back to Recipes tab, refresh so new admin recipes show
  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) {
        loadRecipesFromFirebase();
      }
    }, [loadRecipesFromFirebase])
  );

  // Fetch challenges
  useEffect(() => {
    const q = collection(db, 'challenges');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChallenges: Challenge[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedChallenges.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          participants: data.participants || 0,
          profileEmoji: data.profileEmoji,
          backgroundColor: data.backgroundColor,
          recipeCount: data.recipeCount,
        });
      });
      setChallenges(fetchedChallenges);
    }, (error) => {
      console.error("Error fetching challenges:", error);
    });
    return () => unsubscribe();
  }, []);

  // Shared ingredient list
  const ALL_INGREDIENTS = [
    { id: 'egg', label: 'Egg', icon: '🥚' },
    { id: 'gnocchi', label: 'Gnocchi', icon: '🍝' },
    { id: 'gochujang', label: 'Gochujang', icon: '🌶️' },
    { id: 'miso', label: 'Miso Paste', icon: '🍯' },
    { id: 'mushrooms', label: 'Mushrooms', icon: '🍄' },
    { id: 'pasta', label: 'Pasta', icon: '🍝' },
    { id: 'potato', label: 'Potato', icon: '🥔' },
    { id: 'spinach', label: 'Spinach', icon: '🥬' },
    { id: 'tofu', label: 'Tofu', icon: '🧈' },
    { id: 'chicken', label: 'Chicken', icon: '🍗' },
    { id: 'salmon', label: 'Salmon', icon: '🐟' },
    { id: 'onion', label: 'Onion', icon: '🧅' },
    { id: 'garlic', label: 'Garlic', icon: '🧄' },
    { id: 'tomato', label: 'Tomato', icon: '🍅' },
    { id: 'carrot', label: 'Carrot', icon: '🥕' },
    { id: 'rice', label: 'Rice', icon: '🌾' },
    { id: 'cheese', label: 'Cheese', icon: '🧀' },
    { id: 'bell-pepper', label: 'Bell Pepper', icon: '🫑' },
  ];

  // Animation values for inspiration
  // Animation refs for inspiration animation
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  // Helper to check if a string is a storage path (not a URL)
  const isStoragePath = (image: string): boolean => {
    return typeof image === 'string' &&
      !image.startsWith('http://') &&
      !image.startsWith('https://') &&
      !image.startsWith('file://') &&
      !image.startsWith('content://') &&
      image.includes('/');
  };

  // Convert storage path to download URL
  const getImageUrl = async (recipeId: string, image: string | any): Promise<string | null> => {
    // If already cached, return it
    if (imageUrls[recipeId]) {
      return imageUrls[recipeId];
    }

    // If not a string, return null (it's a require() result)
    if (typeof image !== 'string') {
      return null;
    }

    // If it's already a URL, cache and return it
    if (image.startsWith('http://') || image.startsWith('https://')) {
      setImageUrls(prev => ({ ...prev, [recipeId]: image }));
      return image;
    }

    // If it's a storage path, convert to download URL
    if (isStoragePath(image)) {
      try {
        const storageRef = ref(storage, image);
        const downloadURL = await getDownloadURL(storageRef);
        setImageUrls(prev => ({ ...prev, [recipeId]: downloadURL }));
        return downloadURL;
      } catch (error) {
        console.error('Error getting download URL for recipe', recipeId, ':', error);
        return null;
      }
    }

    return null;
  };

  // Clean up recipes that don't exist in Firebase
  useEffect(() => {
    const cleanupInvalidRecipes = async () => {
      if (recipes.length === 0) {
        addRecipe(sampleRecipe);
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        // If not logged in, keep only starter recipes and sample recipe
        const validRecipes = recipes.filter(recipe => {
          // Keep starter recipes and sample recipe
          const isStarter = starterRecipes.some(sr => sr.id === recipe.id);
          const isSample = recipe.id === 'sample-jerk-pork';
          return isStarter || isSample;
        });
        if (validRecipes.length !== recipes.length) {
          console.log('🧹 Cleaning up invalid recipes (not logged in)');
          setRecipes(validRecipes.length > 0 ? validRecipes : [sampleRecipe]);
        }
        return;
      }

      // Check which recipes exist in Firebase
      const recipeValidationPromises = recipes.map(async (recipe) => {
        // Skip starter recipes and sample recipe - they're always valid
        const isStarter = starterRecipes.some(sr => sr.id === recipe.id);
        const isSample = recipe.id === 'sample-jerk-pork';
        if (isStarter || isSample) {
          return { recipe, isValid: true };
        }

        try {
          // Check if recipe exists in Firestore
          const recipeDoc = await getDoc(doc(db, 'recipes', recipe.id));
          if (recipeDoc.exists()) {
            const recipeData = recipeDoc.data();
            // Also check if user has access to it
            if (recipeData.isPublic === true || recipeData.userId === currentUser.uid) {
              return { recipe, isValid: true };
            }
          }
          return { recipe, isValid: false };
        } catch (error) {
          console.error(`Error validating recipe ${recipe.id}:`, error);
          return { recipe, isValid: false };
        }
      });

      const validationResults = await Promise.all(recipeValidationPromises);
      const validRecipes = validationResults
        .filter(result => result.isValid)
        .map(result => result.recipe);

      // If we removed some recipes, update the store
      if (validRecipes.length !== recipes.length) {
        console.log(`🧹 Cleaning up invalid recipes: removed ${recipes.length - validRecipes.length} recipes`);
        setRecipes(validRecipes.length > 0 ? validRecipes : [sampleRecipe]);
      }
    };

    cleanupInvalidRecipes();
  }, []); // Only run once on mount

  const handleRecipePress = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  // Get week dates based on offset
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);

    // Add week offset (7 days per week)
    monday.setDate(monday.getDate() + (offset * 7));

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${day}${suffix} ${month}`;
  };

  const formatDateRange = () => {
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  };

  const getWeekLabel = (offset: number) => {
    if (offset === 0) return 'THIS WEEK';
    if (offset === 1) return 'NEXT WEEK';
    if (offset === 2) return 'IN 2 WEEKS';
    if (offset === 3) return 'IN 3 WEEKS';
    return 'THIS WEEK';
  };

  const getAddToMenuButtonText = (offset: number) => {
    if (offset === 0) return "ADD TO THIS WEEK'S MENU";
    if (offset === 1) return "ADD TO NEXT WEEK'S MENU";
    if (offset === 2) return 'ADD TO MENU IN 2 WEEKS';
    if (offset === 3) return 'ADD TO MENU IN 3 WEEKS';
    return "ADD TO THIS WEEK'S MENU";
  };

  const handleAddToMenuPress = (recipe: Recipe, event: any) => {
    event.stopPropagation();
    setSelectedRecipeForMenu(recipe);
    setShowAddToMenuModal(true);
    setSelectedDay(null);
    setSelectedMealType(null);
    setWeekOffset(0);
  };

  const handlePreviousWeek = () => {
    // Only allow navigation forward, not backward
    if (weekOffset > 0) {
      setWeekOffset(weekOffset - 1);
    }
  };

  const handleNextWeek = () => {
    // Limit to 4 weeks forward (including current week: 0, 1, 2, 3)
    if (weekOffset < 3) {
      setWeekOffset(weekOffset + 1);
    }
  };

  const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDaySelect = (dayIndex: number) => {
    const dayKey = formatDateKey(weekDates[dayIndex]);
    setSelectedDay(dayKey);
  };

  const handleAddToMenu = () => {
    if (!selectedRecipeForMenu || !selectedMealType) return;

    const recipeServings = selectedRecipeForMenu.servings || 4;
    const newMealPlan: MealPlanItem = {
      id: `${Date.now()}-${Math.random()}`,
      recipeId: selectedRecipeForMenu.id,
      recipeTitle: selectedRecipeForMenu.title,
      recipeImage: typeof selectedRecipeForMenu.image === 'string' ? selectedRecipeForMenu.image : undefined,
      mealType: selectedMealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      date: selectedDay || '', // Empty string for shelf if no date selected
      includeInGrocery: true,
      servingsOverride: recipeServings,
    };

    addMealPlan(newMealPlan);

    // Automatically add ingredients to groceries list if includeInGrocery is true
    if (newMealPlan.includeInGrocery && selectedRecipeForMenu.ingredients && selectedRecipeForMenu.ingredients.length > 0) {
      const targetServings = newMealPlan.servingsOverride || recipeServings;

      // Adjust ingredients based on servings
      const adjustedIngredients = selectedRecipeForMenu.ingredients.map(ing => ({
        ...ing,
        amount: String(Number(ing.amount || '1') * (targetServings / recipeServings)),
      }));

      // Create sources for each ingredient
      const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
        recipeId: selectedRecipeForMenu.id,
        recipeTitle: selectedRecipeForMenu.title,
        mealPlanEntryId: newMealPlan.id,
        amount: ing.amount,
      }));

      addItems(adjustedIngredients, selectedRecipeForMenu.id, selectedRecipeForMenu.title, targetServings, sources);
      console.log('🛒 Added ingredients to groceries list:', adjustedIngredients.length);
    }

    // Show success toast
    setToastMessage(`${selectedRecipeForMenu.title} added to planner`);
    setToastType('success');
    setToastVisible(true);

    setShowAddToMenuModal(false);
    setSelectedRecipeForMenu(null);
    setSelectedDay(null);
    setSelectedMealType(null);
    setShowRecipeOptionsBottomSheet(false);
    setSelectedRecipeForOptions(null);
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
    { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { id: 'lunch', label: 'Lunch', icon: 'sunny' },
    { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { id: 'snack', label: 'Snack', icon: 'gift-outline' },
  ];

  // Ensure we always have at least the sample recipe
  // Also restore images for recipes that lost them during persistence (require() results can't be serialized to JSON)
  const allRecipes = useMemo(() => {
    return (recipes.length > 0 ? recipes : [sampleRecipe]).map(recipe => {
      // For sample recipe, always use the fresh image from sampleRecipe (it gets lost during JSON serialization)
      if (recipe.id === sampleRecipe.id) {
        return { ...recipe, image: sampleRecipe.image };
      }
      return recipe;
    });
  }, [recipes]);

  // Filter recipes based on user preferences for inspiration
  const filterRecipesByPreferences = (recipesToFilter: Recipe[]): Recipe[] => {
    let filtered = [...recipesToFilter];

    // Filter by dietary preference
    if (dietaryPreference && dietaryPreference !== 'None' && dietaryPreference !== 'no-preference') {
      filtered = filtered.filter(recipe => {
        const tags = recipe.tags || [];
        const preferenceLower = dietaryPreference.toLowerCase();
        return tags.some(tag => tag.toLowerCase().includes(preferenceLower)) ||
          recipe.title.toLowerCase().includes(preferenceLower);
      });
    }

    // Filter by favourite cuisines (check tags for cuisine-related tags)
    if (favouriteCuisines && favouriteCuisines !== 'None') {
      const cuisines = favouriteCuisines.split(',').map(c => c.trim().toLowerCase());
      filtered = filtered.filter(recipe => {
        const tags = recipe.tags || [];
        const titleLower = recipe.title.toLowerCase();
        return cuisines.some(cuisine =>
          tags.some(tag => tag.toLowerCase().includes(cuisine)) ||
          titleLower.includes(cuisine)
        );
      });
    }

    // Filter out disliked ingredients/allergies
    if (dislikesAllergies && dislikesAllergies !== 'None') {
      const dislikes = dislikesAllergies.split(',').map(d => d.trim().toLowerCase());
      filtered = filtered.filter(recipe => {
        const ingredients = recipe.ingredients || [];
        const ingredientText = ingredients.map(ing =>
          (typeof ing === 'string' ? ing : ing.name || '').toLowerCase()
        ).join(' ');
        return !dislikes.some(dislike => ingredientText.includes(dislike));
      });
    }

    // Filter by intolerances
    if (intolerances && intolerances !== 'None' && intolerances !== 'no-preference') {
      const intoleranceList = intolerances.split(',').map(i => i.trim().toLowerCase());
      filtered = filtered.filter(recipe => {
        const tags = recipe.tags || [];
        const ingredients = recipe.ingredients || [];
        const ingredientText = ingredients.map(ing =>
          (typeof ing === 'string' ? ing : ing.name || '').toLowerCase()
        ).join(' ');

        // Check if recipe contains any intolerances
        return !intoleranceList.some(intolerance => {
          const intoleranceLower = intolerance.toLowerCase();
          return tags.some(tag => tag.toLowerCase().includes(intoleranceLower)) ||
            ingredientText.includes(intoleranceLower);
        });
      });
    }

    return filtered;
  };

  // Handle meal plan generation animation
  useEffect(() => {
    if (isGeneratingMealPlan) {
      // Reset animation values
      dot1Opacity.setValue(0.3);
      dot2Opacity.setValue(0.3);
      dot3Opacity.setValue(0.3);

      // Three dots animation (standard loading)
      const createDotAnimation = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      createDotAnimation(dot1Opacity, 0).start();
      createDotAnimation(dot2Opacity, 200).start();
      createDotAnimation(dot3Opacity, 400).start();

      return () => {
        dot1Opacity.stopAnimation();
        dot2Opacity.stopAnimation();
        dot3Opacity.stopAnimation();
      };
    }
  }, [isGeneratingMealPlan]);

  // Handle inspiration bottom sheet opening
  useEffect(() => {
    if (showInspirationBottomSheet && showInspirationAnimation) {
      // Reset animation values
      dot1Opacity.setValue(0.3);
      dot2Opacity.setValue(0.3);
      dot3Opacity.setValue(0.3);

      // Three dots animation (standard loading)
      const createDotAnimation = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      createDotAnimation(dot1Opacity, 0).start();
      createDotAnimation(dot2Opacity, 200).start();
      createDotAnimation(dot3Opacity, 400).start();

      // After 2 seconds, filter recipes and show list
      const timer = setTimeout(() => {
        setIsLoadingInspiration(true);
        const filtered = filterRecipesByPreferences(allRecipes);
        setTimeout(() => {
          setFilteredInspirationRecipes(filtered);
          setIsLoadingInspiration(false);
          setShowInspirationAnimation(false);
        }, 500);
      }, 2000);

      return () => clearTimeout(timer);
    } else if (!showInspirationBottomSheet) {
      // Reset when closed
      setShowInspirationAnimation(true);
      setFilteredInspirationRecipes([]);
      setIsLoadingInspiration(false);
    }
  }, [showInspirationBottomSheet, showInspirationAnimation, allRecipes]);

  // Load image URLs for recipes with storage paths or URLs
  useEffect(() => {
    const loadImageUrls = async () => {
      const urlPromises = allRecipes.map(async (recipe) => {
        if (recipe.image && typeof recipe.image === 'string') {
          // Convert storage paths to URLs, or cache existing URLs
          const url = await getImageUrl(recipe.id, recipe.image);
          return { recipeId: recipe.id, url };
        }
        return null;
      });

      const results = await Promise.all(urlPromises);
      const newUrls: { [recipeId: string]: string } = {};
      results.forEach(result => {
        if (result && result.url) {
          newUrls[result.recipeId] = result.url;
        }
      });
      if (Object.keys(newUrls).length > 0) {
        setImageUrls(prev => ({ ...prev, ...newUrls }));
      }
    };

    if (allRecipes.length > 0) {
      loadImageUrls();
    }
  }, [allRecipes]);

  // Load joined challenges
  useFocusEffect(
    React.useCallback(() => {
      const loadJoinedChallenges = async () => {
        try {
          const JOINED_CHALLENGES_KEY = 'joined-challenges';
          const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
          if (stored) {
            const joinedIds = JSON.parse(stored);
            setJoinedChallengeIds(joinedIds);

            // Load progress for each joined challenge
            const progress: { [key: string]: number } = {};
            for (const id of joinedIds) {
              try {
                const progressKey = `challenge-progress-${id}`;
                const progressStored = await AsyncStorage.getItem(progressKey);
                if (progressStored) {
                  progress[id] = parseInt(progressStored, 10);
                } else {
                  progress[id] = 0;
                }
              } catch (e) {
                progress[id] = 0;
              }
            }
            setChallengeProgress(progress);
          }
        } catch (error) {
          console.error('Error loading joined challenges:', error);
        }
      };
      loadJoinedChallenges();
    }, [])
  );

  // Mock data for What's New and Our Picks
  // Ensure we always have at least 2 items for What's New, duplicating if needed
  const whatsNewRecipes = allRecipes.length >= 2
    ? allRecipes.slice(0, 2)
    : allRecipes.length === 1
      ? [allRecipes[0], allRecipes[0]] // Duplicate the single recipe
      : []; // Fallback if no recipes

  const currentUser = auth.currentUser;
  const myRecipes = allRecipes.filter(r => currentUser && r.userId === currentUser.uid); // Only user's own recipes
  const ourPicks = allRecipes.slice(0, 2); // Mock "Our Picks"

  // Calculate square size for 4 items with gaps
  // Account for section padding (16 * 2) + wrapper padding (16 * 2) + gaps (12 * 3)
  const screenWidth = Dimensions.get('window').width;
  const sectionPadding = 16 * 2; // Left and right padding of section
  const wrapperPadding = 16 * 2; // Left and right padding of wrapper
  const gapTotal = 12 * 3; // 3 gaps between 4 items
  const squareSize = (screenWidth - sectionPadding - wrapperPadding - gapTotal) / 4;

  // Calculate What's New card width (half screen width minus padding and gap)
  const whatsNewCardWidth = (screenWidth - sectionPadding - 12) / 2; // 12px gap between cards

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Find meal plan for today
  const todayDate = getTodayDate();
  const todayMealPlans = mealPlans.filter(plan => plan.date === todayDate);

  // Prioritize meal types: dinner > lunch > breakfast > snack
  const mealTypePriority: Record<string, number> = {
    dinner: 1,
    lunch: 2,
    breakfast: 3,
    snack: 4,
  };

  const todaysMealPlan = todayMealPlans.length > 0
    ? todayMealPlans.sort((a, b) =>
      (mealTypePriority[a.mealType] || 99) - (mealTypePriority[b.mealType] || 99)
    )[0]
    : null;

  // Get recipe for today's meal plan
  const todaysRecipe = todaysMealPlan
    ? allRecipes.find(r => r.id === todaysMealPlan.recipeId) || null
    : null;

  // Get shopping list count
  const shoppingListCount = groceryItems.length;
  const shoppingListMealCount = groceryRecipes.length;

  // Filter challenges for display
  const joinedChallengesList = challenges.filter(ch => joinedChallengeIds.includes(ch.id));
  const otherChallengesList = challenges.filter(ch => !joinedChallengeIds.includes(ch.id));
  const topChallenges = [...joinedChallengesList, ...otherChallengesList].slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.greetingContainer}>
            <View >
              <Text style={[styles.greetingTextHighlighted, { color: theme.colors.primaryDark, fontWeight: '800', textTransform: 'uppercase', fontSize: 17 }]}>{getGreeting()}!</Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Search')}
            >
              <Ionicons name="search-outline" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View style={styles.notificationIconContainer}>
                <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
                {hasUnread && <View style={styles.notificationDot} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-outline" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#1A1A1A"
            colors={['#1A1A1A']}
          />
        }
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          setIsScrolled(offsetY > 50); // Change to square button after scrolling 50px
        }}
        scrollEventThrottle={16}
      >
        {/* Today Section - Show meal plan for today */}
        {todaysMealPlan && todaysRecipe && (
          <>
            <View style={styles.todaySection}>
              <Text style={styles.readyToCookTitle}>
                Ready to cook {todaysMealPlan.mealType.charAt(0).toUpperCase() + todaysMealPlan.mealType.slice(1)}?
              </Text>

              {/* Recipe Card */}
              <TouchableOpacity
                style={styles.todayRecipeCard}
                onPress={() => navigation.navigate('RecipeDetail', { recipeId: todaysRecipe.id })}
              >
                <View style={styles.todayRecipeImageContainer}>
                  {typeof todaysRecipe.image === 'string' ? (
                    <Image
                      source={{ uri: todaysRecipe.image }}
                      style={styles.todayRecipeImage}
                      resizeMode="cover"
                    />
                  ) : todaysRecipe.image ? (
                    <Image
                      source={todaysRecipe.image}
                      style={styles.todayRecipeImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.todayRecipeImagePlaceholder}>
                      <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                    </View>
                  )}

                  {/* Recipe Title Overlay */}
                  <View style={styles.todayRecipeOverlay}>
                    <Text style={styles.todayRecipeTitle} numberOfLines={2}>
                      {todaysRecipe.title}
                    </Text>
                    {todaysRecipe.prepTime || todaysRecipe.cookTime ? (
                      <Text style={styles.todayRecipeTime}>
                        {(todaysRecipe.prepTime || 0) + (todaysRecipe.cookTime || 0)} mins
                      </Text>
                    ) : null}
                  </View>

                  {/* Edit Button */}
                  <TouchableOpacity
                    style={styles.todayEditButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      navigation.navigate('MealPlan');
                    }}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>

            {/* Shopping List Section */}
            {shoppingListCount > 0 && (
              <View style={styles.shoppingListSection}>
                <Text style={styles.shoppingListTitle}>Have everything you need?</Text>
                <TouchableOpacity
                  style={styles.shoppingListButton}
                  onPress={() => navigation.navigate('Groceries')}
                >
                  <View style={styles.shoppingListButtonContent}>
                    <Ionicons name="list-outline" size={20} color="#1A1A1A" />
                    <View style={styles.shoppingListButtonText}>
                      <Text style={styles.shoppingListButtonTitle}>
                        Your Shopping List
                        {shoppingListMealCount > 0 && ` (${shoppingListMealCount} meal${shoppingListMealCount > 1 ? 's' : ''})`}
                      </Text>
                      <Text style={styles.shoppingListButtonSubtitle}>
                        {shoppingListCount} item{shoppingListCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Try something new Section */}
        {whatsNewRecipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="bulb-outline" size={20} color="#1A1A1A" />
              <Text style={styles.sectionTitle}>Try something new</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {whatsNewRecipes.map((recipe, index) => {
                // Get image - use sampleRecipe image if this is the sample recipe and image is missing/lost during persistence
                let image = recipe.image;
                if (recipe.id === sampleRecipe.id) {
                  if (!image || image === null || image === undefined || (typeof image !== 'string' && typeof image !== 'number')) {
                    image = sampleRecipe.image;
                  }
                }

                // Use cached URL if available, otherwise use original image
                const displayImage = imageUrls[recipe.id] || image;

                return (
                  <TouchableOpacity
                    key={`${recipe.id}-${index}`}
                    style={[styles.whatsNewCard, { width: whatsNewCardWidth }]}
                    onPress={() => handleRecipePress(recipe.id)}
                  >
                    <View style={styles.recipeImageContainer}>
                      {displayImage ? (
                        typeof displayImage === 'string' ? (
                          <Image source={{ uri: displayImage }} style={styles.recipeImage} resizeMode="cover" />
                        ) : (
                          <Image source={displayImage} style={styles.recipeImage} resizeMode="cover" />
                        )
                      ) : (
                        <View style={styles.recipeImagePlaceholder}>
                          <Text style={styles.placeholderText}>📄</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.recipePlusButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedRecipeForOptions(recipe);
                          setShowRecipeOptionsBottomSheet(true);
                        }}
                      >
                        <Ionicons name="add" size={20} color="#1A1A1A" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
                    <View style={styles.recipeCardTimeRow}>
                      <Text style={styles.recipeCardTime}>
                        {((recipe.prepTime || 0) + (recipe.cookTime || 0)) || '30'} mins
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* My Recipes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Recipes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MyRecipes')}>
              <Text style={styles.viewAllLinkText}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.myRecipesWrapper}>
            <View style={styles.recipesRow}>
              {Array.from({ length: 4 }).map((_, index) => {
                const recipe = myRecipes[index];
                if (recipe) {
                  // Get image - use sampleRecipe image if this is the sample recipe and image is missing/lost during persistence
                  let image = recipe.image;
                  if (recipe.id === sampleRecipe.id) {
                    if (!image || image === null || image === undefined || (typeof image !== 'string' && typeof image !== 'number')) {
                      image = sampleRecipe.image;
                    }
                  }

                  // Use cached URL if available (for storage paths), otherwise use original image
                  // This matches the behavior in WantToCookScreen but adds support for storage paths
                  const displayImage = imageUrls[recipe.id] || image;

                  return (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[styles.myRecipeCard, { width: squareSize, height: squareSize }]}
                      onPress={() => handleRecipePress(recipe.id)}
                    >
                      {displayImage ? (
                        typeof displayImage === 'string' ? (
                          <Image source={{ uri: displayImage }} style={styles.myRecipeCardImage} resizeMode="cover" />
                        ) : (
                          <Image source={displayImage} style={styles.myRecipeCardImage} resizeMode="cover" />
                        )
                      ) : (
                        <View style={styles.myRecipeCardPlaceholder}>
                          <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                } else {
                  // Plus button for empty spot
                  return (
                    <View
                      key={`placeholder-${index}`}
                      style={[styles.myRecipeCardPlaceholderSquare, { width: squareSize, height: squareSize }]}
                    >
                      <TouchableOpacity
                        style={styles.addRecipeButton}
                        onPress={showImportModal}
                      >
                        <View style={styles.addRecipeButtonContainer}>
                          <Ionicons name="add" size={24} color="#6B6B6B" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }
              })}
            </View>
          </View>
        </View>

        {/* Our Picks Section */}
        {ourPicks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Our Picks</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RecipeCollection', {
                  title: 'Amazing Recipes You Should Try',
                  recipeIds: ourPicks.map((r) => r.id)
                })}
              >
                <Text style={styles.viewAllLinkText}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {ourPicks.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.ourPicksCard}
                  onPress={() => handleRecipePress(recipe.id)}
                >
                  <View style={styles.ourPicksImageContainer}>
                    {recipe.image ? (
                      typeof recipe.image === 'string' ? (
                        <Image source={{ uri: recipe.image }} style={styles.ourPicksImage} />
                      ) : (
                        <Image source={recipe.image} style={styles.ourPicksImage} />
                      )
                    ) : (
                      <View style={styles.ourPicksImagePlaceholder}>
                        <Text style={styles.placeholderText}>📄</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.recipePlusButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedRecipeForOptions(recipe);
                        setShowRecipeOptionsBottomSheet(true);
                      }}
                    >
                      <Ionicons name="add" size={20} color="#1A1A1A" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Challenges Section */}
        {topChallenges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Challenges</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Challenges')}
              >
                <Text style={styles.viewAllLinkText}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {topChallenges.map((challenge) => {
                const isJoined = joinedChallengeIds.includes(challenge.id);
                const completedRecipes = challengeProgress[challenge.id] || 0;
                const progressPercentage = challenge.recipeCount > 0
                  ? (completedRecipes / challenge.recipeCount) * 100
                  : 0;

                return (
                  <TouchableOpacity
                    key={challenge.id}
                    style={[styles.challengeCard, { backgroundColor: challenge.backgroundColor }]}
                    onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
                  >
                    <View style={styles.challengeProfileContainer}>
                      <View style={styles.challengeProfileImage}>
                        <View style={styles.challengeProfilePlaceholder}>
                          <Text style={styles.challengeProfileEmoji}>{challenge.profileEmoji}</Text>
                        </View>
                      </View>
                      <View style={styles.challengeContent}>
                        <View style={styles.challengeTitleRow}>
                          <Text style={styles.challengeTitle} numberOfLines={2}>
                            {challenge.title}
                          </Text>
                          <View style={styles.challengeStats}>
                            <Ionicons name="people-outline" size={16} color="#1A1A1A" />
                            <Text style={styles.challengeParticipants}>
                              {challenge.participants.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.challengeDescription}>
                          {challenge.description}
                        </Text>
                        {isJoined && (
                          <View style={styles.challengeProgressContainer}>
                            <Text style={styles.challengeProgressText}>
                              {completedRecipes}/{challenge.recipeCount} Recipes
                            </Text>
                            <View style={styles.challengeProgressBarBackground}>
                              <View
                                style={[
                                  styles.challengeProgressBarFill,
                                  { width: `${progressPercentage}%` },
                                ]}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter by:"
        height="25%"
      >
        <View style={styles.filterContainer}>

          <TouchableOpacity
            style={styles.filterOption}
            onPress={() => {
              setFilterBy('recipes');
              setShowFilterModal(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.filterOptionText}>Recipes</Text>
            {filterBy === 'recipes' ? (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterOption}
            onPress={() => {
              setFilterBy('packs');
              setShowFilterModal(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.filterOptionText}>Packs</Text>
            {filterBy === 'packs' ? (
              <View style={styles.radioSelected}>
                <View style={styles.radioInner} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Add to This Week's Menu Modal */}
      <BottomSheet
        visible={showAddToMenuModal}
        onClose={() => {
          setShowAddToMenuModal(false);
          setSelectedRecipeForMenu(null);
          setSelectedDay(null);
          setSelectedMealType(null);
          setShowRecipeOptionsBottomSheet(false);
          setSelectedRecipeForOptions(null);
        }}
      >
        {selectedRecipeForMenu && (
          <View style={styles.addToMenuModalContent}>
            {/* Header with Close Button */}
            <View style={styles.addToMenuHeader}>
              <Text style={styles.addToMenuHeaderTitle}>Add to planner</Text>
              <TouchableOpacity
                style={styles.addToMenuCloseButton}
                onPress={() => {
                  setShowAddToMenuModal(false);
                  setSelectedRecipeForMenu(null);
                  setSelectedDay(null);
                  setSelectedMealType(null);
                  setShowRecipeOptionsBottomSheet(false);
                  setSelectedRecipeForOptions(null);
                }}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Recipe Image */}
            <View style={styles.addToMenuImageContainer}>
              {selectedRecipeForMenu.image ? (
                typeof selectedRecipeForMenu.image === 'string' ? (
                  <Image
                    source={{ uri: selectedRecipeForMenu.image }}
                    style={styles.addToMenuImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={selectedRecipeForMenu.image}
                    style={styles.addToMenuImage}
                    resizeMode="cover"
                  />
                )
              ) : (
                <View style={styles.addToMenuImagePlaceholder}>
                  <Text style={styles.addToMenuPlaceholderText}>📄</Text>
                </View>
              )}
            </View>

            {/* Recipe Title with Yellow Highlight */}
            <View style={styles.addToMenuTitleContainer}>
              <Text style={styles.addToMenuTitle}>{selectedRecipeForMenu.title}</Text>
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
            <Text style={styles.dateRangeText}>{formatDateRange()}</Text>

            {/* Question */}
            <Text style={styles.addToMenuQuestion}>When would you like to cook this recipe? (Optional)</Text>

            {/* Day Selection Buttons */}
            <View style={styles.daySelectionContainer}>
              {weekDates.map((date, index) => {
                const dayKey = formatDateKey(date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
                const isSelected = selectedDay === dayKey;

                return (
                  <TouchableOpacity
                    key={dayKey}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected
                    ]}
                    onPress={() => handleDaySelect(index)}
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
              onPress={handleAddToMenu}
              disabled={!selectedMealType}
            >
              <Text style={styles.addToMenuSubmitButtonText}>Add to planner</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* Recipe Options Bottom Sheet */}
      <BottomSheet
        visible={showRecipeOptionsBottomSheet}
        onClose={() => {
          setShowRecipeOptionsBottomSheet(false);
          setSelectedRecipeForOptions(null);
          setShowMealTypeSelection(false);
        }}
        height="50%"
      >
        {selectedRecipeForOptions && (
          <View style={styles.recipeOptionsContent}>
            {!showMealTypeSelection ? (
              <>
                {/* Recipe Header */}
                <View style={styles.recipeOptionsHeader}>
                  <View style={styles.recipeOptionsImageContainer}>
                    {selectedRecipeForOptions.image ? (
                      typeof selectedRecipeForOptions.image === 'string' ? (
                        <Image
                          source={{ uri: selectedRecipeForOptions.image }}
                          style={styles.recipeOptionsImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Image
                          source={selectedRecipeForOptions.image}
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
                      {selectedRecipeForOptions.title}
                    </Text>
                    <Text style={styles.recipeOptionsTime}>
                      {((selectedRecipeForOptions.prepTime || 0) + (selectedRecipeForOptions.cookTime || 0)) || '25'} min
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.recipeOptionsCloseButton}
                    onPress={() => {
                      setShowRecipeOptionsBottomSheet(false);
                      setSelectedRecipeForOptions(null);
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
                    onPress={(e) => {
                      e.stopPropagation();
                      if (selectedRecipeForOptions) {
                        setSelectedRecipeForMenu(selectedRecipeForOptions);
                        setShowAddToMenuModal(true);
                        setShowRecipeOptionsBottomSheet(false);
                      }
                    }}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Add to planner</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      if (selectedRecipeForOptions) {
                        setSelectedRecipeForCollection(selectedRecipeForOptions);
                        setShowRecipeOptionsBottomSheet(false);
                        setShowCollectionSelection(true);
                      }
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
                        const today = getTodayDate();
                        const newMealPlan: MealPlanItem = {
                          id: `meal-${Date.now()}`,
                          recipeId: selectedRecipeForOptions.id,
                          recipeTitle: selectedRecipeForOptions.title,
                          recipeImage: typeof selectedRecipeForOptions.image === 'string'
                            ? selectedRecipeForOptions.image
                            : undefined,
                          mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
                          date: today,
                          includeInGrocery: true,
                        };

                        addMealPlan(newMealPlan);

                        // Automatically add ingredients to groceries list if includeInGrocery is true
                        if (newMealPlan.includeInGrocery && selectedRecipeForOptions.ingredients && selectedRecipeForOptions.ingredients.length > 0) {
                          const recipeServings = selectedRecipeForOptions.servings || 4;
                          const targetServings = newMealPlan.servingsOverride || recipeServings;

                          // Adjust ingredients based on servings
                          const adjustedIngredients = selectedRecipeForOptions.ingredients.map(ing => ({
                            ...ing,
                            amount: String(Number(ing.amount || '1') * (targetServings / recipeServings)),
                          }));

                          // Create sources for each ingredient
                          const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
                            recipeId: selectedRecipeForOptions.id,
                            recipeTitle: selectedRecipeForOptions.title,
                            mealPlanEntryId: newMealPlan.id,
                            amount: ing.amount,
                          }));

                          addItems(adjustedIngredients, selectedRecipeForOptions.id, selectedRecipeForOptions.title, targetServings, sources);
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

      {/* Collection Selection Bottom Sheet (Add to My Recipes) */}
      <BottomSheet
        visible={showCollectionSelection}
        onClose={() => {
          setShowCollectionSelection(false);
          setShowCreateCollection(false);
          setNewCollectionName('');
          setSelectedRecipeForCollection(null);
        }}
        height="60%"
      >
        {selectedRecipeForCollection && (
          <View style={styles.collectionsContent}>
            {!showCreateCollection ? (
              <>
                <View style={styles.collectionSelectionHeader}>
                  <Text style={styles.collectionSelectionTitle}>Select Collections</Text>
                  <Text style={styles.collectionSelectionSubtitle}>A recipe can be in multiple collections</Text>
                </View>
                {collections.map((coll, index) => {
                  const currentCollections = (selectedRecipeForCollection as any).collections
                    ? (selectedRecipeForCollection as any).collections
                    : ((selectedRecipeForCollection as any).cookbook ? [(selectedRecipeForCollection as any).cookbook] : []);
                  const isSelected = Array.isArray(currentCollections) && currentCollections.includes(coll);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.collectionOption, isSelected && styles.collectionOptionSelected]}
                      onPress={async () => {
                        try {
                          const updatedCollections = isSelected
                            ? currentCollections.filter((col: string) => col !== coll)
                            : [...currentCollections, coll];
                          const currentUser = auth.currentUser;
                          if (currentUser && selectedRecipeForCollection.userId !== currentUser.uid) {
                            // Clone public recipe for the collection
                            const newRecipeData = {
                              title: selectedRecipeForCollection.title,
                              description: selectedRecipeForCollection.description,
                              ingredients: selectedRecipeForCollection.ingredients,
                              steps: selectedRecipeForCollection.steps,
                              image: selectedRecipeForCollection.image,
                              servings: selectedRecipeForCollection.servings,
                              prepTime: selectedRecipeForCollection.prepTime,
                              cookTime: selectedRecipeForCollection.cookTime,
                              nutrition: selectedRecipeForCollection.nutrition,
                              equipment: selectedRecipeForCollection.equipment,
                              tags: selectedRecipeForCollection.tags,
                              cuisine: selectedRecipeForCollection.cuisine,
                              notes: selectedRecipeForCollection.notes ? `${selectedRecipeForCollection.notes}\n\nCloned from: ${selectedRecipeForCollection.id}` : `Cloned from: ${selectedRecipeForCollection.id}`,
                              sourceUrls: selectedRecipeForCollection.sourceUrls || [],
                              collections: [coll], // Start fresh with just the new collection
                              isPublic: false
                            };

                            const createRecipeFn = httpsCallable(functions, 'createRecipe');
                            const result = await createRecipeFn(newRecipeData);
                            const { recipeId: newRecipeId, recipe: newRecipeObj } = result.data as any;

                            addRecipe(newRecipeObj);
                            setSelectedRecipeForCollection(newRecipeObj);
                          } else {
                            // Update owned recipe
                            const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
                            await updateRecipeFunction({
                              recipeId: selectedRecipeForCollection.id,
                              collections: updatedCollections.length > 0 ? updatedCollections : [],
                            });
                            updateRecipe(selectedRecipeForCollection.id, { collections: updatedCollections });
                            setSelectedRecipeForCollection({ ...selectedRecipeForCollection, collections: updatedCollections } as Recipe);
                          }
                          setToastMessage(isSelected ? `Removed from "${coll}"` : `Added to "${coll}"`);
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
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                      </View>
                      <Text style={[styles.collectionOptionText, isSelected && styles.collectionOptionTextSelected]}>
                        {coll}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                    !newCollectionName.trim() && styles.createCollectionSaveButtonDisabled,
                  ]}
                  onPress={async () => {
                    if (!newCollectionName.trim() || !selectedRecipeForCollection) return;
                    try {
                      await addCollection(newCollectionName.trim());
                      const currentCollections = (selectedRecipeForCollection as any).collections
                        ? (selectedRecipeForCollection as any).collections
                        : ((selectedRecipeForCollection as any).cookbook ? [(selectedRecipeForCollection as any).cookbook] : []);
                      const updatedCollections = [...currentCollections, newCollectionName.trim()];
                      const trimmedName = newCollectionName.trim();
                      const currentUser = auth.currentUser;
                      if (currentUser && selectedRecipeForCollection.userId !== currentUser.uid) {
                        // Clone public recipe for new collection
                        const newRecipeData = {
                          title: selectedRecipeForCollection.title,
                          description: selectedRecipeForCollection.description,
                          ingredients: selectedRecipeForCollection.ingredients,
                          steps: selectedRecipeForCollection.steps,
                          image: selectedRecipeForCollection.image,
                          servings: selectedRecipeForCollection.servings,
                          prepTime: selectedRecipeForCollection.prepTime,
                          cookTime: selectedRecipeForCollection.cookTime,
                          nutrition: selectedRecipeForCollection.nutrition,
                          equipment: selectedRecipeForCollection.equipment,
                          tags: selectedRecipeForCollection.tags,
                          cuisine: selectedRecipeForCollection.cuisine,
                          notes: selectedRecipeForCollection.notes ? `${selectedRecipeForCollection.notes}\n\nCloned from: ${selectedRecipeForCollection.id}` : `Cloned from: ${selectedRecipeForCollection.id}`,
                          sourceUrls: selectedRecipeForCollection.sourceUrls || [],
                          collections: [trimmedName],
                          isPublic: false
                        };

                        const createRecipeFn = httpsCallable(functions, 'createRecipe');
                        const result = await createRecipeFn(newRecipeData);
                        const { recipeId: newRecipeId, recipe: newRecipeObj } = result.data as any;

                        addRecipe(newRecipeObj);
                        setSelectedRecipeForCollection(newRecipeObj);
                      } else {
                        // Update owned recipe
                        const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
                        await updateRecipeFunction({
                          recipeId: selectedRecipeForCollection.id,
                          collections: updatedCollections,
                        });
                        updateRecipe(selectedRecipeForCollection.id, { collections: updatedCollections });
                        setSelectedRecipeForCollection({ ...selectedRecipeForCollection, collections: updatedCollections } as Recipe);
                      }
                      setNewCollectionName('');
                      setShowCreateCollection(false);
                      setShowCollectionSelection(false);
                      setToastMessage(`Added to "${newCollectionName.trim()}"`);
                      setToastType('success');
                      setToastVisible(true);
                    } catch (error) {
                      console.error('Error creating collection and updating recipe:', error);
                      setToastMessage('Failed to update collection');
                      setToastType('error');
                      setToastVisible(true);
                    }
                  }}
                  disabled={!newCollectionName.trim()}
                >
                  <Text style={[
                    styles.createCollectionSaveButtonText,
                    !newCollectionName.trim() && styles.createCollectionSaveButtonTextDisabled,
                  ]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </BottomSheet>

      {/* Sous-Chef Trigger Button */}
      <TouchableOpacity
        style={[
          styles.sousChefButton,
          { backgroundColor: theme.colors.gastronButton },
          isScrolled ? styles.sousChefButtonFloating : styles.sousChefButtonWide,
        ]}
        onPress={() => setShowSousChefMenu(true)}
        activeOpacity={0.8}
      >
        {isScrolled ? (
          <MaterialCommunityIcons name="chef-hat" size={24} color={theme.colors.black} />
        ) : (
          <>
            <Text style={[styles.sousChefButtonTextWide, { color: theme.colors.black }]}>Need help? Ask your Gastron!</Text>
            <View style={[styles.sousChefLogoContainer, { backgroundColor: theme.colors.primaryDark }]}>
              <MaterialCommunityIcons name="chef-hat" size={20} color={theme.colors.accent} />
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Sous-Chef Menu Bottom Sheet */}
      <BottomSheet
        visible={showSousChefMenu}
        onClose={() => setShowSousChefMenu(false)}
        height="40%"
        backgroundColor={theme.colors.parchment}
      >
        <View style={styles.sousChefMenuContent}>
          {/* Header - Logo covering the notch */}
          <View style={styles.sousChefMenuHeader}>
            <View style={[styles.sousChefMenuLogoContainer, { backgroundColor: theme.colors.primaryDark }]}>
              <MaterialCommunityIcons name="chef-hat" size={24} color={theme.colors.accent} />
            </View>
            <TouchableOpacity
              style={styles.sousChefMenuCloseButton}
              onPress={() => setShowSousChefMenu(false)}
            >
              <Ionicons name="close" size={20} color={theme.colors.black} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sousChefMenuTitle, { color: theme.colors.primaryDark }]}>What do you need help with?</Text>

          {/* Menu Options */}
          <TouchableOpacity
            style={[styles.sousChefMenuItem, { backgroundColor: theme.colors.buttonSecondary }]}
            onPress={() => {
              setShowSousChefMenu(false);
              setShowInspirationBottomSheet(true);
              setShowInspirationAnimation(true);
            }}
          >
            <Text style={styles.sousChefMenuItemText}>I'm looking for inspiration</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sousChefMenuItem, { backgroundColor: theme.colors.buttonSecondary }]}
            onPress={() => {
              setShowSousChefMenu(false);
              setShowUseUpIngredientsBottomSheet(true);
            }}
          >
            <Text style={styles.sousChefMenuItemText}>I need to use up ingredients</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sousChefMenuItem, { backgroundColor: theme.colors.buttonSecondary }]}
            onPress={() => {
              setShowSousChefMenu(false);
              setMealPlanGenerated(false);
              setGeneratedMealPlanRecipes([]);
              setMealPlanServings({});
              setMealPlanQuantity(3);
              setSelectedDietaryPreference('');
              setSelectedDislikes([]);
              setDislikeSearchQuery('');
              setShowMealPlanBottomSheet(true);
            }}
          >
            <Text style={styles.sousChefMenuItemText}>I need a meal plan</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Inspiration Bottom Sheet */}
      <BottomSheet
        visible={showInspirationBottomSheet}
        onClose={() => {
          setShowInspirationBottomSheet(false);
          setShowInspirationAnimation(true);
          setFilteredInspirationRecipes([]);
        }}
        height="70%"
        backgroundColor={theme.colors.parchment}
      >
        <View style={styles.inspirationContent}>
          {/* Header */}
          <View style={styles.inspirationHeader}>
            <TouchableOpacity
              style={styles.inspirationBackButton}
              onPress={() => {
                setShowInspirationBottomSheet(false);
                setShowSousChefMenu(true);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.inspirationHeaderTitle}>
              {showInspirationAnimation ? 'Cooking up some inspiration...' : 'Inspiration'}
            </Text>
            <TouchableOpacity
              style={styles.inspirationCloseButton}
              onPress={() => {
                setShowInspirationBottomSheet(false);
                setShowInspirationAnimation(true);
                setFilteredInspirationRecipes([]);
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {showInspirationAnimation ? (
            /* Animation View */
            <View style={styles.inspirationAnimationContainer}>
              <MaterialCommunityIcons name="chef-hat" size={60} color="#1A1A1A" />
              <View style={styles.inspirationDotsContainer}>
                <Animated.View style={[styles.inspirationDot, { opacity: dot1Opacity }]} />
                <Animated.View style={[styles.inspirationDot, { opacity: dot2Opacity }]} />
                <Animated.View style={[styles.inspirationDot, { opacity: dot3Opacity }]} />
              </View>
            </View>
          ) : isLoadingInspiration ? (
            /* Loading State */
            <View style={styles.inspirationLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={styles.inspirationLoadingText}>Finding perfect matches...</Text>
            </View>
          ) : (
            /* Recipe List */
            <ScrollView
              style={styles.inspirationScrollView}
              contentContainerStyle={styles.inspirationScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredInspirationRecipes.length > 0 ? (
                <View style={styles.inspirationRecipeGrid}>
                  {filteredInspirationRecipes.map((recipe) => {
                    const imageUrl = imageUrls[recipe.id] ||
                      (typeof recipe.image === 'string' ? recipe.image : null);

                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={styles.inspirationRecipeCard}
                        onPress={() => {
                          setShowInspirationBottomSheet(false);
                          navigation.navigate('RecipeDetail', { recipeId: recipe.id });
                        }}
                      >
                        <View style={styles.inspirationRecipeImageContainer}>
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.inspirationRecipeImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.inspirationRecipeImagePlaceholder}>
                              <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                            </View>
                          )}

                          {/* Plus Button */}
                          <TouchableOpacity
                            style={styles.inspirationPlusButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedRecipeForOptions(recipe);
                              setShowRecipeOptionsBottomSheet(true);
                            }}
                          >
                            <Ionicons name="add" size={20} color="#1A1A1A" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.inspirationRecipeTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.inspirationEmptyContainer}>
                  <Text style={styles.inspirationEmptyText}>No recipes found matching your preferences.</Text>
                  <Text style={styles.inspirationEmptySubtext}>Try adjusting your preferences in Settings.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </BottomSheet>

      {/* Use Up Ingredients Bottom Sheet */}
      <BottomSheet
        visible={showUseUpIngredientsBottomSheet}
        onClose={() => {
          setShowUseUpIngredientsBottomSheet(false);
          setSelectedIngredients([]);
          setIngredientSearchQuery('');
          setUseUpIngredientsResultsShown(false);
          setUseUpIngredientsRecipes([]);
        }}
        height="70%"
        backgroundColor={theme.colors.parchment}
      >
        <View style={styles.useUpIngredientsContent}>
          {/* Header */}
          <View style={styles.useUpIngredientsHeader}>
            <TouchableOpacity
              style={styles.useUpIngredientsBackButton}
              onPress={() => {
                if (useUpIngredientsResultsShown) {
                  // Go back to form view
                  setUseUpIngredientsResultsShown(false);
                  setUseUpIngredientsRecipes([]);
                } else {
                  // Go back to sous-chef menu
                  setShowUseUpIngredientsBottomSheet(false);
                  setShowSousChefMenu(true);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.useUpIngredientsHeaderTitle} numberOfLines={2}>
              {useUpIngredientsResultsShown ? (
                (() => {
                  const selectedLabels = selectedIngredients
                    .map(id => ALL_INGREDIENTS.find(ing => ing.id === id)?.label)
                    .filter(Boolean);
                  return `Recipes using: ${selectedLabels.join(', ').toLowerCase()}`;
                })()
              ) : (
                'Which ingredients do you have?'
              )}
            </Text>
            <TouchableOpacity
              style={styles.useUpIngredientsCloseButton}
              onPress={() => {
                setShowUseUpIngredientsBottomSheet(false);
                setSelectedIngredients([]);
                setIngredientSearchQuery('');
                setUseUpIngredientsResultsShown(false);
                setUseUpIngredientsRecipes([]);
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {useUpIngredientsResultsShown ? (
            /* Recipe Results */
            <ScrollView
              style={styles.useUpIngredientsScrollView}
              contentContainerStyle={styles.useUpIngredientsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {useUpIngredientsRecipes.length > 0 ? (
                <View style={styles.useUpIngredientsRecipeGrid}>
                  {useUpIngredientsRecipes.map((recipe) => {
                    const imageUrl = imageUrls[recipe.id] ||
                      (typeof recipe.image === 'string' ? recipe.image : null);
                    const isVegetarian = recipe.tags?.some(tag =>
                      tag.toLowerCase() === 'vegetarian'
                    ) || false;

                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={styles.useUpIngredientsRecipeCard}
                        onPress={() => {
                          setShowUseUpIngredientsBottomSheet(false);
                          navigation.navigate('RecipeDetail', { recipeId: recipe.id });
                        }}
                      >
                        <View style={styles.useUpIngredientsRecipeImageContainer}>
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.useUpIngredientsRecipeImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.useUpIngredientsRecipeImagePlaceholder}>
                              <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                            </View>
                          )}

                          {/* Vegetarian Icon */}
                          {isVegetarian && (
                            <View style={styles.useUpIngredientsVegetarianIcon}>
                              <Ionicons name="leaf" size={16} color="#4CAF50" />
                              <Text style={styles.useUpIngredientsVegetarianText}>v</Text>
                            </View>
                          )}

                          {/* Plus Button */}
                          <TouchableOpacity
                            style={styles.useUpIngredientsPlusButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedRecipeForOptions(recipe);
                              setShowUseUpIngredientsBottomSheet(false);
                              setShowRecipeOptionsBottomSheet(true);
                            }}
                          >
                            <Ionicons name="add" size={20} color="#1A1A1A" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.useUpIngredientsRecipeTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.useUpIngredientsEmptyContainer}>
                  <Text style={styles.useUpIngredientsEmptyText}>No recipes found with these ingredients.</Text>
                  <Text style={styles.useUpIngredientsEmptySubtext}>Try selecting different ingredients.</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <>

              {/* Ingredient Grid */}
              <ScrollView
                style={styles.useUpIngredientsScrollView}
                contentContainerStyle={styles.useUpIngredientsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.useUpIngredientsGrid}>
                  {(() => {
                    // Get selected ingredients first (at the top)
                    const selectedItems = ALL_INGREDIENTS.filter(ing =>
                      selectedIngredients.includes(ing.id) &&
                      ing.label.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
                    );
                    // Get unselected ingredients
                    const unselectedItems = ALL_INGREDIENTS.filter(ing =>
                      !selectedIngredients.includes(ing.id) &&
                      ing.label.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
                    );
                    // Combine: selected first (all of them), then unselected (up to 9 total)
                    const remainingSlots = 9 - selectedItems.length;
                    const sortedIngredients = [
                      ...selectedItems,
                      ...unselectedItems.slice(0, Math.max(0, remainingSlots))
                    ];

                    return sortedIngredients.map((ingredient) => {
                      const isSelected = selectedIngredients.includes(ingredient.id);
                      return (
                        <TouchableOpacity
                          key={ingredient.id}
                          style={[
                            styles.useUpIngredientTag,
                            isSelected && styles.useUpIngredientTagSelected,
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedIngredients(prev => prev.filter(id => id !== ingredient.id));
                            } else {
                              setSelectedIngredients(prev => [...prev, ingredient.id]);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.useUpIngredientIcon}>{ingredient.icon}</Text>
                          <Text style={[
                            styles.useUpIngredientLabel,
                            isSelected && styles.useUpIngredientLabelSelected,
                          ]}>
                            {ingredient.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </ScrollView>

              {/* Search Bar */}
              <TouchableOpacity
                style={styles.useUpIngredientsSearchContainer}
                onPress={() => {
                  setShowUseUpIngredientsBottomSheet(false);
                  setIngredientSearchContext('use-up');
                  setSelectedSearchIngredients([...selectedIngredients]);
                  setShowIngredientSearchScreen(true);
                }}
              >
                <Ionicons name="search" size={20} color="#999999" style={styles.useUpIngredientsSearchIcon} />
                <Text style={styles.useUpIngredientsSearchInputPlaceholder}>Search for ingredients</Text>
              </TouchableOpacity>

              {/* Find Recipes Button */}
              <TouchableOpacity
                style={[
                  styles.useUpIngredientsFindButton,
                  selectedIngredients.length === 0 && styles.useUpIngredientsFindButtonDisabled,
                ]}
                onPress={() => {
                  if (selectedIngredients.length > 0) {
                    // Filter recipes that contain at least one of the selected ingredients
                    const filtered = allRecipes.filter(recipe => {
                      const ingredients = recipe.ingredients || [];
                      const ingredientText = ingredients.map(ing =>
                        (typeof ing === 'string' ? ing : ing.name || '').toLowerCase()
                      ).join(' ');

                      // Check if recipe contains any of the selected ingredients
                      return selectedIngredients.some(selectedId => {
                        const selectedIngredient = ALL_INGREDIENTS.find(ing => ing.id === selectedId);
                        if (!selectedIngredient) return false;
                        return ingredientText.includes(selectedIngredient.label.toLowerCase());
                      });
                    });

                    setUseUpIngredientsRecipes(filtered);
                    setUseUpIngredientsResultsShown(true);
                  }
                }}
                disabled={selectedIngredients.length === 0}
              >
                <Text style={styles.useUpIngredientsFindButtonText}>FIND SOME RECIPES!</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </BottomSheet>

      {/* Meal Plan Bottom Sheet */}
      <BottomSheet
        visible={showMealPlanBottomSheet}
        onClose={() => {
          setShowMealPlanBottomSheet(false);
          setMealPlanQuantity(3);
          setSelectedDietaryPreference('');
          setSelectedDislikes([]);
          setDislikeSearchQuery('');
          setMealPlanGenerated(false);
          setGeneratedMealPlanRecipes([]);
          setMealPlanServings({});
        }}
        height="85%"
        backgroundColor={theme.colors.parchment}
      >
        <View style={styles.mealPlanContent}>
          {/* Header */}
          <View style={styles.mealPlanHeader}>
            {mealPlanGenerated ? (
              // Back button to return to form when showing generated recipes
              <TouchableOpacity
                style={styles.mealPlanBackButton}
                onPress={() => {
                  setMealPlanGenerated(false);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            ) : (
              // Back button to return to sous-chef menu when showing form
              <TouchableOpacity
                style={styles.mealPlanBackButton}
                onPress={() => {
                  setShowMealPlanBottomSheet(false);
                  setMealPlanQuantity(3);
                  setSelectedDietaryPreference('');
                  setSelectedDislikes([]);
                  setDislikeSearchQuery('');
                  setMealPlanGenerated(false);
                  setGeneratedMealPlanRecipes([]);
                  setMealPlanServings({});
                  setShowSousChefMenu(true);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            <Text style={styles.mealPlanHeaderTitle} numberOfLines={1} adjustsFontSizeToFit={false}>
              {mealPlanGenerated ? 'Your Meal Plan' : "Let's plan your meals"}
            </Text>
            <TouchableOpacity
              style={styles.mealPlanCloseButton}
              onPress={() => {
                setShowMealPlanBottomSheet(false);
                setMealPlanQuantity(3);
                setSelectedDietaryPreference('');
                setSelectedDislikes([]);
                setDislikeSearchQuery('');
                setMealPlanGenerated(false);
                setGeneratedMealPlanRecipes([]);
                setMealPlanServings({});
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {isGeneratingMealPlan ? (
            /* Loading Animation */
            <View style={styles.mealPlanLoadingContainer}>
              <MaterialCommunityIcons name="chef-hat" size={60} color="#1A1A1A" />
              <View style={styles.mealPlanLoadingDotsContainer}>
                <Animated.View style={[styles.mealPlanLoadingDot, { opacity: dot1Opacity }]} />
                <Animated.View style={[styles.mealPlanLoadingDot, { opacity: dot2Opacity }]} />
                <Animated.View style={[styles.mealPlanLoadingDot, { opacity: dot3Opacity }]} />
              </View>
              <Text style={styles.mealPlanLoadingText}>Generating your meal plan...</Text>
            </View>
          ) : mealPlanGenerated ? (
            /* Generated Meal Plan Recipes */
            <ScrollView
              style={styles.mealPlanScrollView}
              contentContainerStyle={styles.mealPlanScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {generatedMealPlanRecipes.length > 0 ? (
                generatedMealPlanRecipes.map((recipe) => {
                  const imageUrl = imageUrls[recipe.id] ||
                    (typeof recipe.image === 'string' ? recipe.image : null);
                  const servings = mealPlanServings[recipe.id] || (recipe.servings || 2);

                  return (
                    <View key={recipe.id} style={styles.mealPlanRecipeCard}>
                      <View style={styles.mealPlanRecipeImageContainer}>
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.mealPlanRecipeImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.mealPlanRecipeImagePlaceholder}>
                            <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.mealPlanRecipePlusButton}
                          onPress={() => {
                            // TODO: Add recipe to planner
                            console.log('Add recipe to planner:', recipe.id);
                          }}
                        >
                          <Ionicons name="add" size={20} color="#1A1A1A" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.mealPlanRecipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.mealPlanRecipeTime}>
                        {recipe.cookTime || '35'} mins
                      </Text>
                      <View style={styles.mealPlanRecipeServings}>
                        <TouchableOpacity
                          style={styles.mealPlanRecipeServingsButton}
                          onPress={() => {
                            if (servings > 1) {
                              setMealPlanServings(prev => ({ ...prev, [recipe.id]: servings - 1 }));
                            }
                          }}
                        >
                          <Ionicons name="remove" size={18} color="#1A1A1A" />
                        </TouchableOpacity>
                        <Text style={styles.mealPlanRecipeServingsText}>{servings} Servings</Text>
                        <TouchableOpacity
                          style={styles.mealPlanRecipeServingsButton}
                          onPress={() => {
                            setMealPlanServings(prev => ({ ...prev, [recipe.id]: servings + 1 }));
                          }}
                        >
                          <Ionicons name="add" size={18} color="#1A1A1A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.mealPlanRecipeRefreshButton}
                          onPress={() => {
                            // TODO: Refresh/replace this recipe
                            console.log('Refresh recipe:', recipe.id);
                          }}
                        >
                          <Ionicons name="refresh" size={18} color="#1A1A1A" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                /* Empty State */
                <View style={styles.mealPlanEmptyContainer}>
                  <Text style={styles.mealPlanEmptyText}>No recipes found matching your preferences.</Text>
                  <Text style={styles.mealPlanEmptySubtext}>Try adjusting your preferences and try again.</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <>
              <ScrollView
                style={styles.mealPlanScrollView}
                contentContainerStyle={styles.mealPlanScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Meal Quantity Selector */}
                <View style={styles.mealPlanSection}>
                  <Text style={styles.mealPlanSectionTitle}>How many meals are you planning?</Text>
                  <View style={styles.mealPlanQuantitySelector}>
                    <TouchableOpacity
                      style={styles.mealPlanQuantityButton}
                      onPress={() => {
                        if (mealPlanQuantity > 1) {
                          setMealPlanQuantity(mealPlanQuantity - 1);
                        }
                      }}
                    >
                      <Ionicons name="remove" size={20} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text style={styles.mealPlanQuantityText}>{mealPlanQuantity}</Text>
                    <TouchableOpacity
                      style={styles.mealPlanQuantityButton}
                      onPress={() => {
                        setMealPlanQuantity(mealPlanQuantity + 1);
                      }}
                    >
                      <Ionicons name="add" size={20} color="#1A1A1A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Dietary Preferences */}
                <View style={styles.mealPlanSection}>
                  <Text style={styles.mealPlanSectionTitle}>What are your dietary preferences?</Text>
                  <View style={styles.mealPlanGrid}>
                    {[
                      { id: 'vegetarian', label: 'Vegetarian', icon: '🥕' },
                      { id: 'vegan', label: 'Vegan', icon: '🌱' },
                      { id: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
                      { id: 'no-preference', label: 'No preference', icon: '🍴' },
                    ].map((preference) => {
                      const isSelected = selectedDietaryPreference === preference.id;
                      return (
                        <TouchableOpacity
                          key={preference.id}
                          style={[
                            styles.mealPlanTag,
                            isSelected && styles.mealPlanTagSelected,
                          ]}
                          onPress={() => {
                            setSelectedDietaryPreference(isSelected ? '' : preference.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.mealPlanTagIcon}>{preference.icon}</Text>
                          <Text style={[
                            styles.mealPlanTagLabel,
                            isSelected && styles.mealPlanTagLabelSelected,
                          ]}>
                            {preference.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Dislikes or Allergies */}
                <View style={styles.mealPlanSection}>
                  <Text style={styles.mealPlanSectionTitle}>Any dislikes or allergies?</Text>
                  <View style={styles.mealPlanGrid}>
                    {(() => {
                      const dislikesList = [
                        { id: 'coriander', label: 'Coriander', icon: '🌿' },
                        { id: 'egg', label: 'Egg', icon: '🥚' },
                        { id: 'milk', label: 'Milk', icon: '🥛' },
                        { id: 'nuts', label: 'Nuts', icon: '🥜' },
                        { id: 'tofu', label: 'Tofu', icon: '🧈' },
                        ...ALL_INGREDIENTS.filter(ing => !['egg', 'tofu'].includes(ing.id)),
                      ];

                      // Get selected dislikes first (at the top)
                      const selectedItems = dislikesList.filter(item =>
                        selectedDislikes.includes(item.id) &&
                        item.label.toLowerCase().includes(dislikeSearchQuery.toLowerCase())
                      );
                      // Get unselected items
                      const unselectedItems = dislikesList.filter(item =>
                        !selectedDislikes.includes(item.id) &&
                        item.label.toLowerCase().includes(dislikeSearchQuery.toLowerCase())
                      );
                      // Combine: selected first (all of them), then unselected (up to 9 total)
                      const remainingSlots = 9 - selectedItems.length;
                      const sortedItems = [
                        ...selectedItems,
                        ...unselectedItems.slice(0, Math.max(0, remainingSlots))
                      ];

                      return sortedItems.map((item) => {
                        const isSelected = selectedDislikes.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.mealPlanTag,
                              isSelected && styles.mealPlanTagSelected,
                            ]}
                            onPress={() => {
                              if (isSelected) {
                                setSelectedDislikes(prev => prev.filter(id => id !== item.id));
                              } else {
                                setSelectedDislikes(prev => [...prev, item.id]);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.mealPlanTagIcon}>{item.icon}</Text>
                            <Text style={[
                              styles.mealPlanTagLabel,
                              isSelected && styles.mealPlanTagLabelSelected,
                            ]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>
                </View>
              </ScrollView>

              {/* Search Bar */}
              <TouchableOpacity
                style={styles.mealPlanSearchContainer}
                onPress={() => {
                  setShowMealPlanBottomSheet(false);
                  setIngredientSearchContext('meal-plan');
                  setSelectedSearchIngredients([...selectedDislikes]);
                  setShowIngredientSearchScreen(true);
                }}
              >
                <Ionicons name="search" size={20} color="#999999" style={styles.mealPlanSearchIcon} />
                <Text style={styles.mealPlanSearchInputPlaceholder}>Search for ingredients</Text>
              </TouchableOpacity>

              {/* Generate Button */}
              <TouchableOpacity
                style={styles.mealPlanGenerateButton}
                onPress={() => {
                  // Start generating meal plan
                  setIsGeneratingMealPlan(true);

                  // Simulate generation delay with animation
                  setTimeout(() => {
                    const filtered = filterRecipesByPreferences(allRecipes);
                    const selected = filtered.slice(0, mealPlanQuantity);
                    setGeneratedMealPlanRecipes(selected);
                    const initialServings: { [recipeId: string]: number } = {};
                    selected.forEach(recipe => {
                      initialServings[recipe.id] = recipe.servings || 2;
                    });
                    setMealPlanServings(initialServings);
                    setIsGeneratingMealPlan(false);
                    setMealPlanGenerated(true);
                  }, 2000);
                }}
              >
                <Text style={styles.mealPlanGenerateButtonText}>GENERATE MEAL PLAN</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Add to Planner Button (shown when meal plan is generated) */}
          {mealPlanGenerated && (
            <TouchableOpacity
              style={[
                styles.mealPlanAddToPlannerButton,
                generatedMealPlanRecipes.length === 0 && styles.mealPlanAddToPlannerButtonDisabled
              ]}
              onPress={() => {
                if (generatedMealPlanRecipes.length === 0) return;
                // TODO: Add all recipes to planner
                console.log('Add to planner:', generatedMealPlanRecipes.map(r => r.id));
                setShowMealPlanBottomSheet(false);
                setMealPlanGenerated(false);
                setGeneratedMealPlanRecipes([]);
                setMealPlanServings({});
              }}
              disabled={generatedMealPlanRecipes.length === 0}
            >
              <Text style={[
                styles.mealPlanAddToPlannerButtonText,
                generatedMealPlanRecipes.length === 0 && styles.mealPlanAddToPlannerButtonTextDisabled
              ]}>
                ADD TO MY PLANNER
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheet>

      {/* Ingredient Search Screen */}
      {showIngredientSearchScreen && (
        <View style={styles.ingredientSearchScreen}>
          <SafeAreaView style={styles.ingredientSearchSafeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.ingredientSearchHeader}>
              <TouchableOpacity
                style={styles.ingredientSearchBackButton}
                onPress={() => {
                  // Apply selected ingredients to parent screen
                  if (ingredientSearchContext === 'meal-plan') {
                    // Merge selected ingredients with existing dislikes
                    setSelectedDislikes(prev => {
                      const combined = [...prev];
                      selectedSearchIngredients.forEach(id => {
                        if (!combined.includes(id)) {
                          combined.push(id);
                        }
                      });
                      return combined;
                    });
                    setShowMealPlanBottomSheet(true);
                  } else {
                    // Update selected ingredients for "use up ingredients"
                    setSelectedIngredients(selectedSearchIngredients);
                    setShowUseUpIngredientsBottomSheet(true);
                  }
                  setShowIngredientSearchScreen(false);
                  setIngredientSearchScreenQuery('');
                  setSelectedSearchIngredients([]);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
              <View style={styles.ingredientSearchInputContainer}>
                <TextInput
                  style={styles.ingredientSearchInput}
                  placeholder="Search for an Ingredient"
                  placeholderTextColor="#999999"
                  value={ingredientSearchScreenQuery}
                  onChangeText={setIngredientSearchScreenQuery}
                  autoFocus={true}
                />
                {ingredientSearchScreenQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setIngredientSearchScreenQuery('')}
                    style={styles.ingredientSearchClearButton}
                  >
                    <Ionicons name="close" size={20} color="#999999" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Selected Ingredients Chips or Empty State */}
            {selectedSearchIngredients.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.ingredientSearchSelectedContainer}
                contentContainerStyle={styles.ingredientSearchSelectedContent}
              >
                {selectedSearchIngredients.map((ingredientId) => {
                  const ingredient = ALL_INGREDIENTS.find(item => item.id === ingredientId);

                  if (!ingredient) return null;

                  return (
                    <View key={ingredient.id} style={styles.ingredientSearchSelectedChip}>
                      <Text style={styles.ingredientSearchSelectedChipIcon}>{ingredient.icon}</Text>
                      <Text style={styles.ingredientSearchSelectedChipLabel}>{ingredient.label}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedSearchIngredients(prev => prev.filter(id => id !== ingredient.id));
                        }}
                        style={styles.ingredientSearchSelectedChipRemove}
                      >
                        <Ionicons name="close" size={16} color="#1A1A1A" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.ingredientSearchStatusContainer}>
                <Text style={styles.ingredientSearchStatusText}>No ingredients selected</Text>
              </View>
            )}

            {/* Ingredient Tags Grid */}
            <ScrollView
              style={styles.ingredientSearchScrollView}
              contentContainerStyle={styles.ingredientSearchScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.ingredientSearchGrid}>
                {ALL_INGREDIENTS
                  .filter(ingredient =>
                    !selectedSearchIngredients.includes(ingredient.id) &&
                    ingredient.label.toLowerCase().includes(ingredientSearchScreenQuery.toLowerCase())
                  )
                  .map((ingredient) => {
                    return (
                      <TouchableOpacity
                        key={ingredient.id}
                        style={styles.ingredientSearchTag}
                        onPress={() => {
                          setSelectedSearchIngredients(prev => [...prev, ingredient.id]);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.ingredientSearchTagIcon}>{ingredient.icon}</Text>
                        <Text style={styles.ingredientSearchTagLabel}>
                          {ingredient.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>

            {/* Return Button */}
            <TouchableOpacity
              style={styles.ingredientSearchReturnButton}
              onPress={() => {
                if (ingredientSearchContext === 'meal-plan') {
                  // Update selected dislikes with search ingredients
                  setSelectedDislikes(prev => {
                    const combined = [...prev];
                    selectedSearchIngredients.forEach(id => {
                      if (!combined.includes(id)) {
                        combined.push(id);
                      }
                    });
                    return combined;
                  });
                  setShowMealPlanBottomSheet(true);
                } else {
                  // Update selected ingredients for "use up ingredients"
                  setSelectedIngredients(selectedSearchIngredients);
                  setShowUseUpIngredientsBottomSheet(true);
                }
                setShowIngredientSearchScreen(false);
                setIngredientSearchScreenQuery('');
                setSelectedSearchIngredients([]);
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              <Text style={styles.ingredientSearchReturnButtonText}>RETURN TO PREVIOUS SCREEN</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={2000}
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sousChefButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  sousChefButtonWide: {
    position: 'absolute',
    bottom: 5, // Same position as floating button
    left: 16,
    right: 16,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sousChefButtonFloating: {
    position: 'absolute',
    bottom: 5, // 50px gap above bottom navigation (nav bar ~60px)
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 12, // Rounded corners for square button
  },
  sousChefButtonTextWide: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sousChefButtonTextFloating: {
    fontSize: 18,
    fontWeight: '700',
  },
  sousChefLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sousChefMessageBubble: {
    flex: 1,
    backgroundColor: '#F5F5F0', // theme parchment
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sousChefMessageBubbleTail: {
    position: 'absolute',
    right: -8,
    top: 16,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#F5F5F0', // theme parchment
  },
  sousChefLogo: {
    fontSize: 16,
    fontWeight: '700',
  },
  sousChefMenuContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  sousChefMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -45, // Position to cover the notch (handle is at top with 12px paddingTop)
    marginBottom: 30,
    position: 'relative',
  },
  sousChefMenuLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sousChefMenuLogo: {
    fontSize: 20,
    fontWeight: '700',
  },
  sousChefMenuCloseButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: -40, // Position 20px from right edge
    top: 30, // Position 10px down from top
  },
  sousChefMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  sousChefMenuItem: {
    borderRadius: 9999, // Fully rounded (pill-shaped)
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    alignSelf: 'center', // Center the button and only take needed width
  },
  sousChefMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Inspiration Bottom Sheet Styles
  inspirationContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  inspirationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  inspirationBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  inspirationHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  inspirationCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  inspirationAnimationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  inspirationDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  inspirationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
  },
  inspirationLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  inspirationLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  inspirationScrollView: {
    flex: 1,
  },
  inspirationScrollContent: {
    paddingBottom: 20,
  },
  inspirationRecipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  inspirationRecipeCard: {
    width: '48%',
    marginBottom: 16,
  },
  inspirationRecipeImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  inspirationRecipeImage: {
    width: '100%',
    height: '100%',
  },
  inspirationRecipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspirationPlusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspirationRecipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  inspirationEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  inspirationEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  inspirationEmptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  // Use Up Ingredients Bottom Sheet Styles
  useUpIngredientsContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  useUpIngredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    width: '100%',
  },
  useUpIngredientsBackButton: {
    position: 'absolute',
    left: -24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  useUpIngredientsHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 50,
  },
  useUpIngredientsCloseButton: {
    position: 'absolute',
    right: -24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  useUpIngredientsScrollView: {
    flex: 1,
    marginBottom: 16,
  },
  useUpIngredientsScrollContent: {
    paddingBottom: 20,
  },
  useUpIngredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  useUpIngredientTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  useUpIngredientTagSelected: {
    backgroundColor: '#6B6B6B',
    borderColor: '#6B6B6B',
  },
  useUpIngredientIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  useUpIngredientLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  useUpIngredientLabelSelected: {
    color: '#FFFFFF',
  },
  useUpIngredientsSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    alignSelf: 'center',
    width: '75%',
  },
  useUpIngredientsSearchIcon: {
    marginRight: 12,
    color: '#999999',
  },
  useUpIngredientsSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: 'transparent',
  },
  useUpIngredientsSearchInputPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#999999',
  },
  useUpIngredientsFindButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
    width: '75%',
  },
  useUpIngredientsFindButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  useUpIngredientsFindButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  useUpIngredientsRecipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  useUpIngredientsRecipeCard: {
    width: '47%',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F5F5F0',
    borderRadius: 12,
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  useUpIngredientsRecipeImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  useUpIngredientsRecipeImage: {
    width: '100%',
    height: '100%',
  },
  useUpIngredientsRecipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  useUpIngredientsVegetarianIcon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  useUpIngredientsVegetarianText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  useUpIngredientsPlusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  useUpIngredientsRecipeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  useUpIngredientsEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  useUpIngredientsEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  useUpIngredientsEmptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  // Meal Plan Bottom Sheet Styles
  mealPlanContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  mealPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    width: '100%',
  },
  mealPlanBackButton: {
    position: 'absolute',
    left: -24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  mealPlanHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 50,
  },
  mealPlanCloseButton: {
    position: 'absolute',
    right: -24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  mealPlanScrollView: {
    flex: 1,
    marginBottom: 16,
  },
  mealPlanScrollContent: {
    paddingBottom: 20,
  },
  mealPlanSection: {
    marginBottom: 24,
  },
  mealPlanSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  mealPlanQuantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    width: 120,
  },
  mealPlanQuantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanQuantityText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginHorizontal: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  mealPlanGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  mealPlanTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mealPlanTagSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  mealPlanTagIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  mealPlanTagLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  mealPlanTagLabelSelected: {
    color: '#1A1A1A',
  },
  mealPlanSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    alignSelf: 'center',
    width: '75%',
  },
  mealPlanSearchIcon: {
    marginRight: 12,
  },
  mealPlanSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: 'transparent',
  },
  mealPlanGenerateButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
    width: '75%',
  },
  mealPlanGenerateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  mealPlanRecipeCard: {
    marginBottom: 20,
  },
  mealPlanRecipeImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    alignSelf: 'center',
  },
  mealPlanRecipeImage: {
    width: '100%',
    height: '100%',
  },
  mealPlanRecipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanRecipePlusButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanRecipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  mealPlanRecipeTime: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    textAlign: 'center',
  },
  mealPlanRecipeServings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mealPlanRecipeServingsButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanRecipeServingsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    minWidth: 80,
    textAlign: 'center',
  },
  mealPlanRecipeRefreshButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanAddToPlannerButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
    width: '75%',
  },
  mealPlanAddToPlannerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  mealPlanAddToPlannerButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  mealPlanAddToPlannerButtonTextDisabled: {
    color: '#999999',
  },
  mealPlanLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  mealPlanLoadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  mealPlanLoadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
  },
  mealPlanLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  mealPlanEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  mealPlanEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  mealPlanEmptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  mealPlanSearchInputPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#999999',
  },
  // Ingredient Search Screen Styles
  ingredientSearchScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10000,
    elevation: 10000,
  },
  ingredientSearchSafeArea: {
    flex: 1,
  },
  ingredientSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ingredientSearchBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  ingredientSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 8,
  },
  ingredientSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
  },
  ingredientSearchClearButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  ingredientSearchStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ingredientSearchStatusText: {
    fontSize: 14,
    color: '#999999',
  },
  ingredientSearchSelectedContainer: {
    maxHeight: 60,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ingredientSearchSelectedContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  ingredientSearchSelectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  ingredientSearchSelectedChipIcon: {
    fontSize: 16,
  },
  ingredientSearchSelectedChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  ingredientSearchSelectedChipRemove: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  ingredientSearchScrollView: {
    flex: 1,
  },
  ingredientSearchScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  ingredientSearchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  ingredientSearchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ingredientSearchTagSelected: {
    backgroundColor: '#6B6B6B',
    borderColor: '#6B6B6B',
  },
  ingredientSearchTagIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  ingredientSearchTagLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  ingredientSearchTagLabelSelected: {
    color: '#FFFFFF',
  },
  ingredientSearchReturnButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ingredientSearchReturnButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingContainer: {
    flex: 1,
  },
  greetingHighlightContainer: {
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  greetingTextHighlighted: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    padding: 8,
  },
  exploreButton: {
    padding: 8,
  },
  notificationButton: {
    padding: 8,
  },
  notificationIconContainer: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  profileButton: {
    padding: 8,
  },
  filterContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  radioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A1A1A',
  },
  radioUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  todaySection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  todayTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  readyToCookTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  todayRecipeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
  },
  todayRecipeImageContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  todayRecipeImage: {
    width: '100%',
    height: '100%',
  },
  todayRecipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayRecipeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  todayRecipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  todayRecipeTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  todayEditButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shoppingListSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  shoppingListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  shoppingListButton: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
  },
  shoppingListButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shoppingListButtonText: {
    flex: 1,
  },
  shoppingListButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  shoppingListButtonSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  viewAllLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  viewAllButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  horizontalScroll: {
    paddingRight: 16,
    gap: 12,
  },
  whatsNewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  recipeImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
  },
  recipePlusButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToMenuButton: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  placeholderText: {
    fontSize: 48,
  },
  recipeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  recipeCardTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  recipeCardTime: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  myRecipesWrapper: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
  },
  recipesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  myRecipeCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  myRecipeCardImage: {
    width: '100%',
    height: '100%',
  },
  myRecipeCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  myRecipeCardPlaceholderSquare: {
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  addRecipeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  addRecipeButtonContainer: {
    backgroundColor: '#E0E0E0', // Light gray
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  recipeCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  recipeThumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  recipeThumbnailPlaceholder: {
    fontSize: 48,
  },
  recipeThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    minHeight: 40,
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeMetaText: {
    fontSize: 12,
    color: '#666',
  },
  cardBookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  ourPicksCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  ourPicksImageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  ourPicksImage: {
    width: '100%',
    height: '100%',
  },
  ourPicksImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ourPicksAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    marginTop: 8,
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    minHeight: 400,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
    textAlign: 'center',
  },
  // Add to Menu Modal Styles
  addToMenuModalContent: {
    paddingBottom: 20,
  },
  addToMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  addToMenuHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  addToMenuCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToMenuImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F0',
    marginBottom: 16,
    alignSelf: 'center',
  },
  addToMenuImage: {
    width: '100%',
    height: '100%',
  },
  addToMenuImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F0',
  },
  addToMenuPlaceholderText: {
    fontSize: 48,
  },
  addToMenuTitleContainer: {
    marginBottom: 20,
  },
  addToMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
    borderRadius: 4,
    textAlign: 'center',
  },
  thisWeekSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 12,
  },
  weekNavButton: {
    padding: 4,
  },
  weekNavButtonDisabled: {
    opacity: 0.5,
  },
  thisWeekContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thisWeekText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  addToMenuQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
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
    marginBottom: 32,
    gap: 4,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dayButtonSelected: {
    backgroundColor: '#CEEC2C',
    borderColor: '#CEEC2C',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  dayButtonTextSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  addToMenuSubmitButton: {
    backgroundColor: '#CEEC2C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToMenuSubmitButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  addToMenuSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
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
  // Collection Selection Bottom Sheet Styles
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
  // Challenges Section Styles
  challengeCard: {
    backgroundColor: '#B8E6D3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: Dimensions.get('window').width - 32, // Full width minus section padding
    marginRight: 12,
    minHeight: 100,
  },
  challengeProfileContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0, // Allow flex to shrink
  },
  challengeProfileImage: {
    marginRight: 12,
  },
  challengeProfilePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeProfileEmoji: {
    fontSize: 24,
  },
  challengeContent: {
    flex: 1,
    minWidth: 0, // Allow flex to shrink
    marginRight: 8,
  },
  challengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    flexWrap: 'wrap',
  },
  challengeDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
    flexShrink: 1,
  },
  challengeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0, // Prevent stats from shrinking
  },
  challengeParticipants: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
    flexShrink: 0, // Prevent text from shrinking
  },
  challengeProgressContainer: {
    marginTop: 8,
  },
  challengeProgressText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
    marginBottom: 4,
  },
  challengeProgressBarBackground: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  challengeProgressBarFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
  },
  challengeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  challengeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default RecipesScreen;
