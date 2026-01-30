import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserPreferencesState {
  showNutrition: boolean;
  setShowNutrition: (show: boolean) => void;
  dietaryPreference: string;
  setDietaryPreference: (preference: string) => void;
  intolerances: string;
  setIntolerances: (intolerances: string) => void;
  favouriteCuisines: string;
  setFavouriteCuisines: (cuisines: string) => void;
  dislikesAllergies: string;
  setDislikesAllergies: (dislikes: string) => void;
}

const USER_PREFERENCES_STORAGE_KEY = 'user-preferences-storage';

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      showNutrition: false,
      dietaryPreference: 'None',
      intolerances: 'None',
      favouriteCuisines: 'None',
      dislikesAllergies: 'None',
      
      setShowNutrition: (show) => {
        set({ showNutrition: show });
      },
      setDietaryPreference: (preference) => {
        set({ dietaryPreference: preference });
      },
      setIntolerances: (intolerances) => {
        set({ intolerances });
      },
      setFavouriteCuisines: (cuisines) => {
        set({ favouriteCuisines: cuisines });
      },
      setDislikesAllergies: (dislikes) => {
        set({ dislikesAllergies: dislikes });
      },
    }),
    {
      name: USER_PREFERENCES_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
