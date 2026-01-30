"use strict";
/**
 * Shared TypeScript types for backend and client
 * These types are used across Cloud Functions and can be imported by the mobile app
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.DEFAULT_CATEGORIES = void 0;
// Default categories
exports.DEFAULT_CATEGORIES = [
    { name: 'Produce', sortOrder: 1, userCustom: false },
    { name: 'Dairy', sortOrder: 2, userCustom: false },
    { name: 'Meat', sortOrder: 3, userCustom: false },
    { name: 'Pantry', sortOrder: 4, userCustom: false },
    { name: 'Spices', sortOrder: 5, userCustom: false },
    { name: 'Frozen', sortOrder: 6, userCustom: false },
    { name: 'Bakery', sortOrder: 7, userCustom: false },
    { name: 'Beverages', sortOrder: 8, userCustom: false },
    { name: 'Other', sortOrder: 9, userCustom: false },
];
// Firestore document paths (for type safety)
exports.COLLECTIONS = {
    users: 'users',
    recipes: 'recipes',
    mealPlans: 'mealPlans',
    mealPlanEntries: 'mealPlanEntries',
    groceryLists: 'groceryLists',
    groceryItems: 'groceryItems',
    userOverrides: 'userOverrides',
    categories: 'categories',
    imports: 'imports',
    recipeDrafts: 'recipeDrafts',
};
//# sourceMappingURL=types.js.map