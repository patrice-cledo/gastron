// Quick test for timer parsing regex
const testCases = [
  "Bake at 350F for 30 minutes",
  "Cook for 45 min",
  "Simmer for 1 hour",
  "Roast for 2 hours",
  "Bake for 30 mins",
  "Cook for 1.5 hours",
];

const minutePatterns = [
  /for\s+(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|minute|min)\b/i,
  /(?:^|\s|[^\d])(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|minute|min)\b/i,
];

const hourPatterns = [
  /for\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hour|hr|h)\b/i,
  /(?:^|\s|[^\d])(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hour|hr|h)\b/i,
];

function parseDurationFromText(text) {
  if (!text || typeof text !== 'string') {
    return undefined;
  }

  const normalizedText = text.toLowerCase().trim();
  console.log('\nParsing:', normalizedText);

  // Check for hour patterns first
  for (const pattern of hourPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      console.log('  Match:', match[0]);
      console.log('  Captured:', match[1]);
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        console.log('  Result: ', value * 60, 'minutes');
        return Math.round(value * 60);
      }
    }
  }

  // Check for minute patterns
  for (const pattern of minutePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      console.log('  Match:', match[0]);
      console.log('  Captured:', match[1]);
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        console.log('  Result: ', value, 'minutes');
        return Math.round(value);
      }
    }
  }

  console.log('  No match found');
  return undefined;
}

testCases.forEach(test => {
  parseDurationFromText(test);
});
