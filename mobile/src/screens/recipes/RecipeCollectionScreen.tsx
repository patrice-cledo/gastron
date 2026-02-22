import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { BottomSheet } from '../../components/BottomSheet';
import { useRecipesStore } from '../../stores/recipesStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { GrocerySource } from '../../types/grocery';
import { Recipe } from '../../types/recipe';

type RecipeCollectionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecipeCollection'>;

interface RecipeCollectionScreenProps {
    navigation: RecipeCollectionNavigationProp;
}

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

const RecipeCollectionScreen: React.FC<RecipeCollectionScreenProps> = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const route = useRoute<any>();
    const title = route.params?.title || 'Collection';
    const recipeIds = route.params?.recipeIds;
    const { recipes } = useRecipesStore();
    const { addMealPlan } = useMealPlanStore();
    const { addItems } = useGroceriesStore();

    const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [dietaryPreferencesEnabled, setDietaryPreferencesEnabled] = useState(false);

    const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
    const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
    const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);

    const shouldReopenFilterRef = useRef<boolean>(false);
    const ingredientSearchSourceRef = useRef<'ingredients' | 'allergies' | null>(null);

    const screenWidth = Dimensions.get('window').width;
    const cardWidth = (screenWidth - 48 - 12) / 2; // adjusting for two columns padded

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Reopen filter modal when returning from IngredientSearch
    useFocusEffect(
        useCallback(() => {
            if (shouldReopenFilterRef.current) {
                setTimeout(() => {
                    setShowFilterModal(true);
                    shouldReopenFilterRef.current = false;
                }, 100);
            }

            const params = route.params as any;
            if (params?.selectedIngredients) {
                const ingredientLabels = params.selectedIngredients.map((id: string) => {
                    const ingredientMap: Record<string, string> = {
                        'egg': 'Egg', 'gnocchi': 'Gnocchi', 'gochujang': 'Gochujang',
                        'miso': 'Miso Paste', 'mushrooms': 'Mushrooms', 'pasta': 'Pasta',
                        'potato': 'Potato', 'spinach': 'Spinach', 'tofu': 'Tofu',
                        'chicken': 'Chicken', 'salmon': 'Salmon', 'onion': 'Onion',
                        'garlic': 'Garlic', 'tomato': 'Tomato', 'carrot': 'Carrot',
                        'rice': 'Rice', 'cheese': 'Cheese', 'bell-pepper': 'Bell Pepper',
                        'beef': 'Beef', 'pork': 'Pork', 'chorizo': 'Chorizo',
                        'nuts': 'Nuts', 'milk': 'Milk', 'coriander': 'Coriander', 'fish': 'Fish',
                    };
                    return ingredientMap[id] || id;
                });

                const targetFilter = ingredientSearchSourceRef.current || 'ingredients';

                setSelectedFilters((prev) => ({ ...prev, [targetFilter]: ingredientLabels }));

                requestAnimationFrame(() => {
                    setTimeout(() => {
                        setShowFilterModal(true);
                        ingredientSearchSourceRef.current = null;
                    }, 100);
                });

                navigation.setParams({ selectedIngredients: undefined } as any);
            }
        }, [route.params])
    );

    const baseRecipes = useMemo(() => {
        if (recipeIds && recipeIds.length > 0) {
            return recipes.filter(r => recipeIds.includes(r.id));
        }
        return recipes.filter(recipe => !recipe.id.startsWith('starter-'));
    }, [recipes, recipeIds]);

    const sortedRecipes = useMemo(() => {
        let filtered = [...baseRecipes];

        // Filter logic
        Object.entries(selectedFilters).forEach(([filterId, options]) => {
            if (options.length === 0) return;
            filtered = filtered.filter((recipe) => {
                switch (filterId) {
                    case 'ingredients': return options.some((ingredient) => recipe.ingredients?.some((ing) => ing.name.toLowerCase().includes(ingredient.toLowerCase())));
                    case 'allergies': return !options.some((allergy) => recipe.ingredients?.some((ing) => ing.name.toLowerCase().includes(allergy.toLowerCase())));
                    case 'tags': return options.some((tag) => recipe.tags?.includes(tag));
                    case 'dish-type':
                        if (options.includes('Vegetarian')) return recipe.tags?.includes('vegetarian');
                        if (options.includes('Vegan')) return recipe.tags?.includes('vegan');
                        return true;
                    case 'cuisine': return options.some((cuisine) => recipe.tags?.some(tag => tag.toLowerCase() === cuisine.toLowerCase()));
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

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
            } else {
                return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
            }
        });

        return filtered;
    }, [baseRecipes, selectedFilters, sortBy]);

    const toggleFilterOption = (filterId: string, option: string) => {
        setSelectedFilters((prev) => {
            const current = prev[filterId] || [];
            if (current.includes(option)) {
                return { ...prev, [filterId]: current.filter((item) => item !== option) };
            }
            return { ...prev, [filterId]: [...current, option] };
        });
    };

    const getFilterData = (filterId: string) => {
        const data: Record<string, any> = {
            ingredients: {
                sections: [
                    {
                        title: 'Dietary Preferences',
                        description: 'Apply your saved preferences to the search filters.',
                        link: 'Edit your preferences here.',
                        toggle: { label: 'Use saved preferences', value: false },
                    },
                    {
                        title: 'Ingredients',
                        options: ['Chicken', 'Salmon', 'Pasta', 'Tofu', 'Egg', 'Chorizo', 'Potato', 'Gnocchi'],
                        actionButton: 'Find Ingredients',
                    },
                ],
            },
            'dish-type': { sections: [{ options: ['Vegetarian', 'Vegan', 'Fish', 'Meat', 'Meat & Fish', 'Halal', 'Kosher'] }] },
            cuisine: { sections: [{ options: ['African', 'American', 'British', 'Caribbean', 'Chinese', 'European', 'French', 'Fusion', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mexican', 'Middle Eastern', 'Spanish', 'Thai', 'Turkish', 'Vietnamese'], moreButton: 'More' }] },
            nutrition: { sections: [{ options: ['Healthy Fats', 'High Fibre', 'High Protein', 'Low Carb', 'Low Fat', 'Low Salt'] }] },
            seasonal: { sections: [{ options: ['Spring', 'Summer', 'Autumn', 'Winter'] }] },
            tags: { sections: [{ options: ['Budget', 'Comfort', 'Easy Wins', 'Family Friendly', 'Global Flavours'], moreButton: 'More' }] },
            time: { sections: [{ title: 'Cook Time', options: ['< 15 Mins', '< 30 Mins', '< 45 Mins', '< 60 Mins'] }] },
            intolerances: { sections: [{ options: ['Gluten Free', 'Egg Free', 'Dairy Free', 'Nut Free'] }] },
            allergies: { sections: [{ title: 'Dislikes or allergies (Exclude)', options: ['Egg', 'Tofu', 'Nuts', 'Milk', 'Coriander', 'Fish'], actionButton: 'Add Dislike' }] },
            equipment: { sections: [{ title: 'Equipment (Exclude)', options: ['Microwave', 'Stove', 'Air Fryer', 'Blender', 'Kettle', 'Oven', 'Grill/Broiler'] }] },
            library: { sections: [{ options: ['Cooked Before', 'Favourites', 'Want To Cook'] }] },
        };
        return data[filterId];
    };

    const hasAnyFilters = Object.values(selectedFilters).some(filters => filters.length > 0);

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title}
                </Text>
                <View style={{ width: 32 }} />
            </View>

            {/* Sort / Filter Bar */}
            <View style={styles.sortFilterBar}>
                <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest')}
                >
                    <Ionicons name="swap-vertical" size={16} color="#1A1A1A" style={{ marginRight: 4 }} />
                    <Text style={styles.sortText}>sort by: {sortBy === 'newest' ? 'Newest' : 'Oldest'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterButton, hasAnyFilters && styles.filterButtonActive]}
                    onPress={() => setShowFilterModal(true)}
                >
                    <Ionicons name="filter" size={16} color={hasAnyFilters ? "#FFFFFF" : "#1A1A1A"} style={{ marginRight: 6 }} />
                    <Text style={[styles.filterButtonText, hasAnyFilters && styles.filterButtonTextActive]}>FILTERS</Text>
                </TouchableOpacity>
            </View>

            {/* Recipe Grid */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.gridContainer}>
                    {sortedRecipes.map((recipe) => (
                        <TouchableOpacity
                            key={recipe.id}
                            style={[styles.recipeCard, { width: cardWidth }]}
                            onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
                        >
                            <View style={styles.recipeImageContainer}>
                                {recipe.image ? (
                                    <Image source={{ uri: typeof recipe.image === 'string' ? recipe.image : '' }} style={styles.recipeImage} resizeMode="cover" />
                                ) : (
                                    <View style={styles.recipeImagePlaceholder}>
                                        <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={styles.recipePlusButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setSelectedRecipeForOptions(recipe as Recipe);
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
                    ))}
                    {sortedRecipes.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No recipes match your filters.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Filter Modal */}
            <BottomSheet
                visible={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                height="85%"
            >
                <View style={styles.filterModalContent}>
                    <View style={styles.filterModalHeader}>
                        <View style={styles.filterModalHeaderLeft}>
                            <Ionicons name="filter" size={24} color="#1A1A1A" />
                            <Text style={styles.filterModalTitle}>Filters</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                            <Ionicons name="close" size={24} color="#1A1A1A" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.filterScrollView} showsVerticalScrollIndicator={false}>
                        {filterOptions.map((filter) => {
                            const filterData = getFilterData(filter.id);
                            if (!filterData) return null;

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
                                        const shouldShowSectionTitle = section.title && (
                                            (!shouldUseSectionTitleAsMain && section.title !== mainTitle) || isIngredientsSection
                                        );

                                        const sectionKey = `${filter.id}-${index}`;
                                        const isExpanded = expandedSections[sectionKey] || false;
                                        const hasMoreButton = !!section.moreButton;
                                        const displayedOptions = hasMoreButton && !isExpanded
                                            ? (section.options || []).slice(0, 10)
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
                                                            style={[styles.toggle, dietaryPreferencesEnabled && styles.toggleActive]}
                                                            onPress={() => setDietaryPreferencesEnabled(!dietaryPreferencesEnabled)}
                                                        >
                                                            <View style={[styles.toggleCircle, dietaryPreferencesEnabled && styles.toggleCircleActive]} />
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
                                                                    shouldReopenFilterRef.current = true;
                                                                    setShowFilterModal(false);
                                                                    navigation.navigate('Profile');
                                                                }}
                                                            >here</Text>.
                                                        </Text>
                                                    </View>
                                                )}
                                                {displayedOptions && displayedOptions.length > 0 && (
                                                    <View style={styles.filterOptionsContainer}>
                                                        {displayedOptions.map((option: string, optIndex: number) => {
                                                            const isSelected = (selectedFilters[filter.id] || []).some(
                                                                (s: string) => s.toLowerCase() === option.toLowerCase()
                                                            );
                                                            return (
                                                                <TouchableOpacity
                                                                    key={optIndex}
                                                                    style={[styles.filterOption, isSelected && styles.filterOptionSelected]}
                                                                    onPress={() => toggleFilterOption(filter.id, option)}
                                                                >
                                                                    <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextSelected]}>
                                                                        {option}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                                {section.actionButton && (
                                                    <TouchableOpacity
                                                        style={styles.actionButton}
                                                        onPress={() => {
                                                            const targetFilter = section.actionButton === 'Add Dislike' ? 'allergies' : 'ingredients';
                                                            shouldReopenFilterRef.current = true;
                                                            ingredientSearchSourceRef.current = targetFilter;
                                                            setShowFilterModal(false);
                                                            navigation.navigate('IngredientSearch', { selectedIngredients: [] });
                                                        }}
                                                    >
                                                        <Ionicons name="add" size={16} color="#1A1A1A" />
                                                        <Text style={styles.actionButtonText}>{section.actionButton}</Text>
                                                    </TouchableOpacity>
                                                )}
                                                {section.moreButton && (
                                                    <TouchableOpacity onPress={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !isExpanded }))}>
                                                        <Text style={styles.moreButtonText}>{isExpanded ? 'Collapse' : section.moreButton}</Text>
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
                                                    source={selectedRecipeForOptions.image as any}
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
                                                    recipeTitle: selectedRecipeForOptions.title || 'Untitled',
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
                                                        recipeTitle: selectedRecipeForOptions.title || 'Untitled',
                                                        mealPlanEntryId: newMealPlan.id,
                                                        amount: ing.amount,
                                                    }));

                                                    addItems(adjustedIngredients as any, selectedRecipeForOptions.id, selectedRecipeForOptions.title || 'Untitled', targetServings, sources);
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
    },
    sortFilterBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sortText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1A1A1A',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1A1A1A',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    filterButtonActive: {
        backgroundColor: '#1A1A1A',
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    gridContent: {
        padding: 24,
        paddingBottom: 40,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    recipeCard: {
        marginBottom: 24,
    },
    recipeImageContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F5F5F0',
        marginBottom: 8,
    },
    recipeImage: {
        width: '100%',
        height: '100%',
    },
    recipeImagePlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipeTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 20,
        paddingHorizontal: 4,
    },
    emptyContainer: {
        width: '100%',
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999999',
    },
    filterModalContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    filterModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
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
    recipePlusButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    recipeOptionsContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    recipeOptionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    recipeOptionsImageContainer: {
        width: 60,
        height: 60,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F5F5F0',
        marginRight: 16,
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
    },
    recipeOptionsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    recipeOptionsTime: {
        fontSize: 14,
        color: '#666666',
    },
    recipeOptionsCloseButton: {
        padding: 4,
        marginLeft: 12,
    },
    recipeOptionsList: {
        padding: 8,
    },
    recipeOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
    },
    recipeOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#1A1A1A',
        marginLeft: 16,
    },
    mealTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    mealTypeBackButton: {
        padding: 4,
        width: 32,
    },
    mealTypeTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    mealTypeList: {
        padding: 8,
    },
    mealTypeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
    },
    mealTypeItemText: {
        fontSize: 16,
        color: '#1A1A1A',
    }
});

export default RecipeCollectionScreen;
