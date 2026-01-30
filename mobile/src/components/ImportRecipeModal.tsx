import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheet } from './BottomSheet';

interface ImportRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'browser' | 'camera' | 'paste' | 'scratch') => void;
}

export const ImportRecipeModal: React.FC<ImportRecipeModalProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const handleOptionPress = (option: 'browser' | 'camera' | 'paste' | 'scratch') => {
    // For camera, don't close immediately - let CreateScreen handle it
    if (option === 'camera') {
      onSelectOption(option);
      // Don't call onClose here - CreateScreen will handle closing
    } else {
      onSelectOption(option);
      onClose();
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>Import recipe</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.optionsContainer}>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleOptionPress('browser')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>🌐</Text>
            </View>
            <Text style={styles.optionText}>Browser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleOptionPress('camera')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>📷</Text>
            </View>
            <Text style={styles.optionText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleOptionPress('paste')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Text style={styles.optionIcon}>📋</Text>
            </View>
            <Text style={styles.optionText}>Paste Text</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.separator}>
          <Text style={styles.separatorText}>or</Text>
        </View>

        <TouchableOpacity
          style={styles.scratchButton}
          onPress={() => handleOptionPress('scratch')}
          activeOpacity={0.7}
        >
          <View style={styles.optionIconContainer}>
            <Text style={styles.optionIcon}>✏️</Text>
          </View>
          <Text style={styles.optionText}>Write from scratch</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  optionsContainer: {
    gap: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  optionIconContainer: {
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 32,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  separator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  separatorText: {
    fontSize: 14,
    color: '#999',
  },
  scratchButton: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});

