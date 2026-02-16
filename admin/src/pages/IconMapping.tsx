import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '@iconify/react';

interface IconMapping {
  id: string; // ingredient name
  iconName: string;
  updatedAt: number;
}



export function IconMapping() {
  const [mappings, setMappings] = useState<IconMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // New mapping form state
  const [ingredientName, setIngredientName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch mappings
  useEffect(() => {
    const q = query(collection(db, 'iconMappings'), orderBy(documentId()));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IconMapping[];
      setMappings(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Search icons from Iconify API
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(searchTerm)}&limit=50`);
      const data = await response.json();
      if (data.icons) {
        setSearchResults(data.icons);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to search icons');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!ingredientName.trim() || !selectedIcon) {
      setError('Please enter an ingredient name and select an icon');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Use ingredient name as document ID (normalized)
      const id = ingredientName.toLowerCase().trim();
      await setDoc(doc(db, 'iconMappings', id), {
        iconName: selectedIcon,
        updatedAt: Date.now()
      });

      // Reset form
      setIngredientName('');
      setSelectedIcon(null);
      setSearchTerm('');
      setSearchResults([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete mapping for "${id}"?`)) return;
    try {
      await deleteDoc(doc(db, 'iconMappings', id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLoadMapping = (m: IconMapping) => {
    setIngredientName(m.id);
    setSelectedIcon(m.iconName);
    // Pre-fill search with the icon provider prefix (e.g. "mdi" from "mdi:carrot") to help find alternatives
    const prefix = m.iconName.split(':')[0];
    if (prefix) setSearchTerm(prefix);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Icon Mappings</h1>
        <span className="text-sm text-gray-500">{mappings.length} mappings</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
        {/* Left: Mapping List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-gray-50 font-medium text-gray-700">Existing Mappings</div>
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : mappings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No mappings yet. Add one!</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {mappings.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 group">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-gray-600">
                      <Icon icon={m.iconName} width={20} height={20} />
                    </div>
                    <div className="flex-1 font-medium text-gray-900">{m.id}</div>
                    <div className="text-xs text-gray-400 font-mono hidden sm:block">{m.iconName}</div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleLoadMapping(m)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Add/Edit Form */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Input Form */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Add / Update Mapping</h2>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient Name</label>
              <input
                type="text"
                value={ingredientName}
                onChange={e => setIngredientName(e.target.value)}
                placeholder="e.g. carrot"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">This will be the ID used for lookups.</p>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded border border-gray-200">
              <div className="w-16 h-16 flex items-center justify-center bg-white rounded border border-gray-200">
                {selectedIcon ? (
                  <Icon icon={selectedIcon} width={32} height={32} className="text-gray-800" />
                ) : (
                  <span className="text-gray-300 text-2xl">?</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Selected Icon</div>
                <div className="text-xs font-mono text-gray-500">{selectedIcon || 'None selected'}</div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !ingredientName || !selectedIcon}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>

          {/* Icon Search */}
          <div className="bg-white flex-1 flex flex-col rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search icons (e.g. vegetables, fruit)..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={searching || !searchTerm}
                  className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {searchResults.map(iconName => (
                    <button
                      key={iconName}
                      onClick={() => setSelectedIcon(iconName)}
                      className={`
                                                aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded border transition-all
                                                ${selectedIcon === iconName
                          ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'}
                                            `}
                      title={iconName}
                    >
                      <Icon icon={iconName} width={24} height={24} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <span className="text-4xl mb-2">🔍</span>
                  <p>Search for icons to add to your collection</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
