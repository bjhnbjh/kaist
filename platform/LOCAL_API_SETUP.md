# 로컬 API 테스트 완전 설정 가이드

## 구현된 기능들

### ✅ 완료된 API 엔드포인트들
1. **POST /api/upload** - 동영상 업로드 정보를 `data/uploads.json`에 저장
2. **POST /api/drawing** - 그리기 데이터를 서버에 전송 후 팝업창 표시
3. **POST /api/webvtt** - WebVTT 파일을 `data/webvtt/` 폴더에 저장 + 인덱스 관리
4. **POST /api/save-data** - 최종 편집 데이터를 `data/saved-data.json`에 저장

### ✅ 로컬 파일 저장 기능
- `data/uploads.json` - 업로드된 비디오 정보
- `data/webvtt/` - 개별 WebVTT 파일들
- `data/webvtt-index.json` - WebVTT 파일 인덱스
- `data/saved-data.json` - 최종 편집 프로젝트 데이터

## 로컬 테스트를 위한 API URL 변경

### 🔧 변경해야 할 파일 위치

#### 1. VideoPlayer.tsx (그리기 API + WebVTT + DB 저장)
**위치**: `platform/client/components/VideoPlayer.tsx`
**라인**: 143-146번

```typescript
// 현재 코드
const getApiUrl = () => {
  // 현재 페이지와 같은 도메인 사용
  return window.location.origin;
};

// 로컬 테스트용으로 변경
const getApiUrl = () => {
  return 'http://localhost:3001'; // 로컬 API 서버 주소
};
```

**라인**: 575, 620번 (sendWebVTTToApi, saveDataToDb 함수 내)

```typescript
// 현재 코드 (2곳)
const apiUrl = window.location.origin;

// 로컬 테스트용으로 변경 (2곳 모두)
const apiUrl = 'http://localhost:3001';
```

#### 2. useVideoUpload.ts (업로드 API)
**위치**: `platform/client/hooks/useVideoUpload.ts`
**라인**: 84번

```typescript
// 현재 코드
const apiUrl = window.location.origin;

// 로컬 테스트용으로 변경
const apiUrl = 'http://localhost:3001';
```

## 로컬 API 서버 실행 방법

### 방법 1: 통합 서버 (권장)
현재 프로젝트에서 개발 서버를 그대로 사용하되, 포트만 변경:

```bash
cd platform
npm run dev
```

### 방법 2: 별도 API 서버 실행
API 서버만 따로 실행하려면:

1. **server/index.ts 수정**:
```typescript
// 파일 끝에 추가
if (require.main === module) {
  const app = createServer();
  const PORT = 3001;
  
  app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📁 Data files will be saved to: ${process.cwd()}/data/`);
  });
}
```

2. **별도 터미널에서 실행**:
```bash
cd platform
npx tsx server/index.ts
```

## 테스트 시나리오

### 1. 업로드 테스트 ✅
- 비디오 파일 업로드
- `data/uploads.json` 파일 생성 및 데이터 저장 확인

### 2. 그리기 테스트 ✅  
- 네모박스 그리기 완료
- API 호출 후 팝업창 표시
- 객체 정보 입력 후 저장

### 3. WebVTT 저장 테스트 ✅
- "최종저장" 버튼 클릭
- `data/webvtt/` 폴더에 .vtt 파일 생성
- `data/webvtt-index.json`에 인덱스 정보 추가

### 4. DB 저장 테스트 ✅
- "최종저장" 버튼 클릭  
- `data/saved-data.json`에 편집 데이터 저장
- 버전 관리 (같은 비디오 재저장 시 버전 증가)

## 생성되는 파일 구조

```
platform/
├── data/                       # 로컬 데이터 저장소
│   ├── uploads.json           # 업로드된 비디오 정보
│   ├── saved-data.json        # 최종 편집 프로젝트 데이터
│   ├── webvtt-index.json      # WebVTT 파일 인덱��
│   └── webvtt/                # WebVTT 파일들
│       ├── video-123_1234567890.vtt
│       └── video-456_1234567891.vtt
```

## 파일 예시

### uploads.json
```json
{
  "uploads": [
    {
      "id": "video-1704123456789-abc123",
      "fileName": "sample.mp4",
      "fileSize": 15728640,
      "fileType": "video/mp4",
      "duration": 30.5,
      "timestamp": 1704123456789,
      "uploadedAt": "2024-01-01T12:34:56.789Z",
      "status": "uploaded"
    }
  ],
  "lastUpdated": "2024-01-01T12:34:56.789Z"
}
```

### webvtt-index.json
```json
{
  "files": [
    {
      "videoId": "video-1704123456789-abc123",
      "videoFileName": "sample.mp4",
      "vttFileName": "video-1704123456789-abc123_1704123456789.vtt",
      "filePath": "/path/to/data/webvtt/video-1704123456789-abc123_1704123456789.vtt",
      "objectCount": 2,
      "duration": 30.5,
      "createdAt": "2024-01-01T12:34:56.789Z",
      "objects": [...]
    }
  ],
  "lastUpdated": "2024-01-01T12:34:56.789Z"
}
```

### saved-data.json
```json
{
  "savedProjects": [
    {
      "videoId": "video-1704123456789-abc123",
      "videoFileName": "sample.mp4",
      "objects": [...],
      "drawings": [...],
      "duration": 30.5,
      "totalFrames": 915,
      "timestamp": 1704123456789,
      "savedAt": "2024-01-01T12:34:56.789Z",
      "version": 1
    }
  ],
  "lastUpdated": "2024-01-01T12:34:56.789Z"
}
```

## 중요 변경사항

### ✅ 목업 데이터 제거
- 기존 Object(1-5) 목업 데이터 완전 제거
- 이제 그리기로만 객체 추가 가능
- 그리기 객체는 Object(1)부터 순차적으로 시작

### ✅ 실시간 반영
- 그리기 완료 시 즉시 API 호출
- WebVTT 파일 실시간 업데이트
- 객체 추가/수정 시 바로 파일에 반영

### ✅ 파일 자동 생성
- 필요한 디렉토리와 파일이 없으면 자동 생성
- 초기 데이터 구조 자동 설정

## 트러블슈팅

### CORS 오류
현재 서버에 `app.use(cors())` 설정이 되어 있어 해결됨

### 파일 권한 오류
```bash
# data 폴더 권한 확인
ls -la platform/data/

# 권한 문제 시
chmod 755 platform/data/
```

### 포트 충돌
- API 서버: 3001 포트 사용
- 개발 서버: 8080 포트 유지
- 필요시 다른 포트로 변경 가능

## 요약

**로컬 테스트 하려면 이 3곳만 수정:**

1. `platform/client/components/VideoPlayer.tsx` 라인 143-146
2. `platform/client/components/VideoPlayer.tsx` 라인 575, 620 (2곳)  
3. `platform/client/hooks/useVideoUpload.ts` 라인 84

**모두 다음과 같이 변경:**
```typescript
// 기존
const apiUrl = window.location.origin;

// 로컬용
const apiUrl = 'http://localhost:3001';
```

그 후 `npm run dev`로 서버를 실행하면 모든 데이터가 `platform/data/` 폴더에 저장됩니다!
