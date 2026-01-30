import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ChallengesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Challenges'>;

interface Challenge {
  id: string;
  title: string;
  description: string;
  participants: number;
  profileEmoji: string;
  backgroundColor: string;
  recipeCount?: number;
}

interface ActiveChallenge extends Challenge {
  completedRecipes: number;
}

const JOINED_CHALLENGES_KEY = 'joined-challenges';

const ChallengesScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<ChallengesScreenNavigationProp>();
  const [joinedChallengeIds, setJoinedChallengeIds] = useState<string[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48) / 2; // 16px padding on each side + 16px gap between cards

  // Load joined challenges on focus
  useFocusEffect(
    React.useCallback(() => {
      const loadJoinedChallenges = async () => {
        try {
          const stored = await AsyncStorage.getItem(JOINED_CHALLENGES_KEY);
          if (stored) {
            const joinedIds = JSON.parse(stored);
            setJoinedChallengeIds(joinedIds);
            
            // Create active challenges from joined IDs
            const active = allChallenges
              .filter(ch => joinedIds.includes(ch.id))
              .map(ch => ({
                ...ch,
                completedRecipes: 0, // TODO: Load actual progress from storage
                recipeCount: ch.recipeCount || 5,
              }));
            setActiveChallenges(active);
          }
        } catch (error) {
          console.error('Error loading joined challenges:', error);
        }
      };
      loadJoinedChallenges();
    }, [])
  );

  const allChallenges: Challenge[] = [
    {
      id: '1',
      title: 'Spice Master',
      description: 'Cook 5 Recipes That Contain Storecupboard Spices',
      participants: 1980,
      profileEmoji: '👨‍🍳',
      backgroundColor: '#B8E6D3',
    },
    {
      id: '2',
      title: 'Middle Eastern Cuisine',
      description: 'Cook 5 Middle Eastern recipes',
      participants: 754,
      profileEmoji: '👨',
      backgroundColor: '#FFE5E5',
    },
    {
      id: '3',
      title: 'Italian Cuisine',
      description: 'Cook 5 Italian recipes',
      participants: 1210,
      profileEmoji: '👨‍🍳',
      backgroundColor: '#B8E6D3',
      recipeCount: 5,
    },
    {
      id: '4',
      title: 'Indian Cuisine',
      description: 'Cook 5 Indian recipes',
      participants: 635,
      profileEmoji: '👨',
      backgroundColor: '#FFE5E5',
    },
    {
      id: '5',
      title: 'Anti-Huttlestorm',
      description: 'Cook 5 recipes without huttlestorm',
      participants: 2338,
      profileEmoji: '👨‍🍳',
      backgroundColor: '#FFE5E5',
    },
    {
      id: '6',
      title: 'Cupboard Creations',
      description: 'Cook 5 recipes using only cupboard ingredients',
      participants: 1168,
      profileEmoji: '👨',
      backgroundColor: '#B8E6D3',
    },
    {
      id: '7',
      title: 'Food Waste',
      description: 'Cook 5 recipes to reduce food waste',
      participants: 892,
      profileEmoji: '👨‍🍳',
      backgroundColor: '#B8E6D3',
    },
    {
      id: '8',
      title: "Cheat's",
      description: 'Cook 5 quick and easy recipes',
      participants: 1456,
      profileEmoji: '👨',
      backgroundColor: '#FFE5E5',
    },
  ];

  // Filter out joined challenges from available challenges
  const availableChallenges = allChallenges.filter(
    challenge => !joinedChallengeIds.includes(challenge.id)
  );

  const formatParticipants = (count: number) => {
    return count.toLocaleString();
  };

  const getProgressPercentage = (completed: number, total: number) => {
    return total > 0 ? (completed / total) * 100 : 0;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Your Active Challenges Section */}
        {activeChallenges.length > 0 && (
          <View style={styles.activeChallengesSection}>
            <Text style={styles.sectionTitle}>Your Active Challenges</Text>
            {activeChallenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={[styles.activeChallengeCard, { backgroundColor: challenge.backgroundColor }]}
                onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
              >
                <View style={styles.activeChallengeHeader}>
                  <View style={styles.activeChallengeProfile}>
                    <Text style={styles.activeChallengeProfileEmoji}>{challenge.profileEmoji}</Text>
                  </View>
                  <View style={styles.activeChallengeContent}>
                    <View style={styles.activeChallengeTitleRow}>
                      <Text style={styles.activeChallengeTitle} numberOfLines={1}>
                        {challenge.title}
                      </Text>
                      <View style={styles.activeChallengeStats}>
                        <Ionicons name="people-outline" size={16} color="#1A1A1A" />
                        <Text style={styles.activeChallengeParticipants}>
                          {formatParticipants(challenge.participants)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.activeChallengeDescription}>
                      {challenge.description}
                    </Text>
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressText}>
                        {challenge.completedRecipes}/{challenge.recipeCount} Recipes
                      </Text>
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${getProgressPercentage(challenge.completedRecipes, challenge.recipeCount)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Available Challenges</Text>
        
        <View style={styles.challengesGrid}>
          {availableChallenges.map((challenge, index) => (
            <View
              key={challenge.id}
              style={[
                styles.challengeCard,
                { width: cardWidth, backgroundColor: challenge.backgroundColor },
              ]}
            >
              <View style={styles.challengeHeader}>
                <View style={styles.challengeProfile}>
                  <Text style={styles.challengeProfileEmoji}>{challenge.profileEmoji}</Text>
                </View>
                <Text style={styles.challengeTitle} numberOfLines={2}>
                  {challenge.title}
                </Text>
              </View>
              
              <View style={styles.challengeStats}>
                <Ionicons name="people-outline" size={16} color="#1A1A1A" />
                <Text style={styles.challengeParticipants}>
                  {formatParticipants(challenge.participants)}
                </Text>
              </View>
              
              <Text style={styles.challengeDescription} numberOfLines={3}>
                {challenge.description}
              </Text>
              
              <TouchableOpacity 
                style={styles.learnMoreButton}
                onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
              >
                <Text style={styles.learnMoreButtonText}>LEARN MORE</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
  },
  activeChallengesSection: {
    marginBottom: 24,
  },
  activeChallengeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeChallengeHeader: {
    flexDirection: 'row',
  },
  activeChallengeProfile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeChallengeProfileEmoji: {
    fontSize: 24,
  },
  activeChallengeContent: {
    flex: 1,
  },
  activeChallengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activeChallengeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  activeChallengeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeChallengeParticipants: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  activeChallengeDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666666',
    marginBottom: 4,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
  },
  challengesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  challengeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeProfile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  challengeProfileEmoji: {
    fontSize: 18,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    flexWrap: 'wrap',
  },
  challengeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  challengeParticipants: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  challengeDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 18,
    marginBottom: 12,
    minHeight: 54, // Approximate height for 3 lines
  },
  learnMoreButton: {
    backgroundColor: '#6B6B6B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMoreButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});

export default ChallengesScreen;
