import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, SafeAreaView, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { EditProfileModal } from '@/components/EditProfileModal';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const unsubDoc = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setUserData(doc.data());
          }
          setLoading(false);
        }, (error) => {
          console.error("Snapshot error:", error);
          setLoading(false);
        });
        return () => unsubDoc();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

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
        <Text style={{ color: Colors.text }}>Giriş yapılmış bir hesap bulunamadı.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
          
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{userData.rating || '0.0'} / 5.0</Text>
          </View>

          <View style={styles.rankAgentRow}>
            {userData.rank && VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS] ? (
              <View style={styles.rankBox}>
                <Image source={VALORANT_RANKS[userData.rank as keyof typeof VALORANT_RANKS].icon} style={styles.rankIcon} />
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

          <View style={styles.bioBox}>
            <Text style={styles.bioText}>{userData.bio || 'Henüz bir biyografi eklenmemiş.'}</Text>
          </View>

          <View style={{ height: 24 }} />

          <PrimaryButton 
            title="Profili Düzenle" 
            onPress={() => setIsEditModalVisible(true)} 
            style={{ width: '100%' }}
          />
        </View>

        <EditProfileModal 
          isVisible={isEditModalVisible} 
          onClose={() => setIsEditModalVisible(false)} 
          userData={userData}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
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
  profileHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
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
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 6,
    marginBottom: 20,
  },
  ratingText: {
    color: Colors.gray,
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: 'rgba(15, 25, 35, 0.5)',
    borderRadius: 8,
  },
  bioText: {
    color: Colors.gray,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
