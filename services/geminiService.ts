import { auth } from '@/firebaseConfig';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';

// System prompt explaining PreFinder's pages, features and navigation
const SYSTEM_PROMPT = `
Sen PreFinder uygulamasının resmi Yapay Zeka Asistanısın (PreFinder Yapay Zeka Asistanı). 
Görevin, kullanıcılara PreFinder web sitesinde/uygulamasında nasıl gezineceklerini öğretmek, sistem özelliklerini açıklamak ve nerede neyi bulabileceklerini tarif etmektir.

KURALLAR:
1. Kesinlikle çok kısa, öz ve net cevaplar ver. Yanıtların 2 veya en fazla 3 kısa cümleyi geçmemelidir.
2. Kesinlikle bold (kalın yazım için kullanılan ** sembolleri), italik, yıldızlar (*) veya madde işaretleri (bullet points) kullanma! Düz metin olarak yanıt yaz.
3. Sadece sayfa yönlendirmeleri için markdown link formatını kullanabilirsin, örn: [Forum](/forum). Bunun dışında hiçbir markdown veya biçimlendirme sembolü kullanma.

PreFinder Özellikleri ve Rotaları:
- Ana Sayfa / Lobiler: [Oyuncu Bul (Ana Sayfa)](/) sayfasından aktif lobileri listeleyip rütbe veya mod filtresiyle arayabilirsin.
- Lobi Oluşturma: Web sürümünde ana sayfa alt ortasındaki "+ LOBİ OLUŞTUR" yeşil butonundan, mobil sürümde alt menüdeki orta "+" simgesinden lobi kurabilirsin. Oyun modu, rütbe aralığı, aranan roller, slot sayısı ve Valorant parti kodu seçilir.
- Lobi Onaylama: Lobi lideri, grubuna katılan oyuncuyu sol alttaki "Lobi Katılım Kontrolü" toast bildiriminden onaylar. Evet seçilirse geçmişe eklenir ve birbirinizi puanlayabilirsiniz.
- Topluluk Forumu: [Forum](/forum) sayfasından haber, rehber, taktik veya takım bulma konularına erişip, yorum yapabilir veya yeni konu açabilirsin.
- Oyuncu Şikayeti: [Oyuncu Şikayet Et](/report) sayfasından son oynadığın toksik veya AFK oyuncuları şikayet edebilirsin. Kanıt eklemek önceliği artırır.
- Profil Sayfası: [Profil](/profile) sayfasından istatistiklerini, rütbeni, oynadığın ajan rollerini ve yorumlarını görüp düzenleyebilirsin.
- Yönetim Paneli: Yalnızca admin yetkisi olanlar [Yönetim Paneli](/admin) üzerinden şikayetleri ve rütbe onaylarını yönetebilir.
`;

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Sends a chat history + new message to the Gemini API and returns the text response.
 * Handles the session history format expected by Gemini Developer API with automatic retries for temporary service overload (503).
 */
export const sendMessageToGemini = async (
  history: ChatMessage[],
  newMessageText: string
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is missing. Please check your EXPO_PUBLIC_GEMINI_API_KEY in .env');
    return 'Lütfen geliştiriciye bildirin: `.env` dosyasında `EXPO_PUBLIC_GEMINI_API_KEY` yapılandırılmamış. Bu yüzden AI Chatbot şu anda yanıt veremiyor.';
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

  // Build content array matching Gemini's multi-turn structure
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: msg.parts,
    })),
    {
      role: 'user',
      parts: [{ text: newMessageText }],
    },
  ];

  let retries = 2;
  let delay = 1000; // 1 second initial delay for retries

  while (retries >= 0) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 300,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`Gemini API Error details (Attempts left: ${retries}):`, errBody);

        if (response.status === 503 && retries > 0) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        if (response.status === 503) {
          return 'Şu anda Gemini API sunucularında aşırı yoğunluk yaşanıyor. Lütfen birkaç saniye sonra tekrar deneyin.';
        }

        throw new Error(`Gemini API HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        console.warn('Unexpected Gemini API response structure:', data);
        return 'Üzgünüm, şu anda yanıt üretemiyorum. Lütfen tekrar dener misiniz?';
      }

      return responseText;

    } catch (error) {
      console.warn(`Error inside sendMessageToGemini (Attempts left: ${retries}):`, error);
      if (retries > 0) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return 'Bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol edip birkaç saniye sonra tekrar deneyin.';
    }
  }

  return 'Bağlantı hatası oluştu. Lütfen daha sonra tekrar deneyin.';
};
