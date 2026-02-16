import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const CONFIG_COLLECTION = 'config';
const RECIPE_IMPORT_DOC = 'recipeImport';

export interface RecipeImportConfig {
  blockedDomains: string[];
  allowedDomains: string[];
  updatedAt: number;
}

function normalizeDomain(input: string): string {
  return input.toLowerCase().trim().replace(/^www\./, '');
}

function DomainList({
  title,
  description,
  domains,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string;
  description: string;
  domains: string[];
  onAdd: (domain: string) => void;
  onRemove: (domain: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const d = normalizeDomain(input);
    if (!d) return;
    if (domains.includes(d)) {
      setInput('');
      return;
    }
    onAdd(d);
    setInput('');
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Add
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {domains.length === 0 ? (
          <li className="text-sm text-gray-400">None</li>
        ) : (
          domains.map((d) => (
            <li key={d} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
              <span className="font-mono text-gray-800">{d}</span>
              <button
                type="button"
                onClick={() => onRemove(d)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function RecipeSources() {
  const [config, setConfig] = useState<RecipeImportConfig>({
    blockedDomains: [],
    allowedDomains: [],
    updatedAt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const configRef = doc(db, CONFIG_COLLECTION, RECIPE_IMPORT_DOC);

  useEffect(() => {
    getDoc(configRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            blockedDomains: data.blockedDomains ?? [],
            allowedDomains: data.allowedDomains ?? [],
            updatedAt: data.updatedAt ?? 0,
          });
        }
      })
      .catch((err) => {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load config' });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(configRef, {
        blockedDomains: config.blockedDomains,
        allowedDomains: config.allowedDomains,
        updatedAt: Date.now(),
      });
      setMessage({ type: 'success', text: 'Saved.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  const addBlocked = (domain: string) => {
    setConfig((prev) => ({
      ...prev,
      blockedDomains: [...prev.blockedDomains, domain].sort(),
    }));
  };

  const removeBlocked = (domain: string) => {
    setConfig((prev) => ({
      ...prev,
      blockedDomains: prev.blockedDomains.filter((d) => d !== domain),
    }));
  };

  const addAllowed = (domain: string) => {
    setConfig((prev) => ({
      ...prev,
      allowedDomains: [...prev.allowedDomains, domain].sort(),
    }));
  };

  const removeAllowed = (domain: string) => {
    setConfig((prev) => ({
      ...prev,
      allowedDomains: prev.allowedDomains.filter((d) => d !== domain),
    }));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Recipe sources</h1>
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recipe sources</h1>
          <p className="mt-1 text-gray-600">
            Manage which domains are blocked or allowed for recipe URL import. Blocked domains are always denied. If
            allowed list is set, only those domains can be imported.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {message && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <DomainList
          title="Blocked domains"
          description="URLs from these domains cannot be used for recipe import."
          domains={config.blockedDomains}
          onAdd={addBlocked}
          onRemove={removeBlocked}
          placeholder="e.g. example.com"
        />
        <DomainList
          title="Allowed domains (optional)"
          description="If any are set, only these domains can be imported. Leave empty to allow all (except blocked)."
          domains={config.allowedDomains}
          onAdd={addAllowed}
          onRemove={removeAllowed}
          placeholder="e.g. allrecipes.com"
        />
      </div>
    </div>
  );
}
