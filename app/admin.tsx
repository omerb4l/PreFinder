import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Image, ScrollView, ActivityIndicator, Alert, Platform, Linking, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { VALORANT_RANKS } from '@/constants/ranks';
import { auth, db } from '@/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';

interface Report {
  id: string;
  reporterId: string;
  reportedUserId?: string;
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

  // Tab State
  const [activeTab, setActiveTab] = useState<'reports' | 'verifications'>('reports');

  // Verification States
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [selectedVerificationImg, setSelectedVerificationImg] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeReports: (() => void) | undefined;
    let unsubscribeVerifications: (() => void) | undefined;

    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        setIsAdmin(true);
        unsubscribeReports = startReportsListener();
        unsubscribeVerifications = startVerificationsListener();
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

    const startVerificationsListener = () => {
      const q = query(collection(db, 'users'), where('verificationStatus', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setPendingVerifications(data);
      }, (error) => {
        console.error("Verifications listener error:", error);
      });
      return unsubscribe;
    };

    checkAdmin();

    return () => {
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeVerifications) unsubscribeVerifications();
    };
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

  const handleBanUser = async (userId: string, reportId: string) => {
    const performBan = async () => {
      try {
        let targetUid = userId;
        
        // Fallback: If userId wasn't provided, query the user collection by reportedRiotId
        if (!targetUid && selectedReport?.reportedRiotId) {
          const userQuery = query(collection(db, 'users'), where('riotId', '==', selectedReport.reportedRiotId));
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            targetUid = userSnapshot.docs[0].id;
          }
        }

        if (targetUid) {
          await updateDoc(doc(db, 'users', targetUid), {
            isBanned: true,
            bannedAt: new Date(),
          });

          await deleteDoc(doc(db, 'reports', reportId));
          setSelectedReport(null);

          if (Platform.OS === 'web') {
            window.alert("Kullanıcı kalıcı olarak yasaklandı.");
          } else {
            Alert.alert("Başarılı", "Kullanıcı kalıcı olarak yasaklandı.");
          }
        } else {
          if (Platform.OS === 'web') {
            window.alert("Kullanıcı bulunamadı.");
          } else {
            Alert.alert("Hata", "Kullanıcı bulunamadı.");
          }
        }
      } catch (error) {
        console.error("Ban error:", error);
        if (Platform.OS === 'web') {
          window.alert("İşlem sırasında bir hata oluştu.");
        } else {
          Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Bu kullanıcıyı kalıcı olarak yasaklamak istediğinize emin misiniz?")) {
        await performBan();
      }
    } else {
      Alert.alert(
        "Kullanıcıyı Yasakla",
        "Bu kullanıcıyı kalıcı olarak yasaklamak istediğinize emin misiniz?",
        [
          { text: "İptal", style: "cancel" },
          { text: "Yasakla", style: "destructive", onPress: performBan }
        ]
      );
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'reports', reportId));
        setSelectedReport(null);
        if (Platform.OS === 'web') {
          window.alert("Rapor silindi.");
        } else {
          Alert.alert("Başarılı", "Rapor silindi.");
        }
      } catch (error) {
        console.error("Delete error:", error);
        if (Platform.OS === 'web') {
          window.alert("İşlem sırasında bir hata oluştu.");
        } else {
          Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Bu raporu silmek istediğinize emin misiniz?")) {
        await performDelete();
      }
    } else {
      Alert.alert(
        "Raporu Sil",
        "Bu raporu silmek istediğinize emin misiniz?",
        [
          { text: "İptal", style: "cancel" },
          { text: "Sil", style: "destructive", onPress: performDelete }
        ]
      );
    }
  };

  const handleApproveVerification = async (userId: string, submittedRank: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: 'verified',
        rank: submittedRank
      });
      if (Platform.OS === 'web') window.alert("Rütbe doğrulaması onaylandı.");
      else Alert.alert("Başarılı", "Rütbe doğrulaması onaylandı.");
    } catch (error) {
      console.error("Approve verification error:", error);
      if (Platform.OS === 'web') window.alert("Onaylama sırasında bir hata oluştu.");
      else Alert.alert("Hata", "Onaylama sırasında bir hata oluştu.");
    }
  };

  const handleRejectVerification = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: 'rejected',
        rankProofImageUrl: null
      });
      if (Platform.OS === 'web') window.alert("Rütbe doğrulaması reddedildi.");
      else Alert.alert("Başarılı", "Rütbe doğrulaması reddedildi.");
    } catch (error) {
      console.error("Reject verification error:", error);
      if (Platform.OS === 'web') window.alert("Reddetme sırasında bir hata oluştu.");
      else Alert.alert("Hata", "Reddetme sırasında bir hata oluştu.");
    }
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
            <Text style={styles.headerTitle}>Yönetim Paneli</Text>
          </View>
        )}
      </View>

      {/* Top Tab Navigation Bar (only visible in main admin lists view) */}
      {!selectedReport && (
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'reports' && styles.activeTabButton]}
            onPress={() => setActiveTab('reports')}
          >
            <Ionicons name="alert-circle" size={18} color={activeTab === 'reports' ? Colors.primary : Colors.gray} />
            <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>Raporlar ({reports.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'verifications' && styles.activeTabButton]}
            onPress={() => setActiveTab('verifications')}
          >
            <Ionicons name="shield-checkmark" size={18} color={activeTab === 'verifications' ? Colors.primary : Colors.gray} />
            <Text style={[styles.tabText, activeTab === 'verifications' && styles.activeTabText]}>
              Rütbe Onayları ({pendingVerifications.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
              onPress={() => handleBanUser(selectedReport.reportedUserId || '', selectedReport.id)}
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
      ) : activeTab === 'reports' ? (
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
      ) : (
        <FlatList
          data={pendingVerifications}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="shield-checkmark" size={60} color={Colors.gray} />
              <Text style={styles.emptyText}>Bekleyen rütbe doğrulama isteği bulunmuyor.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.verificationCard}>
              <View style={styles.verificationCardHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.verificationUserRiotId}>{item.riotId || item.username}</Text>
                  <View style={styles.verificationRankBox}>
                    {item.rank && VALORANT_RANKS[item.rank as keyof typeof VALORANT_RANKS] && (
                      <Image 
                        source={VALORANT_RANKS[item.rank as keyof typeof VALORANT_RANKS].icon} 
                        style={styles.verificationRankIcon} 
                      />
                    )}
                    <Text style={styles.verificationRankName}>
                      Mevcut: {item.rank ? VALORANT_RANKS[item.rank as keyof typeof VALORANT_RANKS]?.name : 'Belirlenmedi'}
                    </Text>
                  </View>
                  {item.rankSubmitted && (
                    <Text style={styles.verificationRankSubmitted}>
                      Talep Edilen: {VALORANT_RANKS[item.rankSubmitted as keyof typeof VALORANT_RANKS]?.name || item.rankSubmitted}
                    </Text>
                  )}
                </View>
                {item.rankProofImageUrl && (
                  <TouchableOpacity 
                    style={styles.thumbnailWrapper} 
                    onPress={() => setSelectedVerificationImg(item.rankProofImageUrl)}
                  >
                    <Image source={{ uri: item.rankProofImageUrl }} style={styles.verificationThumbnail} />
                    <View style={styles.thumbnailBadge}>
                      <Ionicons name="eye" size={10} color="#fff" />
                      <Text style={styles.thumbnailBadgeText}>Büyüt</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.verificationActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApproveVerification(item.id, item.rankSubmitted || item.rank || 'platinum')}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#0F1923" />
                  <Text style={styles.approveBtnText}>Onayla</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleRejectVerification(item.id)}
                >
                  <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                  <Text style={styles.rejectBtnText}>Reddet</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Fullscreen verification screenshot preview modal */}
      <Modal 
        visible={!!selectedVerificationImg} 
        transparent 
        animationType="fade"
        onRequestClose={() => setSelectedVerificationImg(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseBtn} 
            onPress={() => setSelectedVerificationImg(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedVerificationImg && (
            <Image 
              source={{ uri: selectedVerificationImg }} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>

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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  activeTabText: {
    color: Colors.primary,
  },
  verificationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  verificationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  verificationUserRiotId: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  verificationRankBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verificationRankIcon: {
    width: 20,
    height: 20,
  },
  verificationRankName: {
    color: Colors.gray,
    fontSize: 13,
    fontWeight: '600',
  },
  verificationRankSubmitted: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
  },
  verificationThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: '#0F1923',
    borderRadius: 6,
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  thumbnailBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  approveBtn: {
    backgroundColor: Colors.primary,
  },
  approveBtnText: {
    color: '#0F1923',
    fontSize: 13,
    fontWeight: '800',
  },
  rejectBtn: {
    backgroundColor: 'rgba(255, 70, 85, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 70, 85, 0.3)',
  },
  rejectBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
});
