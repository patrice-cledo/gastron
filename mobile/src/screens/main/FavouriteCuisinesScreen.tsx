import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';

type FavouriteCuisinesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FavouriteCuisines'>;

interface FavouriteCuisinesScreenProps {
  navigation: FavouriteCuisinesScreenNavigationProp;
}

interface CuisineOption {
  id: string;
  label: string;
  icon?: string;
  iconType?: 'ionicon' | 'emoji' | 'flag';
}

const CUISINE_OPTIONS: CuisineOption[] = [
  { id: 'greek', label: 'Greek', icon: 'flag', iconType: 'ionicon' },
  { id: 'american', label: 'American', icon: 'flag', iconType: 'ionicon' },
  { id: 'british', label: 'British', icon: 'flag', iconType: 'ionicon' },
  { id: 'european', label: 'European', icon: 'flag', iconType: 'ionicon' },
  { id: 'french', label: 'French', icon: 'flag', iconType: 'ionicon' },
  { id: 'indian', label: 'Indian', icon: 'flag', iconType: 'ionicon' },
  { id: 'italian', label: 'Italian', icon: 'flag', iconType: 'ionicon' },
  { id: 'japanese', label: 'Japanese', icon: 'flag', iconType: 'ionicon' },
  { id: 'korean', label: 'Korean', icon: 'flag', iconType: 'ionicon' },
  { id: 'lebanese', label: 'Lebanese', icon: 'flag', iconType: 'ionicon' },
  { id: 'mediterranean', label: 'Mediterranean', icon: 'flag', iconType: 'ionicon' },
  { id: 'mexican', label: 'Mexican', icon: 'flag', iconType: 'ionicon' },
  { id: 'spanish', label: 'Spanish', icon: 'flag', iconType: 'ionicon' },
  { id: 'thai', label: 'Thai', icon: 'flag', iconType: 'ionicon' },
  { id: 'turkish', label: 'Turkish', icon: 'flag', iconType: 'ionicon' },
  { id: 'vietnamese', label: 'Vietnamese', icon: 'flag', iconType: 'ionicon' },
  { id: 'fusion', label: 'Fusion', icon: 'globe', iconType: 'ionicon' },
  { id: 'surprise-me', label: 'Surprise Me', icon: 'bulb', iconType: 'ionicon' },
];

const FavouriteCuisinesScreen: React.FC<FavouriteCuisinesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { favouriteCuisines, setFavouriteCuisines } = useUserPreferencesStore();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // Check if we're coming from profile by checking navigation state
  const navigationState = navigation.getState();
  const currentIndex = navigationState?.index || 0;
  const previousRoute = navigationState?.routes[currentIndex - 1];
  const isFromProfile = previousRoute?.name === 'Profile' || 
    navigationState?.routes.some(r => r.name === 'Profile');

  // Initialize selected options from stored preference
  useEffect(() => {
    if (favouriteCuisines && favouriteCuisines !== 'None' && favouriteCuisines !== 'no-preference') {
      // If favouriteCuisines is a string, split it (assuming comma-separated for multiple)
      const stored = favouriteCuisines.split(',').map(s => s.trim()).filter(s => s);
      setSelectedOptions(stored);
    } else {
      setSelectedOptions([]);
    }
  }, [favouriteCuisines]);

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      } else {
        return [...prev, optionId];
      }
    });
  };

  const handleSave = () => {
    // Save the selected preferences
    if (selectedOptions.length === 0) {
      setFavouriteCuisines('None');
    } else {
      // Join multiple selections with comma
      setFavouriteCuisines(selectedOptions.join(', '));
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
        <Text style={styles.headerTitle}>Favourite Cuisines</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>What are some of your favourite cuisines?</Text>
          <Text style={styles.description}>
            You'll still see all of the recipes. It'll help us recommend personalised recipes for you.
          </Text>
        </View>

        {/* Cuisine Options Grid Layout */}
        <View style={styles.optionsContainer}>
          <View style={styles.optionsGrid}>
            {CUISINE_OPTIONS.map((option) => {
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
                  {option.icon && option.iconType === 'ionicon' && (
                    <Ionicons 
                      name={option.icon as any} 
                      size={16} 
                      color={isSelected ? '#1A1A1A' : '#1A1A1A'} 
                    />
                  )}
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
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 44,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  optionTextSelected: {
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

export default FavouriteCuisinesScreen;
