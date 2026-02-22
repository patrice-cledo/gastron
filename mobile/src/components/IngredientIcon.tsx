import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useIconMappingsStore } from '../hooks/useIconMappings';


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


const getEmojiFallback = (ingredientName: string) => {
  const name = ingredientName.toLowerCase();
  if (name.includes('rice')) return '🌾';
  if (name.includes('coconut') || name.includes('milk')) return '🥥';
  if (name.includes('onion')) return '🧅';
  if (name.includes('carrot')) return '🥕';
  if (name.includes('scallion') || name.includes('spring onion')) return '🌱';
  if (name.includes('pork') || name.includes('meat')) return '🥩';
  if (name.includes('spice') || name.includes('seasoning')) return '🌶️';
  if (name.includes('oil')) return '🫒';
  return '📦';
};

// ... (existing imports and types)

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
  const { mappings } = useIconMappingsStore();
  const dynamicIconName = mappings[name.toLowerCase().trim()];

  const getSizeValue = () => {
    switch (size) {
      case 'small': return 24;
      case 'medium': return 32;
      case 'large': return 48;
      default: return 32;
    }
  };

  const iconSize = getSizeValue();

  const renderFallback = (fallbackSize: number, isChecked: boolean) => (
    <View style={{ width: fallbackSize, height: fallbackSize, justifyContent: 'center', alignItems: 'center', opacity: isChecked ? 0.5 : 1 }}>
      <Text style={{ fontSize: fallbackSize * 0.7 }}>{getEmojiFallback(name)}</Text>
    </View>
  );

  const formatLabel = () => {
    // ... (existing label logic)
    if (!showLabel || (!amount && !unit)) return null;
    const parts: string[] = [];
    if (amount) parts.push(amount);
    if (unit) parts.push(unit);
    const measurement = parts.join(' ');
    const nameUpper = name.toUpperCase();
    return `${measurement} ${nameUpper}`;
  };

  const label = formatLabel();

  // Helper to render the icon content (Dynamic or Sprite)
  const renderIconContent = () => {
    if (dynamicIconName) {
      // Convert Iconify name (e.g. "mdi:carrot") to URL
      // Format: https://api.iconify.design/{prefix}/{name}.svg
      const [prefix, iconName] = dynamicIconName.split(':');
      if (prefix && iconName) {
        const uri = `https://api.iconify.design/${prefix}/${iconName}.svg?color=%231A1A1A`; // Default color #1A1A1A
        return <SvgUri width={iconSize} height={iconSize} uri={uri} />;
      }
    }
    return renderFallback(iconSize, checked);
  };

  if (type === 'scatter') {
    return (
      <View style={styles.scatterContainer}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.scatterZone}
        >
          <View style={[styles.scatterDots, checked && styles.scatterChecked]}>
            {dynamicIconName ? (
              // For scatter, if dynamic, simplify to single icon for now, or repeat?
              // Let's us single icon but smaller
              (() => {
                const [prefix, iconName] = dynamicIconName.split(':');
                if (prefix && iconName) {
                  // For scatter checked state, maybe change color? 
                  // Iconify API supports color param.
                  const color = checked ? '%23FF6B35' : '%231A1A1A';
                  const uri = `https://api.iconify.design/${prefix}/${iconName}.svg?color=${color}`;
                  return <SvgUri width={iconSize - 8} height={iconSize - 8} uri={uri} />;
                }
                return null;
              })()
            ) : (
              renderFallback(iconSize - 8, false)
            )}

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
          {dynamicIconName ? (
            (() => {
              const [prefix, iconName] = dynamicIconName.split(':');
              if (prefix && iconName) {
                const uri = `https://api.iconify.design/${prefix}/${iconName}.svg?color=%231A1A1A`;
                return <SvgUri width={iconSize} height={iconSize} uri={uri} />;
              }
              return null;
            })()
          ) : (
            renderFallback(iconSize, false)
          )}
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
        {dynamicIconName ? (
          (() => {
            const [prefix, iconName] = dynamicIconName.split(':');
            if (prefix && iconName) {
              // If checked, maybe tint? SpriteSheetIcon handles its own checked state (opacity/grayscale?).
              // SpriteSheetIcon implementation: 
              // It uses `checked` prop but implementation of `SpriteSheetIcon` wasn't shown fully to see how it affects visual.
              // Assuming for now simple render.
              const uri = `https://api.iconify.design/${prefix}/${iconName}.svg?color=%231A1A1A`;
              return <SvgUri width={iconSize} height={iconSize} uri={uri} />;
            }
            return renderFallback(iconSize, checked);
          })()
        ) : (
          renderFallback(iconSize, checked)
        )}
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

