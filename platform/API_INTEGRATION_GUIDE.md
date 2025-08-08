# 🚀 GS1 동영상 객체 탐지 시스템 API 연동 가이드

## 📋 목차
1. [API 서버 연결 설정](#api-서버-연결-설정)
2. [인증 설정](#인증-설정)
3. [API 엔드포인트 목록](#api-엔드포인트-목록)
4. [클라우드 스토리지 연동](#클라우드-스토리지-연동)
5. [데이터베이스 연동](#데이터베이스-연동)
6. [에러 처리 및 로깅](#에러-처리-및-로깅)

## 🌐 API 서버 연결 설정

### 현재 설정 (로컬 개발)
```javascript
// client/hooks/useVideoUpload.ts
const apiUrl = window.location.origin; // 같은 도메인 사용

// client/components/VideoPlayer.tsx  
const getApiUrl = () => window.location.origin;
```

### 외부 API 서버 연결 방법

#### 1. 고정 URL 사용
```javascript
// client/hooks/useVideoUpload.ts
const apiUrl = "https://your-api-server.com";

// client/components/VideoPlayer.tsx
const getApiUrl = () => "https://your-api-server.com";
```

#### 2. 환경변수 사용 (권장)
```javascript
// .env 파일
REACT_APP_API_URL=https://your-api-server.com

// client/hooks/useVideoUpload.ts
const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;

// client/components/VideoPlayer.tsx
const getApiUrl = () => process.env.REACT_APP_API_URL || window.location.origin;
```

## 🔐 인증 설정

### JWT 토큰 기반 인증 추가
```javascript
// 토큰 저장
localStorage.setItem('authToken', 'your-jwt-token');

// API 요청에 인증 헤더 추가
const response = await fetch(`${apiUrl}/api/upload-file`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  },
  body: formData
});
```

### 서버 측 인증 미들웨어 추가
```javascript
// server/index.ts
import { authenticateToken } from './middleware/auth';

// 모든 API에 인증 적용
app.use('/api', authenticateToken);

// 특정 API에만 인증 적용
app.post("/api/upload-file", authenticateToken, uploadMiddleware, handleVideoFileUpload);
```

## 📡 API 엔드포인트 목록

### 🎬 동영상 관리
| 엔드포인트 | 메소드 | 설명 | 요청 데이터 | 응답 데이터 |
|-----------|--------|------|------------|------------|
| `/api/upload-file` | POST | 동영상 업로드 | FormData{video, duration, width, height} | {videoFolder, processedData} |
| `/api/video` | DELETE | 동영상 삭제 | {videoId} | {success, message} |

### 🎨 그리기 및 좌표 관리
| 엔드포인트 | 메소드 | 설명 | 요청 데이터 | 응답 데이터 |
|-----------|--------|------|------------|------------|
| `/api/drawing` | POST | 그리기 데이터 처리 | {videoId, drawingData, videoFolder} | {success, coordinates, message} |
| `/api/drawing/link` | POST | 좌표-객체명 연결 | {videoId, tempId, objectName, videoFolder} | {success, message} |
| `/api/drawing/cancel` | POST | 임시 좌표 취소 | {videoId, tempId, videoFolder} | {success, message} |

### 📝 데이터 저장 및 내보내기
| 엔드포인트 | 메소드 | 설명 | 요청 데이터 | 응답 데이터 |
|-----------|--------|------|------------|------------|
| `/api/webvtt` | POST | WebVTT 파일 생성 | {video, detectedObjects} | {success, message} |
| `/api/save-data` | POST | 편집 데이터 저장 | {videoId, objects, drawings, videoFolder} | {success, message} |

### 🛠️ 유틸리티
| 엔드포인트 | 메소드 | 설명 | 쿼리 파라미터 | 응답 데���터 |
|-----------|--------|------|-------------|------------|
| `/api/check-filename` | GET | 파일명 충돌 체크 | filename | {success, exists, suggestedName} |
| `/api/vtt-coordinates` | GET | VTT 좌표 읽기 | videoId, videoFolder | {success, coordinates} |
| `/api/ping` | GET | 서버 상태 체크 | - | {status, message, timestamp} |

## ☁️ 클라우드 스토리지 연동

### AWS S3 연동
```javascript
// server/routes/upload.ts 수정
import AWS from 'aws-sdk';
import multerS3 from 'multer-s3';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

export const uploadMiddleware = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    key: (req, file, cb) => {
      cb(null, `videos/${Date.now()}-${file.originalname}`);
    }
  })
});
```

### Google Cloud Storage 연동
```javascript
// server/routes/upload.ts 수정
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET);
```

## 🗄️ 데이터베이스 연동

### MongoDB 연동
```javascript
// server/models/Video.js
import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  id: String,
  fileName: String,
  videoFolder: String,
  duration: Number,
  uploadedAt: Date,
  detectedObjects: Array
});

export const Video = mongoose.model('Video', videoSchema);

// server/routes/upload.ts 수정
import { Video } from '../models/Video';

// 파일 업로드 후 데이터베이스에 저장
const newVideo = new Video({
  id: videoId,
  fileName: fileName,
  videoFolder: videoFolder,
  duration: duration,
  uploadedAt: new Date()
});
await newVideo.save();
```

### PostgreSQL 연동
```javascript
// server/database/connection.js
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

export { pool };

// server/routes/upload.ts 수정
import { pool } from '../database/connection';

// 파일 업로드 후 데이터베이스에 저장
const query = `
  INSERT INTO videos (id, file_name, video_folder, duration, uploaded_at)
  VALUES ($1, $2, $3, $4, $5)
`;
await pool.query(query, [videoId, fileName, videoFolder, duration, new Date()]);
```

## ⚠️ 에러 처리 및 로깅

### 클라이언트 에러 처리
```javascript
// client/hooks/useVideoUpload.ts
try {
  const response = await fetch(`${apiUrl}/api/upload-file`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
} catch (error) {
  console.error('Upload error:', error);
  toast.error('업로드 중 오류가 발생했습니다.');
  throw error;
}
```

### 서버 에러 처리 및 로깅
```javascript
// server/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// server/index.ts
import { errorHandler } from './middleware/errorHandler';
app.use(errorHandler);
```

## 🚀 배포 및 프로덕션 설정

### CORS 설정
```javascript
// server/index.ts
app.use(cors({
  origin: [
    'http://localhost:3000',          // 개발 환경
    'https://your-domain.com',        // 프로덕션 환경
    'https://staging.your-domain.com' // 스테이징 환경
  ],
  credentials: true
}));
```

### 환경변수 설정
```bash
# .env.production
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_ENV=production

# server/.env
NODE_ENV=production
PORT=3001
DB_URL=your-database-url
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

## 📚 추가 리소스

### 파일 위치별 수정 가이드
- **클라이언트 API 호출**: `client/hooks/useVideoUpload.ts`, `client/components/VideoPlayer.tsx`
- **서버 라우터**: `server/routes/` 폴더의 각 파일들
- **데이터 구조**: `shared/types.ts`
- **서버 설정**: `server/index.ts`
- **파일 유틸리티**: `server/utils/file-utils.ts`

### 테스트 방법
1. API 엔드포인트 테스트: Postman, curl 사용
2. 파일 업로드 테스트: 실제 비디오 파일로 테스트
3. 에러 케이스 테스트: 잘못된 파일, 큰 파일, 네트워크 오류 등

### 성능 최적화
- 파일 압축: multer에서 파일 압축 미들웨어 추가
- 캐싱: Redis 또는 메모리 캐시 사용
- CDN: 정적 파일 배포에 CDN 사용
- 로드 밸런싱: 여러 서버 인스턴스 운영
