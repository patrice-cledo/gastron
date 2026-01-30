import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Recipe, Ingredient, Step } from '../types/recipe';
import { StorageService } from '../services/storage';

interface RecipesContextType {
  recipes: Recipe[];
  addRecipe: (recipe: Recipe) => Promise<void>;
  updateRecipe: (recipeId: string, recipe: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  getRecipe: (recipeId: string) => Recipe | undefined;
}

const RecipesContext = createContext<RecipesContextType | undefined>(undefined);

const STORAGE_KEY = 'recipes';

export const useRecipes = () => {
  const context = useContext(RecipesContext);
  if (!context) {
    throw new Error('useRecipes must be used within RecipesProvider');
  }
  return context;
};

export const RecipesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load recipes from storage on mount
  useEffect(() => {
    const loadRecipes = async () => {
      const storedRecipes = await StorageService.getItem<Recipe[]>(STORAGE_KEY);
      if (storedRecipes) {
        setRecipes(storedRecipes);
      }
      setIsLoaded(true);
    };
    loadRecipes();
  }, []);

  // Save recipes to storage whenever recipes change (but not on initial load)
  useEffect(() => {
    if (isLoaded) {
      const saveRecipes = async () => {
        await StorageService.setItem(STORAGE_KEY, recipes);
      };
      saveRecipes();
    }
  }, [recipes, isLoaded]);

  const addRecipe = useCallback(async (recipe: Recipe) => {
    setRecipes((prev) => {
      // Check if recipe with same ID already exists
      if (prev.some((r) => r.id === recipe.id)) {
        return prev;
      }
      return [...prev, recipe];
    });
  }, []);

  const updateRecipe = useCallback(async (recipeId: string, updates: Partial<Recipe>) => {
    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === recipeId
          ? { ...recipe, ...updates, updatedAt: new Date().toISOString() }
          : recipe
      )
    );
  }, []);

  const deleteRecipe = useCallback(async (recipeId: string) => {
    setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
  }, []);

  const getRecipe = useCallback(
    (recipeId: string) => {
      return recipes.find((recipe) => recipe.id === recipeId);
    },
    [recipes]
  );

  return (
    <RecipesContext.Provider
      value={{
        recipes,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        getRecipe,
      }}
    >
      {children}
    </RecipesContext.Provider>
  );
};
