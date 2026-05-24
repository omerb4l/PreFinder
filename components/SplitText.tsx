import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface SplitTextProps {
  tag?: string;
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: string;
  from?: any;
  to?: any;
  threshold?: number;
  rootMargin?: string;
  textAlign?: 'left' | 'center' | 'right';
  onLetterAnimationComplete?: () => void;
}

export default function SplitText({ text, textAlign = 'center' }: SplitTextProps) {
  if (text === 'PreFinder') {
    return (
      <Text style={[styles.title, { textAlign }]}>
        Pre<Text style={styles.accent}>Finder</Text>
      </Text>
    );
  }

  return (
    <Text style={[styles.title, { textAlign }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -1,
  },
  accent: {
    color: Colors.primary,
  },
});
