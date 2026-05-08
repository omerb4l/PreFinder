import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { CustomTextInput } from './CustomTextInput';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  userData: any;
}

const ROLES = [
  { id: 'Duelist', name: 'Düellocu' },
  { id: 'Sentinel', name: 'Gözcü' },
  { id: 'Initiator', name: 'Öncü' },
  { id: 'Controller', name: 'Kontrol Uzmanı' },
];

export const EditProfileModal = ({ isVisible, onClose, userData }: EditProfileModalProps) => {
  const [username, setUsername] = useState(userData?.username || '');
  const [bio, setBio] = useState(userData?.bio || '');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(userData?.mainAgents || []);
  const [base64Image, setBase64Image] = useState<string | null>(userData?.profilePicBase64 || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setUsername(userData?.username || '');
      setBio(userData?.bio || '');
      setSelectedAgents(userData?.mainAgents || []);
      setBase64Image(userData?.profilePicBase64 || null);
    }
  }, [isVisible, userData]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri izni verilmedi.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.1, // Keep size under 1MB
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setBase64Image(result.assets[0].base64);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]
    );
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!username.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı boş olamaz.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        bio: bio.trim(),
        mainAgents: selectedAgents,
        profilePicBase64: base64Image,
      });
      Alert.alert('Başarılı', 'Profiliniz güncellendi.');
      onClose();
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Hata', 'Profil güncellenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Profili Düzenle</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar Selection */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={pickImage} style={styles.avatarPicker}>
                {base64Image ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${base64Image}` }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.gray} />
                  </View>
                )}
                <View style={styles.editIconBadge}>
                  <Ionicons name="pencil" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>Fotoğrafı Değiştirmek İçin Dokun</Text>
            </View>

            <CustomTextInput
              label="Kullanıcı Adı"
              value={username}
              onChangeText={setUsername}
              placeholder="Kullanıcı adınız"
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Biyografi</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Kendinden bahset..."
                placeholderTextColor={Colors.gray}
                multiline
                maxLength={100}
              />
              <Text style={styles.charCount}>{bio.length}/100</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ana Roller</Text>
              <View style={styles.agentsGrid}>
                {ROLES.map(role => (
                  <TouchableOpacity
                    key={role.id}
                    style={[styles.agentChip, selectedAgents.includes(role.id) && styles.agentChipActive]}
                    onPress={() => toggleAgent(role.id)}
                  >
                    <Text style={[styles.agentChipText, selectedAgents.includes(role.id) && styles.agentChipTextActive]}>
                      {role.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <PrimaryButton title="Kaydet" onPress={handleSave} loading={loading} />
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 25, 35, 0.9)', justifyContent: 'flex-end' },
  container: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarPicker: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0F1923', borderWidth: 2, borderColor: Colors.primary, position: 'relative', overflow: 'visible' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.surface },
  avatarHint: { color: Colors.gray, fontSize: 12, marginTop: 8 },
  inputGroup: { marginBottom: 20 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#0F1923', color: Colors.text, padding: 12, borderRadius: 8, fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: { color: Colors.gray, fontSize: 10, textAlign: 'right', marginTop: 4 },
  agentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  agentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0F1923', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  agentChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  agentChipText: { color: Colors.gray, fontSize: 12, fontWeight: '700' },
  agentChipTextActive: { color: '#0F1923' },
  footer: { marginTop: 12, gap: 12 },
  cancelBtn: { padding: 12, alignItems: 'center' },
  cancelText: { color: Colors.gray, fontSize: 14, fontWeight: '600' },
});
