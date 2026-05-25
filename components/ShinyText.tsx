import React from 'react';
import { Text } from 'react-native';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right';
  delay?: number;
  style?: any;
}

export default function ShinyText({ text, style }: ShinyTextProps) {
  // Mobile fallback renders a standard text node
  return (
    <Text style={style}>
      {text}
    </Text>
  );
}
