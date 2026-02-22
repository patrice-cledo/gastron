import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  saveMealPlanToFirebase, 
  deleteMealPlanFromFirebase, 
  loadMealPlansFromFirebase,
  batchSaveMealPlansToFirebase
} from '../services/mealPlanFirebase';
import { auth } from '../services/firebase';

export interface MealPlanItem {
  id: string;
  recipeId: string;
  recipeTitle: string;
  recipeImage?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string; // Format: YYYY-MM-DD
  servingsOverride?: number;
  includeInGrocery: boolean;
}

interface MealPlanState {
  mealPlans: MealPlanItem[];
  isLoading: boolean;
  isSyncing: boolean;
  addMealPlan: (mealPlan: MealPlanItem) => void;
  removeMealPlan: (mealPlanId: string) => void;
  updateMealPlan: (mealPlanId: string, updates: Partial<MealPlanItem>) => void;
  clearMealPlansForDate: (date: string) => void;
  setMealPlans: (mealPlans: MealPlanItem[]) => void;
  syncFromFirebase: () => Promise<void>;
  enrichMealPlansWithRecipes: (recipes: any[]) => void;
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      mealPlans: [],
      isLoading: false,
      isSyncing: false,
      
      addMealPlan: async (mealPlan) => {
        const mealPlanWithDefaults: MealPlanItem = {
          ...mealPlan,
          includeInGrocery: mealPlan.includeInGrocery !== undefined ? mealPlan.includeInGrocery : true,
        };
        set((state) => ({
          mealPlans: [...state.mealPlans, mealPlanWithDefaults],
        }));
        
        // Sync to Firebase (fire and forget)
        if (auth.currentUser) {
          try {
            await saveMealPlanToFirebase(mealPlanWithDefaults);
          } catch (error) {
            console.error('Error syncing meal plan to Firebase:', error);
          }
        }
      },
      
      removeMealPlan: async (mealPlanId) => {
        set((state) => ({
          mealPlans: state.mealPlans.filter((plan) => plan.id !== mealPlanId),
        }));
        
        // Sync to Firebase (fire and forget)
        if (auth.currentUser) {
          try {
            await deleteMealPlanFromFirebase(mealPlanId);
          } catch (error) {
            console.error('Error deleting meal plan from Firebase:', error);
          }
        }
      },
      
      updateMealPlan: async (mealPlanId, updates) => {
        const updatedMealPlan = get().mealPlans.find(plan => plan.id === mealPlanId);
        if (!updatedMealPlan) return;
        
        set((state) => ({
          mealPlans: state.mealPlans.map((plan) =>
            plan.id === mealPlanId ? { ...plan, ...updates } : plan
          ),
        }));
        
        // Sync to Firebase (fire and forget)
        if (auth.currentUser) {
          try {
            await saveMealPlanToFirebase({ ...updatedMealPlan, ...updates });
          } catch (error) {
            console.error('Error syncing meal plan update to Firebase:', error);
          }
        }
      },
      
      clearMealPlansForDate: async (date) => {
        const plansToDelete = get().mealPlans.filter((plan) => plan.date === date);
        
        set((state) => ({
          mealPlans: state.mealPlans.filter((plan) => plan.date !== date),
        }));
        
        // Sync to Firebase (fire and forget)
        if (auth.currentUser && plansToDelete.length > 0) {
          try {
            await Promise.all(plansToDelete.map(plan => deleteMealPlanFromFirebase(plan.id)));
          } catch (error) {
            console.error('Error deleting meal plans from Firebase:', error);
          }
        }
      },
      
      setMealPlans: (mealPlans) => {
        set({ mealPlans });
      },
      
      syncFromFirebase: async () => {
        if (!auth.currentUser) {
          console.log('Cannot sync meal plans: user not authenticated');
          return;
        }
        // Capture current state BEFORE any await so we don't lose locally-added items
        // (e.g. persist rehydration can overwrite state during the async fetch)
        const currentPlans = get().mealPlans;
        set({ isLoading: true });
        try {
          const firebaseMealPlans = await loadMealPlansFromFirebase();
          const firebaseIds = new Set(firebaseMealPlans.map((p) => p.id));
          // Keep locally-added items that aren't in Firebase yet (e.g. just added, or shelf/unscheduled items that don't sync)
          const localOnly = currentPlans.filter((p) => !firebaseIds.has(p.id));
          const merged = [...firebaseMealPlans, ...localOnly];
          
          set({ mealPlans: merged, isLoading: false });
          console.log('✅ Synced meal plans from Firebase');
        } catch (error) {
          console.error('❌ Error syncing meal plans from Firebase:', error);
          set({ isLoading: false });
        }
      },
      
      enrichMealPlansWithRecipes: (recipes: any[]) => {
        if (recipes.length === 0) return;
        
        set((state) => ({
          mealPlans: state.mealPlans.map((plan) => {
            const recipe = recipes.find((r) => r.id === plan.recipeId);
            if (recipe) {
              return {
                ...plan,
                recipeTitle: plan.recipeTitle || recipe.title || '',
                recipeImage: plan.recipeImage || (typeof recipe.image === 'string' ? recipe.image : undefined),
              };
            }
            return plan;
          }),
        }));
      },
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist mealPlans: when logged in Firebase is source of truth. Persisting
      // caused AsyncStorage to overwrite loaded Firebase data so the meal plan screen stayed empty.
      partialize: (state) => ({
        isLoading: state.isLoading,
        isSyncing: state.isSyncing,
      }),
      onRehydrateStorage: () => (state) => {
        if (auth.currentUser) {
          useMealPlanStore.getState().syncFromFirebase();
        }
      },
    }
  )
);
