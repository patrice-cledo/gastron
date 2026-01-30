import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { IngredientIcon, IngredientType } from './IngredientIcon';
import { Ingredient, Step, Nutrition } from '../types/recipe';

interface RecipeCanvasProps {
  ingredients: Ingredient[];
  steps?: Step[];
  nutrition?: Nutrition;
  checkedIngredients: Set<string>;
  onIngredientPress: (ingredientId: string) => void;
  layoutType?: 'sheet-pan' | 'pizza' | 'bowl' | 'wrap' | 'skewer';
}

export const RecipeCanvas: React.FC<RecipeCanvasProps> = ({
  ingredients,
  steps = [],
  nutrition,
  checkedIngredients,
  onIngredientPress,
  layoutType = 'sheet-pan',
}) => {
  const screenWidth = Dimensions.get('window').width;

  const getIngredientType = (ingredient: Ingredient): IngredientType => {
    const nameLower = ingredient.name.toLowerCase();
    if (nameLower.includes('salt') || nameLower.includes('pepper') || 
        nameLower.includes('herb') || nameLower.includes('garlic') ||
        nameLower.includes('grated') || nameLower.includes('minced')) {
      return 'scatter';
    }
    if (nameLower.includes('oil') || nameLower.includes('sauce') || 
        nameLower.includes('marinade') || nameLower.includes('broth')) {
      return 'liquid';
    }
    if (ingredient.name.includes('slice') || ingredient.name.includes('coin') ||
        ingredient.name.includes('round')) {
      return 'sliced';
    }
    return 'whole';
  };

  const renderSheetPanLayout = () => {
    // Group ingredients by type for better organization
    const wholeItems = ingredients.filter(i => getIngredientType(i) === 'whole');
    const scatterItems = ingredients.filter(i => getIngredientType(i) === 'scatter');
    const liquidItems = ingredients.filter(i => getIngredientType(i) === 'liquid');
    const slicedItems = ingredients.filter(i => getIngredientType(i) === 'sliced');

    return (
      <View style={styles.canvas}>
        {/* Parchment-style recipe sheet */}
        <View style={[styles.parchmentSheet, { width: screenWidth - 48 }]}>
          {/* Ingredients Section */}
          <View style={styles.ingredientsSection}>
            <Text style={styles.sectionTitle}>INGREDIENTS</Text>
            {/* Scatter items (spices, herbs) - displayed first */}
            {scatterItems.length > 0 && (
              <View style={styles.ingredientGroup}>
                {scatterItems.map((ingredient) => (
                  <IngredientIcon
                    key={ingredient.id}
                    name={ingredient.name}
                    type="scatter"
                    checked={checkedIngredients.has(ingredient.id)}
                    onPress={() => onIngredientPress(ingredient.id)}
                    size="medium"
                    amount={ingredient.amount}
                    unit={ingredient.unit}
                    showLabel={true}
                  />
                ))}
              </View>
            )}

            {/* Sliced items (lemon slices, etc.) */}
            {slicedItems.length > 0 && (
              <View style={styles.ingredientGroup}>
                {slicedItems.map((ingredient) => (
                  <IngredientIcon
                    key={ingredient.id}
                    name={ingredient.name}
                    type="sliced"
                    checked={checkedIngredients.has(ingredient.id)}
                    onPress={() => onIngredientPress(ingredient.id)}
                    size="medium"
                    amount={ingredient.amount}
                    unit={ingredient.unit}
                    showLabel={true}
                  />
                ))}
              </View>
            )}

            {/* Whole items (main ingredients) */}
            {wholeItems.length > 0 && (
              <View style={styles.ingredientGroup}>
                {wholeItems.map((ingredient) => (
                  <IngredientIcon
                    key={ingredient.id}
                    name={ingredient.name}
                    type="whole"
                    checked={checkedIngredients.has(ingredient.id)}
                    onPress={() => onIngredientPress(ingredient.id)}
                    size="large"
                    amount={ingredient.amount}
                    unit={ingredient.unit}
                    showLabel={true}
                  />
                ))}
              </View>
            )}

            {/* Liquid items */}
            {liquidItems.length > 0 && (
              <View style={styles.ingredientGroup}>
                {liquidItems.map((ingredient) => (
                  <IngredientIcon
                    key={ingredient.id}
                    name={ingredient.name}
                    type="liquid"
                    checked={checkedIngredients.has(ingredient.id)}
                    onPress={() => onIngredientPress(ingredient.id)}
                    size="medium"
                    amount={ingredient.amount}
                    unit={ingredient.unit}
                    showLabel={true}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Instructions Section */}
          {steps.length > 0 && (
            <View style={styles.instructionsSection}>
              <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
              {steps.map((step, index) => {
                const stepNumber = step.order || index + 1;
                
                // Highlight ingredient names in instructions
                const renderStepText = (text: string) => {
                  const ingredientNames = ingredients.map(i => i.name.toLowerCase());
                  const words = text.split(/(\s+)/);
                  
                  return words.map((word, i) => {
                    const wordLower = word.toLowerCase().trim();
                    const isIngredient = ingredientNames.some(name => 
                      wordLower === name || wordLower.includes(name) || name.includes(wordLower)
                    );
                    
                    if (isIngredient && word.trim().length > 0) {
                      return (
                        <Text key={i} style={styles.highlightedIngredient}>
                          {word}
                        </Text>
                      );
                    }
                    return <Text key={i}>{word}</Text>;
                  });
                };

                return (
                  <View key={step.id} style={styles.instructionItem}>
                    <View style={styles.stepNumberCircle}>
                      <Text style={styles.stepNumberText}>{stepNumber}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepText}>
                        {renderStepText(step.description)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Nutrition Section */}
          {nutrition && (() => {
            // Calculate total grams for proportion
            const totalGrams = nutrition.protein + nutrition.carbs + nutrition.fats;
            const proteinPercent = totalGrams > 0 ? (nutrition.protein / totalGrams) * 100 : 0;
            const carbsPercent = totalGrams > 0 ? (nutrition.carbs / totalGrams) * 100 : 0;
            const fatsPercent = totalGrams > 0 ? (nutrition.fats / totalGrams) * 100 : 0;
            
            // Calculate angles for pie chart (starting from top, going clockwise)
            const radius = 50;
            const centerX = radius;
            const centerY = radius;
            
            // Convert percentages to angles (in radians)
            const proteinAngle = (proteinPercent / 100) * 2 * Math.PI;
            const carbsAngle = (carbsPercent / 100) * 2 * Math.PI;
            const fatsAngle = (fatsPercent / 100) * 2 * Math.PI;
            
            // Calculate path for each segment
            const createArcPath = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number) => {
              const startX = centerX + outerRadius * Math.sin(startAngle);
              const startY = centerY - outerRadius * Math.cos(startAngle);
              const endX = centerX + outerRadius * Math.sin(endAngle);
              const endY = centerY - outerRadius * Math.cos(endAngle);
              const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
              
              return `M ${centerX} ${centerY} L ${startX} ${startY} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
            };
            
            // Calculate start angles for each segment
            const startAngle = -Math.PI / 2; // Start from top (-90 degrees)
            const proteinStart = startAngle;
            const carbsStart = proteinStart + proteinAngle;
            const fatsStart = carbsStart + carbsAngle;
            
            return (
              <View style={styles.nutritionSection}>
                <Text style={styles.sectionTitle}>NUTRITION</Text>
                <Text style={styles.nutritionSubtitle}>Per 1 serving</Text>
                <View style={styles.nutritionContent}>
                  <View style={styles.calorieCircleContainer}>
                    <Svg width={100} height={100} viewBox="0 0 100 100">
                      {/* Protein segment */}
                      {proteinPercent > 0 ? (
                        <Path
                          d={createArcPath(proteinStart, proteinStart + proteinAngle, 0, radius)}
                          fill="#FF6B9D"
                        />
                      ) : null}
                      
                      {/* Carbs segment */}
                      {carbsPercent > 0 ? (
                        <Path
                          d={createArcPath(carbsStart, carbsStart + carbsAngle, 0, radius)}
                          fill="#FFB84D"
                        />
                      ) : null}
                      
                      {/* Fats segment */}
                      {fatsPercent > 0 ? (
                        <Path
                          d={createArcPath(fatsStart, fatsStart + fatsAngle, 0, radius)}
                          fill="#50C878"
                        />
                      ) : null}
                    </Svg>
                    <View style={styles.calorieCircleInner}>
                      <Text style={styles.calorieValue}>{nutrition.calories}</Text>
                      <Text style={styles.calorieLabel}>Calories</Text>
                    </View>
                  </View>
                  <View style={styles.macrosContainer}>
                    {/* Macro List */}
                    <View style={styles.macrosList}>
                      <View style={styles.macroItem}>
                        <View style={[styles.macroIconCircle, styles.proteinDot]} />
                        <Text style={styles.macroLabel}>Protein:</Text>
                        <Text style={styles.macroValue}>{nutrition.protein} g</Text>
                        <Text style={styles.macroPercent}>{proteinPercent.toFixed(0)}%</Text>
                      </View>
                      <View style={styles.macroItem}>
                        <View style={[styles.macroIconCircle, styles.carbsDot]} />
                        <Text style={styles.macroLabel}>Carbs:</Text>
                        <Text style={styles.macroValue}>{nutrition.carbs} g</Text>
                        <Text style={styles.macroPercent}>{carbsPercent.toFixed(0)}%</Text>
                      </View>
                      <View style={styles.macroItem}>
                        <View style={[styles.macroIconCircle, styles.fatsDot]} />
                        <Text style={styles.macroLabel}>Fats:</Text>
                        <Text style={styles.macroValue}>{nutrition.fats} g</Text>
                        <Text style={styles.macroPercent}>{fatsPercent.toFixed(0)}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>
      </View>
    );
  };

  return renderSheetPanLayout();
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F0',
    minHeight: 400,
  },
  parchmentSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 24,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  ingredientsSection: {
    marginBottom: 40,
  },
  ingredientGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  instructionsSection: {
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    paddingTop: 32,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  highlightedIngredient: {
    fontWeight: '600',
    color: '#FF6B35',
  },
  nutritionSection: {
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
    paddingTop: 32,
    marginTop: 8,
  },
  nutritionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginTop: -4,
  },
  nutritionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  calorieCircleContainer: {
    width: 100,
    height: 100,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  calorieCircleInner: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
  },
  calorieValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  calorieLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  macrosContainer: {
    flex: 1,
    gap: 12,
  },
  macrosList: {
    gap: 12,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroIconCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  proteinDot: {
    backgroundColor: '#FF6B9D',
  },
  carbsDot: {
    backgroundColor: '#FFB84D',
  },
  fatsDot: {
    backgroundColor: '#50C878',
  },
  macroLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    minWidth: 50,
  },
  macroPercent: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    minWidth: 35,
    textAlign: 'right',
  },
});

