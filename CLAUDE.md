# 99단 구구단 게임 프로젝트

## 배포 규칙 (필수)
- 개발 완료 후 반드시 `git add` → `git commit` → `git push`까지 수행할 것
- GitHub push 시 Vercel이 자동 배포됨 (99-tau.vercel.app)
- 배포 URL: https://99-tau.vercel.app
- GitHub repo: https://github.com/haesam5060-arch/99.git

## 빌드 검증
- push 전에 반드시 `npm run build` 실행하여 빌드 에러 없는지 확인

## 기술 스택
- React 18 + Vite
- Supabase (온라인 모드)
- Vercel (자동 배포)

## 프로젝트 구조
- 게임 소스: `gugudan-game/src/`
- 캐릭터 데이터: `gugudan-game/src/data/characters.js`, `premiumCharacters.js`
- 컴포넌트: `gugudan-game/src/components/`
- 유틸: `gugudan-game/src/utils/`
