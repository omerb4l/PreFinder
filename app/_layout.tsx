import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Platform } from 'react-native';
import 'react-native-reanimated';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';

import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const [themeMode, setThemeMode] = useState(getThemeMode());
  const [authInitialized, setAuthInitialized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const segments = useSegments();

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

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthInitialized(true);

      if (firebaseUser) {
        // Real-time listener for the user's document to enforce ban instantly
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
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

  // Auth Guard & Auto-Login Routing
  useEffect(() => {
    if (!authInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      // If the user is NOT logged in, and NOT in the (auth) group, redirect them to /login
      if (!inAuthGroup) {
        router.replace('/login');
      }
    } else {
      // If the user IS logged in, and IS in the (auth) group, check their profile status and redirect
      if (inAuthGroup) {
        const checkUserRankAndRedirect = async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.rank) {
                router.replace('/(tabs)');
              } else {
                router.replace('/verification');
              }
            } else {
              router.replace('/verification');
            }
          } catch (e) {
            console.error("Error checking user rank on auto-login:", e);
            // Default fallback
            router.replace('/(tabs)');
          }
        };

        checkUserRankAndRedirect();
      }
    }
  }, [authInitialized, user, segments]);

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
