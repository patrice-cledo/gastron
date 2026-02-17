import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { UserRecipe, RecipeIngredient, RecipeStep, RecipeNutrition, RecipeDraft } from '@backend/types';
import { useRecipeImport } from '../hooks/useRecipeImport';

// Helper to generate simple IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

const CUISINES = [
    'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'French', 'Thai',
    'Mediterranean', 'American', 'Korean', 'Vietnamese', 'Greek', 'Spanish',
    'Middle Eastern', 'Caribbean', 'Other'
];

const TAG_CATEGORIES = {
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

interface RecipeFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialRecipe?: UserRecipe & { id: string };
}

export function RecipeForm({ onSuccess, onCancel, initialRecipe }: RecipeFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { importFromUrl, importFromPhoto, loading: importLoading, progress, error: importError } = useRecipeImport();

    const [showUrlInput, setShowUrlInput] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [prepTime, setPrepTime] = useState<number | ''>('');
    const [cookTime, setCookTime] = useState<number | ''>('');
    const [servings, setServings] = useState<number | ''>('');
    const [isPublic, setIsPublic] = useState(true);

    // Categorization State
    const [cuisine, setCuisine] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTagInput, setCustomTagInput] = useState('');

    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
        { id: generateId(), name: '', amount: '', unit: '' }
    ]);

    const [steps, setSteps] = useState<RecipeStep[]>([
        { id: generateId(), order: 1, description: '' }
    ]);

    const [nutrition, setNutrition] = useState<RecipeNutrition>({
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0
    });

    // Section Visibility State
    const [expandedSections, setExpandedSections] = useState({
        basic: true,
        categorization: true,
        ingredients: true,
        instructions: true,
        nutrition: true
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ title, section, className = "" }: { title: string, section: keyof typeof expandedSections, className?: string }) => (
        <button
            type="button"
            onClick={() => toggleSection(section)}
            className={`flex items-center justify-between w-full text-left bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
        >
            <span className="text-lg font-medium text-gray-900">{title}</span>
            <svg
                className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${expandedSections[section] ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    );

    useEffect(() => {
        if (initialRecipe) {
            setTitle(initialRecipe.title);
            setDescription(initialRecipe.description || '');
            setImage(initialRecipe.image || '');
            setSourceUrl(initialRecipe.sourceUrls?.[0] || '');
            setPrepTime(initialRecipe.prepTime || '');
            setCookTime(initialRecipe.cookTime || '');
            setServings(initialRecipe.servings || '');
            setIsPublic(initialRecipe.isPublic ?? true);

            // Populate categorization
            setCuisine(initialRecipe.cuisine || '');
            setSelectedTags(initialRecipe.tags || []);

            if (initialRecipe.ingredients?.length) {
                setIngredients(initialRecipe.ingredients);
            }
            if (initialRecipe.steps?.length) {
                setSteps(initialRecipe.steps);
            }
            if (initialRecipe.nutrition) {
                setNutrition(initialRecipe.nutrition);
            }
        }
    }, [initialRecipe]);

    const populateFromDraft = (draft: RecipeDraft) => {
        setTitle(draft.title);
        setDescription(draft.description || '');
        setImage(draft.imageUrl || '');
        setSourceUrl(draft.sourceUrl || '');
        setPrepTime(draft.prepMinutes || '');
        setCookTime(draft.cookMinutes || '');
        setServings(draft.servings || '');

        if (draft.tags) setSelectedTags(draft.tags);
        if ((draft as any).cuisine) setCuisine((draft as any).cuisine);

        if (draft.ingredients && draft.ingredients.length > 0) {
            setIngredients(draft.ingredients.map(ing => ({
                id: generateId(),
                name: ing.name || ing.raw,
                amount: ing.quantity ? String(ing.quantity) : '',
                unit: ing.unit || ''
            })));
        }

        if (draft.instructions && draft.instructions.length > 0) {
            setSteps(draft.instructions.map(inst => ({
                id: generateId(),
                order: inst.step,
                description: inst.text
            })));
        }

        if (draft.nutrition) {
            setNutrition({
                calories: draft.nutrition.calories || 0,
                protein: draft.nutrition.protein || 0,
                carbs: draft.nutrition.carbs || 0,
                fats: draft.nutrition.fats || 0
            });
        }
    };

    const handleUrlImport = async () => {
        if (!importUrl) return;
        try {
            const draft = await importFromUrl(importUrl);
            populateFromDraft(draft);
            setShowUrlInput(false);
            setImportUrl('');
        } catch (e) {
            // Error handled by hook
        }
    };

    const handlePhotoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const draft = await importFromPhoto(file);
            populateFromDraft(draft);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (e) {
            // Error handled by hook
        }
    };

    const handleAddIngredient = () => {
        setIngredients([...ingredients, { id: generateId(), name: '', amount: '', unit: '' }]);
    };

    const handleRemoveIngredient = (id: string) => {
        setIngredients(ingredients.filter(i => i.id !== id));
    };

    const handleIngredientChange = (id: string, field: keyof RecipeIngredient, value: string) => {
        setIngredients(ingredients.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleAddStep = () => {
        setSteps([...steps, { id: generateId(), order: steps.length + 1, description: '' }]);
    };

    const handleRemoveStep = (id: string) => {
        setSteps(steps.filter(s => s.id !== id));
    };

    const handleStepChange = (id: string, value: string) => {
        setSteps(steps.map(s => s.id === id ? { ...s, description: value } : s));
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const handleAddCustomTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && customTagInput.trim()) {
            e.preventDefault();
            const newTag = customTagInput.trim();
            if (!selectedTags.includes(newTag)) {
                setSelectedTags([...selectedTags, newTag]);
            }
            setCustomTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!auth.currentUser) throw new Error('Not authenticated');
            if (!title) throw new Error('Title is required');

            // Filter out empty ingredients/steps
            const validIngredients = ingredients.filter(i => i.name.trim());
            const validSteps = steps.filter(s => s.description.trim()).map((s, idx) => ({ ...s, order: idx + 1 }));

            if (validIngredients.length === 0) throw new Error('At least one ingredient is required');
            if (validSteps.length === 0) throw new Error('At least one step is required');

            const recipeData: Omit<UserRecipe, 'id'> = {
                userId: initialRecipe?.userId || auth.currentUser.uid,
                title,
                description,
                image,
                sourceUrls: sourceUrl ? [sourceUrl] : [],
                prepTime: Number(prepTime) || 0,
                cookTime: Number(cookTime) || 0,
                servings: Number(servings) || 0,
                isPublic,
                ingredients: validIngredients,
                steps: validSteps,
                nutrition,
                cuisine,
                tags: selectedTags,
                createdAt: initialRecipe?.createdAt || Date.now(),
                updatedAt: Date.now(),
            };

            if (initialRecipe) {
                await updateDoc(doc(db, 'recipes', initialRecipe.id), recipeData);
            } else {
                await addDoc(collection(db, 'recipes'), recipeData);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Import Toolbar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <span className="text-sm font-medium text-gray-700">Import from:</span>

                <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    disabled={importLoading}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    🔗 URL
                </button>

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importLoading}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    📸 Photo
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoImport}
                    accept="image/*"
                    className="hidden"
                />

                {importLoading && (
                    <span className="text-sm text-primary animate-pulse ml-2">
                        {progress || 'Processing...'}
                    </span>
                )}

                {importError && (
                    <span className="text-sm text-red-600 ml-2">
                        Error: {importError}
                    </span>
                )}
            </div>

            {showUrlInput && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex gap-2">
                    <input
                        type="url"
                        placeholder="Paste recipe URL here..."
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                    <button
                        type="button"
                        onClick={handleUrlImport}
                        disabled={importLoading || !importUrl}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        Import
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-xl font-semibold text-gray-900">{initialRecipe ? 'Edit Recipe' : 'Create New Recipe'}</h2>
                    <div className="space-x-2">
                        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                            {loading ? 'Saving...' : (initialRecipe ? 'Save Changes' : 'Create Recipe')}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                {/* Section 1: Basic Details */}
                <div>
                    <SectionHeader title="Basic Details" section="basic" />
                    {expandedSections.basic && (
                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6 mt-4 px-1">
                            {/* Basic Info */}
                            <div className="sm:col-span-4">
                                <label className="block text-sm font-medium text-gray-700">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Image URL</label>
                                <input
                                    type="text"
                                    value={image}
                                    onChange={e => setImage(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-6">
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Prep Time (mins)</label>
                                <input
                                    type="number"
                                    value={prepTime}
                                    onChange={e => setPrepTime(e.target.value ? Number(e.target.value) : '')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Cook Time (mins)</label>
                                <input
                                    type="number"
                                    value={cookTime}
                                    onChange={e => setCookTime(e.target.value ? Number(e.target.value) : '')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Servings</label>
                                <input
                                    type="number"
                                    value={servings}
                                    onChange={e => setServings(e.target.value ? Number(e.target.value) : '')}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-3">
                                <label className="block text-sm font-medium text-gray-700">Source URL</label>
                                <input
                                    type="text"
                                    value={sourceUrl}
                                    onChange={e => setSourceUrl(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>

                            <div className="sm:col-span-3">
                                <label className="block text-sm font-medium text-gray-700">Cuisine</label>
                                <select
                                    value={cuisine}
                                    onChange={e => setCuisine(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">Select Cuisine</option>
                                    {CUISINES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-6">
                                <div className="flex items-center">
                                    <input
                                        id="is-public"
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={e => setIsPublic(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="is-public" className="ml-2 block text-sm text-gray-900">
                                        Public Recipe (visible to all users)
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 2: Categorization */}
                <div>
                    <SectionHeader title="Categorization" section="categorization" />
                    {expandedSections.categorization && (
                        <div className="mt-4 px-1 space-y-4">
                            {/* Active Tags & Custom Input */}
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {selectedTags.map(tag => (
                                        <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => removeTag(tag)}
                                                className="ml-1.5 inline-flex items-center justify-center text-primary hover:text-primary-dark"
                                            >
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customTagInput}
                                        onChange={e => setCustomTagInput(e.target.value)}
                                        onKeyDown={handleAddCustomTag}
                                        placeholder="Type tag and press Enter..."
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (customTagInput.trim()) {
                                                if (!selectedTags.includes(customTagInput.trim())) {
                                                    setSelectedTags([...selectedTags, customTagInput.trim()]);
                                                }
                                                setCustomTagInput('');
                                            }
                                        }}
                                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Predefined Categories */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-lg">
                                {/* Meal Type */}
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Meal Type</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {TAG_CATEGORIES['Meal Type'].map(tag => (
                                            <label key={tag} className="flex items-center space-x-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTags.includes(tag)}
                                                    onChange={() => toggleTag(tag)}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span>{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Diet */}
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dietary</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {TAG_CATEGORIES['Diet'].map(tag => (
                                            <label key={tag} className="flex items-center space-x-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTags.includes(tag)}
                                                    onChange={() => toggleTag(tag)}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span>{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Other Tags */}
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Other Tags</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {TAG_CATEGORIES['Other'].map(tag => (
                                            <label key={tag} className="flex items-center space-x-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTags.includes(tag)}
                                                    onChange={() => toggleTag(tag)}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <span>{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 3: Ingredients */}
                <div>
                    <SectionHeader title="Ingredients" section="ingredients" />
                    {expandedSections.ingredients && (
                        <div className="mt-4 px-1">
                            {ingredients.map((ing) => (
                                <div key={ing.id} className="flex gap-2 mb-2 items-start">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Amount"
                                        value={ing.amount}
                                        onChange={e => handleIngredientChange(ing.id, 'amount', e.target.value)}
                                        className="w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Unit"
                                        value={ing.unit || ''}
                                        onChange={e => handleIngredientChange(ing.id, 'unit', e.target.value)}
                                        className="w-24 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ingredient Name"
                                        value={ing.name}
                                        onChange={e => handleIngredientChange(ing.id, 'name', e.target.value)}
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    {ingredients.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveIngredient(ing.id)}
                                            className="p-2 text-red-600 hover:text-red-800"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddIngredient}
                                className="mt-2 text-sm text-primary hover:text-primary-dark font-medium"
                            >
                                + Add Ingredient
                            </button>
                        </div>
                    )}
                </div>

                {/* Section 4: Instructions */}
                <div>
                    <SectionHeader title="Instructions" section="instructions" />
                    {expandedSections.instructions && (
                        <div className="mt-4 px-1">
                            {steps.map((step, index) => (
                                <div key={step.id} className="flex gap-2 mb-2 items-start">
                                    <span className="mt-2 text-sm text-gray-500 w-6 text-right">{index + 1}.</span>
                                    <textarea
                                        required
                                        rows={2}
                                        placeholder="Describe this step..."
                                        value={step.description}
                                        onChange={e => handleStepChange(step.id, e.target.value)}
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    {steps.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStep(step.id)}
                                            className="p-2 text-red-600 hover:text-red-800"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddStep}
                                className="mt-2 text-sm text-primary hover:text-primary-dark font-medium"
                            >
                                + Add Step
                            </button>
                        </div>
                    )}
                </div>

                {/* Section 5: Nutrition */}
                <div>
                    <SectionHeader title="Nutrition (per serving)" section="nutrition" />
                    {expandedSections.nutrition && (
                        <div className="mt-4 px-1 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Calories</label>
                                <input
                                    type="number"
                                    value={nutrition.calories}
                                    onChange={e => setNutrition({ ...nutrition, calories: Number(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Protein (g)</label>
                                <input
                                    type="number"
                                    value={nutrition.protein}
                                    onChange={e => setNutrition({ ...nutrition, protein: Number(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Carbs (g)</label>
                                <input
                                    type="number"
                                    value={nutrition.carbs}
                                    onChange={e => setNutrition({ ...nutrition, carbs: Number(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fats (g)</label>
                                <input
                                    type="number"
                                    value={nutrition.fats}
                                    onChange={e => setNutrition({ ...nutrition, fats: Number(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}
