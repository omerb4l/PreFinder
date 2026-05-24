import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { VALORANT_RANKS, RankType } from '@/constants/ranks';

interface NotificationsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

interface AppNotification {
  id: string;
  type: 'incoming' | 'accepted';
  lobbyId: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: any;
  partyCode?: string;
  requesterName?: string;
  requesterPhoto?: string;
  requesterRank?: RankType;
  requesterVerified?: boolean;
}

export const NotificationsModal = ({ isVisible, onClose }: NotificationsModalProps) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Listen for Incoming Pending Requests
    const qIncoming = query(
      collection(db, 'requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubIncoming = onSnapshot(qIncoming, async (snapshot) => {
      try {
        const incomingPromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (!data) return null;

          let requesterName = 'Bilinmeyen';
          let requesterPhoto = null;
          let requesterRank: RankType = 'platinum';
          let requesterVerified = false;
          
          try {
            const userRef = doc(db, 'users', data.requesterId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const uData = userSnap.data();
              requesterName = uData.username || 'Bilinmeyen';
              requesterPhoto = uData.profilePicBase64 || null;
              requesterRank = uData.rank || 'platinum';
              requesterVerified = uData.verificationStatus === 'verified';
            }
          } catch (err) {
            console.warn(`Could not fetch data for requester ${data.requesterId}:`, err);
          }

          return {
            id: docSnap.id,
            type: 'incoming' as const,
            ...data,
            requesterName,
            requesterPhoto,
            requesterRank,
            requesterVerified
          } as AppNotification;
        });

        const incomingData = (await Promise.all(incomingPromises)).filter(Boolean) as AppNotification[];
        updateNotifications('incoming', incomingData);
      } catch (error: any) {
        console.error('Firestore Incoming Snapshot Error:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Firestore Incoming Listener Error:', error);
      setLoading(false);
    });

    // 2. Listen for Accepted Requests (where user is requester)
    const qAccepted = query(
      collection(db, 'requests'),
      where('requesterId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubAccepted = onSnapshot(qAccepted, async (snapshot) => {
      try {
        const acceptedDataPromises = snapshot.docs.map(async (requestDoc) => {
          const data = requestDoc.data();
          if (!data) return null;
          let partyCode = 'Bilinmiyor';
          
          try {
            if (data.lobbyId) {
              const lobbyRef = doc(db, 'lobbies', data.lobbyId);
              const lobbySnap = await getDoc(lobbyRef);
              if (lobbySnap.exists() && lobbySnap.data().partyCode) {
                partyCode = lobbySnap.data().partyCode;
              }
            }
          } catch (err) {
            console.warn(`Could not fetch party code for lobby ${data.lobbyId}:`, err);
          }

          return {
            id: requestDoc.id,
            type: 'accepted' as const,
            ...data,
            partyCode
          } as AppNotification;
        });

        const acceptedData = (await Promise.all(acceptedDataPromises)).filter(Boolean) as AppNotification[];
        updateNotifications('accepted', acceptedData);
      } catch (error: any) {
        console.error('Firestore Accepted Snapshot Error:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Firestore Accepted Listener Error:', error);
      setLoading(false);
    });

    // Helper to merge the two streams
    let currentIncoming: AppNotification[] = [];
    let currentAccepted: AppNotification[] = [];

    const updateNotifications = (type: 'incoming' | 'accepted', data: AppNotification[]) => {
      if (type === 'incoming') currentIncoming = data;
      else currentAccepted = data;
      
      const combined = [...currentIncoming, ...currentAccepted].sort((a, b) => {
        const tA = a.createdAt?.toMillis() || 0;
        const tB = b.createdAt?.toMillis() || 0;
        return tB - tA; // Newest first
      });
      
      setNotifications(combined);
      setLoading(false);
    };

    return () => {
      unsubIncoming();
      unsubAccepted();
    };
  }, []);

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    if (Platform.OS === 'web') window.alert('Kod kopyalandı: ' + code);
  };

  const handleAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, { status: action });
    } catch (error) {
      console.error('Error updating request:', error);
      if (Platform.OS === 'web') window.alert('İşlem başarısız oldu.');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <Animated.View 
          entering={FadeInDown.duration(300)}
          style={styles.container}
        >
          <TouchableOpacity activeOpacity={1} style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Bildirimler</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Şu an yeni bir bildiriminiz yok.</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <View key={notif.id} style={styles.notifItem}>
                    
                    {/* INCOMING REQUEST */}
                    {notif.type === 'incoming' && (
                      <>
                        <View style={styles.notifHeader}>
                          <Ionicons name="people" size={16} color="#3498db" />
                          <Text style={styles.notifTime}>Yeni İstek</Text>
                        </View>
                        
                        <View style={styles.requesterCard}>
                          <TouchableOpacity 
                            style={styles.requesterInfo}
                            onPress={() => {
                              onClose();
                              router.push({ pathname: '/profile', params: { targetUserId: notif.requesterId } });
                            }}
                          >
                            {notif.requesterPhoto ? (
                              <Image 
                                source={{ uri: `data:image/jpeg;base64,${notif.requesterPhoto}` }} 
                                style={styles.requesterAvatar} 
                              />
                            ) : (
                              <View style={styles.requesterAvatarPlaceholder}>
                                <Ionicons name="person" size={20} color={Colors.gray} />
                              </View>
                            )}
                            <View>
                              <Text style={styles.requesterName}>{notif.requesterName}</Text>
                              <View style={styles.rankBadgeSmall}>
                                {notif.requesterRank && (
                                  <Image 
                                    source={VALORANT_RANKS[notif.requesterRank].icon} 
                                    style={styles.rankIconSmall} 
                                  />
                                )}
                                <Text style={styles.rankTextSmall}>
                                  {notif.requesterRank ? VALORANT_RANKS[notif.requesterRank].name : 'Belirsiz'}
                                </Text>
                                {notif.requesterVerified && (
                                  <Ionicons name="checkmark-circle" size={12} color="#00FF87" style={{ marginLeft: 4 }} />
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.notifText}>Bu oyuncu lobinize katılmak istiyor.</Text>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity 
                            style={[styles.btn, styles.acceptBtn]}
                            onPress={() => handleAction(notif.id, 'accepted')}
                          >
                            <Text style={styles.acceptBtnText}>Kabul Et</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.btn, styles.rejectBtn]}
                            onPress={() => handleAction(notif.id, 'rejected')}
                          >
                            <Text style={styles.rejectBtnText}>Reddet</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {/* ACCEPTED REQUEST */}
                    {notif.type === 'accepted' && (
                      <>
                        <View style={styles.notifHeader}>
                          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                          <Text style={styles.notifTime}>Kabul Edildi</Text>
                        </View>
                        <Text style={styles.notifText}>
                          İsteğiniz kabul edildi! Parti Kodu: <Text style={styles.codeText}>{notif.partyCode}</Text>
                        </Text>
                        {!!notif.partyCode && notif.partyCode !== 'Bilinmiyor' && (
                          <TouchableOpacity 
                            style={styles.copyBtn}
                            onPress={() => copyToClipboard(notif.partyCode!)}
                          >
                            <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                            <Text style={styles.copyBtnText}>Kodu Kopyala</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 35, 0.4)',
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'center',
    paddingTop: Platform.OS === 'web' ? 80 : 0,
    paddingRight: Platform.OS === 'web' ? 40 : 0,
  },
  container: {
    width: '90%',
    maxWidth: 350,
  },
  content: {
    backgroundColor: '#1F2326',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
    paddingBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
  },
  notifItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notifTime: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  notifText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  requesterCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  requesterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requesterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  requesterAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requesterName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rankBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rankIconSmall: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  rankTextSmall: {
    color: Colors.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  codeText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  copyBtnText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rejectBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
