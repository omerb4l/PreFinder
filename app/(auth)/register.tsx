import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthCard } from '@/components/AuthCard';
import { CustomTextInput } from '@/components/CustomTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Link, router } from 'expo-router';
import { auth, db } from '@/firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Kullanıcı adı boş bırakılamaz.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('E-posta boş bırakılamaz.');
      return;
    }
    if (!password) {
      setErrorMsg('Şifre boş bırakılamaz.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Şifreler birbirleriyle eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Send email verification
      await sendEmailVerification(user);

      // Create user document in Firestore (users collection, doc ID = UID)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username: username.trim(),
        createdAt: serverTimestamp(),
        // Riot ID, rank, and agents will be set later in the Profile screen
        riotId: null,
        rank: null,
        mainAgents: [],
      });

      // Sign out after registration to force login with verification check
      await signOut(auth);

      if (Platform.OS === 'web') {
        window.alert('Onay Gerekli: E-posta adresinize bir onay linki gönderildi. Lütfen mailinizi onayladıktan sonra giriş yapın.');
        router.replace('/login');
      } else {
        Alert.alert(
          'Onay Gerekli',
          'E-posta adresinize bir onay linki gönderildi. Lütfen mailinizi onayladıktan sonra giriş yapın.',
          [{ text: 'Tamam', onPress: () => router.replace('/login') }]
        );
      }
    } catch (error: any) {
      const msg =
        error.code === 'auth/email-already-in-use'
          ? 'Bu e-posta adresi zaten kullanımda.'
          : error.code === 'auth/invalid-email'
          ? 'Geçersiz e-posta adresi.'
          : error.code === 'auth/weak-password'
          ? 'Şifreniz çok zayıf. Daha güçlü bir şifre deneyin.'
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
            <Text style={styles.title}>Kayıt Ol</Text>
          </View>

          <View style={styles.form}>
            <CustomTextInput
              label="Kullanıcı Adı"
              placeholder="Kullanıcı adınızı belirleyin"
              value={username}
              onChangeText={(t) => { setUsername(t); setErrorMsg(''); }}
              autoCapitalize="none"
            />
            
            <View style={styles.inputGroup}>
              <CustomTextInput
                label="E-posta"
                placeholder="E-postanızı girin"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.infoText}>
                Kayıt olduktan sonra hesabınızı doğrulama ekranına yönlendirileceksiniz.
              </Text>
            </View>

            <CustomTextInput
              label="Şifre"
              placeholder="Şifrenizi belirleyin (en az 6 karakter)"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
              secureTextEntry
            />
            
            <CustomTextInput
              label="Şifre Tekrar"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setErrorMsg(''); }}
              secureTextEntry
            />

            {/* Inline error message — works on both Web and Mobile */}
            {errorMsg !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {errorMsg}</Text>
              </View>
            )}

            <PrimaryButton 
              title="Hesap Oluştur" 
              onPress={handleRegister} 
              loading={loading}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Zaten hesabın var mı? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Giriş Yap</Text>
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
    alignItems: 'flex-start',
    marginBottom: 32,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  infoText: {
    color: Colors.gray,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 18,
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
