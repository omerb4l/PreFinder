import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';
import { LobbyCard } from '@/components/LobbyCard';
import { CreateLobbyModal } from '@/components/CreateLobbyModal';
import { AnimatedTouchable } from '@/components/AnimatedTouchable';
import { Ionicons } from '@expo/vector-icons';
import { RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import ShinyText from '@/components/ShinyText';

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

  const [now, setNow] = useState(Date.now());
  const [themeMode, setThemeMode] = useState(getThemeMode());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000); // update every 30 seconds to refresh remaining times and filters
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = subscribeTheme((t) => setThemeMode(t));
    return () => unsub();
  }, []);
  
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

    const threeHoursAgo = now - 3 * 60 * 60 * 1000;
    const matchesTime = !lobby.createdAt || lobby.createdAt.toMillis() >= threeHoursAgo;
    
    return matchesMode && matchesRank && matchesTime;
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
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    const hasActiveLobby = lobbies.some(lobby => 
      lobby.creatorId === auth?.currentUser?.uid &&
      (!lobby.createdAt || lobby.createdAt.toMillis() >= threeHoursAgo)
    );
    
    if (hasActiveLobby) {
      const msg = "Zaten aktif bir lobiniz var. Yeni bir lobi kurmadan önce mevcut lobinizi kapatmalısınız.";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert("Hata", msg);
      return;
    }
    
    setIsModalOpen(true);
  };

  // Removed old FilterModal component

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
      createdAt={item.createdAt}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
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
            ListHeaderComponentStyle={{ zIndex: 100, elevation: 10 }}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {isWeb && (
                  <ShinyText
                    text="Aktif Lobiler"
                    style={styles.pageTitle}
                    speed={3}
                    delay={1.5}
                    color="#ECE8E1"
                    shineColor="#00FF87"
                  />
                )}
                {activeFilterModal !== null && (
                  <TouchableOpacity
                    style={styles.dropdownBackdrop}
                    activeOpacity={1}
                    onPress={() => setActiveFilterModal(null)}
                  />
                )}
                <View style={[styles.filtersRow, { zIndex: 10 }]}>
                  {/* Mode Filter Wrapper */}
                  <View style={{ position: 'relative', zIndex: activeFilterModal === 'mode' ? 20 : 1 }}>
                    <TouchableOpacity 
                      style={[styles.filterButton, activeFilterModal === 'mode' && styles.filterButtonActive]} 
                      onPress={() => setActiveFilterModal(activeFilterModal === 'mode' ? null : 'mode')}
                    >
                      <Text style={styles.filterButtonText}>{filterMode}</Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.gray} />
                    </TouchableOpacity>
                    {activeFilterModal === 'mode' && (
                      <View style={styles.dropdownMenu}>
                        <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {GAME_MODES.map((item) => {
                            const isSelected = filterMode === item;
                            return (
                              <TouchableOpacity
                                key={item}
                                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                onPress={() => {
                                  setFilterMode(item);
                                  setActiveFilterModal(null);
                                }}
                              >
                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>{item}</Text>
                                {isSelected && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Rank Filter Wrapper */}
                  <View style={{ position: 'relative', zIndex: activeFilterModal === 'rank' ? 20 : 1 }}>
                    <TouchableOpacity 
                      style={[styles.filterButton, activeFilterModal === 'rank' && styles.filterButtonActive]} 
                      onPress={() => setActiveFilterModal(activeFilterModal === 'rank' ? null : 'rank')}
                    >
                      <Text style={styles.filterButtonText}>{filterRank.label}</Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.gray} />
                    </TouchableOpacity>
                    {activeFilterModal === 'rank' && (
                      <View style={styles.dropdownMenu}>
                        <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {RANKS.map((item) => {
                            const isSelected = filterRank.value === item.value;
                            return (
                              <TouchableOpacity
                                key={item.value}
                                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                onPress={() => {
                                  setFilterRank(item);
                                  setActiveFilterModal(null);
                                }}
                              >
                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>{item.label}</Text>
                                {isSelected && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
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
    paddingBottom: 20,
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
  // Dropdown Styles
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    width: 220,
    maxHeight: 250,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: 238,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  dropdownItemText: {
    color: Colors.gray,
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  filterButtonActive: {
    borderColor: Colors.primary,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -3000,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
});
