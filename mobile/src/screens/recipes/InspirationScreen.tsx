import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';
import { Recipe } from '../../types/recipe';
import { BottomSheet } from '../../components/BottomSheet';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';

type InspirationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Inspiration'>;

const InspirationScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<InspirationScreenNavigationProp>();
  const { recipes } = useRecipesStore();
  const { dietaryPreference, intolerances, favouriteCuisines, dislikesAllergies } = useUserPreferencesStore();
  
  const [showAnimation, setShowAnimation] = useState(true);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<{ [recipeId: string]: string }>({});
  const [showRecipeOptionsBottomSheet, setShowRecipeOptionsBottomSheet] = useState(false);
  const [selectedRecipeForOptions, setSelectedRecipeForOptions] = useState<Recipe | null>(null);
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(false);
  
  // Animation values
  const panScale = useMemo(() => new Animated.Value(1), []);
  const logoRotation = useMemo(() => new Animated.Value(0), []);
  const steamOpacity = useMemo(() => new Animated.Value(0.5), []);

  // Helper to check if a string is a storage path
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
    if (imageUrls[recipeId]) {
      return imageUrls[recipeId];
    }

    if (typeof image !== 'string') {
      return null;
    }

    if (image.startsWith('http://') || image.startsWith('https://')) {
      setImageUrls(prev => ({ ...prev, [recipeId]: image }));
      return image;
    }

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

  // Filter recipes based on user preferences
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

  // Start animation
  useEffect(() => {
    if (showAnimation) {
      // Pan bounce animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(panScale, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(panScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Logo rotation animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoRotation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(logoRotation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Steam opacity animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(steamOpacity, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(steamOpacity, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // After 2 seconds, filter recipes and show list
      const timer = setTimeout(() => {
        setIsLoading(true);
        const filtered = filterRecipesByPreferences(recipes);
        setTimeout(() => {
          setFilteredRecipes(filtered);
          setIsLoading(false);
          setShowAnimation(false);
        }, 500);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [showAnimation]);

  // Load image URLs for filtered recipes
  useEffect(() => {
    if (filteredRecipes.length > 0) {
      const loadImageUrls = async () => {
        const urlPromises = filteredRecipes.map(async (recipe) => {
          if (recipe.image && typeof recipe.image === 'string') {
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

      loadImageUrls();
    }
  }, [filteredRecipes]);

  const logoRotationInterpolate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  const handleRecipePlusPress = (recipe: Recipe, event: any) => {
    event.stopPropagation();
    setSelectedRecipeForOptions(recipe);
    setShowRecipeOptionsBottomSheet(true);
  };

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showAnimation ? 'Cooking up some inspiration...' : 'Inspiration'}
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {showAnimation ? (
        /* Animation View */
        <View style={styles.animationContainer}>
          <View style={styles.animationContent}>
            <Animated.View
              style={[
                styles.panContainer,
                {
                  transform: [{ scale: panScale }],
                },
              ]}
            >
              {/* Frying Pan */}
              <View style={styles.pan}>
                {/* Logo in pan */}
                <Animated.View
                  style={[
                    styles.logoInPan,
                    {
                      transform: [{ rotate: logoRotationInterpolate }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="chef-hat" size={40} color="#FFFFFF" />
                </Animated.View>
              </View>
              
              {/* Steam */}
              <Animated.View
                style={[
                  styles.steam,
                  {
                    opacity: steamOpacity,
                  },
                ]}
              >
                <View style={styles.steamLine} />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      ) : isLoading ? (
        /* Loading State */
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Finding perfect matches...</Text>
        </View>
      ) : (
        /* Recipe List */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredRecipes.length > 0 ? (
            <View style={styles.recipeGrid}>
              {filteredRecipes.map((recipe) => {
                const imageUrl = imageUrls[recipe.id] || 
                  (typeof recipe.image === 'string' ? recipe.image : null);
                
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
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
                      
                      {/* Plus Button */}
                      <TouchableOpacity
                        style={styles.plusButton}
                        onPress={(e) => handleRecipePlusPress(recipe, e)}
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
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recipes found matching your preferences.</Text>
              <Text style={styles.emptySubtext}>Try adjusting your preferences in Settings.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Recipe Options Bottom Sheet */}
      <BottomSheet
        visible={showRecipeOptionsBottomSheet}
        onClose={() => {
          setShowRecipeOptionsBottomSheet(false);
          setShowMealTypeSelection(false);
        }}
        height="55%"
      >
        {!showMealTypeSelection ? (
          <View style={styles.recipeOptionsContent}>
            {/* Recipe Header */}
            <View style={styles.recipeOptionsHeader}>
              {selectedRecipeForOptions && (
                <>
                  <View style={styles.recipeOptionsImageContainer}>
                    {imageUrls[selectedRecipeForOptions.id] ? (
                      <Image
                        source={{ uri: imageUrls[selectedRecipeForOptions.id] }}
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
                      {selectedRecipeForOptions.title}
                    </Text>
                    {(selectedRecipeForOptions.prepTime || selectedRecipeForOptions.cookTime) && (
                      <Text style={styles.recipeOptionsTime}>
                        {[selectedRecipeForOptions.prepTime, selectedRecipeForOptions.cookTime]
                          .filter(Boolean)
                          .join(' + ')} mins
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Options List */}
            <View style={styles.recipeOptionsList}>
              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => setShowMealTypeSelection(true)}
              >
                <Text style={styles.recipeOptionText}>I'll cook this today</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => {
                  setShowRecipeOptionsBottomSheet(false);
                  // TODO: Navigate to meal plan screen
                }}
              >
                <Text style={styles.recipeOptionText}>Add to my planner</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => {
                  setShowRecipeOptionsBottomSheet(false);
                  // TODO: Add to My Recipes
                }}
              >
                <Text style={styles.recipeOptionText}>Add to My Recipes</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => {
                  setShowRecipeOptionsBottomSheet(false);
                  // TODO: View Recipe Pack
                }}
              >
                <Text style={styles.recipeOptionText}>View Recipe Pack</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => {
                  setShowRecipeOptionsBottomSheet(false);
                  // TODO: Show recipe notes
                }}
              >
                <Text style={styles.recipeOptionText}>Your recipe notes</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recipeOptionItem}
                onPress={() => {
                  setShowRecipeOptionsBottomSheet(false);
                  // TODO: Share recipe
                }}
              >
                <Text style={styles.recipeOptionText}>Share recipe</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Meal Type Selection */
          <View style={styles.mealTypeContainer}>
            <View style={styles.mealTypeHeader}>
              <TouchableOpacity
                style={styles.mealTypeBackButton}
                onPress={() => setShowMealTypeSelection(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
              <Text style={styles.mealTypeTitle}>Select meal type</Text>
              <View style={styles.mealTypeHeaderSpacer} />
            </View>

            <View style={styles.mealTypeList}>
              {mealTypes.map((mealType) => (
                <TouchableOpacity
                  key={mealType}
                  style={styles.mealTypeItem}
                  onPress={() => {
                    setShowRecipeOptionsBottomSheet(false);
                    setShowMealTypeSelection(false);
                    // TODO: Add to meal plan with selected meal type
                  }}
                >
                  <Text style={styles.mealTypeItemText}>
                    {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#999999" />
                </TouchableOpacity>
              ))}
            </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  animationContainer: {
    flex: 1,
    backgroundColor: '#FFF9C4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  panContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pan: {
    width: 120,
    height: 80,
    backgroundColor: '#1A1A1A',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoInPan: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  steam: {
    position: 'absolute',
    top: -30,
    left: 20,
  },
  steamLine: {
    width: 4,
    height: 40,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
    transform: [{ rotate: '-20deg' }],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  recipeCard: {
    width: '48%',
    marginBottom: 16,
  },
  recipeImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
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
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
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
  },
  recipeOptionsImage: {
    width: '100%',
    height: '100%',
  },
  recipeOptionsImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeOptionsHeaderText: {
    flex: 1,
  },
  recipeOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recipeOptionsTime: {
    fontSize: 14,
    color: '#666666',
  },
  recipeOptionsList: {
    marginTop: 8,
  },
  recipeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recipeOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  mealTypeContainer: {
    flex: 1,
  },
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  mealTypeBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  mealTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  mealTypeHeaderSpacer: {
    width: 40,
  },
  mealTypeList: {
    gap: 8,
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
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
});

export default InspirationScreen;
