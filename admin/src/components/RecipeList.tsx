import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import type { UserRecipe } from '@backend/types';

interface RecipeWithId extends UserRecipe {
    id: string;
}

interface RecipeListProps {
    onEdit?: (recipe: RecipeWithId) => void;
}

export function RecipeList({ onEdit }: RecipeListProps) {
    const [recipes, setRecipes] = useState<RecipeWithId[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [user, setUser] = useState(auth.currentUser);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'cuisine': true,
        'Meal Type': true,
        'Diet': true,
        'Other': true
    });

    // Filter data (mirrored from mobile SearchScreen/RecipeInfoScreen)
    const CUISINE_OPTIONS = [
        { id: 'greek', label: 'Greek', icon: '🇬🇷' },
        { id: 'american', label: 'American', icon: '🇺🇸' },
        { id: 'british', label: 'British', icon: '🇬🇧' },
        { id: 'european', label: 'European', icon: '🇪🇺' },
        { id: 'french', label: 'French', icon: '🇫🇷' },
        { id: 'indian', label: 'Indian', icon: '🇮🇳' },
        { id: 'italian', label: 'Italian', icon: '🇮🇹' },
        { id: 'japanese', label: 'Japanese', icon: '🇯🇵' },
        { id: 'korean', label: 'Korean', icon: '🇰🇷' },
        { id: 'lebanese', label: 'Lebanese', icon: '🇱🇧' },
        { id: 'mediterranean', label: 'Mediterranean', icon: '🇬🇷' },
        { id: 'mexican', label: 'Mexican', icon: '🇲🇽' },
        { id: 'spanish', label: 'Spanish', icon: '🇪🇸' },
        { id: 'thai', label: 'Thai', icon: '🇹🇭' },
        { id: 'turkish', label: 'Turkish', icon: '🇹🇷' },
        { id: 'vietnamese', label: 'Vietnamese', icon: '🇻🇳' },
        { id: 'fusion', label: 'Fusion', icon: 'globe' }, // Fallback icon
        { id: 'surprise-me', label: 'Surprise Me', icon: 'bulb' },
    ];

    const filters = {
        cuisine: CUISINE_OPTIONS.map(c => c.label),
        'Meal Type': [
            'Dinner', 'Breakfast', 'Lunch', 'Snack', 'Dessert', 'Salad', 'Drink',
            'Appetizer', 'Finger food', 'Side', 'Soup', 'Cocktail', 'Sauce', 'Dressing'
        ],
        'Diet': [
            'Vegetarian', 'Vegan', 'Pescatarian', 'Healthy', 'High Protein', 'Gluten-free',
            'No alcohol', 'Comfort food', 'Low-fat', 'Keto', 'Paleo', 'Dairy-free',
            'Low-sugar', 'Sugar-free', 'Low-carb', 'Kosher', 'Halal', 'FODMAP'
        ],
        'Other': [
            'Budget-friendly', 'Meal prep', 'One-Pot', 'Pantry staples', 'Freezer-friendly',
            'Entertaining', 'Weeknight dinner', 'Crowd-pleaser', 'Kid-friendly',
            'Allergy-friendly', 'Gourmet', 'Family recipe', 'Spicy', 'Crockpot'
        ]
    };

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    // Fetch recipes when user is available
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'recipes'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recipesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RecipeWithId[];
            setRecipes(recipesData);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching recipes:', err);
            setError(`Failed to load recipes: ${err.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'recipes', id));
            setDeleteId(null);
        } catch (err: any) {
            console.error('Error deleting recipe:', err);
            alert(`Failed to delete recipe: ${err.message}`);
        }
    };

    const toggleFilter = (category: string, value: string) => {
        setSelectedFilters(prev => {
            const current = prev[category] || [];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];

            if (updated.length === 0) {
                const { [category]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [category]: updated };
        });
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const getFilteredRecipes = () => {
        return recipes.filter(recipe => {
            // Search Query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesTitle = recipe.title.toLowerCase().includes(query);
                const matchesIngredients = recipe.ingredients?.some(i => i.name.toLowerCase().includes(query));
                if (!matchesTitle && !matchesIngredients) return false;
            }

            // Filters
            for (const [category, selectedOptions] of Object.entries(selectedFilters)) {
                if (selectedOptions.length === 0) continue;

                if (category === 'cuisine') {
                    // Check if recipe cuisine matches OR if it's in tags
                    // The form saves cuisine in `cuisine` field, but mobile search might check tags too.
                    // Let's check both for robustness.
                    const matchesCuisineField = selectedOptions.some(opt => recipe.cuisine === opt);
                    const matchesTag = selectedOptions.some(option =>
                        recipe.tags?.some(tag => tag.toLowerCase() === option.toLowerCase())
                    );
                    if (!matchesCuisineField && !matchesTag) return false;

                } else {
                    // Check tags for Meal Type, Diet, Other
                    const hasMatch = selectedOptions.some(option =>
                        recipe.tags?.some(tag => tag.toLowerCase() === option.toLowerCase())
                    );
                    if (!hasMatch) return false;
                }
            }

            return true;
        });
    };

    const filteredRecipes = getFilteredRecipes();

    if (loading) return <div className="text-center p-8">Loading recipes...</div>;

    if (error) return (
        <div className="text-center text-red-600 p-8 border border-red-200 bg-red-50 rounded-lg mx-4">
            <h3 className="font-bold mb-2">Error Loading Recipes</h3>
            <p className="mb-4">{error}</p>
        </div>
    );

    return (
        <div className="flex gap-6 items-start">
            {/* Filter Sidebar */}
            <div className="w-64 flex-shrink-0 bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-6">
                <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Search</h3>
                    <input
                        type="text"
                        placeholder="Search recipes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary"
                    />
                </div>

                {Object.entries(filters).map(([category, options]) => (
                    <div key={category} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <button
                            onClick={() => toggleSection(category)}
                            className="flex items-center justify-between w-full text-left font-semibold text-gray-900 mb-2 capitalize hover:text-primary transition-colors"
                        >
                            <span>{category}</span>
                            <svg
                                className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${expandedSections[category] ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {expandedSections[category] && (
                            <div className="mt-2">
                                {category === 'cuisine' ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {options.map(option => {
                                            const cuisineObj = CUISINE_OPTIONS.find(c => c.label === option);
                                            const isSelected = (selectedFilters[category] || []).includes(option);

                                            return (
                                                <button
                                                    key={option}
                                                    onClick={() => toggleFilter(category, option)}
                                                    className={`
                                                        flex flex-col items-center justify-center p-2 rounded-lg border transition-colors
                                                        ${isSelected
                                                            ? 'bg-primary/5 border-primary text-primary'
                                                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                                                    `}
                                                >
                                                    <span className="text-2xl mb-1">
                                                        {cuisineObj?.icon || '🍳'}
                                                    </span>
                                                    <span className="text-xs font-medium text-center leading-tight">
                                                        {option}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-1 bg-gray-50 p-3 rounded-md max-h-48 overflow-y-auto">
                                        {options.map(option => (
                                            <label key={option} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={(selectedFilters[category] || []).includes(option)}
                                                    onChange={() => toggleFilter(category, option)}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span className="text-gray-700">{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Recipe Grid/List */}
            <div className="flex-1 bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                        Showing {filteredRecipes.length} recipes
                    </span>
                    {(Object.keys(selectedFilters).length > 0 || searchQuery) && (
                        <button
                            onClick={() => {
                                setSelectedFilters({});
                                setSearchQuery('');
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                <ul role="list" className="divide-y divide-gray-200">
                    {filteredRecipes.length === 0 && (
                        <li className="p-8 text-center text-gray-500">
                            No recipes found matching your filters.
                        </li>
                    )}

                    {filteredRecipes.map((recipe) => (
                        <li key={recipe.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                            <div className="h-16 w-16 flex-shrink-0 rounded-md bg-gray-100 overflow-hidden border border-gray-200">
                                {recipe.image ? (
                                    <img src={recipe.image} alt={recipe.title} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                                        No Img
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-medium text-gray-900 truncate">
                                    {recipe.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                                    <span>{recipe.ingredients?.length || 0} ingredients</span>
                                    <span>•</span>
                                    <span>{recipe.steps?.length || 0} steps</span>
                                    {recipe.tags && recipe.tags.length > 0 && (
                                        <>
                                            <span>•</span>
                                            <div className="flex gap-1 overflow-hidden">
                                                {recipe.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                                                        {tag}
                                                    </span>
                                                ))}
                                                {recipe.tags.length > 3 && (
                                                    <span className="text-xs text-gray-400">+{recipe.tags.length - 3}</span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {onEdit && (
                                    <button
                                        onClick={() => onEdit(recipe)}
                                        className="p-2 text-gray-400 hover:text-primary"
                                        title="Edit Recipe"
                                    >
                                        <span className="sr-only">Edit</span>
                                        ✏️
                                    </button>
                                )}

                                {deleteId === recipe.id ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-red-600">Sync delete?</span>
                                        <button
                                            onClick={() => handleDelete(recipe.id)}
                                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                        >
                                            Yes
                                        </button>
                                        <button
                                            onClick={() => setDeleteId(null)}
                                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                        >
                                            No
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteId(recipe.id)}
                                        className="p-2 text-gray-400 hover:text-red-600"
                                        title="Delete Recipe"
                                    >
                                        <span className="sr-only">Delete</span>
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
