import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthCard } from '@/components/AuthCard';
import { CustomTextInput } from '@/components/CustomTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Link, router } from 'expo-router';
import { auth } from '@/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import AuthBackground from '@/components/AuthBackground';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleResetPassword = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('E-posta boş bırakılamaz.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Geçersiz bir e-posta adresi girdiniz.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      
      const successInfo = 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve gereksiz kutusunu) kontrol edin.';
      setSuccessMsg(successInfo);
      
      if (Platform.OS === 'web') {
        window.alert(successInfo);
        router.replace('/login');
      } else {
        Alert.alert(
          'Başarılı',
          successInfo,
          [{ text: 'Tamam', onPress: () => router.replace('/login') }]
        );
      }
    } catch (error: any) {
      const msg =
        error.code === 'auth/user-not-found'
          ? 'Bu e-posta adresine kayıtlı bir kullanıcı bulunamadı.'
          : error.code === 'auth/invalid-email'
          ? 'Geçersiz bir e-posta adresi.'
          : error.code === 'auth/too-many-requests'
          ? 'Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.'
          : error.message;
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          <AuthCard>
            <View style={styles.header}>
              <Text style={styles.title}>Şifremi Unuttum</Text>
              <Text style={styles.subtitle}>
                Hesabınızın e-posta adresini girin, size şifrenizi sıfırlamanız için bir bağlantı gönderelim.
              </Text>
            </View>

            <View style={styles.form}>
              <CustomTextInput
                label="E-posta"
                placeholder="E-postanızı girin"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); setSuccessMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {errorMsg !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {errorMsg}</Text>
                </View>
              )}

              {successMsg !== '' && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>✓ {successMsg}</Text>
                </View>
              )}

              <PrimaryButton 
                title="Sıfırlama Bağlantısı Gönder" 
                onPress={handleResetPassword} 
                loading={loading}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Şifreni hatırladın mı? </Text>
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
    </AuthBackground>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
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
  successBox: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: Colors.primary,
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
