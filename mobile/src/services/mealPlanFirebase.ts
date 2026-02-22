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
    
    // Save or update the entry (include userId so we can load by user even if plan doc is missing)
    const entryRef = doc(db, COLLECTIONS.mealPlanEntries, mealPlan.id);
    await setDoc(entryRef, {
      userId: currentUser.uid,
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
 * Normalize date to YYYY-MM-DD string (Firestore may return Timestamp)
 */
const toDateString = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    const d = (val as { toDate: () => Date }).toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};

const entryToMealPlanItem = (entry: any): MealPlanItem => {
  const servingsOverride = entry.servingsOverride != null && entry.servingsOverride !== ''
    ? Number(entry.servingsOverride)
    : undefined;
  return {
    id: entry.id,
    recipeId: entry.recipeId,
    recipeTitle: entry.recipeTitle || '',
    recipeImage: entry.recipeImage || undefined,
    mealType: entry.mealType,
    date: toDateString(entry.date),
    servingsOverride: servingsOverride != null && !isNaN(servingsOverride) && servingsOverride >= 1 ? servingsOverride : undefined,
    includeInGrocery: entry.includeInGrocery !== undefined ? entry.includeInGrocery : true,
  };
};

/**
 * Load all meal plans from Firebase for the current user.
 * Tries (1) entries by userId, then (2) plans by userId + entries by planId, so existing data shows even if plan docs lack userId.
 */
export const loadMealPlansFromFirebase = async (): Promise<MealPlanItem[]> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('Cannot load meal plans: user not authenticated');
    return [];
  }

  try {
    const entriesRef = collection(db, COLLECTIONS.mealPlanEntries);

    // 1) Load entries that have userId (new or backfilled) - works even when plan docs are missing
    const byUserQuery = query(entriesRef, where('userId', '==', currentUser.uid));
    const byUserSnapshot = await getDocs(byUserQuery);
    if (!byUserSnapshot.empty) {
      const items = byUserSnapshot.docs.map(doc => entryToMealPlanItem({ id: doc.id, ...doc.data() }));
      console.log(`✅ Loaded ${items.length} meal plans from Firebase (by userId)`);
      return items;
    }

    // 2) Fallback: load via meal plan docs (for entries saved before we added userId)
    const mealPlansRef = collection(db, COLLECTIONS.mealPlans);
    const plansQuery = query(mealPlansRef, where('userId', '==', currentUser.uid));
    const plansSnapshot = await getDocs(plansQuery);
    if (plansSnapshot.empty) {
      console.log('📋 No meal plans found in Firebase');
      return [];
    }

    const planIds = plansSnapshot.docs.map(d => d.id);
    const allEntries: any[] = [];
    for (let i = 0; i < planIds.length; i += 10) {
      const batch = planIds.slice(i, i + 10);
      const entriesQuery = query(entriesRef, where('planId', 'in', batch));
      const entriesSnapshot = await getDocs(entriesQuery);
      allEntries.push(...entriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    // Backfill userId on entries that don't have it (so next load uses the fast "by userId" path)
    const needsBackfill = allEntries.filter((e: any) => !e.userId || e.userId !== currentUser.uid);
    if (needsBackfill.length > 0) {
      try {
        const backfillBatch = writeBatch(db);
        for (const entry of needsBackfill) {
          backfillBatch.set(doc(db, COLLECTIONS.mealPlanEntries, entry.id), { userId: currentUser.uid }, { merge: true });
        }
        await backfillBatch.commit();
        console.log(`✅ Backfilled userId on ${needsBackfill.length} meal plan entries`);
      } catch (err) {
        console.warn('Backfill userId failed (non-fatal):', err);
      }
    }

    const mealPlanItems = allEntries.map(entry => entryToMealPlanItem(entry));
    console.log(`✅ Loaded ${mealPlanItems.length} meal plans from Firebase (by planId)`);
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
        userId: currentUser.uid,
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
