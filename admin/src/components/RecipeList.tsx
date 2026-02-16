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

        // Query only recipes owned by the current user to satisfy security rules
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

    if (loading) return <div className="text-center p-8">Loading recipes...</div>;

    if (error) return (
        <div className="text-center text-red-600 p-8 border border-red-200 bg-red-50 rounded-lg mx-4">
            <h3 className="font-bold mb-2">Error Loading Recipes</h3>
            <p className="mb-4">{error}</p>
            {error.includes('index') && (
                <p className="text-sm text-gray-700">
                    See console for index creation link or check Firestore indexes.
                </p>
            )}
        </div>
    );

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200">
                {recipes.length === 0 && (
                    <li className="p-8 text-center text-gray-500">
                        No recipes found. Create one to get started!
                    </li>
                )}

                {recipes.map((recipe) => (
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
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>{recipe.ingredients?.length || 0} ingredients</span>
                                <span>•</span>
                                <span>{recipe.steps?.length || 0} steps</span>
                                <span>•</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${recipe.isPublic ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {recipe.isPublic ? 'Public' : 'Private'}
                                </span>
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
    );
}
