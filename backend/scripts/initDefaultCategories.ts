/**
 * Initialize default categories in Firestore
 * Run this script once to set up default categories for the app
 */

import * as admin from 'firebase-admin';
import { DEFAULT_CATEGORIES, COLLECTIONS } from '../shared/types';

// Initialize Firebase Admin (you'll need to set up service account)
// For local development, you can use:
// export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
// Or use Firebase emulator

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function initDefaultCategories() {
  console.log('Initializing default categories...');

  try {
    // Check if categories already exist
    const existingCategories = await db
      .collection(COLLECTIONS.categories)
      .where('userCustom', '==', false)
      .get();

    if (!existingCategories.empty) {
      console.log('Default categories already exist. Skipping initialization.');
      return;
    }

    // Add default categories
    const batch = db.batch();
    let sortOrder = 1;

    for (const category of DEFAULT_CATEGORIES) {
      const categoryRef = db.collection(COLLECTIONS.categories).doc();
      batch.set(categoryRef, {
        ...category,
        sortOrder,
      });
      sortOrder++;
      console.log(`Added category: ${category.name}`);
    }

    await batch.commit();
    console.log('Default categories initialized successfully!');
  } catch (error) {
    console.error('Error initializing default categories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initDefaultCategories()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { initDefaultCategories };
