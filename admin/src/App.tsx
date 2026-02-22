import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { Dashboard } from './pages/Dashboard';
import { Recipes } from './pages/Recipes';
import { IconMapping } from './pages/IconMapping';
import { RecipeSources } from './pages/RecipeSources';
import { Challenges } from './pages/Challenges';
import { Notifications } from './pages/Notifications';
import { Login } from './pages/Login';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-primary/15 text-primary' : 'text-gray-700 hover:bg-gray-100'
  }`;

function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSignOut = () => {
    signOut(auth);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-semibold text-gray-900">Gastrons Admin</h1>
        </div>
        <nav className="p-2 flex-1">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/recipes" className={navLinkClass}>
            Recipes
          </NavLink>
          <NavLink to="/icon-mapping" className={navLinkClass}>
            Icon mapping
          </NavLink>
          <NavLink to="/challenges" className={navLinkClass}>
            Challenges
          </NavLink>
          <NavLink to="/recipe-sources" className={navLinkClass}>
            Recipe sources
          </NavLink>
          <NavLink to="/notifications" className={navLinkClass}>
            Notifications
          </NavLink>
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="icon-mapping" element={<IconMapping />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="recipe-sources" element={<RecipeSources />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
