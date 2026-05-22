import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { TopNavBar } from '@/components/TopNavBar';
import { NotificationsModal } from '@/components/NotificationsModal';
import { CreateLobbyModal } from '@/components/CreateLobbyModal';
import { PlayerVerificationToast } from '@/components/PlayerVerificationToast';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qIncoming = query(
      collection(db, 'requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const qAccepted = query(
      collection(db, 'requests'),
      where('requesterId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    let incomingCount = 0;
    let acceptedCount = 0;

    const unsubIncoming = onSnapshot(qIncoming, (snapshot) => {
      incomingCount = snapshot.docs.length;
      setUnreadCount(incomingCount + acceptedCount);
    });

    const unsubAccepted = onSnapshot(qAccepted, (snapshot) => {
      acceptedCount = snapshot.docs.length;
      setUnreadCount(incomingCount + acceptedCount);
    });

    return () => {
      unsubIncoming();
      unsubAccepted();
    };
  }, []);

  // Mobile Header Component
  const MobileHeader = () => (
    <SafeAreaView style={styles.mobileHeaderWrapper}>
      <View style={styles.mobileHeader}>
        <Text style={styles.logoText}>
          Pre<Text style={styles.logoAccent}>Finder</Text>
        </Text>
        <TouchableOpacity 
          onPress={() => setIsNotificationsOpen(true)}
          style={styles.iconButton}
        >
          <View>
            <Ionicons name="notifications-outline" size={24} color={Colors.text} />
            {unreadCount > 0 && <View style={styles.badge} />}
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      {/* Conditional Desktop Nav */}
      {!isMobile && (
        <TopNavBar 
          onOpenNotifications={() => setIsNotificationsOpen(true)} 
          hasUnread={unreadCount > 0} 
        />
      )}
      
      {/* Conditional Mobile Header */}
      {isMobile && <MobileHeader />}
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.gray,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopWidth: 1,
            borderTopColor: Colors.surface,
            height: Platform.OS === 'ios' ? 88 : 65,
            paddingBottom: Platform.OS === 'ios' ? 30 : 10,
            display: isMobile ? 'flex' : 'none',
          },
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Ana Sayfa',
            tabBarIcon: ({ color }) => <Ionicons size={24} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="forum"
          options={{
            title: 'Forum',
            tabBarIcon: ({ color }) => <Ionicons size={24} name="chatbubbles-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: 'Lobi Kur',
            tabBarIcon: () => (
              <View style={styles.createTabButton}>
                <Ionicons size={24} name="add" color="#0F1923" />
              </View>
            ),
            tabBarLabel: () => null,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setIsLobbyModalOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Rapor Et',
            tabBarIcon: ({ color }) => <Ionicons size={24} name="flag-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => <Ionicons size={24} name="person" color={color} />,
          }}
        />
      </Tabs>

      <NotificationsModal 
        isVisible={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />

      <CreateLobbyModal 
        isVisible={isLobbyModalOpen} 
        onClose={() => setIsLobbyModalOpen(false)} 
      />

      <PlayerVerificationToast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mobileHeaderWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  mobileHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  logoAccent: {
    color: Colors.primary,
  },
  iconButton: {
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  createTabButton: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
