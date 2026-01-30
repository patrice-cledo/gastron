import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { MealPlanItem } from '../stores/mealPlanStore';

const COLLECTIONS = {
  mealPlans: 'mealPlans',
  mealPlanEntries: 'mealPlanEntries',
};

/**
 * Get the Monday (start of week) for a given date
 */
export const getWeekStart = (date: string): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
};

/**
 * Get or create a meal plan document for a week
 */
const getOrCreateMealPlan = async (weekStart: string, userId: string): Promise<string> => {
  // Check if meal plan exists for this week
  const mealPlansRef = collection(db, COLLECTIONS.mealPlans);
  const q = query(
    mealPlansRef,
    where('userId', '==', userId),
    where('startDate', '==', weekStart)
  );
  
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  
  // Create new meal plan
  const newPlanRef = doc(collection(db, COLLECTIONS.mealPlans));
  await setDoc(newPlanRef, {
    userId,
    startDate: weekStart,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    version: 1,
  });
  
  return newPlanRef.id;
};

/**
 * Save a meal plan item to Firebase
 */
export const saveMealPlanToFirebase = async (mealPlan: MealPlanItem): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Cannot save meal plan: user not authenticated');
    return;
  }

  // Skip Firebase sync for shelf items (empty date)
  if (!mealPlan.date || mealPlan.date === '' || mealPlan.date === 'unscheduled') {
    console.log('⏭️ Skipping Firebase sync for shelf item:', mealPlan.id);
    return;
  }

  try {
    const weekStart = getWeekStart(mealPlan.date);
    const planId = await getOrCreateMealPlan(weekStart, currentUser.uid);
    
    // Save or update the entry
    const entryRef = doc(db, COLLECTIONS.mealPlanEntries, mealPlan.id);
    await setDoc(entryRef, {
      planId,
      date: mealPlan.date,
      mealType: mealPlan.mealType,
      recipeId: mealPlan.recipeId,
      recipeTitle: mealPlan.recipeTitle || '',
      recipeImage: mealPlan.recipeImage || null,
      servingsOverride: mealPlan.servingsOverride || null,
      includeInGrocery: mealPlan.includeInGrocery !== undefined ? mealPlan.includeInGrocery : true,
    }, { merge: true });
    
    // Update meal plan timestamp
    const planRef = doc(db, COLLECTIONS.mealPlans, planId);
    await setDoc(planRef, {
      updatedAt: Timestamp.now(),
    }, { merge: true });
    
    console.log('✅ Saved meal plan to Firebase:', mealPlan.id);
  } catch (error) {
    console.error('❌ Error saving meal plan to Firebase:', error);
    throw error;
  }
};

/**
 * Delete a meal plan item from Firebase
 */
export const deleteMealPlanFromFirebase = async (mealPlanId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Cannot delete meal plan: user not authenticated');
    return;
  }

  try {
    // Get the entry to find the planId
    const entryRef = doc(db, COLLECTIONS.mealPlanEntries, mealPlanId);
    const entryDoc = await getDoc(entryRef);
    
    if (entryDoc.exists()) {
      const entryData = entryDoc.data();
      const planId = entryData?.planId;
      
      if (!planId) {
        console.warn('⚠️ Meal plan entry has no planId, deleting entry only:', mealPlanId);
        await deleteDoc(entryRef);
        return;
      }
      
      // Delete the entry
      await deleteDoc(entryRef);
      
      // Check if there are any remaining entries for this plan
      const entriesRef = collection(db, COLLECTIONS.mealPlanEntries);
      const entriesQuery = query(entriesRef, where('planId', '==', planId));
      const entriesSnapshot = await getDocs(entriesQuery);
      
      // If no entries remain, delete the plan
      if (entriesSnapshot.empty) {
        const planRef = doc(db, COLLECTIONS.mealPlans, planId);
        await deleteDoc(planRef);
        console.log('🗑️ Deleted empty meal plan:', planId);
      } else {
        // Update plan timestamp
        const planRef = doc(db, COLLECTIONS.mealPlans, planId);
        await setDoc(planRef, {
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
      
      console.log('✅ Deleted meal plan from Firebase:', mealPlanId);
    }
  } catch (error) {
    console.error('❌ Error deleting meal plan from Firebase:', error);
    throw error;
  }
};

/**
 * Load all meal plans from Firebase for the current user
 */
export const loadMealPlansFromFirebase = async (): Promise<MealPlanItem[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Cannot load meal plans: user not authenticated');
    return [];
  }

  try {
    // Get all meal plans for this user
    const mealPlansRef = collection(db, COLLECTIONS.mealPlans);
    const plansQuery = query(mealPlansRef, where('userId', '==', currentUser.uid));
    const plansSnapshot = await getDocs(plansQuery);
    
    if (plansSnapshot.empty) {
      console.log('📋 No meal plans found in Firebase');
      return [];
    }
    
    // Get all entries for these plans
    const planIds = plansSnapshot.docs.map(doc => doc.id);
    const entriesRef = collection(db, COLLECTIONS.mealPlanEntries);
    
    // Firestore has a limit of 10 items in an 'in' query, so we need to batch
    const allEntries: any[] = [];
    for (let i = 0; i < planIds.length; i += 10) {
      const batch = planIds.slice(i, i + 10);
      const entriesQuery = query(entriesRef, where('planId', 'in', batch));
      const entriesSnapshot = await getDocs(entriesQuery);
      allEntries.push(...entriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    
    // Convert to MealPlanItem format
    const mealPlanItems: MealPlanItem[] = allEntries.map(entry => ({
      id: entry.id,
      recipeId: entry.recipeId,
      recipeTitle: entry.recipeTitle || '', // Stored in Firebase, will be enriched from recipe store if missing
      recipeImage: entry.recipeImage || undefined,
      mealType: entry.mealType,
      date: entry.date,
      servingsOverride: entry.servingsOverride || undefined,
      includeInGrocery: entry.includeInGrocery !== undefined ? entry.includeInGrocery : true,
    }));
    
    console.log(`✅ Loaded ${mealPlanItems.length} meal plans from Firebase`);
    return mealPlanItems;
  } catch (error) {
    console.error('❌ Error loading meal plans from Firebase:', error);
    return [];
  }
};

/**
 * Batch save multiple meal plans to Firebase
 */
export const batchSaveMealPlansToFirebase = async (mealPlans: MealPlanItem[]): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Cannot save meal plans: user not authenticated');
    return;
  }

  if (mealPlans.length === 0) {
    return;
  }

  // Filter out shelf items (empty dates) - they should only be stored locally
  const scheduledMealPlans = mealPlans.filter(
    mp => mp.date && mp.date !== '' && mp.date !== 'unscheduled'
  );

  if (scheduledMealPlans.length === 0) {
    console.log('⏭️ No scheduled meal plans to sync to Firebase');
    return;
  }

  try {
    const batch = writeBatch(db);
    
    // Group by week to get plan IDs
    const weekToPlanId: { [weekStart: string]: string } = {};
    const weekStarts = new Set(scheduledMealPlans.map(mp => getWeekStart(mp.date)));
    
    // Get or create meal plans for each week
    for (const weekStart of weekStarts) {
      const planId = await getOrCreateMealPlan(weekStart, currentUser.uid);
      weekToPlanId[weekStart] = planId;
    }
    
    // Add all entries to batch
    for (const mealPlan of scheduledMealPlans) {
      const weekStart = getWeekStart(mealPlan.date);
      const planId = weekToPlanId[weekStart];
      
      const entryRef = doc(db, COLLECTIONS.mealPlanEntries, mealPlan.id);
      batch.set(entryRef, {
        planId,
        date: mealPlan.date,
        mealType: mealPlan.mealType,
        recipeId: mealPlan.recipeId,
        recipeTitle: mealPlan.recipeTitle || '',
        recipeImage: mealPlan.recipeImage || null,
        servingsOverride: mealPlan.servingsOverride || null,
        includeInGrocery: mealPlan.includeInGrocery !== undefined ? mealPlan.includeInGrocery : true,
      }, { merge: true });
    }
    
    // Update all plan timestamps
    for (const planId of Object.values(weekToPlanId)) {
      const planRef = doc(db, COLLECTIONS.mealPlans, planId);
      batch.set(planRef, {
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    
    await batch.commit();
    console.log(`✅ Batch saved ${scheduledMealPlans.length} meal plans to Firebase`);
  } catch (error) {
    console.error('❌ Error batch saving meal plans to Firebase:', error);
    throw error;
  }
};
