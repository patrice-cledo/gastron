import { Link } from 'react-router-dom';

export function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Manage recipes, icon mapping, and recipe import sources.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/recipes"
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-primary/30 hover:shadow"
        >
          <h2 className="font-medium text-gray-900">Recipes</h2>
          <p className="mt-1 text-sm text-gray-500">Create and edit recipes</p>
        </Link>
        <Link
          to="/icon-mapping"
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-primary/30 hover:shadow"
        >
          <h2 className="font-medium text-gray-900">Icon mapping</h2>
          <p className="mt-1 text-sm text-gray-500">Map ingredients to sprite icons</p>
        </Link>
        <Link
          to="/recipe-sources"
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-primary/30 hover:shadow"
        >
          <h2 className="font-medium text-gray-900">Recipe sources</h2>
          <p className="mt-1 text-sm text-gray-500">Blocked and allowed domains for URL import</p>
        </Link>
      </div>
    </div>
  );
}
