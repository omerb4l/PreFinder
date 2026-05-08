import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const REASONS = [
  'AFK / Oyundan Çıkma',
  'Küfür / Toksik Davranış',
  'Trol / Sabotaj'
];

export default function ReportScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  
  const [riotId, setRiotId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleSubmit = () => {
    console.log('Report Submitted:', { riotId, selectedReason, explanation });
    alert('Şikayetiniz alındı. İnceleme sonrası tarafınıza bilgi verilecektir.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.contentPadding, isWeb && styles.webContentPadding]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Oyuncu Şikayet Et</Text>
            <Text style={styles.subtitle}>Sistemimizi temiz tutmamıza yardımcı olun.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şikayet Edilecek Riot ID</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Troll#123"
              placeholderTextColor={Colors.gray}
              value={riotId}
              onChangeText={setRiotId}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şikayet Nedeni</Text>
            <View style={styles.reasonsGrid}>
              {REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonBadge,
                    selectedReason === reason && styles.reasonBadgeActive
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextActive
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Açıklama veya Maç Linki (İsteğe Bağlı)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Detayları buraya yazın..."
              placeholderTextColor={Colors.gray}
              value={explanation}
              onChangeText={setExplanation}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity 
            style={styles.submitBtn} 
            activeOpacity={0.8}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>Şikayeti Gönder</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.gray} />
            <Text style={styles.infoText}>
              Şikayetleriniz ekibimiz tarafından 24 saat içinde incelenir.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentPadding: {
    padding: 20,
  },
  webContentPadding: {
    paddingHorizontal: '25%',
    paddingTop: 60,
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.gray,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0F1923',
    color: Colors.text,
    padding: 14,
    borderRadius: 8,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  reasonsGrid: {
    gap: 10,
  },
  reasonBadge: {
    backgroundColor: '#0F1923',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reasonBadgeActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  reasonText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: Colors.text,
  },
  submitBtn: {
    backgroundColor: Colors.danger,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  infoText: {
    color: Colors.gray,
    fontSize: 12,
    flex: 1,
  },
});
