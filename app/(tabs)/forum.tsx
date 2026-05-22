import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Platform, useWindowDimensions, Pressable } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ForumPost {
  id: string;
  author: string;
  authorRank: string;
  title: string;
  content: string;
  likes: number;
  comments: number;
  category: string;
  time: string;
  likedByUser: boolean;
}

const CATEGORIES = ["Tümü", "Haberler", "Rehberler", "Takım Bul", "Sohbet", "Taktikler"];

const INITIAL_POSTS: ForumPost[] = [
  {
    id: "1",
    author: "ViperMain99",
    authorRank: "Elmas 3",
    title: "10.02 Yaması Ajan Güncellemeleri Hakkında Düşünceleriniz?",
    content: "Yeni yamada Viper perdelerinin süresi kısaltılmış gibi hissediyorum. Sizce Viper hala meta mı yoksa Brimstone'a mı yönelmeliyiz? Taktiklerinizi bekliyorum.",
    likes: 24,
    comments: 12,
    category: "Haberler",
    time: "2 saat önce",
    likedByUser: false
  },
  {
    id: "2",
    author: "JettFlyer",
    authorRank: "Ölümsüz 1",
    title: "Solo Queue Rank Atlamak İçin En İyi 3 Düellocu",
    content: "Uzun araştırmalarım ve maç geçmişime dayanarak solo queue'da en kolay rank atlayabileceğiniz düellocuları listeledim. 1. Jett, 2. Reyna, 3. Iso. Detaylı rehber yakında profilde!",
    likes: 42,
    comments: 8,
    category: "Rehberler",
    time: "5 saat önce",
    likedByUser: false
  },
  {
    id: "3",
    author: "SupportSage",
    authorRank: "Platin 2",
    title: "Akşamüstü 18:00'da Platin-Elmas Lobiye 2 Kişi Arıyoruz",
    content: "Toksik olmayan, info veren, uyumlu Sage/Skye main veya düellocu arıyoruz. Discord adresi üzerinden iletişim kurabilirsiniz. Riot ID ekleyin oynayalım.",
    likes: 8,
    comments: 19,
    category: "Takım Bul",
    time: "10 dakika önce",
    likedByUser: false
  },
  {
    id: "4",
    author: "AimGod_Vlr",
    authorRank: "Yücelik 2",
    title: "Aim Geliştirme Rutini (Günde Sadece 30 Dakika)",
    content: "The Range ve Aimlabs kullanarak oluşturduğum 30 dakikalık rutini paylaşıyorum. Sadece 1 haftada headshot oranım %18'den %27'ye yükseldi. Sorularınızı sorabilirsiniz.",
    likes: 56,
    comments: 15,
    category: "Taktikler",
    time: "1 gün önce",
    likedByUser: false
  }
];

export default function ForumScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;

  const [posts, setPosts] = useState<ForumPost[]>(INITIAL_POSTS);
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [searchQuery, setSearchQuery] = useState("");

  const handleLike = (id: string) => {
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === id) {
          return {
            ...post,
            likedByUser: !post.likedByUser,
            likes: post.likedByUser ? post.likes - 1 : post.likes + 1
          };
        }
        return post;
      })
    );
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === "Tümü" || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={[styles.contentPadding, isWeb && styles.webContentPadding]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Topluluk Forumu</Text>
          <Text style={styles.subtitle}>Fikirlerinizi paylaşın, taktik alışverişinde bulunun.</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={Colors.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Forumda arama yapın..."
            placeholderTextColor={Colors.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color={Colors.gray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category List */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryBadge,
                selectedCategory === category && styles.categoryBadgeActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryBadgeText,
                selectedCategory === category && styles.categoryBadgeTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Coming Soon Notice Card */}
        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonHeader}>
            <Ionicons name="construct" size={24} color={Colors.primary} />
            <Text style={styles.comingSoonTitle}>Etkileşimli Forum Yakında!</Text>
          </View>
          <Text style={styles.comingSoonText}>
            Çok yakında kendi konularınızı açabilecek, diğer oyuncuların gönderilerine yorum yapabilecek ve toplulukla anlık etkileşime girebileceksiniz. Şu anda önizleme sürümündesiniz.
          </Text>
        </View>

        {/* Posts List */}
        <View style={styles.postsList}>
          {filteredPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={Colors.gray} />
              <Text style={styles.emptyText}>Aradığınız kriterlere uygun konu bulunamadı.</Text>
            </View>
          ) : (
            filteredPosts.map(post => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postCardHeader}>
                  <View style={styles.authorBox}>
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={14} color={Colors.gray} />
                    </View>
                    <View>
                      <Text style={styles.authorName}>{post.author}</Text>
                      <Text style={styles.authorRankText}>{post.authorRank}</Text>
                    </View>
                  </View>
                  <View style={styles.categoryLabel}>
                    <Text style={styles.categoryLabelText}>{post.category}</Text>
                  </View>
                </View>

                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>

                <View style={styles.postCardFooter}>
                  <View style={styles.footerLeft}>
                    <TouchableOpacity 
                      style={[styles.interactionBtn, post.likedByUser && styles.likedBtn]} 
                      onPress={() => handleLike(post.id)}
                    >
                      <Ionicons 
                        name={post.likedByUser ? "heart" : "heart-outline"} 
                        size={18} 
                        color={post.likedByUser ? Colors.danger : Colors.gray} 
                      />
                      <Text style={[styles.interactionText, post.likedByUser && styles.likedText]}>
                        {post.likes} Beğeni
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.interactionBtn}>
                      <Ionicons name="chatbubble-outline" size={18} color={Colors.gray} />
                      <Text style={styles.interactionText}>{post.comments} Yorum</Text>
                    </View>
                  </View>
                  <Text style={styles.postTime}>{post.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentPadding: {
    padding: 20,
  },
  webContentPadding: {
    paddingHorizontal: '20%',
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.gray,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: Colors.text,
    fontSize: 14,
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryList: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    paddingBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  comingSoonCard: {
    backgroundColor: 'rgba(255, 70, 85, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 70, 85, 0.2)',
    marginBottom: 24,
  },
  comingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  comingSoonTitle: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  comingSoonText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  postsList: {
    gap: 16,
  },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F1923',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  authorName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  authorRankText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  categoryLabel: {
    backgroundColor: '#0F1923',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryLabelText: {
    color: Colors.gray,
    fontSize: 10,
    fontWeight: '700',
  },
  postTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
    lineHeight: 20,
  },
  postContent: {
    color: Colors.gray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  postCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likedBtn: {
    opacity: 1,
  },
  interactionText: {
    color: Colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  likedText: {
    color: Colors.danger,
    fontWeight: '700',
  },
  postTime: {
    color: Colors.gray,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.gray,
    fontSize: 14,
    textAlign: 'center',
  },
});
