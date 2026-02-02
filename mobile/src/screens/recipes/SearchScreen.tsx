import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { BottomSheet } from '../../components/BottomSheet';
import { useRecipesStore } from '../../stores/recipesStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { GrocerySource } from '../../types/grocery';
import { Recipe } from '../../types/recipe';
import { Dimensions } from 'react-native';

type SearchScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Search'>;

interface SearchScreenProps {
  navigation: SearchScreenNavigationProp;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { recipes } = useRecipesStore();
  const { addMealPlan } = useMealPlanStore();
  const { addItems } = useGroceriesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [dietaryPreferencesEnabled, setDietaryPreferencesEnabled] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'fewest-ingredients' | 'most-ingredients'>('newest');
  const [activeTab, setActiveTab] = useState<'recipes' | 'packs'>('recipes');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const shouldReopenFilterRef = useRef<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const ingredientSearchSourceRef = useRef<'ingredients' | 'allergies' | null>(null);
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);
  const [customSearchName, setCustomSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string;
    name: string;
    query: string;
    filters: Record<string, string[]>;
    sortBy: 'newest' | 'oldest' | 'fewest-ingredients' | 'most-ingredients';
  }>>([]);
  
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48) / 2; // padding + gap

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filterOptions = [
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'dish-type', label: 'Dish Type' },
    { id: 'cuisine', label: 'Cuisine' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'tags', label: 'Tags' },
    { id: 'time', label: 'Time' },
    { id: 'intolerances', label: 'Intolerances' },
    { id: 'allergies', label: 'Allergies' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'library', label: 'Library' },
  ];

  const popularSearches = ['Chicken', 'Gnocchi', 'Italian', 'Pasta', 'Dairy-Free'];

  // Reopen filter modal when returning from Profile
  useFocusEffect(
    useCallback(() => {
      if (shouldReopenFilterRef.current) {
        // Use setTimeout to ensure the screen is fully focused before reopening
        setTimeout(() => {
          setActiveFilter(shouldReopenFilterRef.current);
          shouldReopenFilterRef.current = null;
        }, 100);
      }
      
      // Handle return from IngredientSearch
      const params = route.params as any;
      if (params?.selectedIngredients) {
        const ingredientLabels = params.selectedIngredients.map((id: string) => {
          // Map ingredient IDs to labels (matching the filter options)
          const ingredientMap: Record<string, string> = {
            'egg': 'Egg',
            'gnocchi': 'Gnocchi',
            'gochujang': 'Gochujang',
            'miso': 'Miso Paste',
            'mushrooms': 'Mushrooms',
            'pasta': 'Pasta',
            'potato': 'Potato',
            'spinach': 'Spinach',
            'tofu': 'Tofu',
            'chicken': 'Chicken',
            'salmon': 'Salmon',
            'onion': 'Onion',
            'garlic': 'Garlic',
            'tomato': 'Tomato',
            'carrot': 'Carrot',
            'rice': 'Rice',
            'cheese': 'Cheese',
            'bell-pepper': 'Bell Pepper',
            'beef': 'Beef',
            'pork': 'Pork',
            'chorizo': 'Chorizo',
            'nuts': 'Nuts',
            'milk': 'Milk',
            'coriander': 'Coriander',
            'fish': 'Fish',
          };
          return ingredientMap[id] || id;
        });
        
        // Determine which filter to update based on source
        const targetFilter = ingredientSearchSourceRef.current || 'ingredients';
        
        // Replace the target filter with selected ingredients from search screen
        setSelectedFilters((prev) => {
          return { ...prev, [targetFilter]: ingredientLabels };
        });
        
        // Trigger search
        setShowResults(true);
        
        // Reopen the appropriate filter modal to show selected items
        // Use requestAnimationFrame to ensure state has updated
        requestAnimationFrame(() => {
          setTimeout(() => {
            setActiveFilter(targetFilter);
            ingredientSearchSourceRef.current = null;
          }, 100);
        });
        
        // Clear params
        navigation.setParams({ selectedIngredients: undefined } as any);
      }
    }, [route.params, navigation])
  );

  const handleFilterPress = (filterId: string) => {
    setActiveFilter(filterId);
  };

  const handleCloseFilter = () => {
    setActiveFilter(null);
    // Check if any filters are selected
    const hasFilters = Object.values(selectedFilters).some(filters => filters.length > 0);
    if (hasFilters || searchQuery.trim().length > 0) {
      setShowResults(true);
    }
  };

  const removeFilter = (filterId: string, optionLabel: string) => {
    // Find the original option value from selectedFilters
    setSelectedFilters((prev) => {
      const current = prev[filterId] || [];
      // Find the matching option (case-insensitive match)
      const matchingOption = current.find(item => item.toUpperCase() === optionLabel.toUpperCase());
      if (matchingOption) {
        const newFilters = { ...prev, [filterId]: current.filter((item) => item !== matchingOption) };
        // Check if we should hide results if no filters remain
        const hasAnyFilters = Object.values(newFilters).some(filters => filters.length > 0);
        // Retrigger search: show results if there are still filters or a search query
        if (hasAnyFilters || searchQuery.trim().length > 0) {
          setShowResults(true);
        } else {
          setShowResults(false);
        }
        return newFilters;
      }
      return prev;
    });
  };

  const getActiveFilterChips = () => {
    const chips: Array<{ id: string; label: string; filterId: string }> = [];
    Object.entries(selectedFilters).forEach(([filterId, options]) => {
      // Exclude allergies from the active filter chips display (but keep in filter modal)
      if (filterId === 'allergies') return;
      
      options.forEach((option) => {
        chips.push({
          id: `${filterId}-${option}`,
          label: option.toUpperCase(),
          filterId,
        });
      });
    });
    return chips;
  };

  const getFilteredRecipes = (): Recipe[] => {
    // Filter out starter recipes (fake recipes with IDs starting with 'starter-')
    let filtered = recipes.filter(recipe => !recipe.id.startsWith('starter-'));
    
    // Filter by search query
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(query) ||
          recipe.ingredients?.some((ing) => ing.name.toLowerCase().includes(query))
      );
    }

    // Filter by selected filters
    Object.entries(selectedFilters).forEach(([filterId, options]) => {
      if (options.length === 0) return;

      filtered = filtered.filter((recipe) => {
        switch (filterId) {
          case 'ingredients':
            // Check if recipe has any of the selected ingredients
            return options.some((ingredient) => 
              recipe.ingredients?.some((ing) => 
                ing.name.toLowerCase().includes(ingredient.toLowerCase())
              )
            );
          case 'allergies':
            // EXCLUDE recipes that contain any of the selected allergies/dislikes
            // Return false if recipe contains any disliked ingredient, true otherwise
            return !options.some((allergy) => 
              recipe.ingredients?.some((ing) => 
                ing.name.toLowerCase().includes(allergy.toLowerCase())
              )
            );
          case 'tags':
            return options.some((tag) => recipe.tags?.includes(tag));
          case 'dish-type':
            if (options.includes('Vegetarian')) {
              return recipe.tags?.includes('vegetarian');
            }
            if (options.includes('Vegan')) {
              return recipe.tags?.includes('vegan');
            }
            // Add more dish type filters as needed
            return true;
          case 'cuisine':
            // Check if recipe has cuisine in tags or other properties
            return options.some((cuisine) => 
              recipe.tags?.some(tag => tag.toLowerCase() === cuisine.toLowerCase())
            );
          case 'time':
            const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
            return options.some((timeOption) => {
              if (timeOption === '< 15 Mins') return totalTime < 15;
              if (timeOption === '< 30 Mins') return totalTime < 30;
              if (timeOption === '< 45 Mins') return totalTime < 45;
              if (timeOption === '< 60 Mins') return totalTime < 60;
              return true;
            });
          default:
            return true;
        }
      });
    });

    // Sort recipes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        case 'oldest':
          return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
        case 'fewest-ingredients':
          return (a.ingredients?.length || 0) - (b.ingredients?.length || 0);
        case 'most-ingredients':
          return (b.ingredients?.length || 0) - (a.ingredients?.length || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredRecipes = showResults ? getFilteredRecipes() : [];
  const activeFilterChips = getActiveFilterChips();
  const totalActiveFilters = activeFilterChips.length;

  const toggleFilterOption = (filterId: string, option: string) => {
    setSelectedFilters((prev) => {
      const current = prev[filterId] || [];
      if (current.includes(option)) {
        return { ...prev, [filterId]: current.filter((item) => item !== option) };
      } else {
        return { ...prev, [filterId]: [...current, option] };
      }
    });
  };

  const renderFilterModal = () => {
    if (!activeFilter) return null;

    return (
      <BottomSheet
        visible={activeFilter !== null}
        onClose={handleCloseFilter}
        height="85%"
      >
        <View style={styles.filterModalContent}>
          <View style={styles.filterModalHeader}>
            <View style={styles.filterModalHeaderLeft}>
              <Ionicons name="filter" size={24} color="#1A1A1A" />
              <Text style={styles.filterModalTitle}>Filters</Text>
            </View>
            <TouchableOpacity onPress={handleCloseFilter}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterScrollView} showsVerticalScrollIndicator={false}>
            {filterOptions.map((filter) => {
              const filterData = getFilterData(filter.id);
              if (!filterData) return null;

              // For allergies, equipment, and time, use section title as main title instead of category title
              const shouldUseSectionTitleAsMain = filter.id === 'allergies' || filter.id === 'equipment' || filter.id === 'time';
              const mainTitle = shouldUseSectionTitleAsMain && filterData.sections[0]?.title 
                ? filterData.sections[0].title 
                : filter.label;

              const selectedCount = (selectedFilters[filter.id] || []).length;
              const shouldHideMainTitle = filter.id === 'ingredients';
              
              return (
                <View key={filter.id} style={styles.filterCategorySection}>
                  {!shouldHideMainTitle && (
                    <View style={styles.filterCategoryTitleRow}>
                      <Text style={styles.filterCategoryTitle}>{mainTitle}</Text>
                      {selectedCount > 0 && (
                        <View style={styles.filterCategoryBadge}>
                          <Text style={styles.filterCategoryBadgeText}>{selectedCount}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {filterData.sections.map((section: any, index: number) => {
                    const isIngredientsSection = filter.id === 'ingredients' && section.title === 'Ingredients';
                    // Don't show section title if it's already used as main title (for allergies/equipment)
                    const shouldShowSectionTitle = section.title && (
                      (!shouldUseSectionTitleAsMain && section.title !== mainTitle) ||
                      isIngredientsSection
                    );
                    
                    // Handle expand/collapse for sections with moreButton
                    const sectionKey = `${filter.id}-${index}`;
                    const isExpanded = expandedSections[sectionKey] || false;
                    const hasMoreButton = !!section.moreButton;
                    const initialDisplayCount = hasMoreButton ? 10 : undefined;
                    const displayedOptions = hasMoreButton && !isExpanded 
                      ? (section.options || []).slice(0, initialDisplayCount)
                      : (section.options || []);
                    
                    return (
                      <View key={index} style={styles.filterSection}>
                        {shouldShowSectionTitle && (
                          <View style={styles.filterSectionTitleRow}>
                            <Text style={styles.filterSectionTitle}>{section.title}</Text>
                            {isIngredientsSection && selectedCount > 0 && (
                              <View style={styles.filterCategoryBadge}>
                                <Text style={styles.filterCategoryBadgeText}>{selectedCount}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      {section.description && (
                        <Text style={styles.filterSectionDescription}>{section.description}</Text>
                      )}
                      {section.toggle && (
                        <View style={styles.toggleContainer}>
                          <Text style={styles.toggleLabel}>{section.toggle.label}</Text>
                          <TouchableOpacity
                            style={[
                              styles.toggle,
                              dietaryPreferencesEnabled && styles.toggleActive,
                            ]}
                            onPress={() => setDietaryPreferencesEnabled(!dietaryPreferencesEnabled)}
                          >
                            <View
                              style={[
                                styles.toggleCircle,
                                dietaryPreferencesEnabled && styles.toggleCircleActive,
                              ]}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      {section.link && (
                        <View style={styles.filterLinkContainer}>
                          <Text style={styles.filterLinkText}>
                            {section.link.replace(' here.', ' ')}
                            <Text 
                              style={styles.filterLink}
                              onPress={() => {
                                // Store which filter was open
                                shouldReopenFilterRef.current = activeFilter;
                                // Close the modal
                                setActiveFilter(null);
                                // Navigate to Profile
                                navigation.navigate('Profile');
                              }}
                            >
                              here
                            </Text>
                            .
                          </Text>
                        </View>
                      )}
                      {displayedOptions && displayedOptions.length > 0 && (
                        <View style={styles.filterOptionsContainer}>
                          {displayedOptions.map((option: string, optIndex: number) => {
                            const selectedOptions = selectedFilters[filter.id] || [];
                            // Use case-insensitive comparison to handle any case mismatches
                            const isSelected = selectedOptions.some(
                              (selected: string) => selected.toLowerCase() === option.toLowerCase()
                            );
                            return (
                              <TouchableOpacity
                                key={optIndex}
                                style={[
                                  styles.filterOption,
                                  isSelected && styles.filterOptionSelected,
                                ]}
                                onPress={() => toggleFilterOption(filter.id, option)}
                              >
                                <Text
                                  style={[
                                    styles.filterOptionText,
                                    isSelected && styles.filterOptionTextSelected,
                                  ]}
                                >
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          {/* Show additional selected items that aren't in the predefined options */}
                          {(filter.id === 'ingredients' || filter.id === 'allergies') && (() => {
                            const selectedItems = selectedFilters[filter.id] || [];
                            const predefinedOptions = section.options || [];
                            const additionalSelected = selectedItems.filter(
                              (selected: string) => !predefinedOptions.some(
                                (option: string) => option.toLowerCase() === selected.toLowerCase()
                              )
                            );
                            return additionalSelected.map((item: string, idx: number) => (
                              <TouchableOpacity
                                key={`additional-${idx}`}
                                style={[
                                  styles.filterOption,
                                  styles.filterOptionSelected,
                                ]}
                                onPress={() => toggleFilterOption(filter.id, item)}
                              >
                                <Text
                                  style={[
                                    styles.filterOptionText,
                                    styles.filterOptionTextSelected,
                                  ]}
                                >
                                  {item}
                                </Text>
                              </TouchableOpacity>
                            ));
                          })()}
                        </View>
                      )}
                      {section.actionButton && (
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => {
                            if (section.actionButton === 'Find Ingredients' || section.actionButton === 'Add Dislike') {
                              // Determine which filter we're working with
                              const targetFilter = section.actionButton === 'Add Dislike' ? 'allergies' : 'ingredients';
                              const currentSelections = selectedFilters[targetFilter] || [];
                              
                              // Map ingredient labels to ingredient IDs (reverse mapping)
                              const ingredientIdMap: Record<string, string> = {
                                'Egg': 'egg',
                                'Gnocchi': 'gnocchi',
                                'Gochujang': 'gochujang',
                                'Miso Paste': 'miso',
                                'Mushrooms': 'mushrooms',
                                'Pasta': 'pasta',
                                'Potato': 'potato',
                                'Spinach': 'spinach',
                                'Tofu': 'tofu',
                                'Chicken': 'chicken',
                                'Salmon': 'salmon',
                                'Onion': 'onion',
                                'Garlic': 'garlic',
                                'Tomato': 'tomato',
                                'Carrot': 'carrot',
                                'Rice': 'rice',
                                'Cheese': 'cheese',
                                'Bell Pepper': 'bell-pepper',
                                'Beef': 'beef',
                                'Pork': 'pork',
                                'Chorizo': 'chorizo',
                                'Nuts': 'nuts',
                                'Milk': 'milk',
                                'Coriander': 'coriander',
                                'Fish': 'fish',
                              };
                              const selectedIngredientIds = currentSelections
                                .map(ing => ingredientIdMap[ing])
                                .filter(Boolean);
                              
                              // Store which filter was open and the source
                              shouldReopenFilterRef.current = activeFilter;
                              ingredientSearchSourceRef.current = targetFilter;
                              // Close the modal
                              setActiveFilter(null);
                              // Navigate to ingredient search
                              navigation.navigate('IngredientSearch', {
                                selectedIngredients: selectedIngredientIds,
                              });
                            }
                          }}
                        >
                          <Ionicons name="add" size={16} color="#1A1A1A" />
                          <Text style={styles.actionButtonText}>{section.actionButton}</Text>
                        </TouchableOpacity>
                      )}
                      {section.moreButton && (
                        <TouchableOpacity
                          onPress={() => {
                            setExpandedSections((prev) => ({
                              ...prev,
                              [sectionKey]: !isExpanded,
                            }));
                          }}
                        >
                          <Text style={styles.moreButtonText}>
                            {isExpanded ? 'Collapse' : section.moreButton}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>
    );
  };

  const getFilterData = (filterId: string) => {
    const data: Record<string, any> = {
      ingredients: {
        sections: [
          {
            title: 'Dietary Preferences',
            description: 'Apply your saved preferences to the search filters.',
            link: 'Edit your preferences here.',
            toggle: {
              label: 'Use saved preferences',
              value: false,
            },
          },
          {
            title: 'Ingredients',
            options: ['Chicken', 'Salmon', 'Pasta', 'Tofu', 'Egg', 'Chorizo', 'Potato', 'Gnocchi'],
            actionButton: 'Find Ingredients',
          },
        ],
      },
      'dish-type': {
        sections: [
          {
            options: ['Vegetarian', 'Vegan', 'Fish', 'Meat', 'Meat & Fish', 'Halal', 'Kosher'],
          },
        ],
      },
      cuisine: {
        sections: [
          {
            options: [
              'African',
              'American',
              'British',
              'Caribbean',
              'Chinese',
              'Eastern European',
              'European',
              'French',
              'Fusion',
              'Greek',
              'Indian',
              'Italian',
              'Japanese',
              'Korean',
              'Lebanese',
              'Mediterranean',
              'Mexican',
              'Middle Eastern',
              'North African',
              'North American',
              'South African',
              'South American',
              'South East Asian',
              'Spanish',
              'Thai',
              'Turkish',
              'Vietnamese',
            ],
            moreButton: 'More',
          },
        ],
      },
      nutrition: {
        sections: [
          {
            options: [
              'Healthy Fats',
              'High Fibre',
              'High Protein',
              'Low Carb',
              'Low Fat',
              'Low Salt',
            ],
          },
        ],
      },
      seasonal: {
        sections: [
          {
            options: ['Spring', 'Summer', 'Autumn', 'Winter'],
          },
        ],
      },
      tags: {
        sections: [
          {
            options: ['Budget', 'Comfort', 'Easy Wins', 'Family Friendly', 'Global Flavours'],
            moreButton: 'More',
          },
        ],
      },
      time: {
        sections: [
          {
            title: 'Cook Time',
            options: ['< 15 Mins', '< 30 Mins', '< 45 Mins', '< 60 Mins'],
          },
        ],
      },
      intolerances: {
        sections: [
          {
            options: ['Gluten Free', 'Egg Free', 'Dairy Free', 'Nut Free'],
          },
        ],
      },
      allergies: {
        sections: [
          {
            title: 'Dislikes or allergies (Exclude)',
            options: ['Egg', 'Tofu', 'Nuts', 'Milk', 'Coriander', 'Fish'],
            actionButton: 'Add Dislike',
          },
        ],
      },
      equipment: {
        sections: [
          {
            title: 'Equipment (Exclude)',
            options: ['Microwave', 'Stove', 'Air Fryer', 'Blender', 'Kettle', 'Oven', 'Grill/Broiler'],
          },
        ],
      },
      library: {
        sections: [
          {
            options: ['Cooked Before', 'Favourites', 'Want To Cook'],
          },
        ],
      },
    };

    return data[filterId];
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Search Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a recipe or ingredient"
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                // Show results if there's a query or filters
                const hasFilters = Object.values(selectedFilters).some(filters => filters.length > 0);
                if (text.trim().length > 0 || hasFilters) {
                  setShowResults(true);
                } else {
                  setShowResults(false);
                }
              }}
              onSubmitEditing={() => {
                const hasFilters = Object.values(selectedFilters).some(filters => filters.length > 0);
                if (searchQuery.trim().length > 0 || hasFilters) {
                  setShowResults(true);
                }
              }}
              autoFocus
            />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close" size={20} color="#666666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Options Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {filterOptions.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              (selectedFilters[filter.id] || []).length > 0 && styles.filterChipActive,
            ]}
            onPress={() => handleFilterPress(filter.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                (selectedFilters[filter.id] || []).length > 0 && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
            {(selectedFilters[filter.id] || []).length > 0 && (
              <View style={styles.filterChipBadge}>
                <Text style={styles.filterChipBadgeText}>
                  {(selectedFilters[filter.id] || []).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showResults ? (
        <>
          {/* Active Filter Chips */}
          {activeFilterChips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.activeFiltersRow}
              contentContainerStyle={styles.activeFiltersRowContent}
            >
              {activeFilterChips.map((chip) => (
                <View key={chip.id} style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{chip.label}</Text>
                  <TouchableOpacity
                    onPress={() => removeFilter(chip.filterId, chip.label)}
                    style={styles.activeFilterChipClose}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Sort and Filters Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortOptions(true)}>
              <Ionicons name="swap-vertical" size={18} color="#1A1A1A" />
              <Text style={styles.sortButtonText}>sort by: {
                sortBy === 'newest' ? 'Newest' : 
                sortBy === 'oldest' ? 'Oldest' : 
                sortBy === 'fewest-ingredients' ? 'Fewest Ingredients' :
                'Most Ingredients'
              }</Text>
            </TouchableOpacity>
            <View style={styles.actionBarRight}>
              <TouchableOpacity 
                style={styles.bookmarkButton}
                onPress={() => {
                  // Only allow saving if there's a search query or active filters
                  const hasFilters = Object.values(selectedFilters).some(filters => filters.length > 0);
                  if (searchQuery.trim().length > 0 || hasFilters) {
                    setShowSaveSearchModal(true);
                  }
                }}
              >
                <Ionicons name="bookmark-outline" size={20} color="#1A1A1A" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filtersButton}
                onPress={() => setActiveFilter('ingredients')}
              >
                <Ionicons name="filter" size={16} color="#FFFFFF" />
                <Text style={styles.filtersButtonText}>FILTERS {totalActiveFilters > 0 && `(${totalActiveFilters})`}</Text>
                {totalActiveFilters > 0 && <View style={styles.filtersButtonBadge} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'recipes' && styles.tabActive]}
              onPress={() => setActiveTab('recipes')}
            >
              <Text style={[styles.tabText, activeTab === 'recipes' && styles.tabTextActive]}>
                Recipes ({filteredRecipes.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'packs' && styles.tabActive]}
              onPress={() => setActiveTab('packs')}
            >
              <Text style={[styles.tabText, activeTab === 'packs' && styles.tabTextActive]}>
                Packs (0)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recipe Results */}
          {activeTab === 'recipes' && (
            <ScrollView
              style={styles.resultsScrollView}
              contentContainerStyle={styles.resultsContainerGrid}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.recipesGrid}>
                {filteredRecipes.map((recipe) => {
                  const imageUrl = typeof recipe.image === 'string' ? recipe.image : null;
                  const isVegetarian = recipe.tags?.some(tag => tag.toLowerCase() === 'vegetarian' || tag.toLowerCase() === 'vegan');
                  
                  return (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[styles.recipeCard, { width: cardWidth }]}
                      onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
                    >
                      <View style={styles.recipeImageContainer}>
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.recipeImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.recipeImagePlaceholder}>
                            <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                          </View>
                        )}
                        {isVegetarian && (
                          <View style={styles.vegetarianBadge}>
                            <Ionicons name="leaf" size={16} color="#4CAF50" />
                            <Text style={styles.vegetarianBadgeText}>v</Text>
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
                      <Text style={styles.recipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Packs Tab */}
          {activeTab === 'packs' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No packs found</Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Saved Searches */}
          <View style={styles.savedSearchesContainer}>
            <Text style={styles.savedSearchesTitle}>Saved searches</Text>
            {savedSearches.length > 0 ? (
              <View style={styles.savedSearchesRow}>
                {savedSearches.map((savedSearch) => (
                  <TouchableOpacity
                    key={savedSearch.id}
                    style={styles.savedSearchChip}
                    onPress={() => {
                      // Apply saved search
                      setSearchQuery(savedSearch.query);
                      setSelectedFilters(savedSearch.filters);
                      setSortBy(savedSearch.sortBy);
                      setShowResults(true);
                    }}
                  >
                    <Text style={styles.savedSearchChipText} numberOfLines={1}>
                      {savedSearch.name}
                    </Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSavedSearches(prev => prev.filter(s => s.id !== savedSearch.id));
                      }}
                      style={styles.savedSearchChipRemove}
                    >
                      <Ionicons name="close" size={16} color="#1A1A1A" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          {/* Popular Searches */}
          <View style={styles.popularSearchesContainer}>
            <Text style={styles.popularSearchesTitle}>Popular searches</Text>
            <View style={styles.popularSearchesRow}>
              {popularSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularSearchChip}
                  onPress={() => {
                    setSearchQuery(search);
                    // Add to tags filter
                    setSelectedFilters((prev) => {
                      const currentTags = prev['tags'] || [];
                      // Only add if not already selected
                      if (!currentTags.includes(search)) {
                        return { ...prev, tags: [...currentTags, search] };
                      }
                      return prev;
                    });
                    setShowResults(true);
                  }}
                >
                  <Text style={styles.popularSearchChipText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Filter Modal */}
      {renderFilterModal()}

      {/* Sort Options Bottom Sheet */}
      <BottomSheet
        visible={showSortOptions}
        onClose={() => setShowSortOptions(false)}
        height="40%"
      >
        <View style={styles.sortOptionsContent}>
          <View style={styles.sortOptionsHeader}>
            <Text style={styles.sortOptionsTitle}>Sort Options</Text>
            <TouchableOpacity onPress={() => setShowSortOptions(false)}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.sortOptionsList}>
            <TouchableOpacity
              style={styles.sortOptionItem}
              onPress={() => {
                setSortBy('newest');
                setShowSortOptions(false);
              }}
            >
              <Text style={styles.sortOptionText}>Newest</Text>
              <View style={[styles.sortOptionRadio, sortBy === 'newest' && styles.sortOptionRadioSelected]}>
                {sortBy === 'newest' && <View style={styles.sortOptionRadioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionItem}
              onPress={() => {
                setSortBy('oldest');
                setShowSortOptions(false);
              }}
            >
              <Text style={styles.sortOptionText}>Oldest</Text>
              <View style={[styles.sortOptionRadio, sortBy === 'oldest' && styles.sortOptionRadioSelected]}>
                {sortBy === 'oldest' && <View style={styles.sortOptionRadioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionItem}
              onPress={() => {
                setSortBy('fewest-ingredients');
                setShowSortOptions(false);
              }}
            >
              <Text style={styles.sortOptionText}>Fewest Ingredients</Text>
              <View style={[styles.sortOptionRadio, sortBy === 'fewest-ingredients' && styles.sortOptionRadioSelected]}>
                {sortBy === 'fewest-ingredients' && <View style={styles.sortOptionRadioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionItem}
              onPress={() => {
                setSortBy('most-ingredients');
                setShowSortOptions(false);
              }}
            >
              <Text style={styles.sortOptionText}>Most Ingredients</Text>
              <View style={[styles.sortOptionRadio, sortBy === 'most-ingredients' && styles.sortOptionRadioSelected]}>
                {sortBy === 'most-ingredients' && <View style={styles.sortOptionRadioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>
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
                    onPress={() => {
                      setShowRecipeOptionsBottomSheet(false);
                      navigation.navigate('Menu');
                    }}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#1A1A1A" />
                    <Text style={styles.recipeOptionText}>Add to my planner</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.recipeOptionItem}
                    onPress={() => {
                      // TODO: Add to My Recipes (bookmark/favorite)
                      setShowRecipeOptionsBottomSheet(false);
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
                        setSelectedRecipeForOptions(null);
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

      {/* Save Search Modal */}
      <BottomSheet
        visible={showSaveSearchModal}
        onClose={() => {
          setShowSaveSearchModal(false);
          setCustomSearchName('');
        }}
        height="40%"
      >
        <View style={styles.saveSearchModalContent}>
          <View style={styles.saveSearchModalHeader}>
            <Text style={styles.saveSearchModalTitle}>Save Search</Text>
            <TouchableOpacity
              onPress={() => {
                setShowSaveSearchModal(false);
                setCustomSearchName('');
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.saveSearchInputContainer}>
            <TextInput
              style={styles.saveSearchInput}
              placeholder="Custom Search Name"
              placeholderTextColor="#999999"
              value={customSearchName}
              onChangeText={setCustomSearchName}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveSearchButton,
              !customSearchName.trim() && styles.saveSearchButtonDisabled,
            ]}
            onPress={() => {
              if (customSearchName.trim()) {
                const newSavedSearch = {
                  id: `saved-${Date.now()}`,
                  name: customSearchName.trim(),
                  query: searchQuery,
                  filters: selectedFilters,
                  sortBy: sortBy,
                };
                setSavedSearches(prev => [...prev, newSavedSearch]);
                setShowSaveSearchModal(false);
                setCustomSearchName('');
                // Hide results to show saved searches section
                setShowResults(false);
              }
            }}
            disabled={!customSearchName.trim()}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.saveSearchButtonText}>SAVE</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  clearButton: {
    padding: 4,
  },
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 48,
  },
  filterRowContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    marginRight: 8,
    height: 32,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#CEEC2C',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  filterChipTextActive: {
    fontWeight: '600',
  },
  filterChipBadge: {
    marginLeft: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterChipBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  savedSearchesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  savedSearchesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  savedSearchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 32,
  },
  savedSearchChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  savedSearchChipRemove: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularSearchesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  popularSearchesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  popularSearchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularSearchChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
  },
  popularSearchChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filterModalContent: {
    flex: 1,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filterScrollView: {
    flex: 1,
  },
  filterCategorySection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterCategoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  filterCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  filterCategoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCategoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterSection: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
  },
  filterSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  filterSectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  filterLinkContainer: {
    marginBottom: 16,
  },
  filterLinkText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  filterLink: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  filterOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
  },
  filterOptionSelected: {
    backgroundColor: '#CEEC2C',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  filterOptionTextSelected: {
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
  },
  activeFiltersRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 48,
  },
  activeFiltersRowContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
    height: 28,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeFilterChipClose: {
    padding: 2,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  actionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookmarkButton: {
    padding: 4,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    position: 'relative',
  },
  filtersButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filtersButtonBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 24,
  },
  tab: {
    paddingBottom: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  tabTextActive: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  resultsScrollView: {
    flex: 1,
  },
  resultsContainerGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  recipeCard: {
    marginBottom: 16,
  },
  recipeImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: '#F5F5F0',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegetarianBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  vegetarianBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipePlusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CEEC2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999999',
  },
  sortOptionsContent: {
    flex: 1,
  },
  sortOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sortOptionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sortOptionsList: {
    paddingVertical: 8,
  },
  sortOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  sortOptionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionRadioSelected: {
    borderColor: '#4CAF50',
  },
  sortOptionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
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
  saveSearchModalContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  saveSearchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  saveSearchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  saveSearchInputContainer: {
    marginBottom: 24,
  },
  saveSearchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  saveSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  saveSearchButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveSearchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});

export default SearchScreen;
