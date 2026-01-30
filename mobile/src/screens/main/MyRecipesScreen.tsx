import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { GrocerySource } from '../../types/grocery';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { useModal } from '../../context/ModalContext';
import { sampleRecipe } from '../../data/sampleRecipe';
import { BottomSheet } from '../../components/BottomSheet';
import { Toast } from '../../components/Toast';
import { Recipe } from '../../types/recipe';
import { db, auth } from '../../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

type MyRecipesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'MyRecipes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MyRecipesScreenProps {
  navigation: MyRecipesScreenNavigationProp;
}

const MyRecipesScreen: React.FC<MyRecipesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { recipes } = useRecipesStore();
  const { addMealPlan } = useMealPlanStore();
  const { addItems } = useGroceriesStore();
  const { collections, loadCollections } = useCollectionsStore();
  const { showImportModal } = useModal();
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  const [cookedRecipeIds, setCookedRecipeIds] = useState<Set<string>>(new Set());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Load collections and cooked recipes when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCollections();
      loadCookedRecipes();
    }, [loadCollections])
  );

  const loadCookedRecipes = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const cookedQuery = query(
        collection(db, 'userCookedRecipes'),
        where('userId', '==', currentUser.uid)
      );
      
      const cookedSnapshot = await getDocs(cookedQuery);
      const cookedIds = new Set<string>();
      cookedSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.recipeId) {
          cookedIds.add(data.recipeId);
        }
      });
      
      setCookedRecipeIds(cookedIds);
    } catch (error) {
      console.error('Error loading cooked recipes:', error);
      // If query fails (e.g., index not created), try without orderBy
      try {
        const cookedQuery = query(
          collection(db, 'userCookedRecipes'),
          where('userId', '==', currentUser.uid)
        );
        const cookedSnapshot = await getDocs(cookedQuery);
        const cookedIds = new Set<string>();
        cookedSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.recipeId) {
            cookedIds.add(data.recipeId);
          }
        });
        setCookedRecipeIds(cookedIds);
      } catch (fallbackError) {
        console.error('Error loading cooked recipes (fallback):', fallbackError);
      }
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Restore images for recipes that lost them during persistence
  const allRecipes = (recipes.length > 0 ? recipes : [sampleRecipe]).map(recipe => {
    if (recipe.id === sampleRecipe.id) {
      return { ...recipe, image: sampleRecipe.image };
    }
    return recipe;
  });

  const screenWidth = Dimensions.get('window').width;
  const padding = 20;
  const gap = 12;
  const columns = 2;
  const cardWidth = (screenWidth - padding * 2 - gap) / columns;
  const imageHeight = cardWidth; // Square image
  const cardHeight = imageHeight + 60; // Image + title space

  // Group recipes by collection/cookbook (recipes can be in multiple collections)
  const recipesByCollection = React.useMemo(() => {
    const grouped: Record<string, Recipe[]> = {};
    
    // Initialize all collections
    collections.forEach(collection => {
      grouped[collection] = [];
    });
    
    // Group recipes by their collections (a recipe can appear in multiple collections)
    allRecipes.forEach(recipe => {
      // Support both old cookbook format and new collections array format
      const recipeCollections = (recipe as any).collections || 
        ((recipe as any).cookbook ? [(recipe as any).cookbook] : []);
      
      if (Array.isArray(recipeCollections) && recipeCollections.length > 0) {
        // Add recipe to each collection it belongs to
        recipeCollections.forEach((collection: string) => {
          if (grouped[collection]) {
            // Only add if not already in the array (avoid duplicates)
            if (!grouped[collection].some(r => r.id === recipe.id)) {
              grouped[collection].push(recipe);
            }
          }
        });
      } else {
        // If recipe has no collections, add it to Uncategorized
        if (!grouped['Uncategorized']) {
          grouped['Uncategorized'] = [];
        }
        if (!grouped['Uncategorized'].some(r => r.id === recipe.id)) {
          grouped['Uncategorized'].push(recipe);
        }
      }
    });
    
    return grouped;
  }, [allRecipes, collections]);

  // Get recipes from "Want to cook" collection
  const wantToCookRecipes = recipesByCollection['Want to cook']?.slice(0, 2) || [];
  
  // Get previously cooked recipes (recipes that have been marked as cooked)
  const previouslyCookedRecipes = React.useMemo(() => {
    return allRecipes.filter(recipe => cookedRecipeIds.has(recipe.id)).slice(0, 2);
  }, [allRecipes, cookedRecipeIds]);

  const renderRecipeCard = (recipe: any, index: number) => {
    const isVegetarian = recipe.tags?.some((tag: string) => 
      tag.toLowerCase().includes('vegetarian') || tag.toLowerCase().includes('vegan')
    );

    return (
      <TouchableOpacity
        key={recipe.id}
        style={[styles.recipeCard, { width: cardWidth }]}
        onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
      >
        <View style={[styles.recipeImageContainer, { height: imageHeight }]}>
          {typeof recipe.image === 'string' ? (
            <Image source={{ uri: recipe.image }} style={styles.recipeCardImage} resizeMode="cover" />
          ) : recipe.image ? (
            <Image source={recipe.image} style={styles.recipeCardImage} resizeMode="cover" />
          ) : (
            <View style={styles.recipeCardPlaceholder}>
              <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
            </View>
          )}
          
          {/* Dietary Icon (bottom-left) */}
          {isVegetarian && (
            <View style={styles.dietaryIcon}>
              <Text style={styles.dietaryIconText}>VE</Text>
            </View>
          )}
          
          {/* Plus Button (bottom-right) */}
          <TouchableOpacity
            style={styles.plusButton}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedRecipeForOptions(recipe);
              setShowRecipeOptionsBottomSheet(true);
            }}
          >
            <Ionicons name="add" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
        
        {/* Recipe Title */}
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Recipes</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Want to cook Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Want to cook</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('WantToCook')}
            >
              <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <View style={styles.recipesRow}>
            {wantToCookRecipes.length > 0 ? (
              wantToCookRecipes.map((recipe, index) => renderRecipeCard(recipe, index))
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No recipes in "Want to cook" yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Previously cooked Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Previously cooked</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => {
                // TODO: Navigate to previously cooked recipes screen
              }}
            >
              <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <View style={styles.recipesRow}>
            {previouslyCookedRecipes.length > 0 ? (
              previouslyCookedRecipes.map((recipe, index) => renderRecipeCard(recipe, index))
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No previously cooked recipes yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* User-created Collections (including Favorites, excluding Want to cook which is shown above) */}
        {collections
          .filter(collection => collection !== 'Want to cook')
          .map(collection => {
            const collectionRecipes = recipesByCollection[collection] || [];
            
            return (
              <View key={collection} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{collection}</Text>
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => {
                      // TODO: Navigate to collection detail screen
                    }}
                  >
                    <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
                <View style={styles.recipesRow}>
                  {collectionRecipes.length > 0 ? (
                    collectionRecipes.slice(0, 4).map((recipe, index) => renderRecipeCard(recipe, index))
                  ) : (
                    <View style={styles.emptySection}>
                      <Text style={styles.emptySectionText}>No recipes in "{collection}" yet</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* Recipe Options Bottom Sheet */}
      <BottomSheet
        visible={showRecipeOptionsBottomSheet}
        onClose={() => {
          setShowRecipeOptionsBottomSheet(false);
          setSelectedRecipeForOptions(null);
          setShowMealTypeSelection(false);
        }}
        height="55%"
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
                      // TODO: Add to my planner
                      setShowRecipeOptionsBottomSheet(false);
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
                        
                        // Show success toast
                        setToastMessage(`${selectedRecipeForOptions.title} added to planner`);
                        setToastType('success');
                        setToastVisible(true);
                        
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
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
  recipesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recipeCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  recipeImageContainer: {
    width: '100%',
    position: 'relative',
  },
  recipeCardImage: {
    width: '100%',
    height: '100%',
  },
  recipeCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
  },
  dietaryIcon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dietaryIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  plusButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    padding: 12,
    paddingTop: 8,
    lineHeight: 18,
  },
  emptySection: {
    paddingVertical: 20,
  },
  emptySectionText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
    fontStyle: 'italic',
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
    paddingTop: 8,
  },
  recipeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recipeOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginLeft: 12,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 4,
  },
  mealTypeBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  mealTypeList: {
    paddingTop: 8,
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

export default MyRecipesScreen;
