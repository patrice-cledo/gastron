import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { usePhotoImportStore, ImportStatus } from '../stores/photoImportStore';

interface ImportProgressModalProps {
  visible: boolean;
  onCancel: () => void;
  importId?: string;
  status?: ImportStatus;
  uploadProgress?: number;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  visible,
  onCancel,
  importId,
  status,
  uploadProgress,
}) => {
  const theme = useTheme();
  const photoImportStatus = usePhotoImportStore((state) => state.status);
  const photoImportProgress = usePhotoImportStore((state) => state.uploadProgress);
  
  // Use provided status/progress or fall back to photo import store
  const currentStatus = status || photoImportStatus;
  const currentProgress = uploadProgress !== undefined ? uploadProgress : photoImportProgress;

  const getStatusMessage = () => {
    switch (currentStatus) {
      case 'uploading':
        return {
          title: 'Uploading image...',
          subtitle: `Uploading... ${Math.round(currentProgress)}%`,
        };
      case 'queued':
        return {
          title: 'Queued for processing',
          subtitle: 'Your image is in the queue',
        };
      case 'ocr':
        return {
          title: 'Reading text...',
          subtitle: 'Extracting text from image',
        };
      case 'extracting':
        return {
          title: 'Building recipe...',
          subtitle: 'Structuring recipe data',
        };
      case 'ready':
        return {
          title: 'Almost done...',
          subtitle: 'Preparing your recipe',
        };
      case 'failed':
        return {
          title: 'Import failed',
          subtitle: 'Please try again',
        };
      default:
        return {
          title: 'Importing recipe...',
          subtitle: 'This can take a moment',
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.title}>{statusMessage.title}</Text>
            <Text style={styles.subtitle}>{statusMessage.subtitle}</Text>
            
            {currentStatus === 'uploading' && currentProgress > 0 && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${currentProgress}%`,
                        backgroundColor: theme.colors.accent,
                      }
                    ]} 
                  />
                </View>
              </View>
            )}
            
            {importId && (
              <Text style={styles.importId}>Import ID: {importId}</Text>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    maxWidth: 320,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  importId: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 16,
    marginBottom: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
