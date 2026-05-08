import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions, Platform, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS, RankType } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

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
  avatarUrl 
}: LobbyCardProps) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const [isRequested, setIsRequested] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [creatorName, setCreatorName] = useState('Yükleniyor...');
  const [creatorPhoto, setCreatorPhoto] = useState<string | null>(null);

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

    setIsRequesting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        lobbyId,
        requesterId: currentUser.uid,
        receiverId: creatorId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setIsRequested(true);
    } catch (error) {
      console.error('Error sending request:', error);
      if (Platform.OS === 'web') window.alert('İstek gönderilemedi. Lütfen tekrar deneyin.');
      else Alert.alert('Hata', 'İstek gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsRequesting(false);
    }
  };

  const RankDisplay = () => (
    <View style={styles.rankContainer}>
      <Image source={minRankInfo.icon} style={styles.rankIcon} />
      <Ionicons name="arrow-forward" size={12} color={Colors.gray} style={{ marginHorizontal: 4 }} />
      <Image source={maxRankInfo.icon} style={styles.rankIcon} />
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webCard}>
        <View style={styles.webLeft}>
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
        </View>

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
          {description && <Text style={styles.descriptionText} numberOfLines={1}>{description}</Text>}
        </View>

        <View style={styles.webCenterRight}>
          <RankDisplay />
        </View>

        <View style={styles.webRight}>
          {isOwnLobby ? (
            <View style={styles.ownLobbyBadge}>
              <Text style={styles.ownLobbyText}>Senin Lobin</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, isRequested && styles.actionButtonDisabled]} 
              activeOpacity={0.7}
              onPress={handleSendRequest}
              disabled={isRequested || isRequesting}
            >
              {isRequesting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={[styles.actionButtonText, isRequested && styles.actionButtonTextDisabled]}>
                  {isRequested ? 'İstek Gönderildi' : 'İstek Gönder'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.leftSection}>
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
      </View>

      <View style={styles.middleSection}>
        <View style={styles.mobileModeBadge}>
          <Text style={styles.mobileModeText}>{gameMode}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.missingPlayersText}>{missingPlayers}</Text>
          <Text style={styles.roleTextMobile}> • {roleInfo}</Text>
        </View>
        
        {description && (
          <Text style={styles.descriptionTextMobile} numberOfLines={2}>
            "{description}"
          </Text>
        )}
        
        <View style={styles.rankWrapperMobile}>
          <RankDisplay />
        </View>
      </View>

      <View style={styles.rightSection}>
        {isOwnLobby ? (
          <View style={styles.ownLobbyBadge}>
            <Text style={styles.ownLobbyText}>Senin Lobin</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.actionButton, isRequested && styles.actionButtonDisabled]} 
            activeOpacity={0.7}
            onPress={handleSendRequest}
            disabled={isRequested || isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={[styles.actionButtonText, isRequested && styles.actionButtonTextDisabled]}>
                {isRequested ? 'İstek Gönderildi' : 'İstek Gönder'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
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
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 20,
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    width: '100%',
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
});
