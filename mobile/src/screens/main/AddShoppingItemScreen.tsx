import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { RootStackParamList } from '../../types/navigation';
import { useGroceriesStore } from '../../stores/groceriesStore';

type AddShoppingItemScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AddShoppingItemScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AddShoppingItemScreenNavigationProp>();
  const { addManualItem } = useGroceriesStore();
  
  const [inputValue, setInputValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input when screen loads
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAddItem = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !selectedItems.includes(trimmedValue)) {
      setSelectedItems([...selectedItems, trimmedValue]);
      setInputValue('');
      // TODO: Add suggestions logic here if needed
    }
  };

  const handleRemoveItem = (item: string) => {
    setSelectedItems(selectedItems.filter(i => i !== item));
  };

  const handleClearInput = () => {
    setInputValue('');
    inputRef.current?.focus();
  };

  const saveAndGoBack = () => {
    const trimmedInput = inputValue.trim();
    const itemsToSave = trimmedInput && !selectedItems.includes(trimmedInput)
      ? [...selectedItems, trimmedInput]
      : selectedItems;
    itemsToSave.forEach(item => {
      addManualItem(item);
    });
    navigation.goBack();
  };

  const handleReturnToShoppingList = () => {
    saveAndGoBack();
  };

  const handleBack = () => {
    saveAndGoBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a shopping item"
            placeholderTextColor="#999"
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            autoFocus
          />
          {inputValue.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearInput}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {selectedItems.length === 0 ? (
          <Text style={styles.emptyText}>No ingredients selected</Text>
        ) : (
          <View style={styles.selectedItemsContainer}>
            {selectedItems.map((item, index) => (
              <View key={index} style={styles.itemChip}>
                <Text style={styles.itemChipText}>{item}</Text>
                <TouchableOpacity
                  style={styles.removeChipButton}
                  onPress={() => handleRemoveItem(item)}
                >
                  <Ionicons name="close" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Return Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[styles.returnButton, selectedItems.length === 0 && !inputValue.trim() && styles.returnButtonDisabled]}
          onPress={handleReturnToShoppingList}
          disabled={selectedItems.length === 0 && !inputValue.trim()}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.returnButtonText}>RETURN TO SHOPPING LIST</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
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
    padding: 4,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  itemChipText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginRight: 6,
  },
  removeChipButton: {
    padding: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 16,
    gap: 8,
    opacity: 1,
  },
  returnButtonDisabled: {
    opacity: 0.5,
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AddShoppingItemScreen;
