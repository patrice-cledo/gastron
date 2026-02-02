import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

interface WelcomeSlide {
  id: string;
  headline: string;
  description: string;
  image?: any;
}

const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    id: '1',
    headline: 'Grocery Shopping Made Simple',
    description: 'One weekly shopping list of ingredients, combining fresh product with store cupboard ingredients - saving you money.',
    image: require('../../../assets/images/get-started/get-started-slide-1.png'),
  },
  {
    id: '2',
    headline: 'Unlock Your Kitchen Confidence',
    description: 'Sidekick helps you discover exciting new flavours, experiment with different ingredients and learn new techniques.',
    image: require('../../../assets/images/get-started/get-started-slide-2.png'),
  },
  {
    id: '3',
    headline: 'Cancel Your Boring Dinners',
    description: "It's easier than you think to cook up banging recipes and discover awesome new ingredients. We'll show you how.",
    image: require('../../../assets/images/get-started/get-started-slide-3.png'),
  },
  {
    id: '4',
    headline: 'Stress Free, Enjoyable Home Cooking',
    description: 'Reduce the pain of deciding what to cook every evening',
    image: require('../../../assets/images/get-started/get-started-slide-4.png'),
  },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDE_WIDTH = SCREEN_WIDTH - 48;

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const progressAnimations = useRef(
    WELCOME_SLIDES.map(() => new Animated.Value(0))
  ).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slides every 6 seconds with progress animation
  useEffect(() => {
    // Reset all progress bars
    progressAnimations.forEach((anim) => anim.setValue(0));
    
    // Start progress animation for current slide
    progressAnimations[currentSlide].setValue(0);
    const progressAnim = Animated.timing(progressAnimations[currentSlide], {
      toValue: 1,
      duration: 6000,
      useNativeDriver: false,
    });
    progressAnim.start();

    const advanceSlide = () => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % WELCOME_SLIDES.length;
        Animated.timing(slideAnimation, {
          toValue: next,
          duration: 400,
          useNativeDriver: true,
        }).start();
        return next;
      });
    };

    // Start interval for slide advancement
    intervalRef.current = setInterval(advanceSlide, 6000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      progressAnim.stop();
    };
  }, [currentSlide]);

  // Update slide animation when currentSlide changes
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: currentSlide,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentSlide]);

  const handleGetStarted = () => {
    navigation.navigate('GetStarted');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleProgressBarPress = (index: number) => {
    // Reset interval when user manually changes slide
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    // Reset all progress animations
    progressAnimations.forEach((anim) => anim.setValue(0));
    setCurrentSlide(index);
  };

  const translateX = slideAnimation.interpolate({
    inputRange: WELCOME_SLIDES.map((_, i) => i),
    outputRange: WELCOME_SLIDES.map((_, i) => -SLIDE_WIDTH * i),
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Progress Indicators */}
      <View style={styles.progressContainer}>
        {WELCOME_SLIDES.map((_, index) => {
          const isActive = currentSlide === index;
          const isCompleted = currentSlide > index;
          const progressWidth = progressAnimations[index].interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          });
          
          return (
            <TouchableOpacity
              key={index}
              style={styles.progressBarWrapper}
              onPress={() => handleProgressBarPress(index)}
              activeOpacity={0.7}
            >
              <View style={styles.progressBarBackground}>
                {isCompleted ? (
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: '100%',
                        backgroundColor: '#CEEC2C',
                      },
                    ]}
                  />
                ) : isActive ? (
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressWidth,
                        backgroundColor: '#CEEC2C',
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: '0%',
                        backgroundColor: '#E0E0E0',
                      },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Slides Container */}
        <View style={styles.slidesContainer}>
          <Animated.View
            style={[
              styles.slidesWrapper,
              {
                transform: [{ translateX }],
              },
            ]}
          >
            {WELCOME_SLIDES.map((slide, index) => (
              <View key={slide.id} style={styles.slide}>
                {/* Headline Section */}
                <View style={styles.headlineContainer}>
                  <Text style={styles.headline}>{slide.headline}</Text>
                  <Text style={styles.subHeadline}>{slide.description}</Text>
                </View>

                {/* Central Image/Content Area */}
                <View style={styles.imageContainer}>
                  {slide.image ? (
                    <Image
                      source={slide.image}
                      style={styles.slideImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>Slide {index + 1}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Get Started Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={handleGetStarted}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
          
          {/* Login Link */}
          <TouchableOpacity 
            style={styles.loginLinkContainer}
            onPress={handleLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
    flexGrow: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: -0.5,
  },
  slidesContainer: {
    width: SLIDE_WIDTH,
    height: 580,
    overflow: 'hidden',
    marginBottom: 32,
    alignSelf: 'center',
  },
  slidesWrapper: {
    flexDirection: 'row',
    width: SLIDE_WIDTH * WELCOME_SLIDES.length,
    height: '100%',
  },
  slide: {
    width: SLIDE_WIDTH,
    height: '100%',
    paddingHorizontal: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 0,
    overflow: 'hidden',
  },
  headlineContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
    width: SLIDE_WIDTH,
    paddingHorizontal: 0,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'left',
    marginBottom: 10,
    lineHeight: 30,
    paddingHorizontal: 0,
    width: SLIDE_WIDTH,
  },
  subHeadline: {
    fontSize: 15,
    fontWeight: '400',
    color: '#4A4A4A',
    textAlign: 'left',
    lineHeight: 22,
    paddingHorizontal: 0,
    width: SLIDE_WIDTH,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 380,
    width: '100%',
    borderRadius: 16,
    overflow: 'visible',
  },
  slideImage: {
    width: '110%',
    height: '110%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F0',
  },
  imagePlaceholderText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    marginTop: -8,
    marginBottom: 40,
  },
  loginLinkContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loginLinkBold: {
    fontWeight: '600',
    color: '#347A22',
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default WelcomeScreen;
