import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Modal, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthCard } from '@/components/AuthCard';
import { CustomTextInput } from '@/components/CustomTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { VALORANT_RANKS, RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

const ROLES = [
  { id: 'Düellocu', name: 'Düellocu' },
  { id: 'Gözcü', name: 'Gözcü' },
  { id: 'Öncü', name: 'Öncü' },
  { id: 'Kontrol Uzmanı', name: 'Kontrol Uzmanı' },
];

const RANK_KEYS: RankType[] = [
  'iron', 'bronze', 'silver', 'gold', 'platinum',
  'diamond', 'ascendant', 'immortal', 'radiant'
];

export default function VerificationScreen() {
  const [riotId, setRiotId] = useState('');
  const [selectedRank, setSelectedRank] = useState<RankType>('platinum');
  const [mainRoles, setMainRoles] = useState<string[]>([]);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [profilePicBase64, setProfilePicBase64] = useState<string | null>(null);
  const [verificationPicUri, setVerificationPicUri] = useState<string | null>(null);
  const [verificationPicBase64, setVerificationPicBase64] = useState<string | null>(null);
  const [isRankModalVisible, setIsRankModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      // Lazy load Alert to avoid web issues
      const { Alert } = require('react-native');
      Alert.alert(title, message);
    }
  };

  const pickProfilePic = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('İzin Gerekli', 'Galeri izni verilmedi.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.1, // Base64 için küçük boyut
      base64: true,
    });

    if (!result.canceled) {
      setProfilePicUri(result.assets[0].uri);
      setProfilePicBase64(result.assets[0].base64 || null);
    }
  };

  const pickVerificationPic = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('İzin Gerekli', 'Galeri izni verilmedi.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setVerificationPicUri(result.assets[0].uri);
      setVerificationPicBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const toggleRole = (role: string) => {
    setMainRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!riotId.trim()) {
      showAlert('Hata', 'Lütfen Riot ID giriniz.');
      return;
    }
    
    if (!verificationPicBase64) {
      showAlert('Hata', 'Lütfen rütbenizi kanıtlayan bir ekran görüntüsü yükleyin.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showAlert('Hata', 'Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        riotId: riotId.trim(),
        rank: selectedRank,
        mainAgents: mainRoles,
        profilePicBase64: profilePicBase64 || null,
        verificationStatus: 'pending',
        rankProofImageUrl: verificationPicBase64,
        rankSubmitted: selectedRank
      });
      
      showAlert('Başarılı', 'Profiliniz ve rütbe kanıtınız başarıyla gönderildi! Lobi kurabilmek ve katılabilmek için admin onayını bekleyiniz.');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Submit Error:', error);
      showAlert('Hata', error.message || 'Bilgiler kaydedilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <AuthCard>
          <View style={styles.header}>
            <Text style={styles.title}>Hesap Doğrulama</Text>
            <Text style={styles.subtitle}>
              Lobilere katılmak için Riot hesabınızı ve rütbenizi doğrulayın.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Profile Avatar Picker */}
            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickProfilePic} activeOpacity={0.8}>
                {profilePicUri ? (
                  <Image source={{ uri: profilePicUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.gray} />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="add" size={16} color="#0F1923" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarText}>Profil Fotoğrafı Ekle</Text>
            </View>

            <CustomTextInput
              label="Riot ID"
              placeholder="OyuncuAdı#TR1"
              value={riotId}
              onChangeText={setRiotId}
            />

            {/* Rank Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rütbe Seç</Text>
              <TouchableOpacity 
                style={styles.selector} 
                activeOpacity={0.7}
                onPress={() => setIsRankModalVisible(true)}
              >
                <View style={styles.selectorContent}>
                  <Image source={VALORANT_RANKS[selectedRank].icon} style={styles.selectedRankIcon} />
                  <Text style={styles.selectorText}>{VALORANT_RANKS[selectedRank].name}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>

            {/* Main Roles Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Main Roller</Text>
              <View style={styles.rolesContainer}>
                {ROLES.map((role) => {
                  const isActive = mainRoles.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleBadge, isActive && styles.roleBadgeActive]}
                      onPress={() => toggleRole(role.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.roleBadgeText, isActive && styles.roleBadgeTextActive]}>
                        {role.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Verification Image Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Doğrulama Kanıtı</Text>
              <TouchableOpacity style={styles.uploadArea} activeOpacity={0.7} onPress={pickVerificationPic}>
                {verificationPicUri ? (
                  <Image source={{ uri: verificationPicUri }} style={styles.verificationImage} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={40} color={Colors.gray} />
                    <Text style={styles.uploadText}>Oyun İçi Ekran Görüntüsü Yükle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.spacer} />

            <PrimaryButton 
              title="Kaydet ve Devam Et" 
              onPress={handleSubmit} 
              loading={loading}
            />
          </View>
        </AuthCard>
      </ScrollView>

      {/* Rank Picker Modal */}
      <Modal
        visible={isRankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRankModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsRankModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rütbeni Seç</Text>
              <TouchableOpacity onPress={() => setIsRankModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.gray} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.ranksGrid}>
              {RANK_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.rankItem, selectedRank === key && styles.rankItemActive]}
                  onPress={() => {
                    setSelectedRank(key);
                    setIsRankModalVisible(false);
                  }}
                >
                  <Image source={VALORANT_RANKS[key].icon} style={styles.modalRankIcon} />
                  <Text style={[styles.modalRankName, selectedRank === key && styles.modalRankNameActive]}>
                    {VALORANT_RANKS[key].name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    marginBottom: 24,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    position: 'relative',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F1923',
  },
  avatarText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  selector: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedRankIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  selectorText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    backgroundColor: '#1F2326',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  roleBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleBadgeText: {
    color: '#ECE8E1',
    fontSize: 14,
    fontWeight: '600',
  },
  roleBadgeTextActive: {
    color: '#0F1923',
  },
  uploadArea: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(31, 35, 38, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadText: {
    color: Colors.gray,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  verificationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  spacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 35, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  ranksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 40,
  },
  rankItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
  },
  rankItemActive: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    borderColor: Colors.primary,
  },
  modalRankIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  modalRankName: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalRankNameActive: {
    color: Colors.primary,
  },
});
