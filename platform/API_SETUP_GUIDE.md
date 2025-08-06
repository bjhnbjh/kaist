# API 서버 설정 및 로컬 테스트 가이드

## 현재 API 구성

### 구현된 API 엔드포인트들

1. **POST /api/drawing** - 그리기 데이터 저장
2. **POST /api/upload** - 비디오 업로드 정보 저장  
3. **POST /api/webvtt** - WebVTT 파일 저장
4. **GET /api/ping** - 서버 상태 확인
5. **GET /api/demo** - 데모 엔드포인트

### API URL 설정 방식

현재 코드에서는 `window.location.origin`을 사용하여 현재 도메인을 API 서버로 사용합니다:

```typescript
// VideoPlayer.tsx, useVideoUpload.ts에서
const apiUrl = window.location.origin;
```

## 로컬 테스트를 위한 설정 변경

### 방법 1: 코드 수정 (개발용)

**VideoPlayer.tsx 수정:**
```typescript
// 현재 (라인 143-146)
const getApiUrl = () => {
  // 현재 페이지와 같은 도메인 사용
  return window.location.origin;
};

// 로컬 테스트용으로 변경
const getApiUrl = () => {
  return process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001'  // 로컬 API 서버 주소
    : window.location.origin;
};
```

**useVideoUpload.ts 수정:**
```typescript
// sendUploadToApi 함수에서 (라인 84)
const apiUrl = window.location.origin;

// 로컬 테스트용으로 변경
const apiUrl = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001'  // 로컬 API 서버 주소
  : window.location.origin;
```

### 방법 2: 환경변수 사용 (권장)

**1. .env 파일 생성 (platform/.env):**
```bash
VITE_API_URL=http://localhost:3001
```

**2. 코드에서 환경변수 사용:**
```typescript
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || window.location.origin;
};
```

### 방법 3: 로컬 API 서버 별도 실행

**1. 새로운 터미널에서 Express 서버만 실행:**
```bash
cd platform/server
npm install
npm install -g tsx  # TypeScript 실행기 설치
tsx index.ts        # 서버를 3001 포트에서 실행
```

**2. server/index.ts 수정:**
```typescript
export function createServer() {
  const app = express();
  
  // ... 기존 설정 ...
  
  return app;
}

// 로컬 실행용 추가
if (require.main === module) {
  const app = createServer();
  const PORT = process.env.PORT || 3001;
  
  app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
  });
}
```

## 로컬 테스트 시나리오

### 1. 업로드 테스트
- 비디오 파일 업로드 시 `/api/upload` 호출됨
- 콘솔에서 업로드 정보 확인

### 2. 그리기 테스트  
- 네모박스 그리기 완료 시 `/api/drawing` 호출됨
- 팝업창에서 객체 정보 입력 후 저장

### 3. WebVTT 저장 테스트
- "최종저장" 버튼 클릭 시 `/api/webvtt` 호출됨
- 탐지된 객체들의 WebVTT 파일 생성

## API 응답 예시

### Drawing API Response
```json
{
  "success": true,
  "message": "그리기 데이터가 성공적으로 처리되었습니다.",
  "id": "rect-1704123456789-abc123def",
  "receivedAt": "2024-01-01T12:34:56.789Z",
  "processedData": {
    "type": "rectangle",
    "area": 1500,
    "videoId": "video-1704123456789-xyz789abc"
  }
}
```

### Upload API Response
```json
{
  "success": true,
  "message": "비디오가 성공적으로 업로드되었습니다.",
  "videoId": "video-1704123456789-xyz789abc",
  "uploadedAt": "2024-01-01T12:34:56.789Z",
  "processedData": {
    "fileName": "sample-video.mp4",
    "fileSize": 15728640,
    "duration": 30.5,
    "status": "uploaded"
  }
}
```

### WebVTT API Response
```json
{
  "success": true,
  "message": "WebVTT 파일이 성공적으로 저장되었습니다.",
  "videoId": "video-1704123456789-xyz789abc",
  "fileName": "sample-video.vtt",
  "savedAt": "2024-01-01T12:34:56.789Z",
  "objectCount": 3
}
```

## 트러블슈팅

### CORS 오류 해결
현재 서버에 CORS 설정이 되어 있어야 합니다:
```typescript
app.use(cors()); // 이미 설정됨
```

### 포트 충돌 시
- API 서버 포트를 3001, 3002 등으로 변경
- 클라이언트는 8080 포트 유지

### 네트워크 오류 시
1. API 서버가 실행 중인지 확인
2. 방화벽 설정 확인  
3. 브라우저 개발자 도구에서 네트워크 탭 확인

## 배포 환경 설정

### Fly.dev (현재 환경)
- API와 클라이언트가 같은 도메인에서 실행
- `window.location.origin` 사용으로 자동 설정됨

### 다른 서버 사용 시
- 환경변수나 설정 파일로 API URL 관리
- CORS 설정 필요
- HTTPS 사용 권장

## 요약

**로컬 테스트를 위해서는:**
1. `VideoPlayer.tsx`의 `getApiUrl()` 함수 수정
2. `useVideoUpload.ts`의 `apiUrl` 변수 수정  
3. 로컬 API 서버를 별도 포트(3001)에서 실행

**코드 수정 위치:**
- `platform/client/components/VideoPlayer.tsx` (라인 143-146)
- `platform/client/hooks/useVideoUpload.ts` (라인 84)
