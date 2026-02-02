import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useModal } from '../context/ModalContext';

export const FloatingCreateButton: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showImportModal } = useModal();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          bottom: 80 + Math.max(insets.bottom, 8),
          backgroundColor: theme.colors.accent,
        }
      ]}
      onPress={showImportModal}
      activeOpacity={0.8}
    >
      <Ionicons name="add" size={28} color={theme.colors.black} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
