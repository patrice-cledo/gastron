import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type IngredientSearchScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IngredientSearch'>;

interface IngredientSearchScreenProps {
  navigation: IngredientSearchScreenNavigationProp;
  route: {
    params?: {
      selectedIngredients?: string[];
      onSelect?: (ingredients: string[]) => void;
    };
  };
}

const ALL_INGREDIENTS = [
  { id: 'egg', label: 'Egg', icon: '🥚' },
  { id: 'gnocchi', label: 'Gnocchi', icon: '🍝' },
  { id: 'gochujang', label: 'Gochujang', icon: '🌶️' },
  { id: 'miso', label: 'Miso Paste', icon: '🍯' },
  { id: 'mushrooms', label: 'Mushrooms', icon: '🍄' },
  { id: 'pasta', label: 'Pasta', icon: '🍝' },
  { id: 'potato', label: 'Potato', icon: '🥔' },
  { id: 'spinach', label: 'Spinach', icon: '🥬' },
  { id: 'tofu', label: 'Tofu', icon: '🧈' },
  { id: 'chicken', label: 'Chicken', icon: '🍗' },
  { id: 'salmon', label: 'Salmon', icon: '🐟' },
  { id: 'onion', label: 'Onion', icon: '🧅' },
  { id: 'garlic', label: 'Garlic', icon: '🧄' },
  { id: 'tomato', label: 'Tomato', icon: '🍅' },
  { id: 'carrot', label: 'Carrot', icon: '🥕' },
  { id: 'rice', label: 'Rice', icon: '🌾' },
  { id: 'cheese', label: 'Cheese', icon: '🧀' },
  { id: 'bell-pepper', label: 'Bell Pepper', icon: '🫑' },
  { id: 'beef', label: 'Beef', icon: '🥩' },
  { id: 'pork', label: 'Pork', icon: '🥓' },
  { id: 'chorizo', label: 'Chorizo', icon: '🌭' },
  { id: 'nuts', label: 'Nuts', icon: '🥜' },
  { id: 'milk', label: 'Milk', icon: '🥛' },
  { id: 'coriander', label: 'Coriander', icon: '🌿' },
  { id: 'fish', label: 'Fish', icon: '🐟' },
];

const IngredientSearchScreen: React.FC<IngredientSearchScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const initialSelected = route.params?.selectedIngredients || [];
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(initialSelected);
  const [searchQuery, setSearchQuery] = useState('');

  const handleReturn = () => {
    // Pass selected ingredients back via navigation params
    navigation.navigate('Search', {
      selectedIngredients: selectedIngredients,
    } as any);
  };

  const handleBack = () => {
    handleReturn();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Search for an Ingredient"
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close" size={20} color="#999999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Selected Ingredients Chips or Empty State */}
        {selectedIngredients.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedContainer}
            contentContainerStyle={styles.selectedContent}
          >
            {selectedIngredients.map((ingredientId) => {
              const ingredient = ALL_INGREDIENTS.find(item => item.id === ingredientId);
              
              if (!ingredient) return null;
              
              return (
                <View key={ingredient.id} style={styles.selectedChip}>
                  <Text style={styles.selectedChipIcon}>{ingredient.icon}</Text>
                  <Text style={styles.selectedChipLabel}>{ingredient.label}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedIngredients(prev => prev.filter(id => id !== ingredient.id));
                    }}
                    style={styles.selectedChipRemove}
                  >
                    <Ionicons name="close" size={16} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>No ingredients selected</Text>
          </View>
        )}

        {/* Ingredient Tags Grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {ALL_INGREDIENTS
              .filter(ingredient =>
                !selectedIngredients.includes(ingredient.id) &&
                ingredient.label.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((ingredient) => {
                return (
                  <TouchableOpacity
                    key={ingredient.id}
                    style={styles.tag}
                    onPress={() => {
                      setSelectedIngredients(prev => [...prev, ingredient.id]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagIcon}>{ingredient.icon}</Text>
                    <Text style={styles.tagLabel}>
                      {ingredient.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </ScrollView>

        {/* Return Button */}
        <TouchableOpacity
          style={[styles.returnButton, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={handleReturn}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.returnButtonText}>RETURN TO PREVIOUS SCREEN</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  statusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusText: {
    fontSize: 14,
    color: '#999999',
  },
  selectedContainer: {
    maxHeight: 60,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  selectedChipIcon: {
    fontSize: 16,
  },
  selectedChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedChipRemove: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  tagLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  returnButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});

export default IngredientSearchScreen;
