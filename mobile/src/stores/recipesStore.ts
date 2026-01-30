import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../types/recipe';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

interface RecipesState {
  recipes: Recipe[];
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (recipeId: string, updates: Partial<Recipe>) => void;
  removeRecipe: (recipeId: string) => void;
  setRecipes: (recipes: Recipe[]) => void;
  clearRecipes: () => void;
  loadRecipesFromFirebase: () => Promise<void>;
  clearAndLoadFromFirebase: () => Promise<void>;
}

const RECIPES_STORAGE_KEY = 'recipes-storage';

export const useRecipesStore = create<RecipesState>()(
  persist(
    (set, get) => {
      const loadRecipesFromFirebase = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn('Cannot load recipes: user not authenticated');
          return;
        }

        try {
          // Query recipes that are either public or belong to the current user
          const recipesRef = collection(db, 'recipes');
          const publicRecipesQuery = query(recipesRef, where('isPublic', '==', true));
          const userRecipesQuery = query(recipesRef, where('userId', '==', currentUser.uid));
          
          const [publicSnapshot, userSnapshot] = await Promise.all([
            getDocs(publicRecipesQuery),
            getDocs(userRecipesQuery),
          ]);

          // Combine results and deduplicate by ID
          const recipeMap = new Map<string, Recipe>();
          
          publicSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            recipeMap.set(doc.id, {
              id: doc.id,
              title: data.title || '',
              description: data.description,
              image: data.image,
              ingredients: data.ingredients || [],
              // Ensure steps preserve duration field from Firestore
              steps: (data.steps || []).map((step: any) => ({
                id: step.id,
                order: step.order,
                description: step.description,
                image: step.image,
                duration: step.duration, // Preserve duration field
              })),
              equipment: data.equipment || [],
              prepTime: data.prepTime,
              cookTime: data.cookTime,
              servings: data.servings,
              nutrition: data.nutrition,
              tags: data.tags || [],
              cuisine: data.cuisine,
              collections: Array.isArray(data.collections) ? data.collections : (data.cookbook ? [data.cookbook] : undefined), // Preserve collections array (migrate from cookbook if needed)
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as Recipe);
          });
          
          userSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            recipeMap.set(doc.id, {
              id: doc.id,
              title: data.title || '',
              description: data.description,
              image: data.image,
              ingredients: data.ingredients || [],
              // Ensure steps preserve duration field from Firestore
              steps: (data.steps || []).map((step: any) => ({
                id: step.id,
                order: step.order,
                description: step.description,
                image: step.image,
                duration: step.duration, // Preserve duration field
              })),
              equipment: data.equipment || [],
              prepTime: data.prepTime,
              cookTime: data.cookTime,
              servings: data.servings,
              nutrition: data.nutrition,
              tags: data.tags || [],
              cuisine: data.cuisine,
              collections: Array.isArray(data.collections) ? data.collections : (data.cookbook ? [data.cookbook] : undefined), // Preserve collections array (migrate from cookbook if needed)
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as Recipe);
          });

          const recipes = Array.from(recipeMap.values());
          set({ recipes });
          console.log(`✅ Loaded ${recipes.length} recipes from Firebase`);
        } catch (error) {
          console.error('❌ Error loading recipes from Firebase:', error);
          throw error;
        }
      };

      return {
        recipes: [],
        
        addRecipe: (recipe) => {
          set((state) => ({
            recipes: [...state.recipes, recipe],
          }));
        },
        
        updateRecipe: (recipeId, updates) => {
          set((state) => ({
            recipes: state.recipes.map((recipe) =>
              recipe.id === recipeId ? { ...recipe, ...updates } : recipe
            ),
          }));
        },
        
        removeRecipe: (recipeId) => {
          set((state) => ({
            recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
          }));
        },
        
        setRecipes: (recipes) => {
          set({ recipes });
        },
        
        clearRecipes: () => {
          set({ recipes: [] });
        },
        
        loadRecipesFromFirebase,
        
        clearAndLoadFromFirebase: async () => {
          set({ recipes: [] });
          await loadRecipesFromFirebase();
        },
      };
    },
    {
      name: RECIPES_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
