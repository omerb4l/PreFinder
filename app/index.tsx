import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Colors } from '@/constants/theme';

export default function Index() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.isBanned === true) {
              router.replace('/login');
              return;
            }
            if (data.rank) {
              router.replace('/(tabs)');
            } else {
              router.replace('/verification');
            }
          } else {
            router.replace('/verification');
          }
        } catch (e) {
          console.error("Error in index auth check:", e);
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1923', // matching Valorant theme background
    justifyContent: 'center',
    alignItems: 'center',
  },
});
