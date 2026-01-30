import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';

type DislikesAllergiesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DislikesAllergies'>;

interface DislikesAllergiesScreenProps {
  navigation: DislikesAllergiesScreenNavigationProp;
}

interface IngredientOption {
  id: string;
  label: string;
  icon?: string;
  iconType?: 'ionicon' | 'emoji';
}

const INGREDIENT_OPTIONS: IngredientOption[] = [
  { id: 'anchovies', label: 'Anchovies', icon: 'fish', iconType: 'ionicon' },
  { id: 'olives', label: 'Olives', icon: 'ellipse', iconType: 'ionicon' },
  { id: 'onions', label: 'Onions', icon: 'radio-button-on', iconType: 'ionicon' },
  { id: 'fish', label: 'Fish', icon: 'fish', iconType: 'ionicon' },
  { id: 'coriander', label: 'Coriander/Cilantro', icon: 'leaf', iconType: 'ionicon' },
  { id: 'avocado', label: 'Avocado', icon: 'ellipse', iconType: 'ionicon' },
  { id: 'brussels-sprouts', label: 'Brussels Sprouts', icon: 'leaf', iconType: 'ionicon' },
  { id: 'tofu', label: 'Tofu', icon: 'square', iconType: 'ionicon' },
];

const DislikesAllergiesScreen: React.FC<DislikesAllergiesScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { dislikesAllergies, setDislikesAllergies } = useUserPreferencesStore();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Check if we're coming from profile by checking navigation state
  const navigationState = navigation.getState();
  const currentIndex = navigationState?.index || 0;
  const previousRoute = navigationState?.routes[currentIndex - 1];
  const isFromProfile = previousRoute?.name === 'Profile' || 
    navigationState?.routes.some(r => r.name === 'Profile');

  // Initialize selected options from stored preference
  useEffect(() => {
    if (dislikesAllergies && dislikesAllergies !== 'None' && dislikesAllergies !== 'no-preference') {
      // If dislikesAllergies is a string, split it (assuming comma-separated for multiple)
      const stored = dislikesAllergies.split(',').map(s => s.trim()).filter(s => s);
      setSelectedOptions(stored);
    } else {
      setSelectedOptions([]);
    }
  }, [dislikesAllergies]);

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
    let finalSelection = [...selectedOptions];
    
    // Add search text if provided
    if (searchText.trim()) {
      finalSelection.push(searchText.trim());
    }
    
    if (finalSelection.length === 0) {
      setDislikesAllergies('None');
    } else {
      // Join multiple selections with comma
      setDislikesAllergies(finalSelection.join(', '));
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
        <Text style={styles.headerTitle}>Dislikes / Allergies</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>Do you have any dislikes or allergies?</Text>
          <Text style={styles.description}>
            Your responses will help us tailor recipe recommendations to your preferences. You will still see some recipes that don't match your diet.
          </Text>
        </View>

        {/* Ingredient Options Grid Layout */}
        <View style={styles.optionsContainer}>
          <View style={styles.optionsGrid}>
            {INGREDIENT_OPTIONS.map((option) => {
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
                      size={20} 
                      color={isSelected ? '#FFFFFF' : '#1A1A1A'} 
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
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find ingredient"
              placeholderTextColor="#999999"
              value={searchText}
              onChangeText={setSearchText}
            />
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
    marginBottom: 16,
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
    marginLeft: 8,
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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

export default DislikesAllergiesScreen;
