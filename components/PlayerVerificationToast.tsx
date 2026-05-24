import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { verifyPlayerPresence } from '@/services/matchService';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { AnimatedTouchable } from './AnimatedTouchable';

export const PlayerVerificationToast = () => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [loadingName, setLoadingName] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [visibleRequest, setVisibleRequest] = useState<any>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to requests where current user is receiver (leader) and status is 'accepted'
    const q = query(
      collection(db, 'requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Display the first pending accepted request
        const firstDoc = snapshot.docs[0];
        setActiveRequest({ id: firstDoc.id, ...firstDoc.data() });
      } else {
        setActiveRequest(null);
        setPlayerName('');
      }
    }, (error) => {
      console.error('Error listening to accepted requests for toast:', error);
    });

    return () => unsubscribe();
  }, []);

  // Sync animation states
  useEffect(() => {
    if (activeRequest) {
      setVisibleRequest(activeRequest);
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(setVisibleRequest)(null);
        }
      });
      translateY.value = withTiming(50, { duration: 300 });
    }
  }, [activeRequest]);

  // Fetch player details when active request changes
  useEffect(() => {
    if (!visibleRequest) return;

    const fetchPlayerName = async () => {
      setLoadingName(true);
      try {
        const userRef = doc(db, 'users', visibleRequest.requesterId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setPlayerName(data.riotId || data.username || 'Bilinmeyen Oyuncu');
        } else {
          setPlayerName('Bilinmeyen Oyuncu');
        }
      } catch (err) {
        console.error('Error fetching player name for toast:', err);
        setPlayerName('Bilinmeyen Oyuncu');
      } finally {
        setLoadingName(false);
      }
    };

    fetchPlayerName();
  }, [visibleRequest]);

  const handleAction = async (didJoin: boolean) => {
    if (!visibleRequest || processing) return;

    setProcessing(true);
    try {
      await verifyPlayerPresence(
        visibleRequest.lobbyId,
        visibleRequest.receiverId,
        visibleRequest.requesterId,
        didJoin,
        visibleRequest.id
      );
    } catch (err) {
      console.error('Error verifying presence from toast:', err);
    } finally {
      setProcessing(false);
    }
  };

  const animatedWrapperStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  if (!visibleRequest) return null;

  return (
    <Animated.View style={[
      styles.wrapper, 
      isWeb ? styles.webWrapper : styles.mobileWrapper,
      animatedWrapperStyle
    ]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="people-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.title}>Lobi Katılım Kontrolü</Text>
        </View>

        <Text style={styles.text}>
          {loadingName ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
          ) : (
            <Text style={styles.highlight}>{playerName} </Text>
          )}
          lobinize geldi mi?
        </Text>

        <View style={styles.actions}>
          <AnimatedTouchable 
            style={[styles.btn, styles.yesBtn]} 
            onPress={() => handleAction(true)}
            disabled={processing}
          >
            <Text style={styles.yesBtnText}>Evet</Text>
          </AnimatedTouchable>
          <AnimatedTouchable 
            style={[styles.btn, styles.noBtn]} 
            onPress={() => handleAction(false)}
            disabled={processing}
          >
            <Text style={styles.noBtnText}>Hayır</Text>
          </AnimatedTouchable>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  webWrapper: {
    bottom: 24,
    left: 24,
    width: 320,
  },
  mobileWrapper: {
    bottom: Platform.OS === 'ios' ? 95 : 75,
    left: 16,
    width: 280,
  },
  container: {
    backgroundColor: '#1F2326',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.15)',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 8,
  },
  title: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  text: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  highlight: {
    color: Colors.primary,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesBtn: {
    backgroundColor: Colors.primary,
  },
  yesBtnText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  noBtn: {
    backgroundColor: 'rgba(255, 70, 85, 0.1)',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  noBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
