import { create } from 'zustand';
import { db, storage, functions, auth } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';

// Collection names (matching backend)
const COLLECTIONS = {
  imports: 'imports',
  recipeDrafts: 'recipeDrafts',
} as const;

export type ImportStatus = 'idle' | 'uploading' | 'queued' | 'ocr' | 'extracting' | 'ready' | 'failed';

interface PhotoImportState {
  currentImportId: string | null;
  status: ImportStatus;
  uploadProgress: number; // 0-100
  error: string | null;
  unsubscribe: Unsubscribe | null;
  
  // Actions
  startPhotoImport: (localUri: string) => Promise<void>;
  cancelImport: () => Promise<void>;
  subscribeToImport: (importId: string) => () => void;
  reset: () => void;
}

export const usePhotoImportStore = create<PhotoImportState>((set, get) => ({
  currentImportId: null,
  status: 'idle',
  uploadProgress: 0,
  error: null,
  unsubscribe: null,

  startPhotoImport: async (localUri: string) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      set({ status: 'uploading', uploadProgress: 0, error: null });

      // Generate unique import ID
      const importId = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = `imports/${user.uid}/${importId}.jpg`;

      // Fetch image as blob
      const response = await fetch(localUri);
      const blob = await response.blob();

      // Compress/resize image if needed (client-side preprocessing)
      // For MVP, we'll upload as-is, but could add compression here
      const MAX_DIMENSION = 2000;
      const imageUri = localUri; // Could process here

      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: 'image/jpeg',
      });

      // Track upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          set({ uploadProgress: progress });
        },
        (error) => {
          console.error('Upload error:', error);
          set({ 
            status: 'failed', 
            error: error.message || 'Failed to upload image',
            uploadProgress: 0 
          });
        },
        async () => {
          // Upload complete - wait a moment to ensure file is available
          try {
            // Small delay to ensure file is fully written to storage
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify file exists before calling function
            const downloadURL = await getDownloadURL(storageRef);
            console.log('✅ File uploaded successfully:', downloadURL);
            console.log('📤 Calling startPhotoImport with storagePath:', storagePath);
            
            // Call startPhotoImport Cloud Function
            const startPhotoImportFunction = httpsCallable(functions, 'startPhotoImport');
            const result = await startPhotoImportFunction({
              storagePath,
            });

            console.log('✅ startPhotoImport response:', result.data);
            const { importId: returnedImportId } = result.data as { importId: string };
            
            set({ 
              currentImportId: returnedImportId,
              status: 'queued',
              uploadProgress: 100 
            });

            // Subscribe to import status updates
            get().subscribeToImport(returnedImportId);
          } catch (error: any) {
            console.error('❌ Error starting photo import:', error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              details: error.details,
            });
            
            // Extract error message from Firebase error
            let errorMessage = 'Failed to start photo import';
            if (error.code === 'functions/not-found') {
              errorMessage = 'Photo import function not found. Please check backend deployment.';
            } else if (error.code === 'functions/invalid-argument') {
              errorMessage = error.message || 'Invalid request. Please try again.';
            } else if (error.code === 'functions/permission-denied') {
              errorMessage = error.message || 'Permission denied. Please check your authentication.';
            } else if (error.code === 'functions/resource-exhausted') {
              errorMessage = error.message || 'Rate limit exceeded. Please try again later.';
            } else if (error.message) {
              // Try to extract error message from Firebase error
              if (error.message.includes('errorCode') || error.message.includes('errorMessage')) {
                try {
                  const errorData = JSON.parse(error.message);
                  errorMessage = errorData.errorMessage || errorData.message || error.message;
                } catch {
                  errorMessage = error.message;
                }
              } else {
                errorMessage = error.message;
              }
            } else if (error.details) {
              errorMessage = error.details;
            }
            
            set({ 
              status: 'failed', 
              error: errorMessage,
              uploadProgress: 0 
            });
            
            // Clean up uploaded file on error
            try {
              await deleteObject(storageRef);
              console.log('🗑️ Cleaned up uploaded file');
            } catch (deleteError) {
              console.error('Error deleting uploaded file:', deleteError);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('Error in startPhotoImport:', error);
      set({ 
        status: 'failed', 
        error: error.message || 'Failed to start photo import',
        uploadProgress: 0 
      });
    }
  },

  cancelImport: async () => {
    const { currentImportId, unsubscribe } = get();
    
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }

    // Delete uploaded file if exists
    if (currentImportId) {
      const user = auth.currentUser;
      if (user) {
        const storagePath = `imports/${user.uid}/${currentImportId}.jpg`;
        const storageRef = ref(storage, storagePath);
        try {
          await deleteObject(storageRef);
        } catch (error) {
          console.error('Error deleting file on cancel:', error);
        }
      }
    }

    get().reset();
  },

  subscribeToImport: (importId: string) => {
    // Unsubscribe from previous import if any
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }

    const importRef = doc(db, COLLECTIONS.imports, importId);
    const unsubscribeFn = onSnapshot(
      importRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const importJob = snapshot.data();
        const status = importJob.status as ImportStatus;
        const errorCode = importJob.errorCode;
        const errorMessage = importJob.errorMessage;

        set({ 
          status,
          error: errorMessage || null,
        });

        // If failed, log error
        if (status === 'failed') {
          console.error('Photo import failed:', { errorCode, errorMessage });
        }
      },
      (error) => {
        console.error('Error listening to import:', error);
        set({ 
          status: 'failed', 
          error: error.message || 'Failed to track import progress' 
        });
      }
    );

    set({ unsubscribe: unsubscribeFn });
    return unsubscribeFn;
  },

  reset: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }
    set({
      currentImportId: null,
      status: 'idle',
      uploadProgress: 0,
      error: null,
      unsubscribe: null,
    });
  },
}));
