import { RequestHandler } from "express";

interface DrawingData {
  id: string;
  type: "path" | "rectangle";
  color: string;
  points: Array<{ x: number; y: number }>;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  videoId: string;
  timestamp: number;
}

export const handleDrawingSubmission: RequestHandler = (req, res) => {
  try {
    const drawingData: DrawingData = req.body;
    
    // 여기서 그리기 데이터를 처리합니다 (예: 데이터베이스 저장, 분석 등)
    console.log('Received drawing data:', drawingData);
    
    // 실제 환경에서는 데이터베이스에 저장하거나 추가 처리를 수행할 수 있습니다
    // 예시 응답 데이터
    const response = {
      success: true,
      message: '그리기 데이터가 성공적으로 처리되었습니다.',
      id: drawingData.id,
      receivedAt: new Date().toISOString(),
      processedData: {
        type: drawingData.type,
        area: drawingData.type === 'rectangle' && drawingData.startPoint && drawingData.endPoint ? 
          Math.abs(drawingData.endPoint.x - drawingData.startPoint.x) * Math.abs(drawingData.endPoint.y - drawingData.startPoint.y) :
          drawingData.points.length,
        videoId: drawingData.videoId
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Drawing submission error:', error);
    res.status(500).json({
      success: false,
      message: '서버에서 그리기 데이터 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
