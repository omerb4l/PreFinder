import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Image, Alert, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';
import { VALORANT_RANKS, RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

// Order matters: index 0 = lowest, 8 = highest
const RANK_KEYS: RankType[] = [
  'iron', 'bronze', 'silver', 'gold', 'platinum',
  'diamond', 'ascendant', 'immortal', 'radiant'
];
const RANK_ORDER: Record<RankType, number> = Object.fromEntries(
  RANK_KEYS.map((k, i) => [k, i])
) as Record<RankType, number>;

interface CreateLobbyModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const ROLES = [
  { id: 'entry', name: 'Düellocu (Entry)', icon: 'flash' },
  { id: 'sentinel', name: 'Gözcü (Sentinel)', icon: 'shield-checkmark' },
  { id: 'initiator', name: 'Öncü (Initiator)', icon: 'eye' },
  { id: 'smoke', name: 'Kontrol Uzmanı (Smoke)', icon: 'cloud' },
  { id: 'any', name: 'Farketmez (Any)', icon: 'help-circle' },
];

const GAME_MODES = [
  "Rekabete Dayalı",
  "Derecesiz",
  "Tam Gaz",
  "Ölüm Kalım Savaşı",
  "Prömiyer"
];

export const CreateLobbyModal = ({ isVisible, onClose }: CreateLobbyModalProps) => {
  const [gameMode, setGameMode] = useState("Rekabete Dayalı");
  const [missingCount, setMissingCount] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['any']);
  const [description, setDescription] = useState('');
  const [minRank, setMinRank] = useState<RankType>('platinum');
  const [maxRank, setMaxRank] = useState<RankType>('diamond');
  const [partyCode, setPartyCode] = useState('');
  const [activePicker, setActivePicker] = useState<'min' | 'max' | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const increment = () => { if (missingCount < 4) setMissingCount(p => p + 1); };
  const decrement = () => { if (missingCount > 1) setMissingCount(p => p - 1); };

  const toggleRole = (roleId: string) => {
    if (roleId === 'any') { setSelectedRoles(['any']); return; }
    setSelectedRoles(prev => {
      let next = prev.filter(r => r !== 'any');
      if (next.includes(roleId)) {
        next = next.filter(r => r !== roleId);
        return next.length === 0 ? ['any'] : next;
      }
      return [...next, roleId];
    });
  };

  const selectRank = (key: RankType) => {
    if (activePicker === 'min') {
      setMinRank(key);
      // If new min > current max, bump max up to same level
      if (RANK_ORDER[key] > RANK_ORDER[maxRank]) setMaxRank(key);
    } else {
      setMaxRank(key);
      // If new max < current min, push min down to same level
      if (RANK_ORDER[key] < RANK_ORDER[minRank]) setMinRank(key);
    }
    setActivePicker(null);
  };

  const handlePublish = async () => {
    setErrorMsg('');
    const user = auth.currentUser;
    if (!user) {
      setErrorMsg('Lobi oluşturmak için giriş yapmalısınız.');
      return;
    }

    setPublishing(true);
    try {
      // Check user verificationStatus
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData.verificationStatus !== 'verified') {
          setPublishing(false);
          const alertMsg = "Lobi kurmak için hesabınızın admin tarafından onaylanması gerekmektedir.";
          if (Platform.OS === 'web') {
            window.alert(alertMsg);
          } else {
            Alert.alert("Hata", alertMsg);
          }
          return;
        }
      }

      await addDoc(collection(db, 'lobbies'), {
        creatorId: user.uid,
        gameMode,
        missingPlayers: missingCount,
        roles: selectedRoles,
        minRank,
        maxRank,
        partyCode: partyCode.trim(),
        description: description.trim(),
        status: 'active',
        createdAt: serverTimestamp(),
      });
      // Reset form and close
      setGameMode("Rekabete Dayalı");
      setMissingCount(1);
      setSelectedRoles(['any']);
      setDescription('');
      setMinRank('platinum');
      setMaxRank('diamond');
      setPartyCode('');
      onClose();
    } catch (error: any) {
      setErrorMsg('Lobi oluşturulamadı. Lütfen tekrar deneyin.');
      console.error('Lobby creation error:', error);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Dim overlay — tapping it closes picker OR main modal */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => {
          if (activePicker) setActivePicker(null);
          else onClose();
        }}
      >
        {/* Main card — stops tap propagation */}
        <TouchableOpacity activeOpacity={1} style={styles.container}>

          <View style={styles.header}>
            <Text style={styles.title}>Yeni Lobi Oluştur</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* ---- RANK PICKER OVERLAY (absolute, covers entire card) ---- */}
          {activePicker && (
            <View style={styles.rankPickerOverlay}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {activePicker === 'min' ? 'Minimum Rütbe' : 'Maximum Rütbe'}
                </Text>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <Ionicons name="close" size={20} color={Colors.gray} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {RANK_KEYS.map((key) => {
                  const rank = VALORANT_RANKS[key];
                  const isSelected = (activePicker === 'min' ? minRank : maxRank) === key;
                  // Disable ranks that would make range invalid
                  const isDisabled =
                    activePicker === 'min'
                      ? RANK_ORDER[key] > RANK_ORDER[maxRank]   // min can't exceed max
                      : RANK_ORDER[key] < RANK_ORDER[minRank];  // max can't go below min
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.rankOption,
                        isSelected && styles.rankOptionSelected,
                        isDisabled && styles.rankOptionDisabled,
                      ]}
                      onPress={() => !isDisabled && selectRank(key)}
                      activeOpacity={isDisabled ? 1 : 0.7}
                    >
                      <Image
                        source={rank.icon}
                        style={[styles.rankOptionIcon, isDisabled && { opacity: 0.3 }]}
                      />
                      <Text style={[
                        styles.rankOptionText,
                        isSelected && styles.rankOptionTextSelected,
                        isDisabled && styles.rankOptionTextDisabled,
                      ]}>
                        {rank.name}
                      </Text>
                      {isSelected && !isDisabled && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                      )}
                      {isDisabled && (
                        <Ionicons name="ban" size={14} color="rgba(255,255,255,0.15)" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ---- MAIN FORM (hidden behind picker when open) ---- */}
          {!activePicker && (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              {/* Game Mode Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Oyun Modu</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroll}>
                  {GAME_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeBadge, gameMode === mode && styles.modeBadgeActive]}
                      onPress={() => setGameMode(mode)}
                    >
                      <Text style={[styles.modeBadgeText, gameMode === mode && styles.modeBadgeTextActive]}>
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Player Count */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Eksik Kişi Sayısı</Text>
                <View style={styles.counterRow}>
                  <TouchableOpacity onPress={decrement} style={styles.counterBtn}>
                    <Ionicons name="remove" size={20} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{missingCount}</Text>
                  <TouchableOpacity onPress={increment} style={styles.counterBtn}>
                    <Ionicons name="add" size={20} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Role Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Aranan Rol</Text>
                <View style={styles.rolesGrid}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleBadge, selectedRoles.includes(role.id) && styles.roleBadgeActive]}
                      onPress={() => toggleRole(role.id)}
                    >
                      <Ionicons
                        name={role.icon as any}
                        size={14}
                        color={selectedRoles.includes(role.id) ? '#0F1923' : Colors.gray}
                      />
                      <Text style={[styles.roleBadgeText, selectedRoles.includes(role.id) && styles.roleBadgeTextActive]}>
                        {role.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Oda Açıklaması</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Örn: Sadece mikrofonu olanlar gelsin, chill oyun."
                  placeholderTextColor={Colors.gray}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Rank Range */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rank Aralığı</Text>
                <View style={styles.rankRow}>
                  <TouchableOpacity
                    style={styles.rankSelectorBtn}
                    onPress={() => setActivePicker('min')}
                    activeOpacity={0.7}
                  >
                    <Image source={VALORANT_RANKS[minRank].icon} style={styles.rankSelectorIcon} />
                    <Text style={styles.rankSelectorText}>{VALORANT_RANKS[minRank].name}</Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.gray} />
                  </TouchableOpacity>

                  <Ionicons name="arrow-forward" size={16} color={Colors.gray} />

                  <TouchableOpacity
                    style={styles.rankSelectorBtn}
                    onPress={() => setActivePicker('max')}
                    activeOpacity={0.7}
                  >
                    <Image source={VALORANT_RANKS[maxRank].icon} style={styles.rankSelectorIcon} />
                    <Text style={styles.rankSelectorText}>{VALORANT_RANKS[maxRank].name}</Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.gray} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Party Code */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Party Kodu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Giriş Kodu"
                  placeholderTextColor={Colors.gray}
                  value={partyCode}
                  onChangeText={setPartyCode}
                />
                <Text style={styles.infoText}>Bu kod sadece kabul ettiğiniz oyunculara gösterilir.</Text>
              </View>

              <View style={styles.footer}>
                {errorMsg !== '' && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠ {errorMsg}</Text>
                  </View>
                )}
                <PrimaryButton title="İlanı Yayınla" onPress={handlePublish} loading={publishing} />
                <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>İptal Et</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 35, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: { padding: 4 },

  // ---- Rank Picker Overlay (in-card) ----
  rankPickerOverlay: {
    flex: 1,
    minHeight: 300,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  pickerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0F1923',
    gap: 12,
    marginBottom: 6,
  },
  rankOptionSelected: {
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rankOptionIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  rankOptionText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  rankOptionTextSelected: { color: Colors.primary },
  rankOptionDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rankOptionTextDisabled: {
    color: 'rgba(255,255,255,0.2)',
  },

  // ---- Form styles ----
  inputGroup: { marginBottom: 20 },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modeScroll: {
    gap: 8,
    paddingRight: 20,
  },
  modeBadge: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modeBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBadgeText: {
    color: Colors.gray,
    fontSize: 13,
    fontWeight: '700',
  },
  modeBadgeTextActive: {
    color: '#0F1923',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1923',
    borderRadius: 8,
    alignSelf: 'flex-start',
    padding: 4,
  },
  counterBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1923',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  roleBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleBadgeText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadgeTextActive: { color: '#0F1923' },
  input: {
    backgroundColor: '#0F1923',
    color: Colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1923',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  rankSelectorIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  rankSelectorText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  infoText: {
    color: Colors.gray,
    fontSize: 12,
    marginTop: 6,
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 70, 85, 0.12)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: '100%',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
