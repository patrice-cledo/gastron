import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useCollectionsStore } from '../../stores/collectionsStore';
import { useTheme, Theme } from '../../theme/ThemeProvider';

type CreateCollectionFormScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateCollectionForm'>;

interface CreateCollectionFormScreenProps {
  navigation: CreateCollectionFormScreenNavigationProp;
}

const CreateCollectionFormScreen: React.FC<CreateCollectionFormScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [collectionName, setCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const addCollection = useCollectionsStore((state) => state.addCollection);

  const handleCreate = async () => {
    const trimmed = collectionName.trim();
    if (!trimmed) {
      return;
    }

    setIsCreating(true);
    try {
      await addCollection(trimmed);
      navigation.navigate('CollectionCreated', { collectionName: trimmed });
    } catch (error) {
      console.error('Error creating collection:', error);
      // Still navigate to success screen
      navigation.navigate('CollectionCreated', { collectionName: trimmed });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Cookbook</Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Cookbook Name</Text>
            <TextInput
              style={styles.input}
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder="e.g., Breakfast, Desserts, Quick Meals..."
              placeholderTextColor={theme.colors.mediumGray}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          <TouchableOpacity
            style={[styles.createButton, (!collectionName.trim() || isCreating) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!collectionName.trim() || isCreating}
            activeOpacity={0.8}
          >
            <Text style={[styles.createButtonText, (!collectionName.trim() || isCreating) && styles.createButtonTextDisabled]}>
              {isCreating ? 'Creating...' : 'Create Collection'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 32,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.black,
    },
    formContainer: {
      marginBottom: 32,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: c.darkGray,
      marginBottom: 12,
    },
    input: {
      backgroundColor: c.white,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: c.black,
      borderWidth: 1,
      borderColor: c.border,
    },
    createButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 'auto',
      marginBottom: 40,
    },
    createButtonDisabled: {
      backgroundColor: c.lightGray,
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.white,
    },
    createButtonTextDisabled: {
      color: c.darkGray,
    },
  });
}

export default CreateCollectionFormScreen;
