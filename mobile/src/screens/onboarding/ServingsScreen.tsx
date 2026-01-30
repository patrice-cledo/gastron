import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

type ServingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Servings'>;

interface ServingsScreenProps {
  navigation: ServingsScreenNavigationProp;
}

const ServingsScreen: React.FC<ServingsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [servings, setServings] = useState(2);

  const handleDecrease = () => {
    if (servings > 1) {
      setServings(servings - 1);
    }
  };

  const handleIncrease = () => {
    setServings(servings + 1);
  };

  const handleNext = () => {
    navigation.navigate('Cuisines');
  };

  const handleSkip = () => {
    navigation.navigate('SignUp');
  };

  const handleBack = () => {
    navigation.goBack();
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
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
          <View style={[styles.progressBar, styles.progressBarEmpty]} />
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
          <Text style={styles.question}>How many people are you cooking for?</Text>
          <Text style={styles.description}>
            We will adjust the recipe ingredients and methods to suit your needs.
          </Text>
        </View>

        {/* Servings Selector */}
        <View style={styles.servingsContainer}>
          <View style={styles.servingsSelector}>
            <TouchableOpacity
              style={styles.servingsButton}
              onPress={handleDecrease}
              disabled={servings === 1}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="remove" 
                size={24} 
                color={servings === 1 ? '#CCCCCC' : '#1A1A1A'} 
              />
            </TouchableOpacity>
            
            <View style={styles.servingsDisplay}>
              <Text style={styles.servingsNumber}>{servings} </Text>
              <Text style={styles.servingsLabel}>
                {servings === 1 ? 'Serving' : 'Servings'}
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.servingsButton}
              onPress={handleIncrease}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#FFD700',
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
    paddingTop: 40,
    paddingBottom: 100,
    flexGrow: 1,
  },
  questionContainer: {
    marginBottom: 48,
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
  servingsContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8E6C9',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    justifyContent: 'space-between',
  },
  servingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#66BB6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  servingsNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  servingsLabel: {
    fontSize: 20,
    fontWeight: '400',
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
    backgroundColor: '#FFD700',
    borderRadius: 12,
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

export default ServingsScreen;
