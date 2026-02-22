import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeProvider';
import { Recipe } from '../../types/recipe';

type StarterRecipesScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'StarterRecipes'
>;

const StarterRecipesScreen: React.FC<StarterRecipesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [bookmarkedRecipes, setBookmarkedRecipes] = useState<Set<string>>(new Set());

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetail', { recipeId: recipe.id });
  };

  const handleBookmark = (recipeId: string) => {
    setBookmarkedRecipes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const getTotalTime = (recipe: Recipe) => {
    return (recipe.prepTime || 0) + (recipe.cookTime || 0);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Starter Recipes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Get Started</Text>
          <Text style={styles.introText}>
            Try these recipes to see how Gastrons works. Tap any recipe to view it in our visual format.
          </Text>
        </View>

        <View style={styles.recipesGrid}>
          {([] as Recipe[]).length > 0 ? (
            ([] as Recipe[]).map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => handleRecipePress(recipe)}
                activeOpacity={0.7}
              >
                <View style={styles.recipeThumbnail}>
                  <Text style={styles.recipeThumbnailPlaceholder}>📄</Text>
                </View>
                <Text style={styles.recipeName} numberOfLines={2}>
                  {recipe.title}
                </Text>
                <Text style={styles.recipeDescription} numberOfLines={1}>
                  {recipe.description}
                </Text>
                <View style={styles.recipeMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaIcon}>⏱</Text>
                    <Text style={styles.metaText}>{getTotalTime(recipe)} min</Text>
                  </View>
                  {recipe.servings && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaIcon}>👥</Text>
                      <Text style={styles.metaText}>{recipe.servings}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.bookmarkButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleBookmark(recipe.id);
                  }}
                >
                  <Text style={styles.bookmarkIcon}>
                    {bookmarkedRecipes.has(recipe.id) ? '🔖' : '📖'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Browse recipes from the home screen.</Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  introSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  introText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  recipesGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 8,
  },
  recipeCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  recipeThumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recipeThumbnailPlaceholder: {
    fontSize: 48,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    minHeight: 40,
  },
  recipeDescription: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  bookmarkIcon: {
    fontSize: 20,
  },
  emptyState: {
    width: '100%',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default StarterRecipesScreen;

