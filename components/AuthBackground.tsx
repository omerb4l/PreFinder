import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export default function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <LinearGradient
      colors={['#0F1923', '#080C10', '#020304']}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
