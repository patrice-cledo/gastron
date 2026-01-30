import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheet } from './BottomSheet';

interface CameraOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromLibrary: () => void;
}

export const CameraOptionsModal: React.FC<CameraOptionsModalProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onChooseFromLibrary,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="">
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => {
            onTakePhoto();
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.optionText}>Take photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => {
            onChooseFromLibrary();
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.optionText}>Choose from library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionButton, styles.cancelButton]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  optionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FF6B35',
    textAlign: 'center',
  },
  cancelButton: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FF6B35',
    textAlign: 'center',
  },
});

