import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

type CreateCollectionIntroScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateCollectionIntro'>;

interface CreateCollectionIntroScreenProps {
  navigation: CreateCollectionIntroScreenNavigationProp;
}

const CreateCollectionIntroScreen: React.FC<CreateCollectionIntroScreenProps> = ({ navigation }) => {
  const handleCreate = () => {
    navigation.navigate('CreateCollectionForm');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icons Arrangement */}
        <View style={styles.iconsContainer}>
          {/* Central Folder Icon */}
          <View style={styles.centralIcon}>
            <Ionicons name="folder" size={60} color="#FFFFFF" />
          </View>

          {/* Surrounding Icons - positioned around central icon */}
          <View style={styles.surroundingIcons}>
            <View style={[styles.smallIcon, styles.iconTop, { backgroundColor: '#4A9EFF' }]}>
              <Ionicons name="location" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.smallIcon, styles.iconTopRight, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="calendar" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.smallIcon, styles.iconMiddleRight, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="restaurant" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.smallIcon, styles.iconBottomRight, { backgroundColor: '#9C27B0' }]}>
              <Ionicons name="cart" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.smallIcon, styles.iconBottomLeft, { backgroundColor: '#9C27B0' }]}>
              <Ionicons name="musical-notes" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.smallIcon, styles.iconMiddleLeft, { backgroundColor: '#8D6E63' }]}>
              <Ionicons name="book" size={24} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.headline}>Create Your First Cookbook</Text>
          <Text style={styles.description}>
            Cookbooks help you organize your recipes by meal, cuisine, or occasion.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>Create a Cookbook</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconsContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  centralIcon: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  surroundingIcons: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  smallIcon: {
    width: 70,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  iconTop: {
    top: 0,
    left: '50%',
    marginLeft: -35,
  },
  iconTopRight: {
    top: 20,
    right: 20,
  },
  iconMiddleRight: {
    top: '50%',
    right: 0,
    marginTop: -35,
  },
  iconBottomRight: {
    bottom: 20,
    right: 20,
  },
  iconBottomLeft: {
    bottom: 20,
    left: 20,
  },
  iconMiddleLeft: {
    top: '50%',
    left: 0,
    marginTop: -35,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  createButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});

export default CreateCollectionIntroScreen;
