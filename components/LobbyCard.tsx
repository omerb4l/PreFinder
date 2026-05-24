import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions, Platform, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS, RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc, deleteDoc, query, where, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { ReportModal } from '@/components/ReportModal';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AnimatedTouchable } from './AnimatedTouchable';

interface LobbyCardProps {
  lobbyId: string;
  creatorId: string;
  gameMode: string;
  missingPlayers: string;
  roleInfo: string;
  minRank: RankType;
  maxRank: RankType;
  description?: string;
  rating: string;
  avatarUrl?: string;
  index?: number;
}

export const LobbyCard = ({
  lobbyId,
  creatorId,
  gameMode,
  missingPlayers,
  roleInfo,
  minRank,
  maxRank,
  description,
  rating,
  avatarUrl,
  index
}: LobbyCardProps) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'pending' | 'accepted' | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [creatorName, setCreatorName] = useState('Yükleniyor...');
  const [creatorPhoto, setCreatorPhoto] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    const fetchCreatorData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', creatorId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCreatorName(data.username || 'Bilinmeyen');
          setCreatorPhoto(data.profilePicBase64 || null);
        }
      } catch (error) {
        console.error('Error fetching creator data:', error);
      }
    };
    fetchCreatorData();
  }, [creatorId]);

  // Listen for existing request from current user (both pending and accepted)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'requests'),
      where('lobbyId', '==', lobbyId),
      where('requesterId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setRequestId(docSnap.id);
        setRequestStatus(docSnap.data().status as 'pending' | 'accepted');
      } else {
        setRequestId(null);
        setRequestStatus(null);
      }
    });

    return () => unsubscribe();
  }, [lobbyId]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const minRankInfo = VALORANT_RANKS[minRank];
  const maxRankInfo = VALORANT_RANKS[maxRank];

  const currentUser = auth.currentUser;
  const isOwnLobby = currentUser && currentUser.uid === creatorId;

  const handleSendRequest = async () => {
    if (!currentUser) {
      if (Platform.OS === 'web') window.alert('İstek göndermek için giriş yapmalısınız.');
      else Alert.alert('Hata', 'İstek göndermek için giriş yapmalısınız.');
      return;
    }

    if (cooldown > 0) return;

    setIsRequesting(true);
    try {
      // Check user verificationStatus
      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData.verificationStatus !== 'verified') {
          setIsRequesting(false);
          const alertMsg = "Lobilere katılmak için hesabınızın admin tarafından onaylanması gerekmektedir.";
          if (Platform.OS === 'web') {
            window.alert(alertMsg);
          } else {
            Alert.alert("Hata", alertMsg);
          }
          return;
        }
      }

      await addDoc(collection(db, 'requests'), {
        lobbyId,
        requesterId: currentUser.uid,
        receiverId: creatorId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending request:', error);
      if (Platform.OS === 'web') window.alert('İstek gönderilemedi.');
      else Alert.alert('Hata', 'İstek gönderilemedi.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;

    setIsRequesting(true);
    try {
      await deleteDoc(doc(db, 'requests', requestId));
      setCooldown(10); // 10 second cooldown
    } catch (error) {
      console.error('Error canceling request:', error);
      if (Platform.OS === 'web') window.alert('İstek iptal edilemedi.');
      else Alert.alert('Hata', 'İstek iptal edilemedi.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCloseLobby = async () => {
    const confirmClose = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Bu lobiyi kapatmak istediğinize emin misiniz? Tüm gelen istekler de silinecektir.'));
        } else {
          Alert.alert(
            'Lobiyi Kapat',
            'Bu lobiyi kapatmak istediğinize emin misiniz? Tüm gelen istekler de silinecektir.',
            [
              { text: 'Vazgeç', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Lobiyi Kapat', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        }
      });
    };

    const confirmed = await confirmClose();
    if (!confirmed) return;

    setIsClosing(true);
    try {
      // 1. Delete associated requests
      const q = query(collection(db, 'requests'), where('lobbyId', '==', lobbyId));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((requestDoc) => {
        batch.delete(requestDoc.ref);
      });
      await batch.commit();

      // 2. Delete the lobby itself
      await deleteDoc(doc(db, 'lobbies', lobbyId));

      if (Platform.OS === 'web') window.alert('Lobi başarıyla kapatıldı.');
    } catch (error) {
      console.error('Error closing lobby:', error);
      const msg = 'Lobi kapatılamadı. Lütfen tekrar deneyin.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Hata', msg);
    } finally {
      setIsClosing(false);
    }
  };

  const RankDisplay = () => (
    <View style={styles.rankContainer}>
      <Image source={minRankInfo.icon} style={styles.rankIcon} />
      <Ionicons name="arrow-forward" size={12} color={Colors.gray} style={{ marginHorizontal: 4 }} />
      <Image source={maxRankInfo.icon} style={styles.rankIcon} />
    </View>
  );

  const renderActionButton = () => {
    if (isOwnLobby) {
      return (
        <AnimatedTouchable
          style={[styles.actionButton, styles.closeLobbyBtn]}
          onPress={handleCloseLobby}
          disabled={isClosing}
        >
          {isClosing ? (
            <ActivityIndicator size="small" color="#FF4655" />
          ) : (
            <Text style={styles.closeLobbyText}>{isWeb ? 'Lobiyi Kapat' : 'Kapat'}</Text>
          )}
        </AnimatedTouchable>
      );
    }

    if (requestStatus === 'accepted') {
      return (
        <View style={[styles.actionButton, styles.acceptedBtn, styles.glowPrimary]}>
          <Text style={styles.acceptedBtnText}>Kabul Edildi</Text>
        </View>
      );
    }

    if (requestId && requestStatus === 'pending') {
      return (
        <AnimatedTouchable
          style={[styles.actionButton, styles.cancelBtn]}
          onPress={handleCancelRequest}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <ActivityIndicator size="small" color="#FF4655" />
          ) : (
            <Text style={styles.cancelBtnText}>İptal Et</Text>
          )}
        </AnimatedTouchable>
      );
    }

    if (cooldown > 0) {
      return (
        <View style={[styles.actionButton, styles.cooldownBtn]}>
          <Text style={styles.cooldownText}>{cooldown}s</Text>
        </View>
      );
    }

    return (
      <AnimatedTouchable
        style={[styles.actionButton, styles.glowPrimary]}
        onPress={handleSendRequest}
        disabled={isRequesting}
      >
        {isRequesting ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={styles.actionButtonText}>İstek Gönder</Text>
        )}
      </AnimatedTouchable>
    );
  };

  const glassBg = Colors.surface === '#F5F2EC' 
    ? 'rgba(245, 242, 236, 0.65)' 
    : 'rgba(31, 35, 38, 0.45)';

  const glassBorder = Colors.surface === '#F5F2EC'
    ? 'rgba(15, 25, 35, 0.06)'
    : 'rgba(255, 255, 255, 0.08)';

  if (isWeb) {
    return (
      <Animated.View 
        entering={FadeInDown.duration(500).delay(Math.min((index || 0) * 80, 600)).springify().damping(15)}
        style={[
          styles.webCard,
          { backgroundColor: glassBg, borderColor: glassBorder },
          Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } as any : {}
        ]}
      >
        {Platform.OS !== 'web' && (
          <BlurView 
            intensity={20} 
            tint={Colors.surface === '#F5F2EC' ? 'light' : 'dark'} 
            style={StyleSheet.absoluteFill} 
          />
        )}
        <TouchableOpacity 
          style={styles.webLeft}
          onPress={() => {
            router.push({ pathname: '/profile', params: { targetUserId: creatorId } });
          }}
        >
          <View style={styles.avatarPlaceholderSmall}>
            {creatorPhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${creatorPhoto}` }}
                style={styles.avatarSmall}
              />
            ) : (
              <Ionicons name="person" size={18} color={Colors.gray} />
            )}
          </View>
          <View>
            <Text style={styles.webIdText}>{creatorName}</Text>
            <Text style={styles.webRatingText}>⭐ {rating}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.webCenterLeft}>
          <View style={styles.row}>
            <View style={styles.webModeBadge}>
              <Text style={styles.webModeText}>{gameMode}</Text>
            </View>
            <View style={styles.missingBadgeSmall}>
              <Text style={styles.missingTextSmall}>{missingPlayers}</Text>
            </View>
            <Text style={styles.webRoleText}>{roleInfo}</Text>
          </View>
          {!!description && <Text style={styles.descriptionText} numberOfLines={1}>{description}</Text>}
        </View>

        <View style={styles.webCenterRight}>
          <RankDisplay />
        </View>

        <View style={styles.webRight}>
          {renderActionButton()}
        </View>
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View 
        entering={FadeInDown.duration(500).delay(Math.min((index || 0) * 80, 600)).springify().damping(15)}
        style={[
          styles.card,
          { backgroundColor: glassBg, borderColor: glassBorder }
        ]}
      >
        {Platform.OS !== 'web' && (
          <BlurView 
            intensity={20} 
            tint={Colors.surface === '#F5F2EC' ? 'light' : 'dark'} 
            style={StyleSheet.absoluteFill} 
          />
        )}
        {!isOwnLobby && (
          <TouchableOpacity
            style={styles.reportFlagBtn}
            onPress={() => setReportModalVisible(true)}
          >
            <Ionicons name="flag-outline" size={20} color={Colors.gray} />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.leftSection}
          onPress={() => {
            router.push({ pathname: '/profile', params: { targetUserId: creatorId } });
          }}
        >
          <View style={styles.avatarPlaceholder}>
            {creatorPhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${creatorPhoto}` }}
                style={styles.avatar}
              />
            ) : (
              <Ionicons name="person" size={24} color={Colors.gray} />
            )}
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {rating}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.middleSection}>
          <TouchableOpacity 
            onPress={() => {
              router.push({ pathname: '/profile', params: { targetUserId: creatorId } });
            }}
          >
            <Text style={styles.mobileNameText}>{creatorName}</Text>
          </TouchableOpacity>
          <View style={styles.mobileModeBadge}>
            <Text style={styles.mobileModeText}>{gameMode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.missingPlayersText}>{missingPlayers}</Text>
            <Text style={styles.roleTextMobile}> • {roleInfo}</Text>
          </View>

          {!!description && (
            <Text style={styles.descriptionTextMobile} numberOfLines={2}>
              {`"${description}"`}
            </Text>
          )}

          <View style={styles.rankWrapperMobile}>
            <RankDisplay />
          </View>
        </View>

        <View style={styles.rightSection}>
          {renderActionButton()}
        </View>
      </Animated.View>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportedUserId={creatorId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rankIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  descriptionText: {
    color: Colors.gray,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  descriptionTextMobile: {
    color: Colors.gray,
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 6,
  },
  missingBadgeSmall: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  missingTextSmall: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  webCard: {
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 95,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  webLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 180,
    gap: 12,
  },
  webCenterLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  webCenterRight: {
    width: 120,
    alignItems: 'center',
  },
  webRight: {
    width: 140,
    alignItems: 'flex-end',
  },
  avatarPlaceholderSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2E33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  webIdText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  webRatingText: {
    color: Colors.gray,
    fontSize: 12,
  },
  webRoleText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  leftSection: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 4, // Align with the start of the text
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2E33',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ratingBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  middleSection: {
    flex: 1,
  },
  mobileNameText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  missingPlayersText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  roleTextMobile: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rankWrapperMobile: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  rightSection: {
    marginLeft: 12,
    paddingTop: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  glowPrimary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    borderColor: Colors.gray,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonTextDisabled: {
    color: Colors.gray,
  },
  ownLobbyBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  ownLobbyText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  closeLobbyBtn: {
    borderColor: '#FF4655',
    backgroundColor: 'rgba(255, 70, 85, 0.05)',
  },
  closeLobbyText: {
    color: '#FF4655',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    borderColor: '#FF4655',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelBtnText: {
    color: '#FF4655',
    fontSize: 13,
    fontWeight: '700',
  },
  cooldownBtn: {
    borderColor: Colors.gray,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cooldownText: {
    color: Colors.gray,
    fontSize: 13,
    fontWeight: '700',
  },
  webModeBadge: {
    backgroundColor: 'rgba(255, 70, 85, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FF4655',
  },
  webModeText: {
    color: '#FF4655',
    fontSize: 10,
    fontWeight: '700',
  },
  mobileModeBadge: {
    backgroundColor: 'rgba(255, 70, 85, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF4655',
  },
  mobileModeText: {
    color: '#FF4655',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  acceptedBtn: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
  },
  acceptedBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  reportFlagBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
    zIndex: 10,
  },
});
