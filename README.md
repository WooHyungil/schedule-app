# 📱 형일이의 스케줄 - 웹앱 버전

Windows에서 개발한 iOS/안드로이드 모두 지원하는 **웹기반 일정/할일/가계부 통합 관리 앱**입니다!

## ✨ 주요 기능

- **📅 달력 뷰**: 월별 일정 시각화
- **📝 일정 관리**: 추가/편집/삭제, 반복 설정 지원
- **✅ 할일 체크리스트**: 오늘의 할일 관리 및 진행률 표시
- **💳 가계부**: 월별 지출 관리 및 카테고리별 분석
- **🎨 반응형 UI**: iPhone에 최적화된 모바일 디자인
- **💾 로컬 저장**: 모든 데이터가 브라우저에 저장 (개인정보 보호)
- **🌐 오프라인 작동**: 인터넷 없이도 완벽히 동작

---

## 🚀 빠른 시작

### 1️⃣ 설치

```bash
# Node.js 및 npm 확인
node --version
npm --version

# 프로젝트 진입
cd ScheduleWebApp

# 의존성 설치
npm install
```

### 2️⃣ 개발 서버 실행

```bash
npm run dev
```

터미널에 나오는 URL 확인 (예: `http://localhost:5173`)

### 3️⃣ iPhone에서 접속

**같은 WiFi 연결 후:**

1. iPhone Safari 열기
2. 주소창에 입력: `http://[PC-IP]:5173` 
   - PC IP 확인: Windows 터미널에서 `ipconfig` 실행
   - 예: `192.168.1.100:5173`
3. 공유 → "홈 화면에 추가" → 저장

**이제 앱처럼 사용 가능!** 🎉

---

## 📁 프로젝트 구조

```
ScheduleWebApp/
├── src/
│   ├── components/
│   │   ├── CalendarView.jsx        # 달력 뷰
│   │   ├── ScheduleView.jsx        # 일정 관리
│   │   ├── TodoView.jsx            # 할일 목록
│   │   ├── ExpenseView.jsx         # 가계부
│   │   └── SettingsView.jsx        # 설정
│   ├── App.jsx                     # 메인 앱
│   ├── main.jsx                    # 진입점
│   ├── index.css                   # 스타일
│   └── utils.js                    # 유틸리티
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🛠️ 기술 스택

- **React 18** - UI 프레임워크
- **Vite** - 고속 빌드 도구
- **Tailwind CSS** - 유틸리티 CSS
- **Lucide React** - 아이콘

---

## 💾 데이터 저장

모든 데이터는 **브라우저의 localStorage**에 저장됩니다:
- ✅ 개인정보 완벽 보호
- ✅ 외부 서버 통신 없음
- ✅ 오프라인 완벽 작동

### 데이터 백업

**설정 → 데이터 관리**에서:
- 📥 백업 다운로드: JSON 파일로 저장
- 📤 백업 복원: 이전 데이터 복구

---

## 🎨 기능 상세

### 📅 달력
- 월별 일정 시각화
- 특정 날짜의 모든 일정 표시
- 이전/다음 월 네비게이션

### 📝 일정
- 제목, 설명, 시간 설정
- 카테고리 (일반, 업무, 개인, 약속 등)
- 태그 추가 가능
- 반복 설정 (매일, 매주, 매달)
- 검색 기능

### ✅ 할일
- 오늘의 일정만 표시
- 진행률 실시간 업데이트
- 완료/미완료 토글
- 완료된 항목 표시/숨기기

### 💳 가계부
- 월별 총 지출액 표시
- 카테고리별 분석 (차트)
- 8가지 카테고리 지원
- 지출/수입 기록
- 메모 추가 가능

### ⚙️ 설정
- 통계 보기
- 데이터 백업/복원
- 모든 데이터 삭제
- 앱 정보

---

## 🔒 보안 및 개인정보

- 모든 데이터는 기기의 로컬 저장소에만 저장
- 외부 서버 통신 없음
- 암호화는 필요 없음 (로컬에만 존재)
- 정기적 백업 권장

---

## 📊 사용 팁

1. **iPhone 앱처럼 사용**
   ```
   Safari → 공유 → 홈 화면에 추가 → 저장
   ```

2. **PC와 iPhone 동시 사용**
   - 같은 WiFi 연결
   - 같은 URL로 접속
   - 별도의 데이터 (독립적 저장)

3. **데이터 백업**
   - 정기적으로 설정에서 백업 다운로드
   - USB나 클라우드에 저장

4. **모바일 최적화**
   - 세로 모드 최적화
   - 터치 친화적 버튼
   - 빠른 로딩

---

## 🐛 알려진 제한사항

- 브라우저 캐시 삭제 시 데이터 손실 가능
- PC 여러 대에서 사용 시 데이터 공유 불가
- 동시 업데이트 시 최신 데이터 덮어씌워짐

---

## 🚀 배포하기

### Vercel (권장 - 무료)

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel
```

### Netlify (무료)

1. https://netlify.com 접속
2. 프로젝트 폴더 드래그&드롭
3. 자동 배포!

### 그 외

- GitHub Pages
- Firebase Hosting
- Cloudflare Pages

---

## 📱 모바일 설정 (PWA)

PWA를 지원하려면 `public/manifest.json` 추가:

```json
{
  "name": "형일이의 스케줄",
  "short_name": "스케줄",
  "description": "일정, 할일, 가계부 통합 앱",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#007AFF",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## 💡 개선 예정

- [ ] 클라우드 동기화 (Google Drive)
- [ ] 공유 일정 기능
- [ ] 더 많은 차트/분석
- [ ] 알림 기능
- [ ] 다크 모드
- [ ] 다국어 지원

---

## 📞 문의

버그 신고나 기능 제안은 GitHub Issues로 부탁드립니다.

---

**Made with ❤️ by Copilot**

Created: 2026년 4월
Last Updated: 2026년 4월 6일
