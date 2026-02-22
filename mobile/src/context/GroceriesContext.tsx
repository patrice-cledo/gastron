import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GroceryItem, GroceryRecipe } from '../types/grocery';
import { Ingredient } from '../types/recipe';

interface GroceriesContextType {
  items: GroceryItem[];
  recipes: GroceryRecipe[];
  addItems: (ingredients: Ingredient[], recipeId?: string, recipeTitle?: string, servings?: number) => void;
  addRecipe: (recipe: GroceryRecipe) => void;
  removeRecipe: (recipeId: string) => void;
  toggleItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => void;
  addManualItem: (name: string, amount?: string, unit?: string) => void;
}

const GroceriesContext = createContext<GroceriesContextType | undefined>(undefined);

export const useGroceries = () => {
  const context = useContext(GroceriesContext);
  if (!context) {
    throw new Error('useGroceries must be used within GroceriesProvider');
  }
  return context;
};

// Helper function to categorize ingredients
const categorizeIngredient = (name: string): string => {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('parsley') || lowerName.includes('basil') || lowerName.includes('herb') ||
    lowerName.includes('cilantro') || lowerName.includes('rosemary') || lowerName.includes('thyme') ||
    lowerName.includes('oregano') || lowerName.includes('sage') || lowerName.includes('mint')) {
    return 'HERBS & SPICES';
  }

  if (lowerName.includes('milk') || lowerName.includes('cream') || lowerName.includes('cheese') ||
    lowerName.includes('butter') || lowerName.includes('yogurt') || lowerName.includes('egg')) {
    return 'DAIRY, EGGS & FRIDGE';
  }

  if (lowerName.includes('pasta') || lowerName.includes('spaghetti') || lowerName.includes('rice') ||
    lowerName.includes('quinoa') || lowerName.includes('bread') || lowerName.includes('flour')) {
    return 'PASTA, GRAINS & LEGUMES';
  }

  if (lowerName.includes('oil') || lowerName.includes('vinegar') || lowerName.includes('sauce')) {
    return 'OILS & VINEGARS';
  }

  return 'FRESH PRODUCE';
};

export const GroceriesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [recipes, setRecipes] = useState<GroceryRecipe[]>([]);

  const addItems = useCallback((ingredients: Ingredient[], recipeId?: string, recipeTitle?: string, servings: number = 4) => {
    const newItems: GroceryItem[] = ingredients.map((ingredient) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      icon: ingredient.icon,
      checked: false,
      recipeId,
      recipeTitle,
      category: categorizeIngredient(ingredient.name),
      createdAt: new Date().toISOString(),
      pinned: false,
    }));

    setItems((prev) => [...prev, ...newItems]);

    // Add recipe if not already present
    if (recipeId && recipeTitle) {
      setRecipes((prev) => {
        if (prev.some((r) => r.id === recipeId)) {
          return prev;
        }
        return [...prev, {
          id: recipeId,
          title: recipeTitle,
          image: undefined,
          ingredients: ingredients,
        }];
      });
    }
  }, []);

  const addRecipe = useCallback((recipe: GroceryRecipe) => {
    setRecipes((prev) => {
      // Don't add if already exists
      if (prev.some((r) => r.id === recipe.id)) {
        return prev;
      }
      return [...prev, recipe];
    });

    // Also add the ingredients
    addItems(recipe.ingredients, recipe.id, recipe.title);
  }, [addItems]);

  const removeRecipe = useCallback((recipeId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    setItems((prev) => prev.filter((item) => item.recipeId !== recipeId));
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearCheckedItems = useCallback(() => {
    setItems((prev) => prev.filter((item) => !item.checked));
  }, []);

  const clearAllItems = useCallback(() => {
    setItems([]);
    setRecipes([]);
  }, []);

  const addManualItem = useCallback((name: string, amount?: string, unit?: string) => {
    const newItem: GroceryItem = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      amount: amount || '1',
      unit,
      checked: false,
      category: categorizeIngredient(name),
      createdAt: new Date().toISOString(),
      pinned: true,
    };

    setItems((prev) => [...prev, newItem]);
  }, []);

  return (
    <GroceriesContext.Provider
      value={{
        items,
        recipes,
        addItems,
        addRecipe,
        removeRecipe,
        toggleItem,
        removeItem,
        clearCheckedItems,
        clearAllItems,
        addManualItem,
      }}
    >
      {children}
    </GroceriesContext.Provider>
  );
};

