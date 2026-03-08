import { playClick } from '../utils/sound';

const sections = [
  {
    title: '게임 조작법',
    items: [
      '마우스로 정답 클릭',
      '또는 키보드 방향키로 정답 선택 후 스페이스바/엔터',
    ],
  },
  {
    title: '게임 규칙',
    items: [
      '2단부터 20단까지 순서대로 도전',
      '행성이 지구로 떨어지기 전에 답을 맞히세요',
      '제한시간: 10초',
      '틀린 문제는 모두 맞출 때까지 재출제',
    ],
  },
  {
    title: '점수 산출 방식',
    items: [
      '1초 이내: 100점',
      '2초 이내: 90점',
      '3초 이내: 80점',
      '4초 이내: 70점',
      '5초 이내: 60점',
      '6초 이내: 50점',
      '7초 이내: 40점',
      '8초 이내: 30점',
      '9초 이내: 20점',
      '10초 이내: 10점',
      '오답 / 시간초과: -100점',
    ],
  },
  {
    title: '상점 - 캐릭터',
    items: [
      '지렁이(기본 캐릭터)는 무료',
      '일반 캐릭터: 1,000P / 프리미엄: 3,000P',
      '황금 지렁이: 10,000P (오답 감점 면역!)',
      '학교 카드: 5,000P (나만의 학교 이름!)',
      '구매 시 자동으로 장착됨',
      '보유 캐릭터 판매 시 구매가의 50% 환급',
    ],
  },
  {
    title: '상점 - 가구',
    items: [
      '모든 가구 1,000P',
      '같은 가구 여러 개 구매 가능',
      '구매 시 내 방에 자동 배치',
      '침대, 책상, 의자, 책장, 러그 등 9종',
    ],
  },
  {
    title: '내 방',
    items: [
      '보유한 캐릭터들이 방 안을 돌아다녀요',
      '캐릭터가 가끔 말풍선으로 대화해요',
      '침대에서 자기도, 의자에 앉기도 해요',
      '[꾸미기] 버튼으로 가구 배치 변경',
      '가구를 드래그하여 원하는 위치로 이동',
      'x 버튼으로 가구를 치울 수 있어요',
      '배치한 위치는 자동 저장됩니다',
    ],
  },
  {
    title: '함께 구구단',
    items: [
      '친구와 점수 경쟁하는 모드!',
      '방을 만들거나 코드로 참여할 수 있어요',
      '2단~9단 각자 풀기, 실시간 순위 표시',
      '점수·벌점 모두 2배!',
      '캐릭터 특수능력 무효 (황금 지렁이 포함)',
      '누구라도 9단 완료 시 전체 게임 종료!',
    ],
  },
  {
    title: '랭킹 기준',
    items: [
      '이번 주 총 획득 점수 기준 정렬',
      '매주 월요일 자동 초기화',
      '캐릭터/가구는 초기화되지 않고 영구 보유',
      '보유 점수 = 획득 점수 - 소비 점수',
    ],
  },
  {
    title: '히든 보상',
    items: [
      '2단~9단을 한 문제도 틀리지 않고 클리어하면',
      '보너스 10,000P가 지급됩니다!',
      '4단 클리어 후부터 힌트 팝업이 나타나요',
      '순서대로/랜덤 모드 모두 적용!',
    ],
  },
];

export default function HelpScreen({ onBack }) {
  return (
    <div className="game-container" style={{ justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={{
        fontSize: 20,
        color: 'var(--gold)',
        marginBottom: 24,
        textShadow: '2px 2px 0 #b8860b',
      }}>
        도움말
      </div>

      <div style={{ width: '100%', marginBottom: 20 }}>
        {sections.map((section) => (
          <div
            key={section.title}
            style={{
              background: '#141450',
              border: '3px solid #333366',
              padding: 20,
              marginBottom: 14,
            }}
          >
            <div style={{
              fontSize: 13,
              color: 'var(--gold)',
              marginBottom: 12,
              textShadow: '1px 1px 0 #b8860b',
            }}>
              {section.title}
            </div>
            {section.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: 10,
                  color: '#ccc',
                  lineHeight: 2.2,
                  paddingLeft: 8,
                }}
              >
                · {item}
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        className="pixel-btn red"
        onClick={() => { playClick(); onBack(); }}
      >
        돌아가기
      </button>
    </div>
  );
}
