import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Cookbook {
  id: string;
  name: string;
}

interface CookbookSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCookbook: (cookbookId: string) => void;
  onCreateCookbook: (name: string) => void;
}

export const CookbookSelectionModal: React.FC<CookbookSelectionModalProps> = ({
  visible,
  onClose,
  onSelectCookbook,
  onCreateCookbook,
}) => {
  const insets = useSafeAreaInsets();
  const [isCreating, setIsCreating] = useState(false);
  const [newCookbookName, setNewCookbookName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Mock cookbooks - in real app, this would come from storage/API
  const [cookbooks] = useState<Cookbook[]>([
    { id: '1', name: 'My Recipes' },
    { id: '2', name: 'Desserts' },
    { id: '3', name: 'Quick Meals' },
  ]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsCreating(false);
      setNewCookbookName('');
      Keyboard.dismiss();
    }
  }, [visible]);

  // Focus input when creating mode is activated
  useEffect(() => {
    if (isCreating && visible) {
      // Delay to ensure the view is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
        // Scroll to show the input field
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 300);
    }
  }, [isCreating, visible]);

  const handleCreateCookbook = () => {
    if (newCookbookName.trim()) {
      Keyboard.dismiss();
      onCreateCookbook(newCookbookName.trim());
      setNewCookbookName('');
      setIsCreating(false);
      onClose();
    }
  };

  const handleSelectCookbook = (cookbookId: string) => {
    onSelectCookbook(cookbookId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.modal,
                  {
                    paddingBottom: Math.max(insets.bottom, 24),
                  },
                ]}
              >
                <View style={styles.handle} />

                <View style={styles.header}>
                  <Text style={styles.title}>Select Cookbook</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                {!isCreating ? (
                  <>
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                      {cookbooks.map((cookbook) => (
                        <TouchableOpacity
                          key={cookbook.id}
                          style={styles.cookbookItem}
                          onPress={() => handleSelectCookbook(cookbook.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.cookbookName}>{cookbook.name}</Text>
                          <Text style={styles.arrow}>→</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={() => {
                        Keyboard.dismiss();
                        // Small delay to ensure keyboard is dismissed before switching views
                        setTimeout(() => {
                          setIsCreating(true);
                        }, 100);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.createButtonText}>+ Create New Cookbook</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <ScrollView
                    ref={scrollViewRef}
                    style={styles.createScrollView}
                    contentContainerStyle={styles.createScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                  >
                    <View style={styles.createContainer}>
                      <Text style={styles.createLabel}>Cookbook Name</Text>
                      <TextInput
                        ref={inputRef}
                        style={styles.nameInput}
                        value={newCookbookName}
                        onChangeText={setNewCookbookName}
                        placeholder="Enter cookbook name"
                        placeholderTextColor="#999"
                        returnKeyType="done"
                        onSubmitEditing={handleCreateCookbook}
                      />
                      <View style={styles.createActions}>
                        <TouchableOpacity
                          style={styles.cancelCreateButton}
                          onPress={() => {
                            Keyboard.dismiss();
                            setIsCreating(false);
                            setNewCookbookName('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.cancelCreateText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.saveCreateButton,
                            !newCookbookName.trim() && styles.saveCreateButtonDisabled,
                          ]}
                          onPress={handleCreateCookbook}
                          disabled={!newCookbookName.trim()}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.saveCreateText}>Create</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D0D0D0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
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
  content: {
    maxHeight: 400,
  },
  cookbookItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0DA',
  },
  cookbookName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  arrow: {
    fontSize: 18,
    color: '#999',
  },
  createButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0DA',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  createScrollView: {
    flex: 1,
  },
  createScrollContent: {
    paddingBottom: 40,
    minHeight: 200,
  },
  createContainer: {
    paddingVertical: 8,
  },
  createLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#E0E0DA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 24,
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelCreateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F0',
    alignItems: 'center',
  },
  cancelCreateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  saveCreateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  saveCreateButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  saveCreateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

