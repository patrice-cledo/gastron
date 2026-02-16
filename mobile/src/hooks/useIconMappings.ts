import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { create } from 'zustand';

interface IconMapping {
    id: string; // ingredient name
    iconName: string;
    updatedAt: number;
}

interface IconMappingsStore {
    mappings: Record<string, string>; // ingredientName -> iconName
    setMappings: (mappings: Record<string, string>) => void;
}

// Global store to share mappings across components without re-fetching
export const useIconMappingsStore = create<IconMappingsStore>((set) => ({
    mappings: {},
    setMappings: (mappings) => set({ mappings }),
}));

export function useIconMappings() {
    const { mappings, setMappings } = useIconMappingsStore();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Wait for auth to be ready
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in, subscribe to icon mappings
                const q = query(collection(db, 'iconMappings'));
                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const newMappings: Record<string, string> = {};
                    snapshot.docs.forEach(doc => {
                        const data = doc.data() as IconMapping;
                        newMappings[doc.id] = data.iconName;
                    });
                    setMappings(newMappings);
                    setLoading(false);
                }, (error) => {
                    console.error('Error fetching icon mappings:', error);
                    setLoading(false);
                });

                // Cleanup snapshot listener when user signs out or component unmounts
                return () => unsubscribeSnapshot();
            } else {
                // User is signed out, clear mappings? Or keep cached?
                // For now, let's just not fetch.
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, [setMappings]);

    return { mappings, loading };
}
