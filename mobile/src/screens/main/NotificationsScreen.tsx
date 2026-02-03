import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useNotificationsStore } from '../../stores/notificationsStore';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

interface Message {
  id: string;
  sender: string;
  timestamp: string;
  date: string;
  content: string;
}

const NotificationsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { markAsRead } = useNotificationsStore();

  // Sample messages data - grouped by date
  const messages: Message[] = [
    {
      id: '4',
      sender: 'Gastron',
      timestamp: '10:30AM',
      date: 'Today',
      content: "New recipe recommendations are ready! Check out our latest collection of delicious dishes tailored just for you.",
    },
    {
      id: '1',
      sender: 'Gastron',
      timestamp: '2:00AM',
      date: 'Saturday 17th of January',
      content: "You've got some amazing recipes lined up—now let's get started! Dive into your first recipe and enjoy the culinary adventure.",
    },
    {
      id: '2',
      sender: 'Gastron',
      timestamp: '3:00AM',
      date: 'Friday 16th of January',
      content: "Let us know your dietary needs, and we'll make sure your recipe recommendations fit you perfectly. Whether you're plant-based, gluten-free, or have any other preferences, we've got you covered. Take a moment to customise your experience now!",
    },
    {
      id: '3',
      sender: 'Gastron',
      timestamp: '2:00AM',
      date: 'Tuesday 13th of January',
      content: "Great news! We've saved your dietary preferences and customized your recipe recommendations just for you. Whether you're looking for something quick, hearty, or light, we've got plenty of options that match your taste. Ready to discover your perfect dish? Let's get cooking!",
    },
  ];

  // Mark all messages as read when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const messageIds = ['1', '2', '3', '4']; // Match the IDs from messages array
      messageIds.forEach(id => {
        markAsRead(id);
      });
    }, [markAsRead])
  );

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
});

export default NotificationsScreen;
