import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export default function CreateLobbyScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Lobi Kurma Ekranı (Yakında)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.text,
    fontSize: 18,
  },
});
