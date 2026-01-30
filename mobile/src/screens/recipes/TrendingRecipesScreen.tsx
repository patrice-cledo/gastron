import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { GrocerySource } from '../../types/grocery';
import { Recipe } from '../../types/recipe';
import { BottomSheet } from '../../components/BottomSheet';

type TrendingRecipesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Explore'>;

interface TrendingRecipesScreenProps {
  navigation: TrendingRecipesScreenNavigationProp;
}

const TrendingRecipesScreen: React.FC<TrendingRecipesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { recipes } = useRecipesStore();
  const { addMealPlan } = useMealPlanStore();
  const { addItems } = useGroceriesStore();
  const [activeTab, setActiveTab] = useState<'for-you' | 'everything'>('for-you');
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48 - 24) / 2; // padding + gap

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Sample data for categories (you can replace with real data)
  const tags = [
    { id: 'budget', label: 'Budget', image: null },
    { id: 'comfort', label: 'Comfort', image: null },
    { id: 'quick', label: 'Quick', image: null },
  ];

  const cuisines = [
    { id: 'thai', label: 'Thai', flag: '🇹🇭' },
    { id: 'turkish', label: 'Turkish', flag: '🇹🇷' },
    { id: 'vietnamese', label: 'Vietnamese', flag: '🇻🇳' },
    { id: 'italian', label: 'Italian', flag: '🇮🇹' },
    { id: 'mexican', label: 'Mexican', flag: '🇲🇽' },
  ];

  const dietary = [
    { id: 'fish', label: 'Fish', image: null },
    { id: 'meat', label: 'Meat', image: null },
    { id: 'vegetarian', label: 'Vegetarian', image: null },
    { id: 'vegan', label: 'Vegan', image: null },
  ];

  const nutritional = [
    { id: 'high-protein', label: 'High Protein', image: null },
    { id: 'low-carb', label: 'Low Carb', image: null },
    { id: 'keto', label: 'Keto', image: null },
  ];

  const seasonal = [
    { id: 'autumn', label: 'Autumn', image: null },
    { id: 'spring', label: 'Spring', image: null },
    { id: 'summer', label: 'Summer', image: null },
    { id: 'winter', label: 'Winter', image: null },
  ];

  const handleRecipePress = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  const renderRecipeCard = (recipe: Recipe, index: number) => {
    const imageUrl = typeof recipe.image === 'string' ? recipe.image : null;
    
    return (
      <TouchableOpacity
        key={recipe.id}
        style={[styles.recipeCard, { width: cardWidth }]}
        onPress={() => handleRecipePress(recipe.id)}
      >
        <View style={styles.recipeImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.recipeImage} resizeMode="cover" />
          ) : (
            <View style={styles.recipeImagePlaceholder}>
              <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
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
  };

  const renderCategoryCard = (item: { id: string; label: string; image?: string | null; flag?: string }, index: number) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.categoryCard, { width: cardWidth }]}
        onPress={() => {
          // TODO: Filter recipes by category
        }}
      >
        <View style={styles.categoryImageContainer}>
          {item.flag ? (
            <View style={styles.flagContainer}>
              <Text style={styles.flagEmoji}>{item.flag}</Text>
            </View>
          ) : item.image ? (
            <Image source={{ uri: item.image }} style={styles.categoryImage} resizeMode="cover" />
          ) : (
            <View style={styles.categoryImagePlaceholder}>
              <Text style={styles.categoryPlaceholderText}>{item.label.charAt(0)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.categoryLabel}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  // Filter recipes based on active tab
  // For "For you" tab - show personalized sections
  const trySomethingNew = useMemo(() => recipes.slice(0, 5), [recipes]);
  const topTastesForYou = useMemo(() => recipes.slice(10, 15), [recipes]);
  
  // For "Everything" tab - show all recipes (will be filtered by sections)
  const allRecipesList = useMemo(() => recipes, [recipes]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]} edges={['top']}>
      {/* Header with Back Button, Tabs, and Search */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'for-you' && styles.tabActive]}
            onPress={() => setActiveTab('for-you')}
          >
            <Text style={[styles.tabText, activeTab === 'for-you' && styles.tabTextActive]}>
              For you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'everything' && styles.tabActive]}
            onPress={() => setActiveTab('everything')}
          >
            <Text style={[styles.tabText, activeTab === 'everything' && styles.tabTextActive]}>
              Everything
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search-outline" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'for-you' ? (
          <>
            {/* Try Something New Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Try Something New</Text>
                <TouchableOpacity style={styles.viewAllButton}>
                  <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {trySomethingNew.length > 0 ? (
                  trySomethingNew.map((recipe, index) => renderRecipeCard(recipe, index))
                ) : (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>No recipes available</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Top Tastes Just For You Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Tastes Just For You</Text>
                <TouchableOpacity style={styles.viewAllButton}>
                  <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {topTastesForYou.length > 0 ? (
                  topTastesForYou.map((recipe, index) => renderRecipeCard(recipe, index))
                ) : (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>No recipes available</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </>
        ) : (
          <>
            {/* All Recipes Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>All Recipes</Text>
                <TouchableOpacity style={styles.viewAllButton}>
                  <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {allRecipesList.length > 0 ? (
                  allRecipesList.slice(0, 5).map((recipe, index) => renderRecipeCard(recipe, index))
                ) : (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>No recipes available</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Tags Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {tags.map((tag, index) => renderCategoryCard(tag, index))}
              </ScrollView>
            </View>

            {/* Cuisines Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuisines</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {cuisines.map((cuisine, index) => renderCategoryCard(cuisine, index))}
              </ScrollView>
            </View>

            {/* Dietary Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dietary</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {dietary.map((item, index) => renderCategoryCard(item, index))}
              </ScrollView>
            </View>

            {/* Nutritional Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutritional</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {nutritional.map((item, index) => renderCategoryCard(item, index))}
              </ScrollView>
            </View>

            {/* Seasonal Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seasonal</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {seasonal.map((item, index) => renderCategoryCard(item, index))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: '#F5F5F0',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  searchButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
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
  horizontalScrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  recipeCard: {
    marginRight: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipePlusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingHorizontal: 4,
  },
  categoryCard: {
    marginRight: 12,
  },
  categoryImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#F5F5F0',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  categoryPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#999999',
  },
  flagContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
  },
  flagEmoji: {
    fontSize: 48,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  recipePackCard: {
    marginRight: 12,
  },
  recipePackImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: '#F5F5F0',
  },
  recipePackImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  recipePackPlaceholderText: {
    fontSize: 48,
  },
  recipePackPlusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipePackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingHorizontal: 4,
  },
  emptySection: {
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
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
});

export default TrendingRecipesScreen;
