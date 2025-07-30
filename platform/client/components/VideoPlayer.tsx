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

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawnArea {
  id: string;
  points: DrawingPoint[];
  color: string;
  type: "path" | "rectangle";
  startPoint?: DrawingPoint;
  endPoint?: DrawingPoint;
}

interface VideoInfo {
  id: string;
  file: File;
  duration: number;
  currentTime: number;
  detectedObjects: any[];
  totalObjectsCreated: number;
}

interface DetectedObject {
  id: string;
  name: string;
  confidence: number;
  selected: boolean;
  code?: string;
  additionalInfo?: string;
  dlReservoirDomain?: string;
  category?: string;
}

interface VideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoInfo | null;
  detectedObjects: DetectedObject[];
  hasRunDetection: boolean; // 추가
  onDownloadWebVTT: () => void;
  onRunObjectDetection: (videoId: string) => void;
  onAddNewObject: (videoId: string, objectName?: string) => string;
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
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
  const [drawingMode, setDrawingMode] = useState<"free" | "rectangle">(
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 캔버스 초기화 함수
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
  }, [drawnAreas]);

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

  const saveDrawingsAndDownloadWebVTT = () => {
    const currentDuration = videoDuration;
    const currentFrames = totalFrames;

    const addedObjects: string[] = [];
    drawnAreas.forEach((area, index) => {
      const objectName = `Object(${detectedObjects.length + index + 1})`;
      if (video && onAddNewObject) {
        const addedObjectName = onAddNewObject(video.id, objectName);
        addedObjects.push(addedObjectName);
      }
    });

    if (addedObjects.length > 0) {
      toast.success(
        `${addedObjects.length}개의 새로운 객체가 탐지되었습니다: ${addedObjects.join(", ")}`,
      );
    }

    setDrawnAreas([]);
    setHasObjectChanges(false);

    // WebVTT 다운로드도 함께 실행
    onDownloadWebVTT();

    // 저장 및 다운로드 완료 메시지 표시
    toast.success("���장 및 WebVTT 다운로드가 완료되었습니다.");

    console.log("저장 후 비디오 정보:", {
      duration: currentDuration,
      frames: currentFrames,
      currentVideoDuration: videoDuration,
      currentTotalFrames: totalFrames,
    });
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

      if (editedObjectName) updates.name = editedObjectName;
      if (editedObjectCode) updates.code = editedObjectCode;
      if (editedObjectInfo) updates.additionalInfo = editedObjectInfo;
      if (editedDlReservoirDomain)
        updates.dlReservoirDomain = editedDlReservoirDomain;
      if (editedCategory) updates.category = editedCategory;

      onUpdateObject(video.id, selectedObjectId, updates);
      setHasObjectChanges(true);
      toast.success(`객체 정보가 업데이트되었습니다.`);
    }
    setIsEditing(false);
  };

  // 뒤로가기 핸들러 - 탐지된 객체 목록으로만 이동하고 버튼 활성화 상태 유지
  const handleBackToObjectList = () => {
    setSelectedObjectId(null);
    setIsEditing(false);
    // showObjectList true로 유지하여 "탐지된 객체" 버튼 활성화 상태 유지
  };

  // 삭제 확인 모달 관련 핸들러들
  const handleDeleteClick = (objectId: string) => {
    setObjectToDelete(objectId);
    setShowDeleteConfirmModal(true);
    setDeleteConfirmed(false);
  };

  const confirmDelete = () => {
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
      } else {
        // 개별 객체 삭제 처리
        onDeleteObject(video.id, objectToDelete);
        setHasObjectChanges(true);
        handleBackToObjectList();
        toast.success("객체가 삭제되었습니다.");
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
      // ��기에는 객체 목록을 닫은 상태로 시작
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
                <div style={{ display: "flex", gap: "8px" }}>
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
                      setDrawingMode("free");
                      setIsErasing(false);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontWeight: "500",
                      cursor: "pointer",
                      background:
                        drawingMode === "free" && !isErasing
                          ? "#3b82f6"
                          : "white",
                      color:
                        drawingMode === "free" && !isErasing
                          ? "white"
                          : "#374151",
                      fontSize: "0.85rem",
                    }}
                  >
                    자유그리기
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
                onClick={saveDrawingsAndDownloadWebVTT}
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
                최종저장 & WebVTT다운
              </button>
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
                  : "🎨 그���기 모드 활성화 - 마우스로 드래그하여 영역을 그려보세요"}
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
                height: "85vh",
                maxHeight: "900px",
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
                      // 처음 클릭 시 객체 목록 열기
                      setShowObjectList(true);
                      setSelectedObjectId(null);
                    } else if (showObjectList && !selectedObjectId) {
                      // 객체 목목이 열려있을 때 닫기
                      setShowObjectList(false);
                    } else if (selectedObjectId) {
                      // 객체 상세 정보에서 닫기
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

              {/* 객체 탐지 진행도 */}
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
                      ? "선택된 객체 정보"
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
                      title="새로고침"
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
                  maxHeight: "450px",
                  minHeight: "200px",
                  display: "block",
                  paddingRight: "8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "12px",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#cbd5e0 #f7fafc",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {showObjectList && !selectedObjectId ? (
                  !hasRunDetection ? (
                    // 탐지 실행 전 안내문구
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
                      gap: "12px",
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
                            padding: "12px",
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

                      {/* 삭제제 버튼을 스크롤 영역 밖으로 이동 */}
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
                              ✅ {selectedObjectIds.length}개 객체가 선택���
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
                            padding: "20px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            maxHeight: "60vh", // 고정 height 대신 maxHeight로 변경 (예: 60vh)
                            minHeight: "320px", // 너무 작아지지 않게 최소값도 지정
                            overflowY: "auto",
                            overflowX: "hidden",
                            scrollbarWidth: "thin",
                            scrollbarColor: "#ef4444 #f8fafc",
                            WebkitOverflowScrolling: "touch",
                            touchAction: "pan-y",
                          }}
                        >
                          {/* 이름 섹션 */}
                          <div style={{ marginBottom: "20px" }}>
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
                                  <option value="GTIN">GTIN</option>
                                  <option value="GLN">GLN</option>
                                  <option value="GIAI">GIAI</option>
                                  <option value="GSIN">GSIN</option>
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
                          <div style={{ marginBottom: "20px" }}>
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
                          <div style={{ marginBottom: "20px" }}>
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

                          {/* 추가정보 섹션 */}
                          <div style={{ marginBottom: "20px" }}>
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
                                  "AI가 자동으로 탐지한 객체입니다."}
                              </div>
                            )}
                          </div>

                          {/* 수정 버튼 - 객체 정보 하단으로 이동 */}
                          <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
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
                              {isEditing ? "수���완료" : "수정"}
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
                      객체 목록을 확인해���세요
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
                ⚠️ 체크박스를 선택해야 ��제할 수 있습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
