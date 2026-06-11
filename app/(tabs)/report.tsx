import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, useWindowDimensions, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import ShinyText from '@/components/ShinyText';

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

interface TeammateItem {
  uid: string;
  username: string;
  riotId: string;
  profilePicBase64: string | null;
}

export default function ReportScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [themeMode, setThemeMode] = useState(getThemeMode());
  
  const [teammates, setTeammates] = useState<TeammateItem[]>([]);
  const [loadingTeammates, setLoadingTeammates] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeTheme((t) => setThemeMode(t));
    return () => unsub();
  }, []);
  const [selectedUserRiotId, setSelectedUserRiotId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [evidenceImage, setEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTeammates = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingTeammates(false);
        return;
      }

      setLoadingTeammates(true);
      try {
        const qLeader = query(
          collection(db, 'match_history'),
          where('leaderId', '==', user.uid)
        );
        const qPlayer = query(
          collection(db, 'match_history'),
          where('playerId', '==', user.uid)
        );

        const [snapLeader, snapPlayer] = await Promise.all([
          getDocs(qLeader),
          getDocs(qPlayer)
        ]);

        const rawMatches: { leaderId: string; playerId: string }[] = [];
        snapLeader.forEach((doc) => {
          const data = doc.data();
          if (data.leaderId && data.playerId) {
            rawMatches.push(data as { leaderId: string; playerId: string });
          }
        });
        snapPlayer.forEach((doc) => {
          const data = doc.data();
          if (data.leaderId && data.playerId) {
            rawMatches.push(data as { leaderId: string; playerId: string });
          }
        });

        // Extract target user IDs based on the rules:
        // - If auth.currentUser.uid === match.leaderId, target is match.playerId.
        // - If auth.currentUser.uid === match.playerId, target is match.leaderId.
        const teammateIds = new Set<string>();
        rawMatches.forEach((m) => {
          let targetId: string | null = null;
          if (user.uid === m.leaderId) {
            targetId = m.playerId;
          } else if (user.uid === m.playerId) {
            targetId = m.leaderId;
          }

          if (targetId && targetId !== user.uid) {
            teammateIds.add(targetId);
          }
        });

        // Convert Set to deduplicated array
        const deduplicatedTeammateIds = Array.from(teammateIds);

        const resolvedTeammates: TeammateItem[] = [];
        await Promise.all(
          deduplicatedTeammateIds.map(async (teammateId) => {
            try {
              const teammateRef = doc(db, 'users', teammateId);
              const teammateSnap = await getDoc(teammateRef);
              if (teammateSnap.exists()) {
                const data = teammateSnap.data();
                resolvedTeammates.push({
                  uid: teammateId,
                  username: data.username || 'Bilinmeyen Oyuncu',
                  riotId: data.riotId || '',
                  profilePicBase64: data.profilePicBase64 || null,
                });
              }
            } catch (err) {
              console.warn('Error fetching teammate details:', err);
            }
          })
        );
        setTeammates(resolvedTeammates);
      } catch (error) {
        console.error('Error fetching teammates for reporting:', error);
      } finally {
        setLoadingTeammates(false);
      }
    };

    fetchTeammates();
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const pickEvidenceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('İzin Gerekli', 'Kanıt eklemek için galeri izni vermeniz gerekmektedir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      showAlert('Hata', 'Şikayet göndermek için giriş yapmalısınız.');
      return;
    }

    if (!selectedUserId || !selectedReason) {
      showAlert('Hata', 'Lütfen şikayet edilecek bir oyuncu ve şikayet nedenini seçin.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reportedUserId: selectedUserId,
        reportedRiotId: selectedUserRiotId || "",
        reason: selectedReason,
        description: explanation.trim(),
        videoLink: videoLink.trim() || "",
        evidenceImageBase64: evidenceImage?.base64 || null,
        status: 'pending',
        timestamp: serverTimestamp(),
      });

      showAlert('Başarılı', 'Şikayetiniz alındı. İnceleme sonrası tarafınıza bilgi verilecektir.');
      
      // Reset form
      setSelectedUserId(null);
      setSelectedUserRiotId(null);
      setSelectedReason('');
      setExplanation('');
      setVideoLink('');
      setEvidenceImage(null);
    } catch (error) {
      console.error('Report submission error:', error);
      showAlert('Hata', 'Şikayet gönderilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.contentPadding, isWeb && styles.webContentPadding]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <ShinyText
              text="Oyuncu Şikayet Et"
              style={styles.title}
              speed={3}
              delay={1.5}
              color="#ECE8E1"
              shineColor="#00FF87"
            />
            <Text style={styles.subtitle}>Sistemimizi temiz tutmamıza yardımcı olun.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şikayet Edilecek Takım Arkadaşı</Text>
            {loadingTeammates ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
            ) : teammates.length === 0 ? (
              <View style={styles.emptyTeammatesBox}>
                <Ionicons name="people-outline" size={24} color={Colors.gray} />
                <Text style={styles.emptyTeammatesText}>
                  Şikayet edebileceğiniz, birlikte oynadığınız bir oyuncu bulunmamaktadır.
                </Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.teammateListContainer}
              >
                {teammates.map((item) => {
                  const isSelected = selectedUserId === item.uid;
                  return (
                    <TouchableOpacity
                      key={item.uid}
                      style={[
                        styles.teammateCard,
                        isSelected && styles.teammateCardActive
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedUserId(null);
                          setSelectedUserRiotId(null);
                        } else {
                          setSelectedUserId(item.uid);
                          setSelectedUserRiotId(item.riotId);
                        }
                      }}
                    >
                      <View style={styles.teammateAvatarWrapper}>
                        {item.profilePicBase64 ? (
                          <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.profilePicBase64}` }} 
                            style={styles.teammateAvatar} 
                          />
                        ) : (
                          <Ionicons name="person" size={16} color={isSelected ? Colors.text : Colors.gray} />
                        )}
                      </View>
                      <View style={styles.teammateDetails}>
                        <Text style={[styles.teammateUsername, isSelected && styles.teammateTextActive]}>
                          {item.username}
                        </Text>
                        <Text style={[styles.teammateRiotIdText, isSelected && styles.teammateTextActive]}>
                          {item.riotId || 'Riot ID Yok'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
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
            style={[styles.submitBtn, (loading || !selectedUserId) && { opacity: 0.5 }]} 
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={loading || !selectedUserId}
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
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
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
  teammateListContainer: {
    paddingVertical: 4,
    gap: 10,
    flexDirection: 'row',
  },
  teammateCard: {
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 155,
  },
  teammateCardActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  teammateAvatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  teammateAvatar: {
    width: '100%',
    height: '100%',
  },
  teammateDetails: {
    justifyContent: 'center',
  },
  teammateUsername: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  teammateRiotIdText: {
    color: Colors.gray,
    fontSize: 11,
    marginTop: 1,
  },
  teammateTextActive: {
    color: Colors.text,
  },
  emptyTeammatesBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTeammatesText: {
    color: Colors.gray,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});

