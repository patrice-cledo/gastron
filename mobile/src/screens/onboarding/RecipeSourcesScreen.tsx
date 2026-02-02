import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2; // Screen width - horizontal padding (24*2) - gap between buttons (12)

type RecipeSourcesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecipeSources'>;

interface RecipeSourcesScreenProps {
  navigation: RecipeSourcesScreenNavigationProp;
}

interface RecipeSourceOption {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
}

const RECIPE_SOURCE_OPTIONS: RecipeSourceOption[] = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', iconColor: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', iconColor: '#000000' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', iconColor: '#1877F2' },
  { id: 'pinterest', label: 'Pinterest', icon: 'logo-pinterest', iconColor: '#BD081C' },
  { id: 'cookbooks', label: 'Cookbooks', icon: 'book', iconColor: '#DC143C' },
  { id: 'cooking-websites', label: 'Cooking websites', icon: 'globe', iconColor: '#4A90E2' },
];

const RecipeSourcesScreen: React.FC<RecipeSourcesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources(prev => {
      if (prev.includes(sourceId)) {
        return prev.filter(id => id !== sourceId);
      } else {
        return [...prev, sourceId];
      }
    });
  };

  const handleNext = () => {
    navigation.navigate('Ingredients');
  };

  const handleSkip = () => {
    navigation.navigate('SignUp');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderSourceButton = (source: RecipeSourceOption) => {
    const isSelected = selectedSources.includes(source.id);
    return (
      <TouchableOpacity
        key={source.id}
        style={[
          styles.sourceButton,
          isSelected && styles.sourceButtonSelected
        ]}
        onPress={() => handleSourceToggle(source.id)}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={source.icon as any} 
          size={20} 
          color={isSelected ? '#1A1A1A' : source.iconColor} 
        />
        <Text style={[
          styles.sourceText,
          isSelected && styles.sourceTextSelected
        ]}>
          {source.label}
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
          <Text style={styles.question}>Where do you get your recipes from?</Text>
          <Text style={styles.description}>
            Select all that apply
          </Text>
        </View>

        {/* Recipe Sources List */}
        <View style={styles.sourcesContainer}>
          <View style={styles.sourcesGrid}>
            {RECIPE_SOURCE_OPTIONS.map(source => renderSourceButton(source))}
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
  },
  sourcesContainer: {
    width: '100%',
  },
  sourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    marginBottom: 12,
    width: BUTTON_WIDTH,
    justifyContent: 'center',
  },
  sourceButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  sourceText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 8,
    flexShrink: 1,
  },
  sourceTextSelected: {
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

export default RecipeSourcesScreen;
