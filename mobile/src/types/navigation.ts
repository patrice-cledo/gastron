export type RootStackParamList = {
  Welcome: undefined;
  LoginOptions: undefined;
  GetStarted: undefined;
  DietaryPreferences: undefined;
  Servings: undefined;
  Cuisines: undefined;
  RecipeSources: undefined;
  Ingredients: undefined;
  HelpNeeded: { otherResponse?: string } | undefined;
  OtherHelp: undefined;
  FeaturedRecipes: undefined;
  SignUp: undefined;
  EmailSignUp: undefined;
  Login: undefined;
  EmailLogin: undefined;
  CodeVerification: {
    email: string;
    firstName: string;
    challengeId?: string;
    /** Screen to navigate to after successful verification ('NotificationIntro' for signup onboarding, 'Home' for login). */
    nextScreen: 'NotificationIntro' | 'Home';
  };
  // Post-signup onboarding flow
  NotificationIntro: undefined;
  NotificationPermission: undefined;
  CreateCollectionIntro: undefined;
  CreateCollectionForm: undefined;
  CollectionCreated: { collectionName: string };
  ShareExtensionIntro: undefined;
  ShareExtensionInstructions: undefined;
  ShareExtensionComplete: undefined;
  Pricing: undefined;
  Home: { screen?: keyof TabParamList } | undefined;
  RecipeLibrary: undefined;
  RecipeCollection: { title: string; recipeIds?: string[] };
  RecipeDetail: { recipeId: string; autoOpenMenu?: boolean };
  CookMode: { recipeId: string; showFullRecipe?: boolean };
  BrowserImport: undefined;
  PasteTextImport: undefined;
  PhotoImport: undefined;
  RecipeImportPreview: {
    imageUri?: string;
    ingredients?: string[];
    instructions?: string[];
    sourceUrl?: string;
    importId?: string;
    rawText?: string;
  };
  WriteRecipe: {
    recipeId?: string; // If provided, edit mode
    importedData?: {
      ingredients: string[];
      instructions: string[];
      imageUri?: string;
      ocrText?: string;
      title?: string;
      description?: string;
      notes?: string;
      servings?: number;
      prepTime?: number;
      cookTime?: number;
      nutrition?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fats?: number;
      };
    };
  } | undefined;
  RecipeInfo: {
    servings?: number;
    prepTime?: number;
    cookTime?: number;
    cuisine?: string;
    tags?: string[];
    sourceUrls?: string[];
    description?: string;
    onSave: (data: {
      servings?: number;
      prepTime?: number;
      cookTime?: number;
      cuisine?: string;
      tags?: string[];
      sourceUrls?: string[];
      description?: string;
    }) => void;
  };
  RecipeNutrition: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
    onSave: (data: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    }) => void;
  };
  StarterRecipes: undefined;
  ChooseRecipes: { preSelectedMealPlanIds?: string[] } | undefined;
  IngredientSelection: {
    selectedMealPlans: Array<{
      mealPlanId: string;
      recipeId: string;
      recipeTitle: string;
      date: string;
      mealType: string;
    }>;
  };
  Menu: undefined;
  WantToCook: undefined;
  Settings: undefined;
  Explore: undefined;
  Search: { selectedIngredients?: string[] } | undefined;
  Profile: undefined;
  Intolerances: undefined;
  FavouriteCuisines: undefined;
  DislikesAllergies: undefined;
  ManageSubscription: undefined;
  DeleteAccount: undefined;
  Inspiration: undefined;
  IngredientSearch: { selectedIngredients?: string[]; onSelect?: (ingredients: string[]) => void } | undefined;
  Notifications: undefined;
  Challenges: undefined;
  ChallengeDetail: { challengeId: string } | undefined;
  AddShoppingItem: undefined;
  RateAndReview: { recipeId: string };
};

export type TabParamList = {
  Recipes: undefined;
  Create: undefined;
  MealPlan: { addedItemsCount?: number; weekOffset?: number } | undefined;
  Groceries: undefined;
  MyRecipes: undefined;
  Profile: { tab?: 'dashboard' | 'profile' | 'recipes' | 'eatingTrends' | 'challenges' } | undefined;
};

