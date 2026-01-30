import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  drawerWidth?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose, drawerWidth = 300 }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-drawerWidth)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, drawerWidth]);

  const menuItems = [
    {
      group: 'App Features',
      items: [
        { label: 'Add the CookThisPage shortcut', icon: 'link-outline' },
        { label: 'Read our import guides', icon: 'document-text-outline' },
        { label: 'Use CookThisPage on desktop', icon: 'desktop-outline' },
      ],
    },
    {
      group: 'Social and Support',
      items: [
        { label: 'Invite friends', icon: 'person-add-outline' },
        { label: 'Help', icon: 'help-circle-outline' },
      ],
    },
    {
      group: 'Settings',
      items: [
        { label: 'Settings', icon: 'settings-outline' },
      ],
    },
  ];

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.drawer,
        {
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
          width: drawerWidth,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Menu Items */}
                {menuItems.map((group, groupIndex) => (
                  <View key={groupIndex} style={styles.menuGroup}>
                    {group.items.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={itemIndex}
                        style={styles.menuItem}
                        onPress={() => {
                          console.log('Menu item pressed:', item.label);
                          onClose();
                        }}
                      >
                        <Ionicons name={item.icon as any} size={24} color="#1A1A1A" />
                        <Text style={styles.menuItemText}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 4.8.2 (410)</Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  menuGroup: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
});

export default DrawerMenu;

