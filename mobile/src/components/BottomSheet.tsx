import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | string; // Height as percentage string (e.g., '75%') or number
  backgroundColor?: string; // Custom background color
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  height,
  backgroundColor,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 20),
              backgroundColor: backgroundColor || '#FFFFFF',
              ...(height 
                ? typeof height === 'string' 
                  ? { height: height as `${number}%` }
                  : { height }
                : { height: '90%' as `${number}%` }
              ),
            },
          ]}
        >
          {/* Handle/Notch Indicator */}
          <View style={styles.handleContainer}>
            <View style={[
              styles.handleIndicator,
              (backgroundColor === '#FFD700' || backgroundColor === '#CEEC2C') && { backgroundColor: 'rgba(0, 0, 0, 0.2)' }
            ]} />
          </View>

          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D0D0D0',
    borderRadius: 2,
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
});
