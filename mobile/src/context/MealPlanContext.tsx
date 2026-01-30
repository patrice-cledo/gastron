import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MealPlanItem {
  id: string;
  recipeId: string;
  recipeTitle: string;
  recipeImage?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string; // Format: YYYY-MM-DD
  servingsOverride?: number; // Optional override for recipe servings
  includeInGrocery: boolean; // Default: true - whether to include in grocery list
}

interface MealPlanContextType {
  mealPlans: MealPlanItem[];
  setMealPlans: React.Dispatch<React.SetStateAction<MealPlanItem[]>>;
  addMealPlan: (mealPlan: MealPlanItem) => void;
  removeMealPlan: (mealPlanId: string) => void;
  updateMealPlan: (mealPlanId: string, updates: Partial<MealPlanItem>) => void;
  clearMealPlansForDate: (date: string) => void;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

export const useMealPlans = () => {
  const context = useContext(MealPlanContext);
  if (!context) {
    throw new Error('useMealPlans must be used within MealPlanProvider');
  }
  return context;
};

export const MealPlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mealPlans, setMealPlans] = useState<MealPlanItem[]>([]);

  const addMealPlan = (mealPlan: MealPlanItem) => {
    // Ensure includeInGrocery defaults to true if not specified
    const mealPlanWithDefaults: MealPlanItem = {
      ...mealPlan,
      includeInGrocery: mealPlan.includeInGrocery !== undefined ? mealPlan.includeInGrocery : true,
    };
    setMealPlans((prev) => [...prev, mealPlanWithDefaults]);
  };

  const removeMealPlan = (mealPlanId: string) => {
    setMealPlans((prev) => prev.filter((plan) => plan.id !== mealPlanId));
  };

  const updateMealPlan = (mealPlanId: string, updates: Partial<MealPlanItem>) => {
    setMealPlans((prev) =>
      prev.map((plan) => (plan.id === mealPlanId ? { ...plan, ...updates } : plan))
    );
  };

  const clearMealPlansForDate = (date: string) => {
    setMealPlans((prev) => prev.filter((plan) => plan.date !== date));
  };

  return (
    <MealPlanContext.Provider
      value={{
        mealPlans,
        setMealPlans,
        addMealPlan,
        removeMealPlan,
        updateMealPlan,
        clearMealPlansForDate,
      }}
    >
      {children}
    </MealPlanContext.Provider>
  );
};
