import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = (SCREEN_WIDTH - 48 - 16) / 3; // Screen width - horizontal padding (24*2) - gap between buttons (8*2)

type CuisinesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Cuisines'>;

interface CuisinesScreenProps {
  navigation: CuisinesScreenNavigationProp;
}

interface CuisineOption {
  id: string;
  label: string;
  icon: string;
  iconType: 'flag' | 'other';
}

const CUISINE_OPTIONS: CuisineOption[] = [
  { id: 'american', label: 'American', icon: '🇺🇸', iconType: 'flag' },
  { id: 'british', label: 'British', icon: '🇬🇧', iconType: 'flag' },
  { id: 'french', label: 'French', icon: '🇫🇷', iconType: 'flag' },
  { id: 'greek', label: 'Greek', icon: '🇬🇷', iconType: 'flag' },
  { id: 'indian', label: 'Indian', icon: '🇮🇳', iconType: 'flag' },
  { id: 'italian', label: 'Italian', icon: '🇮🇹', iconType: 'flag' },
  { id: 'japanese', label: 'Japanese', icon: '🇯🇵', iconType: 'flag' },
  { id: 'korean', label: 'Korean', icon: '🇰🇷', iconType: 'flag' },
  { id: 'lebanese', label: 'Lebanese', icon: '🇱🇧', iconType: 'flag' },
  { id: 'mediterranean', label: 'Mediterranean', icon: '🇬🇷', iconType: 'flag' },
  { id: 'mexican', label: 'Mexican', icon: '🇲🇽', iconType: 'flag' },
  { id: 'spanish', label: 'Spanish', icon: '🇪🇸', iconType: 'flag' },
  { id: 'thai', label: 'Thai', icon: '🇹🇭', iconType: 'flag' },
  { id: 'turkish', label: 'Turkish', icon: '🇹🇷', iconType: 'flag' },
  { id: 'fusion', label: 'Fusion', icon: 'globe', iconType: 'other' },
];

const CuisinesScreen: React.FC<CuisinesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  const handleCuisineToggle = (cuisineId: string) => {
    setSelectedCuisines(prev => {
      if (prev.includes(cuisineId)) {
        return prev.filter(id => id !== cuisineId);
      } else {
        return [...prev, cuisineId];
      }
    });
  };

  const handleNext = () => {
    navigation.navigate('RecipeSources');
  };

  const handleSkip = () => {
    navigation.navigate('SignUp');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCuisineButton = (cuisine: CuisineOption) => {
    const isSelected = selectedCuisines.includes(cuisine.id);
    return (
      <TouchableOpacity
        key={cuisine.id}
        style={[
          styles.cuisineButton,
          isSelected && styles.cuisineButtonSelected
        ]}
        onPress={() => handleCuisineToggle(cuisine.id)}
        activeOpacity={0.7}
      >
        {cuisine.iconType === 'flag' ? (
          <Text style={styles.flagIcon}>{cuisine.icon}</Text>
        ) : (
          <Ionicons 
            name={cuisine.icon as any} 
            size={20} 
            color={isSelected ? '#1A1A1A' : '#1A1A1A'} 
          />
        )}
        <Text style={[
          styles.cuisineText,
          isSelected && styles.cuisineTextSelected
        ]}>
          {cuisine.label}
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
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
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
          <Text style={styles.question}>What cuisines do you fancy?</Text>
          <Text style={styles.description}>
            This will help us recommend recipes that suit your taste buds.
          </Text>
        </View>

        {/* Cuisine Selection Grid */}
        <View style={styles.cuisinesContainer}>
          <View style={styles.cuisinesGrid}>
            {CUISINE_OPTIONS.map(cuisine => renderCuisineButton(cuisine))}
          </View>
          
          {/* Surprise Me Button */}
          <View style={styles.surpriseMeContainer}>
            <TouchableOpacity
              style={[
                styles.surpriseMeButton,
                selectedCuisines.includes('surprise-me') && styles.surpriseMeButtonSelected
              ]}
              onPress={() => handleCuisineToggle('surprise-me')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="bulb" 
                size={20} 
                color="#1A1A1A" 
              />
              <Text style={styles.surpriseMeText}>Surprise Me</Text>
            </TouchableOpacity>
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
    fontSize: 24,
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
  cuisinesContainer: {
    width: '100%',
  },
  cuisinesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cuisineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    marginBottom: 12,
    width: BUTTON_WIDTH,
    justifyContent: 'center',
  },
  cuisineButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  flagIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  cuisineText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  cuisineTextSelected: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  surpriseMeContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  surpriseMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    justifyContent: 'center',
  },
  surpriseMeButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  surpriseMeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 8,
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

export default CuisinesScreen;
