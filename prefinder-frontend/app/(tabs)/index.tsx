import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { LobbyCard } from '@/components/LobbyCard';
import { CreateLobbyModal } from '@/components/CreateLobbyModal';
import { Ionicons } from '@expo/vector-icons';
import { RankType } from '@/constants/ranks';
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface Lobby {
  id: string;
  creatorId: string;
  missingPlayers: number;
  roles: string[];
  minRank: RankType;
  maxRank: RankType;
  description: string;
  partyCode: string;
  status: string;
  createdAt: any;
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const isMobile = width < 768;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time Firestore listener: only active lobbies
    const q = query(
      collection(db, 'lobbies'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Lobby[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Lobby));
      
      // Client-side sort to avoid Firestore composite index requirement
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

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={48} color={Colors.gray} />
      <Text style={styles.emptyTitle}>Aktif lobi bulunamadı</Text>
      <Text style={styles.emptySubtitle}>İlk lobiyi sen oluştur!</Text>
    </View>
  );

  const renderLobby = ({ item }: { item: Lobby }) => (
    <LobbyCard
      lobbyId={item.id}
      creatorId={item.creatorId}
      missingPlayers={`+${item.missingPlayers} Kişi`}
      roleInfo={item.roles.join(', ')}
      minRank={item.minRank}
      maxRank={item.maxRank}
      description={item.description}
      rating="4.8"
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
            data={lobbies}
            keyExtractor={(item) => item.id}
            renderItem={renderLobby}
            ListEmptyComponent={renderEmpty}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {isWeb && <Text style={styles.pageTitle}>Aktif Lobiler</Text>}
                <View style={styles.filtersRow}>
                  <TouchableOpacity style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Tüm Modlar</Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.gray} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Rank Filtresi</Text>
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
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.9}
            onPress={() => setIsModalOpen(true)}
          >
            <Text style={styles.fabText}>+ LOBİ OLUŞTUR</Text>
          </TouchableOpacity>
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
});
