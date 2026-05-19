import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { Colors } from '@/constants/theme';

interface CustomTextInputProps extends TextInputProps {
  label?: string;
}

export const CustomTextInput = ({ label, style, ...props }: CustomTextInputProps) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor="#666"
        autoCapitalize="none"
        {...props}
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
