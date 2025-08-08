import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { normalizeFileName, DATA_DIR } from "../utils/file-utils";

/**
 * ===================================
 * 📝 파일명 충돌 체크 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 업로드 전 파일명 충돌 여부 확인
 * 2. 충돌 시 자동으로 새로운 파일명 제안
 * 3. (1), (2), (3) 형태로 번호 증가
 */

/**
 * 파일명 충돌 체크 및 새 이름 제안
 * 
 * @route GET /api/check-filename?filename=example.mp4
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 */
export const handleFilenameCheck: RequestHandler = (req, res) => {
  try {
    const { filename } = req.query as { filename: string };

    console.log(`🔍 파일명 체크 API 호출됨!!! filename: "${filename}"`);

    if (!filename) {
      console.log(`❌ filename 파라미터가 없음`);
      return res.status(400).json({
        success: false,
        message: 'filename 파라미터가 필요합니다.'
      });
    }

    console.log(`📝 파일명 체크 시작: "${filename}"`);

    const ext = path.extname(filename);
    console.log(`📄 확장자: "${ext}"`);

    const baseName = path.basename(filename, ext);
    console.log(`📂 기본 이름: "${baseName}"`);

    const normalizedBaseName = normalizeFileName(baseName);
    console.log(`🔄 정규화된 이름: "${normalizedBaseName}"`);

    // 기본 폴더명 체크
    const baseFolderPath = path.join(DATA_DIR, normalizedBaseName);
    console.log(`📁 체크할 폴더 경로: "${baseFolderPath}"`);

    let exists = fs.existsSync(baseFolderPath);
    console.log(`📂 폴더 존재 여부: ${exists}`);

    if (!exists) {
      // 충돌 없음
      console.log(`✅ 충돌 없음 - 원본 파일명 사용: "${filename}"`);
      return res.json({
        success: true,
        exists: false,
        originalName: filename,
        suggestedName: filename
      });
    }

    // 충돌 발생 - 새로운 이름 찾기
    let counter = 1;
    let newFileName: string;
    let newFolderName: string;
    
    do {
      newFileName = `${baseName}(${counter})${ext}`;
      newFolderName = `${normalizedBaseName}(${counter})`;
      const newFolderPath = path.join(DATA_DIR, newFolderName);
      
      if (!fs.existsSync(newFolderPath)) {
        break;
      }
      counter++;
    } while (counter <= 100); // 최대 100개까지

    console.log(`📁 파일명 충돌 해결: ${filename} → ${newFileName}`);

    res.json({
      success: true,
      exists: true,
      originalName: filename,
      suggestedName: newFileName,
      conflictCount: counter
    });

  } catch (error) {
    console.error('❌ 파일명 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '파일명 체크 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
