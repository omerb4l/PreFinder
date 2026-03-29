```mermaid
graph LR
    A[Aktif İlanlar] --> B{Oyuncu Lobi Arıyor}
    B --> C[Otomatik Rank Filtresi]
    C --> D[Uygun Lobi Bulundu]
    D --> E[Party Kodunu Kopyala ve Oyuna Gir]
    
    E --> F{Oyun İçi Durum}
    F -- Sorun Yok --> G[Maç Oynanır]
    F -- Geçersiz Kod / Troll --> H[Uygulamadan Şikayet Et]
    
    H --> I[Admin İncelemesi]
    I -- Haklı Şikayet --> J[Riot ID Kara Listeye Alınır / Kalıcı Ban]
    
    K[Lobi Kurucu] --> L{Lobi Doldu mu?}
    L -- Evet --> M[İlanı Sistemden Kaldır]
```
