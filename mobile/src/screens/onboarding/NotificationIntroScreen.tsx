import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../../theme/ThemeProvider';

type NotificationIntroScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NotificationIntro'>;

interface NotificationIntroScreenProps {
  navigation: NotificationIntroScreenNavigationProp;
}

const NotificationIntroScreen: React.FC<NotificationIntroScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const handleContinue = () => {
    navigation.navigate('NotificationPermission');
  };

  const handleAskMeLater = () => {
    // Skip to next onboarding step
    navigation.navigate('CreateCollectionIntro');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Simulated Notification Panel */}
        <View style={styles.notificationPanel}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTime}>17:48</Text>
            <View style={styles.notificationStatusIcons}>
              <Ionicons name="cellular" size={12} color={theme.colors.black} />
              <Ionicons name="wifi" size={12} color={theme.colors.black} style={styles.statusIcon} />
              <Ionicons name="battery-full" size={12} color={theme.colors.black} style={styles.statusIcon} />
            </View>
          </View>
          
          <View style={styles.notificationCard}>
            <View style={styles.notificationIconContainer}>
              <Ionicons name="bookmark" size={24} color={theme.colors.black} />
            </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>Got plans tonight?</Text>
              <Text style={styles.notificationTimeLabel}>Now</Text>
              <Text style={styles.notificationMessage}>
                Checkout that new restaurant you saved last week!
              </Text>
            </View>
          </View>

          {/* App icons grid background */}
          <View style={styles.appIconsGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={styles.appIconPlaceholder} />
            ))}
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.headline}>
            Turn saved into Cooked with Notifications
          </Text>
          <Text style={styles.description}>
            We will send you notifications to remind you of the recipes you saved for later.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons - pinned at very bottom */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.askMeLaterButton}
          onPress={handleAskMeLater}
          activeOpacity={0.7}
        >
          <Text style={styles.askMeLaterText}>Ask Me Later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

function makeStyles(theme: Theme) {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 24,
    },
    notificationPanel: {
      backgroundColor: c.parchment,
      borderRadius: 16,
      padding: 16,
      marginBottom: 40,
      minHeight: 200,
      borderWidth: 1,
      borderColor: c.border,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    notificationTime: {
      fontSize: 14,
      fontWeight: '600',
      color: c.black,
    },
    notificationStatusIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusIcon: {
      marginLeft: 4,
    },
    notificationCard: {
      backgroundColor: c.cardBackground,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    notificationIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: '#FFE5E5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.black,
      marginBottom: 4,
    },
    notificationTimeLabel: {
      fontSize: 12,
      fontWeight: '400',
      color: c.darkGray,
      marginBottom: 8,
    },
    notificationMessage: {
      fontSize: 14,
      fontWeight: '400',
      color: c.black,
      lineHeight: 20,
    },
    appIconsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    appIconPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 10,
      backgroundColor: c.beige,
    },
    content: {
      alignItems: 'center',
      marginBottom: 24,
    },
    headline: {
      fontSize: 28,
      fontWeight: '700',
      color: c.black,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 36,
    },
    description: {
      fontSize: 16,
      fontWeight: '400',
      color: c.darkGray,
      textAlign: 'center',
      lineHeight: 24,
    },
    actions: {
      width: '100%',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    continueButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    continueButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.white,
    },
    askMeLaterButton: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    askMeLaterText: {
      fontSize: 14,
      fontWeight: '400',
      color: c.darkGray,
    },
  });
}

export default NotificationIntroScreen;
