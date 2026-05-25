import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface TiltedCardProps {
  imageSrc: string;
  containerHeight?: number | string;
  containerWidth?: number | string;
  imageHeight?: number | string;
  imageWidth?: number | string;
  aspectRatio?: number;
}

export default function TiltedCard({
  imageSrc,
  containerHeight = 180,
  containerWidth = '100%',
  imageHeight = '100%',
  imageWidth = '100%',
  aspectRatio,
}: TiltedCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1.0, { damping: 15, stiffness: 150 });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        width: containerWidth as any,
        height: aspectRatio ? undefined : (containerHeight as any),
        aspectRatio: aspectRatio,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[styles.innerContainer, animatedStyle]}>
        <Image
          source={{ uri: imageSrc }}
          style={styles.image}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
