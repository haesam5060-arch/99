import { useState, useRef, useEffect } from 'react';
import { CHARACTER_PALETTES } from '../data/characters';
import { purchaseCharacter, equipCharacter, sellCharacter, updatePlayerScore } from '../utils/storage';
import { isOnline, purchaseOnlineCharacter, equipOnlineCharacter, updateSchoolName, sellOnlineCharacter, updateOnlineScore, saveRoomData, getRoomData } from '../utils/supabase';
import { playClick, playPurchase, playWrong } from '../utils/sound';
import PixelCharacter from './PixelCharacter';
import SchoolCardCharacter from './SchoolCardCharacter';
import { containsProfanity } from '../utils/profanityFilter';

const SCHOOL_CARD_ID = 13;
const SCHOOL_CARD_PRICE = 5000;

const CHARACTER_TOOLTIPS = {
  0: '기본 캐릭터\n핑크 에너지볼 공격',
  1: '돌멩이 공격',
  2: '뿔 돌진 공격',
  3: '화염구 공격',
  4: '당근 미사일 공격',
  5: '초록 화염 공격',
  6: '독침 공격',
  7: '말발굽 충격파 공격',
  8: '솜뭉치 공격',
  9: '바나나 공격',
  10: '알 투척 공격',
  11: '뼈다귀 공격',
  12: '핑크 에너지 공격',
  13: '학교 이름을 입력하면\n나만의 학교 카드가\n캐릭터로 만들어져요!',
  14: '로켓 발사 공격',
  15: '레이저 빔 공격',
  16: '수리검 투척 공격',
  17: '성스러운 검기 공격',
  18: '마법 오브 공격',
  19: '대포알 발사 공격',
  20: '에너지 펀치 공격',
  21: '참치캔 투척 공격',
  22: '아이스볼 공격',
  23: '거대 화염구 공격',
  24: '거대 황금 에너지 폭발 공격\n틀려도 점수가 안 깎여요!',
  25: '점프 발차기 공격!\n귀여운 곰인형의 강력한 킥',
};

function getPrice(id) {
  if (id === 0) return 0;
  if (id === 24) return 10000;
  if (id === SCHOOL_CARD_ID) return SCHOOL_CARD_PRICE;
  const data = CHARACTER_PALETTES[id];
  if (data?.premium) return 3000;
  return 1000;
}

// ── 가구 정의 ──
const FURNITURE_PRICE = 1000;
const FURNITURE_DEFS = {
  bed: { name: '침대', w: 48, h: 12, interaction: 'sleep',
    colors: { 1: '#5c3a1e', 2: '#7a4f2e', 3: '#8b6340', 4: '#c4a882', 5: '#e8d5b5', 6: '#4a7abc', 7: '#6a9fd8' },
    sprite: [
      [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,0,1,2,3,3,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,1,2,3,3,4,5,5,5,5,5,5,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
      [0,1,2,3,3,3,4,5,5,5,5,5,5,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [1,2,3,3,3,3,4,5,5,5,5,5,5,4,3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,3,3,3,2,1],
      [1,2,3,3,3,3,4,4,4,4,4,4,4,4,3,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,3,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,3,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,3,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,3,3,3,2,1],
      [1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1],
    ],
  },
  desk: { name: '책상', w: 40, h: 14, interaction: 'sit',
    colors: { 1: '#6b4226', 2: '#8b5a3a', 3: '#3a3a5c', 4: '#4a4a6c' },
    sprite: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
      [1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,4,3,3,3,3,3,3,3,3,3,3,3,3,4,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,4,3,3,3,3,3,3,3,3,3,3,3,3,4,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    ],
  },
  chair: { name: '의자', w: 20, h: 15, interaction: 'sit',
    colors: { 1: '#6b4226', 2: '#8b5a3a', 3: '#a87050', 4: '#cc4444' },
    sprite: [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,2,1],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,2,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
    ],
  },
  bookshelf: { name: '책장', w: 32, h: 17,
    colors: { 1: '#5c3a1e', 2: '#7a4f2e', 3: '#cc3333', 4: '#3366aa', 5: '#33aa55' },
    sprite: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,3,3,4,4,5,5,3,3,0,0,4,4,5,5,3,3,4,4,0,0,5,5,3,3,4,4,5,5,2,1],
      [1,2,3,3,4,4,5,5,3,3,0,0,4,4,5,5,3,3,4,4,0,0,5,5,3,3,4,4,5,5,2,1],
      [1,2,3,3,4,4,5,5,3,3,0,0,4,4,5,5,3,3,4,4,0,0,5,5,3,3,4,4,5,5,2,1],
      [1,2,3,3,4,4,5,5,3,3,0,0,4,4,5,5,3,3,4,4,0,0,5,5,3,3,4,4,5,5,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,5,5,3,3,0,0,4,4,5,5,3,3,0,0,5,5,3,3,4,4,0,0,3,3,5,5,4,4,2,1],
      [1,2,5,5,3,3,0,0,4,4,5,5,3,3,0,0,5,5,3,3,4,4,0,0,3,3,5,5,4,4,2,1],
      [1,2,5,5,3,3,0,0,4,4,5,5,3,3,0,0,5,5,3,3,4,4,0,0,3,3,5,5,4,4,2,1],
      [1,2,5,5,3,3,0,0,4,4,5,5,3,3,0,0,5,5,3,3,4,4,0,0,3,3,5,5,4,4,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,4,4,0,0,5,5,3,3,4,4,0,0,5,5,4,4,0,0,3,3,5,5,4,4,0,0,3,3,2,1],
      [1,2,4,4,0,0,5,5,3,3,4,4,0,0,5,5,4,4,0,0,3,3,5,5,4,4,0,0,3,3,2,1],
      [1,2,4,4,0,0,5,5,3,3,4,4,0,0,5,5,4,4,0,0,3,3,5,5,4,4,0,0,3,3,2,1],
      [1,2,4,4,0,0,5,5,3,3,4,4,0,0,5,5,4,4,0,0,3,3,5,5,4,4,0,0,3,3,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
  rug: { name: '러그', w: 48, h: 10,
    colors: { 1: '#8b2252', 2: '#a0336a', 3: '#cc4488', 4: '#dd6699' },
    sprite: [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3,3,2,1],
      [1,2,3,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,3,3,2,1],
      [1,2,3,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,3,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    ],
  },
  windowF: { name: '창문', w: 28, h: 13, wallMount: true,
    colors: { 1: '#e8e8e8', 2: '#b0b0b0', 3: '#88ccee', 4: '#aaddff', 5: '#ffffff' },
    sprite: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,1,1,2,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,3,2,1,1,2,3,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,3,2,1,1,2,3,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,4,4,5,5,4,4,4,4,3,2,1,1,2,3,4,4,4,5,5,4,4,4,3,2,1],
      [1,2,3,4,5,5,5,5,4,4,4,3,2,1,1,2,3,4,4,5,5,5,5,4,4,3,2,1],
      [1,2,3,4,4,5,5,4,4,4,4,3,2,1,1,2,3,4,4,4,5,5,4,4,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,3,2,1,1,2,3,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,3,2,1,1,2,3,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,1,1,2,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
  lamp: { name: '스탠드', w: 12, h: 15,
    colors: { 1: '#ffd700', 2: '#ffee88', 3: '#ffffcc', 4: '#888888' },
    sprite: [
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,2,2,2,2,2,2,1,0,0],
      [0,1,2,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,2,1,0],
      [0,0,1,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,0,4,4,0,0,0,0,0],
      [0,0,0,0,4,4,4,4,0,0,0,0],
    ],
  },
  clock: { name: '시계', w: 14, h: 14, wallMount: true,
    colors: { 1: '#8b6340', 2: '#ffd700', 3: '#ffffff', 4: '#333333' },
    sprite: [
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,1,1,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,2,1,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,3,3,3,3,4,3,3,3,3,3,1,0],
      [1,2,3,3,3,3,4,3,3,3,3,3,2,1],
      [1,2,3,3,3,3,4,4,4,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,1],
      [0,1,3,3,3,3,3,3,3,3,3,3,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,2,1,0],
      [0,0,1,2,3,3,3,3,3,3,2,1,0,0],
      [0,0,0,1,1,2,2,2,2,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
    ],
  },
  plant: { name: '화분', w: 14, h: 18,
    colors: { 1: '#228b22', 2: '#32cd32', 3: '#8b4513', 4: '#a0522d', 5: '#006400' },
    sprite: [
      [0,0,0,0,0,0,2,2,0,0,0,0,0,0],
      [0,0,0,0,0,2,1,1,2,0,0,0,0,0],
      [0,0,0,0,2,1,5,5,1,2,0,0,0,0],
      [0,0,2,2,1,5,5,5,5,1,2,2,0,0],
      [0,2,1,1,5,5,1,1,5,5,1,1,2,0],
      [0,2,1,5,5,1,0,0,1,5,5,1,2,0],
      [0,0,2,1,1,0,0,0,0,1,1,2,0,0],
      [0,0,0,2,0,0,1,1,0,0,2,0,0,0],
      [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
      [0,0,0,0,3,3,3,3,3,3,0,0,0,0],
      [0,0,0,3,4,4,4,4,4,4,3,0,0,0],
      [0,0,3,4,4,4,4,4,4,4,4,3,0,0],
      [0,0,3,4,4,4,4,4,4,4,4,3,0,0],
      [0,0,3,4,4,4,4,4,4,4,4,3,0,0],
      [0,0,3,4,4,4,4,4,4,4,4,3,0,0],
      [0,0,0,3,4,4,4,4,4,4,3,0,0,0],
      [0,0,0,0,3,3,3,3,3,3,0,0,0,0],
    ],
  },
  fridge: { name: '냉장고', w: 16, h: 24, interaction: 'eat',
    colors: { 1: '#c0c0c0', 2: '#d8d8d8', 3: '#e8e8e8', 4: '#f5f5f5', 5: '#888888', 6: '#666666' },
    sprite: [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,5,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,5,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,6,6,6,6,6,6,6,6,6,6,6,6,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,5,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,5,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,5,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    ],
  },
  diningTable: { name: '식탁', w: 36, h: 14, interaction: 'eat_at',
    colors: { 1: '#5c3a1e', 2: '#7a4f2e', 3: '#8b6340', 4: '#a87050', 5: '#c4a882' },
    sprite: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,2,1],
      [1,2,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,2,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
    ],
  },
  toyTruck: { name: '장난감트럭', w: 22, h: 12, interaction: 'play',
    colors: { 1: '#cc3333', 2: '#ff4444', 3: '#ff6666', 4: '#333333', 5: '#555555', 6: '#ffcc00', 7: '#4488cc' },
    sprite: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,2,7,7,7,7,2,2,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,2,7,7,7,7,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,2,3,3,3,3,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,2,3,3,3,3,3,3,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,6,6,1,1,0],
      [0,0,4,5,5,4,0,0,0,0,0,0,0,0,0,0,4,5,5,4,0,0],
      [0,4,5,5,5,5,4,0,0,0,0,0,0,0,0,4,5,5,5,5,4,0],
      [0,0,4,5,5,4,0,0,0,0,0,0,0,0,0,0,4,5,5,4,0,0],
    ],
  },
  tv: { name: 'TV', w: 26, h: 18, interaction: 'watch',
    colors: { 1: '#222222', 2: '#333333', 3: '#4488cc', 4: '#66aadd', 5: '#88ccee', 6: '#444444', 7: '#ff4444' },
    sprite: [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,5,5,4,4,5,5,5,4,4,5,5,4,4,5,5,4,4,3,2,1,0],
      [0,1,2,3,4,5,5,4,4,5,5,5,4,4,5,5,4,4,5,5,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,5,5,5,4,4,5,5,5,4,4,5,5,5,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,5,5,5,4,4,5,5,5,4,4,5,5,5,4,4,4,3,2,1,0],
      [0,1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0],
    ],
  },
  piano: { name: '피아노', w: 28, h: 16, interaction: 'music',
    colors: { 1: '#1a1a1a', 2: '#2a2a2a', 3: '#333333', 4: '#ffffff', 5: '#e8e8e8', 6: '#8b4513' },
    sprite: [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0],
      [0,1,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,1,0],
      [0,1,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,1,0],
      [0,1,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,1,0],
      [0,1,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,4,1,4,1,0],
      [0,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,0],
      [0,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0],
      [0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0],
      [0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0],
      [0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0],
    ],
  },
  soccerBall: { name: '축구공', w: 12, h: 12, interaction: 'ball',
    colors: { 1: '#ffffff', 2: '#e8e8e8', 3: '#222222', 4: '#d0d0d0' },
    sprite: [
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,3,3,1,1,1,0,0],
      [0,1,1,1,3,3,3,3,1,1,1,0],
      [0,1,1,1,3,3,3,3,1,1,1,0],
      [1,1,3,3,1,1,1,1,3,3,1,1],
      [1,3,3,3,1,1,1,1,3,3,3,1],
      [1,3,3,1,1,1,1,1,1,3,3,1],
      [1,1,3,3,1,1,1,1,3,3,1,1],
      [0,1,1,1,3,3,3,3,1,1,1,0],
      [0,4,1,1,3,3,3,3,1,1,4,0],
      [0,0,4,4,1,3,3,1,4,4,0,0],
      [0,0,0,0,4,4,4,4,0,0,0,0],
    ],
  },
  soccerGoal: { name: '축구골대', w: 30, h: 20,
    colors: { 1: '#ffffff', 2: '#e0e0e0', 3: '#cccccc', 4: '#aaaaaa', 5: '#44bb44', 6: '#888888' },
    sprite: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,6,0,0,0,2,1],
      [1,2,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,6,0,0,2,1],
      [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
      [1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1],
      [4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4],
    ],
  },
  door: { name: '현관문', w: 18, h: 28, interaction: 'goout',
    colors: { 1: '#5c3a1e', 2: '#7a4f2e', 3: '#8b6340', 4: '#a87050', 5: '#ffd700', 6: '#4a3018' },
    sprite: [
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,2,2,2,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,2,2,2,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,2,2,2,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,5,5,2,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,5,5,2,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,2,2,2,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,4,4,4,3,2,2,3,4,4,4,3,2,6,1],
      [1,6,2,3,3,3,3,3,2,2,3,3,3,3,3,2,6,1],
      [1,6,2,2,2,2,2,2,2,2,2,2,2,2,2,2,6,1],
      [1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    ],
    // 문 열린 스프라이트 (밝은 배경 + 열린 문)
    spriteOpen: [
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,1],
      [1,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,1],
      [1,6,7,8,8,8,8,8,8,8,8,8,8,8,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,9,9,9,9,9,9,9,9,9,9,8,7,6,1],
      [1,6,7,8,8,8,8,8,8,8,8,8,8,8,8,7,6,1],
      [1,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,1],
      [1,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    ],
    colorsOpen: { 1: '#5c3a1e', 2: '#7a4f2e', 3: '#8b6340', 4: '#a87050', 5: '#ffd700', 6: '#4a3018', 7: '#c4a882', 8: '#aaddff', 9: '#cceeff' },
  },
};

// Export for MyRoom to use
export { FURNITURE_DEFS, FURNITURE_PRICE, FURNITURE_TOOLTIPS };

const FURNITURE_TOOLTIPS = {
  bed: '캐릭터가 침대에서 잠을 자요 zzZ',
  desk: '캐릭터가 책상에 앉아 공부해요',
  chair: '캐릭터가 의자에 앉아요',
  bookshelf: '방을 꾸미는 책장이에요',
  rug: '방을 꾸미는 러그에요',
  windowF: '방에 창문을 달아요',
  lamp: '방을 밝히는 스탠드에요',
  clock: '벽에 거는 시계에요',
  plant: '방을 꾸미는 화분이에요',
  fridge: '캐릭터가 냉장고에서 간식을 꺼내 먹어요',
  diningTable: '캐릭터가 식탁에서 밥을 먹어요',
  toyTruck: '캐릭터가 트럭을 타고 돌아다녀요!\n내 캐릭터도 탑승 가능!',
  tv: '캐릭터가 TV를 시청해요',
  piano: '캐릭터가 피아노를 연주해요',
  soccerBall: '캐릭터가 공을 차요!\n골대에 넣으면 GOAL! +5점',
  soccerGoal: '축구공이 골대에 들어가면\nGOAL!! 폭죽 + 5점 보상!',
  door: '캐릭터가 외출했다 돌아와요!\n문이 열리고 닫혀요',
};

const FURNITURE_IDS = Object.keys(FURNITURE_DEFS);

function FurnitureCanvas({ furnitureId, scale = 2 }) {
  const canvasRef = useRef(null);
  const f = FURNITURE_DEFS[furnitureId];

  useEffect(() => {
    if (!canvasRef.current || !f) return;
    const ctx = canvasRef.current.getContext('2d');
    const w = f.w * scale;
    const h = f.h * scale;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    ctx.clearRect(0, 0, w, h);
    f.sprite.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val && f.colors[val]) {
          ctx.fillStyle = f.colors[val];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }, [furnitureId, scale]);

  if (!f) return null;
  const w = f.w * scale;
  const h = f.h * scale;
  return <canvas ref={canvasRef} width={w} height={h} style={{ width: w, height: h, imageRendering: 'pixelated' }} />;
}

export default function Shop({ player, nickname, onUpdate, onBack }) {
  const [tab, setTab] = useState('character'); // 'character' | 'furniture'
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schoolInput, setSchoolInput] = useState('');
  const [schoolError, setSchoolError] = useState('');
  const [message, setMessage] = useState(null);
  const [furnitureTooltip, setFurnitureTooltip] = useState(null);
  const [ownedFurniture, setOwnedFurniture] = useState(() => {
    try {
      const saved = localStorage.getItem(`room_furniture_${nickname}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 온라인이면 Supabase에서 가구 데이터 로드
  useEffect(() => {
    if (!isOnline()) return;
    (async () => {
      const data = await getRoomData(nickname);
      if (data) {
        const furniture = data.room_furniture || [];
        const layout = data.room_layout || [];
        if (furniture.length > 0) {
          setOwnedFurniture(furniture);
          localStorage.setItem(`room_furniture_${nickname}`, JSON.stringify(furniture));
        }
        if (layout.length > 0) {
          localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(layout));
        }
      }
    })();
  }, [nickname]);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 1500);
  };

  // ── 캐릭터 관련 ──
  const handleBuy = (id) => {
    playClick();
    if (id === SCHOOL_CARD_ID) { setSchoolInput(''); setSchoolError(''); }
    setConfirm({ type: 'buy', id });
  };

  const handleSell = (id) => {
    playClick();
    setConfirm({ type: 'sell', id });
  };

  const confirmBuy = async () => {
    if (!confirm || confirm.type !== 'buy') return;
    const id = confirm.id;
    const isSchoolCard = id === SCHOOL_CARD_ID;
    const price = getPrice(id);

    if (isSchoolCard && schoolInput.trim().length < 1) return;
    if (isSchoolCard && containsProfanity(schoolInput.trim())) {
      setSchoolError('사용할 수 없는 이름이에요!');
      return;
    }

    setSchoolError('');
    setLoading(true);

    if (isOnline()) {
      const result = await purchaseOnlineCharacter(nickname, id, price);
      if (result.success) {
        playPurchase();
        if (isSchoolCard) await updateSchoolName(nickname, schoolInput.trim());
        onUpdate({
          score: result.player.score,
          characters: result.player.characters,
          equippedCharacter: result.player.equipped_character,
          schoolName: isSchoolCard ? schoolInput.trim() : player.schoolName,
        });
      }
    } else {
      const result = purchaseCharacter(nickname, id, price);
      if (result.success) {
        playPurchase();
        if (isSchoolCard) {
          result.player.schoolName = schoolInput.trim();
          const players = JSON.parse(localStorage.getItem('gugudan_players') || '{}');
          if (players[nickname]) {
            players[nickname].schoolName = schoolInput.trim();
            localStorage.setItem('gugudan_players', JSON.stringify(players));
          }
        }
        onUpdate(result.player);
      }
    }

    setConfirm(null);
    setLoading(false);
  };

  const confirmSell = async () => {
    if (!confirm || confirm.type !== 'sell') return;
    const id = confirm.id;
    const refund = Math.floor(getPrice(id) / 2);

    setLoading(true);

    if (isOnline()) {
      const result = await sellOnlineCharacter(nickname, id, refund);
      if (result.success) {
        playClick();
        onUpdate({
          score: result.player.score,
          characters: result.player.characters,
          equippedCharacter: result.player.equipped_character,
          schoolName: id === SCHOOL_CARD_ID ? '' : player.schoolName,
        });
      }
    } else {
      const result = sellCharacter(nickname, id, refund);
      if (result.success) {
        playClick();
        onUpdate(result.player);
      }
    }

    setConfirm(null);
    setLoading(false);
  };

  const handleEquip = async (id) => {
    playClick();
    if (isOnline()) {
      const result = await equipOnlineCharacter(nickname, id);
      if (result) {
        onUpdate({
          score: result.score,
          characters: result.characters,
          equippedCharacter: result.equipped_character,
          schoolName: player.schoolName,
        });
      }
    } else {
      const updated = equipCharacter(nickname, id);
      if (updated) onUpdate(updated);
    }
  };

  // ── 가구 구매 ──
  const FURNITURE_MAX_COUNT = { soccerGoal: 2 };
  const handleBuyFurniture = async (furnitureId) => {
    // 최대 구매 개수 제한 체크
    if (FURNITURE_MAX_COUNT[furnitureId]) {
      const currentCount = ownedFurniture.filter(id => id === furnitureId).length;
      if (currentCount >= FURNITURE_MAX_COUNT[furnitureId]) {
        playWrong();
        showMessage(`${FURNITURE_DEFS[furnitureId].name}은(는) 최대 ${FURNITURE_MAX_COUNT[furnitureId]}개까지만 구매 가능!`);
        return;
      }
    }

    if (player.score < FURNITURE_PRICE) {
      playWrong();
      showMessage('포인트가 부족합니다!');
      return;
    }

    playPurchase();

    if (isOnline()) {
      await updateOnlineScore(nickname, -FURNITURE_PRICE);
    } else {
      updatePlayerScore(nickname, -FURNITURE_PRICE);
    }

    const newOwned = [...ownedFurniture, furnitureId];
    setOwnedFurniture(newOwned);
    localStorage.setItem(`room_furniture_${nickname}`, JSON.stringify(newOwned));

    // 자동 배치
    const f = FURNITURE_DEFS[furnitureId];
    const ROOM_W = 300, ROOM_H = 200, SCALE = 2;
    let newLayout = [];
    try {
      const saved = localStorage.getItem(`room_layout_${nickname}`);
      newLayout = saved ? JSON.parse(saved) : [];
      newLayout.push({
        id: furnitureId,
        x: f.wallMount ? 100 + Math.random() * 80 : 20 + Math.random() * (ROOM_W - (f.w * SCALE / 600) * ROOM_W - 40),
        y: f.wallMount ? 10 + Math.random() * 30 : ROOM_H - (f.h * SCALE / 400) * ROOM_H - 5,
      });
      localStorage.setItem(`room_layout_${nickname}`, JSON.stringify(newLayout));
    } catch {}

    // Supabase 동기화
    if (isOnline()) {
      saveRoomData(nickname, newLayout, newOwned);
    }

    onUpdate({ ...player, score: player.score - FURNITURE_PRICE });
    showMessage(`${f.name} 구매 완료!`);
  };

  const characters = Object.entries(CHARACTER_PALETTES).map(([id, data]) => ({
    id: Number(id),
    name: data.name,
    owned: player.characters.includes(Number(id)),
    equipped: player.equippedCharacter === Number(id),
    price: getPrice(Number(id)),
    isSchoolCard: !!data.isSchoolCard,
  }));

  const isPopupOpen = confirm !== null;
  const popupId = confirm?.id;
  const popupType = confirm?.type;

  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 6, textShadow: '2px 2px 0 #b8860b' }}>
        상점
      </div>
      <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 12 }}>
        {player.score.toLocaleString()} P
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, width: '100%' }}>
        <button
          onClick={() => { playClick(); setTab('character'); }}
          style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: tab === 'character' ? '#333388' : '#1a1a3e',
            color: tab === 'character' ? '#fff' : '#888',
            fontSize: 11, fontFamily: "'Press Start 2P', monospace",
            borderBottom: tab === 'character' ? '2px solid var(--gold)' : '2px solid transparent',
          }}
        >
          캐릭터
        </button>
        <button
          onClick={() => { playClick(); setTab('furniture'); }}
          style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: tab === 'furniture' ? '#333388' : '#1a1a3e',
            color: tab === 'furniture' ? '#fff' : '#888',
            fontSize: 11, fontFamily: "'Press Start 2P', monospace",
            borderBottom: tab === 'furniture' ? '2px solid var(--gold)' : '2px solid transparent',
          }}
        >
          가구
        </button>
      </div>

      {/* 메시지 */}
      {message && (
        <div style={{
          position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          background: '#1a1a5e', border: '2px solid var(--gold)',
          borderRadius: 8, padding: '12px 24px',
          fontSize: 12, color: '#fff', zIndex: 9999,
          fontFamily: "'Press Start 2P', monospace",
          textShadow: '1px 1px 0 #000',
        }}>
          {message}
        </div>
      )}

      {/* 캐릭터 구매 팝업 */}
      {isPopupOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#141450', border: '4px solid #6666aa',
            padding: 30, textAlign: 'center', maxWidth: 320, width: '90%',
          }}>
            {popupId === SCHOOL_CARD_ID ? (
              <SchoolCardCharacter schoolName={popupType === 'buy' ? (schoolInput || '학교') : (player.schoolName || '학교')} pixelSize={4} />
            ) : (
              <PixelCharacter characterId={popupId} pixelSize={4} />
            )}

            {popupType === 'sell' ? (
              <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
                [{CHARACTER_PALETTES[popupId]?.isSchoolCard
                  ? (player.schoolName ? `${player.schoolName}초` : '학교 카드')
                  : CHARACTER_PALETTES[popupId]?.name}]를<br />
                판매할까요?<br />
                <span style={{ color: 'var(--gold)' }}>
                  +{Math.floor(getPrice(popupId) / 2).toLocaleString()}P 환급
                </span>
              </div>
            ) : popupId === SCHOOL_CARD_ID ? (
              <>
                <div style={{ fontSize: 10, margin: '16px 0 10px', lineHeight: 2 }}>
                  학교 이름을 입력하세요<br />(1~4글자)
                </div>
                <input
                  type="text"
                  value={schoolInput}
                  onChange={(e) => { setSchoolInput(e.target.value.slice(0, 4)); setSchoolError(''); }}
                  maxLength={4}
                  placeholder="중촌"
                  autoFocus
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 14, padding: '10px 16px',
                    background: '#0a0a2e', border: '3px solid #6666aa',
                    color: 'white', textAlign: 'center',
                    width: '80%', outline: 'none', marginBottom: 12,
                  }}
                />
                {schoolError && (
                  <div style={{ fontSize: 10, color: '#ff4444', marginBottom: 8 }}>{schoolError}</div>
                )}
                <div style={{ fontSize: 9, color: '#888', marginBottom: 16, lineHeight: 1.8 }}>
                  {SCHOOL_CARD_PRICE.toLocaleString()}점을 사용합니다
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, margin: '16px 0', lineHeight: 2 }}>
                {getPrice(popupId).toLocaleString()}점을 사용하여<br />
                [{CHARACTER_PALETTES[popupId]?.name}]를<br />
                구매할까요?
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className={`pixel-btn ${popupType === 'sell' ? '' : 'gold'}`}
                onClick={popupType === 'sell' ? confirmSell : confirmBuy}
                disabled={loading || (popupType === 'buy' && popupId === SCHOOL_CARD_ID && schoolInput.trim().length < 1)}
                style={{ flex: 1, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '...' : popupType === 'sell' ? '판매' : '구매'}
              </button>
              <button className="pixel-btn red" onClick={() => setConfirm(null)} style={{ flex: 1 }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 탭 */}
      {tab === 'character' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, width: '100%', marginBottom: 20,
        }}>
          {characters.map((char) => (
            <div
              key={char.id}
              style={{
                background: char.equipped ? '#1a3a5c' : '#141450',
                border: `3px solid ${char.equipped ? '#5dde9e' : char.owned ? '#6666aa' : char.isSchoolCard ? '#ffd700' : '#333355'}`,
                padding: 14, textAlign: 'center',
                opacity: !char.owned && player.score < char.price ? 0.4 : 1,
                transition: 'transform 0.1s',
              }}
            >
              <div className="char-tooltip-wrapper">
                {char.isSchoolCard ? (
                  <SchoolCardCharacter schoolName={player.schoolName || '학교'} pixelSize={4} />
                ) : (
                  <PixelCharacter characterId={char.id} pixelSize={4} />
                )}
                <div className="char-tooltip">
                  {(CHARACTER_TOOLTIPS[char.id] || '').split('\n').map((line, i) => (
                    <span key={i}>{line}{i < (CHARACTER_TOOLTIPS[char.id] || '').split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, marginTop: 6 }}>
                {char.isSchoolCard ? (player.schoolName ? `${player.schoolName}초` : '학교 카드') : char.name}
              </div>
              <div style={{
                fontSize: 10, marginTop: 4,
                color: char.equipped ? '#5dde9e' : char.owned ? '#aaa' : 'var(--gold)',
              }}>
                {char.equipped ? '장착중' : char.owned ? '보유' : `${char.price.toLocaleString()}P`}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'center' }}>
                {!char.owned && player.score >= char.price && (
                  <button
                    onClick={() => handleBuy(char.id)}
                    style={{
                      background: '#b8860b', border: '2px solid #daa520',
                      color: 'white', fontFamily: "'Press Start 2P', monospace",
                      fontSize: 8, padding: '4px 8px', cursor: 'pointer',
                    }}
                  >
                    구매
                  </button>
                )}
                {char.owned && !char.equipped && (
                  <>
                    <button
                      onClick={() => handleEquip(char.id)}
                      style={{
                        background: '#2a5a3a', border: '2px solid #5dde9e',
                        color: '#5dde9e', fontFamily: "'Press Start 2P', monospace",
                        fontSize: 8, padding: '4px 8px', cursor: 'pointer',
                      }}
                    >
                      장착
                    </button>
                    {char.id !== 0 && (
                      <button
                        onClick={() => handleSell(char.id)}
                        style={{
                          background: '#5a2a2a', border: '2px solid #ff6666',
                          color: '#ff6666', fontFamily: "'Press Start 2P', monospace",
                          fontSize: 8, padding: '4px 8px', cursor: 'pointer',
                        }}
                      >
                        판매
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 가구 탭 */}
      {tab === 'furniture' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10, width: '100%', marginBottom: 20,
        }}>
          {FURNITURE_IDS.map(fId => {
            const f = FURNITURE_DEFS[fId];
            const ownedCount = ownedFurniture.filter(id => id === fId).length;
            return (
              <button
                key={fId}
                onClick={() => handleBuyFurniture(fId)}
                style={{
                  background: '#141450',
                  border: ownedCount > 0 ? '2px solid #336633' : '2px solid #333366',
                  borderRadius: 6, padding: 10, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <div className="char-tooltip-wrapper" style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}>
                  <FurnitureCanvas furnitureId={fId} scale={2} />
                  {FURNITURE_TOOLTIPS[fId] && (
                    <div className="char-tooltip">
                      {FURNITURE_TOOLTIPS[fId].split('\n').map((line, i) => (
                        <span key={i}>{line}{i < FURNITURE_TOOLTIPS[fId].split('\n').length - 1 && <br />}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#fff', fontFamily: "'Press Start 2P', monospace" }}>
                  {f.name} {ownedCount > 0 ? `x${ownedCount}` : ''}
                </div>
                <div style={{
                  fontSize: 9,
                  color: FURNITURE_MAX_COUNT[fId] && ownedCount >= FURNITURE_MAX_COUNT[fId] ? '#888' : 'var(--gold)',
                  fontFamily: "'Press Start 2P', monospace",
                }}>
                  {FURNITURE_MAX_COUNT[fId] && ownedCount >= FURNITURE_MAX_COUNT[fId] ? `MAX (${ownedCount}/${FURNITURE_MAX_COUNT[fId]})` : `${FURNITURE_PRICE.toLocaleString()} P`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        className="pixel-btn red"
        onClick={() => { playClick(); onBack(); }}
      >
        돌아가기
      </button>
    </div>
  );
}
