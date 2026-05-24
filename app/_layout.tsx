import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform } from 'react-native';
import 'react-native-reanimated';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';

import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const [themeMode, setThemeMode] = useState(getThemeMode());

  useEffect(() => {
    const unsubscribe = subscribeTheme((newTheme) => {
      setThemeMode(newTheme);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const root = document.documentElement;
      root.style.setProperty('--background', '#0F1923');
      root.style.setProperty('--surface', '#1F2326');
      root.style.setProperty('--primary', '#00FF87');
      root.style.setProperty('--text', '#ECE8E1');
      root.style.setProperty('--gray', '#8B97A3');
    }
  }, []);

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

  const navTheme = {
    ...(themeMode === 'light' ? DefaultTheme : DarkTheme),
    colors: {
      ...(themeMode === 'light' ? DefaultTheme.colors : DarkTheme.colors),
      background: Colors.background,
      card: Colors.surface,
      text: Colors.text,
    }
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
    </ThemeProvider>
  );
}
