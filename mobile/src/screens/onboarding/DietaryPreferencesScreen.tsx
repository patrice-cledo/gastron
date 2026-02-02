import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';

type DietaryPreferencesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DietaryPreferences'>;

interface DietaryPreferencesScreenProps {
  navigation: DietaryPreferencesScreenNavigationProp;
}

interface DietaryOption {
  id: string;
  label: string;
  icon?: string;
  iconType?: 'ionicon' | 'emoji';
}

const DIETARY_OPTIONS: DietaryOption[] = [
  // Row 1: 2 buttons
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥕', iconType: 'emoji' },
  { id: 'vegan', label: 'Vegan', icon: '🍎', iconType: 'emoji' },
  // Row 2: 2 buttons
  { id: 'pescatarian', label: 'Pescatarian', icon: '🐟', iconType: 'emoji' },
  { id: 'other', label: 'Other', icon: 'help-circle-outline', iconType: 'ionicon' },
];

const DietaryPreferencesScreen: React.FC<DietaryPreferencesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { dietaryPreference, setDietaryPreference } = useUserPreferencesStore();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // Check if we're coming from profile by checking navigation state
  // Simple check: if we can go back and the previous route is Profile, we're from profile
  const navigationState = navigation.getState();
  const currentIndex = navigationState?.index || 0;
  const previousRoute = navigationState?.routes[currentIndex - 1];
  const isFromProfile = previousRoute?.name === 'Profile' || 
    navigationState?.routes.some(r => r.name === 'Profile');

  // Initialize selected options from stored preference
  useEffect(() => {
    if (dietaryPreference && dietaryPreference !== 'None' && dietaryPreference !== 'no-preference') {
      setSelectedOptions([dietaryPreference]);
    } else if (dietaryPreference === 'None' || dietaryPreference === 'no-preference' || !dietaryPreference) {
      setSelectedOptions(['no-preference']);
    }
  }, [dietaryPreference]);

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) => {
      if (optionId === 'no-preference') {
        // If toggling "I have no preference", toggle it (single selection)
        return prev.includes('no-preference') ? [] : ['no-preference'];
      } else {
        // If selecting any other option, replace current selection (single selection only)
        // Always replace the entire array with just the new selection
        return [optionId];
      }
    });
  };

  const handleNext = () => {
    // Save the selected preference
    if (selectedOptions.length > 0) {
      const selected = selectedOptions[0];
      if (selected === 'no-preference') {
        setDietaryPreference('None');
      } else {
        setDietaryPreference(selected);
      }
    } else {
      setDietaryPreference('None');
    }
    
    // If from profile, go back; otherwise continue onboarding
    if (isFromProfile) {
      navigation.goBack();
    } else {
      navigation.navigate('Servings');
    }
  };

  const handleSkip = () => {
    if (isFromProfile) {
      navigation.goBack();
    } else {
      navigation.navigate('SignUp');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isOptionSelected = (optionId: string) => selectedOptions.includes(optionId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        {!isFromProfile && (
          <>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, styles.progressBarFilled]} />
              <View style={[styles.progressBar, styles.progressBarEmpty]} />
              <View style={[styles.progressBar, styles.progressBarEmpty]} />
              <View style={[styles.progressBar, styles.progressBarEmpty]} />
              <View style={[styles.progressBar, styles.progressBarEmpty]} />
            </View>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>SKIP</Text>
            </TouchableOpacity>
          </>
        )}
        {isFromProfile && (
          <>
            <Text style={styles.headerTitle}>Dietary Preference</Text>
            <View style={styles.headerSpacer} />
          </>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>
            {isFromProfile ? 'Do you have any diet preference?' : 'Any diet or allergies to consider?'}
          </Text>
          <Text style={styles.description}>
            {isFromProfile 
              ? 'Your answers will help us tailor recipe recommendations to your preferences. You will still see some recipes that don\'t match your diet.'
              : 'This will help us recommend recipes that suit your dietary needs.'}
          </Text>
        </View>

        {/* Dietary Options Grid Layout */}
        <View style={styles.optionsContainer}>
          {/* 2x2 Grid */}
          <View style={styles.optionsGrid}>
            {DIETARY_OPTIONS.map((option) => {
              const isSelected = isOptionSelected(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleOptionToggle(option.id)}
                  activeOpacity={0.7}
                >
                  {option.icon && option.iconType === 'emoji' && (
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                  )}
                  {option.icon && option.iconType === 'ionicon' && (
                    <Ionicons 
                      name={option.icon as any} 
                      size={20} 
                      color={isSelected ? '#FFFFFF' : '#1A1A1A'} 
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* I have no preference Button */}
          <TouchableOpacity
            style={[
              styles.noPreferenceButton,
              isOptionSelected('no-preference') && styles.noPreferenceButtonSelected,
            ]}
            onPress={() => handleOptionToggle('no-preference')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="restaurant" 
              size={20} 
              color="#1A1A1A" 
            />
            <Text style={styles.noPreferenceText}>
              I have no preference
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Next/Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>{isFromProfile ? 'SAVE' : 'NEXT'}</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
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
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  optionButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    minHeight: 60,
  },
  optionButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  noPreferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E0EB60',
    borderWidth: 1,
    borderColor: '#E0EB60',
    width: '100%',
    minHeight: 60,
  },
  noPreferenceButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  noPreferenceText: {
    fontSize: 16,
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

export default DietaryPreferencesScreen;
