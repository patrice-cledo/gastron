import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { doc, getDoc, getDocs, query, collection, where, documentId, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheet } from '../../components/BottomSheet';

type ChallengeDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChallengeDetail'>;

interface Recipe {
  id: string;
  title: string;
  image: string;
  dietaryBadge: { icon: string; label: string };
  // Add other fields as needed from Firestore
}

const ChallengeDetailScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<ChallengeDetailScreenNavigationProp>();
  const route = useRoute();
  const challengeId = (route.params as any)?.challengeId;

  const [hasJoined, setHasJoined] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showChallengeOptionsBottomSheet, setShowChallengeOptionsBottomSheet] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [completedRecipes, setCompletedRecipes] = useState(0);

  // Challenge and Recipes State
  const [challenge, setChallenge] = useState<any>(null);
  const [challengeRecipes, setChallengeRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if challenge is already joined and load progress
  useEffect(() => {
    const checkJoinedStatus = async () => {
      try {
        const JOINED_CHALLENGES_KEY = 'joined-challenges';
        const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
        if (stored) {
          const joinedIds = JSON.parse(stored);
          const isJoined = joinedIds.includes(challengeId);
          setHasJoined(isJoined);

          // Load progress if joined
          if (isJoined) {
            try {
              const progressKey = `challenge-progress-${challengeId}`;
              const progressStored = await AsyncStorage.getItem(progressKey);
              if (progressStored) {
                setCompletedRecipes(parseInt(progressStored, 10));
              }
            } catch (e) {
              // Progress not found, default to 0
            }
          }
        }
      } catch (error) {
        console.error('Error checking joined status:', error);
      }
    };
    if (challengeId) {
      checkJoinedStatus();
    }
  }, [challengeId]);

  const screenWidth = Dimensions.get('window').width;
  const recipeCardWidth = screenWidth * 0.65; // Slightly wider cards for better visibility

  // Fetch challenge details and recipes
  useEffect(() => {
    const fetchChallengeAndRecipes = async () => {
      if (!challengeId) return;

      try {
        const docRef = doc(db, 'challenges', challengeId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const challengeData = { id: docSnap.id, ...docSnap.data() } as any;
          setChallenge(challengeData);

          // Fetch recipes if IDs exist
          if (challengeData.recipeIds && challengeData.recipeIds.length > 0) {
            try {
              // Firestore 'in' query supports up to 10 items. 
              // If more, we might need to chunk or fetch individually.
              // For now assuming <= 10 or passing multiple queries.

              // Helper to chunk array
              const chunkArray = (arr: string[], size: number) => {
                const results = [];
                while (arr.length) {
                  results.push(arr.splice(0, size));
                }
                return results;
              };

              // Work on a copy
              const idsToFetch = [...challengeData.recipeIds];
              // Chunk into groups of 10
              const chunks = [];
              while (idsToFetch.length > 0) {
                chunks.push(idsToFetch.splice(0, 10));
              }

              const allFetchedRecipes: Recipe[] = [];

              for (const chunk of chunks) {
                const recipesQuery = query(
                  collection(db, 'recipes'),
                  where(documentId(), 'in', chunk)
                );
                const recipesSnap = await getDocs(recipesQuery);
                const fetchedChunk = recipesSnap.docs.map(doc => {
                  const data = doc.data();

                  // Helper to determine dietary badge
                  let badge = { icon: '🍽️', label: '' };
                  if (data.tags) {
                    if (data.tags.includes('Vegan')) badge = { icon: '🌱', label: 'VE' };
                    else if (data.tags.includes('Vegetarian')) badge = { icon: '🥕', label: 'V' };
                    else if (data.tags.includes('Gluten-free')) badge = { icon: '🌾', label: 'GF' };
                  }

                  return {
                    id: doc.id,
                    title: data.title,
                    image: data.image || 'https://via.placeholder.com/300x200?text=Recipe',
                    dietaryBadge: badge
                  };
                });
                allFetchedRecipes.push(...fetchedChunk);
              }

              setChallengeRecipes(allFetchedRecipes);
            } catch (err) {
              console.error("Error fetching challenge recipes:", err);
            }
          }
        } else {
          console.error("No such challenge!");
        }
      } catch (error) {
        console.error("Error fetching challenge details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChallengeAndRecipes();
  }, [challengeId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#B8E6D3', justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#B8E6D3', justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Challenge not found</Text>
      </SafeAreaView>
    );
  }

  const handleJoinChallenge = async () => {
    if (!hasJoined) {
      setHasJoined(true);
      setShowNotification(true);

      // Optimistically update local state immediately
      setChallenge((prev: any) => ({
        ...prev,
        participants: (prev.participants || 0) + 1
      }));

      // Save joined challenge to AsyncStorage
      try {
        const JOINED_CHALLENGES_KEY = 'joined-challenges';
        const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
        const joinedIds = stored ? JSON.parse(stored) : [];
        if (!joinedIds.includes(challengeId)) {
          joinedIds.push(challengeId);
          await AsyncStorage.setItem(JOINED_CHALLENGES_KEY, JSON.stringify(joinedIds));
        }

        // Increment participants count in Firestore
        const docRef = doc(db, 'challenges', challengeId);
        await updateDoc(docRef, {
          participants: increment(1)
        });

      } catch (error) {
        console.error('Error saving joined challenge:', error);
        // Revert local state on error
        setChallenge((prev: any) => ({
          ...prev,
          participants: Math.max(0, (prev.participants || 0) - 1)
        }));
        setHasJoined(false);
        alert('Failed to join challenge. Please try again.');
        setShowNotification(false);
      }

      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    }
  };

  const formatParticipants = (count: number) => {
    return Math.max(0, count || 0).toLocaleString();
  };

  const isScrolled = scrollY > 200; // Show collapsible header after scrolling past video
  const progressPercentage = challenge.recipeCount > 0
    ? (completedRecipes / challenge.recipeCount) * 100
    : 0;

  // Use coverImage if available, else videoThumbnail
  const coverImageSource = challenge.coverImage
    ? { uri: challenge.coverImage }
    : (challenge.videoThumbnail ? { uri: challenge.videoThumbnail } : null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: challenge.backgroundColor || '#B8E6D3' }]} edges={['top']}>
      {/* Collapsible Header - Shows when scrolled */}
      {isScrolled && (
        <View style={[styles.collapsibleHeader, { backgroundColor: challenge.backgroundColor || '#B8E6D3' }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.collapsibleHeaderTitle}>{challenge.title}</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowChallengeOptionsBottomSheet(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      )}

      {/* Default Header - Shows when not scrolled */}
      {!isScrolled && (
        <View style={[styles.header, { backgroundColor: challenge.backgroundColor || '#B8E6D3' }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowChallengeOptionsBottomSheet(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      )}

      {/* Joined Challenge Notification */}
      {showNotification && (
        <View style={styles.notificationBanner}>
          <View style={styles.notificationIcon}>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.notificationText}>You've joined the challenge!</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          setScrollY(offsetY);
        }}
        scrollEventThrottle={16}
      >
        <View style={{ paddingBottom: 24 }}>
          {/* Helper/Image Container */}
          {coverImageSource && (
            <View style={styles.videoContainer}>
              <Image
                source={coverImageSource}
                style={styles.videoThumbnail}
                resizeMode="cover"
              />
              {/* Show play button only if it's explicitly a video thumbnail (or maybe logic varies) 
                  For now hiding play button if using coverImage primarily as an image header
              */}
              {!challenge.coverImage && challenge.videoThumbnail && (
                <TouchableOpacity style={styles.playButton}>
                  <View style={styles.playButtonCircle}>
                    <Ionicons name="play" size={32} color="#1A1A1A" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Challenge Title */}
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Text style={styles.challengeSubtitle}>{challenge.subtitle}</Text>

          {/* Statistics */}
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Ionicons name="people-outline" size={16} color="#1A1A1A" />
              <Text style={styles.statText}>{formatParticipants(challenge.participants)}</Text>
            </View>
            <View style={styles.statBadge}>
              <Ionicons name="document-text-outline" size={16} color="#1A1A1A" />
              <Text style={styles.statText}>{challenge.recipeCount} Recipes</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{challenge.description}</Text>

          {/* Progress Section - Only show if joined */}
          {hasJoined && (
            <View style={[styles.progressSection, { backgroundColor: challenge.backgroundColor || '#B8E6D3' }]}>
              <Text style={styles.progressText}>
                {completedRecipes}/{challenge.recipeCount} Recipes
              </Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressActionText}>GET COOKING!</Text>
              </View>
            </View>
          )}

          {/* Join Challenge Button - Only show if not joined */}
          {!hasJoined && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinChallenge}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>
                JOIN CHALLENGE
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recipes Section - White Background */}
        <View style={styles.recipesSectionContainer}>
          <Text style={styles.recipesSectionTitle}>
            You'll pick from these recipes to complete this challenge:
          </Text>

          {challengeRecipes.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipesScrollContent}
            >
              {challengeRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={[styles.recipeCard, { width: recipeCardWidth }]}
                  onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id })}
                >
                  <Image
                    source={{ uri: recipe.image }}
                    style={styles.recipeImage}
                    resizeMode="cover"
                  />
                  <View style={[styles.recipeBadge, { backgroundColor: challenge.backgroundColor || '#B8E6D3' }]}>
                    <Text style={styles.recipeBadgeIcon}>{recipe.dietaryBadge.icon}</Text>
                    {recipe.dietaryBadge.label && (
                      <Text style={styles.recipeBadgeText}>{recipe.dietaryBadge.label}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.recipeAddButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      // TODO: Handle add recipe to meal plan
                    }}
                  >
                    <Ionicons name="add" size={20} color="#1A1A1A" />
                  </TouchableOpacity>
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={{ marginHorizontal: 16, color: '#666', fontStyle: 'italic', marginBottom: 24 }}>
              No specific recipes assigned yet.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Challenge Options Bottom Sheet */}
      <BottomSheet
        visible={showChallengeOptionsBottomSheet}
        onClose={() => setShowChallengeOptionsBottomSheet(false)}
        height="25%"
      >
        <View style={styles.challengeOptionsContent}>
          <TouchableOpacity
            style={styles.challengeOptionItem}
            onPress={() => {
              // TODO: Implement share challenge functionality
              setShowChallengeOptionsBottomSheet(false);
            }}
          >
            <Ionicons name="share-outline" size={24} color="#1A1A1A" />
            <Text style={styles.challengeOptionText}>Share Challenge</Text>
          </TouchableOpacity>
          {hasJoined && (
            <TouchableOpacity
              style={styles.challengeOptionItem}
              onPress={async () => {
                // Remove challenge from joined challenges
                try {
                  const JOINED_CHALLENGES_KEY = 'joined-challenges';
                  const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
                  if (stored) {
                    const joinedIds = JSON.parse(stored);
                    const updatedIds = joinedIds.filter((id: string) => id !== challengeId);
                    await AsyncStorage.setItem(JOINED_CHALLENGES_KEY, JSON.stringify(updatedIds));
                    // Update local state
                    setHasJoined(false);

                    // Decrement participants count in Firestore ONLY if > 0
                    if ((challenge?.participants || 0) > 0) {
                      const docRef = doc(db, 'challenges', challengeId);
                      await updateDoc(docRef, {
                        participants: increment(-1)
                      });
                    }

                    // Optimistically update local state ensuring no negative count
                    setChallenge((prev: any) => ({
                      ...prev,
                      participants: Math.max(0, (prev.participants || 0) - 1)
                    }));
                  }
                } catch (error) {
                  console.error('Error leaving challenge:', error);
                }
                setShowChallengeOptionsBottomSheet(false);
                navigation.goBack();
              }}
            >
              <Ionicons name="exit-outline" size={24} color="#1A1A1A" />
              <Text style={styles.challengeOptionText}>Leave Challenge</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  collapsibleHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    flex: 1,
  },
  menuButton: {
    padding: 8,
    marginRight: -8,
  },
  notificationBanner: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  notificationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  videoContainer: {
    width: Dimensions.get('window').width - 32,
    alignSelf: 'center',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 16,
  },
  challengeSubtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 4,
    marginHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginHorizontal: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 24,
    marginTop: 16,
    marginHorizontal: 16,
    textAlign: 'center',
  },
  progressSection: {
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    // backgroundColor set dynamically
    borderRadius: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
  },
  progressActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    fontStyle: 'italic',
  },
  joinButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: 16,
  },
  joinButtonJoined: {
    backgroundColor: '#4CAF50',
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  recipesSectionContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 60, // Increased to ensure safe area coverage
    marginTop: 8,
    minHeight: 300,
    flex: 1,
  },
  recipesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  recipesScrollContent: {
    paddingHorizontal: 16,
    paddingRight: 16,
    gap: 12,
  },
  recipeCard: {
    marginRight: 12,
    marginBottom: 8,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  recipeBadge: {
    position: 'absolute',
    bottom: 50,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set dynamically
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  recipeBadgeIcon: {
    fontSize: 12,
  },
  recipeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  recipeAddButton: {
    position: 'absolute',
    bottom: 50,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 8,
  },
  challengeOptionsContent: {
    paddingTop: 8,
  },
  challengeOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  challengeOptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
});

export default ChallengeDetailScreen;
