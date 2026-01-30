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

  const showCameraOptions = () => {
    // Use requestAnimationFrame to ensure modal is fully closed
    requestAnimationFrame(() => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              handleTakePhoto();
            } else if (buttonIndex === 2) {
              handleChooseFromLibrary();
            }
          }
        );
      } else {
        // Android
        Alert.alert(
          'Select Photo',
          '',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: handleTakePhoto },
            { text: 'Choose from Library', onPress: handleChooseFromLibrary },
          ],
          { cancelable: true }
        );
      }
    });
  };

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

