// Test script for VTT coordinate functionality
// This script tests the new VTT format with coordinates

async function testVttGeneration() {
  console.log('🧪 Testing VTT generation with new format...');
  
  const testData = {
    videoId: "test-video-123",
    videoFileName: "test-video.mp4",
    objects: [
      {
        id: "test-obj-1",
        name: "Test Object 1",
        code: "CODE_RECT-123",
        category: "기타", 
        dlReservoirDomain: "http://www.naver.com",
        additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
        finallink: "http://www.naver.com/00/CODE_RECT-123",
        confidence: 0.95,
        videoCurrentTime: 5.5,
        position: {
          type: "rectangle",
          startPoint: { x: 100, y: 100 },
          endPoint: { x: 200, y: 200 }
        },
        polygon: null
      },
      {
        id: "test-obj-2", 
        name: "Test Object 2",
        code: "CODE_RECT-456",
        category: "기타",
        dlReservoirDomain: "http://www.example.com",
        additionalInfo: "클릭으로 생성된 객체입니다.",
        finallink: "http://www.example.com/00/CODE_RECT-456",
        confidence: 0.87,
        videoCurrentTime: 10.2,
        position: {
          type: "click",
          clickPoint: { x: 150, y: 150 }
        },
        polygon: null
      }
    ],
    duration: 30,
    timestamp: Date.now()
  };

  try {
    const response = await fetch('http://localhost:8080/api/webvtt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ VTT generation successful!');
      console.log('📄 Result:', result);
      
      // Now test reading the coordinates back
      console.log('\n🔍 Testing coordinate reading...');
      const coordResponse = await fetch(`http://localhost:8080/api/vtt-coordinates?videoId=${testData.videoId}&videoFileName=${encodeURIComponent(testData.videoFileName)}`);
      
      if (coordResponse.ok) {
        const coordResult = await coordResponse.json();
        console.log('✅ Coordinate reading successful!');
        console.log('📍 Coordinates:', JSON.stringify(coordResult.coordinates, null, 2));
      } else {
        console.log('❌ Coordinate reading failed:', await coordResponse.text());
      }
      
    } else {
      console.log('❌ VTT generation failed:', await response.text());
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

// Run the test
testVttGeneration();
