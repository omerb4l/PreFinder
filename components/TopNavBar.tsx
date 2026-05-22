import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Image } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

interface TopNavBarProps {
  onOpenNotifications: () => void;
  hasUnread?: boolean;
}

export const TopNavBar = ({ onOpenNotifications, hasUnread = false }: TopNavBarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user: any) => {
      if (user) {
        const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setProfilePic(doc.data().profilePicBase64 || null);
          }
        });
        return () => unsubUser();
      } else {
        setProfilePic(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <View style={styles.topNav}>
      <View style={styles.navLeft}>
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.logoText}>
            Pre<Text style={styles.logoAccent}>Finder</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {isWeb && (
        <View style={styles.navCenter}>
          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.navLinkText, isActive('/') && styles.navLinkActive]}>
              Oyuncu Bul
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => router.push('/report')}
          >
            <Text style={[styles.navLinkText, isActive('/report') && styles.navLinkActive]}>
              Oyuncu Şikayet Et
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink}>
            <Text style={styles.navLinkText}>Forum</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.navRight}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={onOpenNotifications}
        >
          <View>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {hasUnread && <View style={styles.badge} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.profileBox}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.profileAvatarSmall}>
            {profilePic ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${profilePic}` }} 
                style={styles.avatarImage} 
              />
            ) : (
              <Ionicons name="person" size={18} color={Colors.gray} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topNav: {
    height: 70,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 100,
  },
  navLeft: {
    flex: 1,
  },
  navCenter: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  navRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  logoAccent: {
    color: Colors.primary,
  },
  navLink: {
    paddingVertical: 8,
  },
  navLinkText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  navLinkActive: {
    color: Colors.primary,
  },
  iconButton: {
    padding: 4,
  },
  profileBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2E33',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileAvatarSmall: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
});
