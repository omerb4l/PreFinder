import React from 'react';
import { View } from 'react-native';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  style?: any;
  spotlightColor?: string;
}

export default function SpotlightCard({ children, style }: SpotlightCardProps) {
  // Mobile fallback is a simple view container
  return (
    <View style={style}>
      {children}
    </View>
  );
}
