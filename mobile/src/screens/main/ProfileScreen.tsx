import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, Alert, Platform, Image, ActionSheetIOS } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../types/navigation';
import { auth, db, storage } from '../../services/firebase';
import { signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserPreferencesStore } from '../../stores/userPreferencesStore';
import * as ImagePicker from 'expo-image-picker';
import { hasActiveSubscription } from '../../services/superwall';

// Conditionally import usePlacement and useSuperwall
let usePlacement: any = null;
let useSuperwall: any = null;
try {
  const superwallModule = require('expo-superwall');
  usePlacement = superwallModule.usePlacement;
  useSuperwall = superwallModule.useSuperwall;
} catch (error) {
  console.warn('Superwall not available');
  usePlacement = () => {
    return {
      registerPlacement: async () => {
        console.warn('Superwall paywall not available - native module not loaded');
      },
      state: { status: 'idle' },
    };
  };
  useSuperwall = () => {
    return {
      user: { subscriptionStatus: 'UNKNOWN' },
    };
  };
}

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { showNutrition, setShowNutrition, dietaryPreference, setDietaryPreference, intolerances, favouriteCuisines, dislikesAllergies } = useUserPreferencesStore();

  // Superwall hooks - must be called unconditionally
  const superwall = useSuperwall();
  const placement = usePlacement('trial-offer');

  // Subscription status
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);

  // User data from Firebase
  const [userName, setUserName] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);

  // Cooking preferences state
  const [temperatureUnit, setTemperatureUnit] = useState<'°C' | '°F'>('°C');
  const [measurementSystem, setMeasurementSystem] = useState<'Metric' | 'Imperial'>('Metric');
  const [servingSize, setServingSize] = useState(2);
  const [showOnlyMatchingRecipes, setShowOnlyMatchingRecipes] = useState(true);

  // Check subscription status
  useEffect(() => {
    if (superwall) {
      const checkSubscription = () => {
        const subscribed = hasActiveSubscription(superwall);
        setIsSubscribed(subscribed);
      };
      checkSubscription();
      // Check periodically for subscription changes
      const interval = setInterval(checkSubscription, 5000);
      return () => clearInterval(interval);
    }
  }, [superwall]);
  
  // Helper function to format intolerances display
  const getIntolerancesDisplay = () => {
    if (intolerances === 'None' || intolerances === 'no-preference' || !intolerances) {
      return 'None';
    }
    return intolerances;
  };
  
  // Helper function to format dietary preference display
  const getDietaryPreferenceDisplay = () => {
    if (dietaryPreference === 'None' || dietaryPreference === 'no-preference') {
      return 'None';
    }
    // Capitalize first letter and format
    const preferenceMap: { [key: string]: string } = {
      'vegetarian': 'Vegetarian',
      'vegan': 'Vegan',
      'pescatarian': 'Pescatarian',
      'other': 'Other',
    };
    return preferenceMap[dietaryPreference] || dietaryPreference;
  };
  
  // Helper function to format favourite cuisines display
  const getFavouriteCuisinesDisplay = () => {
    if (favouriteCuisines === 'None' || !favouriteCuisines) {
      return '0';
    }
    // Count the number of cuisines (comma-separated)
    return String(favouriteCuisines.split(',').length);
  };
  
  // Helper function to format dislikes/allergies display
  const getDislikesAllergiesDisplay = () => {
    if (dislikesAllergies === 'None' || !dislikesAllergies) {
      return 'None';
    }
    return dislikesAllergies;
  };

  // Fetch user data from Firebase Auth and Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email || '';
        const displayName = user.displayName || '';
        
        setUserEmail(email);
        
        try {
          const userProfileRef = doc(db, 'users', user.uid);
          const userProfileSnap = await getDoc(userProfileRef);
          
          if (userProfileSnap.exists()) {
            const profileData = userProfileSnap.data();
            const firstName = profileData.firstName || displayName || email.split('@')[0];
            const fullName = profileData.displayName || displayName || firstName;
            const profilePic = profileData.profilePictureUrl || user.photoURL || null;
            
            setUserName(firstName);
            setUserFullName(fullName);
            setProfilePictureUrl(profilePic);
          } else {
            const firstName = displayName || email.split('@')[0];
            setUserName(firstName);
            setUserFullName(displayName || firstName);
            setProfilePictureUrl(user.photoURL || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          const firstName = displayName || email.split('@')[0];
          setUserName(firstName);
          setUserFullName(displayName || firstName);
          setProfilePictureUrl(user.photoURL || null);
        }
      } else {
        setUserName('');
        setUserFullName('');
        setUserEmail('');
        setProfilePictureUrl(null);
      }
      setIsLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  const showImagePickerOptions = () => {
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
        'Select Profile Picture',
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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1], // Square for profile picture
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePicture(result.assets[0].uri);
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
        aspect: [1, 1], // Square for profile picture
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error choosing image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to update your profile picture.');
      return;
    }

    try {
      setIsUploadingProfilePicture(true);

      // Convert URI to blob
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const fileName = `profile-${timestamp}.jpg`;
      const storagePath = `profile-pictures/${user.uid}/${fileName}`;
      const imageRef = ref(storage, storagePath);

      await uploadBytes(imageRef, blob, {
        contentType: 'image/jpeg',
      });

      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);

      // Update or create Firestore user document
      // Use setDoc with merge: true to create if doesn't exist, or update if it does
      const userProfileRef = doc(db, 'users', user.uid);
      await setDoc(userProfileRef, {
        userId: user.uid,
        email: user.email,
        profilePictureUrl: downloadURL,
      }, { merge: true });

      // Update Firebase Auth profile
      await updateProfile(user, {
        photoURL: downloadURL,
      });

      // Update local state
      setProfilePictureUrl(downloadURL);

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation will be handled by App.tsx auth state listener
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleStartFreeTrial = async () => {
    if (!placement || typeof placement?.registerPlacement !== 'function') {
      Alert.alert(
        'Subscription Not Available',
        'The subscription service is not available. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsLoadingTrial(true);
      await placement.registerPlacement({
        placement: 'trial-offer',
      });
    } catch (error) {
      console.error('Error presenting Superwall paywall:', error);
      Alert.alert(
        'Error',
        'Unable to load subscription options. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingTrial(false);
    }
  };

  // Mock data for cooking breakdown chart (values 1–6: how many times per week user eats that diet)
  const cookingBreakdown = {
    MEAT: 6,
    FISH: 1,
    VEGGIE: 2,
    VEGAN: 1,
    'M&F': 2,
  };

  const CHART_MAX = 6; // Y-axis scale 1–6
  const chartHeight = 200;
  const gapBelowBaseline = 12; // gap between "1" line and category labels
  const labelRowHeight = 36;
  const barAreaHeight = chartHeight - gapBelowBaseline - labelRowHeight;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Free Trial Button - Only show if user doesn't have active subscription */}
        {!isSubscribed && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.freeTrialButton}
              onPress={handleStartFreeTrial}
              disabled={isLoadingTrial}
              activeOpacity={0.8}
            >
              <View style={styles.freeTrialButtonContent}>
                <View style={styles.freeTrialIcon}>
                <MaterialCommunityIcons name="chef-hat" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.freeTrialButtonText}>Start your 30 day free trial!</Text>
                <Ionicons name="chevron-forward" size={20} color="#1A1A1A" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* My Cooking Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Cooking Preferences</Text>
          
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => setTemperatureUnit(temperatureUnit === '°C' ? '°F' : '°C')}
          >
            <Text style={styles.listItemText}>Temperature</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{temperatureUnit}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listItem}
            onPress={() => setMeasurementSystem(measurementSystem === 'Metric' ? 'Imperial' : 'Metric')}
          >
            <Text style={styles.listItemText}>Measurement System</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{measurementSystem}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Serving Size</Text>
            <View style={styles.servingSizeControls}>
              <TouchableOpacity
                style={styles.servingSizeButton}
                onPress={() => setServingSize(Math.max(1, servingSize - 1))}
              >
                <Text style={styles.servingSizeButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.servingSizeValue}>{servingSize} Servings</Text>
              <TouchableOpacity
                style={styles.servingSizeButton}
                onPress={() => setServingSize(servingSize + 1)}
              >
                <Text style={styles.servingSizeButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dietaryPreferenceContainer}>
            <TouchableOpacity
              style={styles.dietaryPreferenceRow}
              onPress={() => navigation.navigate('DietaryPreferences')}
            >
              <Text style={styles.listItemText}>Dietary Preference</Text>
              <View style={styles.listItemRight}>
                <Text style={styles.listItemValue}>{getDietaryPreferenceDisplay()}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999999" />
              </View>
            </TouchableOpacity>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>Show only recipes that match my dietary preferences?</Text>
              <Switch
                value={showOnlyMatchingRecipes}
                onValueChange={setShowOnlyMatchingRecipes}
                trackColor={{ false: '#E0E0E0', true: '#34C759' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('Intolerances')}
          >
            <Text style={styles.listItemText}>Intolerances</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{getIntolerancesDisplay()}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('FavouriteCuisines')}
          >
            <Text style={styles.listItemText}>Favourite Cuisines</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{getFavouriteCuisinesDisplay()}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('DislikesAllergies')}
          >
            <Text style={styles.listItemText}>Dislike/Allergies</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{getDislikesAllergiesDisplay()}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <TouchableOpacity style={styles.listItem}>
            <Text style={styles.listItemText}>Name</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{userFullName || userName || 'Loading...'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.listItem}>
            <Text style={styles.listItemText}>Email</Text>
            <View style={styles.listItemRight}>
              <Text style={styles.listItemValue}>{userEmail || 'Loading...'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listItem}
            onPress={showImagePickerOptions}
            disabled={isUploadingProfilePicture}
          >
            <Text style={styles.listItemText}>Profile Picture</Text>
            <View style={styles.listItemRight}>
              <View style={styles.profilePicture}>
                {profilePictureUrl ? (
                  <Image
                    source={{ uri: profilePictureUrl }}
                    style={styles.profilePictureImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.profilePictureText}>
                    {(userName || userEmail || 'P').charAt(0).toUpperCase()}
                  </Text>
                )}
                {isUploadingProfilePicture && (
                  <View style={styles.profilePictureOverlay}>
                    <Ionicons name="hourglass-outline" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Options Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('ManageSubscription')}
          >
            <Text style={styles.listItemText}>Manage Subscription</Text>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('DeleteAccount')}
          >
            <Text style={styles.listItemText}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
        </View>

        {/* Cooking Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking Breakdown</Text>
          <View style={styles.chartContainer}>
            {/* Y-axis labels (height matches bar area so "1" is at bar baseline) */}
            <View style={[styles.yAxis, { height: barAreaHeight }]}>
              {[6, 5, 4, 3, 2, 1].map((num) => (
                <Text key={num} style={styles.yAxisLabel}>{num}</Text>
              ))}
            </View>
            
            {/* Chart area */}
            <View style={styles.chartArea}>
              {/* Grid lines (only in bar area so bottom line is the "1" line) */}
              <View style={[styles.gridLines, { height: barAreaHeight, bottom: undefined }]}>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <View key={num} style={styles.gridLine} />
                ))}
              </View>
              
              {/* Bars row (fixed height, labels below) */}
              <View style={[styles.barsContainer, { height: barAreaHeight }]}>
                {Object.entries(cookingBreakdown).map(([category, value]) => (
                  <View key={category} style={styles.barColumn}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: value > 0 ? (value / CHART_MAX) * barAreaHeight : 0,
                          backgroundColor: category === 'MEAT' ? '#FF6B6B' : '#CEEC2C',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              {/* X-axis labels row (all on one line, centered under each bar) */}
              <View style={styles.xAxisLabelsRow}>
                {Object.keys(cookingBreakdown).map((category) => (
                  <View key={category} style={styles.xAxisLabelCell}>
                    <Text style={styles.xAxisLabel}>{category}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => {
              Linking.openURL('https://cookthispage.app').catch((err) => {
                Alert.alert('Error', 'Could not open the website');
                console.error('Error opening URL:', err);
              });
            }}
          >
            <Text style={styles.listItemText}>About Gastrons</Text>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => {
              Linking.openURL('https://cookthispage.app/terms').catch((err) => {
                Alert.alert('Error', 'Could not open the website');
                console.error('Error opening URL:', err);
              });
            }}
          >
            <Text style={styles.listItemText}>Terms of Use</Text>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => {
              Linking.openURL('https://cookthispage.app/faq').catch((err) => {
                Alert.alert('Error', 'Could not open the website');
                console.error('Error opening URL:', err);
              });
            }}
          >
            <Text style={styles.listItemText}>Frequently Asked Questions</Text>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </TouchableOpacity>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#1A1A1A" />
          <Text style={styles.logoutButtonText}>LOG OUT</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dietaryPreferenceContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dietaryPreferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingTop: 0,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 12,
  },
  listItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    flex: 1,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemValue: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  servingSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  servingSizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  servingSizeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  servingSizeValue: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    minWidth: 80,
    textAlign: 'center',
  },
  profilePicture: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#9B59B6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  profilePictureImage: {
    width: '100%',
    height: '100%',
  },
  profilePictureText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profilePictureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  yAxis: {
    width: 24,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  yAxisLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: 200,
    flexDirection: 'column',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    borderRadius: 4,
  },
  xAxisLabelsRow: {
    flexDirection: 'row',
    height: 36,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xAxisLabelCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  freeTrialButton: {
    backgroundColor: '#CEEC2C',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  freeTrialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freeTrialIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  freeTrialIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  freeTrialButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default ProfileScreen;
