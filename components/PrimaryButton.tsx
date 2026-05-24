import React from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { AnimatedTouchable } from './AnimatedTouchable';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
}

export const PrimaryButton = ({ title, onPress, loading }: PrimaryButtonProps) => {
  return (
    <AnimatedTouchable 
      style={styles.button} 
      onPress={onPress} 
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={Colors.background} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  text: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
