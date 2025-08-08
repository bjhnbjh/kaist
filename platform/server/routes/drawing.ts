import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { normalizeFileName, findActualVideoFolder, getKoreaTimeISO, DATA_DIR } from "../utils/file-utils";

/**
 * ===================================
 * 🎨 그리기 데이터 처리 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 사용자가 동영상에 그린 영역 데이터 수신
 * 2. 그리기 데이터 로깅 및 검증
 * 3. 간단한 응답 반환 (실제 처리는 클라��언트에서)
 * 
 * 📝 API 수정 가이드:
 * - 그리기 데이터 저장: 여기에 파일 저장 로직 추가
 * - 데이터 검증 강화: drawingData 검증 로직 추가
 * - 응답 구조 변경: response 객체 수정
 */

// ========================================
// 📊 타입 정의
// ========================================

/**
 * 그리기 데이터 인터페이스
 * 
 * 📝 수정 포인트:
 * - 새로운 그리기 속성 추가: 이 인터페이스에 필드 추가
 * - 좌표 시스템 변경: points 배열 구조 수정
 */
interface DrawingData {
  id: string;                           // 그리기 영역 고유 ID
  type: "path" | "rectangle" | "click"; // 그리기 타입 (클릭 추가)
  color: string;                        // 색상
  points: Array<{ x: number; y: number }>; // 좌표점들
  startPoint?: { x: number; y: number }; // 사각형 시작점
  endPoint?: { x: number; y: number };   // 사각형 끝점
  clickPoint?: { x: number; y: number }; // 클릭 포인트 좌표
  videoId?: string;                     // 연관된 동영상 ID
  videoCurrentTime?: number;            // 그려진 시점의 동영상 시간
  timestamp: number;                    // 생성 타임스탬프
}

// ========================================
// 🗂️ 파일 시스템 ���정
// ========================================

// DATA_DIR은 공통 유틸리티에서 가져옴

// 공통 유틸리티에서 가져옴: normalizeFileName, findActualVideoFolder

/**
 * 그리기 좌표를 파일에 저장하는 함수
 */
function saveCoordinatesToFile(drawingData: DrawingData): void {
  try {
    // 실제 업로드된 비디오 폴더 찾기
    const videoFolderName = findActualVideoFolder(drawingData.videoId!);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 폴더가 없으면 생성
    if (!fs.existsSync(videoFolderPath)) {
      fs.mkdirSync(videoFolderPath, { recursive: true });
    }

    // 좌표 파일명 생성 (파일이름-좌표.json)
    const coordinateFileName = `${videoFolderName}-좌표.json`;
    const coordinateFilePath = path.join(videoFolderPath, coordinateFileName);

    // 기존 좌표 파일이 있으면 읽어오기
    let existingData: any[] = [];
    if (fs.existsSync(coordinateFilePath)) {
      try {
        const fileContent = fs.readFileSync(coordinateFilePath, 'utf8');
        existingData = JSON.parse(fileContent);
      } catch (e) {
        console.warn('기존 좌표 파일 읽기 실패, 새로 생성합니다');
        existingData = [];
      }
    }

    // 현재 시간을 MM:SS 형식으로 변환
    const currentTime = drawingData.videoCurrentTime || 0;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 새로운 객체 데이터 생성
    const objectIndex = existingData.length + 1;
    const newObjectData = {
      [`object${objectIndex}`]: {
        "이름": timeString,
        "position": {
          type: drawingData.type,
          points: drawingData.points || [],
          startPoint: drawingData.startPoint || null,
          endPoint: drawingData.endPoint || null,
          clickPoint: drawingData.clickPoint || null,
          videoCurrentTime: currentTime
        },
        "polygon": null,
        "drawingId": drawingData.id  // 나중에 객체와 연결하기 위해 저장
      }
    };

    // 기존 데이터에 추가
    existingData.push(newObjectData);

    // 좌표 파일 저장
    fs.writeFileSync(coordinateFilePath, JSON.stringify(existingData, null, 2), { encoding: 'utf8' });

    console.log(`📍 Coordinate data saved: ${coordinateFilePath}`);
  } catch (error) {
    console.error('❌ Failed to save position:', error);
  }
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * 그리기 데이터 처리 핸들러
 * 
 * 📝 수정 포인트:
 * - 데이터 저장: 파일이나 DB에 저장하려면 여기에 로직 추가
 * - 추가 처리: 그리기 영역 분석이나 변환 로직 여기에 추가
 * - 검증 강화: drawingData 로직 검증 로직 추가
 * 
 * @route POST /api/drawing
 * @param {Request} req - Express 요청 객체 (DrawingData 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleDrawingSubmission: RequestHandler = (req, res) => {
  try {
    const drawingData: DrawingData = req.body;

    // 📋 요청 데이터 로깅
    console.log('🎨 Drawing data received:', {
      id: drawingData.id,
      type: drawingData.type,
      videoId: drawingData.videoId,
      videoCurrentTime: drawingData.videoCurrentTime,
      pointsCount: drawingData.points?.length || 0,
      timestamp: drawingData.timestamp
    });

    // ✅ 기본 검증
    if (!drawingData.id || !drawingData.type) {
      return res.status(400).json({
        success: false,
        message: 'id와 type은 필수 항목입니다.'
      });
    }

    // 📝 그리기 데이터를 파일에 저장
    if (drawingData.videoId) {
      saveCoordinatesToFile(drawingData);
    }

    // 🎉 성공 응답
    const response = {
      success: true,
      message: '그리기 데이터가 성공적으로 처리되었습니다.',
      drawingId: drawingData.id,
      processedAt: new Date().toISOString(),
      details: {
        type: drawingData.type,
        videoId: drawingData.videoId,
        videoTime: drawingData.videoCurrentTime,
        pointsProcessed: drawingData.points?.length || 0
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Drawing submission error:', error);
    res.status(500).json({
      success: false,
      message: '그리기 데이터 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 임시 좌표를 객체명과 연결하는 API 핸들러
 */
export const handleCoordinateLinking: RequestHandler = (req, res) => {
  try {
    const { videoId, drawingId, objectName } = req.body;

    if (!videoId || !drawingId || !objectName) {
      return res.status(400).json({
        success: false,
        message: 'videoId, drawingId, objectName은 필수 항목입니다.'
      });
    }

    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 좌표 파일 경로
    const coordinateFileName = `${videoFolderName}-좌표.json`;
    const coordinateFilePath = path.join(videoFolderPath, coordinateFileName);

    // 좌표 파일 확인
    if (!fs.existsSync(coordinateFilePath)) {
      return res.status(404).json({
        success: false,
        message: '좌표 파일을 찾을 수 없습니다.'
      });
    }

    // 좌표 파일 읽기
    const coordinateData = JSON.parse(fs.readFileSync(coordinateFilePath, 'utf8'));

    // drawingId가 일치하는 객체 찾아서 이름 업데이트
    let updated = false;
    coordinateData.forEach((objectData: any) => {
      Object.keys(objectData).forEach(objectKey => {
        if (objectData[objectKey].drawingId === drawingId) {
          objectData[objectKey]["이름"] = objectName;
          updated = true;
        }
      });
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: '해당 drawingId를 찾을 수 없습니다.'
      });
    }

    // 좌표 파일 업데이트
    fs.writeFileSync(coordinateFilePath, JSON.stringify(coordinateData, null, 2), { encoding: 'utf8' });

    console.log(`🔗 Coordinate updated: ${drawingId} -> ${objectName}`);

    res.json({
      success: true,
      message: '좌표가 객체명과 성공적으로 연결되었습니다.',
      drawingId,
      objectName,
      coordinateFile: coordinateFileName
    });

  } catch (error) {
    console.error('❌ Coordinate linking error:', error);
    res.status(500).json({
      success: false,
      message: '좌표 연결 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 임시 좌표 파일 삭제 (취소 시 사용)
 */
export const handleCoordinateCancellation: RequestHandler = (req, res) => {
  try {
    const { videoId, drawingId } = req.body;

    if (!videoId || !drawingId) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 drawingId는 필수 항목입니다.'
      });
    }

    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 좌표 파일 경로
    const coordinateFileName = `${videoFolderName}-좌표.json`;
    const coordinateFilePath = path.join(videoFolderPath, coordinateFileName);

    // 좌표 파일이 존재하면 해당 drawingId 삭제
    if (fs.existsSync(coordinateFilePath)) {
      const coordinateData = JSON.parse(fs.readFileSync(coordinateFilePath, 'utf8'));

      // drawingId가 일치하는 객체 제거
      const filteredData = coordinateData.filter((objectData: any) => {
        return !Object.values(objectData).some((obj: any) => obj.drawingId === drawingId);
      });

      // 파일 업데이트
      fs.writeFileSync(coordinateFilePath, JSON.stringify(filteredData, null, 2), { encoding: 'utf8' });
      console.log(`🗑️ Coordinate data deleted: ${drawingId}`);
    }

    res.json({
      success: true,
      message: '좌표가 삭제되었습니다.',
      drawingId
    });

  } catch (error) {
    console.error('❌ Coordinate cancellation error:', error);
    res.status(500).json({
      success: false,
      message: '좌표 삭제 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 좌표 파일에서 객체 이름 업데이트
 */
export const handleCoordinateUpdate: RequestHandler = (req, res) => {
  try {
    const { videoId, oldName, newName } = req.body;

    if (!videoId || !oldName || !newName) {
      return res.status(400).json({
        success: false,
        message: 'videoId, oldName, newName은 필수 항목입니다.'
      });
    }

    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);
    const coordinateFileName = `${videoFolderName}-좌표.json`;
    const coordinateFilePath = path.join(videoFolderPath, coordinateFileName);

    if (!fs.existsSync(coordinateFilePath)) {
      return res.status(404).json({
        success: false,
        message: '좌표 파일을 찾을 수 없습니다.'
      });
    }

    const coordinateData = JSON.parse(fs.readFileSync(coordinateFilePath, 'utf8'));

    // 이전 이름으로 된 객체 찾아서 새 이름으로 업데이트
    let updated = false;
    coordinateData.forEach((objectData: any) => {
      Object.keys(objectData).forEach(objectKey => {
        if (objectData[objectKey]["이름"] === oldName) {
          objectData[objectKey]["이름"] = newName;
          updated = true;
        }
      });
    });

    if (updated) {
      fs.writeFileSync(coordinateFilePath, JSON.stringify(coordinateData, null, 2), { encoding: 'utf8' });
      console.log(`🔄 Coordinate name updated: ${oldName} -> ${newName}`);
    }

    res.json({
      success: true,
      message: '좌표 파일이 업데이트되었습니다.',
      updated
    });

  } catch (error) {
    console.error('❌ Coordinate update error:', error);
    res.status(500).json({
      success: false,
      message: '좌표 업데이트 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 좌표 파일에서 객체 삭제
 */
export const handleCoordinateDelete: RequestHandler = (req, res) => {
  try {
    const { videoId, objectName } = req.body;

    if (!videoId || !objectName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 objectName은 필수 항목입니다.'
      });
    }

    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);
    const coordinateFileName = `${videoFolderName}-좌표.json`;
    const coordinateFilePath = path.join(videoFolderPath, coordinateFileName);

    if (!fs.existsSync(coordinateFilePath)) {
      return res.status(404).json({
        success: false,
        message: '좌표 파일을 찾을 수 없습니다.'
      });
    }

    const coordinateData = JSON.parse(fs.readFileSync(coordinateFilePath, 'utf8'));

    // 해당 이름의 객체 제거
    const filteredData = coordinateData.filter((objectData: any) => {
      return !Object.values(objectData).some((obj: any) => obj["이름"] === objectName);
    });

    fs.writeFileSync(coordinateFilePath, JSON.stringify(filteredData, null, 2), { encoding: 'utf8' });
    console.log(`🗑️ Coordinate deleted: ${objectName}`);

    res.json({
      success: true,
      message: '좌표가 삭제되었습니다.',
      objectName
    });

  } catch (error) {
    console.error('❌ Coordinate deletion error:', error);
    res.status(500).json({
      success: false,
      message: '좌표 삭제 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * ===================================
 * 📝 Drawing API 사용법 및 수정 가이드
 * ===================================
 * 
 * 🔧 주요 수정 포인트:
 * 
 * 1. 데이터 저장 추가:
 *    - handleDrawingSubmission 함수에 파일 저장 로직 추가
 *    - 그리기 데이터를 JSON 파일이나 DB에 저장
 * 
 * 2. 데이터 검증 강화:
 *    - 좌표 범위 검증 (동영상 크기 내인지 확인)
 *    - 그리기 타입별 필수 필드 검증
 * 
 * 3. 추가 처리 로직:
 *    - 그리기 영역을 이미지로 변환
 *    - 객체 인식이나 분석 API 연동
 *    - 실시간 협업 기능 구현
 * 
 * 4. 응답 구조 변경:
 *    - response 객체에 더 많은 정보 추가
 *    - 에러 코드나 상세 메시지 제공
 * 
 * 📡 클라이언트 연동:
 * - client/components/VideoPlayer.tsx의 sendDrawingToApi 함수에서 호출
 * - 그리기 완료 시 자동으로 이 API가 호출됨
 */
