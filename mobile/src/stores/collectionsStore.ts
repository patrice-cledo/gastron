import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface CollectionsState {
  collections: string[];
  isLoading: boolean;
  loadCollections: () => Promise<void>;
  addCollection: (collectionName: string) => Promise<void>;
  removeCollection: (collectionName: string) => Promise<void>;
}

const DEFAULT_COLLECTIONS = ['Favorites', 'Want to cook'];

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: DEFAULT_COLLECTIONS,
      isLoading: false,

      loadCollections: async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn('Cannot load collections: user not authenticated');
          set({ collections: DEFAULT_COLLECTIONS });
          return;
        }

        set({ isLoading: true });
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const savedCollections = userData.collections;
            
            if (Array.isArray(savedCollections) && savedCollections.length > 0) {
              // Merge with defaults, avoiding duplicates
              const merged = [...DEFAULT_COLLECTIONS];
              savedCollections.forEach((col: string) => {
                if (!merged.includes(col)) {
                  merged.push(col);
                }
              });
              set({ collections: merged });
            } else {
              set({ collections: DEFAULT_COLLECTIONS });
            }
          } else {
            // User document doesn't exist, create it with default collections
            await setDoc(userDocRef, {
              userId: currentUser.uid,
              collections: [],
              createdAt: new Date(),
            });
            set({ collections: DEFAULT_COLLECTIONS });
          }
        } catch (error) {
          console.error('Error loading collections:', error);
          set({ collections: DEFAULT_COLLECTIONS });
        } finally {
          set({ isLoading: false });
        }
      },

      addCollection: async (collectionName: string) => {
        const trimmedName = collectionName.trim();
        if (!trimmedName) return;

        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn('Cannot add collection: user not authenticated');
          return;
        }

        const currentCollections = get().collections;
        if (currentCollections.includes(trimmedName)) {
          return; // Already exists
        }

        const newCollections = [...currentCollections, trimmedName];
        set({ collections: newCollections });

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          // Get user-created collections (exclude defaults)
          const userCreatedCollections = newCollections.filter(
            col => !DEFAULT_COLLECTIONS.includes(col)
          );
          
          await setDoc(
            userDocRef,
            {
              collections: userCreatedCollections,
            },
            { merge: true }
          );
        } catch (error) {
          console.error('Error saving collection:', error);
          // Revert on error
          set({ collections: currentCollections });
        }
      },

      removeCollection: async (collectionName: string) => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn('Cannot remove collection: user not authenticated');
          return;
        }

        // Don't allow removing default collections
        if (DEFAULT_COLLECTIONS.includes(collectionName)) {
          return;
        }

        const currentCollections = get().collections;
        const newCollections = currentCollections.filter(col => col !== collectionName);
        set({ collections: newCollections });

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          // Get user-created collections (exclude defaults)
          const userCreatedCollections = newCollections.filter(
            col => !DEFAULT_COLLECTIONS.includes(col)
          );
          
          await setDoc(
            userDocRef,
            {
              collections: userCreatedCollections,
            },
            { merge: true }
          );
        } catch (error) {
          console.error('Error removing collection:', error);
          // Revert on error
          set({ collections: currentCollections });
        }
      },
    }),
    {
      name: 'collections-storage',
      partialize: (state) => ({ collections: state.collections }),
    }
  )
);

// Initialize collections when auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    useCollectionsStore.getState().loadCollections();
  } else {
    useCollectionsStore.setState({ collections: DEFAULT_COLLECTIONS });
  }
});
