import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedTouchableProps extends PressableProps {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: React.ReactNode;
}

export const AnimatedTouchable: React.FC<AnimatedTouchableProps> = ({
  style,
  children,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    setIsPressed(true);
    scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
    if (props.onPressIn) {
      props.onPressIn(e);
    }
  };

  const handlePressOut = (e: any) => {
    setIsPressed(false);
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    if (props.onPressOut) {
      props.onPressOut(e);
    }
  };

  // Resolve style function or object locally before passing it to AnimatedPressable
  const resolvedStyle = typeof style === 'function' ? style({ pressed: isPressed }) : style;

  return (
    <AnimatedPressable
      style={[resolvedStyle, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
};
