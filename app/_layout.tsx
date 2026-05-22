import React, { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let unsubUserDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Real-time listener for the user's document to enforce ban instantly
        unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.isBanned === true) {
              // Sign out from Firebase Auth
              await signOut(auth);
              
              // Unsubscribe from user document listener
              if (unsubUserDoc) {
                unsubUserDoc();
                unsubUserDoc = undefined;
              }

              // Show alert
              if (Platform.OS === 'web') {
                window.alert("Hesabınız kuralları ihlal ettiği için kalıcı olarak yasaklanmıştır.");
              } else {
                Alert.alert(
                  "Erişim Engellendi",
                  "Hesabınız kuralları ihlal ettiği için kalıcı olarak yasaklanmıştır."
                );
              }
              
              // Redirect to login page
              router.replace('/login');
            }
          }
        });
      } else {
        if (unsubUserDoc) {
          unsubUserDoc();
          unsubUserDoc = undefined;
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
