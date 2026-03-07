import { playClick } from '../utils/sound';

const sections = [
  {
    title: '게임 조작법',
    items: [
      '1~4 숫자키: 답 바로 선택',
      '방향키: 답 이동',
      'Enter / Space: 답 확인',
      'ESC: 게임 중단 (점수 정산)',
      '마우스 클릭으로도 선택 가능',
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
    title: '캐릭터 상점',
    items: [
      '지렁이(기본 캐릭터)는 무료',
      '점수가 있으면 원하는 캐릭터 구매 가능',
      '구매 시 자동으로 장착됨',
      '보유 캐릭터 판매 시 구매가의 50% 환급',
    ],
  },
  {
    title: '랭킹 기준',
    items: [
      '이번 달 총 획득 점수 기준 정렬',
      '매월 1일 자동 초기화',
      '캐릭터는 초기화되지 않고 영구 보유',
      '보유 점수 = 획득 점수 - 소비 점수',
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
