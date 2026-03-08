// 캐릭터별 미사일 스타일
// 일반 동물(0~12): 테마 색상 미사일
// 학교카드(13): 금색 미사일
// 프리미엄(14~23): 크고 화려한 특수 미사일

const MISSILE_STYLES = {
  // 지렁이 - 핑크 에너지볼
  0: { head: '#ff88cc', mid: '#ff55aa', tail: '#ff3399', size: 10, trail: 3, name: 'energy' },
  // 쥐 - 회색 돌멩이
  1: { head: '#e0e0e0', mid: '#c0c0c0', tail: '#909090', size: 10, trail: 2, name: 'rock' },
  // 소 - 갈색 뿔
  2: { head: '#ffffff', mid: '#d4a574', tail: '#8B6914', size: 12, trail: 2, name: 'horn' },
  // 호랑이 - 주황 화염구
  3: { head: '#ffee44', mid: '#ff9900', tail: '#cc5500', size: 12, trail: 4, name: 'fire' },
  // 토끼 - 하얀 당근 미사일
  4: { head: '#ffcc66', mid: '#ff9944', tail: '#ff6622', size: 10, trail: 3, name: 'carrot' },
  // 용 - 초록 화염
  5: { head: '#ffcc00', mid: '#33cc66', tail: '#228844', size: 14, trail: 5, name: 'dragonfire' },
  // 뱀 - 독침
  6: { head: '#66ff66', mid: '#33cc33', tail: '#228822', size: 10, trail: 4, name: 'poison' },
  // 말 - 말발굽 충격파
  7: { head: '#ffffff', mid: '#d4a574', tail: '#6B4914', size: 12, trail: 3, name: 'hoof' },
  // 양 - 솜뭉치
  8: { head: '#ffffff', mid: '#eeeecc', tail: '#ccccaa', size: 14, trail: 2, name: 'wool' },
  // 원숭이 - 바나나
  9: { head: '#ffee44', mid: '#ffcc00', tail: '#cc9900', size: 10, trail: 3, name: 'banana' },
  // 닭 - 알
  10: { head: '#ffffff', mid: '#ffffcc', tail: '#ffcc00', size: 12, trail: 2, name: 'egg' },
  // 개 - 뼈다귀
  11: { head: '#ffffff', mid: '#e0e0e0', tail: '#c0c0c0', size: 10, trail: 3, name: 'bone' },
  // 돼지 - 핑크 에너지
  12: { head: '#ffccdd', mid: '#ffaacc', tail: '#ff88aa', size: 12, trail: 3, name: 'pink' },
  // 학교 카드 - 금색 스타
  13: { head: '#ffffff', mid: '#ffd700', tail: '#b8860b', size: 14, trail: 4, name: 'star' },

  // === 프리미엄 (더 크고 화려) ===
  // 우주비행사 - 로켓
  14: { head: '#ffffff', mid: '#55aaff', tail: '#ff6600', size: 18, trail: 6, name: 'rocket', premium: true },
  // 로봇 - 레이저 빔
  15: { head: '#ffffff', mid: '#00ff66', tail: '#44aaff', size: 16, trail: 7, name: 'laser', premium: true },
  // 닌자 - 수리검
  16: { head: '#c0c0c0', mid: '#888888', tail: '#555555', size: 16, trail: 5, name: 'shuriken', premium: true },
  // 기사 - 성스러운 검기
  17: { head: '#ffffff', mid: '#ffdd44', tail: '#ff3333', size: 18, trail: 6, name: 'sword', premium: true },
  // 마법사 - 마법 오브
  18: { head: '#ff66ff', mid: '#9944cc', tail: '#00ffcc', size: 18, trail: 7, name: 'magic', premium: true },
  // 해적 - 대포알
  19: { head: '#ffffff', mid: '#555555', tail: '#ff4400', size: 20, trail: 5, name: 'cannonball', premium: true },
  // 히어로 - 에너지 펀치
  20: { head: '#ffdd00', mid: '#ff2222', tail: '#2244cc', size: 20, trail: 7, name: 'punch', premium: true },
  // 냥이전사 - 참치캔
  21: { head: '#c0c0c0', mid: '#ff9944', tail: '#ff6688', size: 16, trail: 5, name: 'tuna', premium: true },
  // 아이스크림 - 아이스볼
  22: { head: '#ffffff', mid: '#88ddff', tail: '#ffaacc', size: 18, trail: 6, name: 'ice', premium: true },
  // 드래곤 - 거대 화염구
  23: { head: '#ffffff', mid: '#ff4400', tail: '#cc2222', size: 22, trail: 8, name: 'megafire', premium: true },
  // 황금 지렁이 - 거대 황금 에너지 폭발
  24: { head: '#ffffff', mid: '#ffd700', tail: '#ff6600', size: 26, trail: 10, name: 'goldblast', premium: true },
  // 린디 - 곰인형 점프킥 에너지
  25: { head: '#ffaaaa', mid: '#c8915a', tail: '#ff6666', size: 18, trail: 6, name: 'bearkick', premium: true },
};

export function getMissileStyle(characterId) {
  return MISSILE_STYLES[characterId] || MISSILE_STYLES[0];
}

export default MISSILE_STYLES;
