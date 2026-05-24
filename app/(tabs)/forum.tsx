import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform, useWindowDimensions, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, getDoc, runTransaction, arrayUnion, arrayRemove } from 'firebase/firestore';

interface ForumPost {
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  authorRiotId: string;
  base64Image?: string | null;
  createdAt: any;
  likesCount: number;
  commentsCount: number;
  likedBy: string[];
}

const CATEGORIES = ["Tümü", "Haberler", "Rehberler", "Takım Bul", "Sohbet", "Taktikler"];

export default function ForumScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const router = useRouter();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Cache user profiles to show author avatars and ranks dynamically
  const [userProfiles, setUserProfiles] = useState<Record<string, { profilePicBase64?: string; rank?: string }>>({});

  // 1. Fetch posts in real-time
  useEffect(() => {
    const postsRef = collection(db, 'forum_posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: ForumPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedPosts.push({
          id: docSnap.id,
          title: data.title || '',
          category: data.category || 'Sohbet',
          content: data.content || '',
          authorId: data.authorId || '',
          authorRiotId: data.authorRiotId || 'Bilinmeyen',
          base64Image: data.base64Image || null,
          createdAt: data.createdAt,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          likedBy: data.likedBy || [],
        });
      });
      setPosts(fetchedPosts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching forum posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchedAuthorIdsRef = useRef<Set<string>>(new Set());

  // 2. Fetch and cache author profiles dynamically
  useEffect(() => {
    const missingAuthorIds = posts
      .map(p => p.authorId)
      .filter(id => id && !fetchedAuthorIdsRef.current.has(id));

    if (missingAuthorIds.length === 0) return;

    // Mark as fetched immediately to prevent concurrent duplicate calls
    missingAuthorIds.forEach(id => fetchedAuthorIdsRef.current.add(id));

    const fetchProfiles = async () => {
      const newProfiles: Record<string, { profilePicBase64?: string; rank?: string }> = {};
      let updated = false;

      await Promise.all(
        missingAuthorIds.map(async (id) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              const data = userDoc.data();
              newProfiles[id] = {
                profilePicBase64: data.profilePicBase64 || undefined,
                rank: data.rank || 'Derecesiz',
              };
            } else {
              newProfiles[id] = { rank: 'Derecesiz' };
            }
            updated = true;
          } catch (e) {
            console.warn("Error fetching user profile for ID:", id, e);
            newProfiles[id] = { rank: 'Derecesiz' };
            updated = true;
          }
        })
      );

      if (updated) {
        setUserProfiles(prev => ({ ...prev, ...newProfiles }));
      }
    };

    fetchProfiles();
  }, [posts]);

  // 3. Handle like toggle from feed
  const handleLike = async (postId: string, likedBy: string[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const postRef = doc(db, 'forum_posts', postId);
    const isLiked = likedBy && likedBy.includes(user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) return;

        const currentLikesCount = postDoc.data().likesCount || 0;

        if (isLiked) {
          transaction.update(postRef, {
            likedBy: arrayRemove(user.uid),
            likesCount: Math.max(0, currentLikesCount - 1),
          });
        } else {
          transaction.update(postRef, {
            likedBy: arrayUnion(user.uid),
            likesCount: currentLikesCount + 1,
          });
        }
      });
    } catch (error) {
      console.error("Like transaction failed from feed:", error);
    }
  };

  // 4. Helper to format timestamp
  const formatTime = (createdAt: any) => {
    if (!createdAt) return 'Şimdi';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return `${diffDays} gün önce`;
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === "Tümü" || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView 
          style={styles.container}
          contentContainerStyle={[styles.contentPadding, isWeb && styles.webContentPadding, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Topluluk Forumu</Text>
            <Text style={styles.subtitle}>Fikirlerinizi paylaşın, taktik alışverişinde bulunun.</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color={Colors.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Forumda arama yapın..."
              placeholderTextColor={Colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== "" && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category List */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {CATEGORIES.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryBadge,
                  selectedCategory === category && styles.categoryBadgeActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryBadgeText,
                  selectedCategory === category && styles.categoryBadgeTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Posts List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.postsList}>
              {filteredPosts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbox-ellipses-outline" size={48} color={Colors.gray} />
                  <Text style={styles.emptyText}>Aradığınız kriterlere uygun konu bulunamadı.</Text>
                </View>
              ) : (
                filteredPosts.map(post => {
                  const isLiked = post.likedBy && auth.currentUser && post.likedBy.includes(auth.currentUser.uid);
                  const profile = userProfiles[post.authorId];
                  const avatarUri = profile?.profilePicBase64;
                  const rank = profile?.rank || 'Derecesiz';

                  return (
                    <Pressable 
                      key={post.id} 
                      style={styles.postCard}
                      onPress={() => router.push({
                        pathname: '/forum-detail',
                        params: { postId: post.id }
                      })}
                    >
                      <View style={styles.postCardHeader}>
                        <TouchableOpacity 
                          style={styles.authorBox}
                          onPress={() => router.push({
                            pathname: '/profile',
                            params: { targetUserId: post.authorId }
                          })}
                        >
                          <View style={styles.avatarPlaceholder}>
                            {avatarUri ? (
                              <Image 
                                source={{ uri: `data:image/jpeg;base64,${avatarUri}` }} 
                                style={styles.avatarImage} 
                              />
                            ) : (
                              <Ionicons name="person" size={14} color={Colors.gray} />
                            )}
                          </View>
                          <View>
                            <Text style={styles.authorName}>{post.authorRiotId}</Text>
                            <Text style={styles.authorRankText}>{rank}</Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.categoryLabel}>
                          <Text style={styles.categoryLabelText}>{post.category}</Text>
                        </View>
                      </View>

                      <Text style={styles.postTitle}>{post.title}</Text>
                      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>

                      {post.base64Image ? (
                        <View style={styles.postCardImageContainer}>
                          <Image 
                            source={{ uri: `data:image/jpeg;base64,${post.base64Image}` }} 
                            style={styles.postCardImage} 
                          />
                        </View>
                      ) : null}

                      <View style={styles.postCardFooter}>
                        <View style={styles.footerLeft}>
                          <TouchableOpacity 
                            style={[styles.interactionBtn, isLiked && styles.likedBtn]} 
                            onPress={() => handleLike(post.id, post.likedBy)}
                          >
                            <Ionicons 
                              name={isLiked ? "heart" : "heart-outline"} 
                              size={18} 
                              color={isLiked ? Colors.danger : Colors.gray} 
                            />
                            <Text style={[styles.interactionText, isLiked && styles.likedText]}>
                              {post.likesCount} Beğeni
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.interactionBtn}>
                            <Ionicons name="chatbubble-outline" size={18} color={Colors.gray} />
                            <Text style={styles.interactionText}>{post.commentsCount} Yorum</Text>
                          </View>
                        </View>
                        <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={[styles.fab, isWeb && styles.webFab]} 
          onPress={() => router.push('/forum-create')}
        >
          <Ionicons name="add" size={22} color="#0F1923" />
          <Text style={styles.fabText}>Yeni Konu Aç</Text>
        </TouchableOpacity>
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
  contentPadding: {
    padding: 20,
  },
  webContentPadding: {
    paddingHorizontal: '20%',
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.gray,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: Colors.text,
    fontSize: 14,
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryList: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingBottom: 4,
  },
  categoryBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryBadgeText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryBadgeTextActive: {
    color: Colors.background,
  },
  postsList: {
    gap: 16,
  },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  authorName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  authorRankText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  categoryLabel: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryLabelText: {
    color: Colors.gray,
    fontSize: 10,
    fontWeight: '700',
  },
  postTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
    lineHeight: 20,
  },
  postContent: {
    color: Colors.gray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  postCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likedBtn: {
    opacity: 1,
  },
  interactionText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  likedText: {
    color: Colors.danger,
    fontWeight: '700',
  },
  postTime: {
    color: Colors.gray,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    gap: 6,
  },
  webFab: {
    right: '20%',
    marginRight: 20,
    bottom: 30,
  },
  fabText: {
    color: Colors.background,
    fontWeight: '800',
    fontSize: 14,
  },
  postCardImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
