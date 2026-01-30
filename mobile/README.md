# Gastrons - Mobile App

React Native mobile application for Gastrons, a visual recipe app that converts recipes into simple, parchment-style visual layouts.

## Tech Stack

- **React Native** (0.74.0)
- **Expo** (~51.0.0)
- **TypeScript**
- **React Navigation** (Native Stack & Bottom Tabs)
- **React Native Reanimated** & **Gesture Handler**

## Project Structure

```
mobile-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components
│   ├── navigation/       # Navigation configuration
│   ├── theme/           # Design system (colors, typography, spacing)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── hooks/           # Custom React hooks
│   └── services/        # API and storage services
├── App.tsx              # Main app entry point
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Studio (for Android development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on iOS:
```bash
npm run ios
```

4. Run on Android:
```bash
npm run android
```

5. Run on Web:
```bash
npm run web
```

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Design System

The app follows the Gastrons design guidelines:

- **Colors**: Neutral palette with parchment off-white base (#F5F5F0)
- **Typography**: Geometric/humanist sans-serif (System font, will be replaced with custom font)
- **Spacing**: Consistent spacing scale (4, 8, 16, 24, 32, 48, 64)
- **Icons**: Thin line art style (IKEA-inspired simplicity)

## Features (Planned)

- Visual recipe creation and editing
- Recipe library management
- Screenshot-to-recipe conversion
- Parchment-style recipe display
- Ingredient checklist
- Step-by-step cooking guide
- Recipe sharing

## Notes

- The app uses React Navigation (Native Stack Navigator) for navigation
- Theme system is set up for easy customization and follows Gastrons design guidelines
- TypeScript is configured with strict mode enabled
- Path aliases are configured in tsconfig.json for cleaner imports (@components, @screens, etc.)

