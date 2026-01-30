import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroceryItem, GroceryRecipe, GrocerySource } from '../types/grocery';
import { Ingredient } from '../types/recipe';

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

interface GroceriesState {
  items: GroceryItem[];
  recipes: GroceryRecipe[];
  scopeStartDate: string | null; // ISO date string
  scopeEndDate: string | null; // ISO date string
  setScope: (startDate: string, endDate: string) => void;
  addItems: (ingredients: Ingredient[], recipeId?: string, recipeTitle?: string, servings?: number, sources?: GrocerySource[]) => void;
  addRecipe: (recipe: GroceryRecipe) => void;
  removeRecipe: (recipeId: string) => void;
  toggleItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<GroceryItem>) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  updateItemCategory: (itemId: string, category: string) => void;
  toggleItemPinned: (itemId: string) => void;
  mergeItems: (itemIds: string[], mergedName: string, mergedAmount: string, mergedUnit?: string) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => void;
  addManualItem: (name: string, amount?: string, unit?: string) => void;
}

// Helper to get start of week (Monday)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Helper to get end of week (Sunday)
const getEndOfWeek = (date: Date): Date => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
};

export const useGroceriesStore = create<GroceriesState>()(
  persist(
    (set, get) => {
      // Initialize scope to current week if not set
      const getInitialScope = () => {
        try {
          const state = get();
          if (state && state.scopeStartDate && state.scopeEndDate) {
            return {
              scopeStartDate: state.scopeStartDate,
              scopeEndDate: state.scopeEndDate,
            };
          }
        } catch (e) {
          // State not initialized yet, use defaults
        }
        
        // Default to current week
        const today = new Date();
        const weekStart = getStartOfWeek(today);
        const weekEnd = getEndOfWeek(today);
        return {
          scopeStartDate: weekStart.toISOString().split('T')[0],
          scopeEndDate: weekEnd.toISOString().split('T')[0],
        };
      };
      
      const initialScope = getInitialScope();
      
      return {
        items: [],
        recipes: [],
        scopeStartDate: initialScope.scopeStartDate,
        scopeEndDate: initialScope.scopeEndDate,
        
        setScope: (startDate: string, endDate: string) => {
          set({
            scopeStartDate: startDate,
            scopeEndDate: endDate,
          });
        },
        
        addItems: (ingredients, recipeId, recipeTitle, servings = 4, sources) => {
        console.log('🛒 addItems called:', {
          ingredientsCount: ingredients.length,
          recipeId,
          recipeTitle,
          servings,
          sourcesCount: sources?.length,
        });
        
        const newItems: GroceryItem[] = ingredients.map((ingredient, index) => {
          // If sources array is provided, use the corresponding source for this ingredient
          // Otherwise, create a default source from recipeId/recipeTitle
          const itemSources: GrocerySource[] | undefined = sources
            ? (sources[index] ? [sources[index]] : undefined)
            : (recipeId && recipeTitle ? [{
                recipeId,
                recipeTitle,
                amount: ingredient.amount,
              }] : undefined);
          
          return {
            id: `${Date.now()}-${Math.random()}-${index}`,
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            icon: ingredient.icon,
            checked: false,
            recipeId, // Legacy support
            recipeTitle, // Legacy support
            category: categorizeIngredient(ingredient.name),
            pinned: false,
            sources: itemSources,
            createdAt: new Date().toISOString(),
          };
        });
        
        console.log('🛒 Created newItems:', newItems.length, newItems.map(i => ({ name: i.name, recipeId: i.recipeId, hasSources: !!i.sources })));
        
        set((state) => {
          const updatedItems = [...state.items, ...newItems];
          console.log('🛒 Updated items count:', updatedItems.length);
          return { items: updatedItems };
        });
        
        // Add recipe if not already present
        if (recipeId && recipeTitle) {
          set((state) => {
            if (state.recipes.some((r) => r.id === recipeId)) {
              console.log('🛒 Recipe already exists:', recipeId);
              return state;
            }
            console.log('🛒 Adding recipe to store:', recipeId, recipeTitle);
            return {
              recipes: [...state.recipes, {
                id: recipeId,
                title: recipeTitle,
                image: undefined,
                ingredients: ingredients,
              }],
            };
          });
        }
      },
      
      addRecipe: (recipe) => {
        set((state) => {
          // Don't add if already exists
          if (state.recipes.some((r) => r.id === recipe.id)) {
            return state;
          }
          return {
            recipes: [...state.recipes, recipe],
          };
        });
        
        // Also add the ingredients
        get().addItems(recipe.ingredients, recipe.id, recipe.title);
      },
      
      removeRecipe: (recipeId) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== recipeId),
          items: state.items.filter((item) => item.recipeId !== recipeId),
        }));
      },
      
      toggleItem: (itemId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        }));
      },
      
      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },
      
      updateItem: (itemId, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        }));
      },
      
      updateItemNotes: (itemId, notes) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, notes } : item
          ),
        }));
      },
      
      updateItemCategory: (itemId, category) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, categoryOverride: category, category } : item
          ),
        }));
      },
      
      toggleItemPinned: (itemId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, pinned: !item.pinned } : item
          ),
        }));
      },
      
      mergeItems: (itemIds, mergedName, mergedAmount, mergedUnit) => {
        set((state) => {
          const itemsToMerge = state.items.filter((item) => itemIds.includes(item.id));
          if (itemsToMerge.length === 0) return state;
          
          // Collect all sources from merged items
          const allSources: GrocerySource[] = [];
          itemsToMerge.forEach((item) => {
            if (item.sources) {
              allSources.push(...item.sources);
            } else if (item.recipeId && item.recipeTitle) {
              // Legacy support
              allSources.push({
                recipeId: item.recipeId,
                recipeTitle: item.recipeTitle,
                amount: item.amount,
              });
            }
          });
          
          // Create merged item
          const mergedItem: GroceryItem = {
            id: `${Date.now()}-merged`,
            name: mergedName,
            amount: mergedAmount,
            unit: mergedUnit,
            checked: itemsToMerge.some((item) => item.checked), // If any was checked, merged is checked
            category: itemsToMerge[0]?.categoryOverride || itemsToMerge[0]?.category || 'OTHER',
            pinned: itemsToMerge.some((item) => item.pinned), // If any was pinned, merged is pinned
            sources: allSources.length > 0 ? allSources : undefined,
            createdAt: itemsToMerge[0]?.createdAt || new Date().toISOString(),
          };
          
          // Remove old items and add merged item
          return {
            items: [
              ...state.items.filter((item) => !itemIds.includes(item.id)),
              mergedItem,
            ],
          };
        });
      },
      
      clearCheckedItems: () => {
        set((state) => ({
          items: state.items.filter((item) => !item.checked),
        }));
      },
      
      clearAllItems: () => {
        set({
          items: [],
          recipes: [],
        });
      },
      
      addManualItem: (name, amount, unit) => {
        const newItem: GroceryItem = {
          id: `${Date.now()}-${Math.random()}`,
          name,
          amount: amount || '1',
          unit,
          checked: false,
          category: categorizeIngredient(name),
          pinned: true, // Manual items are pinned by default
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          items: [...state.items, newItem],
        }));
      },
    };
  },
  {
    name: 'groceries-storage',
    storage: createJSONStorage(() => AsyncStorage),
  })
);
