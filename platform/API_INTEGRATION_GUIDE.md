# GS1 동영상 객체 탐지 시스템 - API 연동 가이드

## 📋 목차
1. [현재 API 엔드포인트](#현재-api-엔드포인트)
2. [API 전송 위치 및 데이터 구조](#api-전송-위치-및-데이터-구조)
3. [사용자 API 서버로 리다이렉트 방법](#사용자-api-서버로-리다이렉트-방법)
4. [API 응답 형식](#api-응답-형식)
5. [구현 예시](#구현-예시)

---

## 🌐 현재 API 엔드포인트

현재 시스템은 다음 API들을 통해 데이터를 처리합니다:

### 1. 그리기 데이터 API
- **URL**: `POST /api/drawing`
- **목적**: 사용자가 영상에 그린 영역 데이터 처리
- **호출 시점**: 사용자가 영역 그리기 완료 시 (네모박스, 클릭, 자유그리기)

### 2. WebVTT 파일 생성 API
- **URL**: `POST /api/webvtt`
- **목적**: 탐지된 객체 정보를 WebVTT 자막 파일로 저장
- **호출 시점**: "최종저장" 버튼 클릭 시

### 3. 편집 데이터 저장 API
- **URL**: `POST /api/save-data`
- **목적**: 편집된 객체 정보를 JSON 형태로 저장
- **호출 시점**: "최종저장" 버튼 클릭 시

### 4. 동영상 업로드 API
- **URL**: `POST /api/upload-file`
- **목적**: 동영상 파일 업로드 및 메타데이터 저장

### 5. 동영상 삭제 API
- **URL**: `DELETE /api/video`
- **목적**: 동영상 및 관련 데이터 삭제

---

## 📡 API 전송 위치 및 데이터 구조

### 현재 API 전송 방식
현재 모든 API는 다음과 같이 동일 도메인으로 전송됩니다:

```javascript
// 현재 구현 방식
const getApiUrl = () => {
  return window.location.origin;  // 현재 페이지와 같은 도메인 사용
};

const response = await fetch(`${getApiUrl()}/api/drawing`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(drawingData)
});
```

### 그리기 데이터 구조
```typescript
interface DrawingData {
  id: string;                           // 그리기 영역 고유 ID
  type: "path" | "rectangle" | "click"; // 그리기 타입
  color: string;                        // 색상
  points: Array<{ x: number; y: number }>; // 좌표점들
  startPoint?: { x: number; y: number }; // 사각형 시작점
  endPoint?: { x: number; y: number };   // 사각형 끝점
  clickPoint?: { x: number; y: number }; // 클릭 좌표
  videoId?: string;                     // 연관된 동영상 ID
  videoCurrentTime?: number;            // 그려진 시점의 동영상 시간
  timestamp: number;                    // 생성 타임스탬프
}
```

### WebVTT 데이터 구조
```typescript
interface WebVTTData {
  videoId: string;
  videoFileName: string;
  objects: Array<{
    id: string;
    name: string;
    code?: string;
    additionalInfo?: string;
    dlReservoirDomain?: string;
    category?: string;
    confidence?: number;
    videoCurrentTime?: number;
    coordinates?: {  // 그리기 좌표 (VTT에만 저장)
      type: "path" | "rectangle" | "click";
      points?: Array<{ x: number; y: number }>;
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      clickPoint?: { x: number; y: number };
    };
  }>;
  duration: number;
  timestamp: number;
}
```

---

## 🔄 사용자 API 서버로 리다이렉트 방법

### 방법 1: API URL 설정 변경 (권장)

각 컴��넌트에서 API URL을 사용자 서버로 변경:

#### 1-1. VideoPlayer.tsx 수정
```javascript
// 파일: platform/client/components/VideoPlayer.tsx
// 라인 161-164 수정

const getApiUrl = () => {
  // 현재: return window.location.origin;
  // 변경 후:
  return 'https://your-api-server.com';  // 사용자의 API 서버 URL
};
```

#### 1-2. useVideoUpload.ts 수정
```javascript
// 파일: platform/client/hooks/useVideoUpload.ts
// API 호출 부분에서 baseURL 변경

const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('video', file);
  
  // 현재: const response = await fetch('/api/upload-file', ...);
  // 변경 후:
  const response = await fetch('https://your-api-server.com/api/upload-file', {
    method: 'POST',
    body: formData
  });
};
```

### 방법 2: 환경변수 사용 (추천)

#### 2-1. 환경변수 설정
```javascript
// .env 파일 생성
VITE_API_BASE_URL=https://your-api-server.com

// 또는 DevServerControl 도구 사용
```

#### 2-2. 공통 API 함수 생성
```javascript
// 파일: platform/client/lib/api.ts (새로 생성)
export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || window.location.origin;
};

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getApiBaseUrl()}${endpoint}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
};
```

#### 2-3. 컴포넌트에서 사용
```javascript
// VideoPlayer.tsx 수정
import { apiCall } from '@/lib/api';

const sendDrawingToApi = async (area: DrawnArea) => {
  const response = await apiCall('/api/drawing', {
    method: 'POST',
    body: JSON.stringify(drawingData)
  });
};
```

### 방법 3: 프록시 서버 설정

사용자 서버에서 현재 API를 프록시로 받아 처리:

```javascript
// 사용자 서버 (Node.js/Express 예시)
app.post('/api/drawing', (req, res) => {
  const drawingData = req.body;
  
  // 사용자 로직 처리
  console.log('그리기 데이터 수신:', drawingData);
  
  // 필요시 데이터 가공
  const processedData = processDrawingData(drawingData);
  
  // 응답 반환 (원래 형식과 동일하게)
  res.json({
    success: true,
    message: '그리기 데이터가 성공적으로 처리되었습니다.',
    drawingId: drawingData.id,
    processedAt: new Date().toISOString()
  });
});
```

---

## 📋 API 응답 형식

사용자 API 서버는 다음 형식으로 응답해야 합니다:

### 그리기 API 응답
```json
{
  "success": true,
  "message": "그리기 데이터가 성공적으로 처리되었습니다.",
  "drawingId": "rect-1234567890-abc123",
  "processedAt": "2024-01-01T12:00:00.000Z",
  "details": {
    "type": "rectangle",
    "videoId": "video-123",
    "videoTime": 10.5,
    "pointsProcessed": 4
  }
}
```

### WebVTT API 응답
```json
{
  "success": true,
  "message": "WebVTT 파일이 성공적으로 처리되었습니다.",
  "videoId": "video-123",
  "fileName": "example-webvtt.vtt",
  "savedAt": "2024-01-01T12:00:00.000Z",
  "objectCount": 5
}
```

### 에러 응답
```json
{
  "success": false,
  "message": "처리 중 오류가 발생했습니다.",
  "error": "상세 에러 메시지"
}
```

---

## 💡 구현 예시

### 완전한 API 리다이렉트 구현

#### 1. 설정 파일 생성
```javascript
// platform/client/config/api.ts
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || window.location.origin,
  ENDPOINTS: {
    DRAWING: '/api/drawing',
    WEBVTT: '/api/webvtt',
    SAVE_DATA: '/api/save-data',
    UPLOAD: '/api/upload-file',
    DELETE_VIDEO: '/api/video'
  }
};
```

#### 2. API 클라이언트 생성
```javascript
// platform/client/lib/apiClient.ts
import { API_CONFIG } from '@/config/api';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  async post(endpoint: string, data: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  async delete(endpoint: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    
    return response.json();
  }
}

export const apiClient = new ApiClient();
```

#### 3. 컴포넌트에서 사용
```javascript
// VideoPlayer.tsx에서 사용
import { apiClient } from '@/lib/apiClient';
import { API_CONFIG } from '@/config/api';

const sendDrawingToApi = async (area: DrawnArea) => {
  try {
    const result = await apiClient.post(API_CONFIG.ENDPOINTS.DRAWING, drawingData);
    console.log('API 응답:', result);
  } catch (error) {
    console.error('API 오류:', error);
  }
};
```

---

## 🛠️ 수정해야 할 파일 목록

### 프론트엔드 파일들
1. **`platform/client/components/VideoPlayer.tsx`**
   - `getApiUrl()` 함수 수정 (라인 161-164)
   - `sendDrawingToApi()` 함수의 API 호출 URL
   - `sendWebVTTToApi()` 함수의 API 호출 URL

2. **`platform/client/hooks/useVideoUpload.ts`**
   - 업로드 API 호출 URL
   - 삭제 API 호출 URL

3. **환경변수 설정**
   - `.env` 파일에 `VITE_API_BASE_URL` 추가
   - 또는 DevServerControl 도구에서 환경변수 설정

### 백엔드 API 서버 (사용자 서버)
사용자는 위에서 설명한 API 엔드포인트들을 자신의 서버에 구현해야 합니다:

- `POST /api/drawing` - 그리기 데이터 처리
- `POST /api/webvtt` - WebVTT 파일 생성
- `POST /api/save-data` - 편집 데이터 저장
- `POST /api/upload-file` - 동영상 업로드
- `DELETE /api/video` - 동영상 삭제

---

## 📞 지원

API 연동 관련 문의나 문제가 있으시면:
1. 이 문서의 예시 코드를 참고하여 구현
2. API 응답 형식을 정확히 맞춰 구현
3. CORS 설정 확인 (사용자 서버에서 프론트엔드 도메인 허용)

> **참고**: 현재 좌표 정보는 VTT 파일의 NOTE 섹션에 JSON 형태로 저장되며, 화면에는 표시되지 않습니다.
