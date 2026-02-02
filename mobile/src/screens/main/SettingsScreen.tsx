import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { CommonActions } from '@react-navigation/native';
import { useRecipesStore } from '../../stores/recipesStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { useGroceriesStore } from '../../stores/groceriesStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const appVersion = '0.0.1';
  const buildNumber = '1';
  
  // Store references for clearing on logout
  const setRecipes = useRecipesStore((state) => state.setRecipes);
  const setMealPlans = useMealPlanStore((state) => state.setMealPlans);
  const clearAllItems = useGroceriesStore((state) => state.clearAllItems);

  // Get current user email
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.email) {
      setUserEmail(currentUser.email);
    }
  }, []);

  const handleStartTrial = () => {
    navigation.navigate('Pricing');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              // Clear all local stores
              setRecipes([]);
              setMealPlans([]);
              clearAllItems();
              
              // Clear AsyncStorage (this will clear all persisted Zustand stores)
              await AsyncStorage.multiRemove([
                'recipes-storage',
                'meal-plan-storage',
                'groceries-storage',
              ]);
              
              // Sign out from Firebase
              await signOut(auth);
              console.log('User logged out successfully');
              
              // Reset navigation stack to Welcome screen
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Welcome' }],
                })
              );
            } catch (error: any) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>SETTINGS</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleStartTrial}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="gift-outline" size={24} color="#1A1A1A" />
            </View>
            <Text style={styles.menuText}>Start my 30 day free trial</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="restaurant-outline" size={24} color="#1A1A1A" />
            </View>
            <Text style={styles.menuText}>Recipe Requests</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="share-social-outline" size={24} color="#1A1A1A" />
            </View>
            <Text style={styles.menuText}>Invite Your Friends</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="headset-outline" size={24} color="#1A1A1A" />
            </View>
            <Text style={styles.menuText}>Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconContainer}>
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Ionicons name="log-out-outline" size={24} color="#1A1A1A" />
              )}
            </View>
            <Text style={styles.menuText}>Log out</Text>
            {!isLoggingOut && <Ionicons name="chevron-forward" size={20} color="#999" />}
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={handleStartTrial}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaButtonText}>START MY 30 DAY FREE TRIAL</Text>
        </TouchableOpacity>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Logged in as:</Text>
          <Text style={styles.footerEmail}>{userEmail || 'Loading...'}</Text>
          <Text style={styles.footerVersion}>version {appVersion} (build {buildNumber})</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#CEEC2C',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  menuContainer: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuIconContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
  },
  ctaButton: {
    backgroundColor: '#CEEC2C',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginBottom: 4,
  },
  footerEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  footerVersion: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
  },
});

export default SettingsScreen;
