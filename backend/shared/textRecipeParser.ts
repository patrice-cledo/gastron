/**
 * Text Recipe Parser
 * 
 * Parses unstructured recipe text into a structured RecipeDraft
 */

import { RecipeDraft, ParserType } from './types';
import { parseIngredientLine } from './ingredientNormalizer';

export interface ParseResult {
  draft: Omit<RecipeDraft, 'id' | 'userId' | 'createdAt'>;
  confidence: number;
  warnings: string[];
}

/**
 * Parse recipe from pasted text
 */
export function parseRecipeFromText(rawText: string, source?: string): ParseResult {
  const normalized = preprocessText(rawText);
  const sections = detectSections(normalized);
  
  const title = extractTitle(normalized, sections);
  const ingredients = extractIngredients(normalized, sections);
  const instructions = extractInstructions(normalized, sections);
  const metadata = extractMetadata(normalized, sections);
  
  const confidence = calculateConfidence(ingredients, instructions);
  const warnings = generateWarnings(ingredients, instructions, confidence);
  
  // Build draft object, only including fields that are not undefined
  const draft: Omit<RecipeDraft, 'id' | 'userId' | 'createdAt'> = {
    sourceUrl: source || 'Pasted text',
    title,
    imageUrl: null,
    ingredients,
    instructions,
    tags: [],
    confidence,
    parser: 'text' as ParserType,
  };

  // Only add optional fields if they have values (not undefined)
  if (metadata.servings !== undefined) {
    draft.servings = metadata.servings;
  }
  if (metadata.prepMinutes !== undefined) {
    draft.prepMinutes = metadata.prepMinutes;
  }
  if (metadata.cookMinutes !== undefined) {
    draft.cookMinutes = metadata.cookMinutes;
  }
  if (metadata.totalMinutes !== undefined) {
    draft.totalMinutes = metadata.totalMinutes;
  }
  if (warnings.length > 0) {
    draft.warnings = warnings;
  }

  return {
    draft,
    confidence,
    warnings,
  };
}

/**
 * Preprocess text: normalize line endings, trim whitespace
 */
function preprocessText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Detect section headers (Ingredients, Instructions, etc.)
 */
interface Sections {
  ingredients?: { start: number; end?: number };
  instructions?: { start: number; end?: number };
  metadata?: { start: number; end?: number };
}

function detectSections(text: string): Sections {
  const lines = text.split('\n');
  const sections: Sections = {};
  
  const ingredientPatterns = /^(ingredients?|ingredient\s+list|what\s+you\s+need)/i;
  const instructionPatterns = /^(instructions?|directions?|method|steps?|how\s+to|preparation|procedure)/i;
  const metadataPatterns = /^(servings?|prep\s+time|cook\s+time|total\s+time|yield|makes)/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    
    if (ingredientPatterns.test(line) && !sections.ingredients) {
      sections.ingredients = { start: i + 1 };
    } else if (instructionPatterns.test(line) && !sections.instructions) {
      sections.instructions = { start: i + 1 };
      if (sections.ingredients && !sections.ingredients.end) {
        sections.ingredients.end = i;
      }
    } else if (metadataPatterns.test(line) && !sections.metadata) {
      sections.metadata = { start: i };
    }
  }
  
  // Set end positions
  if (sections.ingredients && sections.instructions) {
    sections.ingredients.end = sections.instructions.start;
  }
  if (sections.instructions && !sections.instructions.end) {
    sections.instructions.end = lines.length;
  }
  
  return sections;
}

/**
 * Extract title from text (first non-empty line if it looks like a title)
 */
function extractTitle(text: string, sections: Sections): string {
  const lines = text.split('\n');
  
  // If first line is before any section and looks like a title
  const firstLine = lines[0]?.trim();
  if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
    // Check if it's not an ingredient or instruction pattern
    if (!/^(ingredients?|instructions?|directions?|\d+[\.\)]\s)/i.test(firstLine)) {
      return firstLine;
    }
  }
  
  return 'Untitled Recipe';
}

/**
 * Extract ingredients from text
 */
function extractIngredients(text: string, sections: Sections): RecipeDraft['ingredients'] {
  const lines = text.split('\n');
  let ingredientLines: string[] = [];
  
  if (sections.ingredients) {
    const start = sections.ingredients.start;
    const end = sections.ingredients.end || lines.length;
    ingredientLines = lines.slice(start, end);
  } else {
    // Heuristic: lines with bullet points or starting with quantities
    ingredientLines = lines.filter(line => {
      const trimmed = line.trim();
      return (
        /^[-•*]\s/.test(trimmed) ||
        /^\d+/.test(trimmed) ||
        (trimmed.length < 80 && /(cup|tbsp|tsp|oz|lb|g|kg|ml|l)\b/i.test(trimmed))
      );
    });
  }
  
  return ingredientLines
    .map(line => {
      const raw = line.replace(/^[-•*]\s*/, '').trim();
      if (!raw) return null;
      
      const parsed = parseIngredientLine(raw);
      return {
        raw,
        name: parsed?.name,
        quantity: parsed?.quantity ?? null,
        unit: parsed?.unit ?? null,
        notes: parsed?.modifiers.join(', ') || undefined,
      };
    })
    .filter((ing): ing is NonNullable<typeof ing> => ing !== null);
}

/**
 * Extract instructions from text
 */
function extractInstructions(text: string, sections: Sections): RecipeDraft['instructions'] {
  const lines = text.split('\n');
  let instructionLines: string[] = [];
  
  if (sections.instructions) {
    const start = sections.instructions.start;
    const end = sections.instructions.end || lines.length;
    instructionLines = lines.slice(start, end);
  } else {
    // Heuristic: lines starting with numbers or longer descriptive text
    instructionLines = lines.filter(line => {
      const trimmed = line.trim();
      return /^\d+[\.\)]\s/.test(trimmed) || (trimmed.length > 20 && !/^[-•*]/.test(trimmed));
    });
  }
  
  const steps: RecipeDraft['instructions'] = [];
  let stepNumber = 1;
  
  for (const line of instructionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if line starts with a number
    const numberMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
    if (numberMatch) {
      stepNumber = parseInt(numberMatch[1], 10);
      steps.push({
        step: stepNumber,
        text: numberMatch[2].trim(),
      });
      stepNumber++;
    } else {
      // Add as new step or append to previous
      if (steps.length === 0 || steps[steps.length - 1].text.length > 100) {
        steps.push({
          step: stepNumber,
          text: trimmed,
        });
        stepNumber++;
      } else {
        // Append to previous step
        steps[steps.length - 1].text += ' ' + trimmed;
      }
    }
  }
  
  // Renumber steps sequentially
  return steps.map((step, index) => ({
    step: index + 1,
    text: step.text,
  }));
}

/**
 * Extract metadata (servings, times)
 */
function extractMetadata(text: string, sections: Sections): {
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
} {
  const metadata: {
    servings?: number | null;
    prepMinutes?: number | null;
    cookMinutes?: number | null;
    totalMinutes?: number | null;
  } = {};
  
  const allText = text.toLowerCase();
  
  // Extract servings
  const servingsMatch = allText.match(/(?:servings?|yield|makes|serves?):?\s*(\d+)/i);
  if (servingsMatch) {
    metadata.servings = parseInt(servingsMatch[1], 10);
  }
  
  // Extract times
  const prepMatch = allText.match(/(?:prep|preparation)\s+time:?\s*(\d+)\s*(?:min|minute|hour|hr)/i);
  if (prepMatch) {
    const value = parseInt(prepMatch[1], 10);
    metadata.prepMinutes = /hour|hr/i.test(prepMatch[0]) ? value * 60 : value;
  }
  
  const cookMatch = allText.match(/(?:cook|baking)\s+time:?\s*(\d+)\s*(?:min|minute|hour|hr)/i);
  if (cookMatch) {
    const value = parseInt(cookMatch[1], 10);
    metadata.cookMinutes = /hour|hr/i.test(cookMatch[0]) ? value * 60 : value;
  }
  
  const totalMatch = allText.match(/(?:total)\s+time:?\s*(\d+)\s*(?:min|minute|hour|hr)/i);
  if (totalMatch) {
    const value = parseInt(totalMatch[1], 10);
    metadata.totalMinutes = /hour|hr/i.test(totalMatch[0]) ? value * 60 : value;
  }
  
  return metadata;
}

/**
 * Calculate confidence score (0..1)
 */
function calculateConfidence(
  ingredients: RecipeDraft['ingredients'],
  instructions: RecipeDraft['instructions']
): number {
  let confidence = 1.0;
  
  // Penalize missing sections
  if (ingredients.length === 0) confidence -= 0.3;
  if (instructions.length === 0) confidence -= 0.3;
  
  // Penalize too few items
  if (ingredients.length < 3) confidence -= 0.2;
  if (instructions.length < 2) confidence -= 0.2;
  
  // Bonus for good parsing
  const parsedIngredients = ingredients.filter(ing => ing.name && ing.quantity !== null);
  if (parsedIngredients.length > 0) {
    const parseRate = parsedIngredients.length / ingredients.length;
    confidence += (parseRate - 0.5) * 0.2; // Up to +0.1 bonus
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Generate warnings based on parsing quality
 */
function generateWarnings(
  ingredients: RecipeDraft['ingredients'],
  instructions: RecipeDraft['instructions'],
  confidence: number
): string[] {
  const warnings: string[] = [];
  
  if (ingredients.length === 0) {
    warnings.push('No ingredients detected');
  } else if (ingredients.length < 3) {
    warnings.push('Very few ingredients detected');
  }
  
  if (instructions.length === 0) {
    warnings.push('No instructions detected');
  } else if (instructions.length < 2) {
    warnings.push('Very few instruction steps detected');
  }
  
  if (confidence < 0.5) {
    warnings.push('Low confidence parsing - please review carefully');
  }
  
  return warnings;
}
