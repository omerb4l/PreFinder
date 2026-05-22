import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthCard } from '@/components/AuthCard';
import { CustomTextInput } from '@/components/CustomTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Link, router } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('E-posta boş bırakılamaz.');
      return;
    }
    if (!password) {
      setErrorMsg('Şifre boş bırakılamaz.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Email verification check
      if (!user.emailVerified) {
        await signOut(auth);
        setErrorMsg('Lütfen önce e-postanızı onaylayın.');
        setLoading(false);
        return;
      }

      // Check for rank completion and ban status in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.isBanned === true) {
          await signOut(auth);
          setErrorMsg('Hesabınız kuralları ihlal ettiği için kalıcı olarak yasaklanmıştır.');
          setLoading(false);
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
    } catch (error: any) {
      const msg =
        error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
          ? 'E-posta veya şifre hatalı.'
          : error.code === 'auth/user-not-found'
          ? 'Bu e-posta ile kayıtlı bir hesap bulunamadı.'
          : error.code === 'auth/too-many-requests'
          ? 'Çok fazla başarısız deneme. Lütfen biraz bekleyin.'
          : error.message;
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <AuthCard>
          <View style={styles.header}>
            <Text style={styles.title}>
              Pre<Text style={styles.accent}>Finder</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <CustomTextInput
              label="E-posta"
              placeholder="E-postanızı girin"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <CustomTextInput
              label="Şifre"
              placeholder="Şifrenizi girin"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
              secureTextEntry
            />

            {/* Inline error — works on both Web and Mobile */}
            {errorMsg !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {errorMsg}</Text>
              </View>
            )}

            <PrimaryButton 
              title="Giriş Yap" 
              onPress={handleLogin} 
              loading={loading}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabın yok mu? </Text>
              <Link href="/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Kayıt Ol</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </AuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -1,
  },
  accent: {
    color: Colors.primary,
  },
  form: {
    width: '100%',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 70, 85, 0.12)',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: Colors.text,
    fontSize: 14,
    opacity: 0.8,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
