import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { UserRecipe } from '@backend/types';

interface Challenge {
    id: string;
    title: string;
    description: string;
    participants: number;
    profileEmoji: string;
    backgroundColor: string;
    recipeCount: number;
    coverImage?: string;
    recipeIds?: string[];
}

export function Challenges() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [allRecipes, setAllRecipes] = useState<UserRecipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState<Omit<Challenge, 'id' | 'participants'>>({
        title: '',
        description: '',
        profileEmoji: '👨‍🍳',
        backgroundColor: '#FFE5E5',
        recipeCount: 0,
        coverImage: '',
        recipeIds: []
    });

    const fetchData = async () => {
        try {
            const [challengesSnapshot, recipesSnapshot] = await Promise.all([
                getDocs(collection(db, 'challenges')),
                // Only fetch public recipes to avoid permission errors and logically correct behavior
                getDocs(query(collection(db, 'recipes'), where('isPublic', '==', true)))
            ]);

            const fetchedChallenges = challengesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Challenge[];
            setChallenges(fetchedChallenges);

            const fetchedRecipes = recipesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserRecipe[];
            setAllRecipes(fetchedRecipes);

        } catch (error) {
            console.error("Error fetching data: ", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const storageRef = ref(storage, `challenges/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            setFormData(prev => ({ ...prev, coverImage: downloadURL }));
        } catch (error) {
            console.error("Error uploading image: ", error);
            alert("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    const toggleRecipeSelection = (recipeId: string) => {
        setFormData(prev => {
            const currentIds = prev.recipeIds || [];
            if (currentIds.includes(recipeId)) {
                return { ...prev, recipeIds: currentIds.filter(id => id !== recipeId) };
            } else {
                return { ...prev, recipeIds: [...currentIds, recipeId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Recipe count is strictly based on assigned recipes
            const recipeCount = formData.recipeIds?.length || 0;

            const dataToSave = {
                ...formData,
                recipeCount
            };

            if (isEditing) {
                await updateDoc(doc(db, 'challenges', isEditing), dataToSave);
                setIsEditing(null);
            } else {
                await addDoc(collection(db, 'challenges'), {
                    ...dataToSave,
                    participants: 0 // Default start
                });
            }

            // Reset form
            setFormData({
                title: '',
                description: '',
                profileEmoji: '👨‍🍳',
                backgroundColor: '#FFE5E5',
                recipeCount: 0,
                coverImage: '',
                recipeIds: []
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchData();
        } catch (error) {
            console.error("Error saving challenge: ", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this challenge?')) {
            try {
                await deleteDoc(doc(db, 'challenges', id));
                fetchData();
            } catch (error) {
                console.error("Error deleting challenge: ", error);
            }
        }
    };

    const handleEdit = (challenge: Challenge) => {
        setIsEditing(challenge.id);
        setFormData({
            title: challenge.title,
            description: challenge.description,
            profileEmoji: challenge.profileEmoji,
            backgroundColor: challenge.backgroundColor,
            recipeCount: challenge.recipeCount || 0,
            coverImage: challenge.coverImage || '',
            recipeIds: challenge.recipeIds || []
        });
    };

    const handleCancel = () => {
        setIsEditing(null);
        setFormData({
            title: '',
            description: '',
            profileEmoji: '👨‍🍳',
            backgroundColor: '#FFE5E5',
            recipeCount: 0,
            coverImage: '',
            recipeIds: []
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Challenges</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-6">
                        <h2 className="text-lg font-semibold mb-4">{isEditing ? 'Edit Challenge' : 'Create Challenge'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isEditing && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cover Image</label>
                                    <div className="mt-1 flex items-center gap-4">
                                        {formData.coverImage && (
                                            <img
                                                src={formData.coverImage}
                                                alt="Cover"
                                                className="w-16 h-16 object-cover rounded-lg"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {uploading ? 'Uploading...' : 'Upload Image'}
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                                    placeholder="e.g. Spice Master"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    required
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                                    rows={3}
                                    placeholder="Challenge description..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Emoji</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.profileEmoji}
                                        onChange={e => setFormData({ ...formData, profileEmoji: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                                        placeholder="👨‍🍳"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Recipes Count</label>
                                    <div className="mt-1 py-2 px-3 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-500">
                                        {formData.recipeIds?.length || 0} (Auto-calculated)
                                    </div>
                                </div>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700">Background Color</label>
                                <div className="flex gap-2 mt-1">
                                    {['#FFE5E5', '#B8E6D3', '#E5E5FF', '#FFF4E5'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, backgroundColor: color })}
                                            className={`w-8 h-8 rounded-full border-2 ${formData.backgroundColor === color ? 'border-gray-900' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.backgroundColor}
                                        onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })}
                                        className="h-8 w-8 p-0 border-0 rounded overflow-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Recipes</label>
                                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-gray-50 p-2 space-y-1">
                                    {allRecipes.map(recipe => (
                                        <div
                                            key={recipe.id}
                                            onClick={() => toggleRecipeSelection(recipe.id)}
                                            className={`flex items-center p-2 rounded cursor-pointer hover:bg-white transition-colors ${formData.recipeIds?.includes(recipe.id) ? 'bg-white border-l-4 border-primary shadow-sm' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.recipeIds?.includes(recipe.id) || false}
                                                onChange={() => { }} // Handled by div click
                                                className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {recipe.title}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Selected: {formData.recipeIds?.length || 0} recipes
                                </p>
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {isEditing ? 'Update' : 'Create'}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading...</div>
                    ) : challenges.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                            <p className="text-gray-500">No challenges found. Create one to get started!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {challenges.map(challenge => (
                                <div
                                    key={challenge.id}
                                    className="rounded-xl p-4 relative group"
                                    style={{ backgroundColor: challenge.backgroundColor }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl overflow-hidden">
                                            {challenge.profileEmoji}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(challenge)}
                                                className="p-1.5 bg-white/50 hover:bg-white rounded-full transition-colors text-gray-700"
                                                title="Edit"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(challenge.id)}
                                                className="p-1.5 bg-white/50 hover:bg-white rounded-full transition-colors text-red-600"
                                                title="Delete"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {challenge.coverImage && (
                                        <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                                            <img src={challenge.coverImage} alt={challenge.title} className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <h3 className="font-bold text-gray-900 mb-1">{challenge.title}</h3>
                                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">{challenge.description}</p>

                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                            {challenge.participants.toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                                            {challenge.recipeCount} Recipes
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
