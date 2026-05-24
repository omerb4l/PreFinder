import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Platform, useWindowDimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

interface MatchHistoryItem {
  id: string;
  lobbyId: string;
  leaderId: string;
  playerId: string;
  timestamp: any;
  leaderRated: boolean;
  playerRated: boolean;
}

interface MatchHistoryDetails extends MatchHistoryItem {
  teammateId: string;
  teammateName: string;
  teammatePhoto: string | null;
  teammateRiotId: string;
  isExpired: boolean;
  alreadyRated: boolean;
}

export default function PreviousPlayersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [matches, setMatches] = useState<MatchHistoryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingStates, setRatingStates] = useState<Record<string, { rating: number; note: string; submitting: boolean }>>({});

  const fetchMatchHistory = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Query 1: current user is the leader
      const qLeader = query(
        collection(db, 'match_history'),
        where('leaderId', '==', user.uid)
      );

      // Query 2: current user is the player
      const qPlayer = query(
        collection(db, 'match_history'),
        where('playerId', '==', user.uid)
      );

      const [snapLeader, snapPlayer] = await Promise.all([
        getDocs(qLeader),
        getDocs(qPlayer)
      ]);

      const rawMatches: MatchHistoryItem[] = [];
      
      snapLeader.forEach((doc) => {
        rawMatches.push({ id: doc.id, ...doc.data() } as MatchHistoryItem);
      });
      snapPlayer.forEach((doc) => {
        // Prevent duplicate push just in case leaderId == playerId (shouldn't happen)
        if (!rawMatches.some(m => m.id === doc.id)) {
          rawMatches.push({ id: doc.id, ...doc.data() } as MatchHistoryItem);
        }
      });

      // Sort by timestamp descending
      rawMatches.sort((a, b) => {
        const tA = a.timestamp?.toMillis() || 0;
        const tB = b.timestamp?.toMillis() || 0;
        return tB - tA;
      });

      // Fetch teammate details and compute metadata
      const enrichedMatchesPromises = rawMatches.map(async (match) => {
        const teammateId = user.uid === match.leaderId ? match.playerId : match.leaderId;
        let teammateName = 'Bilinmeyen Oyuncu';
        let teammatePhoto = null;
        let teammateRiotId = '';

        try {
          const teammateRef = doc(db, 'users', teammateId);
          const teammateSnap = await getDoc(teammateRef);
          if (teammateSnap.exists()) {
            const data = teammateSnap.data();
            teammateName = data.username || 'Bilinmeyen Oyuncu';
            teammatePhoto = data.profilePicBase64 || null;
            teammateRiotId = data.riotId || '';
          }
        } catch (err) {
          console.warn('Error fetching teammate profile:', err);
        }

        const matchTime = match.timestamp?.toMillis() || Date.now();
        const isExpired = Date.now() - matchTime > 24 * 60 * 60 * 1000;
        const alreadyRated = user.uid === match.leaderId ? match.leaderRated : match.playerRated;

        return {
          ...match,
          teammateId,
          teammateName,
          teammatePhoto,
          teammateRiotId,
          isExpired,
          alreadyRated
        };
      });

      const enrichedMatches = await Promise.all(enrichedMatchesPromises);
      setMatches(enrichedMatches);

      // Initialize rating input states
      const initialStates: typeof ratingStates = {};
      enrichedMatches.forEach(m => {
        if (!m.alreadyRated && !m.isExpired) {
          initialStates[m.id] = { rating: 5, note: '', submitting: false };
        }
      });
      setRatingStates(initialStates);

    } catch (error) {
      console.error('Error fetching match history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatchHistory();
  }, [fetchMatchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatchHistory();
  };

  const handleRateTeammate = async (matchId: string) => {
    const user = auth.currentUser;
    const state = ratingStates[matchId];
    if (!user || !state || state.submitting) return;

    // Set submitting
    setRatingStates(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], submitting: true }
    }));

    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      const isLeader = user.uid === match.leaderId;
      const teammateId = match.teammateId;

      // 1. Update rated status in match_history
      const matchRef = doc(db, 'match_history', matchId);
      if (isLeader) {
        await updateDoc(matchRef, {
          leaderRated: true,
          leaderRating: state.rating,
          leaderNote: state.note.trim()
        });
      } else {
        await updateDoc(matchRef, {
          playerRated: true,
          playerRating: state.rating,
          playerNote: state.note.trim()
        });
      }

      // 2. Fetch teammate profile to update stats & ratings
      const teammateRef = doc(db, 'users', teammateId);
      const teammateSnap = await getDoc(teammateRef);

      if (teammateSnap.exists()) {
        const tData = teammateSnap.data();
        const currentCount = tData.ratingCount || 0;
        const currentRating = tData.rating || 5.0;
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount + state.rating) / newCount).toFixed(1);

        await updateDoc(teammateRef, {
          rating: parseFloat(newRating),
          ratingCount: newCount
        });
      }

      // 3. Auto-report trigger if low rating or toxic comments
      const trimmedNote = state.note.trim();
      const isNegativeText = trimmedNote.toLowerCase().includes('toksik') || 
                            trimmedNote.toLowerCase().includes('küfür') || 
                            trimmedNote.toLowerCase().includes('troll') || 
                            trimmedNote.toLowerCase().includes('feed');

      if (state.rating <= 2 || isNegativeText) {
        await addDoc(collection(db, 'reports'), {
          reporterId: user.uid,
          reportedRiotId: match.teammateRiotId || match.teammateName,
          reason: state.rating <= 2 ? "Düşük Puanlı Oyuncu Değerlendirmesi" : "Değerlendirme Şikayeti (Yazılı)",
          description: trimmedNote || `${state.rating} Yıldız Değerlendirmesi`,
          videoLink: "",
          evidenceImageBase64: null,
          status: 'pending',
          timestamp: serverTimestamp(),
        });
      }

      if (Platform.OS === 'web') {
        window.alert('Değerlendirmeniz başarıyla kaydedildi.');
      }

      // Update state locally to hide rating inputs
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, alreadyRated: true } : m));

    } catch (error) {
      console.error('Error submitting teammate rating:', error);
      if (Platform.OS === 'web') {
        window.alert('Değerlendirme kaydedilirken bir hata oluştu.');
      }
    } finally {
      setRatingStates(prev => ({
        ...prev,
        [matchId]: { ...prev[matchId], submitting: false }
      }));
    }
  };

  const handleStarSelect = (matchId: string, starRating: number) => {
    setRatingStates(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], rating: starRating }
    }));
  };

  const handleNoteChange = (matchId: string, text: string) => {
    setRatingStates(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], note: text }
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isWeb && styles.webContainer]}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Önceki Oynanan Kişiler</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.gray} />
              <Text style={styles.emptyText}>Henüz doğrulanmış bir karşılaşma geçmişiniz yok.</Text>
            </View>
          ) : (
            matches.map((item) => {
              const state = ratingStates[item.id] || { rating: 5, note: '', submitting: false };
              const matchDate = item.timestamp?.toDate() 
                ? item.timestamp.toDate().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Bilinmiyor';

              return (
                <View key={item.id} style={styles.matchCard}>
                  
                  {/* Card Header: Teammate Profile Info */}
                  <View style={styles.cardHeader}>
                    <View style={styles.teammateInfo}>
                      <View style={styles.avatarWrapper}>
                        {item.teammatePhoto ? (
                          <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.teammatePhoto}` }} 
                            style={styles.avatar} 
                          />
                        ) : (
                          <Ionicons name="person" size={24} color={Colors.gray} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.teammateName}>{item.teammateRiotId || item.teammateName}</Text>
                        <Text style={styles.matchDate}>{matchDate}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Rating / Expired Content Block */}
                  {item.alreadyRated ? (
                    <View style={styles.feedbackContainer}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
                      <Text style={styles.ratedText}>Bu karşılaşmayı zaten değerlendirdiniz.</Text>
                    </View>
                  ) : item.isExpired ? (
                    <View style={styles.feedbackContainer}>
                      <Ionicons name="time-outline" size={18} color={Colors.gray} />
                      <Text style={styles.expiredText}>Bu karşılaşmanın değerlendirme süresi (24 saat) dolmuştur.</Text>
                    </View>
                  ) : (
                    <View style={styles.ratingForm}>
                      <Text style={styles.sectionLabel}>Bu oyuncuyu değerlendirin:</Text>
                      
                      {/* Clickable Star row */}
                      <View style={styles.starRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity 
                            key={star} 
                            onPress={() => handleStarSelect(item.id, star)}
                            style={styles.starIcon}
                          >
                            <Ionicons 
                              name={star <= state.rating ? "star" : "star-outline"} 
                              size={28} 
                              color={star <= state.rating ? "#FFD700" : Colors.gray} 
                            />
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Optional Note Text Input */}
                      <TextInput
                        style={styles.textInput}
                        placeholder="Örn: Çok iyi oynadı, cana yakındı veya toksik davrandı..."
                        placeholderTextColor={Colors.gray}
                        value={state.note}
                        onChangeText={(text) => handleNoteChange(item.id, text)}
                        multiline
                        maxLength={150}
                      />

                      {/* Submit Button */}
                      <TouchableOpacity 
                        style={[styles.submitBtn, state.rating <= 2 && styles.negativeSubmitBtn]}
                        onPress={() => handleRateTeammate(item.id)}
                        disabled={state.submitting}
                      >
                        {state.submitting ? (
                          <ActivityIndicator size="small" color="#0F1923" />
                        ) : (
                          <>
                            <Ionicons name="shield-checkmark" size={16} color="#0F1923" />
                            <Text style={styles.submitBtnText}>Değerlendir ve Raporla</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                </View>
              );
            })
          )}
        </ScrollView>
      </View>
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
  webContainer: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  teammateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F1923',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  teammateName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  matchDate: {
    color: Colors.gray,
    fontSize: 12,
    marginTop: 2,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  ratedText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  expiredText: {
    color: Colors.gray,
    fontSize: 13,
    fontWeight: '600',
  },
  ratingForm: {
    backgroundColor: 'rgba(15, 25, 35, 0.4)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  sectionLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 14,
  },
  starIcon: {
    padding: 4,
  },
  textInput: {
    backgroundColor: '#0F1923',
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 13,
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  negativeSubmitBtn: {
    backgroundColor: Colors.danger,
  },
  submitBtnText: {
    color: '#0F1923',
    fontSize: 13,
    fontWeight: '900',
  },
});
