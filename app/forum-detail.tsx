import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp, runTransaction, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import TiltedCard from '@/components/TiltedCard';

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

interface ForumComment {
  id: string;
  postId: string;
  authorId: string;
  authorRiotId: string;
  content: string;
  createdAt: any;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [currentUserRiotId, setCurrentUserRiotId] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);

  // Cache profiles for comment authors and post author
  const [profiles, setProfiles] = useState<Record<string, { profilePicBase64?: string; rank?: string }>>({});
  const fetchedProfilesRef = useRef<Set<string>>(new Set());

  // 1. Fetch current user's profile info
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUserRiotId(data.riotId || data.username || 'Bilinmeyen Oyuncu');
        }
      } catch (e) {
        console.warn("Failed to fetch current user profile:", e);
      }
    };
    fetchCurrentUserProfile();
  }, []);

  // Fetch image dimensions to calculate original aspect ratio dynamically
  useEffect(() => {
    if (post && post.base64Image) {
      const uri = `data:image/jpeg;base64,${post.base64Image}`;
      if (Platform.OS === 'web') {
        const img = new window.Image();
        img.onload = () => {
          if (img.naturalHeight > 0) {
            setImageAspectRatio(img.naturalWidth / img.naturalHeight);
          }
        };
        img.src = uri;
      } else {
        Image.getSize(uri, (w, h) => {
          if (h > 0) {
            setImageAspectRatio(w / h);
          }
        }, (err) => {
          console.warn("Failed to get image size:", err);
        });
      }
    } else {
      setImageAspectRatio(undefined);
    }
  }, [post]);

  // 2. Listen to the specific post in real-time
  useEffect(() => {
    if (!postId) return;

    const postRef = doc(db, 'forum_posts', postId);
    const unsubscribe = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPost({
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
      } else {
        setPost(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to post:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [postId]);

  // 3. Listen to comments in real-time
  useEffect(() => {
    if (!postId) return;

    const commentsRef = collection(db, 'forum_comments');
    const q = query(
      commentsRef,
      where('postId', '==', postId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments: ForumComment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedComments.push({
          id: docSnap.id,
          postId: data.postId || '',
          authorId: data.authorId || '',
          authorRiotId: data.authorRiotId || 'Bilinmeyen',
          content: data.content || '',
          createdAt: data.createdAt,
        });
      });

      // Sort client-side by createdAt ascending to avoid index requirement
      fetchedComments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeA - timeB;
      });

      setComments(fetchedComments);
    }, (error) => {
      console.error("Error listening to comments:", error);
    });

    return () => unsubscribe();
  }, [postId]);

  // 4. Fetch missing profiles for post and comment authors
  useEffect(() => {
    const authorIds = new Set<string>();
    if (post) {
      authorIds.add(post.authorId);
    }
    comments.forEach(c => authorIds.add(c.authorId));

    const missingIds = Array.from(authorIds).filter(id => id && !fetchedProfilesRef.current.has(id));
    if (missingIds.length === 0) return;

    // Mark as fetched immediately to prevent concurrent duplicate calls
    missingIds.forEach(id => fetchedProfilesRef.current.add(id));

    const fetchProfiles = async () => {
      const newProfiles: Record<string, { profilePicBase64?: string; rank?: string }> = {};
      let updated = false;

      await Promise.all(
        missingIds.map(async (id) => {
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
            console.warn("Failed fetching profile for ID:", id, e);
            newProfiles[id] = { rank: 'Derecesiz' };
            updated = true;
          }
        })
      );

      if (updated) {
        setProfiles(prev => ({ ...prev, ...newProfiles }));
      }
    };

    fetchProfiles();
  }, [post, comments]);

  // 5. Handle post liking
  const handleLike = async () => {
    const user = auth.currentUser;
    if (!user || !post) return;

    const postRef = doc(db, 'forum_posts', post.id);
    const isLiked = post.likedBy && post.likedBy.includes(user.uid);

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
      console.error("Like transaction failed:", error);
    }
  };

  // 6. Handle comment submission
  const handleSendComment = async () => {
    const user = auth.currentUser;
    if (!user || !post) return;
    if (!newComment.trim()) return;

    const text = newComment.trim();
    setNewComment('');

    try {
      await addDoc(collection(db, 'forum_comments'), {
        postId: post.id,
        authorId: user.uid,
        authorRiotId: currentUserRiotId || user.email || 'Bilinmeyen Oyuncu',
        content: text,
        createdAt: serverTimestamp(),
      });

      const postRef = doc(db, 'forum_posts', post.id);
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (postDoc.exists()) {
          const currentCommentsCount = postDoc.data().commentsCount || 0;
          transaction.update(postRef, {
            commentsCount: currentCommentsCount + 1,
          });
        }
      });
    } catch (error) {
      console.error("Comment submission failed:", error);
      const errMsg = 'Yorum gönderilirken bir hata oluştu.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Hata', errMsg);
    }
  };

  // 7. Format timestamps
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detaylar</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>Gönderi bulunamadı veya silinmiş olabilir.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLiked = post.likedBy && auth.currentUser && post.likedBy.includes(auth.currentUser.uid);
  const postAuthorProfile = profiles[post.authorId];
  const postAuthorAvatar = postAuthorProfile?.profilePicBase64;
  const postAuthorRank = postAuthorProfile?.rank || 'Derecesiz';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={[styles.header, isWeb && styles.webHeader]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konu Detayı</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.scrollContainer, isWeb && styles.webScrollContainer]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.postDetailsContainer}>
              {/* Author & Info */}
              <View style={styles.postCardHeader}>
                <TouchableOpacity 
                  style={styles.authorBox}
                  onPress={() => router.push({
                    pathname: '/profile',
                    params: { targetUserId: post.authorId }
                  })}
                >
                  <View style={styles.avatarPlaceholder}>
                    {postAuthorAvatar ? (
                      <Image 
                        source={{ uri: `data:image/jpeg;base64,${postAuthorAvatar}` }} 
                        style={styles.avatarImage} 
                      />
                    ) : (
                      <Ionicons name="person" size={14} color={Colors.gray} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.authorName}>{post.authorRiotId}</Text>
                    <Text style={styles.authorRankText}>{postAuthorRank}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.categoryLabel}>
                  <Text style={styles.categoryLabelText}>{post.category}</Text>
                </View>
              </View>

              {/* Title & Body */}
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postContent}>{post.content}</Text>

              {/* Base64 Post Image if exists */}
              {post.base64Image && (
                <View style={[
                  styles.postImageContainer,
                  imageAspectRatio ? { height: undefined, aspectRatio: imageAspectRatio } : null
                ]}>
                  <TiltedCard 
                    imageSrc={`data:image/jpeg;base64,${post.base64Image}`} 
                    containerHeight={imageAspectRatio ? undefined : 250}
                    containerWidth="100%"
                    aspectRatio={imageAspectRatio}
                  />
                </View>
              )}

              {/* Footer / Likes Bar */}
              <View style={styles.postCardFooter}>
                <TouchableOpacity 
                  style={[styles.interactionBtn, isLiked && styles.likedBtn]} 
                  onPress={handleLike}
                >
                  <Ionicons 
                    name={isLiked ? "heart" : "heart-outline"} 
                    size={20} 
                    color={isLiked ? Colors.danger : Colors.gray} 
                  />
                  <Text style={[styles.interactionText, isLiked && styles.likedText]}>
                    {post.likesCount} Beğeni
                  </Text>
                </TouchableOpacity>

                <View style={styles.interactionBtn}>
                  <Ionicons name="chatbubble-outline" size={20} color={Colors.gray} />
                  <Text style={styles.interactionText}>{post.commentsCount} Yorum</Text>
                </View>

                <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
              </View>

              {/* Comments Section Title */}
              <Text style={styles.commentsTitle}>Yorumlar ({comments.length})</Text>
            </View>
          }
          renderItem={({ item }) => {
            const commentProfile = profiles[item.authorId];
            const commentAvatar = commentProfile?.profilePicBase64;
            const commentRank = commentProfile?.rank || 'Derecesiz';

            return (
              <View style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <TouchableOpacity 
                    style={styles.commentAuthorBox}
                    onPress={() => router.push({
                      pathname: '/profile',
                      params: { targetUserId: item.authorId }
                    })}
                  >
                    <View style={styles.commentAvatarPlaceholder}>
                      {commentAvatar ? (
                        <Image 
                          source={{ uri: `data:image/jpeg;base64,${commentAvatar}` }} 
                          style={styles.commentAvatarImage} 
                        />
                      ) : (
                        <Ionicons name="person" size={10} color={Colors.gray} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.commentAuthorName}>{item.authorRiotId}</Text>
                      <Text style={styles.commentAuthorRankText}>{commentRank}</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyCommentsContainer}>
              <Ionicons name="chatbubbles-outline" size={32} color={Colors.gray} />
              <Text style={styles.emptyCommentsText}>
                Henüz yorum yapılmamış. İlk yorumu siz yapın!
              </Text>
            </View>
          }
        />

        {/* Comment input area */}
        <View style={[styles.commentInputWrapper, isWeb && styles.webCommentInputWrapper]}>
          <TextInput
            style={styles.commentInput}
            placeholder="Yorumunuzu yazın..."
            placeholderTextColor={Colors.gray}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={300}
          />
          <TouchableOpacity 
            style={[styles.sendCommentBtn, !newComment.trim() && styles.sendCommentBtnDisabled]}
            onPress={handleSendComment}
            disabled={!newComment.trim()}
          >
            <Ionicons name="send" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  webHeader: {
    paddingHorizontal: '25%',
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  webScrollContainer: {
    paddingHorizontal: '25%',
  },
  postDetailsContainer: {
    marginBottom: 20,
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  authorRankText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  categoryLabel: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryLabelText: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '700',
  },
  postTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    lineHeight: 24,
  },
  postContent: {
    color: Colors.text,
    opacity: 0.9,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  postImageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  postCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
    gap: 20,
    marginBottom: 24,
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
    fontSize: 13,
    fontWeight: '600',
  },
  likedText: {
    color: Colors.danger,
    fontWeight: '700',
  },
  postTime: {
    color: Colors.gray,
    fontSize: 12,
    marginLeft: 'auto',
  },
  commentsTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  commentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  commentAuthorName: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  commentAuthorRankText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '600',
  },
  commentTime: {
    color: Colors.gray,
    fontSize: 10,
  },
  commentContent: {
    color: Colors.text,
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyCommentsText: {
    color: Colors.gray,
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.gray,
    fontSize: 15,
    textAlign: 'center',
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  webCommentInputWrapper: {
    paddingHorizontal: '25%',
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sendCommentBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCommentBtnDisabled: {
    opacity: 0.4,
  },
});
