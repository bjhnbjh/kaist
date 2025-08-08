import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Eraser,
  Play,
  Trash2,
  Download,
  Check,
  FileVideo,
  BarChart3,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { VideoInfo, DetectedObject } from "../../shared/types";

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawnArea {
  id: string;
  points: DrawingPoint[];
  color: string;
  type: "path" | "rectangle" | "click";
  startPoint?: DrawingPoint;
  endPoint?: DrawingPoint;
  clickPoint?: DrawingPoint;
}

interface ConfirmationModalData {
  area: DrawnArea;
  previewDataUrl: string;
}

interface VideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoInfo | null;
  detectedObjects: DetectedObject[];
  hasRunDetection: boolean; // 추가
  onDownloadWebVTT: () => void;
  onRunObjectDetection: (videoId: string) => void;
  onAddNewObject: (videoId: string, objectName?: string, additionalData?: {
    code?: string;
    additionalInfo?: string;
    dlReservoirDomain?: string;
    category?: string;
    videoCurrentTime?: number;
  }) => string;
  onDeleteObject?: (videoId: string, objectId: string) => void;
  onUpdateObject?: (
    videoId: string,
    objectId: string,
    updates: {
      name?: string;
      code?: string;
      additionalInfo?: string;
      dlReservoirDomain?: string;
      category?: string;
    },
  ) => void;
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 100); // 100분의 1초 단위
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
};

export default function VideoPlayer({
  isOpen,
  onClose,
  video,
  detectedObjects,
  hasRunDetection, // 추가
  onDownloadWebVTT,
  onRunObjectDetection,
  onAddNewObject,
  onDeleteObject,
  onUpdateObject,
}: VideoPlayerProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnAreas, setDrawnAreas] = useState<DrawnArea[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"free" | "rectangle" | "click">(
    "rectangle",
  );
  const [rectangleStart, setRectangleStart] = useState<DrawingPoint | null>(
    null,
  );
  const [currentRectangle, setCurrentRectangle] = useState<DrawnArea | null>(
    null,
  );
  const [isErasing, setIsErasing] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(true);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [showObjectList, setShowObjectList] = useState(false);
  const [hasObjectChanges, setHasObjectChanges] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedObjectName, setEditedObjectName] = useState("");
  const [editedObjectCode, setEditedObjectCode] = useState("");
  const [editedObjectInfo, setEditedObjectInfo] = useState("");
  const [editedDlReservoirDomain, setEditedDlReservoirDomain] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [objectNames, setObjectNames] = useState<{ [key: string]: string }>({});
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [objectToDelete, setObjectToDelete] = useState<string | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [modalObjectInfo, setModalObjectInfo] = useState<{
    name: string;
    code: string;
    additionalInfo: string;
    dlReservoirDomain: string;
    category: string;
    videoCurrentTime: number;
  } | null>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [showApiResponseModal, setShowApiResponseModal] = useState(false);
  const [apiResponseData, setApiResponseData] = useState<{
    success: boolean;
    message: string;
    drawingType: string;
    coordinates?: string;
    videoTime?: number;
    timestamp?: string;
  } | null>(null);

  // 확인 모달 상태
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationModalData, setConfirmationModalData] = useState<ConfirmationModalData | null>(null);

  // 그리기 영역과 생성된 객체 간의 매핑 추적
  const [currentDrawingArea, setCurrentDrawingArea] = useState<DrawnArea | null>(null);
  const [objectDrawingMap, setObjectDrawingMap] = useState<Map<string, DrawnArea>>(new Map());
  // VTT 기반 좌표 오버레이
  const [vttOverlayEnabled, setVttOverlayEnabled] = useState(false);
  const [vttCoordinates, setVttCoordinates] = useState<Array<{
    objectId: string;
    objectName: string;
    videoTime: number;
    coordinates: {
      type: "path" | "rectangle" | "click";
      points?: Array<{ x: number; y: number }>;
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      clickPoint?: { x: number; y: number };
    };
  }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * ===================================
   * 🌐 API URL 설정 및 외부 서버 연결 가이드
   * ===================================
   *
   * 🔧 다른 API 서버 연결 방법:
   * 1. return 값을 실제 API 서버 URL로 변경
   * 2. 예시: return "https://your-api-server.com";
   * 3. 환경변수 사용: return process.env.REACT_APP_API_URL || window.location.origin;
   *
   * 🔐 인증이 필요한 경우:
   * - 각 fetch 요청에 Authorization 헤더 추가
   * - 예시: headers: { 'Authorization': `Bearer ${token}` }
   *
   * 🌍 CORS 설정 확인:
   * - API 서버에서 클라이언트 도메인을 허용하도록 설정
   * - 서버 측: app.use(cors({ origin: "https://your-client-domain.com" }))
   */
  const getApiUrl = () => {
    // 🌐 API 서버 URL - 다른 서버 사용 시 아래 주석을 해제하고 수정하세요
    // return "https://your-api-server.com"; // 외부 API 서버 사용 시
    // return process.env.REACT_APP_API_URL || window.location.origin; // 환경변수 사용 시

    // 현재: 같은 도��인 사용 (개발용)
    return window.location.origin;
  };

  // 좌표와 객체명 연결 함수
  const linkCoordinatesWithObject = async (drawingId: string, objectName: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/drawing/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video?.serverFileName || video?.file.name,
          drawingId: drawingId,
          objectName: objectName
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Coordinates linked successfully:', result);
        return true;
      } else {
        console.error('❌ Failed to link coordinates:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error linking coordinates:', error);
      return false;
    }
  };

  // 임시 좌표 취소 함수
  const cancelTemporaryCoordinates = async (drawingId: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/drawing/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video?.serverFileName || video?.file.name,
          drawingId: drawingId
        })
      });

      if (response.ok) {
        console.log('✅ Temporary coordinates cancelled');
        return true;
      } else {
        console.error('❌ Failed to cancel coordinates:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error cancelling coordinates:', error);
      return false;
    }
  };

  // VTT 좌표 데이터 로드
  const loadVttCoordinates = useCallback(async () => {
    if (!video) return;

    try {
      const apiUrl = getApiUrl();
      const videoFileName = video.serverFileName || video.file.name;

      console.log(`🔍 Loading VTT coordinates for:`, {
        originalFileName: video.file.name,
        serverFileName: video.serverFileName,
        videoFileName: videoFileName,
        videoFolder: video.videoFolder,
        videoId: video.id
      });

      const params = new URLSearchParams({
        videoId: videoFileName,
        videoFileName: videoFileName,
      });

      if (video.videoFolder) {
        params.append('videoFolder', video.videoFolder);
      }

      const response = await fetch(`${apiUrl}/api/vtt-coordinates?${params}`);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ VTT 좌표 데이터 로드됨:', result);

        if (result.success && result.coordinates) {
          setVttCoordinates(result.coordinates);
          // VTT 좌표 로드 성공 알림 제거 (불필요)
          console.log(`✅ VTT에서 ${result.coordinatesCount}개��� 좌표 데이터를 ���러���습니다.`);
        } else {
          setVttCoordinates([]);
          console.log('ℹ️ 저장된 좌표 데이터가 없습니다.');
        }
      } else {
        // VTT 파일이 없는 경우 조용히 처리 (에러가 아님)
        if (response.status === 404) {
          console.log('📄 VTT 파일이 아직 생성되지 않았습니다.');
          setVttCoordinates([]);
        } else {
          const errorText = await response.text();
          console.warn(`❌ VTT 좌표 데이터 로드 실패: ${response.status}`, errorText);
          setVttCoordinates([]);
        }
      }
    } catch (error) {
      // 네트워크 에러나 파싱 에러를 조용히 처리
      console.log('ℹ️ VTT 좌표 데이터를 불러올 수 없습니다:', error instanceof Error ? error.message : 'Unknown error');
      setVttCoordinates([]);
    }
  }, [video]);

  // 그리기 영역 미리보�� 생성
  const createAreaPreview = (area: DrawnArea): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const previewSize = 200;

    canvas.width = previewSize;
    canvas.height = previewSize;

    // 배경을 흰색으로 설정
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewSize, previewSize);

    // 원본 캔버스 크기 가져오기
    const originalCanvas = canvasRef.current;
    if (!originalCanvas) return canvas.toDataURL();

    const originalWidth = originalCanvas.width;
    const originalHeight = originalCanvas.height;

    if (area.type === 'rectangle' && area.startPoint && area.endPoint) {
      // 네모박스의 경우
      const rectWidth = Math.abs(area.endPoint.x - area.startPoint.x);
      const rectHeight = Math.abs(area.endPoint.y - area.startPoint.y);

      // 비율 계산하여 미리보기 크기에 맞게 조정
      const scale = Math.min(previewSize / rectWidth, previewSize / rectHeight) * 0.8;
      const scaledWidth = rectWidth * scale;
      const scaledHeight = rectHeight * scale;

      const centerX = previewSize / 2;
      const centerY = previewSize / 2;

      ctx.strokeStyle = area.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(
        centerX - scaledWidth / 2,
        centerY - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );
    } else if (area.type === 'click' && area.clickPoint) {
      // 클릭 포인트의 경우
      const centerX = previewSize / 2;
      const centerY = previewSize / 2;
      const size = 12;

      ctx.strokeStyle = area.color;
      ctx.lineWidth = 3;

      // 십자가 그리기
      ctx.beginPath();
      ctx.moveTo(centerX - size, centerY);
      ctx.lineTo(centerX + size, centerY);
      ctx.moveTo(centerX, centerY - size);
      ctx.lineTo(centerX, centerY + size);
      ctx.stroke();

      // 원 그리기
      ctx.beginPath();
      ctx.arc(centerX, centerY, size/2, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (area.type === 'path' && area.points.length > 1) {
      // 자유그리기의 경우
      const minX = Math.min(...area.points.map(p => p.x));
      const maxX = Math.max(...area.points.map(p => p.x));
      const minY = Math.min(...area.points.map(p => p.y));
      const maxY = Math.max(...area.points.map(p => p.y));

      const pathWidth = maxX - minX;
      const pathHeight = maxY - minY;

      const scale = Math.min(previewSize / pathWidth, previewSize / pathHeight) * 0.8;

      const offsetX = previewSize / 2 - (minX + pathWidth / 2) * scale;
      const offsetY = previewSize / 2 - (minY + pathHeight / 2) * scale;

      ctx.strokeStyle = area.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const firstPoint = area.points[0];
      ctx.moveTo(firstPoint.x * scale + offsetX, firstPoint.y * scale + offsetY);

      area.points.forEach(point => {
        ctx.lineTo(point.x * scale + offsetX, point.y * scale + offsetY);
      });
      ctx.stroke();
    }

    return canvas.toDataURL();
  };

  // 확인 모달을 표시하고 미리보기 생성
  const showConfirmationDialog = (area: DrawnArea) => {
    const previewDataUrl = createAreaPreview(area);
    setConfirmationModalData({ area, previewDataUrl });
    setShowConfirmationModal(true);

    // 비디오 일시정지
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  };

  // 실제 API 전송 함수
  const sendDrawingToApi = async (area: DrawnArea) => {
    try {
      setIsApiLoading(true);
      const apiUrl = getApiUrl();

      // 현재 동영상 재생 시간 가져오기
      const currentVideoTime = videoRef.current?.currentTime || 0;

      const drawingData = {
        id: area.id,
        type: area.type,
        color: area.color,
        points: area.points,
        startPoint: area.startPoint,
        endPoint: area.endPoint,
        clickPoint: area.clickPoint, // 클��� 포인트 추가
        videoId: video?.serverFileName || video?.file.name,
        videoCurrentTime: currentVideoTime,  // 실제 동영��� 시간 추가
        timestamp: Date.now()
      };

      const response = await fetch(`${apiUrl}/api/drawing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(drawingData)
      });

      if (response.ok) {
        const result = await response.json();

        // API 응답 상세 정보 설정
        setApiResponseData({
          success: true,
          message: result.message || '그리기 데이터가 성공적으로 처리되었습니다.',
          drawingType: area.type === 'click' ? '클릭 좌표' : area.type === 'rectangle' ? '네모박스' : '자유그리기',
          coordinates: area.type === 'click' && area.clickPoint
            ? `(${area.clickPoint.x}, ${area.clickPoint.y})`
            : area.type === 'rectangle' && area.startPoint && area.endPoint
            ? `(${area.startPoint.x}, ${area.startPoint.y}) ~ (${area.endPoint.x}, ${area.endPoint.y})`
            : '복수 좌표',
          videoTime: currentVideoTime,
          timestamp: new Date().toLocaleString('ko-KR')
        });
        setShowApiResponseModal(true);

        // 그리기 영역 전송 성공 로그만 남기고 알림 제거
        console.log(`✅ ${area.type === 'click' ? '클릭 좌표' : '그리기 영역'}가 서버에 전송되었습니다.`);

        // 잠시 후 정보 입력 모달 표시
        setTimeout(() => {
          setShowApiResponseModal(false);

          // 현재 그리기 영역을 저장하여 객체 생성 시 좌표 정보 연결
          setCurrentDrawingArea(area);

          // 그리기로 추가되는 객체는 totalObjectsCreated + 1로 번호 생성
          const nextObjectNumber = video ? video.totalObjectsCreated + 1 : detectedObjects.length + 1;
          setModalObjectInfo({
            name: `Object(${nextObjectNumber})`,
            code: `CODE_${area.id.slice(0, 8).toUpperCase()}`,
            additionalInfo: area.type === 'click' ? '클릭으로 생성된 객체입니다.' : 'AI가 자동으로 탐지한 객체입니다.',
            dlReservoirDomain: 'http://www.naver.com',
            category: '기타',
            videoCurrentTime: currentVideoTime
          });
          setShowInfoModal(true);
        }, 2000);

        return result;
      } else {
        const errorResult = await response.json().catch(() => ({ message: 'API 응답 오류' }));

        // API 오류 응답 상세 정보 설정
        setApiResponseData({
          success: false,
          message: errorResult.message || 'API 서버에서 오��가 발생했습니다.',
          drawingType: area.type === 'click' ? '클릭 좌표' : area.type === 'rectangle' ? '네모박스' : '자유그리기',
          coordinates: area.type === 'click' && area.clickPoint
            ? `(${area.clickPoint.x}, ${area.clickPoint.y})`
            : '오류로 인해 처리되지 않음',
          timestamp: new Date().toLocaleString('ko-KR')
        });
        setShowApiResponseModal(true);

        throw new Error(`HTTP ${response.status}: ${errorResult.message || 'API 전송 실패'}`);
      }
    } catch (error) {
      // 네트워크 에러를 조용히 처리하고 로컬에서 계속 진행
      console.log('ℹ️ 그리기 데이터 전송 실패, 로컬에서 계속 진행:', error instanceof Error ? error.message : 'Unknown error');

      // API 에러가 발���해도 로컬에서 작업 계속 진행
      if (!apiResponseData || apiResponseData.success !== false) {
        // 조용히 처리하고 모달은 표시하지 않음
        console.log('📝 로컬에서 그리기 작업 계속 진행');
      }

      toast.error('서버로 데이터를 전송하는 중 오류가 발생했습니다.');
    } finally {
      setIsApiLoading(false);
    }
  };

  // 캔버스 초기화 ��수
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const videoElement = videoRef.current;
    const container = containerRef.current;

    if (!canvas || !videoElement || !container) return;

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setTimeout(initializeCanvas, 100);
      return;
    }

    const currentVideoTime = videoElement.currentTime;
    const wasPaused = videoElement.paused;

    const containerRect = container.getBoundingClientRect();
    const videoRect = videoElement.getBoundingClientRect();

    canvas.width = videoRect.width;
    canvas.height = videoRect.height;
    canvas.style.width = videoRect.width + "px";
    canvas.style.height = videoRect.height + "px";

    const containerOffsetX = videoRect.left - containerRect.left;
    const containerOffsetY = videoRect.top - containerRect.top;

    canvas.style.left = containerOffsetX + "px";
    canvas.style.top = containerOffsetY + "px";

    if (currentVideoTime > 0) {
      videoElement.currentTime = currentVideoTime;
    }
    if (wasPaused) {
      videoElement.pause();
    }

    setCanvasInitialized(true);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawnAreas.forEach((area) => {
      ctx.strokeStyle = area.color;
      ctx.lineWidth = 3;

      if (area.type === "rectangle" && area.startPoint && area.endPoint) {
        const width = area.endPoint.x - area.startPoint.x;
        const height = area.endPoint.y - area.startPoint.y;
        ctx.strokeRect(area.startPoint.x, area.startPoint.y, width, height);
      } else if (area.type === "click" && area.clickPoint) {
        // 클릭 포인트 그리기 (십자가 마크 + 원)
        const point = area.clickPoint;
        const size = 8;

        // 십자가 그리기
        ctx.strokeStyle = area.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(point.x - size, point.y);
        ctx.lineTo(point.x + size, point.y);
        ctx.moveTo(point.x, point.y - size);
        ctx.lineTo(point.x, point.y + size);
        ctx.stroke();

        // 원 그리기
        ctx.beginPath();
        ctx.arc(point.x, point.y, size/2, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (area.type === "path" && area.points.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(area.points[0].x, area.points[0].y);
        area.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });

    // VTT 좌표 기반 오버레이 표시 (활성화된 경우)
    if (vttOverlayEnabled && vttCoordinates.length > 0) {
      const currentTime = videoRef.current?.currentTime || 0;

      // 현재 시간에 해당하는 좌표들 찾기 (±0.5초 범위)
      const activeCoordinates = vttCoordinates.filter(coord =>
        Math.abs(coord.videoTime - currentTime) <= 0.5
      );

      activeCoordinates.forEach((coord, index) => {
        const coords = coord.coordinates;

        // VTT 오버레이는 파란색 계열로 표시 (기존 그리기와 구분)
        ctx.strokeStyle = `hsl(${200 + index * 30}, 80%, 50%)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // 점선으로 표시해서 구분

        if (coords.type === "rectangle" && coords.startPoint && coords.endPoint) {
          const width = coords.endPoint.x - coords.startPoint.x;
          const height = coords.endPoint.y - coords.startPoint.y;
          ctx.strokeRect(coords.startPoint.x, coords.startPoint.y, width, height);

          // 객체 이름 표시
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "12px Arial";
          ctx.fillText(coord.objectName, coords.startPoint.x, coords.startPoint.y - 5);
        } else if (coords.type === "click" && coords.clickPoint) {
          const point = coords.clickPoint;
          const size = 10;

          // 십자가 + 원 (VTT 버전)
          ctx.beginPath();
          ctx.moveTo(point.x - size, point.y);
          ctx.lineTo(point.x + size, point.y);
          ctx.moveTo(point.x, point.y - size);
          ctx.lineTo(point.x, point.y + size);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(point.x, point.y, size/2, 0, 2 * Math.PI);
          ctx.stroke();

          // 객체 이름 표시
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "12px Arial";
          ctx.fillText(coord.objectName, point.x + 15, point.y - 5);
        } else if (coords.type === "path" && coords.points && coords.points.length > 1) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(coords.points[0].x, coords.points[0].y);
          coords.points.forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();

          // 객체 이름 표시
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "12px Arial";
          ctx.fillText(coord.objectName, coords.points[0].x, coords.points[0].y - 5);
        }

        ctx.setLineDash([]); // 점선 초기화
      });
    }
  }, [drawnAreas, vttOverlayEnabled, vttCoordinates, videoCurrentTime]);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return {
      x: Math.max(0, Math.min(x, canvas.width)),
      y: Math.max(0, Math.min(y, canvas.height)),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isDrawing || !canvasInitialized) return;

      setIsMouseDown(true);
      const coords = getCanvasCoordinates(e);

      if (isErasing) {
        const clickedArea = drawnAreas.find((area) => {
          if (area.type === "rectangle" && area.startPoint && area.endPoint) {
            const minX = Math.min(area.startPoint.x, area.endPoint.x);
            const maxX = Math.max(area.startPoint.x, area.endPoint.x);
            const minY = Math.min(area.startPoint.y, area.endPoint.y);
            const maxY = Math.max(area.startPoint.y, area.endPoint.y);
            return (
              coords.x >= minX &&
              coords.x <= maxX &&
              coords.y >= minY &&
              coords.y <= maxY
            );
          } else if (area.type === "click" && area.clickPoint) {
            // 클릭 포인트 삭제를 위한 범위 체크 (15px 범위)
            return (
              Math.abs(area.clickPoint.x - coords.x) < 15 &&
              Math.abs(area.clickPoint.y - coords.y) < 15
            );
          } else if (area.type === "path" && area.points.length > 0) {
            return area.points.some(
              (point) =>
                Math.abs(point.x - coords.x) < 10 &&
                Math.abs(point.y - coords.y) < 10,
            );
          }
          return false;
        });

        if (clickedArea) {
          setDrawnAreas((prev) =>
            prev.filter((area) => area.id !== clickedArea.id),
          );
        }
      } else if (drawingMode === "rectangle") {
        setRectangleStart(coords);
        setCurrentRectangle(null);
      } else if (drawingMode === "click") {
        // 클릭 모드에서는 즉시 클릭 포인트 생성
        const newClickArea: DrawnArea = {
          id: `click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          points: [],
          color: "#ef4444",
          type: "click",
          clickPoint: coords,
        };
        setDrawnAreas((prev) => [...prev, newClickArea]);

        // 클릭 완료 시 즉시 API로 전송
        sendDrawingToApi(newClickArea);
      } else {
        setCurrentPath([coords]);
      }
    },
    [
      isDrawing,
      canvasInitialized,
      getCanvasCoordinates,
      drawingMode,
      isErasing,
      drawnAreas,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isDrawing || !isMouseDown || !canvasInitialized) return;

      const coords = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      if (!isErasing) {
        redrawCanvas();

        if (drawingMode === "rectangle" && rectangleStart) {
          const normalizedX = Math.min(rectangleStart.x, coords.x);
          const normalizedY = Math.min(rectangleStart.y, coords.y);
          const width = Math.abs(coords.x - rectangleStart.x);
          const height = Math.abs(coords.y - rectangleStart.y);

          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(normalizedX, normalizedY, width, height);
          ctx.setLineDash([]);

          setCurrentRectangle({
            id: "temp",
            points: [],
            color: "#ef4444",
            type: "rectangle",
            startPoint: { x: normalizedX, y: normalizedY },
            endPoint: { x: normalizedX + width, y: normalizedY + height },
          });
        } else if (drawingMode === "free") {
          const newPath = [...currentPath, coords];
          setCurrentPath(newPath);

          if (newPath.length > 1) {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            ctx.moveTo(newPath[0].x, newPath[0].y);
            newPath.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
        }
      }
    },
    [
      isDrawing,
      isMouseDown,
      canvasInitialized,
      currentPath,
      getCanvasCoordinates,
      redrawCanvas,
      drawingMode,
      rectangleStart,
      isErasing,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isDrawing || !isMouseDown || !canvasInitialized) return;

      setIsMouseDown(false);
      const coords = getCanvasCoordinates(e);

      if (!isErasing) {
        if (drawingMode === "rectangle" && rectangleStart) {
          const width = Math.abs(coords.x - rectangleStart.x);
          const height = Math.abs(coords.y - rectangleStart.y);

          if (width > 5 && height > 5) {
            const normalizedStartPoint = {
              x: Math.min(rectangleStart.x, coords.x),
              y: Math.min(rectangleStart.y, coords.y),
            };
            const normalizedEndPoint = {
              x: Math.max(rectangleStart.x, coords.x),
              y: Math.max(rectangleStart.y, coords.y),
            };

            const newArea: DrawnArea = {
              id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              points: [],
              color: "#ef4444",
              type: "rectangle",
              startPoint: normalizedStartPoint,
              endPoint: normalizedEndPoint,
            };
            setDrawnAreas((prev) => [...prev, newArea]);

            // 그리기 완료 시 API로 전송
            sendDrawingToApi(newArea);
          }

          setRectangleStart(null);
          setCurrentRectangle(null);
        } else if (drawingMode === "free" && currentPath.length > 2) {
          const closedPath = [...currentPath];
          if (closedPath.length > 2) {
            const firstPoint = closedPath[0];
            const lastPoint = closedPath[closedPath.length - 1];
            const distance = Math.sqrt(
              Math.pow(firstPoint.x - lastPoint.x, 2) +
              Math.pow(firstPoint.y - lastPoint.y, 2),
            );

            if (distance > 30) {
              closedPath.push(firstPoint);
            }
          }

          const newArea: DrawnArea = {
            id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            points: closedPath,
            color: "#ef4444",
            type: "path",
          };
          setDrawnAreas((prev) => [...prev, newArea]);

          // 그리기 완료 시 API로 전송
          sendDrawingToApi(newArea);
        }

        setCurrentPath([]);
      }
    },
    [
      isDrawing,
      isMouseDown,
      canvasInitialized,
      currentPath,
      getCanvasCoordinates,
      drawingMode,
      rectangleStart,
      isErasing,
    ],
  );

  const toggleDrawing = () => {
    const newDrawingState = !isDrawing;
    const videoElement = videoRef.current;

    const currentTime = videoElement?.currentTime || 0;
    const wasPaused = videoElement?.paused || true;

    setIsDrawing(newDrawingState);

    if (newDrawingState) {
      setShowAdminPanel(false);

      const videoElement = videoRef.current;
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
      }
      if (canvasInitialized) {
        redrawCanvas();
      } else {
        setTimeout(() => {
          initializeCanvas();
        }, 100);
      }
    } else {
      setShowAdminPanel(true);

      setCurrentPath([]);
      setIsMouseDown(false);
      setIsErasing(false);
      setRectangleStart(null);
      setCurrentRectangle(null);

      if (videoElement) {
        setTimeout(() => {
          videoElement.currentTime = currentTime;
          if (!wasPaused) {
            videoElement.play().catch(() => { });
          }
        }, 50);
      }
    }
  };

  const clearAllDrawings = () => {
    setDrawnAreas([]);
    setCurrentPath([]);
    redrawCanvas();
  };

  /**
   * 📄 WebVTT 자막 파일 생성 API 호출
   *
   * 📝 수정 포인트:
   * - API URL 변경: window.location.origin 수정
   * - WebVTT 데이터 구조 변경: webvttData 객체 수정
   * - 응답 처리 변경: response 처리 로직 수정
   */
  const sendWebVTTToApi = async () => {
    if (!video) return;

    try {
      const apiUrl = window.location.origin;

      console.log(`🎬🎬🎬 VTT 저장 시 video 객체 상태:`, {
        videoId: video.id,
        fileName: video.file.name,
        serverFileName: video.serverFileName,
        videoFolder: video.videoFolder,
        uploadDate: video.uploadDate
      });

      // videoFolder��� undefined�� 때 파일명 기반으로 폴더명 추정
      let finalVideoFolder = video.videoFolder;
      const finalFileName = video.serverFileName || video.file.name;

      if (!finalVideoFolder) {
        // 파일명에서 확장자 제거하고 폴더명으로 사용
        const fileNameWithoutExt = finalFileName.replace(/\.[^/.]+$/, "");
        // 공백을 언더스코어로 변경하여 폴더명 형식에 맞춤
        finalVideoFolder = fileNameWithoutExt.replace(/\s+/g, '_');
        console.log(`🔧 videoFolder undefined, 파일명 기반 추정: "${finalVideoFolder}"`);
      }

      const webvttData = {
        videoId: video.id,
        videoFileName: finalFileName, // 서버 파일명 우선 사용
        videoFolder: finalVideoFolder, // 실제 업로드된 폴더명 또는 추정된 폴더명
        objects: detectedObjects.map(obj => ({
          id: obj.id,
          name: obj.name,
          code: obj.code,
          additionalInfo: obj.additionalInfo,
          dlReservoirDomain: obj.dlReservoirDomain,
          category: obj.category,
          confidence: obj.confidence,
          videoCurrentTime: obj.videoCurrentTime || 0,
          finallink: `${obj.dlReservoirDomain || "http://www.naver.com"}/00/${obj.code || `CODE_RECT-${Math.floor(Math.random() * 1000)}`}`,
          position: objectDrawingMap.get(obj.id) ? {
            type: objectDrawingMap.get(obj.id)?.type,
            points: objectDrawingMap.get(obj.id)?.points,
            startPoint: objectDrawingMap.get(obj.id)?.startPoint,
            endPoint: objectDrawingMap.get(obj.id)?.endPoint,
            clickPoint: objectDrawingMap.get(obj.id)?.clickPoint
          } : null,
          polygon: null  // 각 객체의 실제 생성 시점 사용
        })),
        duration: videoDuration,
        timestamp: Date.now()
      };

      const response = await fetch(`${apiUrl}/api/webvtt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webvttData)
      });

      if (response.ok) {
        const result = await response.json();
        // WebVTT 저장 성공 알림 제거 (불필요)
        console.log('✅ WebVTT ���일이 서버에 저장되었습니다.');
        console.log('WebVTT API response:', result);
      } else {
        throw new Error('WebVTT API 전송 실패');
      }
    } catch (error) {
      console.error('WebVTT API error:', error);
      toast.error('WebVTT 서버 저장 중 오류가 발생했습니다.');
    }
  };

  /**
   * �� 편집 데이터 DB 저장 API 호출
   *
   * 📝 수정 포인트:
   * - API URL 변경: window.location.origin 수정
   * - 저장 데이터 구조 변경: saveData 객체 수정
   * - 응답 처리 변경: response 처리 로직 수정
   * - 에러 처리 개선: try-catch 블록 수정
   */
  const saveDataToDb = async () => {
    if (!video) return;

    try {
      const apiUrl = window.location.origin;

      const saveData = {
        videoId: video.id,
        videoFileName: video.file.name,
        objects: detectedObjects.map(obj => ({
          id: obj.id,
          name: obj.name,
          code: obj.code,
          additionalInfo: obj.additionalInfo,
          dlReservoirDomain: obj.dlReservoirDomain,
          category: obj.category,
          confidence: obj.confidence,
          selected: obj.selected
        })),
        drawings: drawnAreas.map(area => ({
          id: area.id,
          type: area.type,
          color: area.color,
          points: area.points,
          startPoint: area.startPoint,
          endPoint: area.endPoint
        })),
        duration: videoDuration,
        totalFrames: totalFrames,
        timestamp: Date.now()
      };

      const response = await fetch(`${apiUrl}/api/save-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData)
      });

      if (response.ok) {
        const result = await response.json();
        // 편집 데이터 저장 성공 알림 제거 (불필요)
        console.log('✅ 편집 데이터가 DB에 저장되었��니다.');
        console.log('Save data API response:', result);
      } else {
        throw new Error('Save data API 전송 실패');
      }
    } catch (error) {
      console.error('Save data API error:', error);
      toast.error('편집 데이터 DB 저장 중 오류가 발생했습니다.');
    }
  };

  const saveDrawings = async () => {
    const currentDuration = videoDuration;
    const currentFrames = totalFrames;

    try {
      // 1. 편집 데이터 DB 저장
      await saveDataToDb();

      // 2. WebVTT 파일 저장
      await sendWebVTTToApi();

      // 3. 그리기 영역 초기화
      setDrawnAreas([]);
      setHasObjectChanges(false);

      // 최종 저장 완료 메시지 표시
      toast.success("모든 데이터가 저장되었습니다.");

      console.log("저장 후 비디오 정보:", {
        duration: currentDuration,
        frames: currentFrames,
        currentVideoDuration: videoDuration,
        currentTotalFrames: totalFrames,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast.error("저장 중 오류��� 발생했습니다.");
    }
  };

  const runObjectDetection = () => {
    if (!video) return;

    setIsDetecting(true);
    setDetectionProgress(0);

    const interval = setInterval(() => {
      setDetectionProgress((prev) => {
        const newProgress = prev + Math.random() * 15 + 5;

        if (newProgress >= 100) {
          clearInterval(interval);
          setIsDetecting(false);
          setDetectionProgress(100);
          onRunObjectDetection(video.id);
          toast.success(
            "객체 탐지가 완료되었습니다! 새로운 객체들이 발견되었습니다.",
          );

          setTimeout(() => {
            setDetectionProgress(0);
          }, 1000);

          return 100;
        }
        return Math.min(newProgress, 100);
      });
    }, 200);
  };

  const toggleAdminPanel = () => {
    setShowAdminPanel(!showAdminPanel);
  };

  // 편집 완료 핸들러
  const handleEditComplete = () => {
    if (selectedObjectId && onUpdateObject && video) {
      const updates: {
        name?: string;
        code?: string;
        additionalInfo?: string;
        dlReservoirDomain?: string;
        category?: string;
      } = {};

      // 편���된 값이 있을 때만 업데이���에 포함
      if (editedObjectName.trim()) updates.name = editedObjectName.trim();
      if (editedObjectCode.trim()) updates.code = editedObjectCode.trim();
      if (editedObjectInfo.trim()) updates.additionalInfo = editedObjectInfo.trim();
      if (editedDlReservoirDomain.trim()) updates.dlReservoirDomain = editedDlReservoirDomain.trim();
      if (editedCategory.trim()) updates.category = editedCategory.trim();

      // 업데이트가 있을 때만 콜백 호출
      if (Object.keys(updates).length > 0) {
        onUpdateObject(video.id, selectedObjectId, updates);
        setHasObjectChanges(true);
        // 객체 정보 업데이트 알림 제거 (불필요)
        console.log('✅ 객체 정보가 업데이트되었습니다.');
      }
    }
    setIsEditing(false);
  };

  // 뒤로가기 핸들러 - 탐지된 객체 목록으로만 이동하고 버튼 활성화 상태 유지
  const handleBackToObjectList = () => {
    setSelectedObjectId(null);
    setIsEditing(false);
    // showObjectList true로 유지하여 "탐지된 객체" 버튼 활성화 상태 유지
  };

  // 삭제 확인 모달 관련 핸들러���
  const handleDeleteClick = (objectId: string) => {
    setObjectToDelete(objectId);
    setShowDeleteConfirmModal(true);
    setDeleteConfirmed(false);
  };

  const confirmDelete = async () => {
    if (objectToDelete && deleteConfirmed && video && onDeleteObject) {
      if (objectToDelete === "BULK_DELETE") {
        // 일괄 삭제 처리
        const deleteCount = selectedObjectIds.length;
        selectedObjectIds.forEach((objectId) => {
          onDeleteObject(video.id, objectId);
        });
        setSelectedObjectIds([]);
        setHasObjectChanges(true);
        toast.success(`${deleteCount}개 객체가 삭제되었습니다.`);

        // 즉시 서버에 저장
        await saveDataToDb();
      } else {
        // 개별 객체 삭제 처리
        onDeleteObject(video.id, objectToDelete);
        setHasObjectChanges(true);
        handleBackToObjectList();
        toast.success("객체가 삭제되었습니다.");

        // ��시 서버에 저장
        await saveDataToDb();
      }
      setShowDeleteConfirmModal(false);
      setObjectToDelete(null);
      setDeleteConfirmed(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setObjectToDelete(null);
    setDeleteConfirmed(false);
  };

  // 객체 이름 가져오기 함수 - 실제 객체 이름을 그대로 사용
  const getObjectDisplayName = (object: DetectedObject) => {
    return object.name;
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isOpen) return;

    const updateTime = () => {
      setVideoCurrentTime(videoElement.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (canvasInitialized) return;
      setTimeout(initializeCanvas, 200);
    };

    const handleCanPlay = () => {
      if (!canvasInitialized) {
        setTimeout(initializeCanvas, 100);
      }
    };

    videoElement.addEventListener("timeupdate", updateTime);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("resize", initializeCanvas);

    return () => {
      videoElement.removeEventListener("timeupdate", updateTime);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("resize", initializeCanvas);
    };
  }, [initializeCanvas, isOpen, canvasInitialized]);

  useEffect(() => {
    if (isOpen && video) {
      setCanvasInitialized(false);
      setDrawnAreas([]);
      setCurrentPath([]);
      setIsMouseDown(false);
      setIsDrawing(false);
      setIsErasing(false);
      setShowAdminPanel(true);
      setSelectedObjectIds([]);
      setSelectedObjectId(null);
      setHasObjectChanges(false);
      setIsEditing(false);
      setShowDeleteConfirmModal(false);
      setObjectToDelete(null);
      setDeleteConfirmed(false);
      // 초기에는 객체 목록을 닫은 상태로 시작
      setShowObjectList(false);

      if (videoDuration === 0) {
        setVideoDuration(0);
        setTotalFrames(0);
      }

      if (!videoUrl) {
        const url = URL.createObjectURL(video.file);
        setVideoUrl(url);
      }

      const timer = setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement && videoElement.readyState >= 2) {
          initializeCanvas();
        }
      }, 300);

      return () => clearTimeout(timer);
    } else if (!isOpen && videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  }, [isOpen, video, initializeCanvas, videoUrl]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isOpen) return;

    const handleLoadedMetadata = () => {
      const duration = videoElement.duration;
      setVideoDuration(duration);

      const fps = 30;
      const frames = Math.floor(duration * fps);
      setTotalFrames(frames);
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isOpen, videoUrl]);

  useEffect(() => {
    if (canvasInitialized) {
      redrawCanvas();
    }
  }, [drawnAreas, canvasInitialized, redrawCanvas]);

  // 비디오 모달 열릴 때 VTT 좌표 자동 로드
  useEffect(() => {
    if (isOpen && video && canvasInitialized) {
      // 잠시 후 VTT 좌표 로드 (캔버스 초기화 완�� 후)
      const timer = setTimeout(() => {
        loadVttCoordinates();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, video, canvasInitialized, loadVttCoordinates]);

  useEffect(() => {
    const handleResize = () => {
      if (isOpen && canvasInitialized) {
        setTimeout(initializeCanvas, 100);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, canvasInitialized, initializeCanvas]);

  // 1. displayObjects는 무조건 detectedObjects만 사용
  const displayObjects = detectedObjects;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: showAdminPanel ? "2200px" : "1800px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "16px",
          }}
        >
          <h2
            style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937" }}
          >
            미리보기
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#6b7280",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* 비디오 영역 */}
          <div
            style={{
              flex: showAdminPanel ? "2" : "1",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              position: "relative",
            }}
          >
            {/* 비디오 컨테이너 */}
            <div
              ref={containerRef}
              style={{
                position: "relative",
                background: "black",
                borderRadius: "8px",
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "900px",
              }}
            >
              <video
                ref={videoRef}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: "8px",
                  display: "block",
                }}
                controls={!isDrawing}
                src={videoUrl || undefined}
                preload="metadata"
              />

              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  pointerEvents: isDrawing ? "auto" : "none",
                  cursor: isDrawing
                    ? isErasing
                      ? "pointer"
                      : "crosshair"
                    : "default",
                  borderRadius: "8px",
                  zIndex: isDrawing ? 5 : 1,
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>

            {/* 컨트롤 버튼들 */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={toggleDrawing}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: "500",
                  cursor: "pointer",
                  background: isDrawing ? "#ef4444" : "#6366f1",
                  color: "white",
                  fontSize: "0.9rem",
                }}
              >
                {isDrawing ? "그리기 종료" : "영역 그리기"}
              </button>

              {isDrawing && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setDrawingMode("rectangle");
                      setIsErasing(false);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontWeight: "500",
                      cursor: "pointer",
                      background:
                        drawingMode === "rectangle" && !isErasing
                          ? "#3b82f6"
                          : "white",
                      color:
                        drawingMode === "rectangle" && !isErasing
                          ? "white"
                          : "#374151",
                      fontSize: "0.85rem",
                    }}
                  >
                    네모박스
                  </button>
                  <button
                    onClick={() => {
                      setDrawingMode("click");
                      setIsErasing(false);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontWeight: "500",
                      cursor: "pointer",
                      background:
                        drawingMode === "click" && !isErasing
                          ? "#f59e0b"
                          : "white",
                      color:
                        drawingMode === "click" && !isErasing
                          ? "white"
                          : "#374151",
                      fontSize: "0.85rem",
                    }}
                  >
                    클릭
                  </button>
                  <button
                    onClick={() => setIsErasing(!isErasing)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontWeight: "500",
                      cursor: "pointer",
                      background: isErasing ? "#ef4444" : "white",
                      color: isErasing ? "white" : "#374151",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Eraser style={{ width: 14, height: 14 }} />
                    지우개
                  </button>
                </div>
              )}

              <button
                onClick={saveDrawings}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: "500",
                  cursor: "pointer",
                  background: "#10b981",
                  color: "white",
                  fontSize: "0.9rem",
                }}
              >
최종저장
              </button>

              {/* VTT 좌표 불러오기와 오버레이 버튼 제거됨 */}
            </div>

            {drawnAreas.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "#6b7280",
                }}
              >
                그려진 영역: {drawnAreas.length}개
              </div>
            )}



            {isDrawing && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: isErasing ? "#dc2626" : "#ef4444",
                  fontWeight: "500",
                  background: isErasing ? "#fef2f2" : "#fef2f2",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #fecaca",
                }}
              >
                {isErasing
                  ? "🗑️ 지우개 모드 - 그려진 영역을 클릭하여 삭제하세요"
                  : drawingMode === "click"
                  ? "📍 클릭 모드 활성화 - 마우스로 클릭하여 좌표를 찍어보세요"
                  : "🎨 그리기 모드 활성화 - 마우스로 드래그하여 영역을 그려보세요"}
              </div>
            )}
          </div>

          {/* 관리자 패널 토글 버튼 */}
          {!showAdminPanel && (
            <div
              style={{
                position: "absolute",
                right: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
              }}
            >
              <button
                onClick={toggleAdminPanel}
                style={{
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: "8px 0 0 8px",
                  padding: "12px 8px",
                  cursor: "pointer",
                  color: "white",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                  transform: "translateX(4px)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2563eb";
                  e.currentTarget.style.transform = "translateX(0px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#3b82f6";
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
              >
                <ChevronLeft style={{ width: 20, height: 20 }} />
              </button>
            </div>
          )}

          {/* 관리자 패널 */}
          {showAdminPanel && (
            <div
              style={{
                flex: "0.6",
                minWidth: "300px",
                maxWidth: "350px",
                background: "#f9fafb",
                borderRadius: "8px",
                padding: "16px",
                border: "1px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                height: "75vh",
                maxHeight: "750px",
                animation: "slideInRight 0.3s ease-out",
                transform: "translateX(0)",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#1f2937",
                    margin: 0,
                  }}
                >
                  관리자 패널
                </h3>
                <button
                  onClick={toggleAdminPanel}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    padding: "2px",
                    transition: "transform 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <ChevronRight style={{ width: 18, height: 18 }} />
                </button>
              </div>

              {/* 액션 버튼들 */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                <button
                  onClick={() => {
                    if (!showObjectList && !selectedObjectId) {
                      // 처음 클릭 �� 객체 목�� 열기
                      setShowObjectList(true);
                      setSelectedObjectId(null);
                    } else if (showObjectList && !selectedObjectId) {
                      // 객체 ��목이 열려있��� 때 닫기
                      setShowObjectList(false);
                    } else if (selectedObjectId) {
                      // 객�� ��세 정보에서 ��기
                      setShowObjectList(false);
                      setSelectedObjectId(null);
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background:
                      showObjectList || selectedObjectId
                        ? "#ef4444"
                        : "#10b981",
                    color: "white",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <BarChart3 style={{ width: 12, height: 12 }} />
                  {showObjectList || selectedObjectId
                    ? "객체 목록 닫기"
                    : "탐지된 객체"}
                </button>
              </div>

              {/* 객�� 탐지 진행도 */}
              {isDetecting && (
                <div
                  style={{
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "#f0fdf4",
                    borderRadius: "6px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div
                    className="spinner"
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "2px solid #e5e7eb",
                      borderTop: "2px solid #10b981",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#047857",
                      fontWeight: "500",
                    }}
                  >
                    객체 탐지 실행 중...
                  </div>
                </div>
              )}

              {/* 선택된 객체 정보 */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      color: "#1f2937",
                      margin: 0,
                    }}
                  >
                    {selectedObjectId
                      ? "선택된 ���체 정보"
                      : `탐지된 객체 목록(${displayObjects.length}개)`}
                  </h4>
                  {showObjectList && !selectedObjectId && (
                    <button
                      onClick={() => {
                        if (video) {
                          runObjectDetection();
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                        padding: "2px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="새로��침"
                    >
                      <RefreshCw style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                  {selectedObjectId && (
                    <button
                      onClick={handleBackToObjectList}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        gap: "4px",
                        transition: "background-color 0.2s ease",
                      }}
                      title="탐지된 객체 목록으로 돌아가기"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <ChevronLeft style={{ width: 14, height: 14 }} />
                      목록
                    </button>
                  )}
                </div>
              </div>

              <div
                className="objects-grid"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: "65vh",
                  minHeight: "250px",
                  display: "block",
                  paddingRight: "8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "4px",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#5fbeeb #f1f5f9",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {showObjectList && !selectedObjectId ? (
                  !hasRunDetection ? (
                    // 탐지 실행 전 안내 구조
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "200px",
                        color: "#ef4444",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔍</div>
                      <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                        탐지된 객체가 없습니다.
                      </div>
                      <div style={{ fontSize: "0.95rem" }}>
                        <b>객체 탐지 실행</b>을 먼저 눌러주세요.
                      </div>
                    </div>
                  ) : displayObjects && displayObjects.length > 0 ? (
                    // 실제 객체 목록 표시
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}>
                      {displayObjects.map((object) => (
                        <div
                          key={object.id}
                          style={{
                            background: selectedObjectIds.includes(object.id)
                              ? "#fef2f2"
                              : "#f8fafc",
                            border: `1px solid ${selectedObjectIds.includes(object.id) ? "#fecaca" : "#e2e8f0"}`,
                            borderRadius: "6px",
                            padding: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              const isCurrentlySelected =
                                selectedObjectIds.includes(object.id);
                              if (isCurrentlySelected) {
                                setSelectedObjectIds((prev) =>
                                  prev.filter((id) => id !== object.id),
                                );
                              } else {
                                setSelectedObjectIds((prev) => [
                                  ...prev,
                                  object.id,
                                ]);
                              }
                            }}
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "3px",
                              border: `2px solid ${selectedObjectIds.includes(object.id) ? "#ef4444" : "#d1d5db"}`,
                              background: selectedObjectIds.includes(object.id)
                                ? "#ef4444"
                                : "white",
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              flexShrink: 0,
                              cursor: "pointer",
                            }}
                          >
                            {selectedObjectIds.includes(object.id) && "✓"}
                          </div>

                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#10b981",
                              flexShrink: 0,
                            }}
                          />

                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "600",
                                color: "#1f2937",
                                fontSize: "0.9rem",
                              }}
                            >
                              {getObjectDisplayName(object)}
                            </div>
                            <div
                              style={{ fontSize: "0.8rem", color: "#6b7280" }}
                            // 신뢰도 삭제
                            >
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedObjectId(object.id);
                              setEditedObjectName(object.name);
                              setEditedCategory(object.category || "기타");
                              setEditedObjectCode(
                                object.code ||
                                `CODE_${object.id.slice(0, 8).toUpperCase()}`,
                              );
                              setEditedDlReservoirDomain(
                                object.dlReservoirDomain ||
                                "http://www.naver.com",
                              );
                              setEditedObjectInfo(
                                object.additionalInfo ||
                                "AI가 자동으로 탐지한 객체입니다.",
                              );                           
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#6b7280",
                              padding: "4px",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "color 0.2s ease",
                            }}
                            title="정보 보기"
                          >
                            <ChevronRight style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      ))}

                      {/* 삭제제 버튼을 스크롤 영역 ���으로 이동 */}
                      {false && (
                        <div
                          style={{
                            marginTop: "16px",
                            padding: "16px",
                            background:
                              "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                            borderRadius: "8px",
                            border: "2px solid #fecaca",
                            boxShadow: "0 2px 4px rgba(220, 38, 38, 0.1)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.9rem",
                                color: "#dc2626",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              ✅ {selectedObjectIds.length}개 객체가 선택되었습니다
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              // 일괄 삭제를 위��� 확인 모달��� 열어서 ��체 선택 삭제 처리
                              if (selectedObjectIds.length > 0) {
                                setObjectToDelete("BULK_DELETE");
                                setShowDeleteConfirmModal(true);
                                setDeleteConfirmed(false);
                              }
                            }}
                            style={{
                              background:
                                "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                              border: "none",
                              borderRadius: "8px",
                              padding: "12px 16px",
                              color: "white",
                              fontSize: "0.9rem",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              transition: "all 0.2s ease",
                              boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                              width: "100%",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-1px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 8px rgba(220, 38, 38, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 2px 4px rgba(220, 38, 38, 0.2)";
                            }}
                          >
                            <Trash2 style={{ width: 16, height: 16 }} />
                            선택된 객체 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "200px",
                        color: "#9ca3af",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: "8px" }}>
                        🔍
                      </div>
                      <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                        탐지된 객체가 없습니다.
                      </div>
                      <div style={{ fontSize: "0.85rem" }}>
                        영역을 그려서 객체를 추가해보세요
                      </div>
                    </div>
                  )
                ) : selectedObjectId ? (
                  <div
                    style={{
                      animation: "slideInFromRight 0.3s ease-out",
                      transform: "translateX(0)",
                      height: "500px",
                    }}
                  >
                    {(() => {
                      const selectedObject = displayObjects.find(
                        (obj) => obj.id === selectedObjectId,
                      );
                      if (!selectedObject) return null;

                      const objectName = getObjectDisplayName(selectedObject);

                      return (
                        <div
                          className="object-detail-scroll object-detail-container"
                          style={{
                            background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                            border: "2px solid #e2e8f0",
                            borderRadius: "12px",
                            padding: "16px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            maxHeight: "40vh",
                            minHeight: "280px",
                            overflowY: "auto",
                            overflowX: "hidden",
                            scrollbarWidth: "thin",
                            scrollbarColor: "#ef4444 #f8fafc",
                            WebkitOverflowScrolling: "touch",
                            touchAction: "pan-y",
                          }}
                        >
                          {/* 이름 섹션 */}
                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "#334155",
                                marginBottom: "6px",
                              }}
                            >
                              이름
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editedObjectName}
                                onChange={(e) =>
                                  setEditedObjectName(e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                  padding: "8px",
                                  fontSize: "0.85rem",
                                  color: "#475569",
                                }}
                              >
                                {objectName}
                              </div>
                            )}

                            {/* Dropdown 섹션 */}
                            <div style={{ marginTop: "8px" }}>
                              {isEditing ? (
                                <select
                                  value={editedCategory}
                                  onChange={(e) =>
                                    setEditedCategory(e.target.value)
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    fontSize: "0.85rem",
                                    background: "#ffffff",
                                  }}
                                >
                                  <option value="기타">기타 (00)</option>
                                  <option value="GTIN">GTIN (01)</option>
                                  <option value="GLN">GLN (02)</option>
                                  <option value="GIAI">GIAI (03)</option>
                                  <option value="GSIN">GSIN (04)</option>
                                </select>
                              ) : (
                                <div
                                  style={{
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "4px",
                                    padding: "8px",
                                    fontSize: "0.85rem",
                                    color: "#475569",
                                  }}
                                >
                                  카테고리:{" "}
                                  {selectedObject.category ||
                                    editedCategory ||
                                    "기타"}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 코드 섹션 */}
                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "#334155",
                                marginBottom: "8px",
                              }}
                            >
                              🔧 코드
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editedObjectCode}
                                onChange={(e) =>
                                  setEditedObjectCode(e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                  padding: "8px",
                                  fontSize: "0.85rem",
                                  color: "#475569",
                                  fontFamily: "monospace",
                                }}
                              >
                                {selectedObject.code ||
                                  `CODE_${selectedObject.id.slice(0, 8).toUpperCase()}`}
                              </div>
                            )}
                          </div>

                          {/* DL.reservoir domain 섹션 */}
                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "#334155",
                                marginBottom: "8px",
                              }}
                            >
                              🌐 DL.reservoir domain
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editedDlReservoirDomain}
                                onChange={(e) =>
                                  setEditedDlReservoirDomain(e.target.value)
                                }
                                onFocus={(e) => {
                                  if (
                                    e.target.value ===
                                    selectedObject.dlReservoirDomain ||
                                    e.target.value === "http://www.naver.com"
                                  ) {
                                    setEditedDlReservoirDomain("");
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                }}
                                placeholder="URL을 입력하세요"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  const url =
                                    selectedObject.dlReservoirDomain ||
                                    "http://www.naver.com";
                                  window.open(url, "_blank");
                                }}
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                  padding: "8px",
                                  fontSize: "0.85rem",
                                  color: "#3b82f6",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  textDecoration: "underline",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#f8fafc";
                                  e.currentTarget.style.borderColor = "#3b82f6";
                                  e.currentTarget.style.color = "#1d4ed8";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "#ffffff";
                                  e.currentTarget.style.borderColor = "#e2e8f0";
                                  e.currentTarget.style.color = "#3b82f6";
                                }}
                              >
                                {selectedObject.dlReservoirDomain ||
                                  "http://www.naver.com"}
                              </div>
                            )}
                          </div>

                          {/* Final Link 섹션 - 편집 불가능 */}
                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "#334155",
                                marginBottom: "8px",
                              }}
                            >
                              🔗 Final Link
                            </div>
                            {(() => {
                              // 카테고리별 고유번호 매핑
                              const categoryCodeMap: {[key: string]: string} = {
                                "GTIN": "01",
                                "GLN": "02",
                                "GIAI": "03",
                                "GSIN": "04",
                                "기타": "00"
                              };

                              const currentCategory = isEditing ? editedCategory : (selectedObject.category || "기타");
                              const categoryCode = categoryCodeMap[currentCategory] || "00";
                              const currentCode = isEditing ? editedObjectCode : (selectedObject.code || `CODE_${selectedObject.id.slice(0, 8).toUpperCase()}`);
                              const currentDomain = isEditing ? editedDlReservoirDomain : (selectedObject.dlReservoirDomain || "http://www.naver.com");

                              const finalLink = `${currentDomain}/${categoryCode}/${currentCode}`;

                              return (
                                <div
                                  onClick={() => {
                                    window.open(finalLink, "_blank");
                                  }}
                                  style={{
                                    background: "#f0f9ff",
                                    border: "2px solid #0ea5e9",
                                    borderRadius: "4px",
                                    padding: "8px",
                                    fontSize: "0.85rem",
                                    color: "#0369a1",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    textDecoration: "underline",
                                    fontWeight: "500",
                                    wordBreak: "break-all",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#e0f2fe";
                                    e.currentTarget.style.borderColor = "#0284c7";
                                    e.currentTarget.style.color = "#164e63";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#f0f9ff";
                                    e.currentTarget.style.borderColor = "#0ea5e9";
                                    e.currentTarget.style.color = "#0369a1";
                                  }}
                                >
                                  {finalLink}
                                </div>
                              );
                            })()}
                          </div>

                          {/* 추가정보 섹션 */}
                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "#334155",
                                marginBottom: "8px",
                              }}
                            >
                              📝 추가정보
                            </div>
                            {isEditing ? (
                              <textarea
                                value={editedObjectInfo}
                                onChange={(e) =>
                                  setEditedObjectInfo(e.target.value)
                                }
                                onFocus={(e) => {
                                  if (
                                    e.target.value ===
                                    selectedObject.additionalInfo ||
                                    e.target.value ===
                                    "AI가 자동으로 탐지한 객체입니다."
                                  ) {
                                    setEditedObjectInfo("");
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  height: "60px",
                                  padding: "8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                  resize: "none",
                                }}
                                placeholder="수정 할  정보를 입력하세요"
                              />
                            ) : (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "4px",
                                  padding: "8px",
                                  fontSize: "0.85rem",
                                  color: "#475569",
                                  minHeight: "60px",
                                  lineHeight: "1.4",
                                }}
                              >
                                {selectedObject.additionalInfo ||
                                  "AI가 자동으로 탐지된 객체입니다."}
                              </div>
                            )}
                          </div>

                          {/* 수정 버튼 - 객체 정보 하단으로 이동 */}
                          <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  handleEditComplete();
                                } else {
                                  setIsEditing(true);
                                }
                              }}
                              style={{
                                background: isEditing ? "#10b981" : "#3b82f6",
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 16px",
                                color: "white",
                                fontSize: "0.85rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                transition: "all 0.2s ease",
                              }}
                            >
                              {isEditing ? "수정완료" : "수정"}
                            </button>
                            <button
                              onClick={() => {
                                if (selectedObjectId) {
                                  handleDeleteClick(selectedObjectId);
                                }
                              }}
                              style={{
                                background: "#ef4444",
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 16px",
                                color: "white",
                                fontSize: "0.85rem",
                                fontWeight: "600",
                                cursor: "pointer",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#dc2626";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#ef4444";
                              }}
                            >
                              <Trash2 style={{ width: 16, height: 16 }} />
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "200px",
                      color: "#9ca3af",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>
                      🔍
                    </div>
                    <div style={{ fontWeight: "500", marginBottom: "4px" }}>
                      탐지된 객체 없음
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      "탐지된 객체" 버튼을 클릭하여
                      <br />
                      객체 목록을 확인해주세요
                    </div>
                  </div>
                )}
              </div>

              {/* 선택된 객체 삭제 버튼 - 스크롤 영역 밖 */}
              {showObjectList && !selectedObjectId && selectedObjectIds.length > 0 && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    background:
                      "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                    borderRadius: "8px",
                    border: "2px solid #fecaca",
                    boxShadow: "0 2px 4px rgba(220, 38, 38, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.9rem",
                        color: "#dc2626",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      ✅ {selectedObjectIds.length}개 객체가 선택됨
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // 일괄 삭제를 위해 확인 모달을 열어서 전체 선택 삭제로 처리
                      if (selectedObjectIds.length > 0) {
                        setObjectToDelete("BULK_DELETE");
                        setShowDeleteConfirmModal(true);
                        setDeleteConfirmed(false);
                      }
                    }}
                    style={{
                      background: "#ef4444",
                      border: "none",
                      borderRadius: "6px",
                      padding: "12px 16px",
                      color: "white",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#dc2626";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ef4444";
                    }}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirmModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: "600",
                marginBottom: "16px",
                color: "#1f2937",
              }}
            >
              삭제 확인
            </h3>

            <p
              style={{
                color: "#6b7280",
                marginBottom: "20px",
                lineHeight: 1.5,
              }}
            >
              진짜 삭제하시겠습니까?
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "20px",
                padding: "12px",
                background: "#fef2f2",
                borderRadius: "6px",
                border: "1px solid #fecaca",
              }}
            >
              <input
                type="checkbox"
                id="confirm-object-delete"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="confirm-object-delete"
                style={{
                  fontSize: "0.9rem",
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                상기 내용을 확인했습니다
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={cancelDelete}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={!deleteConfirmed}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: deleteConfirmed ? "#ef4444" : "#9ca3af",
                  color: "white",
                  cursor: deleteConfirmed ? "pointer" : "not-allowed",
                  opacity: deleteConfirmed ? 1 : 0.6,
                  transition: "all 0.2s ease",
                }}
              >
                삭제
              </button>
            </div>

            {!deleteConfirmed && (
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "0.8rem",
                  color: "#dc2626",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                ⚠️ 체크박스를 선택해야 삭제할 수 있습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* 정보 입력 모달 */}
      {showInfoModal && modalObjectInfo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onMouseDown={(e) => {
            // 모달 배경 클릭 시에만 닫기 (드래그 방지)
            if (e.target === e.currentTarget) {
              setShowInfoModal(false);
            }
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                새 객체 정보 입력
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* 콘텐츠 */}
            <div
              style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
                overflowY: "auto",
                maxHeight: "60vh",
              }}
            >
              {/* 이름 섹션 */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  이름
                </div>
                <input
                  type="text"
                  value={modalObjectInfo.name}
                  onChange={(e) =>
                    setModalObjectInfo({
                      ...modalObjectInfo,
                      name: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                />

                {/* 카테고리 드롭다운 */}
                <div style={{ marginTop: "8px" }}>
                  <select
                    value={modalObjectInfo.category}
                    onChange={(e) =>
                      setModalObjectInfo({
                        ...modalObjectInfo,
                        category: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      background: "#ffffff",
                    }}
                  >
                    <option value="기타">기타 (00)</option>
                    <option value="GTIN">GTIN (01)</option>
                    <option value="GLN">GLN (02)</option>
                    <option value="GIAI">GIAI (03)</option>
                    <option value="GSIN">GSIN (04)</option>
                  </select>
                </div>
              </div>

              {/* 코드 섹�� */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "8px",
                  }}
                >
                  🔧 코드
                </div>
                <input
                  type="text"
                  value={modalObjectInfo.code}
                  onChange={(e) =>
                    setModalObjectInfo({
                      ...modalObjectInfo,
                      code: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              {/* DL.reservoir domain 섹션 */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "8px",
                  }}
                >
                  🌐 DL.reservoir domain
                </div>
                <input
                  type="text"
                  value={modalObjectInfo.dlReservoirDomain}
                  onChange={(e) =>
                    setModalObjectInfo({
                      ...modalObjectInfo,
                      dlReservoirDomain: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                  placeholder="URL을 입력하세요"
                />
              </div>

              {/* Final Link 섹션 - 읽기 전용 */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "8px",
                  }}
                >
                  🔗 Final Link
                </div>
                {(() => {
                  const categoryCodeMap: {[key: string]: string} = {
                    "GTIN": "01",
                    "GLN": "02",
                    "GIAI": "03",
                    "GSIN": "04",
                    "기타": "00"
                  };
                  const categoryCode = categoryCodeMap[modalObjectInfo.category] || "00";
                  const finalLink = `${modalObjectInfo.dlReservoirDomain}/${categoryCode}/${modalObjectInfo.code}`;

                  return (
                    <div
                      style={{
                        background: "#f0f9ff",
                        border: "2px solid #0ea5e9",
                        borderRadius: "4px",
                        padding: "8px",
                        fontSize: "0.85rem",
                        color: "#0369a1",
                        fontWeight: "500",
                        wordBreak: "break-all",
                      }}
                    >
                      {finalLink}
                    </div>
                  );
                })()}
              </div>

              {/* 추가정보 섹션 */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "8px",
                  }}
                >
                  💡 추가정보
                </div>
                <textarea
                  value={modalObjectInfo.additionalInfo}
                  onChange={(e) =>
                    setModalObjectInfo({
                      ...modalObjectInfo,
                      additionalInfo: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    height: "60px",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    resize: "none",
                  }}
                  placeholder="추가 정보를 입력하세요"
                />
              </div>
            </div>

            {/* 버튼 영역 */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "20px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={async () => {
                  // 임시 좌표 취소
                  if (currentDrawingArea) {
                    await cancelTemporaryCoordinates(currentDrawingArea.id);
                  }

                  // 취소 시 그려진 영역들을 모두 제거
                  setDrawnAreas([]);
                  setCurrentPath([]);
                  setCurrentRectangle(null);
                  setRectangleStart(null);
                  setCurrentDrawingArea(null);
                  redrawCanvas();
                  setShowInfoModal(false);
                  setModalObjectInfo(null);
                  toast.info('등록이 취소되었습니다. 그��진 영역이 삭제되었습니다.');
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (modalObjectInfo && video && onAddNewObject) {
                    // 그리기 영역을 ���로운 객����로 추가 - 팝업창에서 입력한 모든 ��보 포함
                    const addedObjectId = onAddNewObject(video.id, modalObjectInfo.name, {
                      code: modalObjectInfo.code,
                      additionalInfo: modalObjectInfo.additionalInfo,
                      dlReservoirDomain: modalObjectInfo.dlReservoirDomain,
                      category: modalObjectInfo.category,
                      videoCurrentTime: modalObjectInfo.videoCurrentTime,
                    });

                    // 그리기 영역��� 객체 매핑 저장
                    if (currentDrawingArea && addedObjectId) {
                      setObjectDrawingMap(prev => new Map(prev.set(addedObjectId, currentDrawingArea)));
                    }

                    // 좌표를 ��체명과 연결
                    if (currentDrawingArea && addedObjectId) {
                      const linked = await linkCoordinatesWithObject(currentDrawingArea.id, modalObjectInfo.name);
                      if (linked) {
                        console.log(`🔗 Coordinates linked: ${currentDrawingArea.id} -> ${modalObjectInfo.name}`);
                      }
                    }

                    toast.success('새로운 객체가 추가되었�����니다.');
                    setShowInfoModal(false);
                    setModalObjectInfo(null);
                    setCurrentDrawingArea(null);
                  }
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#10b981",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API 응답 상세 정보 모달 */}
      {showApiResponseModal && apiResponseData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowApiResponseModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: `3px solid ${apiResponseData.success ? '#10b981' : '#ef4444'}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>
                {apiResponseData.success ? "✅" : "❌"}
              </div>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: apiResponseData.success ? "#059669" : "#dc2626",
                  margin: 0,
                  marginBottom: "8px",
                }}
              >
                {apiResponseData.success ? "API 전송 성공!" : "API 전송 실패"}
              </h3>
              <p
                style={{
                  fontSize: "0.95rem",
                  color: "#6b7280",
                  margin: 0,
                }}
              >
                {apiResponseData.message}
              </p>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#374151" }}>그리기 타입:</strong>
                <span style={{ marginLeft: "8px", color: "#6b7280" }}>
                  {apiResponseData.drawingType}
                </span>
              </div>

              {apiResponseData.coordinates && (
                <div style={{ marginBottom: "12px" }}>
                  <strong style={{ color: "#374151" }}>좌표 정보:</strong>
                  <span style={{ marginLeft: "8px", color: "#6b7280", fontFamily: "monospace" }}>
                    {apiResponseData.coordinates}
                  </span>
                </div>
              )}

              {apiResponseData.videoTime !== undefined && (
                <div style={{ marginBottom: "12px" }}>
                  <strong style={{ color: "#374151" }}>동영상 시간:</strong>
                  <span style={{ marginLeft: "8px", color: "#6b7280" }}>
                    {formatTime(apiResponseData.videoTime)}
                  </span>
                </div>
              )}

              {apiResponseData.timestamp && (
                <div>
                  <strong style={{ color: "#374151" }}>처리 시간:</strong>
                  <span style={{ marginLeft: "8px", color: "#6b7280" }}>
                    {apiResponseData.timestamp}
                  </span>
                </div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                onClick={() => setShowApiResponseModal(false)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "6px",
                  border: "none",
                  background: apiResponseData.success ? "#10b981" : "#ef4444",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
