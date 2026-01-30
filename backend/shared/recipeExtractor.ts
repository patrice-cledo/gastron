/**
 * Recipe Extraction from HTML
 * 
 * Supports multiple extraction strategies:
 * 1. JSON-LD (schema.org Recipe) - Priority 1
 * 2. Microdata/RDFa - Priority 2 (Phase 2)
 * 3. Heuristic HTML parsing - Priority 3 (Phase 2)
 */

import { RecipeDraft, ParserType } from './types';
import { parseIngredientLine } from './ingredientNormalizer';

export interface ExtractionResult {
  draft: RecipeDraft;
  confidence: number;
  parser: ParserType;
  warnings: string[];
}

/**
 * Extract recipe from HTML content
 */
export function extractRecipe(html: string, sourceUrl: string): ExtractionResult {
  // Try JSON-LD first
  const jsonLdResult = extractFromJsonLd(html, sourceUrl);
  if (jsonLdResult && jsonLdResult.confidence > 0.5) {
    return jsonLdResult;
  }

  // Fallback to heuristic (Phase 2: add microdata here)
  const heuristicResult = extractHeuristic(html, sourceUrl);
  if (heuristicResult && heuristicResult.confidence > 0.3) {
    return heuristicResult;
  }

  // Return low-confidence result if nothing found
  return {
    draft: createEmptyDraft(sourceUrl),
    confidence: 0.1,
    parser: 'heuristic',
    warnings: ['Could not extract recipe data from this page'],
  };
}

/**
 * Extract recipe from JSON-LD structured data
 */
function extractFromJsonLd(html: string, sourceUrl: string): ExtractionResult | null {
  try {
    // Find all JSON-LD script tags
    // Use [\s\S] instead of . with s flag for ES2017 compatibility
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = Array.from(html.matchAll(jsonLdRegex));

    let bestRecipe: any = null;
    let bestConfidence = 0;

    for (const match of matches) {
      try {
        const jsonData = JSON.parse(match[1]);
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const item of recipes) {
          // Check if it's a Recipe type
          const types = Array.isArray(item['@type']) 
            ? item['@type'] 
            : item['@type'] ? [item['@type']] : [];
          
          if (types.includes('Recipe') || types.includes('https://schema.org/Recipe')) {
            const confidence = calculateJsonLdConfidence(item);
            
            // Prefer recipes with more ingredients (likely the main recipe, not a scaled version)
            // Also prefer recipes that have a URL matching the source URL
            let bonus = 0;
            const ingredientCount = Array.isArray(item.recipeIngredient) 
              ? item.recipeIngredient.length 
              : (item.recipeIngredient ? 1 : 0);
            
            // Bonus for recipes with more ingredients (likely the main recipe)
            if (ingredientCount >= 3) {
              bonus += 0.1;
            }
            
            // Bonus if URL matches (for Allrecipes and similar sites)
            if (item.url && sourceUrl && item.url.includes(new URL(sourceUrl).pathname)) {
              bonus += 0.15;
            }
            
            const totalConfidence = confidence + bonus;
            
            // Log for debugging
            console.log('Found Recipe object:', {
              name: item.name || item.headline,
              ingredientCount,
              hasUrl: !!item.url,
              url: item.url,
              confidence,
              bonus,
              totalConfidence,
            });
            
            if (totalConfidence > bestConfidence) {
              bestRecipe = item;
              bestConfidence = totalConfidence;
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
        continue;
      }
    }

    if (!bestRecipe) {
      return null;
    }

    // Log selected recipe for debugging
    console.log('Selected Recipe:', {
      name: bestRecipe.name || bestRecipe.headline,
      ingredientCount: Array.isArray(bestRecipe.recipeIngredient) 
        ? bestRecipe.recipeIngredient.length 
        : (bestRecipe.recipeIngredient ? 1 : 0),
      url: bestRecipe.url,
      confidence: bestConfidence,
    });

    // Extract data from JSON-LD
    const draft = jsonLdToDraft(bestRecipe, sourceUrl);
    const warnings: string[] = [];

    if (!draft.title) warnings.push('Missing title');
    if (draft.ingredients.length === 0) warnings.push('No ingredients found');
    if (draft.instructions.length === 0) warnings.push('No instructions found');
    if (!draft.imageUrl) warnings.push('No image found');

    return {
      draft,
      confidence: bestConfidence,
      parser: 'jsonld',
      warnings,
    };
  } catch (error) {
    console.error('JSON-LD extraction error:', error);
    return null;
  }
}

/**
 * Convert JSON-LD Recipe object to RecipeDraft
 */
function jsonLdToDraft(jsonLd: any, sourceUrl: string): RecipeDraft {
  // Extract title - check multiple possible fields
  const title = jsonLd.name || 
                jsonLd.headline || 
                jsonLd.title ||
                (jsonLd['@id'] ? extractTitleFromUrl(jsonLd['@id']) : null) ||
                'Untitled Recipe';

  // Extract image
  let imageUrl: string | null = null;
  if (jsonLd.image) {
    if (typeof jsonLd.image === 'string') {
      imageUrl = jsonLd.image;
    } else if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) {
      imageUrl = typeof jsonLd.image[0] === 'string' 
        ? jsonLd.image[0] 
        : jsonLd.image[0].url || jsonLd.image[0];
    } else if (jsonLd.image.url) {
      imageUrl = jsonLd.image.url;
    }
  }

  // Extract servings
  let servings: number | null = null;
  if (jsonLd.recipeYield) {
    const yieldValue = Array.isArray(jsonLd.recipeYield) 
      ? jsonLd.recipeYield[0] 
      : jsonLd.recipeYield;
    const numMatch = String(yieldValue).match(/\d+/);
    if (numMatch) {
      servings = parseInt(numMatch[0], 10);
    }
  }

  // Extract time
  const prepMinutes = parseDuration(jsonLd.prepTime);
  const cookMinutes = parseDuration(jsonLd.cookTime);
  const totalMinutes = parseDuration(jsonLd.totalTime) || 
    (prepMinutes && cookMinutes ? prepMinutes + cookMinutes : null);

  // Helper function to check if text looks like an instruction
  const looksLikeInstruction = (text: string): boolean => {
    const instructionPatterns = [
      /^(place|put|add|mix|stir|cook|bake|heat|cover|shred|chop|cut|slice|dice|mince|pour|season|combine|whisk|beat|fold|knead|roll|spread|sprinkle|garnish|serve)/i,
      /\.\s*(cook|bake|heat|stir|mix|add|cover|shred)/i,
      /\b(using|with|for|until|until|minutes?|hours?)\b/i,
    ];
    return instructionPatterns.some(pattern => pattern.test(text));
  };

  // Helper function to check if text looks like an ingredient
  const looksLikeIngredient = (text: string): boolean => {
    const ingredientPatterns = [
      /^\d+\s*(\(|cup|tbsp|tsp|oz|lb|g|kg|ml|l|pound|ounce|gram|kilogram|milliliter|liter|teaspoon|tablespoon)/i,
      /^\d+\/\d+\s*(cup|tbsp|tsp|oz|lb)/i,
      /^[a-z]+\s+(\(|cup|tbsp|tsp|oz|lb)/i,
    ];
    return ingredientPatterns.some(pattern => pattern.test(text.trim()));
  };

  // Extract ingredients
  const ingredients: RecipeDraft['ingredients'] = [];
  if (jsonLd.recipeIngredient) {
    const ingredientList = Array.isArray(jsonLd.recipeIngredient)
      ? jsonLd.recipeIngredient
      : [jsonLd.recipeIngredient];

    for (const ing of ingredientList) {
      const rawText = typeof ing === 'string' ? ing : ing.text || ing.name || String(ing);
      if (rawText) {
        // Filter out items that look like instructions
        if (looksLikeInstruction(rawText)) {
          console.log('Filtered out instruction-like text from ingredients:', rawText);
          continue;
        }
        
        const parsed = parseIngredientLine(rawText);
        if (parsed) {
          ingredients.push({
            raw: rawText,
            name: parsed.name,
            quantity: parsed.quantity,
            unit: parsed.unit,
            notes: parsed.modifiers.join(', ') || undefined,
          });
        }
      }
    }
  }

  // Helper function to split instruction text into separate steps
  const splitInstructionText = (text: string): string[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    
    // First, try splitting on numbered patterns (e.g., "1.", "2.", "Step 1:", etc.)
    const numberedPattern = /^\d+[\.\)]\s*/;
    if (numberedPattern.test(trimmed)) {
      // Already numbered, treat as single step
      return [trimmed];
    }
    
    // Split on sentence boundaries (period followed by space and capital letter)
    // But be careful with abbreviations and decimals
    const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const steps: string[] = [];
    
    for (let sentence of sentences) {
      sentence = sentence.trim();
      if (!sentence) continue;
      
      // If sentence is very long (>120 chars), try to split further on semicolons
      if (sentence.length > 120) {
        const subSteps = sentence.split(/;\s+/);
        for (let subStep of subSteps) {
          subStep = subStep.trim();
          if (subStep) {
            // Add period if it doesn't end with punctuation
            if (!/[.!?]$/.test(subStep)) {
              subStep += '.';
            }
            steps.push(subStep);
          }
        }
      } else {
        // Add period if it doesn't end with punctuation (for consistency)
        if (!/[.!?]$/.test(sentence)) {
          sentence += '.';
        }
        steps.push(sentence);
      }
    }
    
    return steps.length > 0 ? steps : [trimmed];
  };

  // Extract instructions
  const instructions: RecipeDraft['instructions'] = [];
  if (jsonLd.recipeInstructions) {
    const instructionList = Array.isArray(jsonLd.recipeInstructions)
      ? jsonLd.recipeInstructions
      : [jsonLd.recipeInstructions];

    let stepNumber = 1;
    for (const inst of instructionList) {
      const text = typeof inst === 'string' 
        ? inst 
        : inst.text || inst.name || String(inst);
      if (text) {
        const trimmed = text.trim();
        
        // Filter out items that look like ingredients
        if (looksLikeIngredient(trimmed)) {
          console.log('Filtered out ingredient-like text from instructions:', trimmed);
          continue;
        }
        
        // Split instruction text into separate steps if it contains multiple sentences
        const steps = splitInstructionText(trimmed);
        
        for (const stepText of steps) {
          if (stepText && stepText.length > 0) {
            instructions.push({
              step: stepNumber,
              text: stepText,
            });
            stepNumber++;
          }
        }
      }
    }
  }

  // Extract tags/categories
  const tags: string[] = [];
  if (jsonLd.recipeCategory) {
    const categories = Array.isArray(jsonLd.recipeCategory)
      ? jsonLd.recipeCategory
      : [jsonLd.recipeCategory];
    tags.push(...categories.map((c: any) => String(c)));
  }
  if (jsonLd.keywords) {
    const keywords = Array.isArray(jsonLd.keywords)
      ? jsonLd.keywords
      : [jsonLd.keywords];
    tags.push(...keywords.map((k: any) => String(k)));
  }

  // Extract description (main recipe description/intro)
  let description: string | undefined = undefined;
  if (jsonLd.description) {
    description = typeof jsonLd.description === 'string' 
      ? jsonLd.description 
      : String(jsonLd.description);
  } else if (jsonLd.about) {
    description = typeof jsonLd.about === 'string'
      ? jsonLd.about
      : String(jsonLd.about);
  }

  // Extract notes (additional notes, tips, etc.)
  let notes: string | undefined = undefined;
  if (jsonLd.comment) {
    notes = typeof jsonLd.comment === 'string'
      ? jsonLd.comment
      : String(jsonLd.comment);
  }

  // Extract nutrition (if available in JSON-LD)
  // Note: JSON-LD Recipe schema doesn't have standard nutrition fields,
  // but some sites may include them in nutrition or nutritionValue fields
  let nutrition: { calories?: number; protein?: number; carbs?: number; fats?: number } | undefined = undefined;
  if (jsonLd.nutrition) {
    const nutr = jsonLd.nutrition;
    const calories = typeof nutr.calories === 'string' 
      ? parseFloat(nutr.calories.replace(/[^\d.]/g, '')) 
      : (typeof nutr.calories === 'number' ? nutr.calories : undefined);
    const protein = typeof nutr.proteinContent === 'string'
      ? parseFloat(nutr.proteinContent.replace(/[^\d.]/g, ''))
      : (typeof nutr.proteinContent === 'number' ? nutr.proteinContent : undefined);
    const carbs = typeof nutr.carbohydrateContent === 'string'
      ? parseFloat(nutr.carbohydrateContent.replace(/[^\d.]/g, ''))
      : (typeof nutr.carbohydrateContent === 'number' ? nutr.carbohydrateContent : undefined);
    const fats = typeof nutr.fatContent === 'string'
      ? parseFloat(nutr.fatContent.replace(/[^\d.]/g, ''))
      : (typeof nutr.fatContent === 'number' ? nutr.fatContent : undefined);
    
    if (calories !== undefined || protein !== undefined || carbs !== undefined || fats !== undefined) {
      nutrition = {};
      if (calories !== undefined && !isNaN(calories)) nutrition.calories = calories;
      if (protein !== undefined && !isNaN(protein)) nutrition.protein = protein;
      if (carbs !== undefined && !isNaN(carbs)) nutrition.carbs = carbs;
      if (fats !== undefined && !isNaN(fats)) nutrition.fats = fats;
    }
  }

  return {
    id: '', // Will be set by caller
    userId: '', // Will be set by caller
    sourceUrl,
    title: title.trim(),
    imageUrl,
    servings,
    prepMinutes,
    cookMinutes,
    totalMinutes,
    ingredients,
    instructions,
    tags: tags.length > 0 ? tags : undefined,
    description: description?.trim() || undefined,
    notes: notes?.trim() || undefined,
    nutrition: nutrition || undefined,
    confidence: 0, // Will be calculated
    parser: 'jsonld',
    createdAt: Date.now(),
  };
}

/**
 * Extract title from URL if available
 */
function extractTitleFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      // Decode and format: "greek-pulled-pork" -> "Greek Pulled Pork"
      return lastPart
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  } catch {
    // Invalid URL, ignore
  }
  return null;
}

/**
 * Parse ISO 8601 duration (PT30M, PT1H30M, etc.) to minutes
 */
function parseDuration(duration: any): number | null {
  if (!duration) return null;
  
  const str = String(duration).toUpperCase();
  const match = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
}

/**
 * Calculate confidence score for JSON-LD extraction
 */
function calculateJsonLdConfidence(recipe: any): number {
  let confidence = 1.0;

  if (!recipe.name && !recipe.headline) confidence -= 0.2;
  if (!recipe.recipeIngredient || (Array.isArray(recipe.recipeIngredient) && recipe.recipeIngredient.length === 0)) {
    confidence -= 0.3;
  }
  if (!recipe.recipeInstructions || (Array.isArray(recipe.recipeInstructions) && recipe.recipeInstructions.length === 0)) {
    confidence -= 0.3;
  }
  if (!recipe.image) confidence -= 0.1;
  if (!recipe.recipeYield) confidence -= 0.05;
  if (recipe.recipeIngredient && Array.isArray(recipe.recipeIngredient) && recipe.recipeIngredient.length < 3) {
    confidence -= 0.1;
  }

  return Math.max(0, confidence);
}

/**
 * Heuristic extraction (Phase 2 - basic implementation)
 */
function extractHeuristic(html: string, sourceUrl: string): ExtractionResult | null {
  // Basic heuristic extraction - can be enhanced in Phase 2
  // For now, return null to indicate we should use JSON-LD only
  return null;
}

/**
 * Create empty draft as fallback
 */
function createEmptyDraft(sourceUrl: string): RecipeDraft {
  return {
    id: '',
    userId: '',
    sourceUrl,
    title: 'Untitled Recipe',
    ingredients: [],
    instructions: [],
    confidence: 0.1,
    parser: 'heuristic',
    createdAt: Date.now(),
  };
}
