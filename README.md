This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 인수인계 / 개발·운영 가이드

다음 운영진/개발자를 위한 자세한 가이드는 **[docs/HANDOVER.md](docs/HANDOVER.md)** 를 읽어주세요. 큰 그림 + 자주 하는 작업 + 트러블슈팅 + 알려진 TODO 가 모두 정리되어 있습니다.

## 환경 변수

`.env.example` 을 참고하여 `.env.local` 을 생성합니다. Vercel 배포 시에는 동일한 키를 대시보드 **Settings → Environment Variables** 에 입력합니다.

## Google Drive 행사 사진 동기화

행사마다 사진을 일일이 업로드하는 대신 Google Drive 폴더 하나만 등록하면 자동으로 행사와 사진이 등록됩니다.

### 사전 준비 (1회)

1. [Google Cloud Console](https://console.cloud.google.com/) 에서 프로젝트 생성 (또는 기존 사용)
2. **APIs & Services → Library** → "Google Drive API" 검색 → **Enable**
3. **APIs & Services → Credentials → Create Credentials → API key** 발급
4. 발급된 키를 `.env.local` 의 `GOOGLE_DRIVE_API_KEY=...` 에 입력
5. Vercel 대시보드에도 같은 키 추가 (Production + Preview 환경 모두)

### 폴더 만들기 / 동기화 절차

1. Google Drive 에 **`YYYY-MM-DD-행사명`** 형식으로 폴더 생성  
   예: `2026-05-10-신입생 환영회`
2. 사진들을 폴더에 업로드 (파일명은 자유)
3. 폴더 **우클릭 → 공유 → "링크가 있는 모든 사용자가 보기"** 설정
4. 폴더 우클릭 → "링크 복사" → 사이트 `/admin/events` 페이지의 "Google Drive 폴더로 일괄 등록" 카드에 붙여넣기 → **동기화** 클릭
5. 추후 사진을 추가했으면 행사 카드 → "사진" → **🔄 Drive 재동기화** 버튼으로 새 사진만 가져옴

### 동작 방식

- 폴더명에서 날짜와 행사명을 자동으로 파싱하여 `Event` 레코드 생성
- 폴더 안의 이미지(JPG/PNG/WebP/GIF 등) 만 자동 등록 (다른 파일은 무시)
- 같은 폴더를 다시 동기화하면 **새로 추가된 사진만** 등록 (멱등성)
- 기존에 직접 업로드한 Vercel Blob 사진과 **병행**해서 표시 가능

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
