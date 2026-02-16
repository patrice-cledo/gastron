import { useState } from 'react';
import { writeBatch, doc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { UserRecipe, RecipeDraft } from '@backend/types';
import { useRecipeImport } from '../hooks/useRecipeImport';

type ImportMode = 'json' | 'urls';

export function BulkRecipeImport({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
    const [mode, setMode] = useState<ImportMode>('json');
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<'idle' | 'validating' | 'importing' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [parsedRecipes, setParsedRecipes] = useState<Omit<UserRecipe, 'id'>[]>([]);

    // URL Import State
    const [urlList, setUrlList] = useState<string[]>([]);
    const [processedCount, setProcessedCount] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);

    // We reuse the hook just for types/logic reference, but implement bulk loop here
    const { importFromUrl } = useRecipeImport();

    const handleValidateJson = () => {
        setStatus('validating');
        setMessage('');
        try {
            const data = JSON.parse(input);
            if (!Array.isArray(data)) throw new Error('Input must be a JSON array');

            const validRecipes: Omit<UserRecipe, 'id'>[] = data.map((item: any, index: number) => {
                if (!item.title) throw new Error(`Item at index ${index} is missing title`);
                if (!item.ingredients || !Array.isArray(item.ingredients)) throw new Error(`Item at index ${index} is missing ingredients array`);
                if (!item.steps || !Array.isArray(item.steps)) throw new Error(`Item at index ${index} is missing steps array`);

                // Basic transformation/sanitization could happen here
                return {
                    userId: auth.currentUser?.uid || 'admin',
                    title: item.title,
                    description: item.description || '',
                    image: item.image || '',
                    sourceUrls: item.sourceUrl ? [item.sourceUrl] : (item.sourceUrls || []),
                    prepTime: Number(item.prepTime) || 0,
                    cookTime: Number(item.cookTime) || 0,
                    servings: Number(item.servings) || 0,
                    isPublic: item.isPublic !== false, // Default to true
                    ingredients: item.ingredients.map((ing: any) => ({
                        id: Math.random().toString(36).substring(2, 9),
                        name: ing.name || 'Unknown',
                        amount: String(ing.amount || ''),
                        unit: ing.unit || ''
                    })),
                    steps: item.steps.map((step: any, i: number) => ({
                        id: Math.random().toString(36).substring(2, 9),
                        order: i + 1,
                        description: typeof step === 'string' ? step : (step.description || '')
                    })),
                    nutrition: {
                        calories: Number(item.nutrition?.calories) || 0,
                        protein: Number(item.nutrition?.protein) || 0,
                        carbs: Number(item.nutrition?.carbs) || 0,
                        fats: Number(item.nutrition?.fats) || 0,
                    },
                    tags: Array.isArray(item.tags) ? item.tags : [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
            });

            setParsedRecipes(validRecipes);
            setStatus('idle');
            setMessage(`Successfully validated ${validRecipes.length} recipes. Ready to import.`);
        } catch (e: any) {
            setStatus('error');
            setMessage(e.message);
        }
    };

    const handleImportJson = async () => {
        if (parsedRecipes.length === 0) return;
        setStatus('importing');

        try {
            // Process in chunks of 400 (Firestore batch limit is 500)
            const chunkSize = 400;
            for (let i = 0; i < parsedRecipes.length; i += chunkSize) {
                const batch = writeBatch(db);
                const chunk = parsedRecipes.slice(i, i + chunkSize);

                chunk.forEach(recipe => {
                    const docRef = doc(collection(db, 'recipes'));
                    batch.set(docRef, recipe);
                });

                await batch.commit();
            }

            setStatus('success');
            setMessage(`Successfully imported ${parsedRecipes.length} recipes!`);
            setTimeout(onSuccess, 1500);
        } catch (e: any) {
            setStatus('error');
            setMessage(`Import failed: ${e.message}`);
        }
    };

    const handleValidateUrls = () => {
        const urls = input.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) {
            setStatus('error');
            setMessage('No URLs found');
            return;
        }
        setUrlList(urls);
        setMessage(`Found ${urls.length} URLs. Ready to process.`);
        setStatus('idle');
    };

    const convertDraftToRecipe = (draft: RecipeDraft): Omit<UserRecipe, 'id'> => {
        return {
            userId: auth.currentUser?.uid || 'admin',
            title: draft.title || 'Untitled Recipe',
            description: draft.description || '',
            image: draft.imageUrl || '',
            sourceUrls: draft.sourceUrl ? [draft.sourceUrl] : [],
            prepTime: draft.prepMinutes || 0,
            cookTime: draft.cookMinutes || 0,
            servings: draft.servings || 0,
            isPublic: true,
            ingredients: (draft.ingredients || []).map(ing => ({
                id: Math.random().toString(36).substring(2, 9),
                name: ing.name || ing.raw || 'Unknown',
                amount: ing.quantity ? String(ing.quantity) : '',
                unit: ing.unit || ''
            })),
            steps: (draft.instructions || []).map(inst => ({
                id: Math.random().toString(36).substring(2, 9),
                order: inst.step,
                description: inst.text
            })),
            nutrition: {
                calories: draft.nutrition?.calories || 0,
                protein: draft.nutrition?.protein || 0,
                carbs: draft.nutrition?.carbs || 0,
                fats: draft.nutrition?.fats || 0,
            },
            tags: draft.tags || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    };

    const handleImportUrls = async () => {
        if (urlList.length === 0) return;
        setStatus('importing');
        setProcessedCount(0);
        setSuccessCount(0);
        setFailedCount(0);

        // Process sequentially to be safe, or concurrent with limit? 
        // Let's do batch of 3 at a time to be faster but not overwhelm
        const CONCURRENT_LIMIT = 3;

        for (let i = 0; i < urlList.length; i += CONCURRENT_LIMIT) {
            const batchUrls = urlList.slice(i, i + CONCURRENT_LIMIT);
            const batchPromises = batchUrls.map(async (url) => {
                try {
                    const draft = await importFromUrl(url);
                    const recipe = convertDraftToRecipe(draft);
                    await addDoc(collection(db, 'recipes'), recipe);
                    setSuccessCount(prev => prev + 1);
                    return { status: 'success', url };
                } catch (err) {
                    setFailedCount(prev => prev + 1);
                    return { status: 'failed', url, error: err };
                } finally {
                    setProcessedCount(prev => prev + 1);
                }
            });
            await Promise.all(batchPromises);
        }

        setStatus('success');
        setMessage(`Finished processing. Success: ${successCount}, Failed: ${failedCount}`);
        // Don't auto-close, let user see stats
    };

    return (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-xl font-semibold text-gray-900">Bulk Import Recipes</h2>
                <div className="space-x-2">
                    <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`px-4 py-2 text-sm font-medium ${mode === 'json' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setMode('json'); setInput(''); setStatus('idle'); setMessage(''); }}
                >
                    JSON Import
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium ${mode === 'urls' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setMode('urls'); setInput(''); setStatus('idle'); setMessage(''); }}
                >
                    URL List Import
                </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-700">
                {mode === 'json' ? (
                    <p>Paste a JSON array of recipe objects. Minimum required fields: <code>title</code>, <code>ingredients[]</code>, <code>steps[]</code>.</p>
                ) : (
                    <p>Paste a list of recipe URLs, one per line. These will be scraped and imported individually.</p>
                )}
            </div>

            <div>
                <textarea
                    className="w-full h-64 p-2 font-mono text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder={mode === 'json' ? '[{"title": "Recipe 1", ...}, ...]' : 'https://example.com/recipe1\nhttps://example.com/recipe2'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={status === 'importing'}
                />
            </div>

            {status === 'importing' && mode === 'urls' && (
                <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(processedCount / urlList.length) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-sm text-gray-600 text-center">
                        Processed {processedCount} / {urlList.length} (Success: {successCount}, Failed: {failedCount})
                    </p>
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-md ${status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {message}
                </div>
            )}

            <div className="flex justify-end space-x-3">
                <button
                    onClick={() => {
                        if (mode === 'json') handleValidateJson();
                        else handleValidateUrls();
                    }}
                    disabled={!input.trim() || status === 'importing'}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                >
                    {mode === 'json' ? 'Validate JSON' : 'Validate URLs'}
                </button>

                {(mode === 'json' && parsedRecipes.length > 0) || (mode === 'urls' && urlList.length > 0 && status !== 'importing') ? (
                    <button
                        onClick={() => {
                            if (mode === 'json') handleImportJson();
                            else handleImportUrls();
                        }}
                        disabled={status === 'importing'}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                        {status === 'importing'
                            ? 'Default Importing...'
                            : `Import ${mode === 'json' ? parsedRecipes.length : urlList.length} Recipes`}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
