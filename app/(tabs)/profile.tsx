import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, useWindowDimensions, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { EditProfileModal } from '@/components/EditProfileModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedTouchable } from '@/components/AnimatedTouchable';

interface ReviewItem {
  id: string;
  rating: number;
  note: string;
  timestamp: any;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto: string | null;
}

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const router = useRouter();
  const { targetUserId } = useLocalSearchParams<{ targetUserId?: string }>();

  const [themeMode, setThemeMode] = useState(getThemeMode());

  useEffect(() => {
    const unsub = subscribeTheme((t) => setThemeMode(t));
    return () => unsub();
  }, []);

  // Determine if viewing own profile
  const isOwnProfile = !targetUserId || targetUserId === auth.currentUser?.uid;
  const displayUserId = isOwnProfile ? auth.currentUser?.uid : targetUserId;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Reviews states
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [calculatedAverage, setCalculatedAverage] = useState<number | null>(null);

  // Profile primary tab state
  const [profileTab, setProfileTab] = useState<'genel' | 'matches'>('genel');

  // Sub-tabs states (Inside "Genel" tab)
  const [activeTab, setActiveTab] = useState<'reviews' | 'posts' | 'comments'>('reviews');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [userComments, setUserComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Match History states
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [ratingStates, setRatingStates] = useState<Record<string, { rating: number; note: string; submitting: boolean }>>({});

  // 1. Listen for user document changes
  useEffect(() => {
    if (!displayUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubDoc = onSnapshot(doc(db, 'users', displayUserId), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
      setLoading(false);
    }, (error) => {
      console.error("Snapshot error:", error);
      setLoading(false);
    });

    return () => unsubDoc();
  }, [displayUserId]);

  // 2. Fetch match_history reviews for target user
  useEffect(() => {
    if (!displayUserId) return;

    const fetchReviews = async () => {
      setLoadingReviews(true);
      try {
        const q1 = query(
          collection(db, 'match_history'),
          where('playerId', '==', displayUserId),
          where('leaderRated', '==', true)
        );

        const q2 = query(
          collection(db, 'match_history'),
          where('leaderId', '==', displayUserId),
          where('playerRated', '==', true)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const rawReviews: any[] = [];
        
        snap1.forEach((dSnap) => {
          const data = dSnap.data();
          if (data && data.leaderRating !== undefined && data.leaderRating !== null) {
            rawReviews.push({
              id: dSnap.id,
              rating: Number(data.leaderRating),
              note: data.leaderNote || '',
              timestamp: data.timestamp,
              reviewerId: data.leaderId
            });
          }
        });

        snap2.forEach((dSnap) => {
          const data = dSnap.data();
          if (data && data.playerRating !== undefined && data.playerRating !== null) {
            rawReviews.push({
              id: dSnap.id,
              rating: Number(data.playerRating),
              note: data.playerNote || '',
              timestamp: data.timestamp,
              reviewerId: data.playerId
            });
          }
        });

        rawReviews.sort((a, b) => {
          const tA = a.timestamp?.toMillis() || 0;
          const tB = b.timestamp?.toMillis() || 0;
          return tB - tA;
        });

        const enrichedReviewsPromises = rawReviews.map(async (rev) => {
          let reviewerName = 'Bilinmeyen Oyuncu';
          let reviewerPhoto = null;

          try {
            const revSnap = await getDoc(doc(db, 'users', rev.reviewerId));
            if (revSnap.exists()) {
              const rData = revSnap.data();
              reviewerName = rData.username || 'Bilinmeyen Oyuncu';
              reviewerPhoto = rData.profilePicBase64 || null;
            }
          } catch (err) {
            console.warn('Error fetching reviewer data:', err);
          }

          return {
            ...rev,
            reviewerName,
            reviewerPhoto
          };
        });

        const enrichedReviews = await Promise.all(enrichedReviewsPromises);
        setReviews(enrichedReviews);

        if (enrichedReviews.length > 0) {
          const total = enrichedReviews.reduce((sum, r) => sum + r.rating, 0);
          setCalculatedAverage(parseFloat((total / enrichedReviews.length).toFixed(1)));
        } else {
          setCalculatedAverage(null);
        }

      } catch (err) {
        console.error('Error fetching player reviews:', err);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [displayUserId]);

  // 3. Fetch forum posts for target user
  useEffect(() => {
    if (!displayUserId) return;

    const fetchUserPosts = async () => {
      setLoadingPosts(true);
      try {
        const postsRef = collection(db, 'forum_posts');
        const qPosts = query(postsRef, where('authorId', '==', displayUserId));
        const snapPosts = await getDocs(qPosts);
        
        const fetchedPosts: any[] = [];
        snapPosts.forEach((docSnap) => {
          fetchedPosts.push({ id: docSnap.id, ...docSnap.data() });
        });

        fetchedPosts.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        setUserPosts(fetchedPosts);
      } catch (err) {
        console.error('Error fetching user forum posts:', err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchUserPosts();
  }, [displayUserId]);

  // 4. Fetch forum comments/replies for target user
  useEffect(() => {
    if (!displayUserId) return;

    const fetchUserComments = async () => {
      setLoadingComments(true);
      try {
        const commentsRef = collection(db, 'forum_comments');
        const qComments = query(commentsRef, where('authorId', '==', displayUserId));
        const snapComments = await getDocs(qComments);
        
        const rawComments: any[] = [];
        snapComments.forEach((docSnap) => {
          rawComments.push({ id: docSnap.id, ...docSnap.data() });
        });

        rawComments.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        const enrichedCommentsPromises = rawComments.slice(0, 20).map(async (comm) => {
          let postTitle = 'Silinmiş Konu';
          try {
            const postDoc = await getDoc(doc(db, 'forum_posts', comm.postId));
            if (postDoc.exists()) {
              postTitle = postDoc.data().title || 'Başlıksız Konu';
            }
          } catch (e) {
            console.warn('Error fetching parent post title:', e);
          }
          return {
            ...comm,
            postTitle
          };
        });

        const enrichedComments = await Promise.all(enrichedCommentsPromises);
        setUserComments(enrichedComments);
      } catch (err) {
        console.error('Error fetching user forum comments:', err);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchUserComments();
  }, [displayUserId]);

  // 5. Fetch Match History when tab selected
  useEffect(() => {
    if (profileTab === 'matches') {
      fetchMatchHistory();
    }
  }, [profileTab, displayUserId]);

  const fetchMatchHistory = async () => {
    if (!displayUserId) return;
    setLoadingMatches(true);
    try {
      const qLeader = query(
        collection(db, 'match_history'),
        where('leaderId', '==', displayUserId)
      );

      const qPlayer = query(
        collection(db, 'match_history'),
        where('playerId', '==', displayUserId)
      );

      const [snapLeader, snapPlayer] = await Promise.all([
        getDocs(qLeader),
        getDocs(qPlayer)
      ]);

      const rawMatches: any[] = [];
      snapLeader.forEach((doc) => {
        rawMatches.push({ id: doc.id, ...doc.data() });
      });
      snapPlayer.forEach((doc) => {
        if (!rawMatches.some(m => m.id === doc.id)) {
          rawMatches.push({ id: doc.id, ...doc.data() });
        }
      });

      rawMatches.sort((a, b) => {
        const tA = a.timestamp?.toMillis() || 0;
        const tB = b.timestamp?.toMillis() || 0;
        return tB - tA;
      });

      const enrichedMatchesPromises = rawMatches.map(async (match) => {
        const teammateId = displayUserId === match.leaderId ? match.playerId : match.leaderId;
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
        const loggedInUser = auth.currentUser?.uid;
        const alreadyRated = loggedInUser === match.leaderId ? match.leaderRated : match.playerRated;

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

      const initialStates: typeof ratingStates = {};
      enrichedMatches.forEach(m => {
        const loggedInUser = auth.currentUser?.uid;
        const alreadyRated = loggedInUser === m.leaderId ? m.leaderRated : m.playerRated;
        if (!alreadyRated && !m.isExpired && isOwnProfile) {
          initialStates[m.id] = { rating: 5, note: '', submitting: false };
        }
      });
      setRatingStates(initialStates);
    } catch (err) {
      console.error('Error fetching match history:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleRateTeammate = async (matchId: string) => {
    const user = auth.currentUser;
    const state = ratingStates[matchId];
    if (!user || !state || state.submitting) return;

    setRatingStates(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], submitting: true }
    }));

    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      const isLeader = user.uid === match.leaderId;
      const teammateId = match.teammateId;

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
      } else {
        Alert.alert('Başarılı', 'Değerlendirmeniz başarıyla kaydedildi.');
      }

      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, alreadyRated: true } : m));

    } catch (error) {
      console.error('Error submitting teammate rating:', error);
      if (Platform.OS === 'web') {
        window.alert('Değerlendirme kaydedilirken bir hata oluştu.');
      } else {
        Alert.alert('Hata', 'Değerlendirme kaydedilirken bir hata oluştu.');
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

  const getRankColor = (rank: string) => {
    if (!rank) return '#00FF87';
    const r = rank.toLowerCase();
    if (r.includes('iron') || r.includes('demir')) return '#7d7d7d';
    if (r.includes('bronze') || r.includes('bronz')) return '#A47046';
    if (r.includes('silver') || r.includes('gümüş')) return '#BAC4C4';
    if (r.includes('gold') || r.includes('altın')) return '#E5C554';
    if (r.includes('platinum') || r.includes('platin')) return '#4ABBB3';
    if (r.includes('diamond') || r.includes('elmas')) return '#AD71F5';
    if (r.includes('ascendant') || r.includes('yücelik')) return '#149E69';
    if (r.includes('immortal') || r.includes('ölümsüz')) return '#B73D54';
    if (r.includes('radiant') || r.includes('radyant')) return '#FFAA00';
    return '#00FF87';
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: Colors.text }}>Oyuncu profili bulunamadı.</Text>
      </View>
    );
  }

  const renderStarIcons = (score: number) => {
    const stars = [];
    const rounded = Math.round(score);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons 
          key={i} 
          name={i <= rounded ? "star" : "star-outline"} 
          size={16} 
          color={i <= rounded ? "#FFD700" : Colors.gray} 
        />
      );
    }
    return stars;
  };

  const rankColor = getRankColor(userData.rank);

  return (
    <SafeAreaView 
      style={[
        styles.safeArea,
        Platform.OS === 'web' && {
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        } as any
      ]} 
      edges={['left', 'right', 'bottom']}
    >
      
      {!isOwnProfile && (
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
            <Text style={styles.backText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.contentPadding, isWeb && styles.webContentPadding]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={[styles.headerTopRow, !isWeb && { flexDirection: 'column', alignItems: 'center' }]}>
            
            {/* Avatar container */}
            <View style={styles.avatarWrapperContainer}>
              <View style={[styles.avatarLarge, { borderColor: rankColor, shadowColor: rankColor }]}>
                {userData.profilePicBase64 ? (
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${userData.profilePicBase64}` }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <Ionicons name="person" size={44} color={Colors.gray} />
                )}
              </View>
              {/* Online/Active indicator dot */}
              <View style={[styles.onlineDot, { backgroundColor: '#00FF87' }]} />
            </View>

            {/* Info Container */}
            <View style={[styles.profileInfoRight, !isWeb && { alignItems: 'center', marginTop: 16 }]}>
              <Text style={[styles.riotId, !isWeb && { textAlign: 'center' }]}>
                {userData.riotId || userData.username}
              </Text>
              
              <Text style={[styles.bioTextHeader, !isWeb && { textAlign: 'center' }]} numberOfLines={3}>
                {userData.bio || 'Henüz bir biyografi eklenmemiş.'}
              </Text>

              <View style={styles.badgeRow}>
                {/* Star Rating Badge */}
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={14} color="#FFD700" style={{ marginRight: 2 }} />
                  <Text style={styles.ratingBadgeText}>
                    {calculatedAverage !== null ? `${calculatedAverage} (${reviews.length})` : `${userData.rating || '0.0'}`}
                  </Text>
                </View>

                {/* Verified Rank Badge */}
                {userData.verificationStatus === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#00FF87" style={{ marginRight: 2 }} />
                    <Text style={styles.verifiedBadgeText}>Doğrulandı</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.headerDivider} />

          {/* Tab Navigation inside the main Header Card */}
          <View style={styles.headerTabsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.headerTabsScroll}
            >
              <TouchableOpacity 
                style={[styles.headerTabButton, profileTab === 'genel' && styles.headerTabButtonActive]}
                onPress={() => setProfileTab('genel')}
              >
                <Text style={[styles.headerTabButtonText, profileTab === 'genel' && styles.headerTabButtonTextActive]}>
                  Genel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.headerTabButton, profileTab === 'matches' && styles.headerTabButtonActive]}
                onPress={() => setProfileTab('matches')}
              >
                <Text style={[styles.headerTabButtonText, profileTab === 'matches' && styles.headerTabButtonTextActive]}>
                  Geçmiş Karşılaşmalar
                </Text>
              </TouchableOpacity>

              {isOwnProfile && (
                <TouchableOpacity 
                  style={styles.headerTabButton}
                  onPress={() => setIsEditModalVisible(true)}
                >
                  <Text style={styles.headerTabButtonText}>
                    Profili Düzenle
                  </Text>
                </TouchableOpacity>
              )}

              {isOwnProfile && userData.role === 'admin' && (
                <TouchableOpacity 
                  style={styles.headerTabButton}
                  onPress={() => router.push('/admin')}
                >
                  <Text style={styles.headerTabButtonText}>
                    Yönetim Paneli
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>

        {/* TAB CONTENT: GENEL */}
        {profileTab === 'genel' && (
          <>
            {/* Modular Cards Row */}
            <View style={[styles.modularCardsRow, isWeb && styles.webModularCardsRow]}>
              
              {/* Card A: Stats Card */}
              <View style={[styles.modularCard, isWeb && styles.webModularCard]}>
                <Text style={styles.cardTitle}>Karşılaşma İstatistikleri</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statDataBox}>
                    <Text style={styles.statDataNumber}>{userData.lobbiesCreated || 0}</Text>
                    <Text style={styles.statDataLabel}>Açılan Lobi</Text>
                  </View>
                  <View style={styles.statDataBox}>
                    <Text style={styles.statDataNumber}>{userData.lobbiesJoined || 0}</Text>
                    <Text style={styles.statDataLabel}>Katılınan Lobi</Text>
                  </View>
                </View>
              </View>

              {/* Card B: Rank & Roles Card */}
              <View style={[styles.modularCard, isWeb && styles.webModularCard]}>
                <Text style={styles.cardTitle}>Rütbe ve Roller</Text>
                <View style={styles.rankRoleRow}>
                  
                  {userData.rank && VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS] ? (
                    <View style={styles.rankContainerInfo}>
                      <Image 
                        source={VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS].icon} 
                        style={styles.rankIconDetail} 
                      />
                      <Text style={styles.rankNameDetail}>
                        {VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS].name}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.rankContainerInfo}>
                      <Ionicons name="trophy-outline" size={32} color={Colors.gray} />
                      <Text style={styles.rankNameDetail}>Derecesiz</Text>
                    </View>
                  )}

                  <View style={styles.rolesDivider} />

                  <View style={styles.rolesList}>
                    {userData.mainAgents && userData.mainAgents.length > 0 ? (
                      userData.mainAgents.map((agent: string) => (
                        <View key={agent} style={styles.agentBadgeDetail}>
                          <Text style={styles.agentBadgeTextDetail}>{agent}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: Colors.gray, fontSize: 12 }}>Ajan seçilmedi</Text>
                    )}
                  </View>
                </View>

                {/* Rank Verification Status Row inside modular card */}
                {isOwnProfile && userData?.verificationStatus && (
                  <View style={styles.verificationContainer}>
                    {userData.verificationStatus === 'pending' ? (
                      <View style={styles.pendingBadge}>
                        <Ionicons name="time" size={14} color="#FFB300" style={{ marginRight: 4 }} />
                        <Text style={styles.pendingText}>Rütbe onayınız beklemede...</Text>
                      </View>
                    ) : userData.verificationStatus === 'verified' ? (
                      <View style={styles.verifiedBadgeDetail}>
                        <Ionicons name="checkmark-circle" size={14} color="#00FF87" style={{ marginRight: 4 }} />
                        <Text style={styles.verifiedText}>Rütbeniz Doğrulandı</Text>
                      </View>
                    ) : userData.verificationStatus === 'rejected' ? (
                      <View style={[styles.pendingBadge, { backgroundColor: 'rgba(255, 70, 85, 0.1)', borderColor: 'rgba(255, 70, 85, 0.2)' }]}>
                        <Ionicons name="close-circle" size={14} color={Colors.danger} style={{ marginRight: 4 }} />
                        <Text style={[styles.pendingText, { color: Colors.danger }]}>Rütbe onayınız reddedildi.</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            </View>

            {/* Sub-tab view (Değerlendirmeler, Konular, Yanıtlar) */}
            <View style={styles.tabsContainer}>
              <AnimatedTouchable 
                style={[styles.tabButton, activeTab === 'reviews' && styles.tabButtonActive]}
                onPress={() => setActiveTab('reviews')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'reviews' && styles.tabButtonTextActive]}>
                  Değerlendirmeler ({reviews.length})
                </Text>
              </AnimatedTouchable>

              <AnimatedTouchable 
                style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
                onPress={() => setActiveTab('posts')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'posts' && styles.tabButtonTextActive]}>
                  Konular ({userPosts.length})
                </Text>
              </AnimatedTouchable>

              <AnimatedTouchable 
                style={[styles.tabButton, activeTab === 'comments' && styles.tabButtonActive]}
                onPress={() => setActiveTab('comments')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'comments' && styles.tabButtonTextActive]}>
                  Yanıtlar ({userComments.length})
                </Text>
              </AnimatedTouchable>
            </View>

            {activeTab === 'reviews' && (
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsTitle}>Oyuncu Yorumları ({reviews.length})</Text>

                {loadingReviews ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
                ) : reviews.length === 0 ? (
                  <View style={styles.emptyReviews}>
                    <Ionicons name="chatbox-ellipses-outline" size={32} color={Colors.gray} />
                    <Text style={styles.emptyReviewsText}>Bu oyuncu hakkında henüz yazılı bir yorum yapılmamış.</Text>
                  </View>
                ) : (
                  reviews.map((item, index) => {
                    const dateStr = item.timestamp?.toDate()
                      ? item.timestamp.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'Bilinmiyor';

                    return (
                      <Animated.View
                        key={item.id}
                        entering={FadeInDown.duration(400).delay(Math.min(index * 80, 600))}
                      >
                        <View style={styles.reviewCard}>
                          <View style={styles.reviewHeader}>
                            <View style={styles.reviewerInfo}>
                              <View style={styles.reviewerAvatarWrapper}>
                                {item.reviewerPhoto ? (
                                  <Image 
                                    source={{ uri: `data:image/jpeg;base64,${item.reviewerPhoto}` }} 
                                    style={styles.reviewerAvatar} 
                                  />
                                ) : (
                                  <Ionicons name="person" size={12} color={Colors.gray} />
                                )}
                              </View>
                              <Text style={styles.reviewerName}>{item.reviewerName}</Text>
                            </View>
                            <Text style={styles.reviewDate}>{dateStr}</Text>
                          </View>

                          <View style={styles.reviewRatingRow}>
                            {renderStarIcons(item.rating)}
                          </View>

                          <Text style={styles.reviewNote}>
                            {item.note.trim() || `${item.rating} Yıldızlı Değerlendirme`}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  })
                )}
              </View>
            )}

            {activeTab === 'posts' && (
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsTitle}>Açtığı Konular ({userPosts.length})</Text>

                {loadingPosts ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
                ) : userPosts.length === 0 ? (
                  <View style={styles.emptyReviews}>
                    <Ionicons name="chatbox-outline" size={32} color={Colors.gray} />
                    <Text style={styles.emptyReviewsText}>Bu oyuncu henüz forum konusu açmamış.</Text>
                  </View>
                ) : (
                  userPosts.map((post, index) => {
                    const postDateStr = post.createdAt?.toDate()
                      ? post.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'Bilinmiyor';

                    return (
                      <Animated.View
                        key={post.id}
                        entering={FadeInDown.duration(400).delay(Math.min(index * 80, 600))}
                      >
                        <AnimatedTouchable 
                          style={styles.postCardSmall}
                          onPress={() => router.push({
                            pathname: '/forum-detail',
                            params: { postId: post.id }
                          })}
                        >
                          <View style={styles.postCardHeaderSmall}>
                            <View style={styles.categoryLabel}>
                              <Text style={styles.categoryLabelText}>{post.category}</Text>
                            </View>
                            <Text style={styles.postTimeSmall}>{postDateStr}</Text>
                          </View>
                          <Text style={styles.postTitleSmall} numberOfLines={2}>{post.title}</Text>
                          <Text style={styles.postContentSmall} numberOfLines={3}>{post.content}</Text>
                          
                          <View style={styles.postCardFooterSmall}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                              <View style={styles.interactionBtnSmall}>
                                <Ionicons name="heart-outline" size={14} color={Colors.gray} />
                                <Text style={styles.interactionTextSmall}>{post.likesCount || 0} Beğeni</Text>
                              </View>
                              <View style={styles.interactionBtnSmall}>
                                <Ionicons name="chatbubble-outline" size={14} color={Colors.gray} />
                                <Text style={styles.interactionTextSmall}>{post.commentsCount || 0} Yorum</Text>
                              </View>
                            </View>
                          </View>
                        </AnimatedTouchable>
                      </Animated.View>
                    );
                  })
                )}
              </View>
            )}

            {activeTab === 'comments' && (
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsTitle}>Yazdığı Yanıtlar ({userComments.length})</Text>

                {loadingComments ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
                ) : userComments.length === 0 ? (
                  <View style={styles.emptyReviews}>
                    <Ionicons name="chatbubbles-outline" size={32} color={Colors.gray} />
                    <Text style={styles.emptyReviewsText}>Bu oyuncu henüz bir konuya yanıt yazmamış.</Text>
                  </View>
                ) : (
                  userComments.map((comment, index) => {
                    const commentDateStr = comment.createdAt?.toDate()
                      ? comment.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'Bilinmiyor';

                    return (
                      <Animated.View
                        key={comment.id}
                        entering={FadeInDown.duration(400).delay(Math.min(index * 80, 600))}
                      >
                        <AnimatedTouchable 
                          style={styles.commentCardSmall}
                          onPress={() => router.push({
                            pathname: '/forum-detail',
                            params: { postId: comment.postId }
                          })}
                        >
                          <View style={styles.commentCardHeaderSmall}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                              <Ionicons name="arrow-undo-outline" size={14} color={Colors.primary} />
                              <Text style={styles.commentParentTitleSmall} numberOfLines={1}>
                                Konu: {comment.postTitle}
                              </Text>
                            </View>
                            <Text style={styles.commentTimeSmall}>{commentDateStr}</Text>
                          </View>
                          <Text style={styles.commentContentSmall}>{comment.content}</Text>
                          <Text style={styles.viewThreadText}>Konuyu Görüntüle →</Text>
                        </AnimatedTouchable>
                      </Animated.View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}

        {/* TAB CONTENT: GEÇMİŞ KARŞILAŞMALAR */}
        {profileTab === 'matches' && (
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsTitle}>Karşılaşma Geçmişi</Text>

            {loadingMatches ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : matches.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons name="people-outline" size={36} color={Colors.gray} />
                <Text style={styles.emptyReviewsText}>Doğrulanmış bir karşılaşma geçmişiniz bulunamadı.</Text>
              </View>
            ) : (
              matches.map((item, index) => {
                const state = ratingStates[item.id] || { rating: 5, note: '', submitting: false };
                const matchDate = item.timestamp?.toDate() 
                  ? item.timestamp.toDate().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                  : 'Bilinmiyor';

                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.duration(400).delay(Math.min(index * 80, 600))}
                  >
                    <View style={styles.matchCard}>
                      <View style={styles.matchCardHeader}>
                        <View style={styles.teammateInfo}>
                          <View style={styles.teammateAvatarWrapper}>
                            {item.teammatePhoto ? (
                              <Image 
                                source={{ uri: `data:image/jpeg;base64,${item.teammatePhoto}` }} 
                                style={styles.teammateAvatar} 
                              />
                            ) : (
                              <Ionicons name="person" size={20} color={Colors.gray} />
                            )}
                          </View>
                          <View>
                            <Text style={styles.teammateName}>{item.teammateRiotId || item.teammateName}</Text>
                            <Text style={styles.matchDateText}>{matchDate}</Text>
                          </View>
                        </View>
                      </View>

                      {item.alreadyRated ? (
                        <View style={styles.feedbackBadgeContainer}>
                          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                          <Text style={styles.feedbackBadgeText}>Karşılaşma değerlendirildi.</Text>
                        </View>
                      ) : item.isExpired ? (
                        <View style={styles.feedbackBadgeContainer}>
                          <Ionicons name="time-outline" size={16} color={Colors.gray} />
                          <Text style={styles.feedbackExpiredText}>Değerlendirme süresi doldu.</Text>
                        </View>
                      ) : isOwnProfile ? (
                        <View style={styles.ratingFormContainer}>
                          <Text style={styles.ratingFormLabel}>Oyuncuyu Değerlendirin:</Text>
                          
                          <View style={styles.starRatingRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity 
                                key={star} 
                                onPress={() => handleStarSelect(item.id, star)}
                                style={styles.starRatingIcon}
                              >
                                <Ionicons 
                                  name={star <= state.rating ? "star" : "star-outline"} 
                                  size={24} 
                                  color={star <= state.rating ? "#FFD700" : Colors.gray} 
                                />
                              </TouchableOpacity>
                            ))}
                          </View>

                          <TextInput
                            style={styles.ratingTextInput}
                            placeholder="Değerlendirme notu (Toksik davrandı, iyi oynadı vb.)..."
                            placeholderTextColor={Colors.gray}
                            value={state.note}
                            onChangeText={(text) => handleNoteChange(item.id, text)}
                            multiline
                            maxLength={150}
                          />

                          <TouchableOpacity 
                            style={[styles.ratingSubmitBtn, state.rating <= 2 && styles.ratingNegativeSubmitBtn]}
                            onPress={() => handleRateTeammate(item.id)}
                            disabled={state.submitting}
                          >
                            {state.submitting ? (
                              <ActivityIndicator size="small" color="#0F1923" />
                            ) : (
                              <>
                                <Ionicons name="shield-checkmark" size={14} color="#0F1923" />
                                <Text style={styles.ratingSubmitBtnText}>Değerlendir ve Gönder</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.feedbackBadgeContainer}>
                          <Ionicons name="information-circle-outline" size={16} color={Colors.gray} />
                          <Text style={styles.feedbackExpiredText}>Değerlendirme yetkiniz bulunmamaktadır.</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })
            )}
          </View>
        )}

        <EditProfileModal 
          isVisible={isEditModalVisible} 
          onClose={() => setIsEditModalVisible(false)} 
          userData={userData}
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
  },
  webContentPadding: {
    paddingHorizontal: '15%',
    paddingTop: 32,
  },
  profileHeaderCard: {
    backgroundColor: '#161e2b',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.12)',
    shadowColor: '#00FF87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarWrapperContainer: {
    position: 'relative',
    alignSelf: 'center',
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#0F1923',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0.4,
    elevation: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#161e2b',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  profileInfoRight: {
    flex: 1,
    marginLeft: 20,
  },
  riotId: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bioTextHeader: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  ratingBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  verifiedBadgeText: {
    color: '#00FF87',
    fontSize: 12,
    fontWeight: '700',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 18,
    width: '100%',
  },
  headerTabsContainer: {
    width: '100%',
  },
  headerTabsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTabButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  headerTabButtonActive: {
    backgroundColor: '#00FF87',
  },
  headerTabButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    fontSize: 13,
  },
  headerTabButtonTextActive: {
    color: '#0F1923',
    fontWeight: '800',
  },
  modularCardsRow: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
    width: '100%',
  },
  webModularCardsRow: {
    flexDirection: 'row',
  },
  modularCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  webModularCard: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statDataBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statDataNumber: {
    color: '#00FF87',
    fontSize: 24,
    fontWeight: '900',
  },
  statDataLabel: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  rankRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  rankContainerInfo: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  rankIconDetail: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  rankNameDetail: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  rolesDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rolesList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  agentBadgeDetail: {
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.15)',
  },
  agentBadgeTextDetail: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  verificationContainer: {
    marginTop: 14,
    width: '100%',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 0, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.15)',
  },
  pendingText: {
    color: '#FFB300',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadgeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.15)',
  },
  verifiedText: {
    color: '#00FF87',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
    width: '100%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: Colors.primary,
  },
  reviewsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  reviewsTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyReviewsText: {
    color: Colors.gray,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  reviewCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatarWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  reviewerAvatar: {
    width: '100%',
    height: '100%',
  },
  reviewerName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewDate: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 8,
  },
  reviewNote: {
    color: Colors.gray,
    fontSize: 13,
    lineHeight: 18,
  },
  postCardSmall: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  postCardHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postTimeSmall: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  postTitleSmall: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  postContentSmall: {
    color: Colors.gray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  postCardFooterSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.02)',
    paddingTop: 8,
  },
  interactionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  interactionTextSmall: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryLabel: {
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.15)',
  },
  categoryLabelText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  commentCardSmall: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  commentCardHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentParentTitleSmall: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  commentTimeSmall: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
  commentContentSmall: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  viewThreadText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  matchCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teammateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teammateAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F1923',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  teammateAvatar: {
    width: '100%',
    height: '100%',
  },
  teammateName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  matchDateText: {
    color: Colors.gray,
    fontSize: 11,
    marginTop: 2,
  },
  feedbackBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  feedbackBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackExpiredText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  ratingFormContainer: {
    backgroundColor: 'rgba(15, 25, 35, 0.4)',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  ratingFormLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  starRatingRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 10,
  },
  starRatingIcon: {
    padding: 2,
  },
  ratingTextInput: {
    backgroundColor: '#0F1923',
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 12,
    height: 48,
    textAlignVertical: 'top',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  ratingSubmitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  ratingNegativeSubmitBtn: {
    backgroundColor: Colors.danger,
  },
  ratingSubmitBtnText: {
    color: '#0F1923',
    fontSize: 12,
    fontWeight: '900',
  },
});
