import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  useWindowDimensions, 
  ActivityIndicator, 
  Modal
} from 'react-native';
import { Colors, getThemeMode, subscribeTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendMessageToGemini, ChatMessage } from '@/services/geminiService';
import Animated, { FadeInDown } from 'react-native-reanimated';

const QUICK_TAGS = [
  { label: 'Nasıl Lobi Kurulur?', query: 'PreFinder uygulamasında nasıl yeni bir lobi kurabilirim? Adım adım anlatır mısın?' },
  { label: 'Oyuncu Şikayet Etme', query: 'Toksik ya da sabote eden bir oyuncuyu nasıl şikayet edebilirim? Şikayetler nasıl incelenir?' },
  { label: 'Forum Nedir?', query: 'Forum sayfasında neler yapabilirim? Hangi kategoriler var?' },
  { label: 'Profilimi Düzenleme', query: 'Riot ID mi, biyografimi veya oynadığım ajan rollerini nasıl değiştirebilirim?' }
];

interface AIChatbotProps {
  isVisible: boolean;
  onClose: () => void;
}

export const AIChatbot = ({ isVisible, onClose }: AIChatbotProps) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width >= 768;
  const router = useRouter();

  const [themeMode, setThemeMode] = useState(getThemeMode());
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Conversation messages state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: 'Merhaba! Ben PreFinder Yapay Zeka Asistanıyım. PreFinder\'daki özellikler, sayfalar veya aradığın şeyler hakkında sana bilgi verebilirim. Nasıl yardımcı olabilirim?' }]
    }
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Subscribe to theme changes
  useEffect(() => {
    const unsub = subscribeTheme((t) => setThemeMode(t));
    return () => unsub();
  }, []);

  // Auto-scroll to bottom when message list changes or chatbot is opened
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages, isVisible]);

  const handleSend = async (customQuery?: string) => {
    const textToSend = (customQuery || inputText).trim();
    if (!textToSend || loading) return;

    if (!customQuery) {
      setInputText('');
    }

    // Append user message
    const updatedMessages = [
      ...messages,
      { role: 'user' as const, parts: [{ text: textToSend }] }
    ];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send chat history and current message to Gemini API
      const geminiResponse = await sendMessageToGemini(messages, textToSend);

      // Append model response
      setMessages(prev => [
        ...prev,
        { role: 'model' as const, parts: [{ text: geminiResponse }] }
      ]);
    } catch (error) {
      console.warn('Error getting AI reply:', error);
      setMessages(prev => [
        ...prev,
        { role: 'model' as const, parts: [{ text: 'Sistemle iletişim kurulurken bir sorun oluştu. Lütfen tekrar dener misin?' }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'model',
        parts: [{ text: 'Sohbet sıfırlandı. Sana PreFinder hakkında nasıl yardımcı olabilirim? Örneğin, "Lobi nasıl kurulur?" veya "Oyuncuları nereden şikayet edebilirim?" diye sorabilirsin.' }]
      }
    ]);
  };

  // Custom inline link parser
  const renderMessageText = (text: string, isMe: boolean) => {
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    const textStyle = isMe ? styles.myBubbleText : styles.otherBubbleText;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(
          <Text key={lastIndex} style={textStyle}>
            {text.slice(lastIndex, matchIndex)}
          </Text>
        );
      }

      const linkText = match[1];
      const linkUrl = match[2];

      parts.push(
        <Text
          key={matchIndex}
          style={[textStyle, styles.linkText]}
          onPress={() => {
            if (linkUrl.startsWith('/')) {
              onClose(); // Close modal on navigation
              router.push(linkUrl as any);
            }
          }}
        >
          {linkText}
        </Text>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <Text key={lastIndex} style={textStyle}>
          {text.slice(lastIndex)}
        </Text>
      );
    }

    return <Text style={styles.messageContentText}>{parts}</Text>;
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <TouchableOpacity activeOpacity={1} style={styles.chatBox}>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles" size={14} color={Colors.background} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>PreFinder Asistanı</Text>
                  <Text style={styles.headerSubtitle}>Yapay Zeka Destekli</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity 
                  onPress={handleResetChat}
                  style={styles.headerIconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.gray} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={onClose}
                  style={styles.headerIconBtn}
                >
                  <Ionicons name="close" size={20} color={Colors.gray} />
                </TouchableOpacity>
              </View>
            </View>

            {/* CHAT MESSAGES CONTENT AREA */}
            <View style={styles.content}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {messages.map((msg, index) => {
                  const isMe = msg.role === 'user';
                  return (
                    <View
                      key={index}
                      style={[
                        styles.messageBubbleWrapper,
                        isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper
                      ]}
                    >
                      {!isMe && (
                        <View style={styles.msgAvatarPlaceholder}>
                          <Ionicons name="sparkles-outline" size={12} color={Colors.primary} />
                        </View>
                      )}
                      <View
                        style={[
                          styles.messageBubble,
                          isMe ? styles.myBubble : styles.otherBubble
                        ]}
                      >
                        {renderMessageText(msg.parts[0].text, isMe)}
                      </View>
                    </View>
                  );
                })}

                {/* TYPING LOADER */}
                {loading && (
                  <View style={[styles.messageBubbleWrapper, styles.otherBubbleWrapper]}>
                    <View style={styles.msgAvatarPlaceholder}>
                      <Ionicons name="sparkles-outline" size={12} color={Colors.primary} />
                    </View>
                    <View style={[styles.messageBubble, styles.otherBubble, styles.typingIndicatorBox]}>
                      <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.typingText}>Yanıt hazırlanıyor...</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* QUICK SUGGESTION TAGS */}
              <View style={styles.quickTagsWrapper}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickTagsScroll}
                >
                  {QUICK_TAGS.map((tag, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.tagBtn}
                      onPress={() => handleSend(tag.query)}
                      disabled={loading}
                    >
                      <Text style={styles.tagText}>{tag.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* TEXT INPUT FOOTER */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nasıl yardımcı olabilirim?"
                  placeholderTextColor={Colors.gray}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={() => handleSend()}
                  multiline={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!inputText.trim() || loading) && { opacity: 0.5 }]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim() || loading}
                >
                  <Ionicons name="send" size={15} color={Colors.background} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 35, 0.4)',
    justifyContent: Platform.OS === 'web' ? 'flex-end' : 'center',
    alignItems: Platform.OS === 'web' ? 'flex-start' : 'center',
    paddingBottom: Platform.OS === 'web' ? 40 : 0,
    paddingLeft: Platform.OS === 'web' ? 40 : 0,
  },
  container: {
    width: '90%',
    maxWidth: 350,
  },
  chatBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
    overflow: 'hidden',
    height: 450,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#16191B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assistantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    padding: 2,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    gap: 10,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 1,
    alignItems: 'flex-start',
    gap: 6,
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  otherBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  msgAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 255, 135, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '82%',
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  myBubbleText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  otherBubbleText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  messageContentText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  linkText: {
    color: Colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  typingIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  typingText: {
    color: Colors.gray,
    fontSize: 12,
    fontStyle: 'italic',
  },
  quickTagsWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 8,
  },
  quickTagsScroll: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
  },
  tagBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 13,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
