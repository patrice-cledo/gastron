import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

interface SpriteSheetIconProps {
  spriteCode: string;
  size?: number;
  checked?: boolean;
}

// Sprite sheet dimensions: 10 columns x 6 rows
const SPRITE_COLUMNS = 10;
const SPRITE_ROWS = 6;
const SPRITE_SHEET_WIDTH = 1; // Normalized (100% of image)
const SPRITE_SHEET_HEIGHT = 1; // Normalized (100% of image)

// Calculate sprite position from code
// Mapping based on the JSON structure:
// Row 0 (A): A1, A2, A3, A6, A7, A8
// Row 1 (B): B0, B1, B2, B3, B4, B5, B6, B9
// Row 2 (numeric 10-19): 10, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 26, 29
// Row 3: (if needed for 20+)
// Row 4 (E): E1, E2, E6, E7
const getSpritePosition = (code: string): { row: number; col: number } => {
  // Handle numeric codes like "10", "12", "20", etc.
  if (/^\d+$/.test(code)) {
    const num = parseInt(code, 10);
    // Based on mapping: 10, 12, 13, 15, 16, 17, 18, 19 are in row 2
    // 20, 21, 22, 26, 29 are also in row 2 (columns 0, 1, 2, 6, 9)
    if (num === 10) return { row: 2, col: 0 };
    if (num === 12) return { row: 2, col: 2 };
    if (num === 13) return { row: 2, col: 3 };
    if (num === 15) return { row: 2, col: 5 };
    if (num === 16) return { row: 2, col: 6 };
    if (num === 17) return { row: 2, col: 7 };
    if (num === 18) return { row: 2, col: 8 };
    if (num === 19) return { row: 2, col: 9 };
    if (num === 20) return { row: 3, col: 0 };
    if (num === 21) return { row: 3, col: 1 };
    if (num === 22) return { row: 3, col: 2 };
    if (num === 26) return { row: 3, col: 6 };
    if (num === 29) return { row: 3, col: 9 };
    return { row: 2, col: 0 }; // Default
  }

  // Handle letter codes like "A1", "B2", "E1", etc.
  const match = code.match(/^([A-Z])(\d+)$/);
  if (!match) {
    return { row: 0, col: 0 }; // Default to first sprite
  }

  const letter = match[1];
  const number = parseInt(match[2], 10);

  // Convert letter to row index (A=0, B=1, E=4, etc.)
  const row = letter.charCodeAt(0) - 'A'.charCodeAt(0);
  // Column is the number (A1 = col 1, A2 = col 2, B0 = col 0, etc.)
  const col = number;

  return { row, col };
};

export const SpriteSheetIcon: React.FC<SpriteSheetIconProps> = ({
  spriteCode,
  size = 32,
  checked = false,
}) => {
  const { row, col } = getSpritePosition(spriteCode);

  // Calculate the scale factor - we need the full sprite sheet to be scaled
  // so that each sprite is exactly `size` pixels
  // If the sprite sheet is 1000px wide with 10 columns, each sprite is 100px
  // So we scale the image to size * SPRITE_COLUMNS width
  const spriteSheetWidth = size * SPRITE_COLUMNS;
  const spriteSheetHeight = size * SPRITE_ROWS;
  
  // Position the image so the correct sprite is visible
  // Negative translateX moves left (showing sprites to the right)
  // Negative translateY moves up (showing sprites below)
  const translateX = -(col * size);
  const translateY = -(row * size);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderWidth: checked ? 3 : 2,
          backgroundColor: checked ? '#F0F0F0' : 'transparent',
        },
      ]}
    >
      <View style={[styles.spriteContainer, { width: size, height: size }]}>
        <Image
          source={require('../../assets/images/ingredients-sprite-sheet-minimal.png')}
          style={[
            styles.sprite,
            {
              width: spriteSheetWidth,
              height: spriteSheetHeight,
              transform: [
                { translateX: translateX },
                { translateY: translateY },
              ],
            },
          ]}
          resizeMode="cover"
        />
      </View>
      {checked && (
        <View style={styles.checkmarkOverlay}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  spriteContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  sprite: {
    position: 'absolute',
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
});

