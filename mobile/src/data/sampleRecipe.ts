import { Recipe } from '../types/recipe';

export const sampleRecipe: Recipe = {
  id: 'sample-jerk-pork',
  title: 'Jerk-Spiced Coconut Pork With Sticky Rice',
  description: 'This is all about bold, warming flavours and proper comfort.',
  image: require('../../assets/images/dishes/dish-example-1.jpeg'),
  ingredients: [
    { id: '1', name: 'Sushi Rice', amount: '150', unit: 'g', icon: 'rice' },
    { id: '2', name: 'Tinned Coconut Milk', amount: '400', unit: 'g', icon: 'can' },
    { id: '3', name: 'Brown Onion', amount: '1', unit: 'x', icon: 'onion' },
    { id: '4', name: 'Medium Carrot', amount: '1', unit: 'x', icon: 'carrot' },
    { id: '5', name: 'Spring Onions / Scallions', amount: '4', unit: 'x', icon: 'scallions' },
    { id: '6', name: 'Pork Shoulder', amount: '500', unit: 'g', icon: 'meat' },
    { id: '7', name: 'Jerk Seasoning', amount: '2', unit: 'tbsp', icon: 'spice' },
    { id: '8', name: 'Coconut Oil', amount: '1', unit: 'tbsp', icon: 'oil' },
  ],
  steps: [
    { id: '1', order: 1, description: 'Heat coconut oil in a large pan over medium-high heat' },
    { id: '2', order: 2, description: 'Add pork and cook until browned on all sides, about 5 minutes' },
    { id: '3', order: 3, description: 'Add onion and carrot, cook for 3 minutes until softened' },
    { id: '4', order: 4, description: 'Stir in jerk seasoning and cook for 1 minute until fragrant' },
    { id: '5', order: 5, description: 'Add coconut milk and bring to a simmer', duration: 5 },
    { id: '6', order: 6, description: 'Reduce heat and simmer for 25 minutes until pork is tender', duration: 25 },
    { id: '7', order: 7, description: 'Meanwhile, cook rice according to package instructions', duration: 20 },
    { id: '8', order: 8, description: 'Garnish with spring onions and serve over sticky rice' },
  ],
  prepTime: 15,
  cookTime: 30,
  servings: 2,
  nutrition: {
    calories: 450,
    protein: 35,
    carbs: 45,
    fats: 18,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Equipment item for ExtendedRecipe
export interface ExtendedRecipeEquipment {
  id?: string;
  name: string;
  image?: string;
}

// Extended recipe properties for display (not in base Recipe type)
export interface ExtendedRecipe extends Omit<Recipe, 'equipment'> {
  tags?: string[];
  category?: string;
  rating?: number;
  reviewCount?: number;
  equipment?: (string | ExtendedRecipeEquipment)[]; // Support both string (legacy) and object format
  notes?: string; // Recipe notes added by user
  recipePack?: {
    id: string;
    name: string;
    description: string;
  };
  chefTips?: Array<{
    type: 'tip' | 'make-ahead';
    text: string;
  }>;
}

export const sampleRecipeExtended: ExtendedRecipe = {
  ...sampleRecipe,
  tags: ['Dairy Free', 'Gluten Free', 'Nut Free'],
  category: 'Meat',
  rating: 4.4,
  reviewCount: 43,
  equipment: [
    'Medium Saucepan x1',
    'Sieve x1',
    'Large Frying Pan x1',
    "Chef's Knife x1",
    'Baking Paper x1',
  ],
  recipePack: {
    id: 'global-grains',
    name: 'Global Grains',
    description: 'Big global flavours, built on comforting grains. Hearty, saucy, and seriously satisfying.',
  },
  chefTips: [
    {
      type: 'tip',
      text: 'Stir the onions regularly during caramelisation and keep the heat low to avoid burning.',
    },
    {
      type: 'make-ahead',
      text: 'Caramelised onions can be made 2-3 days in advance and stored in the fridge.',
    },
    {
      type: 'make-ahead',
      text: 'Entire sauce (minus pasta water) can be made ahead and refrigerated - just loosen with hot water when mixing.',
    },
    {
      type: 'tip',
      text: 'The breadcrumb topping can be doubled and stored for topping salads or other pastas - store in an airtight container for up to a week.',
    },
  ],
};
