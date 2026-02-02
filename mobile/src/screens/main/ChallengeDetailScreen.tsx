import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
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
}

const ChallengeDetailScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<ChallengeDetailScreenNavigationProp>();
  const route = useRoute();
  const challengeId = (route.params as any)?.challengeId || '1';

  const [hasJoined, setHasJoined] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showChallengeOptionsBottomSheet, setShowChallengeOptionsBottomSheet] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [completedRecipes, setCompletedRecipes] = useState(0);

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
    checkJoinedStatus();
  }, [challengeId]);

  const screenWidth = Dimensions.get('window').width;
  const recipeCardWidth = screenWidth * 0.65; // Slightly wider cards for better visibility

  // Mock challenge data
  const challenge = {
    id: challengeId,
    title: 'Italian Cuisine',
    subtitle: 'Cook 5 Italian Recipes',
    description: 'Welcome to the Italian Cuisine Challenge, where simplicity meets incredible flavour. From silky pasta to rich risottos and rustic stews, Italian food is about fresh ingredients and time-honoured techniques. This challenge invites you to cook five recipes and explore the essence of Italy. It\'s time to bring a taste of la dolce vita into your kitchen!',
    participants: 1220,
    recipeCount: 5,
    videoThumbnail: 'https://via.placeholder.com/400x300?text=Video+Thumbnail',
  };

  const recipes: Recipe[] = [
    {
      id: '1',
      title: 'Tempeh & Wild Mushroom',
      image: 'https://via.placeholder.com/300x200?text=Pasta+Dish',
      dietaryBadge: { icon: '🍎', label: 'VE' },
    },
    {
      id: '2',
      title: 'Broccoli Pasta Tagliatelle',
      image: 'https://via.placeholder.com/300x200?text=Tagliatelle',
      dietaryBadge: { icon: '🥕', label: 'V' },
    },
    {
      id: '3',
      title: 'Classic Carbonara',
      image: 'https://via.placeholder.com/300x200?text=Carbonara',
      dietaryBadge: { icon: '🍝', label: '' },
    },
    {
      id: '4',
      title: 'Margherita Pizza',
      image: 'https://via.placeholder.com/300x200?text=Pizza',
      dietaryBadge: { icon: '🍕', label: 'V' },
    },
    {
      id: '5',
      title: 'Risotto ai Funghi',
      image: 'https://via.placeholder.com/300x200?text=Risotto',
      dietaryBadge: { icon: '🍄', label: 'V' },
    },
  ];

  const handleJoinChallenge = async () => {
    if (!hasJoined) {
      setHasJoined(true);
      setShowNotification(true);
      
      // Save joined challenge to AsyncStorage
      try {
        const JOINED_CHALLENGES_KEY = 'joined-challenges';
        const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
        const joinedIds = stored ? JSON.parse(stored) : [];
        if (!joinedIds.includes(challengeId)) {
          joinedIds.push(challengeId);
          await AsyncStorage.setItem(JOINED_CHALLENGES_KEY, JSON.stringify(joinedIds));
        }
      } catch (error) {
        console.error('Error saving joined challenge:', error);
      }
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    }
  };

  const formatParticipants = (count: number) => {
    return count.toLocaleString();
  };

  const isScrolled = scrollY > 200; // Show collapsible header after scrolling past video
  const progressPercentage = challenge.recipeCount > 0 
    ? (completedRecipes / challenge.recipeCount) * 100 
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#B8E6D3' }]} edges={['top']}>
      {/* Collapsible Header - Shows when scrolled */}
      {isScrolled && (
        <View style={styles.collapsibleHeader}>
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
        <View style={styles.header}>
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
        {/* Video Thumbnail */}
        <View style={styles.videoContainer}>
          <Image
            source={{ uri: challenge.videoThumbnail }}
            style={styles.videoThumbnail}
            resizeMode="cover"
          />
          <TouchableOpacity style={styles.playButton}>
            <View style={styles.playButtonCircle}>
              <Ionicons name="play" size={32} color="#1A1A1A" />
            </View>
          </TouchableOpacity>
        </View>

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
          <View style={styles.progressSection}>
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

        {/* Join Challenge Button */}
        <TouchableOpacity
          style={[styles.joinButton, hasJoined && styles.joinButtonJoined]}
          onPress={handleJoinChallenge}
        >
          <Ionicons name={hasJoined ? "checkmark" : "add"} size={20} color="#FFFFFF" />
          <Text style={styles.joinButtonText}>
            {hasJoined ? 'JOINED' : 'JOIN CHALLENGE'}
          </Text>
        </TouchableOpacity>

        {/* Recipes Section */}
        <Text style={styles.recipesSectionTitle}>
          You'll pick from these recipes to complete this challenge:
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recipesScrollContent}
        >
          {recipes.map((recipe) => (
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
              <View style={styles.recipeBadge}>
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
                    setHasJoined(false);
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
    backgroundColor: '#B8E6D3',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#B8E6D3',
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
    paddingBottom: 20,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginTop: 16,
    position: 'relative',
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
    backgroundColor: '#B8E6D3',
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
  recipesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 32,
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
    backgroundColor: '#B8E6D3',
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
