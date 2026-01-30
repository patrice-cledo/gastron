import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SpriteSheetIcon } from './SpriteSheetIcon';
import { getIngredientSpriteCode } from '../utils/ingredientMapping';

export type IngredientType = 
  | 'whole' // shrimp, mushrooms, olives, etc.
  | 'sliced' // lemon slices, cucumber coins, etc.
  | 'scatter' // salt, herbs, grated cheese
  | 'liquid'; // oil, sauces, marinades

interface IngredientIconProps {
  name: string;
  type: IngredientType;
  checked?: boolean;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  amount?: string;
  unit?: string;
  showLabel?: boolean;
}

export const IngredientIcon: React.FC<IngredientIconProps> = ({
  name,
  type,
  checked = false,
  onPress,
  size = 'medium',
  amount,
  unit,
  showLabel = false,
}) => {
  const getSizeValue = () => {
    switch (size) {
      case 'small': return 24;
      case 'medium': return 32;
      case 'large': return 48;
      default: return 32;
    }
  };

  const iconSize = getSizeValue();
  const spriteCode = getIngredientSpriteCode(name);

  const formatLabel = () => {
    if (!showLabel || (!amount && !unit)) return null;
    const parts: string[] = [];
    if (amount) parts.push(amount);
    if (unit) parts.push(unit);
    const measurement = parts.join(' ');
    const nameUpper = name.toUpperCase();
    return `${measurement} ${nameUpper}`;
  };

  const label = formatLabel();

  if (type === 'scatter') {
    return (
      <View style={styles.scatterContainer}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.scatterZone}
        >
          <View style={[styles.scatterDots, checked && styles.scatterChecked]}>
            <SpriteSheetIcon spriteCode={spriteCode} size={iconSize - 8} checked={false} />
          </View>
          {checked && (
            <View style={styles.checkmarkOverlay}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
        {label && <Text style={styles.ingredientLabel}>{label}</Text>}
      </View>
    );
  }

  if (type === 'liquid') {
    return (
      <View style={styles.liquidContainer}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={[styles.liquidZone, checked && styles.checked]}
        >
          <SpriteSheetIcon spriteCode={spriteCode} size={iconSize} checked={false} />
          <View style={styles.wavePattern} />
          {checked && (
            <View style={styles.checkmarkOverlay}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
        {label && <Text style={styles.ingredientLabel}>{label}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.wholeContainer}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
      >
        <SpriteSheetIcon spriteCode={spriteCode} size={iconSize} checked={checked} />
      </TouchableOpacity>
      {label && <Text style={styles.ingredientLabel}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  scatterContainer: {
    alignItems: 'center',
    gap: 8,
  },
  scatterZone: {
    position: 'relative',
    padding: 8,
  },
  scatterDots: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  scatterChecked: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF5F0',
    borderStyle: 'solid',
  },
  checkmarkOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  liquidContainer: {
    alignItems: 'center',
    gap: 8,
  },
  liquidZone: {
    width: 60,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  checked: {
    borderWidth: 3,
    backgroundColor: '#F0F0F0',
  },
  wavePattern: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#FF6B35',
    opacity: 0.3,
  },
  wholeContainer: {
    alignItems: 'center',
    gap: 8,
  },
  ingredientLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 100,
    lineHeight: 12,
  },
});

