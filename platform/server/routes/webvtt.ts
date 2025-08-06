import { RequestHandler } from "express";

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
  }>;
  duration: number;
  timestamp: number;
}

export const handleWebVTTSave: RequestHandler = (req, res) => {
  try {
    const webvttData: WebVTTData = req.body;
    
    // WebVTT 콘텐츠 생성
    const vttContent = generateWebVTTContent(webvttData);
    
    console.log('WebVTT save request received:', {
      videoId: webvttData.videoId,
      videoFileName: webvttData.videoFileName,
      objectCount: webvttData.objects.length,
      duration: webvttData.duration
    });
    
    // 실제 환경에서는 파일 시스템이나 클라우드 스토리지에 저장
    console.log('Generated WebVTT content:\n', vttContent);
    
    const response = {
      success: true,
      message: 'WebVTT 파일이 성공적으로 저장되었습니다.',
      videoId: webvttData.videoId,
      fileName: `${webvttData.videoFileName.replace(/\.[^/.]+$/, "")}.vtt`,
      savedAt: new Date().toISOString(),
      objectCount: webvttData.objects.length,
      vttContent: vttContent // 개발용으로 포함
    };
    
    res.json(response);
  } catch (error) {
    console.error('WebVTT save error:', error);
    res.status(500).json({
      success: false,
      message: 'WebVTT 파일 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function generateWebVTTContent(data: WebVTTData): string {
  const vttLines = ['WEBVTT', ''];
  
  // 객체 정보를 시간대별로 정리
  if (data.objects.length > 0) {
    // 전체 비디오 구간에 대한 객체 정보
    vttLines.push('00:00:00.000 --> ' + formatDuration(data.duration));
    vttLines.push(`탐지된 객체들: ${data.objects.map(obj => obj.name).join(', ')}`);
    vttLines.push('');
    
    // 각 객체별 상세 정보
    data.objects.forEach((obj, index) => {
      const startTime = formatDuration((data.duration / data.objects.length) * index);
      const endTime = formatDuration((data.duration / data.objects.length) * (index + 1));
      
      vttLines.push(`${startTime} --> ${endTime}`);
      vttLines.push(`${obj.name}`);
      if (obj.code) vttLines.push(`코드: ${obj.code}`);
      if (obj.category) vttLines.push(`카테고리: ${obj.category}`);
      if (obj.dlReservoirDomain) vttLines.push(`도메인: ${obj.dlReservoirDomain}`);
      if (obj.additionalInfo) vttLines.push(`정보: ${obj.additionalInfo}`);
      vttLines.push('');
    });
  } else {
    vttLines.push('00:00:00.000 --> ' + formatDuration(data.duration));
    vttLines.push('탐지된 객체가 없습니다.');
    vttLines.push('');
  }
  
  return vttLines.join('\n');
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
