import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Platform, useWindowDimensions, Image, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

const REASONS = [
  "AFK / Oyundan Çıkma",
  "Küfür / Toksik Davranış",
  "Trol / Sabotaj",
  "Hile Kullanımı (Aimbot/Wallhack)",
  "Sahte Rütbe / Smurf",
  "Uygunsuz Profil / İsim",
  "Uygulama İçi Spam",
  "Diğer"
];

export default function ReportScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  
  const [riotId, setRiotId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [evidenceImage, setEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const pickEvidenceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kanıt eklemek için galeri izni vermeniz gerekmektedir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setEvidenceImage(result.assets[0]);
    }
  };

  const removeEvidenceImage = () => {
    setEvidenceImage(null);
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Hata', 'Şikayet göndermek için giriş yapmalısınız.');
      return;
    }

    if (!riotId.trim() || !selectedReason) {
      Alert.alert('Hata', 'Lütfen Riot ID ve şikayet nedenini seçin.');
      return;
    }

    setLoading(true);
    try {
      // Task 2: User Existence Check
      const targetRiotId = riotId.trim();
      const userQuery = query(collection(db, 'users'), where('riotId', '==', targetRiotId));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        Alert.alert("Hata", "Böyle bir kullanıcı sistemde kayıtlı değil.");
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reportedRiotId: riotId.trim(),
        reason: selectedReason,
        description: explanation.trim(),
        videoLink: videoLink.trim() || "",
        evidenceImageBase64: evidenceImage?.base64 || null,
        status: 'pending',
        timestamp: serverTimestamp(),
      });

      Alert.alert('Başarılı', 'Şikayetiniz alındı. İnceleme sonrası tarafınıza bilgi verilecektir.');
      
      // Reset form
      setRiotId('');
      setSelectedReason('');
      setExplanation('');
      setVideoLink('');
      setEvidenceImage(null);
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('Hata', 'Şikayet gönderilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.label}>Açıklama (İsteğe Bağlı)</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Video Linki (İsteğe Bağlı)</Text>
            <TextInput
              style={styles.input}
              placeholder="YouTube, Medal, Twitch vb."
              placeholderTextColor={Colors.gray}
              value={videoLink}
              onChangeText={setVideoLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kanıt Ekran Görüntüsü</Text>
            {evidenceImage ? (
              <View style={styles.evidenceContainer}>
                <Image source={{ uri: evidenceImage.uri }} style={styles.evidencePreview} />
                <TouchableOpacity style={styles.removeEvidenceBtn} onPress={removeEvidenceImage}>
                  <Ionicons name="trash-outline" size={18} color={Colors.text} />
                  <Text style={styles.removeEvidenceText}>Kaldır</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.evidencePickerBtn} onPress={pickEvidenceImage}>
                <Ionicons name="camera-outline" size={24} color={Colors.gray} />
                <Text style={styles.evidencePickerText}>📷 Ekran Görüntüsü Ekle (İsteğe Bağlı)</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.disclaimerText}>
              📌 Kanıt (fotoğraf veya video) içeren şikayetlerin incelenme ve işlem yapılma önceliği daha yüksektir.
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'Gönderiliyor...' : 'Şikayeti Gönder'}
            </Text>
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
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reasonBadge: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reasonBadgeActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  reasonText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '700',
  },
  reasonTextActive: {
    color: Colors.text,
  },
  evidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F1923',
    padding: 10,
    borderRadius: 8,
  },
  evidencePreview: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  removeEvidenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 70, 85, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeEvidenceText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  evidencePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F1923',
    padding: 16,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  evidencePickerText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerText: {
    color: Colors.gray,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
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
