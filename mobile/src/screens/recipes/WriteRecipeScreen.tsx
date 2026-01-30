import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import * as ImagePicker from 'expo-image-picker';
import { useRecipesStore } from '../../stores/recipesStore';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { Recipe, Ingredient, Step } from '../../types/recipe';
import { auth, storage, functions } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { BottomSheet } from '../../components/BottomSheet';

type WriteRecipeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'WriteRecipe'
>;

// Draggable Instruction Item Component
interface DraggableInstructionItemProps {
  instruction: { description: string; imageUri?: string; duration?: number };
  index: number;
  onUpdate: (value: string) => void;
  onImageUpdate: (imageUri: string | null) => void;
  onDurationUpdate: (duration: number | undefined) => void;
  onDelete: () => void;
  canDelete: boolean;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  dragOverIndex: number | null;
  isReordering: boolean;
}

const DraggableInstructionItem: React.FC<DraggableInstructionItemProps> = ({
  instruction,
  index,
  onUpdate,
  onImageUpdate,
  onDurationUpdate,
  onDelete,
  canDelete,
  onDragStart,
  onDragEnd,
  isDragging,
  dragOverIndex,
  isReordering,
}) => {
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showMenuBottomSheet, setShowMenuBottomSheet] = useState(false);
  const [timerValue, setTimerValue] = useState('');
  const translateY = useSharedValue(0);
  const isDraggingShared = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .enabled(isReordering)
    .onStart(() => {
      if (!isReordering) return;
      isDraggingShared.value = true;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((event) => {
      if (!isReordering) return;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!isReordering) return;
      translateY.value = withSpring(0);
      isDraggingShared.value = false;
      // Calculate target index based on translation
      const targetIndex = Math.round(index + event.translationY / 80);
      runOnJS(onDragEnd)(index, Math.max(0, Math.min(targetIndex, 100))); // Clamp to reasonable range
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: isDraggingShared.value ? 0.7 : 1,
      zIndex: isDraggingShared.value ? 1000 : 1,
    };
  });

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.instructionItemContainer,
            animatedStyle,
            isDragging && styles.draggingItem,
            dragOverIndex === index && styles.dragOverItem,
          ]}
        >
          {isReordering && (
            <TouchableOpacity style={styles.dragHandle} activeOpacity={0.7}>
              <Ionicons name="reorder-three-outline" size={24} color="#999" />
            </TouchableOpacity>
          )}
          {!instruction.imageUri ? (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={() => {
                Alert.alert(
                  'Add Image',
                  'Choose an option',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Take Photo', onPress: async () => {
                      try {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') {
                          Alert.alert('Permission needed', 'Camera permission is required.');
                          return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                          onImageUpdate(result.assets[0].uri);
                        }
                      } catch (error) {
                        console.error('Error taking photo:', error);
                        Alert.alert('Error', 'Failed to take photo. Please try again.');
                      }
                    }},
                    { text: 'Choose from Library', onPress: async () => {
                      try {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') {
                          Alert.alert('Permission needed', 'Photo library permission is required.');
                          return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                          onImageUpdate(result.assets[0].uri);
                        }
                      } catch (error) {
                        console.error('Error choosing image:', error);
                        Alert.alert('Error', 'Failed to choose image. Please try again.');
                      }
                    }},
                  ],
                  { cancelable: true }
                );
              }}
            >
                <Ionicons name="camera-outline" size={20} color="#FF6B35" />
            </TouchableOpacity>
          ) : (
            <View style={styles.instructionImageThumbnail}>
              <Image source={{ uri: instruction.imageUri }} style={styles.instructionImageThumbnailImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => onImageUpdate(null)}
              >
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.instructionContent}>
            <TextInput
              style={[styles.instructionInput]}
              placeholder={`Step ${index + 1}`}
              placeholderTextColor="#999"
              value={instruction.description}
              onChangeText={onUpdate}
              multiline
            />
            {instruction.duration && (
              <View style={styles.instructionTimerDisplay}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.instructionTimerText}>{instruction.duration} min</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.instructionMenuButton}
            onPress={() => setShowMenuBottomSheet(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
      
      {/* Timer Modal */}
      <Modal
        visible={showTimerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTimerModal(false)}>
          <View style={styles.timerModalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.timerModalContent}>
                <Text style={styles.timerModalTitle}>
                  {instruction.duration ? 'Edit Timer' : 'Add Timer'}
                </Text>
                <Text style={styles.timerModalSubtitle}>Enter duration in minutes</Text>
                <TextInput
                  style={styles.timerModalInput}
                  placeholder="Minutes"
                  placeholderTextColor="#999"
                  value={timerValue}
                  onChangeText={setTimerValue}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.timerModalButtons}>
                  {instruction.duration && (
                    <TouchableOpacity
                      style={[styles.timerModalButton, styles.timerModalButtonRemove]}
                      onPress={() => {
                        onDurationUpdate(undefined);
                        setShowTimerModal(false);
                      }}
                    >
                      <Text style={styles.timerModalButtonRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.timerModalButton, styles.timerModalButtonCancel]}
                    onPress={() => setShowTimerModal(false)}
                  >
                    <Text style={styles.timerModalButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.timerModalButton, styles.timerModalButtonSave]}
                    onPress={() => {
                      const num = parseInt(timerValue.trim(), 10);
                      if (!isNaN(num) && num > 0) {
                        onDurationUpdate(num);
                      }
                      setShowTimerModal(false);
                    }}
                  >
                    <Text style={styles.timerModalButtonSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      
      {/* Instruction Menu Bottom Sheet */}
      <BottomSheet
        visible={showMenuBottomSheet}
        onClose={() => setShowMenuBottomSheet(false)}
        height="25%"
      >
        <View style={styles.instructionMenuBottomSheetContent}>
          {canDelete && (
            <TouchableOpacity
              style={styles.instructionMenuOption}
              onPress={() => {
                setShowMenuBottomSheet(false);
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.instructionMenuOptionText, styles.instructionMenuOptionTextDestructive]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.instructionMenuOption}
            onPress={() => {
              setShowMenuBottomSheet(false);
              setTimerValue(instruction.duration ? instruction.duration.toString() : '');
              setShowTimerModal(true);
            }}
          >
            <Ionicons name="time-outline" size={20} color="#1A1A1A" />
            <Text style={styles.instructionMenuOptionText}>
              {instruction.duration ? 'Edit Timer' : 'Add Timer'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
};

// Draggable Ingredient Item Component
interface DraggableIngredientItemProps {
  ingredient: string;
  index: number;
  onUpdate: (value: string) => void;
  onDelete: () => void;
  canDelete: boolean;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  dragOverIndex: number | null;
  isReordering: boolean;
}

const DraggableIngredientItem: React.FC<DraggableIngredientItemProps> = ({
  ingredient,
  index,
  onUpdate,
  onDelete,
  canDelete,
  onDragStart,
  onDragEnd,
  isDragging,
  dragOverIndex,
  isReordering,
}) => {
  const translateY = useSharedValue(0);
  const isDraggingShared = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .enabled(isReordering)
    .onStart(() => {
      if (!isReordering) return;
      isDraggingShared.value = true;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((event) => {
      if (!isReordering) return;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!isReordering) return;
      translateY.value = withSpring(0);
      isDraggingShared.value = false;
      const targetIndex = Math.round(index + event.translationY / 80);
      runOnJS(onDragEnd)(index, Math.max(0, Math.min(targetIndex, 100)));
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: isDraggingShared.value ? 0.7 : 1,
      zIndex: isDraggingShared.value ? 1000 : 1,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.ingredientItemContainer,
          animatedStyle,
          isDragging && styles.draggingItem,
          dragOverIndex === index && styles.dragOverItem,
        ]}
      >
        {isReordering && (
          <TouchableOpacity style={styles.dragHandle} activeOpacity={0.7}>
            <Ionicons name="reorder-three-outline" size={24} color="#999" />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.ingredientInput}
          placeholder="Add ingredient"
          placeholderTextColor="#999"
          value={ingredient}
          onChangeText={onUpdate}
        />
        {canDelete && (
          <TouchableOpacity
            style={styles.ingredientDeleteButton}
            onPress={onDelete}
          >
            <Ionicons name="close" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

// Ingredient List Component with drag and drop
interface IngredientListProps {
  ingredients: string[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdate: (index: number, value: string) => void;
  onDelete: (index: number) => void;
  isReordering: boolean;
}

const IngredientList: React.FC<IngredientListProps> = ({
  ingredients,
  onReorder,
  onUpdate,
  onDelete,
  isReordering,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    if (fromIndex !== toIndex && toIndex >= 0 && toIndex < ingredients.length) {
      onReorder(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <GestureHandlerRootView>
      {ingredients.map((ingredient, index) => (
        <DraggableIngredientItem
          key={index}
          ingredient={ingredient}
          index={index}
          onUpdate={(value) => onUpdate(index, value)}
          onDelete={() => onDelete(index)}
          canDelete={ingredients.length > 1}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          isDragging={draggedIndex === index}
          dragOverIndex={dragOverIndex}
          isReordering={isReordering}
        />
      ))}
    </GestureHandlerRootView>
  );
};

// Instruction List Component with drag and drop
interface InstructionListProps {
  instructions: Array<{ description: string; imageUri?: string; duration?: number }>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdate: (index: number, value: string) => void;
  onImageUpdate: (index: number, imageUri: string | null) => void;
  onDurationUpdate: (index: number, duration: number | undefined) => void;
  onDelete: (index: number) => void;
  isReordering: boolean;
}

const InstructionList: React.FC<InstructionListProps> = ({
  instructions,
  onReorder,
  onUpdate,
  onImageUpdate,
  onDurationUpdate,
  onDelete,
  isReordering,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    if (fromIndex !== toIndex && toIndex >= 0 && toIndex < instructions.length) {
      onReorder(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <GestureHandlerRootView>
      {instructions.map((instruction, index) => (
        <DraggableInstructionItem
          key={index}
          instruction={instruction}
          index={index}
          onUpdate={(value) => onUpdate(index, value)}
          onImageUpdate={(imageUri) => onImageUpdate(index, imageUri)}
          onDurationUpdate={(duration) => onDurationUpdate(index, duration)}
          onDelete={() => onDelete(index)}
          canDelete={instructions.length > 1}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          isDragging={draggedIndex === index}
          dragOverIndex={dragOverIndex}
          isReordering={isReordering}
        />
      ))}
    </GestureHandlerRootView>
  );
};

const WriteRecipeScreen: React.FC<WriteRecipeScreenProps> = ({ route }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { addRecipe, updateRecipe, recipes } = useRecipesStore();
  const { collections, addCollection, loadCollections } = useCollectionsStore();

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [servings, setServings] = useState<number | null>(null);
  const [prepTime, setPrepTime] = useState<number>(0);
  const [cookTime, setCookTime] = useState<number>(0);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>(['', '', '']);
  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [fats, setFats] = useState<number | null>(null);
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [instructions, setInstructions] = useState<Array<{ description: string; imageUri?: string; duration?: number }>>([{ description: '' }]);
  const [equipment, setEquipment] = useState<Array<{ name: string; imageUri?: string }>>([{ name: '' }]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [showCollectionsBottomSheet, setShowCollectionsBottomSheet] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isReorderingIngredients, setIsReorderingIngredients] = useState(false);
  const [isReorderingInstructions, setIsReorderingInstructions] = useState(false);

  // Get current user and load collections
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
      if (user) {
        loadCollections();
      }
    });
    return () => unsubscribe();
  }, [loadCollections]);

  // Load recipe data if editing, or imported data if creating
  useEffect(() => {
    if (route.params?.recipeId) {
      // Edit mode - load recipe data
      setIsEditing(true);
      setIsLoadingRecipe(true);
      
      const recipeToEdit = recipes.find(r => r.id === route.params?.recipeId);
      if (recipeToEdit) {
        setTitle(recipeToEdit.title || '');
        setImageUri(typeof recipeToEdit.image === 'string' ? recipeToEdit.image : null);
        setServings(recipeToEdit.servings || null);
        setPrepTime(recipeToEdit.prepTime || 0);
        setCookTime(recipeToEdit.cookTime || 0);
        const recipeAny = recipeToEdit as any;
        setCuisine(recipeAny.category || recipeAny.cuisine || null);
        setTags(recipeToEdit.tags || []);
        
        // Set description if available
        if (recipeAny.description) {
          setDescription(recipeAny.description);
        }
        
        // Convert ingredients to string array
        if (recipeToEdit.ingredients && recipeToEdit.ingredients.length > 0) {
          setIngredients(recipeToEdit.ingredients.map(ing => {
            const parts = [];
            if (ing.amount) parts.push(ing.amount);
            if (ing.unit) parts.push(ing.unit);
            if (ing.name) parts.push(ing.name);
            return parts.join(' ');
          }));
        } else {
          setIngredients(['']);
        }
        
        // Convert steps to instruction objects with images and duration
        if (recipeToEdit.steps && recipeToEdit.steps.length > 0) {
          setInstructions(recipeToEdit.steps.map(step => ({
            description: step.description || '',
            imageUri: step.image || undefined,
            duration: step.duration,
          })));
        } else {
          setInstructions([{ description: '' }]);
        }
        
        // Set nutrition
        if (recipeToEdit.nutrition) {
          setCalories(recipeToEdit.nutrition.calories || null);
          setProtein(recipeToEdit.nutrition.protein || null);
          setCarbs(recipeToEdit.nutrition.carbs || null);
          setFats(recipeToEdit.nutrition.fats || null);
        }
        
        // Set description if available
        if ((recipeToEdit as any).description) {
          setDescription((recipeToEdit as any).description);
        }
        
        // Set notes if available
        if ((recipeToEdit as any).notes) {
          setNotes((recipeToEdit as any).notes);
        }
        
        // Set collections if available (support both old cookbook and new collections format)
        if ((recipeToEdit as any).collections && Array.isArray((recipeToEdit as any).collections)) {
          setSelectedCollections((recipeToEdit as any).collections);
        } else if ((recipeToEdit as any).cookbook) {
          setSelectedCollections([(recipeToEdit as any).cookbook]);
        }
        
        // Set equipment if available
        if ((recipeToEdit as any).equipment && Array.isArray((recipeToEdit as any).equipment)) {
          const equipmentList = (recipeToEdit as any).equipment.map((eq: any) => ({
            name: eq.name || eq || '',
            imageUri: eq.image || undefined,
          }));
          setEquipment(equipmentList.length > 0 ? equipmentList : [{ name: '' }]);
        } else {
          setEquipment([{ name: '' }]);
        }
        
        setIsLoadingRecipe(false);
      } else {
        // Recipe not found in local store, try to load from Firestore
        // TODO: Load from Firestore if not in local store
        setIsLoadingRecipe(false);
      }
    } else if (route.params?.importedData) {
      // Create mode with imported data
      setIsEditing(false);
      const { 
        ingredients: importedIngredients, 
        instructions: importedInstructions, 
        imageUri: importedImageUri,
        title: importedTitle,
        description: importedDescription,
        notes: importedNotes,
        servings: importedServings,
        prepTime: importedPrepTime,
        cookTime: importedCookTime,
        nutrition: importedNutrition,
      } = route.params.importedData;
      
      // Set title if provided
      if (importedTitle && importedTitle.trim()) {
        setTitle(importedTitle.trim());
      }
      
      // Set description if provided
      if (importedDescription && importedDescription.trim()) {
        setDescription(importedDescription.trim());
      }
      
      // Set ingredients - ensure at least one empty field if array is empty
      if (importedIngredients && importedIngredients.length > 0) {
        setIngredients(importedIngredients);
      }
      
      // Set instructions - ensure at least one empty field if array is empty
      if (importedInstructions && importedInstructions.length > 0) {
        setInstructions(importedInstructions.map(inst => ({ description: inst })));
      }
      
      // Set image if provided
      if (importedImageUri) {
        setImageUri(importedImageUri);
      }
      
      // Set Info section data if provided
      if (importedServings !== undefined && importedServings !== null) {
        setServings(importedServings);
      }
      if (importedPrepTime !== undefined && importedPrepTime !== null) {
        setPrepTime(importedPrepTime);
      }
      if (importedCookTime !== undefined && importedCookTime !== null) {
        setCookTime(importedCookTime);
      }
      
      // Set Nutrition data if provided
      if (importedNutrition) {
        if (importedNutrition.calories !== undefined && importedNutrition.calories !== null) {
          setCalories(importedNutrition.calories);
        }
        if (importedNutrition.protein !== undefined && importedNutrition.protein !== null) {
          setProtein(importedNutrition.protein);
        }
        if (importedNutrition.carbs !== undefined && importedNutrition.carbs !== null) {
          setCarbs(importedNutrition.carbs);
        }
        if (importedNutrition.fats !== undefined && importedNutrition.fats !== null) {
          setFats(importedNutrition.fats);
        }
      }
      
      // Set notes if provided
      if (importedNotes && importedNotes.trim()) {
        setNotes(importedNotes.trim());
      }
    } else {
      setIsEditing(false);
    }
  }, [route.params, recipes]);

  const hasUnsavedChanges = () => {
    return (
      title.trim() !== '' ||
      imageUri !== null ||
      servings !== null ||
      prepTime !== 0 ||
      cookTime !== 0 ||
      cuisine !== null ||
      tags.length > 0 ||
      sourceUrls.some(url => url.trim() !== '') ||
      calories !== null ||
      protein !== null ||
      carbs !== null ||
      fats !== null ||
      ingredients.some(ing => ing.trim() !== '') ||
      instructions.some(inst => inst.description.trim() !== '') ||
      equipment.some(eq => eq.name.trim() !== '') ||
      notes.trim() !== ''
    );
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Photo',
      'Choose an option',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: handleChooseFromLibrary,
        },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri: string, userId: string): Promise<string | null> => {
    try {
      console.log('📤 Starting image upload for URI:', uri.substring(0, 50) + '...');
      
      // For React Native, we need to convert the local URI to a blob
      // Using fetch with the file:// URI should work on most platforms
      let blob: Blob;
      
      if (uri.startsWith('file://') || uri.startsWith('content://')) {
        // For local files, use fetch which works in React Native
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        blob = await response.blob();
      } else {
        // For remote URIs, use fetch directly
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        blob = await response.blob();
      }
      
      console.log('📦 Blob created, size:', blob.size, 'bytes');
      console.log('📦 Blob type:', blob.type);
      
      // Create a storage reference with user ID and timestamp
      // Path structure: recipes/{userId}/{timestamp}-{random}.jpg
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomId}.jpg`;
      const storagePath = `recipes/${userId}/${fileName}`;
      const imageRef = ref(storage, storagePath);
      
      console.log('📤 Uploading to storage path:', storagePath);
      console.log('📤 Full storage reference:', imageRef.fullPath);
      console.log('👤 User ID:', userId);
      console.log('🔐 Auth state:', auth.currentUser ? 'authenticated' : 'not authenticated');
      console.log('🔐 Auth UID:', auth.currentUser?.uid);
      
      // Upload the file with a 5-second timeout to prevent hanging
      // This is especially important if Storage emulator is not running
      console.log('🚀 Starting uploadBytes...');
      const uploadPromise = uploadBytes(imageRef, blob);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Image upload timed out after 5 seconds. Storage emulator may not be running.'));
        }, 5000);
      });
      
      await Promise.race([uploadPromise, timeoutPromise]);
      
      console.log('✅ Upload complete, getting download URL...');
      
      // Get the download URL (also with timeout)
      const getUrlPromise = getDownloadURL(imageRef);
      const urlTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Getting download URL timed out after 5 seconds.'));
        }, 5000);
      });
      
      const downloadURL = await Promise.race([getUrlPromise, urlTimeoutPromise]);
      console.log('✅ Download URL obtained:', downloadURL);
      
      return downloadURL;
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        uri: uri.substring(0, 50) + '...',
      });
      
      // Handle specific storage errors
      if (error?.code === 'storage/unauthorized' || error?.code === 'storage/permission-denied') {
        console.error('🚫 Storage permission denied. User may not be authenticated or Storage rules may need to be updated.');
        console.error('💡 Make sure:');
        console.error('   1. User is authenticated (userId:', userId, ')');
        console.error('   2. Storage emulator is running');
        console.error('   3. Storage rules allow uploads to recipes/{userId}/');
      } else if (error?.code === 'storage/retry-limit-exceeded' || 
          error?.code === 'storage/unavailable' ||
          error?.message?.includes('timeout') ||
          error?.message?.includes('Storage emulator')) {
        console.warn('💡 Storage emulator might not be running. Recipe will be saved without image.');
      }
      
      return null;
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a recipe title');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to save recipes');
      return;
    }

    // Validate ingredients
    const validIngredients = ingredients.filter((ing) => ing.trim() !== '');
    if (validIngredients.length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient');
      return;
    }

    // Validate steps
    const validSteps = instructions.filter((inst) => inst.description.trim() !== '');
    if (validSteps.length === 0) {
      Alert.alert('Error', 'Please add at least one instruction step');
      return;
    }

    setIsSaving(true);

    // Safety mechanism: Always reset isSaving after 35 seconds maximum
    const safetyTimeout = setTimeout(() => {
      console.error('🚨 Safety timeout: Resetting save state after 35 seconds');
      setIsSaving(false);
      Alert.alert('Error', 'Recipe save is taking too long. Please check if Firebase emulators are running and try again.');
    }, 35000);

    try {
      console.log('📝 Starting recipe save process...');
      
      // Upload image first if provided (but don't block on failure)
      // Use a separate promise that always resolves to prevent blocking
      let imageUrl: string | undefined = undefined;
      if (imageUri) {
        // Verify user is authenticated before attempting upload
        if (!userId || !auth.currentUser) {
          console.warn('⚠️ User not authenticated, skipping image upload');
        } else {
          console.log('📸 Uploading image...');
          console.log('👤 Authenticated user ID:', userId);
          
          // Run image upload in parallel, don't await it blocking
          const imageUploadPromise = (async () => {
            try {
              // Add a 5-second timeout for image upload to prevent hanging
              const uploadTimeout = new Promise<string | null>((resolve) => {
                setTimeout(() => {
                  console.warn('⏱️ Image upload timeout (5s), continuing without image');
                  resolve(null);
                }, 5000);
              });
              
              const uploadPromise = uploadImage(imageUri, userId);
              const uploadedUrl = await Promise.race([uploadPromise, uploadTimeout]);
              
              if (uploadedUrl) {
                console.log('✅ Image uploaded:', uploadedUrl);
                return uploadedUrl;
              } else {
                console.warn('⚠️ Image upload failed or timed out, continuing without image');
                return null;
              }
            } catch (error: any) {
              console.warn('⚠️ Image upload error, continuing without image:', error.message);
              return null;
            }
          })();
          
          // Wait for image upload with a maximum 6-second timeout
          try {
            const imageTimeout = new Promise<string | undefined>((resolve) => {
              setTimeout(() => resolve(undefined), 6000);
            });
            const result = await Promise.race([imageUploadPromise, imageTimeout]);
            imageUrl = result || undefined;
          } catch (error: any) {
            console.warn('⚠️ Image upload timed out, continuing without image');
            imageUrl = undefined;
          }
        }
      }

      // Convert ingredients to RecipeIngredient format (backend format)
      console.log('🔧 Converting ingredients...');
      const recipeIngredients = validIngredients.map((ing, index) => {
        // Try to parse "amount unit name" or just "name"
        const parts = ing.trim().split(/\s+/);
        if (parts.length >= 3) {
          return {
            id: `ing-${Date.now()}-${index}`,
            name: parts.slice(2).join(' '),
            amount: parts[0],
            unit: parts[1],
          };
        } else {
          return {
            id: `ing-${Date.now()}-${index}`,
            name: ing.trim(),
            amount: '1',
          };
        }
      });

      // Convert instructions to RecipeStep format (backend format)
      console.log('🔧 Converting steps...');
      // Upload step images first
      const recipeSteps = await Promise.all(validSteps.map(async (inst, index) => {
        let stepImageUrl: string | undefined = undefined;
        
        // Upload step image if present
        if (inst.imageUri && userId && auth.currentUser) {
          try {
            console.log(`📸 Uploading image for step ${index + 1}...`);
            const uploadTimeout = new Promise<string | null>((resolve) => {
              setTimeout(() => {
                console.warn(`⏱️ Step ${index + 1} image upload timeout, continuing without image`);
                resolve(null);
              }, 5000);
            });
            
            const uploadPromise = uploadImage(inst.imageUri, userId);
            const uploadedUrl = await Promise.race([uploadPromise, uploadTimeout]);
            stepImageUrl = uploadedUrl || undefined;
            
            if (stepImageUrl) {
              console.log(`✅ Step ${index + 1} image uploaded:`, stepImageUrl);
            }
          } catch (error: any) {
            console.warn(`⚠️ Step ${index + 1} image upload error, continuing without image:`, error.message);
            stepImageUrl = undefined;
          }
        }
        
        return {
          id: `step-${Date.now()}-${index}`,
          order: index + 1,
          description: inst.description.trim(),
          image: stepImageUrl,
          ...(inst.duration !== undefined && inst.duration !== null && { duration: inst.duration }),
        };
      }));

      // Prepare nutrition data if provided
      // Ensure all values are numbers (not null) for backend validation
      const nutritionData = (calories !== null || protein !== null || carbs !== null || fats !== null)
        ? {
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fats: Number(fats) || 0,
          }
        : undefined;

      // Prepare request data - only include defined values (remove undefined)
      // Validate and prepare all data points from UI
      const requestData: any = {
        title: title.trim(),
        ingredients: recipeIngredients,
        steps: recipeSteps,
        isPublic: false, // Private by default
      };

      // Only add optional fields if they have values
      // Description (from Info section)
      if (description.trim()) {
        requestData.description = description.trim();
      }
      
      // Notes (from Notes section)
      if (notes.trim()) {
        requestData.notes = notes.trim();
      }
      
      // Image (from Image picker)
      if (imageUrl) {
        requestData.image = imageUrl;
      }
      
      // Prep time (from Info screen)
      if (prepTime > 0) {
        requestData.prepTime = prepTime; // Already a number
      }
      
      // Cook time (from Info screen)
      if (cookTime > 0) {
        requestData.cookTime = cookTime; // Already a number
      }
      
      // Servings (from Info screen)
      if (servings && servings > 0) {
        requestData.servings = servings; // Already a number
      }
      
      // Nutrition (from Nutrition screen)
      if (nutritionData) {
        requestData.nutrition = {
          calories: Number(nutritionData.calories) || 0,
          protein: Number(nutritionData.protein) || 0,
          carbs: Number(nutritionData.carbs) || 0,
          fats: Number(nutritionData.fats) || 0,
        };
      }
      
      // Tags (from Info screen)
      if (tags.length > 0) {
        requestData.tags = tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim());
      }
      
      // Cuisine (from Info screen)
      if (cuisine && cuisine.trim()) {
        requestData.cuisine = cuisine.trim();
      }
      
      // Source URLs (from Info screen)
      const validSourceUrls = sourceUrls.filter(url => url.trim() !== '');
      if (validSourceUrls.length > 0) {
        requestData.sourceUrls = validSourceUrls.map(url => url.trim());
      }

      // Collections (from Collections section)
      if (selectedCollections.length > 0) {
        // Filter out 'Uncategorized' and empty strings
        const validCollections = selectedCollections.filter(
          col => col && col.trim() && col !== 'Uncategorized'
        );
        if (validCollections.length > 0) {
          requestData.collections = validCollections;
        }
      }

      // Equipment (from Equipment section)
      const validEquipment = equipment.filter((eq) => eq.name.trim() !== '');
      if (validEquipment.length > 0) {
        // Upload equipment images first
        const recipeEquipment = await Promise.all(validEquipment.map(async (eq, index) => {
          let equipmentImageUrl: string | undefined = undefined;
          
          // Upload equipment image if present
          if (eq.imageUri && userId && auth.currentUser) {
            try {
              console.log(`📸 Uploading image for equipment ${index + 1}...`);
              const uploadTimeout = new Promise<string | null>((resolve) => {
                setTimeout(() => {
                  console.warn(`⏱️ Equipment ${index + 1} image upload timeout, continuing without image`);
                  resolve(null);
                }, 5000);
              });
              
              const uploadPromise = uploadImage(eq.imageUri, userId);
              const uploadedUrl = await Promise.race([uploadPromise, uploadTimeout]);
              equipmentImageUrl = uploadedUrl || undefined;
              
              if (equipmentImageUrl) {
                console.log(`✅ Equipment ${index + 1} image uploaded:`, equipmentImageUrl);
              }
            } catch (error: any) {
              console.warn(`⚠️ Equipment ${index + 1} image upload error, continuing without image:`, error.message);
              equipmentImageUrl = undefined;
            }
          }
          
          return {
            id: `eq-${Date.now()}-${index}`,
            name: eq.name.trim(),
            ...(equipmentImageUrl && { image: equipmentImageUrl }),
          };
        }));
        
        requestData.equipment = recipeEquipment;
      } else if (isEditing) {
        // When editing, explicitly set empty array to clear equipment
        requestData.equipment = [];
      }

      // Log all data being sent for debugging
      if (isEditing) {
        console.log('📤 Calling updateRecipe Cloud Function...');
      } else {
        console.log('📤 Calling createRecipe Cloud Function...');
      }
      console.log('📋 Complete request data:', JSON.stringify(requestData, null, 2));
      console.log('📊 Data summary:', {
        title: requestData.title,
        ingredientsCount: requestData.ingredients.length,
        stepsCount: requestData.steps.length,
        equipmentCount: requestData.equipment?.length || 0,
        hasImage: !!requestData.image,
        hasNotes: !!requestData.notes,
        prepTime: requestData.prepTime,
        cookTime: requestData.cookTime,
        servings: requestData.servings,
        hasNutrition: !!requestData.nutrition,
        tagsCount: requestData.tags?.length || 0,
        cuisine: requestData.cuisine,
        sourceUrlsCount: requestData.sourceUrls?.length || 0,
        isPublic: requestData.isPublic,
      });
      console.log('Functions instance:', functions);
      console.log('Current user:', auth.currentUser?.uid);
      
      // Verify user is authenticated
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Add timeout handling (20 seconds - shorter to fail faster)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Function call timed out after 20 seconds. Please check if the Firebase emulators are running.'));
        }, 20000);
      });
      
      console.log('⏳ Waiting for function response...');
      let result: { data: { recipeId: string; recipe: any } };
      
      if (isEditing && route.params?.recipeId) {
        // Update existing recipe
        const updateRecipeFunction = httpsCallable(functions, 'updateRecipe');
        requestData.recipeId = route.params.recipeId;
        
        try {
          result = await Promise.race([
            updateRecipeFunction(requestData),
            timeoutPromise,
          ]) as { data: { recipeId: string; recipe: any } };
          console.log('📥 Received response from function');
        } catch (error: any) {
          clearTimeout(safetyTimeout);
          throw error;
        }
        
        console.log('✅ Recipe updated successfully:', result.data.recipeId);
      } else {
        // Create new recipe
        const createRecipeFunction = httpsCallable(functions, 'createRecipe');
        
        try {
          result = await Promise.race([
            createRecipeFunction(requestData),
            timeoutPromise,
          ]) as { data: { recipeId: string; recipe: any } };
          console.log('📥 Received response from function');
        } catch (error: any) {
          clearTimeout(safetyTimeout);
          throw error;
        }
        
        console.log('✅ Recipe created successfully:', result.data.recipeId);
      }
      
      const { recipeId, recipe: createdRecipe } = result.data;
      
      // Log what was received from backend to verify all data was saved
      console.log('📥 Backend response summary:', {
        recipeId,
        title: createdRecipe.title,
        hasDescription: !!createdRecipe.description,
        hasNotes: !!createdRecipe.notes,
        hasImage: !!createdRecipe.image,
        prepTime: createdRecipe.prepTime,
        cookTime: createdRecipe.cookTime,
        servings: createdRecipe.servings,
        hasNutrition: !!createdRecipe.nutrition,
        nutrition: createdRecipe.nutrition,
        tagsCount: createdRecipe.tags?.length || 0,
        tags: createdRecipe.tags,
        cuisine: createdRecipe.cuisine,
        sourceUrlsCount: createdRecipe.sourceUrls?.length || 0,
        sourceUrls: createdRecipe.sourceUrls,
        isPublic: createdRecipe.isPublic,
        ingredientsCount: createdRecipe.ingredients?.length || 0,
        stepsCount: createdRecipe.steps?.length || 0,
        userId: createdRecipe.userId,
        createdAt: createdRecipe.createdAt,
        updatedAt: createdRecipe.updatedAt,
      });

      // Convert backend recipe format to client Recipe format for Zustand store
      // Backend returns timestamps as numbers (milliseconds), convert to ISO strings
      const clientRecipe: Recipe = {
        id: recipeId,
        title: createdRecipe.title,
        description: createdRecipe.description,
        image: createdRecipe.image || imageUri || undefined,
        ingredients: (createdRecipe.ingredients || recipeIngredients).map((ing: any) => ({
          id: ing.id,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
        })),
        // Prefer createdRecipe.steps (from backend) as it has auto-extracted duration
        // Fall back to recipeSteps (local) if backend steps aren't available
        steps: (createdRecipe.steps || recipeSteps || []).map((step: any) => ({
          id: step.id,
          order: step.order,
          description: step.description,
          image: step.image,
          // Include duration if present (backend extracts it automatically)
          ...(step.duration !== undefined && step.duration !== null && { duration: step.duration }),
        })),
        equipment: (createdRecipe.equipment || requestData.equipment || []).map((eq: any) => ({
          id: eq.id,
          name: eq.name || eq,
          ...(eq.image && { image: eq.image }),
        })),
        prepTime: createdRecipe.prepTime,
        cookTime: createdRecipe.cookTime,
        servings: createdRecipe.servings,
        nutrition: createdRecipe.nutrition,
        tags: createdRecipe.tags || [],
        userId: userId,
        createdAt: new Date(createdRecipe.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(createdRecipe.updatedAt || Date.now()).toISOString(),
      };
      
      console.log('💾 Saving to local Zustand store:', {
        id: clientRecipe.id,
        title: clientRecipe.title,
        ingredientsCount: clientRecipe.ingredients.length,
        stepsCount: clientRecipe.steps.length,
        hasImage: !!clientRecipe.image,
        prepTime: clientRecipe.prepTime,
        cookTime: clientRecipe.cookTime,
        servings: clientRecipe.servings,
        hasNutrition: !!clientRecipe.nutrition,
        tags: clientRecipe.tags,
        tagsCount: clientRecipe.tags?.length || 0,
        tagsIsArray: Array.isArray(clientRecipe.tags),
      });

      // Save to Zustand store for local state management
      if (isEditing) {
        updateRecipe(recipeId, clientRecipe);
      } else {
        addRecipe(clientRecipe);
      }

      // Clear safety timeout on success
      clearTimeout(safetyTimeout);
      setIsSaving(false);
      
      if (isEditing) {
        Alert.alert('Success', 'Recipe updated!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to recipe detail to see updated recipe
              navigation.navigate('RecipeDetail', { recipeId });
            }
          }
        ]);
      } else {
        Alert.alert('Success', 'Recipe saved!');
        // Navigate to Recipes tab instead of going back
        (navigation as any).navigate('Home', { screen: 'Recipes' });
      }
    } catch (error: any) {
      // Clear safety timeout on error
      clearTimeout(safetyTimeout);
      setIsSaving(false);
      console.error('❌ Error saving recipe:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        stack: error?.stack,
      });
      
      let errorMessage = 'Failed to save recipe. Please try again.';
      
      if (error?.code === 'unauthenticated') {
        errorMessage = 'You must be logged in to save recipes.';
      } else if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid recipe data. Please check your inputs.';
      } else if (error?.code === 'not-found') {
        errorMessage = 'Recipe function not found. Please ensure the backend is running.';
      } else if (error?.code === 'unavailable') {
        errorMessage = 'Service unavailable. Please check if the Firebase emulators are running.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, '']);
  };

  const handleAddInstruction = () => {
    setInstructions([...instructions, { description: '' }]);
  };

  const handleUpdateIngredient = (index: number, value: string) => {
    const updated = [...ingredients];
    updated[index] = value;
    setIngredients(updated);
  };

  const handleDeleteIngredient = (index: number) => {
    if (ingredients.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one ingredient.');
      return;
    }
    const updated = ingredients.filter((_, i) => i !== index);
    setIngredients(updated);
  };

  const handleUpdateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], description: value };
    setInstructions(updated);
  };

  const handleUpdateInstructionImage = (index: number, imageUri: string | null) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], imageUri: imageUri || undefined };
    setInstructions(updated);
  };

  const handleUpdateInstructionDuration = (index: number, duration: number | undefined) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], duration: duration };
    setInstructions(updated);
  };

  const handleDeleteInstruction = (index: number) => {
    if (instructions.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one instruction step.');
      return;
    }
    const updated = instructions.filter((_, i) => i !== index);
    setInstructions(updated);
  };

  const handleAddEquipment = () => {
    setEquipment([...equipment, { name: '' }]);
  };

  const handleUpdateEquipment = (index: number, value: string) => {
    const updated = [...equipment];
    updated[index] = { ...updated[index], name: value };
    setEquipment(updated);
  };

  const handleUpdateEquipmentImage = (index: number, imageUri: string | null) => {
    const updated = [...equipment];
    updated[index] = { ...updated[index], imageUri: imageUri || undefined };
    setEquipment(updated);
  };

  const handleDeleteEquipment = (index: number) => {
    if (equipment.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one equipment item.');
      return;
    }
    const updated = equipment.filter((_, i) => i !== index);
    setEquipment(updated);
  };

  const handleReorderInstructions = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...instructions];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    setInstructions(updated);
  };

  const handleReorderIngredients = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...ingredients];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    setIngredients(updated);
  };

  const handleUpdateSourceUrl = (index: number, value: string) => {
    const updated = [...sourceUrls];
    updated[index] = value;
    setSourceUrls(updated);
  };

  const handleToggleCollection = (collectionName: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionName)) {
        // Remove collection
        return prev.filter(col => col !== collectionName);
      } else {
        // Add collection
        return [...prev, collectionName];
      }
    });
  };

  const handleCreateCollection = async () => {
    if (newCollectionName.trim()) {
      await addCollection(newCollectionName.trim());
      // Add the new collection to selected collections
      setSelectedCollections(prev => [...prev, newCollectionName.trim()]);
      setNewCollectionName('');
      setShowCreateCollection(false);
      setShowCollectionsBottomSheet(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F0' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          {/* Title */}
          <TextInput
            style={styles.titleInput}
            placeholder="Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <TextInput
            style={styles.descriptionInput}
            placeholder="Description (optional)"
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* Image */}
          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>Image</Text>
            <TouchableOpacity style={styles.imageButton} onPress={handleImagePicker}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                <Ionicons name="camera-outline" size={24} color="#FF6B35" />
              )}
            </TouchableOpacity>
          </View>

          {/* Collections */}
          <TouchableOpacity 
            style={styles.row}
            onPress={() => setShowCollectionsBottomSheet(true)}
          >
            <Text style={styles.rowLabel}>Collections</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {selectedCollections.length > 0 
                  ? selectedCollections.join(', ') 
                  : 'None'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </View>
          </TouchableOpacity>

          {/* Info */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              navigation.navigate('RecipeInfo', {
                servings: servings ?? undefined,
                prepTime,
                cookTime,
                cuisine: cuisine ?? undefined,
                tags,
                sourceUrls,
                description: description || undefined,
                onSave: (data) => {
                  setServings(data.servings || null);
                  setPrepTime(data.prepTime || 0);
                  setCookTime(data.cookTime || 0);
                  setCuisine(data.cuisine || null);
                  setTags(data.tags || []);
                  setSourceUrls(data.sourceUrls || ['', '', '']);
                  if (data.description !== undefined) {
                    setDescription(data.description || '');
                  }
                },
              });
            }}
          >
            <Text style={styles.rowLabel}>Info</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
          </TouchableOpacity>

          {/* Nutrition */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              navigation.navigate('RecipeNutrition', {
                calories: calories || undefined,
                protein: protein || undefined,
                carbs: carbs || undefined,
                fats: fats || undefined,
                onSave: (data) => {
                  setCalories(data.calories || null);
                  setProtein(data.protein || null);
                  setCarbs(data.carbs || null);
                  setFats(data.fats || null);
                },
              });
            }}
          >
            <Text style={styles.rowLabel}>Nutrition</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Ingredients Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INGREDIENTS</Text>
            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => setIsReorderingIngredients(!isReorderingIngredients)}
            >
              <Text style={styles.reorderButtonText}>
                {isReorderingIngredients ? 'Done' : 'Re-order'}
              </Text>
            </TouchableOpacity>
          </View>
          {isReorderingIngredients ? (
            <IngredientList
              ingredients={ingredients}
              onReorder={handleReorderIngredients}
              onUpdate={(index, value) => handleUpdateIngredient(index, value)}
              onDelete={(index) => handleDeleteIngredient(index)}
              isReordering={isReorderingIngredients}
            />
          ) : (
            <>
              {ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientItemContainer}>
                  <TextInput
                    style={styles.ingredientInput}
                    placeholder="Add ingredient"
                    placeholderTextColor="#999"
                    value={ingredient}
                    onChangeText={(value) => handleUpdateIngredient(index, value)}
                  />
                  {ingredients.length > 1 && (
                    <TouchableOpacity
                      style={styles.ingredientDeleteButton}
                      onPress={() => handleDeleteIngredient(index)}
                    >
                      <Ionicons name="close" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddIngredient}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
            <Text style={styles.addButtonText}>Add ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => setIsReorderingInstructions(!isReorderingInstructions)}
            >
              <Text style={styles.reorderButtonText}>
                {isReorderingInstructions ? 'Done' : 'Re-order'}
              </Text>
            </TouchableOpacity>
          </View>
          <InstructionList
            instructions={instructions}
            onReorder={handleReorderInstructions}
            onUpdate={(index, value) => handleUpdateInstruction(index, value)}
            onImageUpdate={(index, imageUri) => handleUpdateInstructionImage(index, imageUri)}
            onDurationUpdate={(index, duration) => handleUpdateInstructionDuration(index, duration)}
            onDelete={(index) => handleDeleteInstruction(index)}
            isReordering={isReorderingInstructions}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddInstruction}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
            <Text style={styles.addButtonText}>Add step</Text>
          </TouchableOpacity>
        </View>

        {/* Equipment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EQUIPMENT</Text>
          {equipment.map((item, index) => (
            <View key={index} style={styles.ingredientItemContainer}>
              {!item.imageUri ? (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={() => {
                    Alert.alert(
                      'Add Image',
                      'Choose an option',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Take Photo', onPress: async () => {
                          try {
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== 'granted') {
                              Alert.alert('Permission needed', 'Camera permission is required.');
                              return;
                            }
                            const result = await ImagePicker.launchCameraAsync({
                              mediaTypes: ['images'],
                              allowsEditing: true,
                              quality: 0.8,
                            });
                            if (!result.canceled && result.assets[0]) {
                              handleUpdateEquipmentImage(index, result.assets[0].uri);
                            }
                          } catch (error) {
                            console.error('Error taking photo:', error);
                            Alert.alert('Error', 'Failed to take photo. Please try again.');
                          }
                        }},
                        { text: 'Choose from Library', onPress: async () => {
                          try {
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== 'granted') {
                              Alert.alert('Permission needed', 'Photo library permission is required.');
                              return;
                            }
                            const result = await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: ['images'],
                              allowsEditing: true,
                              quality: 0.8,
                            });
                            if (!result.canceled && result.assets[0]) {
                              handleUpdateEquipmentImage(index, result.assets[0].uri);
                            }
                          } catch (error) {
                            console.error('Error choosing image:', error);
                            Alert.alert('Error', 'Failed to choose image. Please try again.');
                          }
                        }},
                      ],
                      { cancelable: true }
                    );
                  }}
                >
                  <Ionicons name="camera-outline" size={20} color="#FF6B35" />
                </TouchableOpacity>
              ) : (
                <View style={styles.instructionImageThumbnail}>
                  <Image source={{ uri: item.imageUri }} style={styles.instructionImageThumbnailImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleUpdateEquipmentImage(index, null)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.equipmentContent}>
                <TextInput
                  style={styles.ingredientInput}
                  placeholder="Add equipment"
                  placeholderTextColor="#999"
                  value={item.name}
                  onChangeText={(value) => handleUpdateEquipment(index, value)}
                />
              </View>
              {equipment.length > 1 && (
                <TouchableOpacity
                  style={styles.ingredientDeleteButton}
                  onPress={() => handleDeleteEquipment(index)}
                >
                  <Ionicons name="close" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddEquipment}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
            <Text style={styles.addButtonText}>Add equipment</Text>
          </TouchableOpacity>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Add your recipe notes"
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </ScrollView>

      {/* Collections Bottom Sheet */}
      <BottomSheet
        visible={showCollectionsBottomSheet}
        onClose={() => {
          setShowCollectionsBottomSheet(false);
          setShowCreateCollection(false);
          setNewCollectionName('');
        }}
        height="50%"
      >
        <View style={styles.collectionsContent}>
          {!showCreateCollection ? (
            <>
              {/* Collection Options */}
              {collections.map((collection, index) => {
                const isSelected = selectedCollections.includes(collection);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.collectionOption,
                      isSelected && styles.collectionOptionSelected
                    ]}
                    onPress={() => handleToggleCollection(collection)}
                  >
                    <View style={styles.collectionCheckbox}>
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                    <Text style={[
                      styles.collectionOptionText,
                      isSelected && styles.collectionOptionTextSelected
                    ]}>
                      {collection}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              
              {/* Create New Collection */}
              <TouchableOpacity
                style={styles.createCollectionButton}
                onPress={() => setShowCreateCollection(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
                <Text style={styles.createCollectionButtonText}>Create new collection</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Create Collection Input */}
              <View style={styles.createCollectionHeader}>
                <TouchableOpacity
                  style={styles.createCollectionBackButton}
                  onPress={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.createCollectionTitle}>New Collection</Text>
                <View style={{ width: 40 }} />
              </View>
              
              <TextInput
                style={styles.createCollectionInput}
                placeholder="Collection name"
                placeholderTextColor="#999"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />
              
              <TouchableOpacity
                style={[
                  styles.createCollectionSaveButton,
                  !newCollectionName.trim() && styles.createCollectionSaveButtonDisabled
                ]}
                onPress={handleCreateCollection}
                disabled={!newCollectionName.trim()}
              >
                <Text style={[
                  styles.createCollectionSaveButtonText,
                  !newCollectionName.trim() && styles.createCollectionSaveButtonTextDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#F5F5F0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  saveButton: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    gap: 20,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingBottom: 8,
  },
  imageSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  imageButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0DA',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
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
    color: '#999',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  reorderButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  reorderButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E0E0DA',
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '500',
  },
  listItemContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemInput: {
    flex: 1,
    marginBottom: 0,
  },
  instructionItemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  instructionInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    paddingTop: 10,
    lineHeight: 22,
  },
  instructionContent: {
    flex: 1,
  },
  equipmentContent: {
    flex: 1,
  },
  instructionMenuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionTimerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  instructionTimerText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  timerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  timerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  timerModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  timerModalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  timerModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  timerModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  timerModalButtonRemove: {
    marginRight: 'auto',
  },
  timerModalButtonRemoveText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  timerModalButtonCancel: {
    backgroundColor: '#F5F5F0',
  },
  timerModalButtonCancelText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  timerModalButtonSave: {
    backgroundColor: '#FF6B35',
  },
  timerModalButtonSaveText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructionMenuBottomSheetContent: {
    paddingTop: 8,
  },
  instructionMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  instructionMenuOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  instructionMenuOptionTextDestructive: {
    color: '#FF3B30',
  },
  ingredientItemContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  ingredientInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  ingredientDeleteButton: {
    position: 'absolute',
    top: 24,
    right: 12,
    width: 32,
    height: 32,
    marginTop: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 2,
  },
  addImageButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0DA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionImageThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  instructionImageThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  dragHandle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  draggingItem: {
    opacity: 0.5,
    backgroundColor: '#F0F0F0',
  },
  dragOverItem: {
    borderTopWidth: 2,
    borderTopColor: '#FF6B35',
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    paddingTop: 4,
  },
  collectionsContent: {
    paddingVertical: 8,
  },
  collectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  collectionOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  collectionCheckbox: {
    marginRight: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  collectionOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  collectionOptionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  createCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  createCollectionButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '500',
  },
  createCollectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  createCollectionBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  createCollectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  createCollectionInput: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E0E0DA',
  },
  createCollectionSaveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCollectionSaveButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  createCollectionSaveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createCollectionSaveButtonTextDisabled: {
    color: '#999999',
  },
});

export default WriteRecipeScreen;

