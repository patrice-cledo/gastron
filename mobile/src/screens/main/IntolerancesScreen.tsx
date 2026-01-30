import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';

type IntolerancesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Intolerances'>;

interface IntolerancesScreenProps {
  navigation: IntolerancesScreenNavigationProp;
}

interface IntoleranceOption {
  id: string;
  label: string;
}

const INTOLERANCE_OPTIONS: IntoleranceOption[] = [
  { id: 'dairy-free', label: 'Dairy Free' },
  { id: 'gluten-free', label: 'Gluten Free' },
  { id: 'nut-free', label: 'Nut Free' },
  { id: 'egg-free', label: 'Egg Free' },
];

const IntolerancesScreen: React.FC<IntolerancesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { intolerances, setIntolerances } = useUserPreferencesStore();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // Check if we're coming from profile by checking navigation state
  const navigationState = navigation.getState();
  const currentIndex = navigationState?.index || 0;
  const previousRoute = navigationState?.routes[currentIndex - 1];
  const isFromProfile = previousRoute?.name === 'Profile' || 
    navigationState?.routes.some(r => r.name === 'Profile');

  // Initialize selected options from stored preference
  useEffect(() => {
    if (intolerances && intolerances !== 'None' && intolerances !== 'no-preference') {
      // If intolerances is a string, split it (assuming comma-separated for multiple)
      const stored = intolerances.split(',').map(s => s.trim()).filter(s => s);
      setSelectedOptions(stored);
    } else if (intolerances === 'None' || intolerances === 'no-preference' || !intolerances) {
      setSelectedOptions(['no-preference']);
    }
  }, [intolerances]);

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) => {
      if (optionId === 'no-preference') {
        // If toggling "I have no preference", toggle it (single selection)
        return prev.includes('no-preference') ? [] : ['no-preference'];
      } else if (optionId === 'other') {
        // Toggle "Other" option
        const withoutNoPreference = prev.filter((id) => id !== 'no-preference');
        if (withoutNoPreference.includes('other')) {
          return withoutNoPreference.filter((id) => id !== 'other');
        } else {
          return [...withoutNoPreference, 'other'];
        }
      } else {
        // For regular intolerance options, allow multiple selection but remove "no-preference"
        const withoutNoPreference = prev.filter((id) => id !== 'no-preference');
        if (withoutNoPreference.includes(optionId)) {
          return withoutNoPreference.filter((id) => id !== optionId);
        } else {
          return [...withoutNoPreference, optionId];
        }
      }
    });
  };

  const handleSave = () => {
    // Save the selected preferences
    if (selectedOptions.length === 0 || selectedOptions.includes('no-preference')) {
      setIntolerances('None');
    } else {
      // Join multiple selections with comma
      setIntolerances(selectedOptions.join(', '));
    }
    
    // Navigate back
    navigation.goBack();
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
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Intolerances</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Do you have any intolerances?</Text>
          <Text style={styles.description}>
            Your responses will help us tailor recipe recommendations to your preferences. You will still see some recipes that don't match your diet.
          </Text>
        </View>

        {/* Intolerance Options Grid Layout */}
        <View style={styles.optionsContainer}>
          {/* 2x2 Grid */}
          <View style={styles.optionsGrid}>
            {INTOLERANCE_OPTIONS.map((option) => {
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
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Other Option */}
          <TouchableOpacity
            style={[
              styles.otherButton,
              isOptionSelected('other') && styles.otherButtonSelected,
            ]}
            onPress={() => handleOptionToggle('other')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="help-circle-outline" 
              size={20} 
              color={isOptionSelected('other') ? '#FFFFFF' : '#1A1A1A'} 
            />
            <Text
              style={[
                styles.otherText,
                isOptionSelected('other') && styles.otherTextSelected,
              ]}
            >
              Other
            </Text>
          </TouchableOpacity>
          
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

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>SAVE</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 60,
  },
  optionButtonSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  otherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '100%',
    minHeight: 60,
    marginBottom: 12,
  },
  otherButtonSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  otherText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  otherTextSelected: {
    color: '#FFFFFF',
  },
  noPreferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#FFD700',
    width: '100%',
    minHeight: 60,
  },
  noPreferenceButtonSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
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
  saveButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default IntolerancesScreen;
