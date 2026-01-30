import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type RecipeNutritionScreenRouteProp = RouteProp<RootStackParamList, 'RecipeNutrition'>;
type RecipeNutritionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RecipeNutrition'
>;

const RecipeNutritionScreen: React.FC = () => {
  const navigation = useNavigation<RecipeNutritionScreenNavigationProp>();
  const route = useRoute<RecipeNutritionScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { onSave, calories: initialCalories, protein: initialProtein, carbs: initialCarbs, fats: initialFats } = route.params;

  const [calories, setCalories] = useState<string>(initialCalories?.toString() || '');
  const [protein, setProtein] = useState<string>(initialProtein?.toString() || '');
  const [carbs, setCarbs] = useState<string>(initialCarbs?.toString() || '');
  const [fats, setFats] = useState<string>(initialFats?.toString() || '');

  const handleSave = () => {
    onSave({
      calories: calories ? parseFloat(calories) : undefined,
      protein: protein ? parseFloat(protein) : undefined,
      carbs: carbs ? parseFloat(carbs) : undefined,
      fats: fats ? parseFloat(fats) : undefined,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F5F5F0' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <View style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NUTRITION</Text>

          {/* Calories */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Calories (kcal)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add"
              placeholderTextColor="#999"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
            />
          </View>

          {/* Protein */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Protein (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add"
              placeholderTextColor="#999"
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
            />
          </View>

          {/* Carbs */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add"
              placeholderTextColor="#999"
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="numeric"
            />
          </View>

          {/* Fats */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fats (g)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add"
              placeholderTextColor="#999"
              value={fats}
              onChangeText={setFats}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 1,
  },
  input: {
    backgroundColor: '#F5F5F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1A1A1A',
    minWidth: 100,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RecipeNutritionScreen;

