import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ingredient } from '../types/recipe';
import { IngredientIcon } from './IngredientIcon';
import { getIngredientSpriteCode } from '../utils/ingredientMapping';

interface AddItemsModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (selectedIngredients: Ingredient[], servings: number) => void;
  ingredients: Ingredient[];
  recipeTitle: string;
}

const AddItemsModal: React.FC<AddItemsModalProps> = ({
  visible,
  onClose,
  onAdd,
  ingredients,
  recipeTitle,
}) => {
  const insets = useSafeAreaInsets();

  // Initialize selectedIds when ingredients change or modal opens
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [servings, setServings] = useState(4);

  // Update selectedIds when modal opens or ingredients change
  useEffect(() => {
    if (visible && ingredients.length > 0) {
      setSelectedIds(new Set(ingredients.map((ing) => ing.id)));
    }
  }, [visible, ingredients]);

  const selectedCount = selectedIds.size;

  const toggleIngredient = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(ingredients.map((ing) => ing.id)));
  };

  const handleAdd = () => {
    const selectedIngredients = ingredients
      .filter((ing) => selectedIds.has(ing.id))
      .map((ing) => {
        // Adjust amounts based on servings
        if (servings === 4) {
          return ing; // No adjustment needed
        }
        const adjustedAmount = calculateAdjustedAmount(ing.amount, servings, 4);
        return {
          ...ing,
          amount: adjustedAmount,
        };
      });
    onAdd(selectedIngredients, servings);
    onClose();
    // Reset state
    setSelectedIds(new Set(ingredients.map((ing) => ing.id)));
    setServings(4);
  };

  const handleDecreaseServings = () => {
    if (servings > 1) {
      setServings(servings - 1);
    }
  };

  const handleIncreaseServings = () => {
    setServings(servings + 1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add items</Text>
          </View>

          {/* Servings Control */}
          <View style={styles.servingsRow}>
            <View style={styles.servingsControl}>
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={handleDecreaseServings}
              >
                <Text style={styles.servingsButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.servingsValue}>{servings}</Text>
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={handleIncreaseServings}
              >
                <Text style={styles.servingsButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.servingsLabel}>servings</Text>
            <TouchableOpacity style={styles.convertButton}>
              <Ionicons name="scale-outline" size={20} color="#1A1A1A" />
              <Text style={styles.convertButtonText}>Convert</Text>
            </TouchableOpacity>
          </View>

          {/* Ingredients Section */}
          <View style={styles.ingredientsSection}>
            <View style={styles.ingredientsHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {selectedCount === ingredients.length ? (
                <TouchableOpacity onPress={handleDeselectAll}>
                  <Text style={styles.deselectAllText}>Deselect all</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleSelectAll}>
                  <Text style={styles.deselectAllText}>Select all</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.ingredientsList}
              contentContainerStyle={styles.ingredientsListContent}
              showsVerticalScrollIndicator={false}
            >
              {ingredients.length > 0 ? (
                ingredients.map((ingredient) => {
                  const isSelected = selectedIds.has(ingredient.id);
                  const spriteCode = getIngredientSpriteCode(ingredient.name);
                  const displayAmount = servings === 4
                    ? ingredient.amount
                    : calculateAdjustedAmount(ingredient.amount, servings, 4);

                  return (
                    <TouchableOpacity
                      key={ingredient.id}
                      style={styles.ingredientRow}
                      onPress={() => toggleIngredient(ingredient.id)}
                    >
                      <IngredientIcon name={ingredient.name} type="whole" size="large" checked={isSelected} />
                      <View style={styles.ingredientContent}>
                        <Text style={styles.ingredientText}>
                          {displayAmount} {ingredient.unit || ''} {ingredient.name}
                        </Text>
                      </View>
                      <View style={styles.checkbox}>
                        {isSelected && (
                          <View style={styles.checkboxChecked}>
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No ingredients available</Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Add Button */}
          <TouchableOpacity
            style={[styles.addButton, selectedCount === 0 && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={selectedCount === 0}
          >
            <Text style={styles.addButtonText}>
              Add {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Helper function to calculate adjusted amount based on servings
const calculateAdjustedAmount = (
  amount: string,
  newServings: number,
  originalServings: number
): string => {
  // Parse the amount - handle fractions like "1/2", "1 1/2", etc.
  const parseFraction = (str: string): number => {
    if (str.includes(' ')) {
      // Handle "1 1/2" format
      const parts = str.split(' ');
      const whole = parseFloat(parts[0]) || 0;
      const fraction = parts[1] || '0';
      if (fraction.includes('/')) {
        const [num, den] = fraction.split('/').map(Number);
        return whole + (num / den);
      }
      return whole;
    } else if (str.includes('/')) {
      // Handle "1/2" format
      const [num, den] = str.split('/').map(Number);
      return num / den;
    } else {
      return parseFloat(str) || 0;
    }
  };

  const formatFraction = (value: number): string => {
    if (value === 0) return '0';

    const whole = Math.floor(value);
    const fractional = value - whole;

    if (fractional === 0) {
      return whole.toString();
    }

    // Common fractions
    const commonFractions: Record<number, string> = {
      0.125: '1/8',
      0.25: '1/4',
      0.333: '1/3',
      0.5: '1/2',
      0.667: '2/3',
      0.75: '3/4',
    };

    // Check if fractional part matches a common fraction
    for (const [dec, frac] of Object.entries(commonFractions)) {
      if (Math.abs(fractional - parseFloat(dec)) < 0.01) {
        if (whole === 0) {
          return frac;
        }
        return `${whole} ${frac}`;
      }
    }

    // Round to 2 decimal places if not a common fraction
    const rounded = Math.round(fractional * 100) / 100;
    if (whole === 0) {
      return rounded.toString();
    }
    return `${whole} ${rounded}`;
  };

  const originalAmount = parseFraction(amount);
  const multiplier = newServings / originalServings;
  const newAmount = originalAmount * multiplier;

  return formatFraction(newAmount);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    flexDirection: 'column',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  servingsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    minWidth: 30,
    textAlign: 'center',
  },
  servingsLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    marginLeft: 12,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  convertButtonText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  ingredientsSection: {
    flex: 1,
    paddingHorizontal: 20,
    flexShrink: 1,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  deselectAllText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
  },
  ingredientsList: {
    flex: 1,
  },
  ingredientsListContent: {
    paddingBottom: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ingredientContent: {
    flex: 1,
    marginLeft: 12,
  },
  ingredientText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E0E0DA',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AddItemsModal;

