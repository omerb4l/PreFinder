import React from 'react';
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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
    if (props.onPressIn) {
      props.onPressIn(e);
    }
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    if (props.onPressOut) {
      props.onPressOut(e);
    }
  };

  return (
    <AnimatedPressable
      style={(state) => {
        const resolvedStyle = typeof style === 'function' ? style(state) : style;
        return [resolvedStyle, animatedStyle];
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
};
