import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
}

const REASONS = [
  "AFK / Oyundan Çıkma",
  "Küfür / Toksik Davranış",
  "Trol / Sabotaj",
  "Hile Kullanımı",
  "Sahte Rütbe / Smurf",
  "Uygunsuz Profil / İsim",
  "Diğer"
];

export const ReportModal = ({ visible, onClose, reportedUserId }: ReportModalProps) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [reportedRiotId, setReportedRiotId] = useState('');
  const [reportedUsername, setReportedUsername] = useState('Yükleniyor...');
  const [loadingUser, setLoadingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !reportedUserId) return;

    const fetchReportedUserData = async () => {
      setLoadingUser(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', reportedUserId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setReportedRiotId(data.riotId || '');
          setReportedUsername(data.username || 'Bilinmeyen Oyuncu');
        } else {
          setReportedUsername('Bilinmeyen Oyuncu');
        }
      } catch (error) {
        console.error('Error fetching reported user in modal:', error);
        setReportedUsername('Bilinmeyen Oyuncu');
      } finally {
        setLoadingUser(false);
      }
    };

    fetchReportedUserData();
  }, [visible, reportedUserId]);

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      if (Platform.OS === 'web') window.alert('Şikayet etmek için giriş yapmalısınız.');
      else Alert.alert('Hata', 'Şikayet etmek için giriş yapmalısınız.');
      return;
    }

    if (!selectedReason) {
      if (Platform.OS === 'web') window.alert('Lütfen bir şikayet nedeni seçin.');
      else Alert.alert('Hata', 'Lütfen bir şikayet nedeni seçin.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reportedRiotId: reportedRiotId || reportedUsername,
        reason: selectedReason,
        description: explanation.trim(),
        videoLink: '',
        evidenceImageBase64: null,
        status: 'pending',
        timestamp: serverTimestamp(),
      });

      const msg = 'Şikayetiniz başarıyla alındı. Teşekkür ederiz.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Başarılı', msg);

      // Reset & Close
      setSelectedReason('');
      setExplanation('');
      onClose();
    } catch (error) {
      console.error('Error submitting report from modal:', error);
      const errMsg = 'Şikayet gönderilirken bir sorun oluştu.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Hata', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity activeOpacity={1} style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="alert-circle-outline" size={22} color={Colors.danger} />
                <Text style={styles.title}>Oyuncuyu Bildir</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={submitting}>
                <Ionicons name="close" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Bildirilen Oyuncu:</Text>
                {loadingUser ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <Text style={styles.infoValue}>{reportedRiotId || reportedUsername}</Text>
                )}
              </View>

              <Text style={styles.sectionLabel}>Şikayet Nedeni Seçin</Text>
              <View style={styles.reasonsGrid}>
                {REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonBadge,
                      selectedReason === reason && styles.reasonBadgeActive
                    ]}
                    onPress={() => setSelectedReason(reason)}
                    disabled={submitting}
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

              <Text style={styles.sectionLabel}>Ek Açıklama</Text>
              <TextInput
                style={styles.input}
                placeholder="Neler olduğunu kısaca detaylandırın..."
                placeholderTextColor={Colors.gray}
                value={explanation}
                onChangeText={setExplanation}
                multiline
                numberOfLines={3}
                disabled={submitting}
              />

              <TouchableOpacity 
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.text} />
                ) : (
                  <Text style={styles.submitBtnText}>Şikayeti Gönder</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    maxHeight: 550,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0F1923',
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  scrollBody: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#0F1923',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  reasonsGrid: {
    gap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  reasonBadge: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reasonBadgeActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  reasonText: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '700',
  },
  reasonTextActive: {
    color: Colors.text,
  },
  input: {
    backgroundColor: '#0F1923',
    color: Colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 70,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  submitBtn: {
    backgroundColor: Colors.danger,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
