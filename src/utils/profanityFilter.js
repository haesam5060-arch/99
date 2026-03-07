// Korean profanity/inappropriate word filter for elementary students
const BLOCKED_WORDS = [
  // 욕설/비속어
  '시발', '씨발', '시bal', '씨bal', 'ㅅㅂ', 'ㅆㅂ',
  '개새끼', '새끼', 'ㅅㄲ',
  '병신', 'ㅂㅅ', '빙신', '벼신',
  '지랄', 'ㅈㄹ', '짜랄',
  '씹', 'ㅆㅂ',
  '좆', 'ㅈㅇㅌ',
  '닥쳐', '닥치',
  '꺼져', '꺼저',
  '미친', '미쳔', '미친놈', '미친년',
  '또라이', '돌아이',
  '멍청', '바보',
  '죽어', '뒤져', '뒈져', '디져',
  '개같', '개년', '개놈',
  '년놈', '걸레',
  '변태',
  '엿먹',
  '느금', '느금마', 'ㄴㄱㅁ',
  '애미', '애비', '에미', '에비',
  '한남', '한녀',
  '섹스', 'sex',
  '야동',
  '음란',
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'dick', 'pussy',
  // 차별/혐오
  '장애',
  '찐따', '찐다',
  '왕따',
  '거지',
  // 우회 표현
  'tlqkf', 'gkrtod', // 시발, 새끼 한영변환
];

export function containsProfanity(text) {
  const lower = text.toLowerCase().replace(/\s/g, '');
  return BLOCKED_WORDS.some(word => lower.includes(word));
}
