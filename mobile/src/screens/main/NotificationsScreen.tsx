import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

interface Message {
  id: string;
  sender: string;
  timestamp: string;
  date: string;
  content: string;
  imageUrl?: string;
  recipeId?: string;
  recipeTitle?: string;
  isRead: boolean;
}

const NotificationsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { markAsRead, readMessageIds } = useNotificationsStore();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('scheduledFor', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      const newIds: string[] = [];
      const now = new Date();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const scheduledFor = (data.scheduledFor as Timestamp)?.toDate();

        // Only show notifications that are scheduled for now or the past
        if (!scheduledFor || scheduledFor > now) return;

        // Parse date for grouping
        let dateObj = new Date();
        if (data.scheduledFor) {
          dateObj = data.scheduledFor.toDate();
        } else if (data.createdAt) {
          dateObj = data.createdAt.toDate();
        }

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateGroup = dateObj.toLocaleDateString();
        if (dateObj.toDateString() === today.toDateString()) {
          dateGroup = 'Today';
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
          dateGroup = 'Yesterday';
        } else {
          dateGroup = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }

        fetchedMessages.push({
          id: doc.id,
          sender: data.sender || 'Gastron',
          timestamp: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: dateGroup,
          content: data.body,
          imageUrl: data.imageUrl,
          recipeId: data.recipeId,
          isRead: readMessageIds.includes(doc.id)
        });

        if (!readMessageIds.includes(doc.id)) {
          newIds.push(doc.id);
        }
      });

      // After fetching all messages, separately fetch recipe titles for ones with a recipeId
      const enrichMessagesWithRecipes = async () => {
        const enriched = await Promise.all(fetchedMessages.map(async (msg) => {
          if (msg.recipeId) {
            try {
              const recipeDoc = await getDoc(doc(db, 'recipes', msg.recipeId));
              if (recipeDoc.exists()) {
                const data = recipeDoc.data();
                let finalImageUrl = msg.imageUrl || data.image;

                // Resolve Firebase Storage paths
                if (finalImageUrl && typeof finalImageUrl === 'string' &&
                  !finalImageUrl.startsWith('http') &&
                  !finalImageUrl.startsWith('file://')) {
                  try {
                    finalImageUrl = await getDownloadURL(ref(storage, finalImageUrl));
                  } catch (imgError) {
                    console.error('Error resolving image URL:', imgError);
                  }
                }

                return {
                  ...msg,
                  recipeTitle: data.title,
                  imageUrl: finalImageUrl
                };
              }
            } catch (err) {
              console.error('Error fetching recipe for notification:', err);
            }
          }
          return msg;
        }));
        setMessages(enriched);
      };

      enrichMessagesWithRecipes();

      // Auto-mark as read when fetched
      newIds.forEach(id => markAsRead(id));

    });

    return () => unsubscribe();
  }, [markAsRead, readMessageIds]);

  // Group messages by date
  const groupedMessages = messages.reduce((acc, message) => {
    if (!acc[message.date]) {
      acc[message.date] = [];
    }
    acc[message.date].push(message);
    return acc;
  }, {} as Record<string, Message[]>);

  const formatDate = (dateString: string) => {
    return dateString;
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
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <View key={date} style={styles.dateGroup}>
            {/* Date Header */}
            <View style={styles.dateHeaderContainer}>
              <View style={styles.dateLine} />
              <Text style={styles.dateHeader}>{formatDate(date)}</Text>
              <View style={styles.dateLine} />
            </View>

            {/* Messages for this date */}
            {dateMessages.map((message) => (
              <View key={message.id} style={styles.messageContainer}>
                <View style={styles.messageHeader}>
                  <View style={styles.senderIcon}>
                    <Text style={styles.senderIconText}>G</Text>
                  </View>
                  <View style={styles.messageHeaderText}>
                    <Text style={styles.senderName}>{message.sender}</Text>
                    <Text style={styles.timestamp}>{message.timestamp}</Text>
                  </View>
                </View>
                <Text style={styles.messageContent}>{message.content}</Text>
                {message.imageUrl && !message.recipeId && (
                  <Image source={{ uri: message.imageUrl }} style={styles.messageImage} />
                )}

                {message.recipeId && (
                  <TouchableOpacity
                    style={styles.recipeCardContainer}
                    onPress={() => navigation.navigate('RecipeDetail', { recipeId: message.recipeId! })}
                    activeOpacity={0.9}
                  >
                    <View style={styles.recipeImageWrapper}>
                      {message.imageUrl ? (
                        <Image source={{ uri: message.imageUrl }} style={styles.recipeCardImage} />
                      ) : (
                        <View style={[styles.recipeCardImage, styles.recipeImagePlaceholder]}>
                          <Ionicons name="restaurant-outline" size={40} color="#CCCCCC" />
                        </View>
                      )}

                      {/* Plus Button Overlay */}
                      <TouchableOpacity
                        style={styles.plusButtonOverlay}
                        onPress={() => navigation.navigate('RecipeDetail', { recipeId: message.recipeId!, autoOpenMenu: true })}
                      >
                        <Ionicons name="add" size={24} color="#1A1A1A" />
                      </TouchableOpacity>
                    </View>

                    {message.recipeTitle && (
                      <Text style={styles.recipeCardTitle}>{message.recipeTitle}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ))}
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
    paddingBottom: 20,
  },
  dateGroup: {
    marginTop: 24,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
    marginHorizontal: 12,
  },
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CEEC2C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  senderIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  messageHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B6B6B',
  },
  messageContent: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 20,
    marginLeft: 52, // Align with message content (icon width + margin)
  },
  messageImage: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    marginTop: 12,
    marginLeft: 52,
    resizeMode: 'cover',
  },
  recipeCardContainer: {
    marginTop: 16,
    marginLeft: 52,
    marginRight: 16,
  },
  recipeImageWrapper: {
    width: '100%',
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  recipeCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recipeImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  plusButtonOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5DA4D', // Yellow color from screenshot
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  recipeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    marginLeft: 4,
  }
});

export default NotificationsScreen;
