// Valorant Rank Helper with local asset mapping
// Path fixed to ../assets/ (1 level up from constants/)
export const VALORANT_RANKS = {
  iron: { 
    name: 'Demir', 
    icon: require('../assets/images/ranks/Iron_1_Rank.png') 
  },
  bronze: { 
    name: 'Bronz', 
    icon: require('../assets/images/ranks/Bronze_1_Rank.png') 
  },
  silver: { 
    name: 'Gümüş', 
    icon: require('../assets/images/ranks/Silver_1_Rank.png') 
  },
  gold: { 
    name: 'Altın', 
    icon: require('../assets/images/ranks/Gold_1_Rank.png') 
  },
  platinum: { 
    name: 'Platin', 
    icon: require('../assets/images/ranks/Platinum_1_Rank.png') 
  },
  diamond: { 
    name: 'Elmas', 
    icon: require('../assets/images/ranks/Diamond_1_Rank.png') 
  },
  ascendant: { 
    name: 'Yücelik', 
    icon: require('../assets/images/ranks/Ascendant_1_Rank.png') 
  },
  immortal: { 
    name: 'Ölümsüz', 
    icon: require('../assets/images/ranks/Immortal_1_Rank.png') 
  },
  radiant: { 
    name: 'Radyant', 
    icon: require('../assets/images/ranks/Radiant_Rank.png') 
  },
};

export type RankType = keyof typeof VALORANT_RANKS;
