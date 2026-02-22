import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useModal } from '../../context/ModalContext';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../../types/navigation';

type CreateScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Create'>;

interface CreateScreenProps {
  navigation: CreateScreenNavigationProp;
}

const CreateScreen: React.FC<CreateScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { isImportModalVisible, showImportModal } = useModal();

  // Show modal when this screen is focused (fallback if navigated directly)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      showImportModal();
    });

    return unsubscribe;
  }, [navigation, showImportModal]);



  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Empty screen - modal is handled globally via ModalContext */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CreateScreen;

