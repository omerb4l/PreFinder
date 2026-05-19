import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/theme';

interface AuthCardProps {
  children: React.ReactNode;
}

export const AuthCard = ({ children }: AuthCardProps) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const cardWidth = isWeb ? Math.min(width * 0.9, 400) : '100%';

  return (
    <View style={styles.container}>
      <View style={[styles.card, { width: cardWidth as any }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    // On mobile this will just be a container, on web it looks like a card if styled so
    // But per requirements, it should "take up the screen naturally on Mobile"
    // and "look like a centered card on Web"
    padding: Platform.OS === 'web' ? 40 : 0,
    backgroundColor: Platform.OS === 'web' ? 'rgba(31, 35, 38, 0.5)' : 'transparent',
    borderRadius: 16,
  },
});
