import { RequestHandler } from "express";

/**
 * ===================================
 * 🎨 그리기 데이터 처리 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 사용자가 동영상에 그린 영역 데이터 수신
 * 2. 그리기 데이터 로깅 및 검증
 * 3. 간단한 응답 반환 (실제 처리는 클라이언트에서)
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
// 🌐 API 핸들러
// ========================================

/**
 * 그리기 데이터 처리 핸들러
 * 
 * 📝 수정 포인트:
 * - 데이터 저장: 파일이나 DB에 저장하려면 여기에 로직 추가
 * - 추가 처리: 그리기 영역 분석이나 변환 로직 여기에 추가
 * - 검증 강화: drawingData 로드 검증 로직 추가
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
      clickPoint: drawingData.clickPoint ? `(${drawingData.clickPoint.x}, ${drawingData.clickPoint.y})` : null,
      timestamp: drawingData.timestamp
    });

    // ✅ 기본 검증
    if (!drawingData.id || !drawingData.type) {
      return res.status(400).json({
        success: false,
        message: 'id와 type은 필수 항목입니다.'
      });
    }

    // 📝 여기에 추가 처리 로직 구현 가능:
    // - 그리기 데이터를 파일에 저장
    // - 데이터베이스에 저장
    // - 이미지 처리나 분석
    // - 다른 서비스로 전송

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
      message: '그리기 데이�� 처리 중 오류가 발생했습니다.',
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
