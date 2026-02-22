import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { IngredientIcon } from '../../components/IngredientIcon';
import { getIngredientSpriteCode } from '../../utils/ingredientMapping';


type IngredientsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Ingredients'>;

interface IngredientsScreenProps {
  navigation: IngredientsScreenNavigationProp;
}

interface IngredientOption {
  id: string;
  label: string;
  icon?: string; // For fallback Ionicons
  useSprite?: boolean; // Whether to use sprite sheet icon
}

const INGREDIENT_OPTIONS: IngredientOption[] = [
  { id: 'chicken', label: 'Chicken', useSprite: true },
  { id: 'salmon', label: 'Salmon', icon: 'fish' },
  { id: 'pasta', label: 'Pasta', useSprite: true },
  { id: 'miso', label: 'Miso', icon: 'help-circle' },
  { id: 'gnocchi', label: 'Gnocchi', icon: 'restaurant' },
  { id: 'chorizo', label: 'Chorizo', icon: 'restaurant' },
  { id: 'tofu', label: 'Tofu', icon: 'cube' },
  { id: 'pork', label: 'Pork', icon: 'restaurant' },
  { id: 'mushroom', label: 'Mushroom', useSprite: true },
  { id: 'potato', label: 'Potato', useSprite: true },
  { id: 'nothing', label: "I Don't Have Anything", icon: 'thumbs-down' },
];

const IngredientsScreen: React.FC<IngredientsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(['nothing']);

  const handleIngredientToggle = (ingredientId: string) => {
    if (ingredientId === 'nothing') {
      setSelectedIngredients(['nothing']);
      return;
    }
    setSelectedIngredients(prev => {
      // Remove 'nothing' if it exists when selecting other ingredients
      const filtered = prev.filter(id => id !== 'nothing');
      if (filtered.includes(ingredientId)) {
        return filtered.filter(id => id !== ingredientId);
      } else {
        return [...filtered, ingredientId];
      }
    });
  };

  const handleNext = () => {
    navigation.navigate('HelpNeeded');
  };

  const handleSkip = () => {
    navigation.navigate('SignUp');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderIngredientButton = (ingredient: IngredientOption) => {
    const isSelected = selectedIngredients.includes(ingredient.id);

    const spriteCode = ingredient.useSprite ? getIngredientSpriteCode(ingredient.label) : null;

    return (
      <TouchableOpacity
        key={ingredient.id}
        style={[
          styles.ingredientButton,
          isSelected && styles.ingredientButtonSelected
        ]}
        onPress={() => handleIngredientToggle(ingredient.id)}
        activeOpacity={0.7}
      >
        {spriteCode ? (
          <IngredientIcon name={ingredient.label} type="whole" size="small" />
        ) : (
          <Ionicons
            name={ingredient.icon as any || 'restaurant'}
            size={20}
            color="#1A1A1A"
          />
        )}
        <Text style={[
          styles.ingredientText,
          isSelected && styles.ingredientTextSelected
        ]}>
          {ingredient.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Tell us what you've already got</Text>
          <Text style={styles.description}>
            This will help us recommend recipes that you can make with what you currently have.
          </Text>
        </View>

        {/* Ingredients Grid */}
        <View style={styles.ingredientsContainer}>
          <View style={styles.ingredientsGrid}>
            {INGREDIENT_OPTIONS.map(ingredient => renderIngredientButton(ingredient))}
          </View>
        </View>
      </ScrollView>

      {/* Next Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>NEXT</Text>
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
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBarFilled: {
    backgroundColor: '#CEEC2C',
  },
  progressBarEmpty: {
    backgroundColor: '#E0E0E0',
  },
  skipButton: {
    padding: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  questionContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4A4A4A',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ingredientsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  ingredientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    marginBottom: 12,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  ingredientButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  ingredientText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 6,
    flexShrink: 1,
  },
  ingredientTextSelected: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  nextButton: {
    backgroundColor: '#CEEC2C',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default IngredientsScreen;
