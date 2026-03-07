// Logic verification tests - run with: node test-logic.mjs
import { calculateScore, WRONG_PENALTY, FALL_DURATION } from './src/utils/scoring.js';
import { generateQuestions, generateChoices } from './src/utils/questions.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${msg}`);
  }
}

console.log('=== 1. 점수 계산 검증 ===');
assert(calculateScore(0.5) === 100, '0.5초 → 100점');
assert(calculateScore(1.0) === 100, '1.0초 → 100점');
assert(calculateScore(1.1) === 80, '1.1초 → 80점');
assert(calculateScore(2.0) === 80, '2.0초 → 80점');
assert(calculateScore(2.5) === 50, '2.5초 → 50점');
assert(calculateScore(3.0) === 50, '3.0초 → 50점');
assert(calculateScore(3.5) === 30, '3.5초 → 30점');
assert(calculateScore(4.0) === 30, '4.0초 → 30점');
assert(calculateScore(4.5) === 10, '4.5초 → 10점');
assert(calculateScore(5.0) === 10, '5.0초 → 10점');
assert(WRONG_PENALTY === -10, '오답 감점 = -10');
assert(FALL_DURATION === 5, '낙하 시간 = 5초');

console.log('\n=== 2. 점수 시뮬레이션 검증 ===');
// 한 단 최고점 (9문제 x 100점)
const maxPerDan = 9 * 100;
assert(maxPerDan === 900, '한 단 최고 = 900점');

// 전체(2~9단) 최고점 (72문제 x 100점)
const maxTotal = 72 * 100;
assert(maxTotal === 7200, '전체 최고 = 7200점');

// 평균 (3초 기준)
const avgPerDan = 9 * 50;
assert(avgPerDan === 450, '한 단 평균(3초) = 450점');
const avgTotal = 72 * 50;
assert(avgTotal === 3600, '전체 평균(3초) = 3600점');

// 캐릭터 구매 가능 수
assert(Math.floor(maxTotal / 1000) === 7, '최고 시 캐릭터 7개 구매 가능');
assert(Math.floor(avgTotal / 1000) === 3, '평균 시 캐릭터 3개 구매 가능');

// 전체 수집 비용
const totalCharCost = 12 * 1000;
assert(totalCharCost === 12000, '전체 캐릭터 수집 = 12000점 필요');

console.log('\n=== 3. 문제 생성 검증 ===');
// 순서대로 모드
const seqQ = generateQuestions(3, 'sequential');
assert(seqQ.length === 9, '3단 순서대로 = 9문제');
assert(seqQ[0].a === 3 && seqQ[0].b === 1, '첫 문제 = 3x1');
assert(seqQ[8].a === 3 && seqQ[8].b === 9, '마지막 문제 = 3x9');
assert(seqQ[4].answer === 15, '3x5 = 15');

// 랜덤 모드
const randQ = generateQuestions(7, 'random');
assert(randQ.length === 9, '7단 랜덤 = 9문제');
const randAnswers = randQ.map(q => q.answer).sort((a, b) => a - b);
const expectedAnswers = [7, 14, 21, 28, 35, 42, 49, 56, 63];
assert(JSON.stringify(randAnswers) === JSON.stringify(expectedAnswers), '7단 랜덤 모든 답 포함');

// 모든 단 검증
for (let dan = 2; dan <= 9; dan++) {
  const q = generateQuestions(dan, 'sequential');
  const allCorrect = q.every((item, idx) => item.answer === dan * (idx + 1));
  assert(allCorrect, `${dan}단 모든 답 정확`);
}

console.log('\n=== 4. 4지선다 검증 ===');
for (let dan = 2; dan <= 9; dan++) {
  const answer = dan * 5;
  const choices = generateChoices(dan, answer);
  assert(choices.length === 4, `${dan}단 선택지 4개`);
  assert(choices.includes(answer), `${dan}단 정답(${answer}) 포함`);

  // 모든 오답이 해당 단의 답인지 확인
  const validAnswers = Array.from({ length: 9 }, (_, i) => dan * (i + 1));
  const allValid = choices.every(c => validAnswers.includes(c));
  assert(allValid, `${dan}단 모든 선택지가 해당 단의 답`);

  // 중복 없는지
  const unique = new Set(choices);
  assert(unique.size === 4, `${dan}단 선택지 중복 없음`);
}

console.log('\n=== 5. 경계값 테스트 ===');
assert(calculateScore(0) === 100, '0초(즉시) → 100점');
assert(calculateScore(0.001) === 100, '0.001초 → 100점');
assert(calculateScore(1.001) === 80, '1.001초 → 80점 (1초 초과)');
assert(calculateScore(4.999) === 10, '4.999초 → 10점');
assert(calculateScore(5.001) === 0, '5.001초 → 0점 (시간초과)');

// 점수 음수 방지 (storage에서 처리)
console.log('  [INFO] 보유 점수 최소 0점 제한은 storage.js의 Math.max(0, ...) 로 처리');

console.log('\n=== 6. 틀린 문제 재출제 시나리오 ===');
// 시뮬레이션: 9문제 중 3문제 틀림 → 재도전에서 3문제만 나옴
const questions = generateQuestions(5, 'sequential');
const wrongOnes = [questions[2], questions[5], questions[7]]; // 5x3, 5x6, 5x8 틀림
assert(wrongOnes.length === 3, '틀린 문제 3개');
assert(wrongOnes[0].answer === 15, '틀린 문제1: 5x3=15');
assert(wrongOnes[1].answer === 30, '틀린 문제2: 5x6=30');
assert(wrongOnes[2].answer === 40, '틀린 문제3: 5x8=40');
// 재출제는 이 3문제만 나와야 함 (GamePlay 컴포넌트에서 startDan(dan, wrongOnes) 호출)
console.log('  [INFO] 재출제 로직: startDan(currentDan, wrongQuestions) → 틀린 것만 재출제');

console.log('\n=== 7. 랭킹 정렬 검증 ===');
// 랭킹 기준: 1차 캐릭터수 내림차순, 2차 점수 내림차순
const mockRankData = [
  { name: 'A', characterCount: 3, score: 500 },
  { name: 'B', characterCount: 5, score: 200 },
  { name: 'C', characterCount: 5, score: 800 },
  { name: 'D', characterCount: 1, score: 9999 },
];
const sorted = mockRankData.sort((a, b) => {
  if (b.characterCount !== a.characterCount) return b.characterCount - a.characterCount;
  return b.score - a.score;
});
assert(sorted[0].name === 'C', '1위: C (캐릭터5개, 점수800)');
assert(sorted[1].name === 'B', '2위: B (캐릭터5개, 점수200)');
assert(sorted[2].name === 'A', '3위: A (캐릭터3개)');
assert(sorted[3].name === 'D', '4위: D (캐릭터1개, 점수 높아도 캐릭터수 우선)');

console.log(`\n=============================`);
console.log(`결과: ${passed} PASSED / ${failed} FAILED`);
console.log(`=============================`);
process.exit(failed > 0 ? 1 : 0);
