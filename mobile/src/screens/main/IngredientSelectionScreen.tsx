import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { starterRecipes } from '../../data/starterRecipes';
import { useGroceriesStore } from '../../stores/groceriesStore';
import { useRecipesStore } from '../../stores/recipesStore';
import { Ingredient } from '../../types/recipe';
import { GrocerySource } from '../../types/grocery';
import { IngredientIcon } from '../../components/IngredientIcon';
import { getIngredientSpriteCode } from '../../utils/ingredientMapping';

type IngredientSelectionScreenRouteProp = RouteProp<RootStackParamList, 'IngredientSelection'>;
type IngredientSelectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IngredientSelection'>;

interface IngredientWithMeal {
  ingredient: Ingredient;
  mealPlanId: string;
  recipeTitle: string;
}

const IngredientSelectionScreen: React.FC = () => {
  const navigation = useNavigation<IngredientSelectionScreenNavigationProp>();
  const route = useRoute<IngredientSelectionScreenRouteProp>();
  const { selectedMealPlans } = route.params;
  const { addItems, addRecipe } = useGroceriesStore();
  const { recipes: savedRecipes } = useRecipesStore();

  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [servings, setServings] = useState<{ [recipeId: string]: number }>({});

  // Combine starter recipes and saved recipes
  const allRecipes = useMemo(() => {
    return [...starterRecipes, ...savedRecipes];
  }, [savedRecipes]);

  // Group ingredients by recipe
  const recipesWithIngredients = useMemo(() => {
    const recipesMap = new Map<string, {
      recipe: any;
      mealPlan: typeof selectedMealPlans[0];
      ingredients: IngredientWithMeal[];
    }>();

    selectedMealPlans.forEach((mealPlan) => {
      const recipe = allRecipes.find((r) => r.id === mealPlan.recipeId);
      if (recipe) {
        const defaultServings = servings[mealPlan.recipeId] || recipe.servings || 2;
        if (!servings[mealPlan.recipeId]) {
          setServings((prev) => ({ ...prev, [mealPlan.recipeId]: defaultServings }));
        }

        const ingredients: IngredientWithMeal[] = recipe.ingredients.map((ingredient) => {
          return {
            ingredient: {
              ...ingredient,
              // Store original amount, we'll adjust it when rendering
            },
            mealPlanId: mealPlan.mealPlanId,
            recipeTitle: mealPlan.recipeTitle,
          };
        });

        recipesMap.set(mealPlan.recipeId, {
          recipe,
          mealPlan,
          ingredients,
        });
      }
    });

    return Array.from(recipesMap.values());
  }, [selectedMealPlans, servings, allRecipes]);

  // Select all ingredients by default on mount
  useEffect(() => {
    if (recipesWithIngredients.length > 0 && selectedIngredients.size === 0) {
      const allKeys = new Set<string>();
      recipesWithIngredients.forEach(({ recipe, ingredients }) => {
        ingredients.forEach((item) => {
          allKeys.add(`${recipe.id}-${item.ingredient.id}`);
        });
      });
      setSelectedIngredients(allKeys);
    }
  }, [recipesWithIngredients]);

  // Flatten all ingredients for counting
  const allIngredients = useMemo(() => {
    return recipesWithIngredients.flatMap((r) => r.ingredients);
  }, [recipesWithIngredients]);

  const toggleIngredient = (recipeId: string, ingredientId: string) => {
    const key = `${recipeId}-${ingredientId}`;
    setSelectedIngredients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIngredients(new Set());
  };

  const handleAddItems = () => {
    const ingredientsToAdd: Ingredient[] = [];
    const recipeMap = new Map<string, { title: string; ingredients: Ingredient[] }>();

    recipesWithIngredients.forEach(({ recipe, mealPlan, ingredients }) => {
      const selectedForRecipe = ingredients.filter((item) =>
        selectedIngredients.has(`${recipe.id}-${item.ingredient.id}`)
      );

      if (selectedForRecipe.length > 0) {
        const currentServings = servings[recipe.id] || recipe.servings || 2;
        const baseServings = recipe.servings || 2;
        const adjustedIngredients = selectedForRecipe.map((item) => {
          return {
            ...item.ingredient,
            amount: String(Number(item.ingredient.amount) * (currentServings / baseServings)),
          };
        });

        ingredientsToAdd.push(...adjustedIngredients);
        // Create sources array - one source per ingredient from this recipe
        const sources: GrocerySource[] = adjustedIngredients.map((ing) => ({
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          mealPlanEntryId: mealPlan?.mealPlanId,
          amount: ing.amount,
        }));
        addItems(adjustedIngredients, recipe.id, recipe.title, currentServings, sources);
        addRecipe({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          ingredients: adjustedIngredients,
        });
      }
    });

    // Navigate back to meal plan
    // The notification will be handled by MealPlanScreen via navigation listener
    navigation.navigate('Home', {
      screen: 'MealPlan',
    } as any);
  };

  const adjustServings = (recipeId: string, delta: number) => {
    const recipe = allRecipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const currentServings = servings[recipeId] || recipe.servings || 2;
    const newServings = Math.max(1, currentServings + delta);
    setServings((prev) => ({ ...prev, [recipeId]: newServings }));

    // Update ingredient amounts based on new servings
    const recipeData = recipesWithIngredients.find((r) => r.recipe.id === recipeId);
    if (recipeData) {
      const baseServings = recipe.servings || 2;
      recipeData.ingredients.forEach((item) => {
        const key = `${recipeId}-${item.ingredient.id}`;
        // Update the ingredient amount in the selected set
        // This will trigger a re-render with updated amounts
      });
    }
  };

  const selectedCount = selectedIngredients.size;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.navigate('Home', { screen: 'MealPlan' })}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Top Actions */}
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.convertButton} activeOpacity={0.7}>
          <Ionicons name="scale-outline" size={20} color="#666" />
          <Text style={styles.convertButtonText}>Convert</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeselectAll} activeOpacity={0.7}>
          <Text style={styles.deselectAllText}>Deselect all</Text>
        </TouchableOpacity>
      </View>

      {/* Ingredients List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recipesWithIngredients.map(({ recipe, mealPlan, ingredients }) => {
          const currentServings = servings[recipe.id] || recipe.servings || 2;
          const baseServings = recipe.servings || 2;

          return (
            <View key={recipe.id} style={styles.recipeSection}>
              {/* Recipe Title and Servings */}
              <View style={styles.recipeHeader}>
                <Text style={styles.recipeTitle} numberOfLines={1} ellipsizeMode="tail">
                  {recipe.title}
                </Text>
                <View style={styles.servingsSelector}>
                  <TouchableOpacity
                    style={styles.servingsButton}
                    onPress={() => adjustServings(recipe.id, -1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                  <Text style={styles.servingsText}>{currentServings} serves</Text>
                  <TouchableOpacity
                    style={styles.servingsButton}
                    onPress={() => adjustServings(recipe.id, 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color="#FF6B35" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Ingredients List for this recipe */}
              {ingredients.map((item) => {
                const key = `${recipe.id}-${item.ingredient.id}`;
                const isSelected = selectedIngredients.has(key);
                const spriteCode = getIngredientSpriteCode(item.ingredient.name);

                // Calculate adjusted amount based on current servings
                const originalAmount = Number(item.ingredient.amount);
                const originalServings = recipe.servings || 2;
                const adjustedAmount = String((originalAmount * currentServings) / originalServings);

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.ingredientRow}
                    onPress={() => toggleIngredient(recipe.id, item.ingredient.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ingredientIcon}>
                      {spriteCode ? (
                        <IngredientIcon name={item.ingredient.name} type="whole" size="medium" />
                      ) : (
                        <View style={styles.ingredientIconPlaceholder}>
                          <Ionicons name="leaf-outline" size={20} color="#999" />
                        </View>
                      )}
                    </View>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>
                        {adjustedAmount} {item.ingredient.unit || ''} {item.ingredient.name}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addButton, selectedCount === 0 && styles.addButtonDisabled]}
          onPress={handleAddItems}
          disabled={selectedCount === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>
            Add {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
          </Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginLeft: 4,
  },
  closeButton: {
    padding: 4,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  convertButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginLeft: 6,
  },
  deselectAllText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  recipeSection: {
    marginBottom: 24,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 12,
    minWidth: 0,
    maxWidth: '65%',
  },
  servingsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    marginHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ingredientIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default IngredientSelectionScreen;
