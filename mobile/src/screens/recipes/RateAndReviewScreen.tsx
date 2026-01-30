import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../types/navigation';
import { useRecipesStore } from '../../stores/recipesStore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, functions } from '../../services/firebase';
import { auth } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';

type RateAndReviewScreenRouteProp = RouteProp<RootStackParamList, 'RateAndReview'>;
type RateAndReviewScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RateAndReview'
>;

const RateAndReviewScreen: React.FC = () => {
  const navigation = useNavigation<RateAndReviewScreenNavigationProp>();
  const route = useRoute<RateAndReviewScreenRouteProp>();
  const { recipeId } = route.params;
  const { recipes } = useRecipesStore();

  const [rating, setRating] = useState<number>(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  const [userName, setUserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);

  const recipe = recipes.find((r) => r.id === recipeId);

  // Pre-fill user name from auth and load existing review
  useEffect(() => {
    // Pre-fill name from auth (displayName or email as fallback)
    if (auth.currentUser) {
      const name = auth.currentUser.displayName || 
                   auth.currentUser.email?.split('@')[0] || 
                   '';
      if (name) {
        setUserName(name);
      }
    }

    // Load existing review if user has already rated
    const loadExistingReview = async () => {
      try {
        const getReviewFunction = httpsCallable(functions, 'getReview');
        const result = await getReviewFunction({ recipeId });
        const data = result.data as { review: any | null };
        
        if (data.review) {
          setRating(data.review.rating);
          setComments(data.review.comments || '');
          setReviewImage(data.review.imageUrl || null);
          setUserName(data.review.userName || auth.currentUser?.displayName || '');
          setExistingReviewId(data.review.id);
          
          // Don't auto-show review form - let user start on rating page to see image
          // User can click "LEAVE A REVIEW" to see/edit their review
        }
      } catch (error: any) {
        console.error('Error loading existing review:', error);
      } finally {
        setIsLoadingReview(false);
      }
    };

    loadExistingReview();
  }, [recipeId]);

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex + 1);
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setReviewImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | undefined = undefined;

      // Upload image if provided
      if (reviewImage && auth.currentUser) {
        try {
          const response = await fetch(reviewImage);
          const blob = await response.blob();
          const imageRef = ref(
            storage,
            `reviews/${auth.currentUser.uid}/${recipeId}/${Date.now()}.jpg`
          );
          await uploadBytes(imageRef, blob);
          imageUrl = await getDownloadURL(imageRef);
          console.log('✅ Review image uploaded successfully:', imageUrl);
        } catch (error: any) {
          console.warn('⚠️ Failed to upload review image:', error);
          // Don't set imageUrl if upload fails - backend will accept undefined
          imageUrl = undefined;
        }
      }

      // Save review to backend
      // Only include imageUrl if it's actually a string (not undefined/null)
      const submitReviewFunction = httpsCallable(functions, 'submitReview');
      const requestData: any = {
        recipeId,
        rating,
        comments: comments.trim() || undefined,
        userName: userName.trim() || undefined,
      };
      
      // Only add imageUrl if it's a valid string
      if (imageUrl && typeof imageUrl === 'string') {
        requestData.imageUrl = imageUrl;
      }
      
      const result = await submitReviewFunction(requestData);

      console.log('Review submitted successfully:', result.data);

      // Show success and navigate back
      Alert.alert('Thank you!', 'Your review has been submitted.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingReview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Title */}
        <Text style={styles.recipeTitle}>{recipe.title}</Text>

        {/* Recipe Image - Only show when not in review form */}
        {!showReviewForm && recipe.image && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: typeof recipe.image === 'string' ? recipe.image : recipe.image.uri }}
              style={styles.recipeImage}
              resizeMode="cover"
            />
          </View>
        )}

        {!showReviewForm ? (
          /* Rating Screen */
          <>
            <Text style={styles.ratingQuestion}>
              {rating > 0 ? "Awesome, we're glad you liked it!" : 'How would you rate this recipe?'}
            </Text>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[0, 1, 2, 3, 4].map((index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleStarPress(index)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={index < rating ? 'star' : 'star-outline'}
                    size={48}
                    color={index < rating ? '#FFD700' : '#E0E0E0'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating Labels */}
            <View style={styles.ratingLabels}>
              <Text style={styles.ratingLabel}>Not a fan</Text>
              <Text style={styles.ratingLabel}>Loved It</Text>
            </View>

            {/* Review Prompt */}
            <Text style={styles.reviewPrompt}>
              Would you like to tells us more?{'\n'}We'd love to hear from you!
            </Text>

            {/* Leave Review Button - Disabled until rating is set */}
            <TouchableOpacity
              style={[styles.leaveReviewButton, rating === 0 && styles.leaveReviewButtonDisabled]}
              onPress={() => setShowReviewForm(true)}
              disabled={rating === 0}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={20} color={rating === 0 ? '#999' : '#1A1A1A'} />
              <Text style={[styles.leaveReviewButtonText, rating === 0 && styles.leaveReviewButtonTextDisabled]}>
                LEAVE A REVIEW
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Review Form */
          <>
            {/* Image Upload */}
            <TouchableOpacity
              style={styles.imageUploadContainer}
              onPress={handleImagePicker}
              activeOpacity={0.8}
            >
              {reviewImage ? (
                <Image source={{ uri: reviewImage }} style={styles.uploadedImage} resizeMode="cover" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={40} color="#999" />
                  <Text style={styles.uploadText}>Upload picture</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Comments */}
            <Text style={styles.inputLabel}>Tell us more about your experience:</Text>
            <TextInput
              style={styles.commentsInput}
              placeholder="Your comments"
              placeholderTextColor="#999"
              value={comments}
              onChangeText={setComments}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Name */}
            <Text style={styles.inputLabel}>Your name:</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor="#999"
              value={userName}
              onChangeText={setUserName}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <Text style={styles.submitButtonText}>SUBMIT</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  recipeImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  ratingQuestion: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
  },
  reviewPrompt: {
    fontSize: 16,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  leaveReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  leaveReviewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  leaveReviewButtonDisabled: {
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  leaveReviewButtonTextDisabled: {
    color: '#999',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  imageUploadContainer: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  uploadText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  commentsInput: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  nameInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 32,
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
});

export default RateAndReviewScreen;
