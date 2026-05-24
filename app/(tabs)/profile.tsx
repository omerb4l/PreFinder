import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, useWindowDimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
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

  // Tabs states
  const [activeTab, setActiveTab] = useState<'reviews' | 'posts' | 'comments'>('reviews');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [userComments, setUserComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);



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
        // Query 1: Target user is player, leader gave rating
        const q1 = query(
          collection(db, 'match_history'),
          where('playerId', '==', displayUserId),
          where('leaderRated', '==', true)
        );

        // Query 2: Target user is leader, player gave rating
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

        // Sort by timestamp descending
        rawReviews.sort((a, b) => {
          const tA = a.timestamp?.toMillis() || 0;
          const tB = b.timestamp?.toMillis() || 0;
          return tB - tA;
        });

        // Enrich reviewer names and photos
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

        // Calculate actual average rating
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

        // Sort client-side by createdAt descending
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

        // Sort client-side by createdAt descending
        rawComments.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        // Fetch parent post title for each comment to make it look premium
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

  // Generate stars JSX helper
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      
      {/* Back button header (only if viewing someone else's profile) */}
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
          <View style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              {userData.profilePicBase64 ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${userData.profilePicBase64}` }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <Ionicons name="person" size={50} color={Colors.gray} />
              )}
            </View>
          </View>
          
          <Text style={styles.riotId}>{userData.riotId || userData.username}</Text>
          
          {/* Rating display: Prominently show star rating with click details */}
          <View style={styles.ratingRow}>
            {calculatedAverage !== null ? (
              <>
                <View style={styles.starRow}>
                  {renderStarIcons(calculatedAverage)}
                </View>
                <Text style={styles.ratingText}>
                  {calculatedAverage} ({reviews.length} Değerlendirme)
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {userData.rating || '0.0'} / 5.0 (Oylanmadı)
                </Text>
              </>
            )}
          </View>

          {/* User statistics details */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userData.lobbiesCreated || 0}</Text>
              <Text style={styles.statLabel}>Açılan Lobi</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userData.lobbiesJoined || 0}</Text>
              <Text style={styles.statLabel}>Katılınan Lobi</Text>
            </View>
          </View>

          <View style={styles.rankAgentRow}>
            {userData.rank && VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS] ? (
              <View style={styles.rankBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Image source={VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS].icon} style={styles.rankIcon} />
                  {userData.verificationStatus === 'verified' && (
                    <Ionicons name="checkmark-circle" size={16} color="#00FF87" />
                  )}
                </View>
                <Text style={styles.rankName}>{VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS].name}</Text>
              </View>
            ) : (
              <View style={styles.rankBox}>
                <Ionicons name="trophy-outline" size={32} color={Colors.gray} />
                <Text style={styles.rankName}>Rank Belirlenmedi</Text>
              </View>
            )}
            
            <View style={styles.agentsList}>
              {userData.mainAgents && userData.mainAgents.length > 0 ? (
                userData.mainAgents.map((agent: string) => (
                  <View key={agent} style={styles.agentBadge}>
                    <Text style={styles.agentBadgeText}>{agent}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: Colors.gray, fontSize: 12 }}>Ajan seçilmedi</Text>
              )}
            </View>
          </View>

          {/* Rank Verification Status Row */}
          {isOwnProfile && userData?.verificationStatus && (
            <View style={styles.verificationContainer}>
              {userData.verificationStatus === 'pending' ? (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time" size={16} color="#FFB300" />
                  <Text style={styles.pendingText}>Rütbe onayınız beklemede...</Text>
                </View>
              ) : userData.verificationStatus === 'verified' ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00FF87" />
                  <Text style={styles.verifiedText}>Rütbeniz Doğrulandı</Text>
                </View>
              ) : userData.verificationStatus === 'rejected' ? (
                <View style={[styles.pendingBadge, { backgroundColor: 'rgba(255, 70, 85, 0.1)', borderColor: 'rgba(255, 70, 85, 0.2)' }]}>
                  <Ionicons name="close-circle" size={16} color={Colors.danger} />
                  <Text style={[styles.pendingText, { color: Colors.danger }]}>Rütbe onayınız reddedildi.</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.bioBox}>
            <Text style={styles.bioText}>{userData.bio || 'Henüz bir biyografi eklenmemiş.'}</Text>
          </View>

          {/* Action buttons (only shown for owner profile) */}
          {isOwnProfile && (
            <>
              <View style={{ height: 24 }} />
              <PrimaryButton 
                title="Profili Düzenle" 
                onPress={() => setIsEditModalVisible(true)} 
              />

              <TouchableOpacity 
                style={styles.historyBtn} 
                onPress={() => router.push('/previous-players')}
              >
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={styles.historyBtnText}>Geçmiş Karşılaşmalar</Text>
              </TouchableOpacity>

              {userData.role === 'admin' && (
                <TouchableOpacity 
                  style={styles.adminBtn} 
                  onPress={() => router.push('/admin')}
                >
                  <Ionicons name="shield-half" size={20} color={Colors.primary} />
                  <Text style={styles.adminBtnText}>Yönetim Paneli</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Tab Switcher */}
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
                            <Ionicons name="person" size={14} color={Colors.gray} />
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
    padding: 20,
  },
  webContentPadding: {
    paddingHorizontal: '20%',
    paddingTop: 40,
  },
  profileHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0F1923',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  riotId: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
  },
  ratingText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '700',
  },
  statsDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rankAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  rankBox: {
    alignItems: 'center',
    gap: 4,
  },
  rankIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  rankName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  agentsList: {
    flexDirection: 'row',
    gap: 8,
  },
  agentBadge: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
  },
  agentBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  bioBox: {
    width: '100%',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  bioText: {
    color: Colors.gray,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  adminBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  historyBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
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
  verificationContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  verificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  verificationBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.2)',
  },
  pendingText: {
    color: '#FFB300',
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
  },
  verifiedText: {
    color: '#00FF87',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectedSubText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
    marginTop: 10,
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
});
