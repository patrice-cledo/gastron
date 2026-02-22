import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type RecipeInfoScreenRouteProp = RouteProp<RootStackParamList, 'RecipeInfo'>;
type RecipeInfoScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RecipeInfo'
>;

const CUISINES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'French', 'Thai',
  'Mediterranean', 'American', 'Korean', 'Vietnamese', 'Greek', 'Spanish',
  'Middle Eastern', 'Caribbean', 'Other'
];

const TAG_CATEGORIES = {
  'Meal Type': [
    'Dinner', 'Breakfast', 'Lunch', 'Snack', 'Dessert', 'Salad', 'Drink',
    'Appetizer', 'Finger food', 'Side', 'Soup', 'Cocktail', 'Sauce', 'Dressing'
  ],
  'Diet': [
    'Vegetarian', 'Vegan', 'Pescatarian', 'Healthy', 'High Protein', 'Gluten-free',
    'No alcohol', 'Comfort food', 'Low-fat', 'Keto', 'Paleo', 'Dairy-free',
    'Low-sugar', 'Sugar-free', 'Low-carb', 'Kosher', 'Halal', 'FODMAP'
  ],
  'Other': [
    'Budget-friendly', 'Meal prep', 'One-Pot', 'Pantry staples', 'Freezer-friendly',
    'Entertaining', 'Weeknight dinner', 'Crowd-pleaser', 'Kid-friendly',
    'Allergy-friendly', 'Gourmet', 'Family recipe', 'Spicy', 'Crockpot'
  ]
};

const RecipeInfoScreen: React.FC = () => {
  const navigation = useNavigation<RecipeInfoScreenNavigationProp>();
  const route = useRoute<RecipeInfoScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { onSave, servings: initialServings, prepTime: initialPrepTime, cookTime: initialCookTime, cuisine: initialCuisine, tags: initialTags, sourceUrls: initialSourceUrls, description: initialDescription } = route.params;

  const [servings, setServings] = useState<string>(initialServings?.toString() || '');
  const [prepTime, setPrepTime] = useState<string>(initialPrepTime?.toString() || '');
  const [cookTime, setCookTime] = useState<string>(initialCookTime?.toString() || '');
  const [cuisine, setCuisine] = useState<string | null>(initialCuisine || null);
  const [tags, setTags] = useState<string[]>(initialTags || []);
  const [sourceUrls, setSourceUrls] = useState<string[]>(initialSourceUrls || ['', '', '']);
  const [description, setDescription] = useState<string>(initialDescription || '');
  const [newTag, setNewTag] = useState('');
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags || []);

  const handleSave = () => {
    onSave({
      servings: servings ? parseInt(servings, 10) : undefined,
      prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
      cookTime: cookTime ? parseInt(cookTime, 10) : undefined,
      cuisine: cuisine || undefined,
      tags,
      sourceUrls,
      description: description.trim() || undefined,
    });
    navigation.goBack();
  };

  const handleUpdateSourceUrl = (index: number, value: string) => {
    const updated = [...sourceUrls];
    updated[index] = value;
    setSourceUrls(updated);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleClearAllTags = () => {
    setSelectedTags([]);
  };

  const handleAddTags = () => {
    setTags(selectedTags);
    setShowTagsModal(false);
  };

  const handleOpenTagsModal = () => {
    setSelectedTags(tags);
    setShowTagsModal(true);
  };

  const handleSelectCuisine = (selectedCuisine: string) => {
    setCuisine(selectedCuisine);
    setShowCuisineModal(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F0' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPTION</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add a description for your recipe..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Servings, Prep Time, Cook Time */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Servings</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                placeholder="Add serves"
                placeholderTextColor="#999"
                value={servings}
                onChangeText={setServings}
                keyboardType="numeric"
              />
              {servings && <Text style={styles.inputSuffix}>serves</Text>}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Prep Time</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                placeholder="0"
                placeholderTextColor="#999"
                value={prepTime}
                onChangeText={setPrepTime}
                keyboardType="numeric"
              />
              <Text style={styles.inputSuffix}>mins</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Cook Time</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                placeholder="0"
                placeholderTextColor="#999"
                value={cookTime}
                onChangeText={setCookTime}
                keyboardType="numeric"
              />
              <Text style={styles.inputSuffix}>mins</Text>
            </View>
          </View>
        </View>

        {/* Cuisine and Tags */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowCuisineModal(true)}
          >
            <Text style={styles.rowLabel}>Cuisine</Text>
            <View style={styles.rowRight}>
              {cuisine ? (
                <Text style={styles.rowValue}>{cuisine}</Text>
              ) : (
                <Text style={styles.placeholderText}>Select</Text>
              )}
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={handleOpenTagsModal}
          >
            <Text style={styles.rowLabel}>Add tags</Text>
            <View style={styles.rowRight}>
              {tags.length > 0 ? (
                <Text style={styles.selectedTagsText} numberOfLines={1}>
                  {tags.join(', ')}
                </Text>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Recipe Source */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECIPE SOURCE</Text>
          {sourceUrls.map((url, index) => (
            <TextInput
              key={index}
              style={styles.urlInput}
              placeholder={`Paste URL ${index + 1}`}
              placeholderTextColor="#999"
              value={url}
              onChangeText={(value) => handleUpdateSourceUrl(index, value)}
              autoCapitalize="none"
              keyboardType="url"
            />
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cuisine Selection Modal */}
      <Modal
        visible={showCuisineModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCuisineModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCuisineModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Cuisine</Text>
                  <TouchableOpacity onPress={() => setShowCuisineModal(false)}>
                    <Ionicons name="close" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.cuisineList}>
                  {CUISINES.map((cuisineOption) => (
                    <TouchableOpacity
                      key={cuisineOption}
                      style={[
                        styles.cuisineOption,
                        cuisine === cuisineOption && styles.cuisineOptionSelected,
                      ]}
                      onPress={() => handleSelectCuisine(cuisineOption)}
                    >
                      <Text
                        style={[
                          styles.cuisineOptionText,
                          cuisine === cuisineOption && styles.cuisineOptionTextSelected,
                        ]}
                      >
                        {cuisineOption}
                      </Text>
                      {cuisine === cuisineOption && (
                        <Ionicons name="checkmark" size={20} color="#FF6B35" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Tags Selection Modal */}
      <Modal
        visible={showTagsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTagsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.tagsModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose tags</Text>
              <TouchableOpacity onPress={() => setShowTagsModal(false)}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.tagsList}
              contentContainerStyle={styles.tagsListContent}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(TAG_CATEGORIES).map(([category, categoryTags]) => (
                <View key={category} style={styles.tagCategory}>
                  <Text style={styles.tagCategoryTitle}>{category}</Text>
                  <View style={styles.tagsGrid}>
                    {categoryTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagButton,
                            isSelected && styles.tagButtonSelected,
                          ]}
                          onPress={() => handleToggleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.tagButtonText,
                              isSelected && styles.tagButtonTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.tagsModalFooter}>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={handleClearAllTags}
              >
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addTagsButton}
                onPress={handleAddTags}
              >
                <Text style={styles.addTagsButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  numberInput: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'right',
    minWidth: 60,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputSuffix: {
    fontSize: 16,
    color: '#999',
  },
  selectedTagsText: {
    fontSize: 16,
    color: '#1A1A1A',
    maxWidth: 200,
    marginRight: 8,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  descriptionInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  urlInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cuisineList: {
    maxHeight: 400,
  },
  cuisineOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cuisineOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  cuisineOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  cuisineOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  tagsModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    paddingTop: 12,
  },
  tagsList: {
    flex: 1,
  },
  tagsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tagCategory: {
    marginBottom: 24,
  },
  tagCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0DA',
    backgroundColor: '#FFFFFF',
  },
  tagButtonSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  tagButtonText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  tagButtonTextSelected: {
    color: '#FFFFFF',
  },
  tagsModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  clearAllButton: {
    flex: 1,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  addTagsButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addTagsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RecipeInfoScreen;

