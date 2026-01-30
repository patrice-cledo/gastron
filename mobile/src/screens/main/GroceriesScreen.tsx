import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Alert,
  Share,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RootStackParamList } from '../../types/navigation';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { GroceryItem } from '../../types/grocery';
import { SpriteSheetIcon } from '../../components/SpriteSheetIcon';
import { getIngredientSpriteCode } from '../../utils/ingredientMapping';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

type GroceriesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GroceriesScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<GroceriesScreenNavigationProp>();
  const {
    items,
    recipes,
    scopeStartDate,
    scopeEndDate,
    setScope,
    toggleItem,
    removeItem,
    removeRecipe,
    clearCheckedItems,
    clearAllItems,
    addManualItem,
    updateItem,
    updateItemNotes,
    updateItemCategory,
    toggleItemPinned,
    mergeItems,
  } = useGroceriesStore();
  
  const { mealPlans } = useMealPlanStore();

  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [sortBy, setSortBy] = useState<'recipe' | 'aisle' | 'a-z' | 'recent'>('aisle');
  const [dateRange, setDateRange] = useState<'this-week' | 'custom'>('this-week');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [mergeSuggestions, setMergeSuggestions] = useState<Array<{ items: GroceryItem[]; suggestedName: string; totalAmount: string }>>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{ items: GroceryItem[]; suggestedName: string; totalAmount: string; unit?: string } | null>(null);
  
  // New state for simplified shopping list
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [recipesCollapsed, setRecipesCollapsed] = useState(false);
  const [selectAllShoppingList, setSelectAllShoppingList] = useState(false);
  const [recipeImageUrls, setRecipeImageUrls] = useState<{ [recipeId: string]: string }>({});

  // Helper to check if a string is a storage path (not a URL)
  const isStoragePath = (image: string): boolean => {
    return typeof image === 'string' && 
           !image.startsWith('http://') && 
           !image.startsWith('https://') &&
           !image.startsWith('file://') &&
           !image.startsWith('content://') &&
           image.includes('/');
  };

  // Convert storage path to download URL for recipe images
  const getRecipeImageUrl = async (recipeId: string, image: string | undefined): Promise<string | null> => {
    if (!image) return null;

    // If already cached, return it
    if (recipeImageUrls[recipeId]) {
      return recipeImageUrls[recipeId];
    }

    // If not a string, return null
    if (typeof image !== 'string') {
      return null;
    }

    // If it's already a URL, cache and return it
    if (image.startsWith('http://') || image.startsWith('https://')) {
      setRecipeImageUrls(prev => ({ ...prev, [recipeId]: image }));
      return image;
    }

    // If it's a storage path, convert to download URL
    if (isStoragePath(image)) {
      try {
        const storageRef = ref(storage, image);
        const downloadURL = await getDownloadURL(storageRef);
        setRecipeImageUrls(prev => ({ ...prev, [recipeId]: downloadURL }));
        return downloadURL;
      } catch (error) {
        console.error('Error getting download URL for recipe', recipeId, ':', error);
        return null;
      }
    }

    return null;
  };

  // Load recipe image URLs when recipes change
  useEffect(() => {
    const loadRecipeImageUrls = async () => {
      const urlPromises = recipes.map(async (recipe) => {
        if (recipe.image) {
          const url = await getRecipeImageUrl(recipe.id, recipe.image);
          return { recipeId: recipe.id, url };
        }
        return { recipeId: recipe.id, url: null };
      });

      await Promise.all(urlPromises);
    };

    if (recipes.length > 0) {
      loadRecipeImageUrls();
    }
  }, [recipes]);

  // Auto-select recipes when new items are added from meal plans
  // This ensures items are visible immediately after being added
  useEffect(() => {
    if (recipes.length > 0 && items.length > 0) {
      // Find recipes that have items but aren't selected
      const recipesWithItems = new Set<string>();
      items.forEach(item => {
        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(source => {
            if (source.recipeId) {
              recipesWithItems.add(source.recipeId);
            }
          });
        } else if (item.recipeId) {
          recipesWithItems.add(item.recipeId);
        }
      });

      console.log('🔍 Auto-select check:', {
        recipesCount: recipes.length,
        itemsCount: items.length,
        recipesWithItems: Array.from(recipesWithItems),
        selectedRecipeIds: Array.from(selectedRecipeIds),
      });

      // If there are recipes with items that aren't selected, and no recipes are currently selected,
      // auto-select all recipes to show all items
      if (recipesWithItems.size > 0 && selectedRecipeIds.size === 0) {
        const allRecipeIds = new Set(recipes.map(r => r.id));
        // Only auto-select if all recipes with items are in the recipes list
        const allItemsRecipesAreInList = Array.from(recipesWithItems).every(id => allRecipeIds.has(id));
        if (allItemsRecipesAreInList) {
          console.log('🔍 Auto-selecting all recipes:', Array.from(allRecipeIds));
          setSelectedRecipeIds(new Set(recipes.map(r => r.id)));
        }
      }
    }
  }, [recipes, items, selectedRecipeIds.size]);

  // Bottom sheet refs
  const addItemBottomSheetRef = useRef<BottomSheet>(null);
  const dateRangeBottomSheetRef = useRef<BottomSheet>(null);
  const customDatePickerBottomSheetRef = useRef<BottomSheet>(null);
  const sortMenuBottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '75%'], []);
  const dateRangeSnapPoints = useMemo(() => ['40%'], []);
  const datePickerSnapPoints = useMemo(() => ['60%'], []);
  const sortMenuSnapPoints = useMemo(() => ['35%'], []);

  // Backdrop component for bottom sheets
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const [showAddModal, setShowAddModal] = useState(false);

  // Helper to check if a date is within scope
  const isDateInScope = (date: string): boolean => {
    if (!scopeStartDate || !scopeEndDate) return true; // No scope = show all
    return date >= scopeStartDate && date <= scopeEndDate;
  };

  // Filter items based on scope and selected recipes
  // Included: items from meal plans within scope OR pinned/manual items OR items without meal plan sources
  const scopedItems = useMemo(() => {
    console.log('🔍 Filtering items:', {
      totalItems: items.length,
      scopeStartDate,
      scopeEndDate,
      mealPlansCount: mealPlans.length,
      selectedRecipeIdsCount: selectedRecipeIds.size,
      recipesCount: recipes.length,
    });
    
    let filtered = items;
    
    // Filter by scope (date range)
    if (scopeStartDate && scopeEndDate) {
      // Get meal plan IDs within scope that have includeInGrocery = true
      const mealPlanIdsInScope = new Set(
        mealPlans
          .filter((plan) => isDateInScope(plan.date) && plan.includeInGrocery)
          .map((plan) => plan.id)
      );
      
      // Get meal plan IDs OUTSIDE scope (to exclude items from those)
      const mealPlanIdsOutsideScope = new Set(
        mealPlans
          .filter((plan) => !isDateInScope(plan.date) || !plan.includeInGrocery)
          .map((plan) => plan.id)
      );
      
      // If meal plans exist, filter by scope
      if (mealPlans.length > 0) {
        filtered = filtered.filter((item) => {
          // Always include pinned/manual items
          if (item.pinned) return true;
          
          // If item has no sources and no recipeId, include it (manual item)
          if ((!item.sources || item.sources.length === 0) && !item.recipeId) {
            return true;
          }
          
          // Check if item has sources with mealPlanEntryId
          if (item.sources && item.sources.length > 0) {
            // Check if any source's mealPlanEntryId should be excluded
            // Only exclude if the meal plan explicitly has includeInGrocery: false
            const shouldExclude = item.sources.some((source) => {
              if (!source.mealPlanEntryId) return false;
              const mealPlan = mealPlans.find(p => p.id === source.mealPlanEntryId);
              // Only exclude if meal plan exists AND has includeInGrocery: false
              if (mealPlan && !mealPlan.includeInGrocery) {
                console.log('🔍 Item excluded (includeInGrocery: false):', item.name, 'mealPlanId:', source.mealPlanEntryId);
                return true;
              }
              return false;
            });
            if (shouldExclude) {
              return false;
            }
            
            // If mealPlanEntryId is in scope, include it
            const hasMealPlanInScope = item.sources.some((source) => 
              source.mealPlanEntryId && mealPlanIdsInScope.has(source.mealPlanEntryId)
            );
            if (hasMealPlanInScope) {
              console.log('🔍 Item included (meal plan in scope):', item.name);
              return true;
            }
            
            // IMPORTANT: Include items even if meal plan date is outside scope
            // The date scope filter should only hide items if includeInGrocery is false
            // Users should see all their grocery items regardless of date scope
            // The scope is mainly for organizing, not for strict filtering
            console.log('🔍 Item included (meal plan outside scope but includeInGrocery: true):', item.name);
            return true;
          }
          
          // Items with recipeId but no sources - include if recipe is in scope
          // or if we can't determine scope (backward compatibility)
          if (item.recipeId && (!item.sources || item.sources.length === 0)) {
            // Check if any meal plan with this recipeId is in scope
            const recipeMealPlansInScope = mealPlans.filter(
              (plan) => plan.recipeId === item.recipeId && 
                       isDateInScope(plan.date) && 
                       plan.includeInGrocery
            );
            if (recipeMealPlansInScope.length > 0) {
              return true;
            }
            // If no meal plans found, include it (backward compatibility)
            return true;
          }
          
          return true;
        });
      }
    }
    
    // Filter by selected recipes if any are selected
    // If no recipes are selected, show all items (user hasn't filtered yet)
    if (selectedRecipeIds.size > 0) {
      const beforeRecipeFilter = filtered.length;
      filtered = filtered.filter((item) => {
        // Always include pinned/manual items
        if (item.pinned) return true;
        
        // If item has no sources and no recipeId, include it (manual item)
        if ((!item.sources || item.sources.length === 0) && !item.recipeId) {
          return true;
        }
        
        // Check if item belongs to any selected recipe
        if (item.sources && item.sources.length > 0) {
          const matches = item.sources.some((source) => selectedRecipeIds.has(source.recipeId));
          if (!matches) {
            console.log('🔍 Item filtered out by recipe selection:', item.name, 'sources:', item.sources.map(s => s.recipeId));
          }
          return matches;
        }
        
        // If item has recipeId directly
        if (item.recipeId && selectedRecipeIds.has(item.recipeId)) {
          return true;
        }
        
        console.log('🔍 Item filtered out (no recipe match):', item.name, 'recipeId:', item.recipeId);
        return false;
      });
      console.log('🔍 Recipe filter:', beforeRecipeFilter, '->', filtered.length);
    } else {
      console.log('🔍 No recipe filter applied (no recipes selected)');
    }
    
    console.log('🔍 Filtered items count:', filtered.length, 'from', items.length);
    return filtered;
  }, [items, scopeStartDate, scopeEndDate, mealPlans, selectedRecipeIds]);

  // Separate checked and unchecked items
  const uncheckedItems = useMemo(() => {
    return scopedItems.filter((item) => !item.checked);
  }, [scopedItems]);

  const checkedItems = useMemo(() => {
    return scopedItems.filter((item) => item.checked);
  }, [scopedItems]);

  // Sort and group items based on sortBy
  const groupedItems = useMemo(() => {
    let sortedItems = [...uncheckedItems];

    // Separate manual items from recipe items
    const manualItems = sortedItems.filter((item) => {
      return item.pinned && (!item.sources || item.sources.length === 0) && !item.recipeId;
    });
    const recipeItems = sortedItems.filter((item) => {
      return !(item.pinned && (!item.sources || item.sources.length === 0) && !item.recipeId);
    });

    // Sort recipe items based on selected option
    if (sortBy === 'a-z') {
      recipeItems.sort((a, b) => a.name.localeCompare(b.name));
      manualItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recipe') {
      recipeItems.sort((a, b) => {
        // First by recipe title, then by name
        const recipeCompare = (a.recipeTitle || '').localeCompare(b.recipeTitle || '');
        if (recipeCompare !== 0) return recipeCompare;
        return a.name.localeCompare(b.name);
      });
      manualItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'aisle') {
      // Aisle sorting is same as category for now
      recipeItems.sort((a, b) => {
        const categoryCompare = (a.category || '').localeCompare(b.category || '');
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });
      manualItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      // Sort by createdAt for recent
      recipeItems.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Most recent first
      });
      manualItems.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Most recent first
      });
    }

    // Group items
    if (sortBy === 'recipe') {
      // Group by recipe
      const groups: Record<string, GroceryItem[]> = {};
      if (manualItems.length > 0) {
        groups['Custom items'] = manualItems;
      }
      recipeItems.forEach((item) => {
        const groupKey = item.recipeTitle || 'Other';
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
      });
      return groups;
    } else if (sortBy === 'a-z' || sortBy === 'recent') {
      // Single group for A-Z and Recently added, but separate Custom items
      const groups: Record<string, GroceryItem[]> = {};
      if (manualItems.length > 0) {
        groups['Custom items'] = manualItems;
      }
      if (recipeItems.length > 0) {
        groups['All Items'] = recipeItems;
      }
      return groups;
    } else {
      // Group by category/aisle (use categoryOverride if available)
      const groups: Record<string, GroceryItem[]> = {};
      if (manualItems.length > 0) {
        groups['Custom items'] = manualItems;
      }
      recipeItems.forEach((item) => {
        const category = item.categoryOverride || item.category || 'OTHER';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(item);
      });
      return groups;
    }
  }, [uncheckedItems, sortBy]);

  const handleAddManual = () => {
    if (manualInput.trim()) {
      // Parse input - could be "ingredient" or "amount unit ingredient"
      const parts = manualInput.trim().split(/\s+/);
      if (parts.length >= 3) {
        // Assume format: amount unit ingredient
        const amount = parts[0];
        const unit = parts[1];
        const name = parts.slice(2).join(' ');
        addManualItem(name, amount, unit);
      } else {
        // Just ingredient name
        addManualItem(manualInput.trim());
      }
      setManualInput('');
      addItemBottomSheetRef.current?.close();
    }
  };

  const handleOpenAddModal = () => {
    navigation.navigate('AddShoppingItem');
  };

  // Helper to normalize ingredient names for merge detection
  const normalizeIngredientName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Helper to detect potential duplicates/merges
  const detectMergeSuggestions = () => {
    const suggestions: Array<{ items: GroceryItem[]; suggestedName: string; totalAmount: string; unit?: string }> = [];
    const nameMap = new Map<string, GroceryItem[]>();
    
    // Group items by normalized name
    uncheckedItems.forEach((item) => {
      const normalized = normalizeIngredientName(item.name);
      if (!nameMap.has(normalized)) {
        nameMap.set(normalized, []);
      }
      nameMap.get(normalized)!.push(item);
    });
    
    // Find groups with multiple items (potential duplicates)
    nameMap.forEach((groupItems, normalizedName) => {
      if (groupItems.length > 1) {
        // Check if they're similar enough (same normalized name)
        const firstItem = groupItems[0];
        const totalAmount = groupItems.reduce((sum, item) => {
          const amount = parseFloat(item.amount) || 0;
          return sum + amount;
        }, 0).toString();
        
        suggestions.push({
          items: groupItems,
          suggestedName: firstItem.name, // Use first item's name as base
          totalAmount: totalAmount,
          unit: firstItem.unit,
        });
      }
    });
    
    return suggestions;
  };

  // Initialize scope to current week on mount
  useEffect(() => {
    if (!scopeStartDate || !scopeEndDate) {
      const weekDates = getCurrentWeekDates();
      setScope(weekDates.start, weekDates.end);
      setDateRange('this-week');
    }
  }, []);

  // Check for merge suggestions on mount and when items change
  useEffect(() => {
    const suggestions = detectMergeSuggestions();
    setMergeSuggestions(suggestions);
  }, [items]);

  const handleItemLongPress = (item: GroceryItem) => {
    setSelectedItem(item);
    setShowItemDetails(true);
  };

  const handleMergeSuggestion = (suggestion: { items: GroceryItem[]; suggestedName: string; totalAmount: string; unit?: string }) => {
    setPendingMerge(suggestion);
    setShowMergeModal(true);
  };

  const handleConfirmMerge = () => {
    if (pendingMerge) {
      mergeItems(
        pendingMerge.items.map((item) => item.id),
        pendingMerge.suggestedName,
        pendingMerge.totalAmount,
        pendingMerge.unit
      );
      setPendingMerge(null);
      setShowMergeModal(false);
      // Remove from suggestions
      setMergeSuggestions((prev) =>
        prev.filter((s) => s !== pendingMerge)
      );
    }
  };

  const handleDismissMerge = () => {
    setPendingMerge(null);
    setShowMergeModal(false);
  };

  // Helper to format date range display
  const formatDateRange = (start: string, end: string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', { weekday: 'short', ...options })} – ${endDate.toLocaleDateString('en-US', { weekday: 'short', ...options })}`;
  };

  // Helper to get current week dates
  const getCurrentWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const handleSetThisWeek = () => {
    const weekDates = getCurrentWeekDates();
    setScope(weekDates.start, weekDates.end);
    setDateRange('this-week');
    dateRangeBottomSheetRef.current?.close();
  };

  const handleSetCustomRange = () => {
    dateRangeBottomSheetRef.current?.close();
    setTimeout(() => {
      customDatePickerBottomSheetRef.current?.expand();
    }, 300);
  };

  const handleConfirmCustomRange = () => {
    if (customStartDate && customEndDate) {
      const start = customStartDate.toISOString().split('T')[0];
      const end = customEndDate.toISOString().split('T')[0];
      setScope(start, end);
      setDateRange('custom');
      customDatePickerBottomSheetRef.current?.close();
      setCustomStartDate(null);
      setCustomEndDate(null);
    }
  };

  const handleShare = async () => {
    try {
      const itemList = uncheckedItems
        .map((item) => {
          const quantity = item.unit
            ? `${item.amount} ${item.unit} ${item.name}`
            : `${item.amount} ${item.name}`;
          return `- ${quantity}`;
        })
        .join('\n');

      const message = `Grocery List\n\n${itemList}`;

      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const itemList = uncheckedItems
        .map((item) => {
          const quantity = item.unit
            ? `${item.amount} ${item.unit} ${item.name}`
            : `${item.amount} ${item.name}`;
          return `- ${quantity}`;
        })
        .join('\n');

      const message = `Grocery List\n\n${itemList}`;

      await Clipboard.setStringAsync(message);
      Alert.alert('Copied', 'Shopping list copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Clear All Items',
      'Are you sure you want to clear all items from your grocery list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearAllItems();
          },
        },
      ]
    );
  };

  const handleToggleRecipeSelection = (recipeId: string) => {
    setSelectedRecipeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const handleSelectAllRecipes = () => {
    if (selectedRecipeIds.size === recipes.length) {
      // Deselect all
      setSelectedRecipeIds(new Set());
    } else {
      // Select all
      setSelectedRecipeIds(new Set(recipes.map((r) => r.id)));
    }
  };

  const handleSelectAllShoppingList = () => {
    const newSelectAll = !selectAllShoppingList;
    setSelectAllShoppingList(newSelectAll);
    
    if (newSelectAll) {
      // Mark all unchecked items as checked
      uncheckedItems.forEach((item) => {
        if (!item.checked) {
          toggleItem(item.id);
        }
      });
    } else {
      // Uncheck all checked items
      checkedItems.forEach((item) => {
        if (item.checked) {
          toggleItem(item.id);
        }
      });
    }
  };

  // Update selectAllShoppingList state when items change
  useEffect(() => {
    if (uncheckedItems.length === 0 && checkedItems.length > 0) {
      setSelectAllShoppingList(true);
    } else if (uncheckedItems.length > 0) {
      setSelectAllShoppingList(false);
    }
  }, [uncheckedItems.length, checkedItems.length]);


  const handleClearChecked = () => {
    clearCheckedItems();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => sortMenuBottomSheetRef.current?.expand()}
        >
          <Ionicons name="swap-vertical" size={14} color="#666" />
          <Text style={styles.sortButtonText}>
            sort by: {sortBy === 'aisle' ? 'Aisle' : sortBy === 'a-z' ? 'A to Z' : sortBy === 'recent' ? 'Recent' : 'Recipe'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => dateRangeBottomSheetRef.current?.expand()}
          >
            <View style={[styles.headerButtonCircle, styles.headerButtonCircleWhite, styles.headerButtonCircleSmall]}>
              <Ionicons name="filter" size={16} color="#1A1A1A" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <View style={[styles.headerButtonCircle, styles.headerButtonCircleWhite, styles.headerButtonCircleSmall]}>
              <Ionicons name="share-outline" size={16} color="#1A1A1A" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleCopyToClipboard}>
            <View style={[styles.headerButtonCircle, styles.headerButtonCircleWhite, styles.headerButtonCircleSmall]}>
              <Ionicons name="copy-outline" size={16} color="#1A1A1A" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteAll}
          >
            <View style={[styles.headerButtonCircle, styles.headerButtonCircleWhite, styles.headerButtonCircleSmall]}>
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Merge Suggestions Banner */}
        {mergeSuggestions.length > 0 && (
          <View style={styles.mergeSuggestionsBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#FF6B35" />
            <Text style={styles.mergeSuggestionsText}>
              {mergeSuggestions.length} potential duplicate{mergeSuggestions.length > 1 ? 's' : ''} found
            </Text>
            <TouchableOpacity
              onPress={() => {
                // Show first suggestion
                if (mergeSuggestions.length > 0) {
                  handleMergeSuggestion(mergeSuggestions[0]);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.mergeSuggestionsLink}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recipes Section */}
        {recipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recipes ({recipes.length})</Text>
              <View style={styles.recipesHeaderActions}>
                {recipes.length > 0 && (
                  <TouchableOpacity
                    style={styles.recipeSelectAllButton}
                    onPress={handleSelectAllRecipes}
                  >
                    <View style={styles.recipeCheckbox}>
                      {selectedRecipeIds.size === recipes.length && (
                        <View style={styles.recipeCheckboxChecked}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                <View style={styles.recipesHeaderSpacer} />
                <TouchableOpacity
                  onPress={() => setRecipesCollapsed(!recipesCollapsed)}
                >
                  <Ionicons 
                    name={recipesCollapsed ? "chevron-down" : "chevron-up"} 
                    size={16} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            {!recipesCollapsed && recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCardSmall}
                onPress={() => handleToggleRecipeSelection(recipe.id)}
              >
                <View style={styles.recipeCheckbox}>
                  {selectedRecipeIds.has(recipe.id) && (
                    <View style={styles.recipeCheckboxChecked}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.recipeImageContainerSmall}>
                  {recipeImageUrls[recipe.id] || (recipe.image && typeof recipe.image === 'string' && (recipe.image.startsWith('http://') || recipe.image.startsWith('https://'))) ? (
                    <Image 
                      source={{ uri: recipeImageUrls[recipe.id] || recipe.image as string }} 
                      style={styles.recipeImageSmall} 
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.recipeImageSmall, styles.recipeImagePlaceholderSmall]}>
                      <Ionicons name="restaurant" size={16} color="#999" />
                    </View>
                  )}
                </View>
                <View style={styles.recipeInfoSmall}>
                  <Text style={styles.recipeTitleSmall} numberOfLines={1}>
                    {recipe.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Shopping List Section */}
        <View style={styles.section}>
          <View style={styles.shoppingListHeader}>
            <View style={styles.shoppingListTitleContainer}>
              <Text style={styles.sectionTitle}>
                Your shopping list{scopedItems.length > 0 ? ` (${uncheckedItems.length})` : ''}
              </Text>
            </View>
            {scopedItems.length > 0 && (
              <TouchableOpacity
                style={styles.selectAllShoppingListButton}
                onPress={handleSelectAllShoppingList}
              >
                <View style={styles.recipeCheckbox}>
                  {selectAllShoppingList && (
                    <View style={styles.recipeCheckboxChecked}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Grocery Items by Category */}
          {Object.entries(groupedItems)
            .sort(([categoryA], [categoryB]) => {
              // Always put "Custom items" first
              if (categoryA === 'Custom items') return -1;
              if (categoryB === 'Custom items') return 1;
              return 0;
            })
            .map(([category, categoryItems], index) => {
            const isCustomItems = category === 'Custom items';
            const isFirstCategory = index === 0;
            return (
            <View key={category} style={[styles.categoryGroup, isFirstCategory && styles.categoryGroupFirst]}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {isCustomItems && (
                <TouchableOpacity
                  style={styles.addCustomItemButton}
                  onPress={handleOpenAddModal}
                >
                  <View style={styles.addCustomItemButtonCircle}>
                    <Ionicons name="add" size={16} color="#1A1A1A" />
                  </View>
                  <Text style={styles.addCustomItemButtonText}>Add item</Text>
                </TouchableOpacity>
              )}
              {categoryItems.map((item) => {
                const spriteCode = getIngredientSpriteCode(item.name);
                const displayCategory = item.categoryOverride || item.category || 'OTHER';
                const hasSources = item.sources && item.sources.length > 0;
                const isManualItem = item.pinned && (!item.sources || item.sources.length === 0) && !item.recipeId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.groceryItem}
                    onPress={() => toggleItem(item.id)}
                    onLongPress={() => handleItemLongPress(item)}
                    activeOpacity={0.7}
                  >
                    <SpriteSheetIcon spriteCode={spriteCode} size={32} />
                    <View style={styles.groceryItemContent}>
                      <View style={styles.groceryItemHeader}>
                        <Text style={styles.groceryItemName}>{item.name}</Text>
                        {item.pinned && (
                          <View style={styles.pinnedTag}>
                            <Ionicons name="pin" size={12} color="#FF6B35" />
                            <Text style={styles.pinnedText}>Manual</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.groceryItemMeta}>
                        <Text style={styles.groceryItemQuantity}>
                          {item.unit ? `${item.amount} ${item.unit}` : item.amount}
                        </Text>
                        {item.notes && (
                          <Text style={styles.groceryItemNotes}> • {item.notes}</Text>
                        )}
                        {hasSources && (
                          <TouchableOpacity
                            style={styles.sourcesButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleItemLongPress(item);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="information-circle-outline" size={14} color="#666" />
                            <Text style={styles.sourcesText}>{item.sources!.length} recipe{item.sources!.length > 1 ? 's' : ''}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.groceryItemActions}>
                      {isManualItem && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              'Delete item',
                              `Remove "${item.name}" from your shopping list?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => removeItem(item.id),
                                },
                              ]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                      )}
                      <View style={styles.checkbox}>
                        {item.checked && (
                          <View style={styles.checkboxChecked}>
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
          })}
        </View>

        {/* Checked Items Section */}
        {checkedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.checkedHeader}>
              <Text style={styles.categoryTitle}>Checked items</Text>
              <TouchableOpacity onPress={handleClearChecked}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            </View>
            {checkedItems.map((item) => {
              const spriteCode = getIngredientSpriteCode(item.name);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.groceryItem, styles.checkedItem]}
                  onPress={() => toggleItem(item.id)}
                >
                  <SpriteSheetIcon spriteCode={spriteCode} size={32} checked />
                  <View style={styles.groceryItemContent}>
                    <Text style={[styles.groceryItemName, styles.checkedItemText]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.groceryItemQuantity, styles.checkedItemText]}>
                      {item.unit ? `${item.amount} ${item.unit}` : item.amount}
                    </Text>
                  </View>
                  <View style={styles.checkbox}>
                    <View style={styles.checkboxChecked}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {scopedItems.length === 0 && (
          <View style={styles.emptyState}>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={handleOpenAddModal}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyStateButtonText}>Add your first ingredient</Text>
            </TouchableOpacity>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="bag-outline" size={64} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyStateText}>No ingredients added</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Manual Item Bottom Sheet */}
      <BottomSheet
        ref={addItemBottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        onClose={() => {
          setManualInput('');
          Keyboard.dismiss();
        }}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity onPress={() => {
              Keyboard.dismiss();
              addItemBottomSheetRef.current?.close();
            }}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Type or paste multiple ingredients"
            value={manualInput}
            onChangeText={setManualInput}
            multiline
            autoFocus
            blurOnSubmit={false}
            returnKeyType="done"
            onSubmitEditing={handleAddManual}
          />
          <TouchableOpacity style={styles.doneButton} onPress={handleAddManual}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>


      {/* Sort Menu */}
      <BottomSheet
        ref={sortMenuBottomSheetRef}
        index={-1}
        snapPoints={sortMenuSnapPoints}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Title */}
          <Text style={styles.sortModalTitle}>Sort by</Text>
          
          {/* Sort Options */}
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => {
              setSortBy('recipe');
              sortMenuBottomSheetRef.current?.close();
            }}
          >
            <Text style={styles.sortOptionText}>Recipe</Text>
            {sortBy === 'recipe' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => {
              setSortBy('aisle');
              sortMenuBottomSheetRef.current?.close();
            }}
          >
            <Text style={styles.sortOptionText}>Aisle</Text>
            {sortBy === 'aisle' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => {
              setSortBy('a-z');
              sortMenuBottomSheetRef.current?.close();
            }}
          >
            <Text style={styles.sortOptionText}>A to Z</Text>
            {sortBy === 'a-z' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.sortOption}
            onPress={() => {
              setSortBy('recent');
              sortMenuBottomSheetRef.current?.close();
            }}
          >
            <Text style={styles.sortOptionText}>Recently added</Text>
            {sortBy === 'recent' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Item Details Modal */}
      <Modal
        visible={showItemDetails}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowItemDetails(false);
          setSelectedItem(null);
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          setShowItemDetails(false);
          setSelectedItem(null);
        }}>
          <View style={styles.itemDetailsOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.itemDetailsContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {selectedItem && (
                  <>
                    <View style={styles.itemDetailsHeader}>
                      <Text style={styles.itemDetailsTitle}>{selectedItem.name}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowItemDetails(false);
                          setSelectedItem(null);
                        }}
                      >
                        <Ionicons name="close" size={24} color="#1A1A1A" />
                      </TouchableOpacity>
                    </View>

                    {/* Quantity */}
                    <View style={styles.itemDetailsSection}>
                      <Text style={styles.itemDetailsLabel}>Quantity</Text>
                      <Text style={styles.itemDetailsValue}>
                        {selectedItem.unit ? `${selectedItem.amount} ${selectedItem.unit}` : selectedItem.amount}
                      </Text>
                    </View>

                    {/* Notes */}
                    <View style={styles.itemDetailsSection}>
                      <Text style={styles.itemDetailsLabel}>Notes</Text>
                      <TextInput
                        style={styles.itemDetailsNotesInput}
                        placeholder="Add notes (e.g., 'divided', 'chopped')"
                        value={selectedItem.notes || ''}
                        onChangeText={(text) => {
                          if (selectedItem) {
                            updateItemNotes(selectedItem.id, text);
                            setSelectedItem({ ...selectedItem, notes: text });
                          }
                        }}
                        multiline
                      />
                    </View>

                    {/* Sources */}
                    {selectedItem.sources && selectedItem.sources.length > 0 && (
                      <View style={styles.itemDetailsSection}>
                        <Text style={styles.itemDetailsLabel}>From recipes</Text>
                        {selectedItem.sources.map((source, index) => (
                          <TouchableOpacity
                            key={index}
                            style={styles.sourceItem}
                            onPress={() => {
                              navigation.navigate('RecipeDetail', { recipeId: source.recipeId });
                              setShowItemDetails(false);
                              setSelectedItem(null);
                            }}
                          >
                            <Ionicons name="restaurant" size={16} color="#666" />
                            <Text style={styles.sourceText}>{source.recipeTitle}</Text>
                            {source.amount && (
                              <Text style={styles.sourceAmount}>{source.amount}</Text>
                            )}
                            <Ionicons name="chevron-forward" size={16} color="#999" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Category Override */}
                    <View style={styles.itemDetailsSection}>
                      <Text style={styles.itemDetailsLabel}>Category</Text>
                      <View style={styles.categorySelector}>
                        {['FRESH PRODUCE', 'DAIRY, EGGS & FRIDGE', 'PASTA, GRAINS & LEGUMES', 'HERBS & SPICES', 'OILS & VINEGARS', 'OTHER'].map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.categoryOption,
                              (selectedItem.categoryOverride || selectedItem.category) === cat && styles.categoryOptionSelected
                            ]}
                            onPress={() => {
                              updateItemCategory(selectedItem.id, cat);
                              setSelectedItem({ ...selectedItem, categoryOverride: cat, category: cat });
                            }}
                          >
                            <Text style={[
                              styles.categoryOptionText,
                              (selectedItem.categoryOverride || selectedItem.category) === cat && styles.categoryOptionTextSelected
                            ]}>
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Pinned Toggle */}
                    <View style={styles.itemDetailsSection}>
                      <TouchableOpacity
                        style={styles.pinnedToggle}
                        onPress={() => {
                          toggleItemPinned(selectedItem.id);
                          setSelectedItem({ ...selectedItem, pinned: !selectedItem.pinned });
                        }}
                      >
                        <Ionicons
                          name={selectedItem.pinned ? "pin" : "pin-outline"}
                          size={20}
                          color={selectedItem.pinned ? "#FF6B35" : "#666"}
                        />
                        <Text style={styles.pinnedToggleText}>
                          {selectedItem.pinned ? 'Pinned (prevents auto-deletion)' : 'Pin item (prevent auto-deletion)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Confirm Merge Modal */}
      <Modal
        visible={showMergeModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissMerge}
      >
        <TouchableWithoutFeedback onPress={handleDismissMerge}>
          <View style={styles.mergeModalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.mergeModalContent}>
                <Text style={styles.mergeModalTitle}>Merge items?</Text>
                {pendingMerge && (
                  <>
                    <Text style={styles.mergeModalDescription}>
                      Merge {pendingMerge.items.length} similar items into:
                    </Text>
                    <View style={styles.mergePreview}>
                      <Text style={styles.mergePreviewName}>{pendingMerge.suggestedName}</Text>
                      <Text style={styles.mergePreviewAmount}>
                        {pendingMerge.unit ? `${pendingMerge.totalAmount} ${pendingMerge.unit}` : pendingMerge.totalAmount}
                      </Text>
                    </View>
                    <View style={styles.mergeItemsList}>
                      {pendingMerge.items.map((item) => (
                        <Text key={item.id} style={styles.mergeItemText}>
                          • {item.unit ? `${item.amount} ${item.unit} ${item.name}` : `${item.amount} ${item.name}`}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.mergeModalButtons}>
                      <TouchableOpacity
                        style={[styles.mergeModalButton, styles.mergeModalButtonCancel]}
                        onPress={handleDismissMerge}
                      >
                        <Text style={styles.mergeModalButtonCancelText}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.mergeModalButton, styles.mergeModalButtonConfirm]}
                        onPress={handleConfirmMerge}
                      >
                        <Text style={styles.mergeModalButtonConfirmText}>Yes</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Date Range Menu */}
      <BottomSheet
        ref={dateRangeBottomSheetRef}
        index={-1}
        snapPoints={dateRangeSnapPoints}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.sortModalTitle}>Shop for</Text>
          <TouchableOpacity
            style={styles.sortOption}
            onPress={handleSetThisWeek}
          >
            <View>
              <Text style={styles.sortOptionText}>This week</Text>
              {scopeStartDate && scopeEndDate && dateRange === 'this-week' && (
                <Text style={styles.sortOptionSubtext}>
                  {formatDateRange(scopeStartDate, scopeEndDate)}
                </Text>
              )}
            </View>
            {dateRange === 'this-week' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sortOption}
            onPress={handleSetCustomRange}
          >
            <Text style={styles.sortOptionText}>Custom date range</Text>
            {dateRange === 'custom' ? (
              <View style={styles.sortRadioSelected}>
                <View style={styles.sortRadioInner} />
              </View>
            ) : (
              <View style={styles.sortRadioUnselected} />
            )}
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      {/* Custom Date Range Picker */}
      <BottomSheet
        ref={customDatePickerBottomSheetRef}
        index={-1}
        snapPoints={datePickerSnapPoints}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        onClose={() => {
          setCustomStartDate(null);
          setCustomEndDate(null);
        }}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.sortModalTitle}>Select date range</Text>
            <TouchableOpacity
              onPress={() => {
                customDatePickerBottomSheetRef.current?.close();
                setCustomStartDate(null);
                setCustomEndDate(null);
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
                
                <View style={styles.datePickerSection}>
                  <Text style={styles.datePickerLabel}>Start date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.datePickerButtonText}>
                      {customStartDate 
                        ? customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Select start date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <>
                      {Platform.OS === 'ios' && (
                        <View style={styles.iosDatePickerContainer}>
                          <View style={styles.iosDatePickerHeader}>
                            <TouchableOpacity
                              onPress={() => setShowStartDatePicker(false)}
                            >
                              <Text style={styles.iosDatePickerButton}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.iosDatePickerTitle}>Select Start Date</Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (customStartDate) {
                                  setShowStartDatePicker(false);
                                }
                              }}
                            >
                              <Text style={[styles.iosDatePickerButton, styles.iosDatePickerButtonDone]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={customStartDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setCustomStartDate(selectedDate);
                                // If end date is before new start date, clear it
                                if (customEndDate && selectedDate > customEndDate) {
                                  setCustomEndDate(null);
                                }
                              }
                            }}
                            minimumDate={new Date()}
                            style={styles.iosDatePicker}
                          />
                        </View>
                      )}
                      {Platform.OS === 'android' && (
                        <DateTimePicker
                          value={customStartDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowStartDatePicker(false);
                            if (event.type === 'set' && selectedDate) {
                              setCustomStartDate(selectedDate);
                              // If end date is before new start date, clear it
                              if (customEndDate && selectedDate > customEndDate) {
                                setCustomEndDate(null);
                              }
                            }
                          }}
                          minimumDate={new Date()}
                        />
                      )}
                    </>
                  )}
                </View>

                <View style={styles.datePickerSection}>
                  <Text style={styles.datePickerLabel}>End date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => {
                      if (!customStartDate) {
                        Alert.alert('Select start date first');
                        return;
                      }
                      setShowEndDatePicker(true);
                    }}
                    disabled={!customStartDate}
                  >
                    <Text style={[styles.datePickerButtonText, !customStartDate && styles.datePickerButtonTextDisabled]}>
                      {customEndDate 
                        ? customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Select end date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={!customStartDate ? "#999" : "#666"} />
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <>
                      {Platform.OS === 'ios' && (
                        <View style={styles.iosDatePickerContainer}>
                          <View style={styles.iosDatePickerHeader}>
                            <TouchableOpacity
                              onPress={() => setShowEndDatePicker(false)}
                            >
                              <Text style={styles.iosDatePickerButton}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.iosDatePickerTitle}>Select End Date</Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (customEndDate) {
                                  setShowEndDatePicker(false);
                                }
                              }}
                            >
                              <Text style={[styles.iosDatePickerButton, styles.iosDatePickerButtonDone]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={customEndDate || customStartDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                if (customStartDate && selectedDate < customStartDate) {
                                  Alert.alert('End date must be after start date');
                                  return;
                                }
                                setCustomEndDate(selectedDate);
                              }
                            }}
                            minimumDate={customStartDate || new Date()}
                            style={styles.iosDatePicker}
                          />
                        </View>
                      )}
                      {Platform.OS === 'android' && (
                        <DateTimePicker
                          value={customEndDate || customStartDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowEndDatePicker(false);
                            if (event.type === 'set' && selectedDate) {
                              if (customStartDate && selectedDate < customStartDate) {
                                Alert.alert('End date must be after start date');
                                return;
                              }
                              setCustomEndDate(selectedDate);
                            }
                          }}
                          minimumDate={customStartDate || new Date()}
                        />
                      )}
                    </>
                  )}
                </View>

                {customStartDate && customEndDate && (
                  <View style={styles.datePickerPreview}>
                    <Text style={styles.datePickerPreviewText}>
                      Shopping for meals from {formatDateRange(
                        customStartDate.toISOString().split('T')[0],
                        customEndDate.toISOString().split('T')[0]
                      )}
                    </Text>
                    <Text style={styles.datePickerPreviewCount}>
                      {mealPlans.filter((plan) => {
                        const planDate = plan.date;
                        const start = customStartDate.toISOString().split('T')[0];
                        const end = customEndDate.toISOString().split('T')[0];
                        return planDate >= start && planDate <= end && plan.includeInGrocery;
                      }).length} meals
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.datePickerConfirmButton,
                    (!customStartDate || !customEndDate) && styles.datePickerConfirmButtonDisabled
                  ]}
                  onPress={handleConfirmCustomRange}
                  disabled={!customStartDate || !customEndDate}
                >
                  <Text style={styles.datePickerConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shopForContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  headerButton: {
    padding: 4,
  },
  headerButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFB88C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  headerButtonCircleWhite: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeCardSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  recipeImageContainer: {
    position: 'relative',
  },
  recipeImageContainerSmall: {
    marginLeft: 8,
  },
  recipeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  recipeImageSmall: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  recipeImagePlaceholder: {
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeImagePlaceholderSmall: {
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  recipeInfoSmall: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recipeTitleSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  recipeLink: {
    fontSize: 14,
    color: '#666',
  },
  recipeCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeCheckboxChecked: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipesHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  recipesHeaderSpacer: {
    flex: 1,
  },
  recipeSelectAllButton: {
    padding: 4,
  },
  shoppingListHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  shoppingListTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  shoppingListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectAllShoppingListButton: {
    padding: 4,
    position: 'absolute',
    right: 0,
  },
  addCustomItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  addCustomItemButtonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addCustomItemButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  itemCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  itemCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryGroup: {
    marginBottom: 16,
  },
  categoryGroupFirst: {
    marginTop: 20,
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checkedItem: {
    opacity: 0.5,
  },
  groceryItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  groceryItemName: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  groceryItemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  checkedItemText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  groceryItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearAllText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 300,
    marginBottom: 40,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyStateIconContainer: {
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bottomSheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetHandle: {
    backgroundColor: '#D0D0D0',
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  doneButton: {
    alignSelf: 'flex-end',
  },
  doneButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  overflowOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overflowMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  overflowMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  overflowMenuText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  overflowMenuTextDanger: {
    color: '#FF3B30',
  },
  overflowMenuTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sortDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sortModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  sortRadioUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  sortRadioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B35',
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  shopForButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  shopForText: {
    fontSize: 14,
    color: '#666',
  },
  mergeSuggestionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4ED',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB88C',
  },
  mergeSuggestionsText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  mergeSuggestionsLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  groceryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pinnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B35',
  },
  groceryItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groceryItemNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  sourcesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourcesText: {
    fontSize: 12,
    color: '#666',
  },
  itemDetailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  itemDetailsContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  itemDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  itemDetailsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  itemDetailsSection: {
    marginBottom: 24,
  },
  itemDetailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemDetailsValue: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  itemDetailsNotesInput: {
    borderWidth: 1,
    borderColor: '#E0E0DA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sourceText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  sourceAmount: {
    fontSize: 14,
    color: '#666',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
  },
  categoryOptionSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF4ED',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#666',
  },
  categoryOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  pinnedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  pinnedToggleText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  mergeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mergeModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    maxWidth: 400,
    width: '100%',
  },
  mergeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  mergeModalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  mergePreview: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  mergePreviewName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  mergePreviewAmount: {
    fontSize: 16,
    color: '#666',
  },
  mergeItemsList: {
    marginBottom: 24,
  },
  mergeItemText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  mergeModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mergeModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  mergeModalButtonCancel: {
    backgroundColor: '#F5F5F0',
  },
  mergeModalButtonConfirm: {
    backgroundColor: '#FF6B35',
  },
  mergeModalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  mergeModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sortOptionSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  datePickerSection: {
    marginBottom: 20,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0DA',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  datePickerButtonTextDisabled: {
    color: '#999',
  },
  datePickerPreview: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  datePickerPreviewText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  datePickerPreviewCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  datePickerConfirmButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  datePickerConfirmButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  datePickerConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iosDatePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  iosDatePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  iosDatePickerButton: {
    fontSize: 16,
    color: '#666',
  },
  iosDatePickerButtonDone: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  iosDatePicker: {
    height: 200,
  },
});

export default GroceriesScreen;
