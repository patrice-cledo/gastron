import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeProvider';
import { CookbookSelectionModal } from '../../components/CookbookSelectionModal';
import { db, functions } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';
import { usePhotoImportStore } from '../../stores/photoImportStore';

// Collection names (matching backend)
const COLLECTIONS = {
  imports: 'imports',
  recipeDrafts: 'recipeDrafts',
} as const;
import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, ActionSheetIOS } from 'react-native';

type RecipeImportPreviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RecipeImportPreview'
>;

const RecipeImportPreviewScreen: React.FC<RecipeImportPreviewScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isImporting, setIsImporting] = useState(true);
  const [isProcessingAdditionalPhoto, setIsProcessingAdditionalPhoto] = useState(false);
  const { startPhotoImport, status, currentImportId, error, reset } = usePhotoImportStore();
  const [recipeData, setRecipeData] = useState<{
    imageUri?: string;
    text: string;
    ocrText?: string;
    title?: string;
    notes?: string;
    structuredIngredients?: string[];
    structuredInstructions?: string[];
  }>({
    text: '',
  });
  const [hasStructuredData, setHasStructuredData] = useState(false);

  useEffect(() => {
    const loadRecipeDraft = async () => {
      // Skip if we're processing an additional photo (don't override existing content)
      if (isProcessingAdditionalPhoto) {
        return;
      }
      
      // If we have an importId (from paste text, browser import, or photo import), fetch the draft
      if (route.params?.importId) {
        try {
          setIsImporting(true);
          
          // First, check if it's an import job (photo import) or a draft ID (text/browser import)
          // Try to get the import job first (but handle errors gracefully)
          let draftId = route.params.importId; // Default to using importId as draftId
          
          try {
            const importDoc = await getDoc(doc(db, COLLECTIONS.imports, route.params.importId));
            
            if (importDoc.exists()) {
              // This is an import job, get the draft ID from the result
              const importJob = importDoc.data();
              if (importJob.result?.recipeDraftId) {
                draftId = importJob.result.recipeDraftId;
              } else if (importJob.status !== 'ready') {
                // Import is still processing
                console.log('Import still processing:', importJob.status);
                // Could show a loading state or wait
              }
            }
          } catch (importError) {
            // If import document doesn't exist or can't be read, assume importId is the draftId
            console.log('Import document not found or error reading it, using importId as draftId:', importError);
          }
          
          // Fetch the recipe draft
          const draftDoc = await getDoc(doc(db, COLLECTIONS.recipeDrafts, draftId));
          
          if (draftDoc.exists()) {
            const draft = draftDoc.data();
            
            // Check if this is a structured import (browser import) vs text-based (photo/paste)
            const isStructuredImport = draft.ingredients && Array.isArray(draft.ingredients) && draft.ingredients.length > 0 &&
                                      draft.instructions && Array.isArray(draft.instructions) && draft.instructions.length > 0;
            
            if (isStructuredImport) {
              // For structured imports (browser), use the data directly
              setHasStructuredData(true);
              
              // Extract ingredients as strings
              const ingredientsArray = draft.ingredients.map((ing: any) => {
                if (typeof ing === 'string') {
                  return ing;
                }
                // Use raw text if available, otherwise reconstruct
                if (ing.raw) {
                  return ing.raw;
                }
                const parts = [];
                if (ing.quantity) parts.push(ing.quantity);
                if (ing.unit) parts.push(ing.unit);
                if (ing.name) parts.push(ing.name);
                if (ing.notes) parts.push(`(${ing.notes})`);
                return parts.length > 0 ? parts.join(' ') : '';
              });
              
              // Extract instructions as strings
              const instructionsArray = draft.instructions.map((inst: any) => {
                if (typeof inst === 'string') {
                  return inst;
                }
                return inst.text || inst.description || '';
              });
              
              setRecipeData({
                imageUri: draft.imageUrl || draft.imageStoragePath || route.params?.imageUri,
                text: '', // Not needed for structured imports
                ocrText: draft.ocrText || undefined,
                title: draft.title || '',
                notes: draft.notes || undefined,
                structuredIngredients: ingredientsArray,
                structuredInstructions: instructionsArray,
              });
            } else {
              // For text-based imports (photo/paste), convert to text as before
              setHasStructuredData(false);
              
              // Handle ingredients - convert array to free-form text
              // Prefer raw text to preserve original formatting with newlines
              const ingredientsArray = draft.ingredients?.map((ing: any) => {
                if (typeof ing === 'string') {
                  return ing;
                }
                // If raw text exists, use it to preserve original formatting
                if (ing.raw) {
                  return ing.raw;
                }
                // Otherwise, reconstruct from parts
                const parts = [];
                if (ing.quantity) parts.push(ing.quantity);
                if (ing.unit) parts.push(ing.unit);
                if (ing.name) parts.push(ing.name);
                if (ing.notes) parts.push(`(${ing.notes})`);
                return parts.length > 0 ? parts.join(' ') : '';
              }) || [];
              const ingredientsText = ingredientsArray.join('\n');
              
              // Handle instructions - convert array to free-form text
              const instructionsArray = draft.instructions?.map((inst: any) => {
                if (typeof inst === 'string') {
                  return inst;
                }
                return inst.text || inst.description || '';
              }) || [];
              const instructionsText = instructionsArray.join('\n');
              
              // Combine ingredients and instructions into a single text field
              const combinedText = [ingredientsText, instructionsText]
                .filter(text => text.trim())
                .join('\n\n');
              
              // Only set if we don't already have text (to avoid overriding appended content)
              setRecipeData(prev => {
                // If we already have text, don't override it (it might have been appended from additional photos)
                if (prev.text && prev.text.trim()) {
                  return prev;
                }
                
                return {
                  ...prev,
                  imageUri: draft.imageUrl || draft.imageStoragePath || route.params?.imageUri,
                  text: combinedText,
                  ocrText: draft.ocrText || undefined,
                  title: draft.title || '',
                  notes: draft.notes || undefined,
                };
              });
            }
          } else {
            // Draft not found, use route params or defaults
            const ingredientsArray = route.params?.ingredients || [];
            const instructionsArray = route.params?.instructions || [];
            const ingredientsText = Array.isArray(ingredientsArray) ? ingredientsArray.join('\n') : '';
            const instructionsText = Array.isArray(instructionsArray) ? instructionsArray.join('\n') : '';
            const combinedText = [ingredientsText, instructionsText]
              .filter(text => text.trim())
              .join('\n\n');
            setRecipeData({
              imageUri: route.params?.imageUri,
              text: combinedText,
            });
          }
        } catch (error) {
          console.error('Error loading recipe draft:', error);
          // Fallback to route params or defaults
          const ingredientsArray = route.params?.ingredients || [];
          const instructionsArray = route.params?.instructions || [];
          const ingredientsText = Array.isArray(ingredientsArray) ? ingredientsArray.join('\n') : '';
          const instructionsText = Array.isArray(instructionsArray) ? instructionsArray.join('\n') : '';
          const combinedText = [ingredientsText, instructionsText]
            .filter(text => text.trim())
            .join('\n\n');
          setRecipeData({
            imageUri: route.params?.imageUri,
            text: combinedText,
          });
        } finally {
          setIsImporting(false);
        }
      } else {
        // No importId, use route params or default data
        setIsImporting(false);
        const defaultIngredients = [
          '2 cups all-purpose flour',
          '1 tsp baking powder',
          '1/2 tsp salt',
          '1 cup milk',
          '2 eggs',
          '2 tbsp butter, melted',
        ];
        const defaultInstructions = [
          'Mix dry ingredients in a large bowl',
          'In a separate bowl, whisk together milk, eggs, and melted butter',
          'Combine wet and dry ingredients until just mixed',
          'Cook on a griddle over medium heat until golden brown',
          'Serve warm with your favorite toppings',
        ];
        const ingredientsArray = route.params?.ingredients || defaultIngredients;
        const instructionsArray = route.params?.instructions || defaultInstructions;
        const ingredientsText = Array.isArray(ingredientsArray) ? ingredientsArray.join('\n') : '';
        const instructionsText = Array.isArray(instructionsArray) ? instructionsArray.join('\n') : '';
        const combinedText = [ingredientsText, instructionsText]
          .filter(text => text.trim())
          .join('\n\n');
        setRecipeData({
          imageUri: route.params?.imageUri,
          text: combinedText,
        });
      }
    };

    loadRecipeDraft();
  }, [route.params]);

  // Handle additional photo processing
  useEffect(() => {
    const processAdditionalPhoto = async () => {
      if (status === 'ready' && currentImportId && isProcessingAdditionalPhoto) {
        try {
          // Get the import job to find the draft ID
          const importDoc = await getDoc(doc(db, COLLECTIONS.imports, currentImportId));
          
          if (!importDoc.exists()) {
            throw new Error('Import job not found');
          }
          
          const importJob = importDoc.data();
          const draftId = importJob.result?.recipeDraftId || currentImportId;
          
          // Fetch the draft from the new import
          const draftDoc = await getDoc(doc(db, COLLECTIONS.recipeDrafts, draftId));
          
          if (draftDoc.exists()) {
            const draft = draftDoc.data();
            
            // Convert ingredients array to text
            // Prefer raw text to preserve original formatting with newlines
            let newIngredientsText = '';
            if (draft.ingredients && Array.isArray(draft.ingredients) && draft.ingredients.length > 0) {
              const ingredientsArray = draft.ingredients.map((ing: any) => {
                if (typeof ing === 'string') {
                  return ing;
                }
                // If raw text exists, use it to preserve original formatting
                if (ing.raw) {
                  return ing.raw;
                }
                // Otherwise, reconstruct from parts
                const parts = [];
                if (ing.quantity) parts.push(ing.quantity);
                if (ing.unit) parts.push(ing.unit);
                if (ing.name) parts.push(ing.name);
                if (ing.notes) parts.push(`(${ing.notes})`);
                return parts.length > 0 ? parts.join(' ') : '';
              });
              newIngredientsText = ingredientsArray.filter((text: string) => text.trim()).join('\n');
            }
            
            // Convert instructions array to text
            let newInstructionsText = '';
            if (draft.instructions && Array.isArray(draft.instructions) && draft.instructions.length > 0) {
              const instructionsArray = draft.instructions.map((inst: any) => {
                if (typeof inst === 'string') {
                  return inst;
                }
                return inst.text || inst.description || '';
              });
              newInstructionsText = instructionsArray.filter((text: string) => text.trim()).join('\n');
            }
            
            // Combine ingredients and instructions into a single text
            const newText = [newIngredientsText, newInstructionsText]
              .filter(text => text.trim())
              .join('\n\n');
            
            // Append to existing text - always append, never override
            // This allows users to import multi-page recipes
            setRecipeData(prev => {
              // Preserve the existing text exactly as it is
              const currentText = prev.text || '';
              
              // Append new content to existing text
              let updatedText = currentText;
              if (newText && newText.trim()) {
                if (currentText && currentText.trim()) {
                  // Append with separator - ensure we're appending, not replacing
                  updatedText = `${currentText}\n\n${newText}`;
                  console.log('Appending new content to existing text. Current length:', currentText.length, 'New length:', newText.length);
                } else {
                  // First time adding content
                  updatedText = newText;
                  console.log('Setting initial text. Length:', newText.length);
                }
              } else {
                console.log('No new text to append');
              }
              
              return {
                ...prev,
                text: updatedText,
                ocrText: prev.ocrText 
                  ? `${prev.ocrText}\n\n--- Additional Photo ---\n\n${draft.ocrText || ''}`
                  : draft.ocrText || prev.ocrText,
              };
            });
          }
          
          setIsProcessingAdditionalPhoto(false);
          reset();
        } catch (error) {
          console.error('Error processing additional photo:', error);
          Alert.alert('Error', 'Failed to process additional photo. Please try again.');
          setIsProcessingAdditionalPhoto(false);
          reset();
        }
      }
    };

    processAdditionalPhoto();
  }, [status, currentImportId, isProcessingAdditionalPhoto, reset]);

  // Handle errors during additional photo processing
  useEffect(() => {
    if (status === 'failed' && isProcessingAdditionalPhoto && error) {
      Alert.alert(
        'Processing Failed',
        error,
        [
          { 
            text: 'OK', 
            onPress: () => {
              setIsProcessingAdditionalPhoto(false);
              reset();
            }
          },
        ]
      );
    }
  }, [status, error, isProcessingAdditionalPhoto, reset]);

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleChooseFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Photo',
        '',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Library', onPress: handleChooseFromLibrary },
        ],
        { cancelable: true }
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status: permissionStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        aspect: [3, 4], // Vertical/portrait frame
      });

      if (!result.canceled && result.assets[0]) {
        // Process the photo using the same import flow
        setIsProcessingAdditionalPhoto(true);
        await startPhotoImport(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      setIsProcessingAdditionalPhoto(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status: permissionStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        aspect: [3, 4], // Vertical/portrait frame
      });

      if (!result.canceled && result.assets[0]) {
        // Process the photo using the same import flow
        setIsProcessingAdditionalPhoto(true);
        await startPhotoImport(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error choosing image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setIsProcessingAdditionalPhoto(false);
    }
  };

  const [isClassifying, setIsClassifying] = useState(false);

  const handleImport = async () => {
    // For structured imports (browser), use data directly without classification
    if (hasStructuredData && recipeData.structuredIngredients && recipeData.structuredInstructions) {
      navigation.navigate('WriteRecipe', {
        importedData: {
          ingredients: recipeData.structuredIngredients.length > 0 ? recipeData.structuredIngredients : [''],
          instructions: recipeData.structuredInstructions.length > 0 ? recipeData.structuredInstructions : [''],
          imageUri: recipeData.imageUri,
          title: recipeData.title,
          notes: recipeData.notes,
        },
      });
      return;
    }

    // For text-based imports (photo/paste), classify the text
    if (!recipeData.text || !recipeData.text.trim()) {
      Alert.alert('No Content', 'Please import some recipe content first.');
      return;
    }

    setIsClassifying(true);

    try {
      // Call backend function to classify the text
      const classifyRecipeTextFunction = httpsCallable(functions, 'classifyRecipeText');
      const result = await classifyRecipeTextFunction({
        text: recipeData.text,
      }) as { data: { ingredients: string[]; instructions: string[]; confidence?: number; warnings?: string[] } };

      const { ingredients, instructions } = result.data;

      setIsClassifying(false);

      // Navigate to WriteRecipe screen with the classified data
      navigation.navigate('WriteRecipe', {
        importedData: {
          ingredients: ingredients.length > 0 ? ingredients : [''],
          instructions: instructions.length > 0 ? instructions : [''],
          imageUri: recipeData.imageUri,
          ocrText: recipeData.ocrText,
        },
      });
    } catch (error: any) {
      console.error('Error classifying recipe text:', error);
      setIsClassifying(false);

      let errorMessage = 'Failed to classify recipe text. Please try again.';
      if (error?.code === 'invalid-argument') {
        errorMessage = error.message || 'Invalid input. Please check your recipe text.';
      } else if (error?.code === 'unauthenticated') {
        errorMessage = 'Please sign in to import recipes.';
      } else if (error?.code === 'resource-exhausted') {
        errorMessage = error.message || 'Rate limit exceeded. Please try again later.';
      } else if (error?.code === 'not-found') {
        errorMessage = 'Classification service not available. The backend function may need to be deployed. Please contact support or try again later.';
      }

      Alert.alert(
        'Classification Failed',
        errorMessage,
        [
          { text: 'OK' },
          {
            text: 'Continue Without Classification',
            onPress: () => {
              // Navigate with unclassified data as fallback
              // Split by double newlines as a simple heuristic
              const sections = recipeData.text.split('\n\n').filter(section => section.trim());
              const lines = recipeData.text.split('\n').filter(line => line.trim());
              
              // Simple fallback: assume first half might be ingredients, second half instructions
              // Or just put everything in both and let user edit
              navigation.navigate('WriteRecipe', {
                importedData: {
                  ingredients: lines.length > 0 ? lines : [''],
                  instructions: lines.length > 0 ? lines : [''],
                  imageUri: recipeData.imageUri,
                  ocrText: recipeData.ocrText,
                },
              });
            },
          },
        ]
      );
    }
  };

  if (isImporting || isProcessingAdditionalPhoto) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.importingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.importingText}>
            {isProcessingAdditionalPhoto ? 'Processing additional photo...' : 'Importing recipe...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Text style={styles.backIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview Recipe</Text>
        <TouchableOpacity
          onPress={handleImagePicker}
          style={styles.imageButton}
          activeOpacity={0.7}
        >
          <Ionicons name="image-outline" size={24} color="#FF6B35" />
          <Ionicons name="add-circle" size={16} color="#FF6B35" style={styles.addIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Free-form text input */}
        <View style={styles.section}>
          <TextInput
            style={styles.freeFormInput}
            value={recipeData.text}
            onChangeText={(text) => setRecipeData(prev => ({ ...prev, text }))}
            placeholder="Recipe content will appear here..."
            placeholderTextColor="#999"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* OCR Text Section (if available from photo import) */}
        {recipeData.ocrText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Text</Text>
            <View style={styles.ocrTextContainer}>
              <Text style={styles.ocrText}>{recipeData.ocrText}</Text>
            </View>
          </View>
        )}

        {/* Bottom spacing for fixed buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View
        style={[
          styles.bottomButtons,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            paddingTop: 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.button, styles.dismissButton]}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.importButton, isClassifying && styles.importButtonDisabled]}
          onPress={handleImport}
          activeOpacity={0.7}
          disabled={isClassifying}
        >
          {isClassifying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.importButtonText}>Import</Text>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  imageButton: {
    position: 'relative',
    padding: 4,
  },
  addIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  importingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  importingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    textAlignVertical: 'top',
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  freeFormInput: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  ocrTextContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  ocrText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
    gap: 12,
  },
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#F5F5F0',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  importButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RecipeImportPreviewScreen;

