import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

interface AuthCardProps {
  children: React.ReactNode;
}

export const AuthCard = ({ children }: AuthCardProps) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const cardWidth = isWeb ? Math.min(width * 0.9, 420) : '100%';

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
    backgroundColor: 'transparent', // Transparent container to let AuthBackground show through
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  card: {
    padding: Platform.OS === 'web' ? 40 : 24,
    backgroundColor: 'rgba(31, 35, 38, 0.55)', // Elegant semi-transparent dark pane
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)', // Safari support
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 16px rgba(0, 255, 135, 0.05)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
});
