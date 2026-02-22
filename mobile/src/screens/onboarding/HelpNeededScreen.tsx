import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

type HelpNeededScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'HelpNeeded'>;

interface HelpNeededScreenProps {
  navigation: HelpNeededScreenNavigationProp;
}

interface HelpOption {
  id: string;
  label: string;
  icon: string;
}

const HELP_OPTIONS: HelpOption[] = [
  { id: 'improve-cooking', label: 'Improve My Cooking', icon: 'restaurant' },
  { id: 'save-time', label: 'Save Time', icon: 'calendar' },
  { id: 'find-inspiration', label: 'Find Inspiration', icon: 'bulb' },
  { id: 'spend-less', label: 'Spend Less', icon: 'cash' },
  { id: 'waste-less', label: 'Waste Less Food', icon: 'reload' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const HelpNeededScreen: React.FC<HelpNeededScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'HelpNeeded'>>();
  const [selectedHelp, setSelectedHelp] = useState<string[]>([]);
  const [otherResponse, setOtherResponse] = useState<string>('');

  useEffect(() => {
    if (route.params?.otherResponse) {
      setOtherResponse(route.params.otherResponse);
      setSelectedHelp(['other']);
    }
  }, [route.params]);

  const handleHelpToggle = (helpId: string) => {
    if (helpId === 'other') {
      // Navigate to OtherHelp screen when "Other" is selected
      navigation.navigate('OtherHelp');
      return;
    }
    setSelectedHelp(prev => {
      if (prev.includes(helpId)) {
        return prev.filter(id => id !== helpId);
      } else {
        return [...prev, helpId];
      }
    });
  };

  const handleNext = () => {
    navigation.navigate('FeaturedRecipes');
  };

  const handleSkip = () => {
    navigation.navigate('Pricing');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderHelpButton = (help: HelpOption) => {
    const isSelected = selectedHelp.includes(help.id);
    const displayText = help.id === 'other' && otherResponse ? otherResponse : help.label;

    return (
      <TouchableOpacity
        key={help.id}
        style={[
          styles.helpButton,
          isSelected && styles.helpButtonSelected
        ]}
        onPress={() => handleHelpToggle(help.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={help.icon as any}
          size={24}
          color={isSelected ? '#1A1A1A' : '#1A1A1A'}
        />
        <Text style={[
          styles.helpText,
          isSelected && styles.helpTextSelected
        ]}>
          {displayText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
          <View style={[styles.progressBar, styles.progressBarFilled]} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>What do you need the most help with?</Text>
          <Text style={styles.description}>
            This will help us recommend recipes that suit your needs.
          </Text>
        </View>

        {/* Help Options List */}
        <View style={styles.helpContainer}>
          {HELP_OPTIONS.map(help => renderHelpButton(help))}
        </View>
      </ScrollView>

      {/* Next Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBarFilled: {
    backgroundColor: '#CEEC2C',
  },
  progressBarEmpty: {
    backgroundColor: '#E0E0E0',
  },
  skipButton: {
    padding: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  questionContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4A4A4A',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  helpContainer: {
    width: '100%',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    marginBottom: 12,
    width: '100%',
  },
  helpButtonSelected: {
    backgroundColor: '#E0EB60',
    borderColor: '#E0EB60',
  },
  helpText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 16,
  },
  helpTextSelected: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  nextButton: {
    backgroundColor: '#CEEC2C',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default HelpNeededScreen;
