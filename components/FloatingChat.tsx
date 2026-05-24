import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  useWindowDimensions, 
  ActivityIndicator, 
  Image 
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  doc, 
  getDoc 
} from 'firebase/firestore';

interface MessageItem {
  id: string;
  senderId: string;
  content: string;
  createdAt: any;
}

interface ActiveChatItem {
  id: string;
  lobbyId: string;
  requesterId: string;
  receiverId: string;
  status: string;
}

interface UserProfile {
  username: string;
  profilePicBase64: string | null;
}

export const FloatingChat = () => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [activeChats, setActiveChats] = useState<ActiveChatItem[]>([]);
  const [profilesCache, setProfilesCache] = useState<{ [uid: string]: UserProfile }>({});
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const currentUserId = auth.currentUser?.uid;

  // 1. Listen for active accepted requests (both as requester and receiver)
  useEffect(() => {
    if (!currentUserId) {
      setActiveChats([]);
      return;
    }

    const qRequester = query(
      collection(db, 'requests'),
      where('status', '==', 'accepted'),
      where('requesterId', '==', currentUserId)
    );

    const qReceiver = query(
      collection(db, 'requests'),
      where('status', '==', 'accepted'),
      where('receiverId', '==', currentUserId)
    );

    let list1: ActiveChatItem[] = [];
    let list2: ActiveChatItem[] = [];

    const mergeLists = () => {
      const combined = [...list1, ...list2];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setActiveChats(unique);

      // If the selected chat is no longer active, close the window
      if (selectedChatId && !unique.some(c => c.id === selectedChatId)) {
        setSelectedChatId(null);
      }
    };

    const unsub1 = onSnapshot(qRequester, (snapshot) => {
      list1 = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as ActiveChatItem[];
      mergeLists();
    }, (err) => console.error('Error listening requester chats:', err));

    const unsub2 = onSnapshot(qReceiver, (snapshot) => {
      list2 = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as ActiveChatItem[];
      mergeLists();
    }, (err) => console.error('Error listening receiver chats:', err));

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUserId, selectedChatId]);

  // 2. Fetch missing user profiles
  useEffect(() => {
    const fetchMissingProfiles = async () => {
      if (!currentUserId || activeChats.length === 0) return;

      const newCache = { ...profilesCache };
      let updated = false;

      for (const chat of activeChats) {
        const otherUid = chat.requesterId === currentUserId ? chat.receiverId : chat.requesterId;
        if (!newCache[otherUid]) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherUid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              newCache[otherUid] = {
                username: uData.riotId || uData.username || 'Oyuncu',
                profilePicBase64: uData.profilePicBase64 || null,
              };
            } else {
              newCache[otherUid] = {
                username: 'Bilinmeyen Oyuncu',
                profilePicBase64: null,
              };
            }
            updated = true;
          } catch (e) {
            console.warn('Error fetching profile for chat:', e);
          }
        }
      }

      if (updated) {
        setProfilesCache(newCache);
      }
    };

    fetchMissingProfiles();
  }, [activeChats, currentUserId, profilesCache]);

  // 3. Automatically open or select chat if only one is available
  useEffect(() => {
    if (activeChats.length === 1 && !selectedChatId) {
      setSelectedChatId(activeChats[0].id);
    } else if (activeChats.length === 0) {
      setSelectedChatId(null);
      setIsOpen(false);
    }
  }, [activeChats, selectedChatId]);

  // 4. Listen to messages for the selected chat
  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesRef = collection(db, 'requests', selectedChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: MessageItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedMessages.push({
          id: docSnap.id,
          senderId: data.senderId,
          content: data.content,
          createdAt: data.createdAt,
        });
      });

      setMessages(fetchedMessages);
      setLoadingMessages(false);

      // Trigger notification badge if chat is collapsed and new message arrived from other user
      if (fetchedMessages.length > 0 && !isOpen) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg.senderId !== currentUserId) {
          setHasNewMessage(true);
        }
      }

      // Auto scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, (error) => {
      console.error('Error listening to chat messages:', error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedChatId, isOpen, currentUserId]);

  const handleSend = async () => {
    if (!selectedChatId || !inputText.trim() || !currentUserId) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const messagesRef = collection(db, 'requests', selectedChatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUserId,
        content: textToSend,
        createdAt: serverTimestamp(),
      });
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Render helpers
  const getOtherUser = (chat: ActiveChatItem): { uid: string; profile: UserProfile } => {
    const otherUid = chat.requesterId === currentUserId ? chat.receiverId : chat.requesterId;
    const profile = profilesCache[otherUid] || { username: 'Yükleniyor...', profilePicBase64: null };
    return { uid: otherUid, profile };
  };

  // If there are no active accepted chats, don't show the widget at all
  if (activeChats.length === 0) {
    return null;
  }

  // Find the selected chat item
  const selectedChat = activeChats.find(c => c.id === selectedChatId);
  const otherParticipant = selectedChat ? getOtherUser(selectedChat) : null;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.wrapper, 
        isWeb ? styles.webWrapper : styles.mobileWrapper,
        isOpen && styles.expandedWrapper
      ]}
    >
      {/* COLLAPSED CHAT BUBBLE */}
      {!isOpen && (
        <TouchableOpacity 
          style={styles.chatBubble}
          onPress={() => {
            setIsOpen(true);
            setHasNewMessage(false);
          }}
        >
          <Ionicons name="chatbubbles" size={24} color="#0F1923" />
          <Text style={styles.bubbleText}>Lobi DM</Text>
          {hasNewMessage && <View style={styles.badgeDot} />}
        </TouchableOpacity>
      )}

      {/* EXPANDED CHAT BOX */}
      {isOpen && (
        <View style={styles.chatBox}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {activeChats.length > 1 && selectedChatId && (
                <TouchableOpacity 
                  onPress={() => setSelectedChatId(null)}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={20} color={Colors.text} />
                </TouchableOpacity>
              )}
              {otherParticipant ? (
                <View style={styles.userHeader}>
                  {otherParticipant.profile.profilePicBase64 ? (
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${otherParticipant.profile.profilePicBase64}` }} 
                      style={styles.headerAvatar} 
                    />
                  ) : (
                    <View style={styles.headerAvatarPlaceholder}>
                      <Ionicons name="person" size={14} color={Colors.gray} />
                    </View>
                  )}
                  <Text style={styles.headerName} numberOfLines={1}>
                    {otherParticipant.profile.username}
                  </Text>
                </View>
              ) : (
                <Text style={styles.headerTitle}>Sohbetler ({activeChats.length})</Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={() => setIsOpen(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={Colors.gray} />
            </TouchableOpacity>
          </View>

          {/* CONTENT AREA */}
          <View style={styles.content}>
            
            {/* 1. CHAT LIST (If multiple and none selected) */}
            {activeChats.length > 1 && !selectedChatId ? (
              <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.listSectionTitle}>Aktif Oyuncular</Text>
                {activeChats.map((chat) => {
                  const { profile } = getOtherUser(chat);
                  return (
                    <TouchableOpacity
                      key={chat.id}
                      style={styles.chatRow}
                      onPress={() => setSelectedChatId(chat.id)}
                    >
                      {profile.profilePicBase64 ? (
                        <Image 
                          source={{ uri: `data:image/jpeg;base64,${profile.profilePicBase64}` }} 
                          style={styles.rowAvatar} 
                        />
                      ) : (
                        <View style={styles.rowAvatarPlaceholder}>
                          <Ionicons name="person" size={18} color={Colors.gray} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>{profile.username}</Text>
                        <Text style={styles.rowSubtext}>Mesaj göndermek için dokunun</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.gray} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : selectedChatId ? (
              
              /* 2. CONVERSATION VIEW */
              <>
                {loadingMessages ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : (
                  <ScrollView 
                    ref={scrollViewRef}
                    style={styles.messagesScroll}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                  >
                    {messages.length === 0 ? (
                      <View style={styles.emptyMessages}>
                        <Ionicons name="chatbubble-ellipses-outline" size={28} color={Colors.gray} />
                        <Text style={styles.emptyText}>Henüz mesaj yok. İlk mesajı siz yazın!</Text>
                      </View>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.senderId === currentUserId;
                        return (
                          <View 
                            key={msg.id} 
                            style={[
                              styles.messageBubbleWrapper, 
                              isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper
                            ]}
                          >
                            <View 
                              style={[
                                styles.messageBubble, 
                                isMe ? styles.myBubble : styles.otherBubble
                              ]}
                            >
                              <Text style={isMe ? styles.myBubbleText : styles.otherBubbleText}>
                                {msg.content}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                )}

                {/* TEXT INPUT FOOTER */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Mesaj yaz..."
                    placeholderTextColor={Colors.gray}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    multiline={false}
                  />
                  <TouchableOpacity 
                    style={styles.sendBtn}
                    onPress={handleSend}
                  >
                    <Ionicons name="send" size={16} color="#0F1923" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.centerContainer}>
                <Text style={{ color: Colors.gray }}>Sohbet seçilmedi.</Text>
              </View>
            )}

          </View>

        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 9999,
  },
  webWrapper: {
    bottom: 24,
    right: 24,
  },
  mobileWrapper: {
    bottom: Platform.OS === 'ios' ? 175 : 145, // Places it cleanly above the bottom tabs and verification toast
    right: 16,
  },
  expandedWrapper: {
    // When open, give it proper dimensions
    width: Platform.OS === 'web' ? 320 : '90%',
    maxWidth: 340,
  },
  chatBubble: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  bubbleText: {
    color: '#0F1923',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: '#0F1923',
  },
  chatBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
    overflow: 'hidden',
    height: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#16191B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  backButton: {
    padding: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  headerAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  closeButton: {
    padding: 2,
  },
  content: {
    flex: 1,
    backgroundColor: '#0F1923',
  },
  listScroll: {
    flex: 1,
    padding: 12,
  },
  listSectionTitle: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
    gap: 10,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  rowAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowSubtext: {
    color: Colors.gray,
    fontSize: 10,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    gap: 8,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 12,
    textAlign: 'center',
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 2,
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  otherBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '75%',
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  myBubbleText: {
    color: '#0F1923',
    fontSize: 13,
    fontWeight: '600',
  },
  otherBubbleText: {
    color: Colors.text,
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F1923',
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 13,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
