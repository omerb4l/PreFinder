import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

const CATEGORIES = ["Haberler", "Rehberler", "Takım Bul", "Sohbet", "Taktikler"];

export default function CreatePostScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Sohbet');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [userRiotId, setUserRiotId] = useState<string>('');

  // Fetch current user's Riot ID
  useEffect(() => {
    const fetchUserRiotId = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserRiotId(data.riotId || data.username || 'Bilinmeyen Oyuncu');
        }
      } catch (e) {
        console.warn("Failed to fetch user riot ID:", e);
      }
    };

    fetchUserRiotId();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Fotoğraf seçmek için galeri izni vermeniz gerekmektedir.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('İzin Gerekli', msg);
      }
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setBase64Image(result.assets[0].base64 || null);
      }
    } catch (err) {
      console.error("Error picking image:", err);
    }
  };

  const handleCreate = async () => {
    const user = auth.currentUser;
    if (!user) {
      const msg = 'Paylaşım yapmak için giriş yapmalısınız.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Hata', msg);
      return;
    }

    if (!title.trim()) {
      const msg = 'Lütfen konunun başlığını yazın.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Eksik Alan', msg);
      return;
    }

    if (!content.trim()) {
      const msg = 'Lütfen konunun içeriğini yazın.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Eksik Alan', msg);
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'forum_posts'), {
        title: title.trim(),
        category,
        content: content.trim(),
        authorId: user.uid,
        authorRiotId: userRiotId || user.email || 'Bilinmeyen Oyuncu',
        base64Image: base64Image,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
      });

      const successMsg = 'Konu başarıyla açıldı.';
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Başarılı', successMsg);
      }

      router.back();
    } catch (error) {
      console.error("Failed to create forum post:", error);
      const errMsg = 'Gönderi oluşturulurken bir hata oluştu.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Hata', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yeni Konu Aç</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.container, isWeb && styles.webContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title input */}
        <Text style={styles.label}>Başlık</Text>
        <TextInput
          style={styles.input}
          placeholder="Konu başlığı yazın..."
          placeholderTextColor={Colors.gray}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Category selector */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.categoryList}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryBadge,
                category === cat && styles.categoryBadgeActive
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[
                styles.categoryBadgeText,
                category === cat && styles.categoryBadgeTextActive
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content input */}
        <Text style={styles.label}>İçerik</Text>
        <TextInput
          style={[styles.input, styles.contentInput]}
          placeholder="İçerik yazın..."
          placeholderTextColor={Colors.gray}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        {/* Image Picker */}
        <Text style={styles.label}>Görsel Ekle (Opsiyonel)</Text>
        {base64Image ? (
          <View style={styles.imagePreviewContainer}>
            <Image 
              source={{ uri: `data:image/jpeg;base64,${base64Image}` }} 
              style={styles.previewImage} 
            />
            <TouchableOpacity 
              style={styles.removeImageBtn} 
              onPress={() => setBase64Image(null)}
            >
              <Ionicons name="close-circle" size={26} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
            <Ionicons name="image-outline" size={28} color={Colors.primary} />
            <Text style={styles.imagePickerText}>Galeri'den Görsel Seç</Text>
          </TouchableOpacity>
        )}

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0F1923" />
          ) : (
            <Text style={styles.submitBtnText}>Paylaş</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  webContainer: {
    paddingHorizontal: '25%',
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  contentInput: {
    height: 150,
    textAlignVertical: 'top',
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryBadgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryBadgeText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryBadgeTextActive: {
    color: '#0F1923',
  },
  imagePickerBtn: {
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: 8,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#0F1923',
    fontSize: 16,
    fontWeight: '900',
  },
});
