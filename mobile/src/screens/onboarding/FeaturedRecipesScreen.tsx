import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;

type FeaturedRecipesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FeaturedRecipes'>;

interface FeaturedRecipesScreenProps {
  navigation: FeaturedRecipesScreenNavigationProp;
}

interface FeaturedRecipe {
  id: string;
  title: string;
  image: any; // Can be string (URI) or require() result
  tags: {
    category: string;
    time: string;
    calories: string;
    servings: string;
  };
}

// Mock featured recipes - replace with actual data
const FEATURED_RECIPES: FeaturedRecipe[] = [
  {
    id: '1',
    title: 'Cottage Pie with Parsnip Top',
    image: require('../../../assets/images/get-started/cottage-pie.png'),
    tags: {
      category: 'Meat',
      time: '40',
      calories: '14',
      servings: '2',
    },
  },
  {
    id: '2',
    title: 'Classic Spaghetti Carbonara',
    image: 'https://via.placeholder.com/400x300',
    tags: {
      category: 'Pasta',
      time: '25',
      calories: '12',
      servings: '4',
    },
  },
  {
    id: '3',
    title: 'Mediterranean Quinoa Bowl',
    image: 'https://via.placeholder.com/400x300',
    tags: {
      category: 'Vegetarian',
      time: '30',
      calories: '10',
      servings: '2',
    },
  },
];

const FeaturedRecipesScreen: React.FC<FeaturedRecipesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0);

  const currentRecipe = FEATURED_RECIPES[currentRecipeIndex];

  const handlePrevious = () => {
    if (currentRecipeIndex > 0) {
      setCurrentRecipeIndex(currentRecipeIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentRecipeIndex < FEATURED_RECIPES.length - 1) {
      setCurrentRecipeIndex(currentRecipeIndex + 1);
    }
  };

  const handleFinish = () => {
    navigation.navigate('SignUp');
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Build your menu</Text>
        <View style={styles.skipButton}>
          <Text style={styles.skipTextDisabled}>SKIP</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, styles.progressBarFilled]} />
        <View style={[styles.progressBar, styles.progressBarFilled]} />
        <View style={[styles.progressBar, styles.progressBarFilled]} />
        <View style={[styles.progressBar, styles.progressBarFilled]} />
        <View style={[styles.progressBar, styles.progressBarFilled]} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Title */}
        <Text style={styles.recipeTitle}>{currentRecipe.title}</Text>

        {/* Recipe Tags */}
        <View style={styles.tagsContainer}>
          <View style={styles.tag}>
            <Ionicons name="restaurant" size={16} color="#1A1A1A" />
            <Text style={styles.tagText}>{currentRecipe.tags.category}</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name="time-outline" size={16} color="#1A1A1A" />
            <Text style={styles.tagText}>{currentRecipe.tags.time}</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name="flame-outline" size={16} color="#1A1A1A" />
            <Text style={styles.tagText}>{currentRecipe.tags.calories}</Text>
          </View>
          <View style={styles.tag}>
            <Ionicons name="people-outline" size={16} color="#1A1A1A" />
            <Text style={styles.tagText}>{currentRecipe.tags.servings}</Text>
          </View>
        </View>

        {/* Recipe Image with Navigation */}
        <View style={styles.imageContainer}>
          <Image 
            source={typeof currentRecipe.image === 'string' ? { uri: currentRecipe.image } : currentRecipe.image}
            style={styles.recipeImage}
            resizeMode="cover"
          />
          
          {/* Left Arrow */}
          {currentRecipeIndex > 0 && (
            <TouchableOpacity 
              style={styles.navArrowLeft}
              onPress={handlePrevious}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Right Arrow */}
          {currentRecipeIndex < FEATURED_RECIPES.length - 1 && (
            <TouchableOpacity 
              style={styles.navArrowRight}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Info Message */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={20} color="#4A4A4A" />
          <Text style={styles.infoText}>
            Delicious recipes ahead ready to get you started
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <Text style={styles.finishButtonText}>FINISH & GO TO YOUR MENU</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  skipButton: {
    padding: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  skipTextDisabled: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBarFilled: {
    backgroundColor: '#FFD700',
  },
  progressBarEmpty: {
    backgroundColor: '#E0E0E0',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 6,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  navArrowLeft: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navArrowRight: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#4A4A4A',
    lineHeight: 20,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  finishButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default FeaturedRecipesScreen;
