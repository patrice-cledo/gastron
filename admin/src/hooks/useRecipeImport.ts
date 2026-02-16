import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { functions, db, storage, auth } from '../firebase';
import type { ImportJob, RecipeDraft } from '@backend/types';

export interface ImportResult {
    draft: RecipeDraft;
    importJob: ImportJob;
}

export function useRecipeImport() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const monitorImport = (importId: string): Promise<ImportResult> => {
        return new Promise((resolve, reject) => {
            const unsubscribe = onSnapshot(doc(db, 'imports', importId), async (snapshot) => {
                const job = snapshot.data() as ImportJob | undefined;

                if (!job) return;

                console.log('Import job update:', job.status);

                if (job.status === 'failed') {
                    unsubscribe();
                    reject(new Error(job.errorMessage || 'Import failed'));
                    return;
                }

                if (job.status === 'queued') setProgress('Queued...');
                if (job.status === 'fetching') setProgress('Fetching content...');
                if (job.status === 'extracting') setProgress('Extracting recipe data...');
                if (job.status === 'ocr') setProgress('Reading text from image...');

                if (job.status === 'ready' && job.result?.recipeDraftId) {
                    unsubscribe();
                    setProgress('Finalizing...');

                    try {
                        const draftSnap = await getDoc(doc(db, 'recipeDrafts', job.result.recipeDraftId));
                        if (!draftSnap.exists()) {
                            reject(new Error('Draft not found'));
                            return;
                        }
                        resolve({
                            draft: draftSnap.data() as RecipeDraft,
                            importJob: job
                        });
                    } catch (err) {
                        reject(err);
                    }
                }
            }, (err) => {
                unsubscribe();
                reject(err);
            });
        });
    };

    const importFromUrl = async (url: string) => {
        setLoading(true);
        setError(null);
        setProgress('Starting import...');

        try {
            const startImport = httpsCallable(functions, 'startRecipeImport');
            const result = await startImport({ url });
            const { importId } = result.data as { importId: string };

            const data = await monitorImport(importId);
            return data.draft;
        } catch (err: any) {
            console.error('Import error:', err);
            setError(err.message || 'Failed to import recipe');
            throw err;
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    const importFromPhoto = async (file: File) => {
        setLoading(true);
        setError(null);
        setProgress('Uploading image...');

        try {
            if (!auth.currentUser) throw new Error('Must be logged in');

            // 1. Upload image
            const importId = doc(db, 'imports', 'placeholder').id; // Generate ID
            const storagePath = `imports/${auth.currentUser.uid}/${importId}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);

            // 2. Start Cloud Function
            setProgress('Starting analysis...');
            const startImport = httpsCallable(functions, 'startPhotoImport');
            const result = await startImport({ storagePath });
            const { importId: realImportId } = result.data as { importId: string };

            // 3. Monitor progress
            const data = await monitorImport(realImportId);
            return data.draft;
        } catch (err: any) {
            console.error('Photo import error:', err);
            setError(err.message || 'Failed to import photo');
            throw err;
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    return {
        importFromUrl,
        importFromPhoto,
        loading,
        error,
        progress
    };
}
