import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Image, ScrollView, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';

interface Report {
  id: string;
  reporterId: string;
  reportedRiotId: string;
  reason: string;
  description: string;
  videoLink: string;
  evidenceImageBase64: string | null;
  status: string;
  timestamp: any;
}

export default function AdminPanel() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        setIsAdmin(true);
        startReportsListener();
      } else {
        setLoading(false);
      }
    };

    const startReportsListener = () => {
      const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Report[];
        setReports(data);
        setLoading(false);
      }, (error) => {
        console.error("Reports listener error:", error);
        setLoading(false);
      });
      return unsubscribe;
    };

    checkAdmin();
  }, []);

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    
    // YouTube patterns
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    // Medal.tv patterns
    if (url.includes('medal.tv')) {
      // Basic check to see if it's already an embed link
      if (url.includes('/clips/')) {
        const clipId = url.split('/clips/')[1]?.split('/')[0];
        if (clipId) return `https://medal.tv/clip/${clipId}?autoplay=0`;
      }
      return url.includes('?') ? `${url}&autoplay=0` : `${url}?autoplay=0`;
    }

    return url;
  };

  const handleBanUser = async (riotId: string) => {
    Alert.alert(
      "Kullanıcıyı Yasakla",
      `${riotId} adlı kullanıcıyı yasaklamak istediğinize emin misiniz?`,
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Yasakla", 
          style: "destructive",
          onPress: async () => {
            try {
              // Find user by riotId
              const userQuery = query(collection(db, 'users'), where('riotId', '==', riotId));
              const userSnapshot = await getDocs(userQuery);
              
              if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                await updateDoc(doc(db, 'users', userDoc.id), {
                  isBanned: true,
                  bannedAt: new Date(),
                });
                Alert.alert("Başarılı", "Kullanıcı yasaklandı.");
              } else {
                Alert.alert("Hata", "Kullanıcı bulunamadı.");
              }
            } catch (error) {
              console.error("Ban error:", error);
              Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteReport = async (reportId: string) => {
    Alert.alert(
      "Raporu Sil",
      "Bu raporu silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'reports', reportId));
              setSelectedReport(null);
              Alert.alert("Başarılı", "Rapor silindi.");
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
            }
          }
        }
      ]
    );
  };

  const renderReportItem = ({ item }: { item: Report }) => (
    <TouchableOpacity 
      style={styles.reportItem} 
      onPress={() => setSelectedReport(item)}
    >
      <View style={styles.reportItemHeader}>
        <Text style={styles.reportReason}>{item.reason}</Text>
        <Text style={styles.reportTime}>
          {item.timestamp?.toDate().toLocaleDateString('tr-TR')}
        </Text>
      </View>
      <Text style={styles.reportedUser}>Hedef: {item.reportedRiotId}</Text>
      <Text style={styles.reportSummary} numberOfLines={1}>
        {item.description || "Açıklama yok"}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={60} color={Colors.danger} />
        <Text style={[styles.headerTitle, { marginTop: 16 }]}>Erişim Engellendi</Text>
        <Text style={{ color: Colors.gray, marginTop: 8 }}>Bu sayfayı görüntüleme yetkiniz yok.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectedReport ? (
          <TouchableOpacity onPress={() => setSelectedReport(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
            <Text style={styles.headerTitle}>Rapor Detayı</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Yönetim Paneli - Raporlar</Text>
          </View>
        )}
      </View>

      {selectedReport ? (
        <ScrollView style={styles.detailView} showsVerticalScrollIndicator={false}>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>Şikayet Nedeni</Text>
            <Text style={styles.detailValue}>{selectedReport.reason}</Text>

            <Text style={styles.detailLabel}>Riot ID</Text>
            <Text style={[styles.detailValue, { color: Colors.primary }]}>{selectedReport.reportedRiotId}</Text>

            <Text style={styles.detailLabel}>Açıklama</Text>
            <Text style={styles.detailDescription}>{selectedReport.description || "Açıklama belirtilmedi."}</Text>

            {selectedReport.videoLink ? (
              <View style={styles.videoSection}>
                <Text style={styles.detailLabel}>Video Kanıtı</Text>
                <View style={styles.videoWrapper}>
                  {Platform.OS === 'web' ? (
                    React.createElement('iframe', {
                      src: getEmbedUrl(selectedReport.videoLink),
                      style: { width: '100%', height: '100%', border: 'none', borderRadius: 8 },
                      allowFullScreen: true,
                      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    })
                  ) : (
                    <WebView 
                      source={{ uri: getEmbedUrl(selectedReport.videoLink) }} 
                      style={styles.webView}
                      allowsFullscreenVideo
                    />
                  )}
                </View>
              </View>
            ) : null}

            {selectedReport.evidenceImageBase64 ? (
              <View style={styles.imageSection}>
                <Text style={styles.detailLabel}>Görsel Kanıt</Text>
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${selectedReport.evidenceImageBase64}` }} 
                  style={styles.detailImage}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.banBtn}
              onPress={() => handleBanUser(selectedReport.reportedRiotId)}
            >
              <Ionicons name="hand-right" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Kullanıcıyı Yasakla</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => handleDeleteReport(selectedReport.id)}
            >
              <Ionicons name="trash" size={20} color={Colors.gray} />
              <Text style={styles.deleteBtnText}>Raporu Sil / Kalsın</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="checkmark-circle-outline" size={60} color={Colors.gray} />
              <Text style={styles.emptyText}>Bekleyen rapor bulunmuyor.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listPadding: {
    padding: 16,
  },
  reportItem: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportReason: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  reportTime: {
    color: Colors.gray,
    fontSize: 12,
  },
  reportedUser: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  reportSummary: {
    color: Colors.gray,
    fontSize: 13,
  },
  detailView: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailLabel: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 16,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  detailDescription: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  videoSection: {
    marginTop: 10,
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
  },
  imageSection: {
    marginTop: 10,
  },
  detailImage: {
    width: '100%',
    height: 300,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#0F1923',
  },
  actions: {
    gap: 12,
  },
  banBtn: {
    backgroundColor: Colors.danger,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deleteBtn: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  deleteBtnText: {
    color: Colors.gray,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 16,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  webVideoBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0F1923',
  },
  webVideoBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  webVideoHint: {
    color: Colors.gray,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
