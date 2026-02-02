import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const theme = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    };

    // Size styles
    const sizeStyles = {
      small: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 },
      medium: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44 },
      large: { paddingVertical: 16, paddingHorizontal: 32, minHeight: 52 },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: theme.colors.accent,
      },
      secondary: {
        backgroundColor: theme.colors.beige,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      opacity: disabled || loading ? 0.5 : 1,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontSize: theme.typography.styles.button.fontSize,
      fontWeight: theme.typography.styles.button.fontWeight,
      lineHeight: theme.typography.styles.button.lineHeight,
    };

    const variantTextStyles = {
      primary: { color: theme.colors.black },
      secondary: { color: theme.colors.black },
      outline: { color: theme.colors.black },
    };

    return {
      ...baseStyle,
      ...variantTextStyles[variant],
    };
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.black}
        />
      ) : (
        <Text 
          style={[
            {
              fontSize: theme.typography.styles.button.fontSize,
              fontWeight: theme.typography.styles.button.fontWeight,
              color: textStyle?.color || theme.colors.black,
            },
            textStyle, // Custom textStyle should override defaults
          ]} 
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

