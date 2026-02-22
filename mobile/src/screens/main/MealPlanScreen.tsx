import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TouchableWithoutFeedback, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../../components/BottomSheet';
import { Toast } from '../../components/Toast';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useRecipesStore } from '../../stores/recipesStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { GrocerySource } from '../../types/grocery';
import { Recipe } from '../../types/recipe';
import { starterRecipes } from '../../data/starterRecipes';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { RootStackParamList, TabParamList } from '../../types/navigation';
import { useCallback } from 'react';
import { CompositeNavigationProp } from '@react-navigation/native';
import { ref, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { storage, auth, functions, db } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type MealPlanScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'MealPlan'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type MealPlanScreenRouteProp = RouteProp<TabParamList, 'MealPlan'>;

const MealPlanScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<MealPlanScreenNavigationProp>();
  const route = useRoute<MealPlanScreenRouteProp>();
  const { mealPlans, addMealPlan, updateMealPlan, removeMealPlan, clearMealPlansForDate, syncFromFirebase, enrichMealPlansWithRecipes } = useMealPlanStore();
  const { recipes, updateRecipe, addRecipe } = useRecipesStore();
  const { addItems, removeItem, updateItem, items } = useGroceriesStore();
  const { collections, loadCollections, addCollection } = useCollectionsStore();
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [showRecipeSelectionModal, setShowRecipeSelectionModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState<string | null>(null); // dayKey
  const [overflowMenuPosition, setOverflowMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItemsCount, setAddedItemsCount] = useState<number | null>(null);
  const [showEditRecipeModal, setShowEditRecipeModal] = useState(false);
  const [selectedMealPlanForEdit, setSelectedMealPlanForEdit] = useState<MealPlanItem | null>(null);
  const [editSelectedDay, setEditSelectedDay] = useState<string | null>(null);
  const [editWeekOffset, setEditWeekOffset] = useState(0);
  const [showDatePickerInModal, setShowDatePickerInModal] = useState(false);
  const [showCollectionSelection, setShowCollectionSelection] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showRecipeNotesInModal, setShowRecipeNotesInModal] = useState(false);
  const [recipeNotes, setRecipeNotes] = useState('');
  const [recipeNotesLoading, setRecipeNotesLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const overflowButtonRefs = useRef<{ [key: string]: React.ElementRef<typeof TouchableOpacity> | null }>({});
  const [mealPlanImageUrls, setMealPlanImageUrls] = useState<{ [mealPlanId: string]: string }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper to check if a string is a storage path (not a URL)
  const isStoragePath = (image: string): boolean => {
    return typeof image === 'string' &&
      !image.startsWith('http://') &&
      !image.startsWith('https://') &&
      !image.startsWith('file://') &&
      !image.startsWith('content://') &&
      image.includes('/');
  };

  // Convert storage path to download URL for meal plan images
  const getMealPlanImageUrl = async (mealPlanId: string, image: string | undefined): Promise<string | null> => {
    if (!image) return null;

    // If already cached, return it
    if (mealPlanImageUrls[mealPlanId]) {
      return mealPlanImageUrls[mealPlanId];
    }

    // If not a string, return null
    if (typeof image !== 'string') {
      return null;
    }

    // If it's already a URL, return it
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image;
    }

    // If it's a storage path, convert to download URL
    if (isStoragePath(image)) {
      try {
        const storageRef = ref(storage, image);
        const downloadURL = await getDownloadURL(storageRef);
        setMealPlanImageUrls(prev => ({ ...prev, [mealPlanId]: downloadURL }));
        return downloadURL;
      } catch (error) {
        console.error('Error getting download URL for meal plan', mealPlanId, ':', error);
        return null;
      }
    }

    return null;
  };

  // Load meal plans from Firebase on mount (if authenticated)
  useEffect(() => {
    const loadMealPlans = async () => {
      if (auth.currentUser) {
        try {
          await syncFromFirebase();
          const recipeMap = new Map<string, Recipe>();
          starterRecipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
          recipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
          enrichMealPlansWithRecipes(Array.from(recipeMap.values()));
        } catch (error) {
          console.error('Error loading meal plans from Firebase:', error);
        }
      }
    };

    loadMealPlans();
    // Retry sync after a short delay in case auth wasn't ready on first run (so existing plans show)
    const retryTimer = setTimeout(() => {
      if (auth.currentUser) syncFromFirebase();
    }, 800);
    return () => clearTimeout(retryTimer);
  }, []);

  // Sync when auth becomes available (e.g. after app load / restore)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) syncFromFirebase();
    });
    return () => unsubscribe();
  }, [syncFromFirebase]);

  const handleRefresh = useCallback(async () => {
    if (!auth.currentUser) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    try {
      await syncFromFirebase();
      const recipeMap = new Map<string, Recipe>();
      starterRecipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
      recipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
      enrichMealPlansWithRecipes(Array.from(recipeMap.values()));
    } catch (error) {
      console.error('Error refreshing meal plans:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [syncFromFirebase, enrichMealPlansWithRecipes, recipes]);

  // Enrich meal plans with recipe data when recipes change
  useEffect(() => {
    // Get unique recipes by ID (starter recipes + recipes from store)
    const recipeMap = new Map<string, Recipe>();
    starterRecipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
    recipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
    const allRecipes = Array.from(recipeMap.values());
    enrichMealPlansWithRecipes(allRecipes);
  }, [recipes]);

  // Load image URLs for meal plans with storage paths
  useEffect(() => {
    const loadMealPlanImageUrls = async () => {
      const urlPromises = mealPlans.map(async (plan) => {
        if (plan.recipeImage && typeof plan.recipeImage === 'string' && isStoragePath(plan.recipeImage)) {
          const url = await getMealPlanImageUrl(plan.id, plan.recipeImage);
          return { mealPlanId: plan.id, url };
        }
        return null;
      });

      const results = await Promise.all(urlPromises);
      const newUrls: { [mealPlanId: string]: string } = {};
      results.forEach(result => {
        if (result && result.url) {
          newUrls[result.mealPlanId] = result.url;
        }
      });
      setMealPlanImageUrls(prev => ({ ...prev, ...newUrls }));
    };

    loadMealPlanImageUrls();
  }, [mealPlans]);

  // Listen for navigation params and sync when planner tab is focused (so newly added meals show up)
  useFocusEffect(
    useCallback(() => {
      const params = route.params;
      if (params?.addedItemsCount) {
        const count = params.addedItemsCount;
        setAddedItemsCount(count);
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setAddedItemsCount(null);
        }, 5000);
        // Clear the param to avoid showing it again on next focus
        navigation.setParams({ addedItemsCount: undefined });
      }
      if (params?.weekOffset !== undefined) {
        // Set the week offset from navigation params
        setWeekOffset(params.weekOffset);
        // Clear the param after using it
        navigation.setParams({ weekOffset: undefined });
      }
      // Sync from Firebase when tab gains focus so we show latest data (merge keeps local-only items)
      if (auth.currentUser) {
        syncFromFirebase();
      }
    }, [route.params, navigation, syncFromFirebase])
  );


  // Get week dates based on offset
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (offset * 7));

    // Set to midnight to avoid timezone issues
    monday.setHours(0, 0, 0, 0);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const handlePreviousWeek = () => {
    setWeekOffset(weekOffset - 1);
    setShowOverflowMenu(null);
  };

  const handleNextWeek = () => {
    setWeekOffset(weekOffset + 1);
    setShowOverflowMenu(null);
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) {
      return 'THIS WEEK';
    } else if (weekOffset === 1) {
      return 'NEXT WEEK';
    } else if (weekOffset > 1) {
      return `IN ${weekOffset} WEEKS`;
    } else {
      return 'PREVIOUS WEEK';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const formatDayFull = (date: Date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const daySuffix = getDaySuffix(day);
    return `${dayName}, ${month} ${day}${daySuffix}`;
  };

  const getDaySuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Helper to format date as YYYY-MM-DD (local timezone, not UTC)
  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateKey = (date: Date): string => {
    return formatDateKey(date); // YYYY-MM-DD
  };

  const getDayKey = (date: Date): string => {
    return `${formatDayName(date)}-${formatDayNumber(date)}`;
  };

  const getMealPlansForDay = (date: Date): MealPlanItem[] => {
    const dateKey = getDateKey(date);
    return mealPlans.filter(plan => plan.date === dateKey);
  };

  const hasMealPlans = (date: Date): boolean => {
    return getMealPlansForDay(date).length > 0;
  };

  // Get meal plans without a date (shelf items)
  const getShelfMealPlans = (): MealPlanItem[] => {
    return mealPlans.filter(plan => !plan.date || plan.date === '' || plan.date === 'unscheduled');
  };

  // Prefer saved servingsOverride when valid (>= 1), so meal plan shows what was set when added
  const getDisplayServings = (plan: MealPlanItem, recipe?: Recipe | null): number => {
    const override = plan.servingsOverride;
    if (override != null && !isNaN(Number(override)) && Number(override) >= 1) return Number(override);
    return recipe?.servings ?? 4;
  };

  const handleAddMeal = (dayKey: string, date: Date) => {
    setSelectedDay(dayKey);
    setShowMealTypeModal(true);
  };

  const handleMealTypeSelect = (mealType: string) => {
    if (mealType === 'notes') {
      // TODO: Handle notes
      setShowMealTypeModal(false);
      setSelectedDay(null);
      return;
    }

    setSelectedMealType(mealType);
    setShowMealTypeModal(false);
    setShowRecipeSelectionModal(true);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    if (!selectedDay || !selectedMealType) return;

    const date = weekDates.find(d => getDayKey(d) === selectedDay);
    if (!date) return;

    const newMealPlan: MealPlanItem = {
      id: `${Date.now()}-${Math.random()}`,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeImage: recipe.image,
      mealType: selectedMealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      date: getDateKey(date),
      includeInGrocery: true, // Default to true - user can toggle off
      servingsOverride: undefined, // Use recipe default servings
    };

    addMealPlan(newMealPlan);

    // Automatically add ingredients to groceries list if includeInGrocery is true
    if (newMealPlan.includeInGrocery && recipe.ingredients && recipe.ingredients.length > 0) {
      const recipeServings = recipe.servings || 4;
      const targetServings = newMealPlan.servingsOverride || recipeServings;

      // Adjust ingredients based on servings
      const adjustedIngredients = recipe.ingredients.map(ing => ({
        ...ing,
        amount: String(Number(ing.amount || '1') * (targetServings / recipeServings)),
      }));

      // Create sources for each ingredient
      const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        mealPlanEntryId: newMealPlan.id,
        amount: ing.amount,
      }));

      addItems(adjustedIngredients, recipe.id, recipe.title, targetServings, sources);
      console.log('🛒 Added ingredients to groceries list:', adjustedIngredients.length);
    }

    setShowRecipeSelectionModal(false);
    setSearchQuery('');
    setSelectedDay(null);
    setSelectedMealType(null);
  };

  // Combine starter recipes and all recipes from store (includes Firebase recipes)
  const allRecipes = useMemo(() => {
    // Get unique recipes by ID (starter recipes + recipes from store)
    const recipeMap = new Map<string, Recipe>();

    // Add starter recipes first
    starterRecipes.forEach(recipe => {
      recipeMap.set(recipe.id, recipe);
    });

    // Add recipes from store (will override starter recipes if same ID)
    recipes.forEach(recipe => {
      recipeMap.set(recipe.id, recipe);
    });

    return Array.from(recipeMap.values());
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRecipes;
    }
    const query = searchQuery.toLowerCase();
    return allRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(query) ||
      recipe.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, allRecipes]);

  const handleCloseRecipeModal = () => {
    setShowRecipeSelectionModal(false);
    setSearchQuery('');
    setSelectedMealType(null);
  };

  const handleOverflowMenu = (dayKey: string) => {
    if (showOverflowMenu === dayKey) {
      setShowOverflowMenu(null);
      setOverflowMenuPosition(null);
      return;
    }

    // Get the button position using measureInWindow
    const buttonRef = overflowButtonRefs.current[dayKey];
    if (buttonRef) {
      buttonRef.measureInWindow((x: number, y: number, width: number, height: number) => {
        setOverflowMenuPosition({
          x: x + width - 200, // Align right edge of menu with right edge of button (menu width is ~200)
          y: y + height + 4, // Position below the button with small gap
        });
        setShowOverflowMenu(dayKey);
      });
    } else {
      // Fallback: show menu at default position
      setShowOverflowMenu(dayKey);
      setOverflowMenuPosition(null);
    }
  };

  const handleAddToGroceryList = (date: Date) => {
    const dayMealPlans = getMealPlansForDay(date);

    // Pre-select all meal plans for this day
    if (dayMealPlans.length > 0) {
      navigation.navigate('ChooseRecipes', {
        preSelectedMealPlanIds: dayMealPlans.map(plan => plan.id),
      });
    } else {
      // No meal plans for this day, just navigate without pre-selection
      navigation.navigate('ChooseRecipes');
    }

    setShowOverflowMenu(null);
    setOverflowMenuPosition(null);
  };

  const handleClearRecipes = (date: Date) => {
    const dateKey = getDateKey(date);
    clearMealPlansForDate(dateKey);
    setShowOverflowMenu(null);
  };

  const handleUpdateServings = (planId: string, delta: number) => {
    const plan = mealPlans.find((p) => p.id === planId);
    if (!plan) return;

    const recipe = allRecipes.find((r) => r.id === plan.recipeId);
    if (!recipe) return;

    const currentServings = getDisplayServings(plan, recipe);
    const newServings = Math.max(1, currentServings + delta);

    updateMealPlan(planId, { servingsOverride: newServings });
  };

  const handleToggleIncludeInGrocery = (planId: string) => {
    const plan = mealPlans.find((p) => p.id === planId);
    if (!plan) return;

    const recipe = allRecipes.find((r) => r.id === plan.recipeId);
    if (!recipe) return;

    const newIncludeInGrocery = !plan.includeInGrocery;
    updateMealPlan(planId, { includeInGrocery: newIncludeInGrocery });

    if (newIncludeInGrocery) {
      // Add items to grocery list
      const servings = getDisplayServings(plan, recipe);
      const baseServings = recipe.servings || 4;
      const adjustedIngredients = recipe.ingredients.map((ing) => ({
        ...ing,
        amount: String(Number(ing.amount) * (servings / baseServings)),
      }));

      // Create sources for each ingredient
      const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        mealPlanEntryId: plan.id,
        amount: ing.amount,
      }));

      addItems(adjustedIngredients, recipe.id, recipe.title, servings, sources);
    } else {
      // Remove items from grocery list that came from this meal plan entry
      const itemsToRemove = items.filter((item) =>
        item.sources?.some((source) => source.mealPlanEntryId === plan.id)
      );

      // Remove items that only have this meal plan as source
      itemsToRemove.forEach((item) => {
        // Check if this is the only source for this item
        const hasOtherSources = item.sources?.some((source) => source.mealPlanEntryId !== plan.id);
        if (!hasOtherSources && item.sources && item.sources.length === 1) {
          // This item only came from this meal plan, remove it completely
          removeItem(item.id);
        } else {
          // Item has other sources - remove this meal plan's source from the item
          const updatedSources = item.sources?.filter((source) => source.mealPlanEntryId !== plan.id);
          if (updatedSources && updatedSources.length > 0) {
            updateItem(item.id, { sources: updatedSources });
          } else {
            // No sources left, remove the item
            removeItem(item.id);
          }
        }
      });
    }
  };

  // Edit Recipe Modal Handlers
  const getEditWeekDates = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + (offset * 7));

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const handleEditDaySelect = (dayKey: string) => {
    if (!selectedMealPlanForEdit) return;
    setEditSelectedDay(dayKey);
    // Update the meal plan immediately when a day is selected
    updateMealPlan(selectedMealPlanForEdit.id, { date: dayKey });
  };

  const handleEditWeekChange = (delta: number) => {
    const newOffset = editWeekOffset + delta;
    if (newOffset >= 0 && newOffset <= 3) {
      setEditWeekOffset(newOffset);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedMealPlanForEdit || !editSelectedDay) return;

    // Update the meal plan with new date
    updateMealPlan(selectedMealPlanForEdit.id, { date: editSelectedDay });

    setShowEditRecipeModal(false);
    setSelectedMealPlanForEdit(null);
    setEditSelectedDay(null);
    setEditWeekOffset(0);
  };

  const handleMoveToNextWeek = () => {
    if (!selectedMealPlanForEdit) return;

    const currentDate = new Date(selectedMealPlanForEdit.date);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(currentDate.getDate() + 7);
    const nextWeekKey = nextWeekDate.toISOString().split('T')[0];

    updateMealPlan(selectedMealPlanForEdit.id, { date: nextWeekKey });
    setShowEditRecipeModal(false);
    setSelectedMealPlanForEdit(null);
    setEditSelectedDay(null);
    setEditWeekOffset(0);
  };

  const handleDeleteRecipe = () => {
    if (!selectedMealPlanForEdit) return;

    removeMealPlan(selectedMealPlanForEdit.id);
    setShowEditRecipeModal(false);
    setSelectedMealPlanForEdit(null);
    setEditSelectedDay(null);
    setEditWeekOffset(0);
  };

  const handleShareRecipe = async () => {
    if (!selectedMealPlanForEdit) return;

    try {
      const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
      if (!recipe) return;

      const shareMessage = `Check out this recipe: ${recipe.title}`;
      // TODO: Implement actual share functionality using React Native Share API
      console.log('Share recipe:', recipe.title);

      setShowEditRecipeModal(false);
      setSelectedMealPlanForEdit(null);
    } catch (error) {
      console.error('Error sharing recipe:', error);
    }
  };

  const handleToggleSaveToMyRecipes = () => {
    if (!selectedMealPlanForEdit) return;
    // Show collection selection bottom sheet
    loadCollections();
    setShowCollectionSelection(true);
  };



  const handleToggleCollection = async (collection: string) => {
    if (!selectedMealPlanForEdit) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    if (!recipe) return;

    // Support both old cookbook format and new collections array format
    const currentCollections = recipe.collections || (recipe.cookbook ? [recipe.cookbook] : []);
    const isSelected = Array.isArray(currentCollections) && currentCollections.includes(collection);

    try {
      // PROPOSED FIX: If user doesn't own recipe, CLONE it first
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (recipe.userId !== currentUser.uid) {
        console.log('User does not own recipe, cloning...', recipe.id);

        // Prepare data for new recipe (clone)
        // We only add the NEW collection, ignoring previous collections of the public recipe
        // unless we want to keep them? Usually public recipes don't have user collections.
        // We'll start fresh with the selected collection.
        const newCollections = [collection];

        const newRecipeData = {
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          image: recipe.image,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          nutrition: recipe.nutrition,
          equipment: recipe.equipment,
          tags: recipe.tags,
          cuisine: recipe.cuisine,
          // Add back-reference to original in notes
          notes: recipe.notes ? `${recipe.notes}\n\nCloned from: ${recipe.id}` : `Cloned from: ${recipe.id}`,
          sourceUrls: recipe.sourceUrls || [],
          collections: newCollections,
          isPublic: false // Private copy
        };

        const createRecipeFn = httpsCallable(functions, 'createRecipe');
        const result = await createRecipeFn(newRecipeData);
        const { recipeId: newRecipeId, recipe: newRecipeObj } = result.data as any;

        console.log('Cloned recipe created:', newRecipeId);

        // Update local recipe store
        addRecipe(newRecipeObj);

        // Update the meal plan entry to point to the NEW recipe
        updateMealPlan(selectedMealPlanForEdit.id, {
          recipeId: newRecipeId,
          // recipeTitle stays same
        });

        // Update selection state to point to new recipe (so subsequent edits work)
        setSelectedMealPlanForEdit({
          ...selectedMealPlanForEdit,
          recipeId: newRecipeId
        });

        setToastMessage('Saved to your recipes');
        setToastType('success');
        setToastVisible(true);
        return;
      }

      // --- EXISTING LOGIC FOR OWNED RECIPES ---

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
    } catch (error) {
      console.error('Error updating recipe collection:', error);
      setToastMessage('Failed to update collection');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const handleCreateCollection = async () => {
    if (!selectedMealPlanForEdit || !newCollectionName.trim()) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    if (!recipe) return;

    const trimmedName = newCollectionName.trim();

    try {
      // Add the new collection to user's collections
      await addCollection(trimmedName);

      // PROPOSED FIX: If user doesn't own recipe, CLONE it first
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (recipe.userId !== currentUser.uid) {
        console.log('User does not own recipe, cloning for new collection...', recipe.id);

        const newCollections = [trimmedName];

        const newRecipeData = {
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          image: recipe.image,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          nutrition: recipe.nutrition,
          equipment: recipe.equipment,
          tags: recipe.tags,
          cuisine: recipe.cuisine,
          sourceUrls: recipe.sourceUrls ? [...recipe.sourceUrls, `Cloned from: ${recipe.id}`] : [`Cloned from: ${recipe.id}`],
          collections: newCollections,
          isPublic: false
        };

        const createRecipeFn = httpsCallable(functions, 'createRecipe');
        const result = await createRecipeFn(newRecipeData);
        const { recipeId: newRecipeId, recipe: newRecipeObj } = result.data as any;

        // Update local recipe store
        addRecipe(newRecipeObj);

        // Update the meal plan entry
        updateMealPlan(selectedMealPlanForEdit.id, {
          recipeId: newRecipeId
        });

        // Update selection state
        setSelectedMealPlanForEdit({
          ...selectedMealPlanForEdit,
          recipeId: newRecipeId
        });

        setToastMessage('Saved to your recipes');
        setToastType('success');
        setToastVisible(true);

        // Reset form
        setNewCollectionName('');
        setShowCreateCollection(false);
        return;
      }

      // --- EXISTING LOGIC FOR OWNED RECIPES ---

      // Support both old cookbook format and new collections array format
      const currentCollections = recipe.collections || (recipe.cookbook ? [recipe.cookbook] : []);
      const updatedCollections = [...currentCollections, trimmedName];

      // Update recipe's collections property via backend
      const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
      await updateRecipeFunction({
        recipeId: recipe.id,
        collections: updatedCollections,
      });

      // Update local state
      updateRecipe(recipe.id, { collections: updatedCollections });

      // Reset form
      setNewCollectionName('');
      setShowCreateCollection(false);
    } catch (error) {
      console.error('Error creating collection:', error);
      setToastMessage('Failed to create collection');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const handlePickDifferentDate = () => {
    if (!selectedMealPlanForEdit) return;
    // Show date picker view in the bottom sheet
    setShowDatePickerInModal(true);
    setEditWeekOffset(0);
  };

  const handleAddSingleRecipeToGroceries = () => {
    if (!selectedMealPlanForEdit) return;

    setShowEditRecipeModal(false);
    navigation.navigate('IngredientSelection', {
      selectedMealPlans: [{
        mealPlanId: selectedMealPlanForEdit.id,
        recipeId: selectedMealPlanForEdit.recipeId,
        recipeTitle: selectedMealPlanForEdit.recipeTitle,
        date: selectedMealPlanForEdit.date,
        mealType: selectedMealPlanForEdit.mealType,
      }]
    });
  };

  const handleDatePickerBack = () => {
    setShowDatePickerInModal(false);
  };

  const handleDatePickerDaySelect = (dayKey: string) => {
    if (!selectedMealPlanForEdit) return;
    // Update the meal plan with the new date
    updateMealPlan(selectedMealPlanForEdit.id, { date: dayKey });
    // Navigate back to main menu
    setShowDatePickerInModal(false);
    setShowEditRecipeModal(false);
    setSelectedMealPlanForEdit(null);
    setEditSelectedDay(null);
    setEditWeekOffset(0);
  };

  const handleDatePickerWeekChange = (delta: number) => {
    const newOffset = editWeekOffset + delta;
    if (newOffset >= 0 && newOffset <= 3) {
      setEditWeekOffset(newOffset);
    }
  };

  const handleViewRecipeNotes = async () => {
    if (!selectedMealPlanForEdit) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    if (!recipe) return;

    // Show notes view in the bottom sheet
    setShowRecipeNotesInModal(true);
    setRecipeNotesLoading(true);

    // Load existing notes from Firestore
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const notesDocRef = doc(db, 'userRecipeNotes', `${currentUser.uid}_${recipe.id}`);
        const notesDoc = await getDoc(notesDocRef);

        if (notesDoc.exists()) {
          setRecipeNotes(notesDoc.data().notes || '');
        } else {
          setRecipeNotes('');
        }
      } else {
        setRecipeNotes('');
      }
    } catch (error) {
      console.error('Error loading recipe notes:', error);
      setRecipeNotes('');
    } finally {
      setRecipeNotesLoading(false);
    }
  };

  const handleRecipeNotesBack = () => {
    setShowRecipeNotesInModal(false);
  };

  const handleSaveRecipeNotes = async () => {
    if (!selectedMealPlanForEdit) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    if (!recipe) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('User not authenticated');
        return;
      }

      // Save notes to Firestore
      const notesDocRef = doc(db, 'userRecipeNotes', `${currentUser.uid}_${recipe.id}`);
      await setDoc(notesDocRef, {
        userId: currentUser.uid,
        recipeId: recipe.id,
        notes: recipeNotes.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Show success toast
      setToastMessage('Notes saved');
      setToastType('success');
      setToastVisible(true);

      // Navigate back to main menu (recipe options)
      setShowRecipeNotesInModal(false);
    } catch (error) {
      console.error('Error saving recipe notes:', error);
      // Show error toast
      setToastMessage('Failed to save notes');
      setToastType('error');
      setToastVisible(true);
    }
  };


  const handleMarkAsCooked = async () => {
    if (!selectedMealPlanForEdit) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    if (!recipe) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('User not authenticated');
        return;
      }

      // Save cooked status to Firestore
      const cookedDocRef = doc(db, 'userCookedRecipes', `${currentUser.uid}_${recipe.id}`);
      await setDoc(cookedDocRef, {
        userId: currentUser.uid,
        recipeId: recipe.id,
        cookedAt: new Date().toISOString(),
      }, { merge: true });

      // Show success toast
      setToastMessage('Recipe marked as cooked');
      setToastType('success');
      setToastVisible(true);

      // Remove from meal plan (marking as cooked)
      removeMealPlan(selectedMealPlanForEdit.id);
      setShowEditRecipeModal(false);
      setSelectedMealPlanForEdit(null);
      setEditSelectedDay(null);
      setEditWeekOffset(0);
    } catch (error) {
      console.error('Error marking recipe as cooked:', error);
      // Show error toast
      setToastMessage('Failed to mark as cooked');
      setToastType('error');
      setToastVisible(true);
    }
  };

  const handleUpdateEditServings = (delta: number) => {
    if (!selectedMealPlanForEdit) return;

    const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
    const currentServings = getDisplayServings(selectedMealPlanForEdit, recipe);
    const newServings = Math.max(1, currentServings + delta);

    updateMealPlan(selectedMealPlanForEdit.id, { servingsOverride: newServings });
    // Update local state
    setSelectedMealPlanForEdit({
      ...selectedMealPlanForEdit,
      servingsOverride: newServings,
    });
  };

  const getEditWeekLabel = (offset: number) => {
    if (offset === 0) {
      return 'THIS WEEK';
    } else if (offset === 1) {
      return 'NEXT WEEK';
    } else if (offset > 1) {
      return `IN ${offset} WEEKS`;
    } else {
      return 'PREVIOUS WEEK';
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
    { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { id: 'lunch', label: 'Lunch', icon: 'sunny' },
    { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { id: 'snack', label: 'Snack', icon: 'gift-outline' },
    { id: 'notes', label: 'Notes', icon: 'document-text-outline', isNotes: true },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Meal Plan</Text>
        {/* Shopping Cart - Top Right */}
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => {
            // Check if there are any meal plans
            const hasAnyPlans = mealPlans.length > 0;
            if (hasAnyPlans) {
              navigation.navigate('ChooseRecipes');
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="basket-outline" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Added Items Notification Banner */}
      {addedItemsCount !== null && (
        <View style={styles.addedItemsBanner}>
          <Text style={styles.addedItemsText}>
            {addedItemsCount} {addedItemsCount === 1 ? 'item' : 'items'} added
          </Text>
          <TouchableOpacity
            onPress={() => {
              navigation.dispatch(
                CommonActions.navigate({
                  name: 'Home',
                  params: {
                    screen: 'Groceries',
                  },
                })
              );
              setAddedItemsCount(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewListText}>View list</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Meal Plan List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#1A1A1A"
            colors={['#1A1A1A']}
          />
        }
      >
        {/* Shelf Section - Recipes without dates */}
        {(() => {
          const shelfPlans = getShelfMealPlans();
          if (shelfPlans.length > 0) {
            return (
              <View style={styles.shelfSection}>
                {shelfPlans.map((plan) => {
                  const recipe = allRecipes.find(r => r.id === plan.recipeId);
                  const servings = getDisplayServings(plan, recipe);
                  const totalTime = (recipe?.prepTime || 0) + (recipe?.cookTime || 0);
                  const rating = (recipe as any)?.rating || '4.0';
                  const displayImage = mealPlanImageUrls[plan.id] || plan.recipeImage;

                  return (
                    <View key={plan.id} style={styles.mealPlanCard}>
                      <View style={styles.mealPlanImageContainer}>
                        {displayImage ? (
                          <Image source={{ uri: displayImage }} style={styles.mealPlanImage} />
                        ) : (
                          <View style={styles.mealPlanImagePlaceholder}>
                            <Ionicons name="image-outline" size={24} color="#999" />
                          </View>
                        )}
                      </View>
                      <View style={styles.mealPlanInfo}>
                        <View style={styles.mealPlanHeader}>
                          <View style={styles.mealPlanTitleContainer}>
                            <Text style={styles.mealPlanTitle} numberOfLines={2}>
                              {plan.recipeTitle}
                            </Text>
                            {totalTime > 0 && (
                              <Text style={styles.mealPlanTime}>{totalTime} mins</Text>
                            )}
                          </View>
                          {/* More Options Button */}
                          <TouchableOpacity
                            style={styles.moreOptionsButton}
                            onPress={() => {
                              setSelectedMealPlanForEdit(plan);
                              setEditSelectedDay(plan.date || null);
                              setEditWeekOffset(weekOffset);
                              setShowEditRecipeModal(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="ellipsis-vertical" size={20} color="#1A1A1A" />
                          </TouchableOpacity>
                        </View>
                        {/* Servings Controls */}
                        <View style={styles.servingsControlContainer}>
                          <TouchableOpacity
                            style={styles.servingsButton}
                            onPress={() => handleUpdateServings(plan.id, -1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="remove" size={16} color="#1A1A1A" />
                          </TouchableOpacity>
                          <Text style={styles.servingsText}>{servings} Servings</Text>
                          <TouchableOpacity
                            style={styles.servingsButton}
                            onPress={() => handleUpdateServings(plan.id, 1)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="add" size={16} color="#1A1A1A" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          }
          return null;
        })()}

        {/* Scheduled Section - Recipes with dates */}
        <View style={styles.scheduledSection}>
          {/* Week Navigation - Moved to scheduled section header */}
          <View style={styles.weekNavigation}>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={handlePreviousWeek}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={styles.weekLabelContainer}>
              <View style={styles.weekLabelRow}>
                <Ionicons name="calendar-outline" size={16} color="#1A1A1A" style={styles.calendarIcon} />
                <Text style={styles.weekLabel}>{getWeekLabel()}</Text>
              </View>
              <View style={styles.dateRangeContainer}>
                <Text style={styles.dateRange}>{formatDate(weekStart)} - {formatDate(weekEnd)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.weekNavButton}
              onPress={handleNextWeek}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Scheduled Meal Plans */}
          {weekDates.map((date, index) => {
            const dayKey = getDayKey(date);
            const dayMealPlans = getMealPlansForDay(date);
            const hasPlans = hasMealPlans(date);

            return (
              <View key={index} style={styles.dayRow}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayNameNumber}>
                    {formatDayFull(date)}
                  </Text>
                  <View style={styles.dayActions}>
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: theme.colors.gastronButton }]}
                      onPress={() => handleAddMeal(dayKey, date)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={theme.colors.black} />
                    </TouchableOpacity>
                    {hasPlans && (
                      <TouchableOpacity
                        ref={(ref) => {
                          overflowButtonRefs.current[dayKey] = ref;
                        }}
                        style={styles.overflowButton}
                        onPress={() => handleOverflowMenu(dayKey)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color="#1A1A1A" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.mealPlansContainer}>
                  {hasPlans ? (
                    dayMealPlans.map((plan) => {
                      const recipe = allRecipes.find(r => r.id === plan.recipeId);
                      const servings = getDisplayServings(plan, recipe);
                      const totalTime = (recipe?.prepTime || 0) + (recipe?.cookTime || 0);
                      const rating = (recipe as any)?.rating || '4.0';
                      const displayImage = mealPlanImageUrls[plan.id] || plan.recipeImage;

                      return (
                        <View key={plan.id} style={styles.mealPlanCard}>
                          <View style={styles.mealPlanImageContainer}>
                            {displayImage ? (
                              <Image source={{ uri: displayImage }} style={styles.mealPlanImage} />
                            ) : (
                              <View style={styles.mealPlanImagePlaceholder}>
                                <Ionicons name="image-outline" size={24} color="#999" />
                              </View>
                            )}
                          </View>
                          <View style={styles.mealPlanInfo}>
                            <View style={styles.mealPlanHeader}>
                              <View style={styles.mealPlanTitleContainer}>
                                <Text style={styles.mealPlanTitle} numberOfLines={2}>
                                  {plan.recipeTitle}
                                </Text>
                                {totalTime > 0 && (
                                  <Text style={styles.mealPlanTime}>{totalTime} mins</Text>
                                )}
                              </View>
                              {/* More Options Button */}
                              <TouchableOpacity
                                style={styles.moreOptionsButton}
                                onPress={() => {
                                  setSelectedMealPlanForEdit(plan);
                                  setEditSelectedDay(plan.date);
                                  setEditWeekOffset(weekOffset);
                                  setShowEditRecipeModal(true);
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="ellipsis-vertical" size={20} color="#1A1A1A" />
                              </TouchableOpacity>
                            </View>
                            {/* Servings Controls */}
                            <View style={styles.servingsControlContainer}>
                              <TouchableOpacity
                                style={styles.servingsButton}
                                onPress={() => handleUpdateServings(plan.id, -1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={16} color="#1A1A1A" />
                              </TouchableOpacity>
                              <Text style={styles.servingsText}>{servings} Servings</Text>
                              <TouchableOpacity
                                style={styles.servingsButton}
                                onPress={() => handleUpdateServings(plan.id, 1)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={16} color="#1A1A1A" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.noRecipesCard}>
                      <Text style={styles.noRecipesText}>No recipes yet</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Overflow Menu Modal */}
      <Modal
        visible={showOverflowMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowOverflowMenu(null);
          setOverflowMenuPosition(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowOverflowMenu(null);
          setOverflowMenuPosition(null);
        }}>
          <View style={styles.overflowMenuOverlay}>
            {showOverflowMenu !== null && (() => {
              const date = weekDates.find(d => getDayKey(d) === showOverflowMenu);
              if (!date) {
                return null;
              }

              return (
                <View style={[
                  styles.overflowMenu,
                  overflowMenuPosition && {
                    position: 'absolute',
                    top: overflowMenuPosition.y,
                    right: overflowMenuPosition.x ? undefined : 24,
                    left: overflowMenuPosition.x || undefined,
                  }
                ]}>
                  <TouchableOpacity
                    style={styles.overflowMenuItem}
                    onPress={() => handleAddToGroceryList(date)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.overflowMenuText}>Add to grocery list</Text>
                    <Ionicons name="bag-outline" size={20} color="#1A1A1A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.overflowMenuItem}
                    onPress={() => handleClearRecipes(date)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.overflowMenuText, styles.clearRecipesText]}>Clear recipes</Text>
                    <Ionicons name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Meal Type Selection Bottom Sheet */}
      <BottomSheet
        visible={showMealTypeModal}
        onClose={() => {
          setShowMealTypeModal(false);
          setSelectedDay(null);
        }}
        height="40%"
      >
        <View style={styles.mealTypeContainer}>
          {mealTypes.map((mealType) => (
            <TouchableOpacity
              key={mealType.id}
              style={styles.mealTypeOption}
              onPress={() => handleMealTypeSelect(mealType.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mealType.icon as any}
                size={24}
                color="#1A1A1A"
                style={{ marginRight: 16 }}
              />
              <Text style={styles.mealTypeLabel}>
                {mealType.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      {/* Recipe Selection Modal */}
      <Modal
        visible={showRecipeSelectionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseRecipeModal}
      >
        <SafeAreaView style={styles.recipeModalContainer}>
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search your recipes"
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCloseRecipeModal}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Recipe List */}
          <ScrollView
            style={styles.recipeModalScrollView}
            contentContainerStyle={styles.recipeModalContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredRecipes.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No recipes found</Text>
              </View>
            ) : (
              filteredRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeModalCard}
                  onPress={() => handleRecipeSelect(recipe)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeModalImageContainer}>
                    {recipe.image ? (
                      <Image source={{ uri: recipe.image }} style={styles.recipeModalImage} />
                    ) : (
                      <View style={styles.recipeModalImagePlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#999" />
                      </View>
                    )}
                  </View>
                  <View style={styles.recipeModalInfo}>
                    <Text style={styles.recipeModalTitle}>{recipe.title}</Text>
                    {recipe.description && (
                      <Text style={styles.recipeModalDescription} numberOfLines={2}>
                        {recipe.description}
                      </Text>
                    )}
                    {(recipe.prepTime || recipe.cookTime) ? (
                      <View style={styles.recipeModalMeta}>
                        {recipe.prepTime ? (
                          <Text style={styles.recipeModalMetaText}>Prep: {recipe.prepTime} min</Text>
                        ) : null}
                        {recipe.prepTime && recipe.cookTime ? (
                          <Text style={styles.recipeModalMetaSeparator}> • </Text>
                        ) : null}
                        {recipe.cookTime ? (
                          <Text style={styles.recipeModalMetaText}>Cook: {recipe.cookTime} min</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Recipe Modal */}
      <BottomSheet
        visible={showEditRecipeModal}
        onClose={() => {
          setShowEditRecipeModal(false);
          setSelectedMealPlanForEdit(null);
          setEditSelectedDay(null);
          setEditWeekOffset(0);
          setShowDatePickerInModal(false);
          setShowCollectionSelection(false);
          setShowRecipeNotesInModal(false);
          setShowCreateCollection(false);
          setNewCollectionName('');
          setRecipeNotes('');
        }}
        height="70%"
      >
        {selectedMealPlanForEdit && (() => {
          const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
          const totalTime = (recipe?.prepTime || 0) + (recipe?.cookTime || 0);
          const editDisplayImage = mealPlanImageUrls[selectedMealPlanForEdit.id] || selectedMealPlanForEdit.recipeImage;
          const recipeCollections = recipe?.collections || [];
          const isSavedToMyRecipes = recipeCollections.includes('Favorites');
          const editWeekDates = getEditWeekDates(editWeekOffset);

          // Show recipe notes view if requested
          if (showRecipeNotesInModal) {
            return (
              <View style={styles.recipeNotesContent}>
                {/* Header with Back Button */}
                <View style={styles.recipeNotesHeader}>
                  <TouchableOpacity
                    style={styles.recipeNotesBackButton}
                    onPress={handleRecipeNotesBack}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                  <View style={styles.recipeNotesHeaderText}>
                    <Text style={styles.recipeNotesTitle}>Your private notes</Text>
                  </View>
                  <View style={styles.recipeNotesBackButton} />
                </View>

                {/* Notes Input */}
                <View style={styles.recipeNotesInputContainer}>
                  {recipeNotesLoading ? (
                    <View style={styles.recipeNotesLoadingContainer}>
                      <Text style={styles.recipeNotesLoadingText}>Loading...</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={styles.recipeNotesInput}
                      placeholder="Add your private notes for this recipe."
                      placeholderTextColor="#999"
                      value={recipeNotes}
                      onChangeText={setRecipeNotes}
                      multiline
                      textAlignVertical="top"
                      autoFocus
                    />
                  )}
                </View>

                {/* Save Button */}
                <View style={styles.recipeNotesFooter}>
                  <TouchableOpacity
                    style={[
                      styles.recipeNotesSaveButton,
                      recipeNotesLoading && styles.recipeNotesSaveButtonDisabled
                    ]}
                    onPress={handleSaveRecipeNotes}
                    disabled={recipeNotesLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.recipeNotesSaveButtonText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          // Show date picker view if requested
          if (showDatePickerInModal) {
            const getDatePickerWeekLabel = () => {
              if (editWeekOffset === 0) {
                return 'THIS WEEK';
              } else if (editWeekOffset === 1) {
                return 'NEXT WEEK';
              } else if (editWeekOffset > 1) {
                return `IN ${editWeekOffset} WEEKS`;
              } else {
                return 'PREVIOUS WEEK';
              }
            };

            return (
              <View style={styles.editRecipeModalContent}>
                {/* Date Picker Header with Back Button */}
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    style={styles.datePickerBackButton}
                    onPress={handleDatePickerBack}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Pick a different date</Text>
                  <View style={styles.datePickerBackButton} />
                </View>

                {/* Week Navigation */}
                <View style={styles.editWeekSection}>
                  <TouchableOpacity
                    style={[styles.editWeekNavButton, editWeekOffset === 0 && styles.editWeekNavButtonDisabled]}
                    onPress={() => handleDatePickerWeekChange(-1)}
                    disabled={editWeekOffset === 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={20} color={editWeekOffset === 0 ? "#999" : "#1A1A1A"} />
                  </TouchableOpacity>
                  <View style={styles.editWeekContent}>
                    <View style={styles.editWeekLabelRow}>
                      <Ionicons name="calendar-outline" size={16} color="#1A1A1A" />
                      <Text style={styles.editWeekLabel}>{getDatePickerWeekLabel()}</Text>
                    </View>
                    <View style={styles.editWeekDateRange}>
                      <Text style={styles.editWeekDateRangeText}>
                        {(() => {
                          const weekStart = editWeekDates[0];
                          const weekEnd = editWeekDates[6];
                          return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
                        })()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.editWeekNavButton, editWeekOffset >= 3 && styles.editWeekNavButtonDisabled]}
                    onPress={() => handleDatePickerWeekChange(1)}
                    disabled={editWeekOffset >= 3}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={20} color={editWeekOffset >= 3 ? "#999" : "#1A1A1A"} />
                  </TouchableOpacity>
                </View>

                {/* Day Selection Buttons */}
                <View style={styles.editDaySelectionContainer}>
                  {editWeekDates.map((date) => {
                    const dayKey = date.toISOString().split('T')[0];
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
                    const dayNumber = date.getDate();
                    const isSelected = editSelectedDay === dayKey || selectedMealPlanForEdit.date === dayKey;

                    return (
                      <View key={dayKey} style={styles.editDayButtonContainer}>
                        <TouchableOpacity
                          style={[
                            styles.editDayButton,
                            isSelected && styles.editDayButtonSelected
                          ]}
                          onPress={() => handleDatePickerDaySelect(dayKey)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.editDayButtonText,
                            isSelected && styles.editDayButtonTextSelected
                          ]}>
                            {dayName}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.editDayNumber}>{dayNumber}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }

          // Main menu view
          return (
            <View style={styles.editRecipeModalContent}>
              {/* Recipe Header */}
              <View style={styles.recipeOptionsHeader}>
                <View style={styles.recipeOptionsImageContainer}>
                  {editDisplayImage ? (
                    <Image
                      source={{ uri: editDisplayImage }}
                      style={styles.recipeOptionsImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.recipeOptionsImagePlaceholder}>
                      <Ionicons name="restaurant-outline" size={24} color="#CCCCCC" />
                    </View>
                  )}
                </View>
                <View style={styles.recipeOptionsHeaderText}>
                  <Text style={styles.recipeOptionsTitle} numberOfLines={2}>
                    {selectedMealPlanForEdit.recipeTitle}
                  </Text>
                  {totalTime > 0 && (
                    <Text style={styles.recipeOptionsTime}>{totalTime} min</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.recipeOptionsCloseButton}
                  onPress={() => {
                    setShowEditRecipeModal(false);
                    setSelectedMealPlanForEdit(null);
                    setEditSelectedDay(null);
                    setEditWeekOffset(0);
                    setShowDatePickerInModal(false);
                    setShowCollectionSelection(false);
                    setShowRecipeNotesInModal(false);
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                    setRecipeNotes('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#1A1A1A" />
                </TouchableOpacity>
              </View>

              {/* Menu Options */}
              <View style={styles.recipeOptionsList}>
                {/* Remove from my planner */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handleDeleteRecipe}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="calendar-outline" size={20} color="#1A1A1A" />
                    <Ionicons name="close-circle" size={12} color="#FF3B30" style={styles.recipeOptionIconOverlay} />
                  </View>
                  <Text style={styles.recipeOptionText}>Remove from my planner</Text>
                </TouchableOpacity>

                {/* Pick a different date */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handlePickDifferentDate}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="calendar-outline" size={20} color="#1A1A1A" />
                  </View>
                  <Text style={styles.recipeOptionText}>Pick a different date</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>

                {/* Mark as cooked */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handleMarkAsCooked}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#1A1A1A" />
                  </View>
                  <Text style={styles.recipeOptionText}>Mark as cooked</Text>
                </TouchableOpacity>

                {/* Saved to My Recipes */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={() => {
                    setShowEditRecipeModal(false);
                    handleToggleSaveToMyRecipes();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons
                      name={isSavedToMyRecipes ? "heart" : "heart-outline"}
                      size={20}
                      color={isSavedToMyRecipes ? "#FF6B35" : "#1A1A1A"}
                    />
                  </View>
                  <Text style={styles.recipeOptionText}>Saved to My Recipes</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>

                {/* Add to groceries */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handleAddSingleRecipeToGroceries}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="cart-outline" size={20} color="#1A1A1A" />
                  </View>
                  <Text style={styles.recipeOptionText}>Add to groceries</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>

                {/* Your recipe notes */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handleViewRecipeNotes}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="document-text-outline" size={20} color="#1A1A1A" />
                  </View>
                  <Text style={styles.recipeOptionText}>Your recipe notes</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>

                {/* Share recipe */}
                <TouchableOpacity
                  style={styles.recipeOptionItem}
                  onPress={handleShareRecipe}
                  activeOpacity={0.7}
                >
                  <View style={styles.recipeOptionIconContainer}>
                    <Ionicons name="share-outline" size={20} color="#1A1A1A" />
                  </View>
                  <Text style={styles.recipeOptionText}>Share recipe</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
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
        <ScrollView
          style={styles.collectionsScrollView}
          contentContainerStyle={styles.collectionsContent}
          showsVerticalScrollIndicator={false}
        >
          {!showCreateCollection ? (
            <>
              {/* Header with Back Button */}
              <View style={styles.collectionSelectionHeader}>
                <TouchableOpacity
                  style={styles.collectionSelectionBackButton}
                  onPress={() => {
                    setShowCollectionSelection(false);
                    setShowEditRecipeModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.collectionSelectionHeaderText}>
                  <Text style={styles.collectionSelectionTitle}>Select Collections</Text>
                  <Text style={styles.collectionSelectionSubtitle}>A recipe can be in multiple collections</Text>
                </View>
                <View style={styles.collectionSelectionBackButton} />
              </View>

              {/* Collection Options */}
              {collections.map((collection, index) => {
                if (!selectedMealPlanForEdit) return null;
                const recipe = allRecipes.find(r => r.id === selectedMealPlanForEdit.recipeId);
                if (!recipe) return null;

                // Support both old cookbook format and new collections array format
                const currentCollections = recipe.collections || (recipe.cookbook ? [recipe.cookbook] : []);
                const isSelected = Array.isArray(currentCollections) && currentCollections.includes(collection);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.collectionOption,
                      isSelected && styles.collectionOptionSelected
                    ]}
                    onPress={() => handleToggleCollection(collection)}
                    activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
                <Text style={styles.createCollectionButtonText}>Create new cookbook</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Create Collection Header with Back Button */}
              <View style={styles.collectionCreateHeader}>
                <TouchableOpacity
                  style={styles.collectionCreateBackButton}
                  onPress={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.collectionCreateTitle}>Create Collection</Text>
                <View style={styles.collectionCreateBackButton} />
              </View>

              {/* Collection Name Input */}
              <TextInput
                style={styles.collectionInput}
                placeholder="Collection name"
                placeholderTextColor="#999"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />

              {/* Create Button */}
              <TouchableOpacity
                style={[
                  styles.collectionCreateSubmitButton,
                  !newCollectionName.trim() && styles.collectionCreateSubmitButtonDisabled
                ]}
                onPress={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.collectionCreateSubmitButtonText,
                  !newCollectionName.trim() && styles.collectionCreateSubmitButtonTextDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </BottomSheet>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerIconButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
    gap: 8,
    marginBottom: 16,
  },
  weekNavButton: {
    padding: 4,
  },
  weekLabelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  calendarIcon: {
    marginRight: 0,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  dateRange: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  shelfSection: {
    marginBottom: 32,
  },
  scheduledSection: {
    marginTop: 0,
  },
  dayRow: {
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayNameNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  mealPlansContainer: {
    marginTop: 8,
  },
  mealPlanCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  mealPlanImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E0E0DA',
    marginRight: 12,
  },
  mealPlanImage: {
    width: '100%',
    height: '100%',
  },
  mealPlanImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPlanInfo: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 80,
  },
  mealPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mealPlanTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  mealPlanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    lineHeight: 20,
  },
  mealPlanTime: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  moreOptionsButton: {
    padding: 4,
    marginTop: -4,
  },
  mealPlanHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  includeToggle: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  mealPlanDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealPlanMealType: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  mealPlanDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealPlanDetailText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  mealPlanDetailSeparator: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  mealPlanType: {
    fontSize: 14,
    fontWeight: '400',
  },
  mealPlanMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  servingsControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    minWidth: 80,
    textAlign: 'center',
  },
  noRecipesCard: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  noRecipesText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  overflowButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overflowMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignSelf: 'flex-end',
    marginRight: 24,
  },
  overflowMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  overflowMenuText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  clearRecipesText: {
    color: '#FF3B30',
  },
  mealTypeContainer: {
    // Container for meal type options
  },
  mealTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  mealTypeLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  recipeModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  cancelButton: {
    paddingVertical: 8,
    marginLeft: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  recipeModalScrollView: {
    flex: 1,
  },
  recipeModalContent: {
    padding: 16,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999',
  },
  recipeModalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  recipeModalImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E0E0DA',
    marginRight: 12,
  },
  recipeModalImage: {
    width: '100%',
    height: '100%',
  },
  recipeModalImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeModalInfo: {
    flex: 1,
    marginRight: 12,
  },
  recipeModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recipeModalDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginBottom: 4,
  },
  recipeModalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeModalMetaText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
  },
  recipeModalMetaSeparator: {
    fontSize: 12,
    color: '#999',
  },
  addedItemsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: 8,
  },
  addedItemsText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  viewListText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  recipeOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    paddingTop: 8,
  },
  recipeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recipeOptionIconContainer: {
    position: 'relative',
    width: 20,
    height: 20,
    marginRight: 16,
  },
  recipeOptionIconOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  recipeOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  datePickerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  collectionsScrollView: {
    flex: 1,
  },
  collectionsContent: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  collectionSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  collectionSelectionBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  collectionSelectionHeaderText: {
    flex: 1,
    alignItems: 'center',
  },
  collectionSelectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  collectionSelectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
    textAlign: 'center',
  },
  collectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  collectionOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  collectionCheckbox: {
    marginRight: 12,
    width: 24,
    height: 24,
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
    paddingVertical: 16,
    paddingHorizontal: 0,
    marginTop: 8,
  },
  createCollectionButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '500',
    marginLeft: 8,
  },
  collectionCreateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  collectionCreateBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  collectionCreateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  collectionInput: {
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
  collectionCreateSubmitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionCreateSubmitButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  collectionCreateSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  collectionCreateSubmitButtonTextDisabled: {
    color: '#999999',
  },
  recipeNotesContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  recipeNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  recipeNotesBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  recipeNotesHeaderText: {
    flex: 1,
    alignItems: 'center',
  },
  recipeNotesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  recipeNotesInputContainer: {
    flex: 1,
    marginTop: 16,
  },
  recipeNotesLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeNotesLoadingText: {
    fontSize: 16,
    color: '#666',
  },
  recipeNotesInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  recipeNotesFooter: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 16,
  },
  recipeNotesSaveButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeNotesSaveButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  recipeNotesSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  editRecipeModalContent: {
    flex: 1,
  },
  editRecipeModalContentContainer: {
    paddingHorizontal: 0,
    paddingVertical: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  editRecipeCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 235, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editRecipeTitleContainer: {
    marginBottom: 20,
  },
  editRecipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    // backgroundColor: 'rgba(255, 235, 59, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editRecipeImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  editRecipeImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  editRecipeImagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRecipeQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  editWeekSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  editWeekNavButton: {
    padding: 8,
  },
  editWeekNavButtonDisabled: {
    opacity: 0.3,
  },
  editWeekContent: {
    flex: 1,
    alignItems: 'center',
  },
  editWeekLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editWeekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  editWeekDateRange: {
    marginTop: 4,
    alignItems: 'center',
  },
  editWeekDateRangeText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  editWeekText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  editDaySelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
    flexWrap: 'nowrap',
  },
  editDayButtonContainer: {
    alignItems: 'center',
    gap: 4,
  },
  editDayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editDayButtonSelected: {
    backgroundColor: '#CEEC2C',
    borderColor: '#CEEC2C',
  },
  editDayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  editDayButtonTextSelected: {
    color: '#1A1A1A',
  },
  editDayNumber: {
    fontSize: 11,
    fontWeight: '400',
    color: '#999',
  },
  editRecipeActions: {
    marginBottom: 24,
    gap: 0,

  },
  editRecipeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    width: '100%',
  },
  editRecipeActionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  editRecipeActionTextDanger: {
    color: '#FF3B30',
  },
  editRecipeActionTextSuccess: {
    color: '#66BB6A',
  },
  editPortionSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -10,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  editPortionSizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editPortionSizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  editPortionSizeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 44,
  },
  editPortionSizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPortionSizeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    minWidth: 70,
    textAlign: 'center',
  },
  editRecipeSaveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRecipeSaveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  editRecipeSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});

export default MealPlanScreen;
