import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { LobbyCard } from '@/components/LobbyCard';
import { CreateLobbyModal } from '@/components/CreateLobbyModal';
import { AnimatedTouchable } from '@/components/AnimatedTouchable';
import { Ionicons } from '@expo/vector-icons';
import { RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Lobby {
  id: string;
  creatorId: string;
  gameMode: string;
  missingPlayers: number;
  roles: string[];
  minRank: RankType;
  maxRank: RankType;
  description: string;
  partyCode: string;
  status: string;
  createdAt: any;
}

const GAME_MODES = ["Tüm Modlar", "Rekabete Dayalı", "Derecesiz", "Tam Gaz", "Ölüm Kalım Savaşı", "Prömiyer"];
const RANKS = [
  { label: "Tüm Ranklar", value: "all" },
  { label: "Iron", value: "iron" },
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Platinum", value: "platinum" },
  { label: "Diamond", value: "diamond" },
  { label: "Ascendant", value: "ascendant" },
  { label: "Immortal", value: "immortal" },
  { label: "Radiant", value: "radiant" },
];

const RANK_WEIGHTS: Record<string, number> = {
  'iron': 1, 'bronze': 2, 'silver': 3, 'gold': 4, 'platinum': 5,
  'diamond': 6, 'ascendant': 7, 'immortal': 8, 'radiant': 9, 'all': 0
};

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const isMobile = width < 768;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterMode, setFilterMode] = useState("Tüm Modlar");
  const [filterRank, setFilterRank] = useState(RANKS[0]);
  const [activeFilterModal, setActiveFilterModal] = useState<'mode' | 'rank' | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'lobbies'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Lobby[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Lobby));
      
      data.sort((a, b) => {
        const tA = a.createdAt?.toMillis() || 0;
        const tB = b.createdAt?.toMillis() || 0;
        return tB - tA;
      });

      setLobbies(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore onSnapshot error:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredLobbies = lobbies.filter(lobby => {
    const matchesMode = filterMode === "Tüm Modlar" || lobby.gameMode === filterMode;
    
    let matchesRank = true;
    if (filterRank.value !== "all") {
      const fWeight = RANK_WEIGHTS[filterRank.value];
      const minWeight = RANK_WEIGHTS[lobby.minRank] || 0;
      const maxWeight = RANK_WEIGHTS[lobby.maxRank] || 0;
      matchesRank = fWeight >= minWeight && fWeight <= maxWeight;
    }
    
    return matchesMode && matchesRank;
  }).sort((a, b) => {
    // Pin user's own lobby to top
    const isAUser = a.creatorId === auth?.currentUser?.uid;
    const isBUser = b.creatorId === auth?.currentUser?.uid;
    if (isAUser && !isBUser) return -1;
    if (!isAUser && isBUser) return 1;
    
    // Otherwise sort by time (newest first)
    const tA = a.createdAt?.toMillis() || 0;
    const tB = b.createdAt?.toMillis() || 0;
    return tB - tA;
  });

  const handleOpenCreateModal = () => {
    const hasActiveLobby = lobbies.some(lobby => lobby.creatorId === auth?.currentUser?.uid);
    
    if (hasActiveLobby) {
      const msg = "Zaten aktif bir lobiniz var. Yeni bir lobi kurmadan önce mevcut lobinizi kapatmalısınız.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert("Hata", msg);
      return;
    }
    
    setIsModalOpen(true);
  };

  const FilterModal = () => (
    <Modal visible={activeFilterModal !== null} transparent animationType="fade" onRequestClose={() => setActiveFilterModal(null)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveFilterModal(null)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {activeFilterModal === 'mode' ? 'Mod Seçin' : 'Rank Seçin'}
          </Text>
          <ScrollView>
            {(activeFilterModal === 'mode' ? GAME_MODES : RANKS).map((item: any) => {
              const label = typeof item === 'string' ? item : item.label;
              const isSelected = activeFilterModal === 'mode' ? filterMode === item : filterRank.value === item.value;
              
              return (
                <TouchableOpacity 
                  key={label} 
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    if (activeFilterModal === 'mode') setFilterMode(item);
                    else setFilterRank(item);
                    setActiveFilterModal(null);
                  }}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{label}</Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={48} color={Colors.gray} />
      <Text style={styles.emptyTitle}>Aktif lobi bulunamadı</Text>
      <Text style={styles.emptySubtitle}>Filtreleri değiştirmeyi veya yeni lobi oluşturmayı dene!</Text>
    </View>
  );

  const renderLobby = ({ item, index }: { item: Lobby; index: number }) => (
    <LobbyCard
      lobbyId={item.id}
      creatorId={item.creatorId}
      gameMode={item.gameMode}
      missingPlayers={`+${item.missingPlayers} Kişi`}
      roleInfo={item.roles.join(', ')}
      minRank={item.minRank}
      maxRank={item.maxRank}
      description={item.description}
      rating="4.8"
      index={index}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Lobiler yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredLobbies}
            keyExtractor={(item) => item.id}
            renderItem={renderLobby}
            ListEmptyComponent={renderEmpty}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {isWeb && <Text style={styles.pageTitle}>Aktif Lobiler</Text>}
                <View style={styles.filtersRow}>
                  <TouchableOpacity style={styles.filterButton} onPress={() => setActiveFilterModal('mode')}>
                    <Text style={styles.filterButtonText}>{filterMode}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.gray} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterButton} onPress={() => setActiveFilterModal('rank')}>
                    <Text style={styles.filterButtonText}>{filterRank.label}</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.gray} />
                  </TouchableOpacity>
                </View>
              </View>
            }
            contentContainerStyle={[
              styles.contentPadding,
              isWeb && styles.webContentPadding,
              lobbies.length === 0 && styles.emptyFlex,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Action Button — Desktop only */}
        {!isMobile && (
          <AnimatedTouchable
            style={styles.fab}
            onPress={handleOpenCreateModal}
          >
            <Text style={styles.fabText}>+ LOBİ OLUŞTUR</Text>
          </AnimatedTouchable>
        )}

        <CreateLobbyModal isVisible={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <FilterModal />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.gray,
    fontSize: 14,
  },
  listHeader: {
    marginBottom: 8,
  },
  contentPadding: {
    padding: 20,
    paddingBottom: 120,
  },
  webContentPadding: {
    paddingHorizontal: '15%',
    paddingTop: 40,
  },
  emptyFlex: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.gray,
    fontSize: 14,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 100,
  },
  fabText: {
    color: '#0F1923',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4655',
    borderWidth: 2,
    borderColor: '#0F1923', // Match background color
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalItemSelected: {
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  modalItemText: {
    color: Colors.gray,
    fontSize: 15,
    fontWeight: '600',
  },
  modalItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
