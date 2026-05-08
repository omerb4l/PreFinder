import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { Colors } from '@/constants/theme';

interface CustomTextInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
}

export const CustomTextInput = ({ label, placeholder, value, onChangeText, secureTextEntry }: CustomTextInputProps) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#666"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
  },
});
