# 🚀 GS1 동영상 객체 탐지 시스템 - API 통합 가이드

## 📋 목차
1. [API 개요](#api-개요)
2. [서버 API 목록](#서버-api-목록)
3. [클라이언트 API 호출 위치](#클라이언트-api-호출-위치)
4. [API 수정 방법](#api-수정-방법)
5. [데이터 흐름](#데이터-흐름)
6. [최적화 포인트](#최적화-포인트)

## 📡 API 개요

### 기본 구조
- **백엔드**: Express.js + TypeScript
- **프론트엔드**: React + TypeScript
- **데이터 저장**: JSON 파일 (파일 시스템)
- **API 통신**: RESTful API + JSON

### 서버 구조
```
server/
├── index.ts              # 메인 서버 파일 (라우팅 설정)
├── routes/
│   ├── upload.ts         # 동영상 업로드/삭제 API
│   ├── webvtt.ts         # WebVTT 자막 파일 생성 API
│   ├── save-data.ts      # 편집 데이터 저장 API
│   └── drawing.ts        # 그리기 데이터 처리 API
```

## 🌐 서버 API 목록

### 1. 동영상 파일 업로드
```http
POST /api/upload-file
Content-Type: multipart/form-data

Body:
- video: File (동영상 파일)
- duration: number (동영상 길이)
- width?: number (가로 해상도)
- height?: number (세로 해상도)
```

**수정 위치**: `server/routes/upload.ts` → `handleVideoFileUpload`

### 2. 동영상 삭제
```http
DELETE /api/video
Content-Type: application/json

Body:
{
  "videoId": "string",
  "videoFileName": "string"
}
```

**수정 위치**: `server/routes/upload.ts` → `handleVideoDelete`

### 3. 그리기 데이터 처리
```http
POST /api/drawing
Content-Type: application/json

Body:
{
  "id": "string",
  "type": "path" | "rectangle",
  "color": "string",
  "points": [{"x": number, "y": number}],
  "videoId": "string",
  "videoCurrentTime": number,
  "timestamp": number
}
```

**수정 위치**: `server/routes/drawing.ts` → `handleDrawingSubmission`

### 4. WebVTT 자막 파일 생성
```http
POST /api/webvtt
Content-Type: application/json

Body:
{
  "videoId": "string",
  "videoFileName": "string",
  "objects": [{
    "id": "string",
    "name": "string",
    "code": "string",
    "category": "string",
    "videoCurrentTime": number
  }],
  "duration": number,
  "timestamp": number
}
```

**수정 위치**: `server/routes/webvtt.ts` → `handleWebVTTSave`

### 5. 편집 데이터 저장
```http
POST /api/save-data
Content-Type: application/json

Body:
{
  "videoId": "string",
  "videoFileName": "string",
  "objects": [...],
  "drawings": [...],
  "duration": number,
  "totalFrames": number,
  "timestamp": number
}
```

**수정 위치**: `server/routes/save-data.ts` → `handleSaveData`

## 📱 클라이언트 API 호출 위치

### 1. 메인 업로드 로직
**파일**: `client/hooks/useVideoUpload.ts`

```typescript
// 동영상 파일 업로드
const uploadVideoFile = useCallback(async (file: File, uploadId: string, metadata) => {
  const response = await fetch(`${apiUrl}/api/upload-file`, {
    method: 'POST',
    body: formData
  });
});

// 동영상 삭제
const deleteVideo = useCallback(async (videoId: string) => {
  const response = await fetch(`${apiUrl}/api/video`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, videoFileName })
  });
});
```

**🔧 수정 포인트**:
- API URL 변경: `window.location.origin` 부분 수정
- 요청/응답 데이터 구조 변경: `fetch` 호출의 body나 응답 처리 부분 수정

### 2. 동영상 플레이어 관련 API
**파일**: `client/components/VideoPlayer.tsx`

```typescript
// 그리기 데이터 전송
const sendDrawingToApi = async (area: DrawnArea) => {
  const response = await fetch(`${apiUrl}/api/drawing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(drawingData)
  });
};

// WebVTT 파일 저장
const sendWebVTTToApi = async () => {
  const response = await fetch(`${apiUrl}/api/webvtt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webvttData)
  });
};

// 편집 데이터 저장
const saveDataToDb = async () => {
  const response = await fetch(`${apiUrl}/api/save-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saveData)
  });
};
```

**🔧 수정 포인트**:
- API 엔드포인트 변경: URL 부분 수정
- 데이터 구조 변경: `body`에 포함되는 데이터 객체 구조 수정
- 에러 처리 개선: `catch` 블록이나 응답 검증 로직 수정

## 🔧 API 수정 방법

### 새로운 API 추가하기

1. **서버 사이드**:
```typescript
// 1. server/routes/new-api.ts 파일 ��성
export const handleNewApi: RequestHandler = (req, res) => {
  // API 로직 구현
};

// 2. server/index.ts에 라우트 추가
import { handleNewApi } from "./routes/new-api";
app.post("/api/new-endpoint", handleNewApi);
```

2. **클라이언트 사이드**:
```typescript
// API 호출 함수 추가 (적절한 파일에)
const callNewApi = async (data: any) => {
  const response = await fetch(`${apiUrl}/api/new-endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

### 기존 API 수정하기

1. **요청 데이터 구조 변경**:
   - 서버: 해당 `routes/*.ts` 파일의 인터페이스와 핸들러 수정
   - 클라이언트: API 호출 부분의 `body` 데이터 구조 수정

2. **응답 데이터 구조 변경**:
   - 서버: 핸들러 함수의 `response` 객체 수정
   - 클라이언트: 응답 처리 로직 수정

3. **API URL 변경**:
   - 서버: `server/index.ts`의 라우트 경로 수정
   - 클라이언트: 모든 `fetch` 호출의 URL 수정

## 📊 데이터 흐름

### 1. 동영상 업로드 플로우
```
사용자 파일 선택 
→ useVideoUpload.handleFileSelect() 
→ simulateUpload() 
→ uploadVideoFile() 
→ POST /api/upload-file 
→ 서버에 파일 저장 + 메타데이터 저장
→ 클라이언트 상태 업데이트
```

### 2. 객체 그리기 플로우
```
사용자 그리기 
→ VideoPlayer 마우스 이벤트 
→ sendDrawingToApi() 
→ POST /api/drawing 
→ 서버에서 로깅 
→ 클라이언트에서 객체 추가 모달 표시
→ 사용자 정보 입력 
→ addNewObjectToVideo() 
→ 로컬 상태 업데이트
```

### 3. 최종 저장 플로우
```
"최종저장" 버튼 클릭 
→ saveDataToDb() 
→ POST /api/save-data 
→ sendWebVTTToApi() 
→ POST /api/webvtt 
→ 서버에 JSON + VTT 파일 저장 
→ 클라이언트 상태 초기화
```

## ⚡ 최적화 포인트

### 1. 불필요한 코드 제거됨
- ❌ `server/routes/demo.ts` (데모 API 제거)
- ❌ `handleVideoUpload` (메타데이터만 받는 구버전 API, 호환성 유지)
- ❌ 복잡한 VTT 병합 로직 단순화

### 2. 개선된 부분
- ✅ 모든 API에 상세한 주석 추가
- ✅ 에러 처리 개선
- ✅ 한글 파일명 처리 최적화
- ✅ 시간 중복 방지 로직 개선
- ✅ 파일 저장 구조 최적화

### 3. 성능 개선 제안
- 📈 큰 파일 업로드 시 청크 업로드 구현
- 📈 WebVTT 생성 시 스트리밍 방식 적용
- 📈 API 응답 캐싱 구현
- 📈 파일 압축 및 최적화

## 🔄 외부 API 연동 방법

현재는 로컬 파일 시스템을 사용하지만, 외부 API로 변경하려면:

### 1. 클라우드 저장소 연동
```typescript
// AWS S3, Google Cloud Storage 등
const uploadToCloud = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('https://your-cloud-api.com/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: formData
  });
};
```

### 2. 외부 AI API 연동
```typescript
// 객체 탐지 AI API
const detectObjects = async (videoFile: File) => {
  const response = await fetch('https://ai-api.example.com/detect', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer AI_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoUrl: 'uploaded-video-url',
      options: { threshold: 0.8 }
    })
  });
};
```

### 3. 데이터베이스 연동
```typescript
// MongoDB, PostgreSQL 등
const saveToDatabase = async (data: any) => {
  const response = await fetch('https://your-db-api.com/save', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer DB_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};
```

---

## 📞 문의 사항

API 수정이나 추가 기능 구현에 대한 질문이 있으시면 각 ���일의 주석을 참고하시거나, 이 가이드를 기반으로 개발을 진행하시면 됩니다.

모든 API는 현재 `window.location.origin`을 기반으로 동작하므로, 다른 도메인을 사용하려면 클라이언트의 API 호출 부분에서 `baseURL`을 수정하시면 됩니다.
