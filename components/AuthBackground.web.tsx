import React from 'react';
import { StyleSheet, View } from 'react-native';
import LiquidEther from './LiquidEther.web';

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export default function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <View style={styles.container}>
      {/* Three.js liquid background rendered only on Web */}
      <LiquidEther 
        colors={['#00FF87', '#008A47', '#051A10']} 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
      />
      
      {/* Children content rendered cleanly on top */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    minHeight: '100vh' as any, // Full viewport height on Web
    backgroundColor: '#0F1923', // Matches PreFinder's premium dark background
  },
  content: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
});

