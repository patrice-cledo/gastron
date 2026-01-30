import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabParamList } from '../types/navigation';
import { useModal } from '../context/ModalContext';
import { useTheme } from '../theme/ThemeProvider';
import RecipesScreen from '../screens/recipes/RecipesScreen';
import CreateScreen from '../screens/main/CreateScreen';
import MealPlanScreen from '../screens/main/MealPlanScreen';
import GroceriesScreen from '../screens/main/GroceriesScreen';
import MyRecipesScreen from '../screens/main/MyRecipesScreen';

const Tab = createBottomTabNavigator<TabParamList>();

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showImportModal } = useModal();
  const tabCount = state.routes.length;
  const tabWidth = 100 / tabCount;
  const selectedIndex = state.index;

  const bottomPadding = Math.max(insets.bottom, 8);
  const containerHeight = 60 + bottomPadding;
  
  // Calculate indicator position
  const indicatorLeft = (selectedIndex * tabWidth) + (tabWidth * 0.2); // 10% margin from left edge of tab
  const indicatorWidth = tabWidth * 0.7; // 80% of tab width
  
  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding, backgroundColor: theme.colors.background, height: containerHeight }]}>
      <View 
        style={[
          styles.indicatorBar, 
          { 
            backgroundColor: theme.colors.accent,
            left: `${indicatorLeft}%`,
            width: `${indicatorWidth}%`,
            top: 0,
          }
        ]} 
      />
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          // Special handling for Create tab - show modal instead of navigating
          if (route.name === 'Create') {
            showImportModal();
            return;
          }

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        let iconName: string;
        let label: string;
        switch (route.name) {
          case 'Recipes':
            iconName = isFocused ? 'flame' : 'flame-outline';
            label = 'Home';
            break;
          case 'Create':
            iconName = 'add';
            label = 'Create';
            break;
          case 'MealPlan':
            iconName = isFocused ? 'calendar-number' : 'calendar-number-outline';
            label = 'Plan';
            break;
          case 'Groceries':
            iconName = isFocused ? 'cart' : 'cart-outline';
            label = 'Shop';
            break;
          case 'MyRecipes':
            iconName = isFocused ? 'heart' : 'heart-outline';
            label = 'My Recipes';
            break;
          default:
            iconName = 'circle-outline';
            label = '';
        }

        const isCreateButton = route.name === 'Create';
        
        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.tabButton, isCreateButton && styles.createButton]}
          >
            {isCreateButton ? (
              <View style={[styles.createButtonContainer, { backgroundColor: '#FFD4C2' }]}>
                <Ionicons
                  name={iconName as any}
                  size={24}
                  color={theme.colors.accent}
                />
              </View>
            ) : (
              <View style={styles.tabButtonContent}>
                <Ionicons
                  name={iconName as any}
                  size={22}
                  color={isFocused ? theme.colors.accent : theme.colors.mediumGray}
                />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
                  {label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const TabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const bottomPadding = Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="Recipes"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: tabBarHeight,
            paddingBottom: 8,
            paddingTop: 8,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tab.Screen
          name="Recipes"
          component={RecipesScreen}
        />
        <Tab.Screen
          name="MealPlan"
          component={MealPlanScreen}
        />
        <Tab.Screen
          name="Create"
          component={CreateScreen}
        />
        <Tab.Screen
          name="Groceries"
          component={GroceriesScreen}
        />
        <Tab.Screen
          name="MyRecipes"
          component={MyRecipesScreen}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 0,
    elevation: 0,
    shadowOpacity: 0,
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 0,
    marginTop: 0,
  },
  tabButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999999',
    marginTop: 2,
  },
  tabLabelFocused: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  createButton: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  createButtonContainer: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorBar: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    zIndex: 10,
    top: 0,
  },
});
