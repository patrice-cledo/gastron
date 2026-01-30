import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { sampleRecipe } from '../../data/sampleRecipe';

type WantToCookScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'WantToCook'>;

const WantToCookScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<WantToCookScreenNavigationProp>();
  const { recipes } = useRecipesStore();

  // Restore images for recipes that lost them during persistence (require() results can't be serialized to JSON)
  const allRecipes = (recipes.length > 0 ? recipes : [sampleRecipe]).map(recipe => {
    // For sample recipe, always use the fresh image from sampleRecipe (it gets lost during JSON serialization)
    if (recipe.id === sampleRecipe.id) {
      return { ...recipe, image: sampleRecipe.image };
    }
    return recipe;
  });

  const handleRecipePress = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>WANT TO COOK</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Recipes Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allRecipes.length > 0 ? (
          <View style={styles.recipesGrid}>
            {allRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => handleRecipePress(recipe.id)}
              >
                {/* Recipe Image */}
                <View style={styles.recipeImageContainer}>
                  {typeof recipe.image === 'string' ? (
                    <Image source={{ uri: recipe.image }} style={styles.recipeImage} resizeMode="cover" />
                  ) : recipe.image ? (
                    <Image source={recipe.image} style={styles.recipeImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.recipeImagePlaceholder}>
                      <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                    </View>
                  )}
                  {/* Checkmark Icon */}
                  <View style={styles.checkmarkIcon}>
                    <Ionicons name="checkmark" size={16} color="#34C759" />
                  </View>
                </View>

                {/* Recipe Info */}
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                  <View style={styles.recipeMeta}>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>
                        {(recipe as any).rating || '4.0'} - {recipe.prepTime && recipe.cookTime 
                          ? `${recipe.prepTime + recipe.cookTime} mins`
                          : recipe.prepTime 
                          ? `${recipe.prepTime} mins`
                          : recipe.cookTime
                          ? `${recipe.cookTime} mins`
                          : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.calendarIcon}>
                      <Ionicons name="calendar-outline" size={16} color="#34C759" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>No recipes saved yet</Text>
            <Text style={styles.emptyStateSubtext}>Start adding recipes to your want to cook list</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  recipeCard: {
    width: '47%',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeInfo: {
    padding: 12,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    minHeight: 40,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  calendarIcon: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});

export default WantToCookScreen;
