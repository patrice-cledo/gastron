import { useState } from 'react';
import { RecipeForm } from '../components/RecipeForm';
import { BulkRecipeImport } from '../components/BulkRecipeImport';
import { RecipeList } from '../components/RecipeList';
import type { UserRecipe } from '@backend/types';

export function Recipes() {
  const [view, setView] = useState<'list' | 'create' | 'bulk'>('list');
  const [editingRecipe, setEditingRecipe] = useState<(UserRecipe & { id: string }) | undefined>(undefined);

  const handleEdit = (recipe: UserRecipe & { id: string }) => {
    setEditingRecipe(recipe);
    setView('create');
  };

  const handleCreateCancel = () => {
    setEditingRecipe(undefined);
    setView('list');
  };

  const handleCreateSuccess = () => {
    setEditingRecipe(undefined);
    setView('list');
  };

  const handleCreateStart = () => {
    setEditingRecipe(undefined);
    setView('create');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recipes</h1>
          <p className="text-gray-600">Manage your recipe collection</p>
        </div>
        <div className="space-x-3">
          {view === 'list' && (
            <>
              <button
                onClick={() => setView('bulk')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Bulk Import
              </button>
              <button
                onClick={handleCreateStart}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90"
              >
                Create Recipe
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'create' && (
        <RecipeForm
          initialRecipe={editingRecipe}
          onSuccess={handleCreateSuccess}
          onCancel={handleCreateCancel}
        />
      )}

      {view === 'bulk' && (
        <BulkRecipeImport
          onSuccess={() => setView('list')}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'list' && (
        <RecipeList onEdit={handleEdit} />
      )}
    </div>
  );
}
