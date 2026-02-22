import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { starterRecipes } from '../../data/starterRecipes';
import { useMealPlanStore, MealPlanItem } from '../../stores/mealPlanStore';
import { useRecipesStore } from '../../stores/recipesStore';

type ChooseRecipesScreenRouteProp = RouteProp<RootStackParamList, 'ChooseRecipes'>;
type ChooseRecipesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChooseRecipes'>;

const ChooseRecipesScreen: React.FC = () => {
  const navigation = useNavigation<ChooseRecipesScreenNavigationProp>();
  const route = useRoute<ChooseRecipesScreenRouteProp>();
  const { mealPlans } = useMealPlanStore();
  const { recipes: savedRecipes } = useRecipesStore();
  const [selectedMealPlans, setSelectedMealPlans] = useState<Set<string>>(new Set());

  // Pre-select meal plans if provided
  useEffect(() => {
    const preSelectedIds = route.params?.preSelectedMealPlanIds;
    if (preSelectedIds && preSelectedIds.length > 0) {
      setSelectedMealPlans(new Set(preSelectedIds));
    }
  }, [route.params?.preSelectedMealPlanIds]);

  // Combine starter recipes and saved recipes
  const allRecipes = useMemo(() => {
    return [...starterRecipes, ...savedRecipes];
  }, [savedRecipes]);

  // Get current week dates
  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates();

  const getDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getMealPlansForDay = (date: Date): MealPlanItem[] => {
    const dateKey = getDateKey(date);
    return mealPlans.filter((plan) => plan.date === dateKey);
  };

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const getMealTypeColor = (mealType: string): string => {
    switch (mealType) {
      case 'breakfast':
        return '#007AFF';
      case 'lunch':
        return '#FF6B35';
      case 'dinner':
        return '#FF3B30';
      case 'snack':
        return '#FF9500';
      default:
        return '#666';
    }
  };

  const toggleMealPlan = (mealPlanId: string) => {
    setSelectedMealPlans((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mealPlanId)) {
        newSet.delete(mealPlanId);
      } else {
        newSet.add(mealPlanId);
      }
      return newSet;
    });
  };

  const handleNext = () => {
    const selected = mealPlans.filter((plan) => selectedMealPlans.has(plan.id));
    if (selected.length === 0) return;

    navigation.navigate('IngredientSelection', {
      selectedMealPlans: selected.map((plan) => ({
        mealPlanId: plan.id,
        recipeId: plan.recipeId,
        recipeTitle: plan.recipeTitle,
        date: plan.date,
        mealType: plan.mealType,
      })),
    });
  };

  const allMealPlans = useMemo(() => {
    const plans: Array<Omit<MealPlanItem, 'date'> & { date: Date }> = [];
    weekDates.forEach((date) => {
      const dayPlans = getMealPlansForDay(date);
      dayPlans.forEach((plan) => {
        plans.push({ ...plan, date });
      });
    });
    return plans;
  }, [weekDates, mealPlans]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose recipes</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Recipe List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {weekDates.map((date, index) => {
          const dayMealPlans = getMealPlansForDay(date);
          const hasPlans = dayMealPlans.length > 0;

          return (
            <View key={index} style={styles.daySection}>
              <Text style={styles.dayName}>
                {formatDayName(date)} {formatDayNumber(date)}
              </Text>
              {hasPlans ? (
                dayMealPlans.map((plan) => {
                  const recipe = allRecipes.find((r) => r.id === plan.recipeId);
                  const isSelected = selectedMealPlans.has(plan.id);

                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.recipeCard}
                      onPress={() => toggleMealPlan(plan.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recipeImageContainer}>
                        {plan.recipeImage ? (
                          <Image source={{ uri: plan.recipeImage }} style={styles.recipeImage} />
                        ) : (
                          <View style={styles.recipeImagePlaceholder}>
                            <Ionicons name="image-outline" size={24} color="#999" />
                          </View>
                        )}
                      </View>
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeTitle}>{plan.recipeTitle}</Text>
                        <Text style={[styles.recipeMealType, { color: getMealTypeColor(plan.mealType) }]}>
                          {plan.mealType.charAt(0).toUpperCase() + plan.mealType.slice(1)}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.noRecipesCard}>
                  <Text style={styles.noRecipesText}>No recipes yet</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, selectedMealPlans.size === 0 && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={selectedMealPlans.size === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  daySection: {
    marginBottom: 24,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0DA',
  },
  recipeImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E0E0DA',
    marginRight: 12,
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recipeMealType: {
    fontSize: 14,
    fontWeight: '400',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  noRecipesCard: {
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  noRecipesText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
  },
  nextButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ChooseRecipesScreen;
