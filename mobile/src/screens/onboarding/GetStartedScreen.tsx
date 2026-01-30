import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';

type GetStartedScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GetStarted'>;

interface GetStartedScreenProps {
  navigation: GetStartedScreenNavigationProp;
}

const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ navigation }) => {
  const handleLetsGo = () => {
    navigation.navigate('DietaryPreferences');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Main Heading */}
        <View style={styles.headingContainer}>
          <Text style={styles.headingLine1}>LET'S GET</Text>
          <Text style={styles.headingLine2}>STARTED!</Text>
        </View>

        {/* Chili Pepper Character */}
        <View style={styles.characterContainer}>
          <Image
            source={require('../../../assets/images/get-started/get-started-let-go.png')}
            style={styles.characterImage}
            resizeMode="contain"
          />
        </View>

        {/* Description Text */}
        <View style={styles.textContainer}>
          <Text style={styles.descriptionText}>
            Tell us a bit about yourself so we can help you get the most out of CookThisPage!
          </Text>
        </View>

        {/* CTA Button */}
        <TouchableOpacity 
          style={styles.letsGoButton}
          onPress={handleLetsGo}
          activeOpacity={0.8}
        >
          <Text style={styles.letsGoButtonText}>LET'S GO</Text>
        </TouchableOpacity>

        {/* Back Link */}
        <TouchableOpacity 
          style={styles.backLink}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={16} color="#1A1A1A" style={styles.backArrow} />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFD700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  headingLine1: {
    fontSize: 42,
    fontWeight: '900',
    color: '#1A1A1A',
    fontFamily: 'System',
    letterSpacing: 1,
    textAlign: 'center',
  },
  headingLine2: {
    fontSize: 52,
    fontWeight: '900',
    color: '#1A1A1A',
    fontFamily: 'System',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: -8,
  },
  characterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    height: 250,
    width: '100%',
  },
  characterImage: {
    width: 200,
    height: 250,
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  descriptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'left',
    lineHeight: 24,
  },
  letsGoButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  letsGoButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    marginRight: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
});

export default GetStartedScreen;
