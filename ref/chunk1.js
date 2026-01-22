// Global variables
let boreholeData = [];
let verificationResults = [];
let analysisResults = [];
let visualizationData = { contour_data: {}, '3d_data': {} };
let soilNameCorrections = []; // 토질명 변환 로그 저장
let currentStep = 1;
// currentRegionHint는 chunk6.js에서 선언됨 (window.currentRegionHint로 접근)

/**
 * 프로젝트 이름에서 지역 힌트 추출
 * @param {string} projectName - 프로젝트 이름
 * @returns {string|null} 추출된 지역명
 */
function extractRegionHintFromProject(projectName) {
    if (!projectName) return null;

    const regionKeywords = [
        '양산', '울산', '부산', '경남', '포항', '경주', '김해', '창원',  // 동부
        '인천', '송도', '김포', '강화',  // 서부
        '서울', '경기', '수원', '성남', '용인', '안양', '대전', '세종', '충청', '충남', '충북',  // 중부
        '울릉', '독도'  // 동해
    ];

    for (const region of regionKeywords) {
        if (projectName.includes(region)) {
            console.log(`[RegionHint] Detected region: ${region} from project: ${projectName}`);
            window.currentRegionHint = region;  // 전역 변수 사용
            return region;
        }
    }

    return null;
}

// Soil parameters
let currentSoilParams = {
    c: 20,
    phi: 30,
    gamma: 18,
    Es: 15000
};

// Bearing capacity factors
const bearingCapacityFactors = {
    0: {Nc: 5.14, Nq: 1.00, Ngamma: 0.00},
    5: {Nc: 6.49, Nq: 1.57, Ngamma: 0.45},
    10: {Nc: 8.35, Nq: 2.47, Ngamma: 1.22},
    15: {Nc: 10.98, Nq: 3.94, Ngamma: 2.65},
    20: {Nc: 14.83, Nq: 6.40, Ngamma: 5.39},
    25: {Nc: 20.72, Nq: 10.66, Ngamma: 10.88},
    30: {Nc: 30.14, Nq: 18.40, Ngamma: 22.40},
    35: {Nc: 46.12, Nq: 33.30, Ngamma: 48.03},
    40: {Nc: 75.31, Nq: 64.20, Ngamma: 109.41}
};

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const tabButtons = document.querySelectorAll('.nav-tab');
    tabButtons.forEach(btn => {
        if (btn.textContent.includes(getTabTitle(tabName))) {
            btn.classList.add('active');
        }
    });
    
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    } else {
        console.error('Target tab not found:', 'tab-' + tabName);
    }
    
    updateProgressIndicator(tabName);
    
    // 말뚝 지지력 계산 탭으로 전환 시 시추공별 입력 테이블 표시
    if (tabName === 'pile') {
        setTimeout(() => {
            showBoreholeInputTable();
        }, 100);
    }
    
    // 시각화 탭으로 전환 시 시각화 데이터 생성 및 표시
    if (tabName === 'visualization') {
        setTimeout(() => {
            if (boreholeData.length > 0 && Object.keys(visualizationData.contour_data).length === 0) {
                generateVisualizationData();
            }
            // Show data table by default
            switchVisualizationTab('tabData');
        }, 100);
    }
    
    // 종합 결과 탭으로 전환 시 종합 결과 표시
    if (tabName === 'results') {
        setTimeout(() => {
            displayCombinedResults();
        }, 100);
    }
}

function getTabTitle(tabName) {
    const titles = {
        'upload': 'Step 1',
        'verification': 'Step 2',
        'weaksoil': 'Step 3',
        'boulder': 'Step 4',
        'analysis': 'Step 5',
        'visualization': 'Step 6',
        'pile': 'Step 7',
        'results': 'Step 8'
    };
    return titles[tabName] || '';
}

function updateProgressIndicator(activeTab) {
    const steps = ['upload', 'verification', 'weaksoil', 'boulder', 'analysis', 'pile', 'results'];
    const activeIndex = steps.indexOf(activeTab);
    
    steps.forEach((step, index) => {
        const stepEl = document.querySelector(`.progress-step:nth-child(${index * 2 + 1})`);
        if (index < activeIndex) {
            stepEl.className = 'progress-step completed';
        } else if (index === activeIndex) {
            stepEl.className = 'progress-step active';
        } else {
            stepEl.className = 'progress-step pending';
        }
    });
}

// 지반공학 표준 용어 사전 구축
const GEOTECHNICAL_DICTIONARY = {
    // 주요 토질명
    primary: [
        "붕적층", "충적층", "퇴적층", "매립층",
        "풍화토", "풍화잔류토", "풍화잔류토층", "풍화암", "연암", "경암", "보통암",
        "점토", "실트", "모래", "자갈", "사질토", "점질토",
        "이암", "사암", "셰일", "화강암", "편마암", "편암",
        "암반", "기반암", "풍화암반", "완전풍화", "심한풍화"
    ],
    
    // 흔한 오타 패턴 (유사도 기반)
    typoPatterns: {
        "봉적층": "붕적층",  // ㅂ → ㅂㅇ
        "봉화토": "풍화토",  // ㅂ → ㅍ
        "연악": "연암",      // ㅇ → ㅇㅁ
        "정토": "점토",      // ㅈ → ㅈㅈ
        "사질도": "사질토",
        "질토": "점토",
        "모레": "모래",
        "풍화잔류토": "풍화잔류토층",
        "풍화잔류토층": "풍화잔류토층",
        "풍화암반": "풍화암",
        "완전풍화": "풍화암",
        "심한풍화": "풍화암"
    },
    
    // 문맥 기반 검증
    contextRules: {
        "붕적층": {
            expectedObservations: ["느슨", "각진", "암편", "전석", "호박돌"],
            unexpectedInRock: true,  // 기반암 심도에서 나오면 안됨
            typicalDepth: "0~5m"     // 일반적으로 얕은 심도
        },
        "풍화잔류토층": {
            expectedObservations: ["실트질", "모래", "D-6", "느슨", "조밀"],
            typicalDepth: "0~15m"
        },
        "풍화암": {
            expectedObservations: ["풍화암반", "완전풍화", "심한풍화", "D-4", "D-5"],
            typicalDepth: "10m+"
        }
    }
};

// 한글 자모 분리 함수
function decomposeHangul(str) {
    const result = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const base = code - 0xAC00;
            const cho = Math.floor(base / 588);
            const jung = Math.floor((base % 588) / 28);
            const jong = base % 28;
            
            result.push(String.fromCharCode(0x1100 + cho));
            result.push(String.fromCharCode(0x1161 + jung));
            if (jong > 0) {
                result.push(String.fromCharCode(0x11A7 + jong));
            }
        } else {
            result.push(str[i]);
        }
    }
    return result.join('');
}

// 레벤슈타인 거리 계산
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// 한글 자모 분리 유사도 계산
function calculateSimilarity(str1, str2) {
    const jamo1 = decomposeHangul(str1);
    const jamo2 = decomposeHangul(str2);
    const distance = levenshteinDistance(jamo1, jamo2);
    const maxLen = Math.max(jamo1.length, jamo2.length);
    return 1 - (distance / maxLen);
}

// 유사한 용어 찾기
function findSimilarTerms(input, dictionary) {
    return dictionary
        .map(term => ({
            term: term,
            similarity: calculateSimilarity(input, term),
            distance: levenshteinDistance(input, term)
        }))
        .filter(item => item.similarity > 0.7)
        .sort((a, b) => b.similarity - a.similarity);
}

// 문맥 기반 검증
function validateByContext(soilName, observation, depth) {
    const warnings = [];
    let suggestion = soilName;
    
    // 깊이 기반 강제 변환 로직 제거 (실제 지반 조건 존중)
    // 기존: 붕적층(>10m), 풍화암(<5m) 체크 -> 제거됨
    
    return { suggestion, warnings };
}

// 토질명 검증 및 수정
function validateAndCorrectSoilName(soilName, observation, depth, elevation) {
    // STEP 1: 표준 용어 직접 매칭
    if (GEOTECHNICAL_DICTIONARY.primary.includes(soilName)) {
        return {
            corrected: soilName,
            confidence: "HIGH",
            action: "PASS"
        };
    }
    
    // STEP 2: 오타 패턴 매칭
    if (GEOTECHNICAL_DICTIONARY.typoPatterns[soilName]) {
        return {
            original: soilName,
            corrected: GEOTECHNICAL_DICTIONARY.typoPatterns[soilName],
            confidence: "HIGH",
            action: "AUTO_CORRECT",
            reason: "알려진 오타 패턴"
        };
    }
    
    // STEP 3: 유사도 기반 추천
    const suggestions = findSimilarTerms(soilName, GEOTECHNICAL_DICTIONARY.primary);
    
    if (suggestions.length > 0 && suggestions[0].similarity > 0.85) {
        return {
            original: soilName,
            corrected: suggestions[0].term,
            confidence: "MEDIUM",
            action: "SUGGEST",
            alternatives: suggestions.slice(0, 3),
            reason: `유사도 ${(suggestions[0].similarity * 100).toFixed(0)}%`
        };
    }
    
    // STEP 4: 문맥 기반 검증
    const contextCheck = validateByContext(soilName, observation, depth);
    
    return {
        original: soilName,
        corrected: contextCheck.suggestion,
        confidence: "LOW",
        action: "MANUAL_REVIEW",
        warnings: contextCheck.warnings
    };
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('active');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);

            // 토질명 자동 변환 적용
            const correctedData = applySoilNameCorrection(jsonData);

            processData(correctedData);
            if (loadingEl) loadingEl.classList.remove('active');

            // Show data preview and switch to verification tab
            showDataPreview();
            switchTab('verification');

            // Auto-run all analyses
            performVerification();
            // Auto-run Step 3, Step 4, Step 5, and Step 6 after a short delay
            setTimeout(() => {
                if (boreholeData.length > 0) {
                    runWeakSoilAnalysis();
                    runBoulderDetection();
                    performSimpleFoundationAssessment();
                    // Generate visualization data
                    generateVisualizationData();
                    // Auto-run detailed foundation analysis if conditions are met
                    setTimeout(() => {
                        const foundationWidth = document.getElementById('foundationWidth');
                        const foundationLength = document.getElementById('foundationLength');
                        if (foundationWidth && foundationLength) {
                            runCompleteAnalysis();
                        }
                    }, 1000);
                }
            }, 500);
        } catch (error) {
            alert('JSON 파일 파싱 오류: ' + error.message);
            if (loadingEl) loadingEl.classList.remove('active');
        }
    };
    reader.readAsText(file);
}

// JSON 데이터에 토질명 자동 변환 적용
function applySoilNameCorrection(jsonData) {
    const correctedData = JSON.parse(JSON.stringify(jsonData)); // Deep copy
    const correctionLog = [];
    
    if (correctedData.extracted_data) {
        correctedData.extracted_data.forEach(borehole => {
            if (borehole.soil_data) {
                borehole.soil_data.forEach(layer => {
                    const originalName = layer.soil_name;
                    const observation = layer.observation || '';
                    const depth = layer.depth_range || '';
                    const elevation = layer.Elevation || '';
                    
                    const correction = validateAndCorrectSoilName(originalName, observation, depth, elevation);
                    
                    if (correction.action !== 'PASS') {
                        layer.soil_name = correction.corrected;
                        correctionLog.push({
                            holeNo: borehole.hole_no,
                            depth: depth,
                            original: originalName,
                            corrected: correction.corrected,
                            confidence: correction.confidence,
                            reason: correction.reason || '문맥 기반 추정',
                            warnings: correction.warnings || []
                        });
                    }
                });
            }
        });
    }
    
    // 전역 변수에 변환 로그 저장
    soilNameCorrections = correctionLog;
    
    // 변환 로그를 콘솔에 출력 (개발자용) - 필요시 주석 해제
    // if (correctionLog.length > 0) {
    //     console.log('토질명 자동 변환 결과:', correctionLog);
    // }
    
    return correctedData;
}

// ==========================================
// 🌍 Geotechnical Ontology (지반공학 온톨로지)
// ==========================================
// 대한민국 지반공학 전문가 수준의 지반 분류 체계 정의
const GeotechnicalOntology = {
    // 1. 암반 (Bedrock) - 기초 지지층으로 간주되는 모든 지질층
    Bedrock: {
        // 1.1 암질 및 강도 기준 (Rock Quality & Strength)
        RockQuality: [
            "풍화암", "풍화암층", "연암", "보통암", "경암", "극경암",
            "Weathered Rock", "Soft Rock", "Medium Rock", "Hard Rock", "Fresh Rock",
            "Fractured Rock", "Bedrock", "Rock Mass"
        ],
        // 1.2 풍화 등급 (Weathering Grade) - 암반으로 간주되는 풍화 단계
        WeatheringGrade: [
            "완전풍화", "심한풍화", "보통풍화", "약간풍화", "신선함",
            "Completely Weathered", "Highly Weathered", "Moderately Weathered", "Slightly Weathered", "Fresh",
            "CW", "HW", "MW", "SW", "FR"
        ],
        // 1.3 일반 지질 용어 (General Terms)
        GeneralTerms: [
            "기반암", "암반", "암층", "Base Rock", "Basement Rock", "Lithified"
        ],
        // 1.4 암석 종류 (Rock Types) - 암석명이 명시된 경우
        RockTypes: [
            // 화성암
            "화강암", "현무암", "안산암", "유문암", "섬록암", "반려암", "암맥",
            "Granite", "Basalt", "Andesite", "Rhyolite", "Diorite", "Gabbro", "Dyke",
            // 변성암
            "편마암", "편암", "천매암", "규암", "대리암",
            "Gneiss", "Schist", "Phyllite", "Quartzite", "Marble",
            // 퇴적암
            "이암", "셰일", "사암", "석회암", "역암",
            "Mudstone", "Shale", "Sandstone", "Limestone", "Conglomerate"
        ],
        // 1.5 복합어 처리 (Suffixes indicating rock layer)
        Suffixes: ["암층", "암반", "Rock Layer"]
    },
    
    // 2. 토사 (Soil) - 암반이 아님 (배제 조건)
    Soil: {
        Types: [
            "풍화토", "잔류토", "붕적토", "충적토", "매립", "성토", "표토",
            "Weathered Soil", "Residual Soil", "Colluvium", "Alluvium", "Fill", "Topsoil",
            "모래", "자갈", "실트", "점토", "Sand", "Gravel", "Silt", "Clay"
        ]
    }
};

// 온톨로지 기반 기반암 판정 함수 (Ontology-based Bedrock Reasoning)
function isBedrockLayer(soilName) {
    if (!soilName) return false;
    const name = soilName.trim().toLowerCase();
    
    // 1단계: 명확한 토사(Soil) 키워드가 주를 이루는지 확인 (Negative Filtering)
    // 예: "화강풍화토"는 "화강암"이 있지만 "풍화토"이므로 암반이 아님
    const soilKeywords = GeotechnicalOntology.Soil.Types;
    for (const keyword of soilKeywords) {
        if (name.includes(keyword.toLowerCase())) {
            // 예외 처리: "풍화토"와 "풍화암"이 같이 있는 경우 (예: "풍화토 및 풍화암")
            // "풍화암" 키워드가 있으면 일단 2단계로 넘어가서 확인
            const hasRockKeyword = GeotechnicalOntology.Bedrock.RockQuality.some(k => name.includes(k.toLowerCase()));
            if (hasRockKeyword) continue; 
            
            return false; // 순수 토사로 판정
        }
    }

    // 2단계: 암반(Bedrock) 온톨로지 매칭 (Positive Reasoning)
    const bedrockGroups = [
        GeotechnicalOntology.Bedrock.RockQuality,
        GeotechnicalOntology.Bedrock.WeatheringGrade,
        GeotechnicalOntology.Bedrock.GeneralTerms,
        GeotechnicalOntology.Bedrock.RockTypes,
        GeotechnicalOntology.Bedrock.Suffixes
    ];
    
    for (const group of bedrockGroups) {
        for (const keyword of group) {
            if (name.includes(keyword.toLowerCase())) {
                return true; // 암반으로 판정
            }
        }
    }
    
    return false;
}

function findBedrockLevel(soilData, groundSurfaceLevel) {
    for (let layer of soilData) {
        const soilName = layer.soil_name || '';
        
        // 온톨로지 기반 판정 사용
        if (isBedrockLayer(soilName)) {
            // Use depth_range to calculate bedrock level: 지표고 - 깊이
            if (layer.depth_range) {
                const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                if (depthMatch && groundSurfaceLevel) {
                    const depthStart = parseFloat(depthMatch[1]); // 기반암 시작 깊이
                    // 기반암 상단 레벨 = 지표고 - 기반암 시작 깊이
                    return groundSurfaceLevel - depthStart;
                }
            }
            // Fallback: try Elevation field if depth_range parsing fails
            if (layer.Elevation) {
            const elevationRange = layer.Elevation.split('~');
                if (elevationRange.length === 2) {
                    const topElevationStr = elevationRange[1].replace('m', '').trim();
                    const bottomElevationStr = elevationRange[0].replace('m', '').trim();
                    const topElevation = parseFloat(topElevationStr);
                    const bottomElevation = parseFloat(bottomElevationStr);
                    // Return the higher elevation (top of bedrock layer)
                    return Math.max(topElevation, bottomElevation);
                }
            }
        }
    }
    return null;
}

// 풍화암 출현 깊이 찾기 (Weathered Rock Depth)
function findWeatheredRockDepth(soilData) {
    for (let layer of soilData) {
        const soilName = layer.soil_name || '';
        const name = soilName.trim().toLowerCase();
        
        // 풍화암 키워드 매칭
        if (name.includes('풍화암') || name.includes('weathered rock')) {
            if (layer.depth_range) {
                const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                if (depthMatch) {
                    return parseFloat(depthMatch[1]); // 출현 깊이 반환
                }
            }
        }
    }
    return null;
}

// 연암 이상 암반 출현 깊이 찾기 (Soft Rock+ Depth)
function findSoftRockPlusDepth(soilData) {
    const softRockPlusKeywords = [
        "연암", "경암", "보통암", "극경암", "암반", "기반암",
        "soft rock", "medium rock", "hard rock", "fresh rock", "bedrock"
    ];
    
    for (let layer of soilData) {
        const soilName = layer.soil_name || '';
        const name = soilName.trim().toLowerCase();
        
        // 연암 이상 키워드 매칭 (풍화암 제외)
        if (softRockPlusKeywords.some(k => name.includes(k)) && !name.includes('풍화암')) {
            if (layer.depth_range) {
                const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                if (depthMatch) {
                    return parseFloat(depthMatch[1]); // 출현 깊이 반환
                }
            }
        }
    }
    return null;
}

// 풍화암 출현 레벨 찾기 (Weathered Rock Level) - 호환성 유지
function findWeatheredRockLevel(soilData, groundSurfaceLevel) {
    const depth = findWeatheredRockDepth(soilData);
    return depth !== null ? groundSurfaceLevel - depth : null;
}

// 연암 이상 암반 출현 레벨 찾기 (Soft Rock+ Level) - 호환성 유지
function findSoftRockPlusLevel(soilData, groundSurfaceLevel) {
    const depth = findSoftRockPlusDepth(soilData);
    return depth !== null ? groundSurfaceLevel - depth : null;
}

function processData(jsonData) {
    boreholeData = [];
    verificationResults = [];
    analysisResults = [];
    
    // 전역 변수로 저장 (말뚝 계산 모듈에서 사용)
    window.boreholeData = { boreholes: [] };

    const extractedData = jsonData.extracted_data || [];

    extractedData.forEach(borehole => {
        const holeNo = borehole.hole_no;
        const metadata = borehole.metadata;
        const soilData = borehole.soil_data || [];

        // Parse ground surface level (지표고)
        // Support multiple formats: Korean "E.L(+)51.05m", International "0.00 to 10.00 meters", plain numbers
        let groundSurfaceLevel = 0;
        if (metadata.GROUND_SURFACE_LEVEL) {
            const gslText = metadata.GROUND_SURFACE_LEVEL;

            // Format 1: Korean "E.L(+)51.05m", "E.L(-)51.05m", "EL(+) 39.08 m" (with spaces)
            const gslMatch = gslText.match(/E\.?L\s*\([+-]\)\s*(\d+\.?\d*)/i);
            if (gslMatch) {
                groundSurfaceLevel = parseFloat(gslMatch[1]);
            }
            // Format 2: Range format "0.00 to 10.00 meters" - use first value as surface level
            else if (gslText.toLowerCase().includes('to') || gslText.includes('~')) {
                const rangeMatch = gslText.match(/(\d+\.?\d*)\s*(?:to|~)\s*(\d+\.?\d*)/i);
                if (rangeMatch) {
                    // Use the first value as ground surface level (typically the starting elevation)
                    groundSurfaceLevel = parseFloat(rangeMatch[1]);
                }
            }
            // Format 3: Plain number with unit "10.5m" or "10.5 m" or "10.5 meters"
            else {
                const fallbackMatch = gslText.match(/(\d+\.?\d*)\s*(?:m|meters)?/i);
                if (fallbackMatch) {
                    groundSurfaceLevel = parseFloat(fallbackMatch[1]);
                }
            }
        } else if (metadata.Excavation_level) {
            // Old format: direct number
            groundSurfaceLevel = parseFloat(metadata.Excavation_level) || 0;
        }
        
        const excavationLevel = groundSurfaceLevel; // Use ground surface level as excavation level
        
        // 시추 종료 깊이 계산: 모든 soil_data 레이어의 depth_range에서 최대 깊이 찾기
        let maxDrilledDepth = 0;
        if (soilData.length > 0) {
            soilData.forEach(layer => {
                if (layer.depth_range) {
                    const depthRangeMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                    if (depthRangeMatch) {
                        const depthStart = parseFloat(depthRangeMatch[1]);
                        const depthEnd = parseFloat(depthRangeMatch[2]);
                        // 각 레이어의 시작과 끝 깊이 중 최대값 추적
                        maxDrilledDepth = Math.max(maxDrilledDepth, depthStart, depthEnd);
                    }
                }
            });
        }
        
        // DRILLING_DEPTH는 참고용으로만 사용 (검증 목적)
        // 실제 시추 종료 깊이는 soil_data의 depth_range에서 추출한 최대값 사용
        if (metadata.DRILLING_DEPTH) {
            const depthMatch = metadata.DRILLING_DEPTH.match(/(\d+\.?\d*)/);
            if (depthMatch) {
                const metadataDepth = parseFloat(depthMatch[1]);
                // DRILLING_DEPTH가 지표고의 50% 이상이면 무시 (잘못된 데이터)
                if (metadataDepth < groundSurfaceLevel * 0.5) {
                    // DRILLING_DEPTH와 실제 깊이 차이가 크면 경고 (선택사항)
                    // 실제 시추 깊이는 soil_data의 depth_range에서 정확히 계산되므로 경고는 정보성 메시지
                    if (Math.abs(metadataDepth - maxDrilledDepth) > 1.0) {
                        // console.warn는 개발자 도구에서만 보이므로 문제 없음
                        // 실제 시추 깊이는 maxDrilledDepth (soil_data에서 계산)가 사용됨
                    }
                }
            }
        }
        
        const drilledDepth = maxDrilledDepth;
        const boreholeEndElevation = excavationLevel - drilledDepth;

        const bedrockTopElevation = findBedrockLevel(soilData, groundSurfaceLevel);
        const weatheredRockElevation = findWeatheredRockLevel(soilData, groundSurfaceLevel);
        const softRockPlusElevation = findSoftRockPlusLevel(soilData, groundSurfaceLevel);
        const weatheredRockDepth = findWeatheredRockDepth(soilData);
        const softRockPlusDepth = findSoftRockPlusDepth(soilData);
        
        const excavationLevelInput = bedrockTopElevation ? bedrockTopElevation + 5 : excavationLevel - 5;
        const pileTipLevelInput = bedrockTopElevation ? bedrockTopElevation - 3 : excavationLevel - 10;

        // Parse ground water level (지하수위)
        // Support multiple formats:
        // - Korean: "GL(-)5.8m", "GL(+)5.8m"
        // - International: "27.25 m.", "27.25 meters", "5.8m"
        // - Plain: "-5.8m", "5.8m"
        let waterTableDepth = 5.0; // Default value (depth from ground surface)
        let waterTableElevation = null; // Elevation of water table
        const gwlText = metadata.GROUND_WATER_LEVEL || '';

        if (gwlText.includes('GL(') || gwlText.match(/GL\s*\(/i)) {
            // Korean format: "GL(-)5.8m", "GL(+)5.8m", "GL(-) 8.3 m" (with spaces)
            // GL(-) means below ground level, GL(+) means above ground level
            const gwlMatch = gwlText.match(/GL\s*\(([+-])\)\s*(\d+\.?\d*)/i);
            if (gwlMatch) {
                const sign = gwlMatch[1];
                const value = parseFloat(gwlMatch[2]);
                if (sign === '-') {
                    // Below ground level: depth from ground surface
                    waterTableDepth = value;
                    waterTableElevation = groundSurfaceLevel - value;
                } else {
                    // Above ground level: elevation
                    waterTableElevation = value;
                    waterTableDepth = Math.max(0, groundSurfaceLevel - value);
                }
            }
        } else {
            // International format: "27.25 m.", "5.8m", "-5.8m", "5.8 meters"
            const gwlMatch = gwlText.match(/(-?\d+\.?\d*)\s*(?:m\.?|meters?)?/i);
            if (gwlMatch) {
                const value = parseFloat(gwlMatch[1]);
                if (value < 0) {
                    // Negative value means depth below ground surface
                    waterTableDepth = Math.abs(value);
                    waterTableElevation = groundSurfaceLevel - waterTableDepth;
                } else {
                    // Positive value interpretation:
                    // - If value is much larger than typical depth (>20m), treat as depth from surface
                    // - If groundSurfaceLevel is 0 (sea level reference), value is likely absolute depth
                    // - Otherwise, use contextual heuristics
                    if (groundSurfaceLevel === 0 || groundSurfaceLevel < 10) {
                        // Ground level is near sea level or very low elevation
                        // The GWL value is likely depth from surface
                        waterTableDepth = value;
                        waterTableElevation = groundSurfaceLevel - value;
                    } else if (value < groundSurfaceLevel && value > groundSurfaceLevel * 0.5) {
                        // Value looks like elevation (between 50-100% of ground level)
                        waterTableElevation = value;
                        waterTableDepth = groundSurfaceLevel - value;
                    } else {
                        // Assume it's depth from ground surface
                        waterTableDepth = value;
                        waterTableElevation = groundSurfaceLevel - value;
                    }
                }
            }
        }
        
        // Extract SPT N values from soil_data samples, organized by soil name
        const sptData = [];
        let lastKnownNValue = null; // Track last known N value for extrapolation
        
        soilData.forEach((layer, idx) => {
            const soilName = layer.soil_name || 'Unknown';
            const layerSPTData = [];
            
            // Check if layer has samples with SPT data
            if (layer.samples && layer.samples.length > 0) {
                layer.samples.forEach(sample => {
                    // Extract N value from "Hits" field (e.g., "15/30" -> 15)
                    if (sample.Hits) {
                        const hitsMatch = sample.Hits.match(/(\d+)\s*\/\s*\d+/);
                        if (hitsMatch) {
                            const nValue = parseInt(hitsMatch[1]);
                            const depth = parseFloat(sample.Depth);
                            
                            layerSPTData.push({
                                depth: depth,
                                nValue: nValue,
                                soilLayer: idx,
                                soilName: soilName,
                                elevation: parseFloat(sample.Elevation)
                            });
                            
                            lastKnownNValue = nValue; // Update last known N value
                        }
                    }
                });
            }
            
            // If no samples in this layer, use estimated value or extend last known value
            if (layerSPTData.length === 0) {
                const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                if (depthMatch) {
                    const topDepth = parseFloat(depthMatch[1]);
                    const bottomDepth = parseFloat(depthMatch[2]);
                    
                    // Use last known N value if available, otherwise estimate
                    let nValue;
                    if (lastKnownNValue !== null) {
                        nValue = lastKnownNValue; // Extend last known value
                    } else {
                        // Estimate based on soil type
                        nValue = 15; // Default
                        if (soilName.includes('매립') || soilName.includes('Fill')) {
                            nValue = 10;
                        } else if (soilName.includes('풍화잔류') || soilName.includes('Weathered Residual')) {
                            nValue = 20;
                        } else if (soilName.includes('풍화암') || soilName.includes('Weathered Rock')) {
                            nValue = 35;
                        }
                        lastKnownNValue = nValue;
                    }
                    
                    // Add at mid-depth of layer
                    const midDepth = (topDepth + bottomDepth) / 2;
                    layerSPTData.push({
                        depth: midDepth,
                        nValue: nValue,
                        soilLayer: idx,
                        soilName: soilName,
                        elevation: NaN
                    });
                }
            }
            
            // Add all SPT data from this layer
            sptData.push(...layerSPTData);
        });
        
        // Don't estimate soil properties here - will be done during analysis
        // when we know the influence depth range
        
        // Parse coordinates for visualization
        const x = metadata.X_COORDINATE ? parseFloat(metadata.X_COORDINATE) : 0;
        const y = metadata.Y_COORDINATE ? parseFloat(metadata.Y_COORDINATE) : 0;
        
        const boreholeInfo = {
            holeNo,
            metadata: metadata, // metadata 추가
            soilData: soilData, // soilData 추가
            totalDepth: drilledDepth,
            groundElevation: excavationLevel,
            excavationLevel: excavationLevel,
            boreholeEndElevation: boreholeEndElevation.toFixed(2),
            bedrockTopElevation: bedrockTopElevation !== null ? bedrockTopElevation.toFixed(2) : '-',
            weatheredRockElevation: weatheredRockElevation !== null ? weatheredRockElevation.toFixed(2) : '-',
            softRockPlusElevation: softRockPlusElevation !== null ? softRockPlusElevation.toFixed(2) : '-',
            weatheredRockDepth: weatheredRockDepth !== null ? weatheredRockDepth : null,
            softRockPlusDepth: softRockPlusDepth !== null ? softRockPlusDepth : null,
            excavationLevelInput: excavationLevelInput.toFixed(2),
            pileTipLevelInput: pileTipLevelInput.toFixed(2),
            waterTableDepth: waterTableDepth,
            waterTableElevation: waterTableElevation !== null ? parseFloat(waterTableElevation.toFixed(2)) : null, // Keep as number (E.L 기준)
            waterTableText: gwlText,
            // Coordinates for visualization
            x: x,
            y: y,
            // For visualization compatibility (E.L 기준)
            excavation_level: parseFloat(excavationLevelInput),
            gwl_elevation: waterTableElevation !== null ? parseFloat(waterTableElevation.toFixed(2)) : null, // E.L 기준 지하수위
            bedrock_elevation: bedrockTopElevation !== '-' && bedrockTopElevation !== 'N/A' ? parseFloat(bedrockTopElevation) : null, // E.L 기준 기반암 레벨
            // Soil properties will be estimated during analysis
            soilParams: {
                c: 20,  // Temporary default
                phi: 30,
                gamma: 18,
                Es: 15000
            },
            // Foundation embedment depth (editable per borehole)
            foundationEmbedmentDepth: 1.0,
            // SPT N data
            sptData: sptData,
            // Estimation details will be set during analysis
            estimationDetails: null,
            // Track if user has manually modified soil parameters
            userModified: false
        };
        
        boreholeData.push(boreholeInfo);

        // 전역 변수도 업데이트 (말뚝 계산 모듈에서 사용)
        window.boreholeData.boreholes.push(boreholeInfo);
    });

    // ============================================================================
    // 데이터 로드 직후 좌표계 자동 감지 (핵심!)
    // ============================================================================
    if (boreholeData.length > 0 && typeof UniversalCoordinateTransformer !== 'undefined') {
        const coordinates = boreholeData.map(bh => ({
            x: parseFloat(bh.x) || 0,
            y: parseFloat(bh.y) || 0
        })).filter(c => c.x !== 0 && c.y !== 0);

        if (coordinates.length > 0) {
            // UniversalCoordinateTransformer 초기화
            if (!window.universalTransformer) {
                window.universalTransformer = new UniversalCoordinateTransformer();
            }

            // 메타데이터 전달 (대문자 필드명 지원)
            const firstBorehole = boreholeData[0];
            const metadata = firstBorehole?.metadata || {};
            const detection = window.universalTransformer.detectCoordinateSystem(coordinates, {
                location: metadata.LOCATION || metadata.location || '',
                projectName: metadata.PROJECT_NAME || metadata.projectName || '',
                LOCATION: metadata.LOCATION || '',
                PROJECT_NAME: metadata.PROJECT_NAME || ''
            });

            console.log('[processData] 좌표계 자동 감지 결과:', detection);

            // 한국 좌표계인 경우 - 자동 감지 모드 사용 (고정 EPSG 지정하지 않음)
            // 프로젝트 이름에서 지역 힌트 추출
            const projectName = metadata.PROJECT_NAME || metadata.projectName || '';
            const regionHint = extractRegionHintFromProject(projectName);

            if (typeof KoreanCoordinateTransformer !== 'undefined') {
                // 자동 감지 모드로 생성 (sourceEpsg = null)
                window.coordinateTransformer = new KoreanCoordinateTransformer();
                console.log('[processData] KoreanCoordinateTransformer 자동 감지 모드로 초기화, 지역 힌트:', regionHint);
            }
        }
    }
}

function showDataPreview() {
    const previewDiv = document.getElementById('dataPreview');
    previewDiv.style.display = 'block';
    
    // 토질명 변환 결과 통계
    const highConfidence = soilNameCorrections.filter(log => log.confidence === 'HIGH').length;
    const mediumConfidence = soilNameCorrections.filter(log => log.confidence === 'MEDIUM').length;
    const lowConfidence = soilNameCorrections.filter(log => log.confidence === 'LOW').length;
    const totalCorrections = soilNameCorrections.length;
    
    let correctionSummary = '';
    if (totalCorrections > 0) {
        correctionSummary = `
            <div class="alert-box info">
                <strong>🔧 토질명 자동 변환 완료</strong><br>
                총 ${totalCorrections}개의 토질명이 변환되었습니다.
                ${highConfidence > 0 ? `<br>• 높은 신뢰도: ${highConfidence}개` : ''}
                ${mediumConfidence > 0 ? `<br>• 중간 신뢰도: ${mediumConfidence}개` : ''}
                ${lowConfidence > 0 ? `<br>• 낮은 신뢰도: ${lowConfidence}개 (검토 필요)` : ''}
                ${totalCorrections > 0 ? `<br><button onclick="showCorrectionDetails()" class="btn btn-secondary btn-sm">변환 상세 내역 보기</button>` : ''}
            </div>
        `;
    }
    
    previewDiv.innerHTML = `
        <div class="alert-box success">
            <strong>데이터 로드 완료</strong><br>
            총 ${boreholeData.length}개의 시추공 데이터가 로드되었습니다.
        </div>
        ${correctionSummary}
    `;
}

// 토질명 변환 상세 내역 표시
function showCorrectionDetails() {
    if (soilNameCorrections.length === 0) {
        alert('변환된 토질명이 없습니다.');
        return;
    }
    
    const detailsHtml = soilNameCorrections.map(correction => {
        const confidenceColor = {
            'HIGH': '#28a745',
            'MEDIUM': '#ffc107', 
            'LOW': '#dc3545'
        }[correction.confidence];
        
        const warningsHtml = correction.warnings.length > 0 
            ? `<br><small style="color: #dc3545;">[주의] ${correction.warnings.join(', ')}</small>`
            : '';
        
        return `
            <tr>
                <td>${correction.holeNo}</td>
                <td>${correction.depth}</td>
                <td>${correction.original}</td>
                <td>${correction.corrected}</td>
                <td><span style="color: ${confidenceColor}; font-weight: bold;">${correction.confidence}</span></td>
                <td>${correction.reason}${warningsHtml}</td>
            </tr>
        `;
    }).join('');
    
    const modalHtml = `
        <div id="correctionModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 90%; max-height: 80%; overflow: auto;">
                <h3>토질명 변환 상세 내역</h3>
        <div class="borehole-table-wrapper">
            <table class="borehole-table">
                <thead>
                    <tr>
                        <th>시추공</th>
                        <th>깊이</th>
                        <th>원본</th>
                        <th>변환</th>
                        <th>신뢰도</th>
                        <th>사유</th>
                    </tr>
                </thead>
                <tbody>
                            ${detailsHtml}
                </tbody>
            </table>
                </div>
                <div style="text-align: right; margin-top: 15px;">
                    <button onclick="closeCorrectionModal()" class="btn btn-primary">닫기</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCorrectionModal() {
    const modal = document.getElementById('correctionModal');
    if (modal) {
        modal.remove();
    }
}

function performVerification() {
    verificationResults = [];
    
    boreholeData.forEach((data, index) => {
        verificationResults.push(verifyBorehole(data, index));
    });
    
    // 전역 변수로 저장 (말뚝 계산 모듈에서 사용)
    window.verificationResults = verificationResults;
    
    displayVerificationResults();
}

function verifyBorehole(data, index) {
    const holeNo = data.holeNo || `BH-${index + 1}`;
    const groundElevation = parseFloat(data.groundElevation);
    const boreholeEndElevation = parseFloat(data.boreholeEndElevation); // 시추 종료 레벨
    const excavationLevel = parseFloat(data.excavationLevelInput); // 굴착면 레벨 (사용자 입력)
    
    // 시추 종료 깊이 계산
    const boreholeEndDepth = groundElevation - boreholeEndElevation;
    
    const weatheredRockElevation = data.weatheredRockElevation !== '-' && data.weatheredRockElevation !== 'N/A' ? parseFloat(data.weatheredRockElevation) : null;
    const softRockPlusElevation = data.softRockPlusElevation !== '-' && data.softRockPlusElevation !== 'N/A' ? parseFloat(data.softRockPlusElevation) : null;
    const weatheredRockDepth = data.weatheredRockDepth !== null && data.weatheredRockDepth !== undefined ? parseFloat(data.weatheredRockDepth) : null;
    const softRockPlusDepth = data.softRockPlusDepth !== null && data.softRockPlusDepth !== undefined ? parseFloat(data.softRockPlusDepth) : null;

    let shallowResult = { pass: false, reason: '', required: 0 };

    // 1. 기본 조건: 시추 종료 레벨 < 굴착면 레벨 (굴착면보다 더 깊게 시추되어야 함)
    if (boreholeEndElevation >= excavationLevel) {
        shallowResult.pass = false;
        shallowResult.reason = '굴착면 미달';
        shallowResult.required = excavationLevel;
        return { holeNo: holeNo, shallow: shallowResult };
    }

    // 2. 암반 조건 검증 (연암 이상 존재 시 연암 기준 우선 적용)
    // Case 1: 굴착면이 기반암 상부에 위치 (excavationLevel > 암반레벨)
    // Case 2: 굴착면이 기반암에 걸침 (excavationLevel ≤ 암반레벨)

    const hasWeatheredRock = weatheredRockDepth !== null && weatheredRockElevation !== null;
    const hasSoftRock = softRockPlusDepth !== null && softRockPlusElevation !== null;
    const excavationDepth = groundElevation - excavationLevel; // 굴착 깊이

    // 암반 출현 레벨 결정 (풍화암 기준, 없으면 연암)
    const rockElevation = hasWeatheredRock ? weatheredRockElevation : (hasSoftRock ? softRockPlusElevation : null);

    if (hasWeatheredRock || hasSoftRock) {
        // Case 분류: 굴착면이 암반 상부인지, 암반 내에 있는지
        const isCase1 = excavationLevel > rockElevation; // Case 1: 굴착면이 기반암 상부

        let requiredLevel; // 요구 시추 종료 레벨
        let caseCode;
        let reason;

        if (isCase1) {
            // === Case 1: 굴착면이 기반암 상부에 위치 ===
            if (hasWeatheredRock && hasSoftRock) {
                // Case 1-C: 풍화암 + 연암 동시 존재 → ★ 연암 기준 우선
                caseCode = '1-C';
                requiredLevel = softRockPlusElevation - 3.0;
                const drilledAfterSoftRock = softRockPlusDepth !== null ? (boreholeEndDepth - softRockPlusDepth) : 0;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `연암+3m 만족 (${drilledAfterSoftRock.toFixed(2)}m 관입) [Case 1-C]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `연암+3m 미달 (부족: ${shortage.toFixed(2)}m) [Case 1-C]`;
                }
            } else if (hasSoftRock) {
                // Case 1-B: 연암만 존재
                caseCode = '1-B';
                requiredLevel = softRockPlusElevation - 3.0;
                const drilledAfterSoftRock = boreholeEndDepth - softRockPlusDepth;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `연암+3m 만족 (${drilledAfterSoftRock.toFixed(2)}m 관입) [Case 1-B]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `연암+3m 미달 (부족: ${shortage.toFixed(2)}m) [Case 1-B]`;
                }
            } else {
                // Case 1-A: 풍화암만 존재
                caseCode = '1-A';
                requiredLevel = weatheredRockElevation - 5.0;
                const drilledAfterWeatheredRock = boreholeEndDepth - weatheredRockDepth;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `풍화암+5m 만족 (${drilledAfterWeatheredRock.toFixed(2)}m 관입) [Case 1-A]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `풍화암+5m 미달 (부족: ${shortage.toFixed(2)}m) [Case 1-A]`;
                }
            }
        } else {
            // === Case 2: 굴착면이 기반암에 걸침 ===
            // 굴착면이 연암에 걸쳤는지 확인
            const isExcavationInSoftRock = hasSoftRock && excavationLevel <= softRockPlusElevation;

            if (isExcavationInSoftRock) {
                // Case 2-B: 굴착면이 연암에 걸침
                caseCode = '2-B';
                requiredLevel = excavationLevel - 3.0;
                const drilledBelowExcavation = excavationLevel - boreholeEndElevation;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `굴착면+3m 만족 (연암 걸침, ${drilledBelowExcavation.toFixed(2)}m 관입) [Case 2-B]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `굴착면+3m 미달 (연암 걸침, 부족: ${shortage.toFixed(2)}m) [Case 2-B]`;
                }
            } else if (hasWeatheredRock && hasSoftRock) {
                // Case 2-C: 풍화암에 걸침 + 연암 존재 → ★ 연암 기준 우선
                caseCode = '2-C';
                requiredLevel = softRockPlusElevation - 3.0;
                const drilledAfterSoftRock = boreholeEndDepth - softRockPlusDepth;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `연암+3m 만족 (풍화암 걸침, ${drilledAfterSoftRock.toFixed(2)}m 관입) [Case 2-C]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `연암+3m 미달 (풍화암 걸침, 부족: ${shortage.toFixed(2)}m) [Case 2-C]`;
                }
            } else {
                // Case 2-A: 풍화암에 걸침 (연암 없음)
                caseCode = '2-A';
                requiredLevel = excavationLevel - 5.0;
                const drilledBelowExcavation = excavationLevel - boreholeEndElevation;
                if (boreholeEndElevation <= requiredLevel) {
                    shallowResult.pass = true;
                    reason = `굴착면+5m 만족 (풍화암 걸침, ${drilledBelowExcavation.toFixed(2)}m 관입) [Case 2-A]`;
                } else {
                    shallowResult.pass = false;
                    const shortage = boreholeEndElevation - requiredLevel;
                    reason = `굴착면+5m 미달 (풍화암 걸침, 부족: ${shortage.toFixed(2)}m) [Case 2-A]`;
                }
            }
        }

        shallowResult.reason = reason;
        shallowResult.required = requiredLevel;
        shallowResult.caseCode = caseCode;

    } else {
        // 암반이 출현하지 않은 경우 (토사층만 있는 경우)
        // 굴착면 하부 3m 이상 시추 필요
        const requiredLevel = excavationLevel - 3.0;

        if (boreholeEndElevation <= requiredLevel) {
            shallowResult.pass = true;
            shallowResult.reason = '굴착면+3m 만족 (토사층)';
        } else {
            const shortage = boreholeEndElevation - requiredLevel;
            shallowResult.pass = false;
            shallowResult.reason = `굴착면+3m 미달 (토사층, 부족: ${shortage.toFixed(2)}m)`;
        }
        shallowResult.required = requiredLevel;
        shallowResult.caseCode = '토사';
    }

    return { holeNo: holeNo, shallow: shallowResult };
}

function displayVerificationResults() {
    const resultsDiv = document.getElementById('verificationResults');
    resultsDiv.style.display = 'block';

    const totalBoreholes = boreholeData.length;
    const shallowPassCount = verificationResults.filter(r => r.shallow.pass).length;
    const shallowFailCount = totalBoreholes - shallowPassCount;

    // 상태 배지 업데이트 (미검증 → 검증 완료)
    const statusBadge = document.getElementById('depthVerificationStatus');
    if (statusBadge) {
        statusBadge.textContent = '검증 완료';
        statusBadge.classList.add('success');
    }
    const failedBoreholes = boreholeData.filter((data) => {
        const result = verificationResults.find(r => r.holeNo === data.holeNo);
        return result && !result.shallow.pass;
    });

    // NA를 '-'로 변환하는 헬퍼 함수
    const formatValue = (value) => {
        if (value === null || value === undefined || value === 'N/A' || value === '') {
            return '-';
        }
        return value;
    };

    resultsDiv.innerHTML = `
        <div class="summary-cards" style="text-align: center;">
            <div class="summary-card">
                <h3>총 시추공</h3>
                <div class="value">${totalBoreholes}</div>
            </div>
            <div class="summary-card" style="border-left-color: #43A047;">
                <h3>시추 적정성 검증 통과</h3>
                <div class="value">${shallowPassCount} / ${totalBoreholes}</div>
            </div>
            </div>

        ${failedBoreholes.length > 0 ? `
        <div style="margin: 20px 0; padding: 18px; background: #F5F7FA; border-left: 4px solid #546E7A; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
            <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 16px; font-weight: 600;">[주의] 시추 적정성 검증 미통과 시추공 (${failedBoreholes.length}개)</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 12px;">
                ${failedBoreholes.map((data, idx) => {
                    const result = verificationResults.find(r => r.holeNo === data.holeNo);
                    if (!result) return '';
                    return `
                        <div style="padding: 12px; background: white; border-radius: 4px; border: 1px solid #CFD8DC; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
                            <strong style="color: #1976D2; cursor: pointer; text-decoration: underline; font-weight: 600;" onclick="showBoreholeLog('${data.holeNo}')" onmouseover="this.style.color='#1565C0'" onmouseout="this.style.color='#1976D2'">${data.holeNo}</strong>
                            <div style="font-size: 12px; color: #546E7A; margin-top: 6px; line-height: 1.4;">
                                ${result.shallow.reason}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}

        <div class="borehole-table-wrapper">
            <table class="borehole-table">
                <thead>
                    <tr>
                        <th style="text-align: center;">시추공<br>번호</th>
                        <th style="text-align: center;">지표고<br>(E.L m)</th>
                        <th style="text-align: center;">지하수위<br>(E.L m)</th>
                        <th style="text-align: center;">풍화암<br>출현고 (E.L m)</th>
                        <th style="text-align: center;">연암 이상<br>출현고 (E.L m)</th>
                        <th style="text-align: center;">시추 종료<br>레벨 (E.L m)</th>
                        <th style="text-align: center;">굴착면<br>(사용자 입력)</th>
                        <th style="text-align: center;">시추 깊이<br>적정성 검토 결과</th>
                    </tr>
                </thead>
                <tbody>
                    ${boreholeData.map((data, index) => {
                        const result = verificationResults.find(r => r.holeNo === data.holeNo);
                        if (!result) return '';
                        const waterTable = formatValue(data.waterTableElevation);
                        const weatheredRock = formatValue(data.weatheredRockElevation);
                        const softRockPlus = formatValue(data.softRockPlusElevation);
                        
                        return `
                            <tr ${data.bedrockTopElevation !== '-' && data.bedrockTopElevation !== 'N/A' ? 'class="rock-layer"' : ''}>
                                <td style="text-align: center;"><strong class="clickable-hole-no" onclick="showBoreholeLog('${data.holeNo}')" style="cursor: pointer; color: #1976D2; text-decoration: underline;">${data.holeNo}</strong></td>
                                <td style="text-align: center;">${data.groundElevation.toFixed(2)}</td>
                                <td style="text-align: center;">${waterTable}</td>
                                <td style="text-align: center;">${weatheredRock}</td>
                                <td style="text-align: center;">${softRockPlus}</td>
                                <td style="text-align: center;">${data.boreholeEndElevation}</td>
                                <td style="text-align: center;">
                                    <input type="number" step="0.1" class="input-field-small" 
                                           value="${data.excavationLevelInput}" 
                                           onchange="updateLevel(${index}, 'excavationLevelInput', this.value)"
                                           style="text-align: center;">
                                </td>
                                <td style="text-align: center;">
                                    <span class="${result.shallow.pass ? 'status-pass' : 'status-fail'}">
                                        ${result.shallow.pass ? '적정' : '부족'}
                                    </span>
                                    <div style="font-size: 11px; color: #616161; margin-top: 4px;">
                                        ${result.shallow.reason}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

    `;

    // 미니 맵 업데이트 (깊이 검증 결과 반영)
    if (typeof createMiniContourMap === 'function' && typeof getAnalysisMarkerData === 'function') {
        setTimeout(() => {
            createMiniContourMap('depthMiniMap', 'ground_elevation', getAnalysisMarkerData('depth'));
        }, 100);
    }
}

function estimateSoilPropertiesFromSPT(usedSPTDataArray, soilData, preCalculatedAvgN) {
    // Use the pre-calculated average N value from influence depth
    // or calculate from provided SPT data array
    let nValues = []; // Store individual N values
    let avgN = 15; // Default
    let countN = 0;
    
    // If we have pre-calculated average N (from analysis), use it
    if (preCalculatedAvgN && preCalculatedAvgN !== 'N/A') {
        avgN = parseInt(preCalculatedAvgN);
        // Extract N values from used SPT data for display
        if (usedSPTDataArray && usedSPTDataArray.length > 0) {
            usedSPTDataArray.forEach(spt => {
                nValues.push(spt.nValue);
                countN++;
            });
        }
    } else {
        // Fallback: calculate from provided data array
        if (usedSPTDataArray && usedSPTDataArray.length > 0) {
            usedSPTDataArray.forEach(spt => {
                nValues.push(spt.nValue);
                countN++;
            });
            if (countN > 0) {
                const sumN = nValues.reduce((a, b) => a + b, 0);
                avgN = Math.round(sumN / countN);
            }
        }
    }
    
    // Get soil type from first layer
    let soilType = 'sand';
    let soilTypeName = '모래(사질토)';
    if (soilData && soilData.length > 0) {
        const firstLayer = soilData[0].soil_name || '';
        if (firstLayer.includes('점토') || firstLayer.includes('clay')) {
            soilType = 'clay';
            soilTypeName = '점토(점성토)';
        } else if (firstLayer.includes('매립') || firstLayer.includes('Fill')) {
            soilType = 'fill';
            soilTypeName = '매립토';
        } else if (firstLayer.includes('풍화잔류')) {
            soilType = 'weathered_soil';
            soilTypeName = '풍화잔류토';
        } else if (firstLayer.includes('풍화암')) {
            soilType = 'weathered_rock';
            soilTypeName = '풍화암';
        }
    }
    
    let c, phi, gamma, Es;
    let calculationSteps = [];
    
    // Estimate based on soil type and N value
    if (soilType === 'clay') {
        // Cohesive soil - use cu correlations
        calculationSteps.push(`토질: ${soilTypeName} (${soilType})`);
        calculationSteps.push(`평균 SPT N값: Navg = ${nValues.join('+')} / ${countN} = ${avgN}`);
        calculationSteps.push(`점착력 c = 6.25 × N = 6.25 × ${avgN} = ${6.25 * avgN} kN/m² (Terzaghi-Peck 공식)`);
        calculationSteps.push(`내부마찰각 φ = 0° (비배수 조건)`);
        calculationSteps.push(`단위중량 γ = 17.5 kN/m³`);
        calculationSteps.push(`탄성계수 Es = 5000 + 500 × N = 5000 + 500 × ${avgN} = ${5000 + 500 * avgN} kN/m²`);
        
        c = 6.25 * avgN;
        phi = 0;
        gamma = 17.5;
        Es = 5000 + 500 * avgN;
    } else if (soilType === 'fill') {
        calculationSteps.push(`토질: ${soilTypeName} (${soilType})`);
        if (countN > 0) {
            const sumN = nValues.reduce((a, b) => a + b, 0);
            calculationSteps.push(`평균 SPT N값: Navg = ${nValues.join('+')} / ${countN} = ${sumN} / ${countN} = ${avgN}`);
        } else {
            calculationSteps.push(`평균 SPT N값: Navg = ${avgN} (관측값 없음, 보정값 사용)`);
        }
        calculationSteps.push(`내부마찰각 φ = √(12N) + 15 = √(12×${avgN}) + 15 = ${Math.sqrt(12 * avgN).toFixed(2)} + 15 = ${(Math.sqrt(12 * avgN) + 15).toFixed(2)}° (Peck 1974 공식)`);
        
        phi = Math.sqrt(12 * avgN) + 15;
        const originalPhi = phi;
        phi = Math.max(25, Math.min(phi, 35));
        
        if (originalPhi !== phi) {
            calculationSteps.push(`φ값 제한 적용: 25° ≤ φ ≤ 35° → φ = ${phi}°`);
        } else {
            calculationSteps.push(`φ값 최종: φ = ${phi}°`);
        }
        calculationSteps.push(`점착력 c = 0 kN/m²`);
        calculationSteps.push(`단위중량 γ = 18.0 kN/m³`);
        calculationSteps.push(`탄성계수 Es = 15000 + 1000 × N = 15000 + 1000 × ${avgN} = ${15000 + 1000 * avgN} kN/m²`);
        
        c = 0;
        gamma = 18.0;
        Es = 15000 + 1000 * avgN;
    } else if (soilType === 'weathered_soil') {
        calculationSteps.push(`토질: ${soilTypeName} (${soilType})`);
        calculationSteps.push(`평균 SPT N값: Navg = ${nValues.join('+')} / ${countN} = ${avgN}`);
        calculationSteps.push(`내부마찰각 φ = 27.1 + 0.3N - 0.00054N² = 27.1 + 0.3×${avgN} - 0.00054×${avgN}² = ${27.1 + 0.3 * avgN - 0.00054 * avgN * avgN}° (Dunham 1954 공식)`);
        
        phi = 27.1 + 0.3 * avgN - 0.00054 * avgN * avgN;
        phi = Math.max(28, Math.min(phi, 40));
        
        calculationSteps.push(`φ값 제한 적용: 28° ≤ φ ≤ 40° → φ = ${phi}°`);
        calculationSteps.push(`점착력 c = 0 kN/m²`);
        calculationSteps.push(`단위중량 γ = 19.5 kN/m³`);
        calculationSteps.push(`탄성계수 Es = 15000 + 1000 × N = 15000 + 1000 × ${avgN} = ${15000 + 1000 * avgN} kN/m²`);
        
        c = 0;
        gamma = 19.5;
        Es = 15000 + 1000 * avgN;
    } else if (soilType === 'weathered_rock') {
        calculationSteps.push(`토질: ${soilTypeName} (${soilType})`);
        calculationSteps.push(`평균 SPT N값: Navg = ${nValues.join('+')} / ${countN} = ${avgN}`);
        calculationSteps.push(`내부마찰각 φ = 42° (경험값)`);
        calculationSteps.push(`점착력 c = 75 kN/m² (경험값)`);
        calculationSteps.push(`단위중량 γ = 21.0 kN/m³`);
        calculationSteps.push(`탄성계수 Es = 30000 kN/m²`);
        
        phi = 42;
        c = 75;
        gamma = 21.0;
        Es = 30000;
    } else {
        // Granular soil (sand) - Ensemble method
        calculationSteps.push(`토질: ${soilTypeName} (${soilType})`);
        calculationSteps.push(`평균 SPT N값: Navg = ${nValues.join('+')} / ${countN} = ${avgN}`);
        
        const phiPeck = Math.sqrt(12 * avgN) + 15;
        const phiDunham = 27.1 + 0.3 * avgN - 0.00054 * avgN * avgN;
        const phiJapanese = Math.sqrt(20 * avgN) + 15;
        
        calculationSteps.push(`▪ Peck (1974): φ = √(12N) + 15 = √(12×${avgN}) + 15 = ${phiPeck.toFixed(2)}°`);
        calculationSteps.push(`▪ Dunham (1954): φ = 27.1 + 0.3N - 0.00054N² = 27.1 + 0.3×${avgN} - 0.00054×${avgN}² = ${phiDunham.toFixed(2)}°`);
        calculationSteps.push(`▪ Japanese (도로공사표준시방서): φ = √(20N) + 15 = √(20×${avgN}) + 15 = ${phiJapanese.toFixed(2)}°`);
        calculationSteps.push(`앙상블 평균: φ = 0.4×${phiPeck.toFixed(2)} + 0.3×${phiDunham.toFixed(2)} + 0.3×${phiJapanese.toFixed(2)} = ${(0.4 * phiPeck + 0.3 * phiDunham + 0.3 * phiJapanese).toFixed(2)}°`);
        
        phi = 0.4 * phiPeck + 0.3 * phiDunham + 0.3 * phiJapanese;
        phi = Math.max(25, Math.min(phi, 45));
        
        calculationSteps.push(`φ값 제한 적용: 25° ≤ φ ≤ 45° → φ = ${phi}°`);
        calculationSteps.push(`점착력 c = 0 kN/m²`);
        
        if (avgN < 10) {
            calculationSteps.push(`단위중량 γ = 17.0 kN/m³ (N<10: 느슨)`);
            gamma = 17.0;
        } else if (avgN < 30) {
            calculationSteps.push(`단위중량 γ = 18.5 kN/m³ (10≤N<30: 보통)`);
            gamma = 18.5;
        } else {
            calculationSteps.push(`단위중량 γ = 19.5 kN/m³ (N≥30: 조밀)`);
            gamma = 19.5;
        }
        
        calculationSteps.push(`탄성계수 Es = 15000 + 1000 × N = 15000 + 1000 × ${avgN} = ${15000 + 1000 * avgN} kN/m²`);
        
        c = 0;
        Es = 15000 + 1000 * avgN;
    }
    
    return {
        c: Math.round(c),
        phi: Math.round(phi * 10) / 10,
        gamma: Math.round(gamma * 10) / 10,
        Es: Math.round(Es / 1000) * 1000,
        details: {
            avgN: avgN,
            nValues: nValues,
            soilType: soilType,
            soilTypeName: soilTypeName,
            steps: calculationSteps
        }
    };
}

// 디바운스 타이머 변수
let updateLevelDebounceTimer = null;
let pendingLevelUpdates = new Map();

function updateLevel(index, field, value) {
    // 즉시 boreholeData 업데이트 (데이터는 바로 반영)
    boreholeData[index][field] = parseFloat(value).toFixed(2);

    // 업데이트 대기열에 추가
    pendingLevelUpdates.set(`${index}_${field}`, { index, field, value });

    // 디바운스: 300ms 후에 모든 모듈 업데이트 실행
    if (updateLevelDebounceTimer) {
        clearTimeout(updateLevelDebounceTimer);
    }

    updateLevelDebounceTimer = setTimeout(() => {
        syncAllModulesAfterLevelChange();
        pendingLevelUpdates.clear();
    }, 300);
}

// 모든 모듈 동기화 (디바운스된 후 한 번만 실행)
function syncAllModulesAfterLevelChange() {
    // Step 2 검증
    if (typeof performVerification === 'function') {
        performVerification();
    }

    // Step 3 연약지반 (이미 실행된 경우에만)
    if (Array.isArray(window.weakSoilResults) && window.weakSoilResults.length > 0) {
        if (typeof runWeakSoilAnalysis === 'function') {
            runWeakSoilAnalysis();
        }
    }

    // Step 4 전석 탐지 (이미 실행된 경우에만)
    if (Array.isArray(window.boulderDetectionResults) && window.boulderDetectionResults.length > 0) {
        if (typeof runBoulderDetection === 'function') {
            runBoulderDetection();
        }
    }

    // Step 5 간이 판단
    if (typeof performSimpleFoundationAssessment === 'function') {
        performSimpleFoundationAssessment();
    }

    // Step 5 상세 분석 (이미 실행된 경우에만)
    if (Array.isArray(window.analysisResults) && window.analysisResults.length > 0) {
        if (typeof runCompleteAnalysis === 'function') {
            runCompleteAnalysis();
        }
    }

    // Step 6 말뚝 지지력 (이미 실행된 경우에만)
    if (Array.isArray(window.pileCalculationResults) && window.pileCalculationResults.length > 0) {
        if (typeof runPileCalculation === 'function') {
            runPileCalculation();
        }
    }

    // Step 6 지반 시각화 업데이트
    if (typeof generateVisualizationData === 'function') {
        generateVisualizationData();
    }
    if (typeof updateContourMap === 'function') {
        updateContourMap();
    }
    if (typeof updateCrossSection === 'function') {
        updateCrossSection();
    }

    // Step 6 굴착면 레벨 편집 UI 갱신
    if (typeof refreshExcavationLevelEditUI === 'function') {
        refreshExcavationLevelEditUI();
    }
}

function updateBoreholeSoilParam(index, field, value) {
    const numValue = parseFloat(value);
    
    if (field === 'waterTableDepth') {
        boreholeData[index].waterTableDepth = numValue;
        // Mark as modified when water table is changed
        boreholeData[index].userModified = true;
    } else if (field === 'foundationEmbedment') {
        boreholeData[index].foundationEmbedmentDepth = numValue;
        // Mark as modified when embedment depth is changed
        boreholeData[index].userModified = true;
    } else if (['c', 'phi', 'gamma', 'Es'].includes(field)) {
        boreholeData[index].soilParams[field] = numValue;
        // Mark as modified when any soil parameter is changed
        boreholeData[index].userModified = true;
    }
    
    // Don't auto-run analysis - user will click re-analysis button
}

function reRunAnalysis() {
    // Show loading indicator
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('active');

    setTimeout(() => {
        runCompleteAnalysis();
        if (loadingEl) loadingEl.classList.remove('active');
    }, 100);
}

// Note: Soil parameters are now managed per borehole in boreholeData.soilParams
// No global soil parameter management needed anymore

// ===== 연약지반 판정 모듈 =====

/**
 * 토질 자동 분류 및 연약지반 판정 함수
 *
 * 토질명과 N값을 기반으로 토질 유형을 분류하고 연약지반 여부를 판정합니다.
 *
 * 판정 기준:
 * - 점성토 (점토, Clay, CL, CH, ML): 두께 < 10m이면 N ≤ 4, 두께 ≥ 10m이면 N ≤ 6
 * - 사질토 (모래, Sand, SP, SW, SM): N < 10
 * - 특수토 (붕적토, 매립토, Fill, OH, OL): N < 10 또는 N값 없음
 * - 기반암 (풍화암, 연암, 경암, 암반): 연약지반 판정 제외
 *
 * @param {string} soilName - 토질명 (예: '실트질 점토', 'CL', '풍화암')
 * @param {number|string|null} nValue - SPT N값 (숫자, 문자열, 또는 null)
 * @param {number} thickness - 해당 지층의 두께 (m)
 * @returns {Object} 판정 결과
 * @returns {string} returns.soilType - 토질 유형 ('cohesive'|'granular'|'special'|'rock'|'other'|'unknown')
 * @returns {boolean} returns.isWeak - 연약지반 여부
 * @returns {string} returns.reason - 판정 근거 설명
 *
 * @example
 * const result = classifySoilType('실트질 점토', 3, 5.0);
 * // { soilType: 'cohesive', isWeak: true, reason: '점성토, 두께 5.0m < 10m, N <= 4 (N=3)' }
 */
function classifySoilType(soilName, nValue, thickness) {
    const name = (soilName || '').toLowerCase();
    const originalName = soilName || '';
    let soilType = 'unknown';
    let isWeak = false;
    let reason = '';

    // 기반암 판정 (연약지반 판정 제외) - 최우선 체크
    if (name.includes('풍화암') || name.includes('연암') || name.includes('경암') ||
        name.includes('암반') || name.includes('기반암') || name.includes('화강암') ||
        name.includes('편마암') || name.includes('사암') || name.includes('이암') ||
        name.includes('셰일') || name.includes('rock') || name.includes('bedrock')) {
        soilType = 'rock';
        isWeak = false;
        reason = `기반암(${originalName}) - 연약지반 판정 제외`;
        return { soilType, isWeak, reason };
    }

    // N값 정규화 (null, undefined, NaN, 문자열 처리 강화)
    // 문자열로 전달된 경우 parseFloat로 변환, 빈 문자열이나 공백은 null 처리
    let parsedN = nValue;
    if (typeof nValue === 'string') {
        parsedN = nValue.trim() === '' ? null : parseFloat(nValue);
    }
    const hasNValue = parsedN !== null && parsedN !== undefined && !isNaN(parsedN) && isFinite(parsedN);
    const numericN = hasNValue ? Number(parsedN) : null;
    const thicknessNum = parseFloat(thickness) || 0;

    // 점성토 판정 (점토, Clay, 실트 포함)
    // USCS 분류: CL(저소성 점토), CH(고소성 점토), ML(저소성 실트), MH(고소성 실트)
    const isCohesive = name.includes('점토') || name.includes('clay') ||
                       name.includes('실트') || name.includes('silt') ||
                       name.includes('점질') || name.includes('점성') ||
                       /\b(cl|ch|ml|mh)\b/i.test(name);  // 단어 경계로 정확히 매칭

    // 사질토 판정 (모래, Sand)
    // USCS 분류: SP(입도불량 모래), SW(입도양호 모래), SM(실트질 모래), SC(점토질 모래)
    const isGranular = (name.includes('모래') || name.includes('sand') || name.includes('사질') ||
                       /\b(sp|sw|sm|sc)\b/i.test(name)) && !isCohesive;

    // 특수토 판정 (붕적토, 매립토, 유기질토 등)
    // USCS 분류: OH(고소성 유기질토), OL(저소성 유기질토), Pt(이탄)
    const isSpecial = name.includes('붕적') || name.includes('봉적') || name.includes('매립') ||
                      name.includes('성토') || name.includes('fill') || name.includes('유기질') ||
                      name.includes('이탄') || name.includes('준설') ||
                      /\b(oh|ol|pt)\b/i.test(name);

    if (isCohesive && !isSpecial) {
        // 점성토 판정 기준
        soilType = 'cohesive';
        if (!hasNValue) {
            // N값이 없는 경우 보수적으로 연약지반 판정
            isWeak = true;
            reason = `점성토(${originalName}), N값 없음 - 보수적 판정`;
        } else if (thicknessNum < 10) {
            // 두께 10m 미만: N <= 4 이면 연약
            if (numericN <= 4) {
                isWeak = true;
                reason = `점성토, 두께 ${thicknessNum.toFixed(1)}m < 10m, N <= 4 (N=${numericN})`;
            } else {
                isWeak = false;
                reason = `점성토, 두께 ${thicknessNum.toFixed(1)}m < 10m, N > 4 (N=${numericN}) - 양호`;
            }
        } else {
            // 두께 10m 이상: N <= 6 이면 연약
            if (numericN <= 6) {
                isWeak = true;
                reason = `점성토, 두께 ${thicknessNum.toFixed(1)}m >= 10m, N <= 6 (N=${numericN})`;
            } else {
                isWeak = false;
                reason = `점성토, 두께 ${thicknessNum.toFixed(1)}m >= 10m, N > 6 (N=${numericN}) - 양호`;
            }
        }
    } else if (isGranular) {
        // 사질토 판정 기준: N < 10
        soilType = 'granular';
        if (!hasNValue) {
            isWeak = true;
            reason = `사질토(${originalName}), N값 없음 - 보수적 판정`;
        } else if (numericN < 10) {
            isWeak = true;
            reason = `사질토, N < 10 (N=${numericN})`;
        } else {
            isWeak = false;
            reason = `사질토, N >= 10 (N=${numericN}) - 양호`;
        }
    } else if (isSpecial) {
        // 특수토 판정 기준: N < 10 또는 N값 없음
        soilType = 'special';
        if (!hasNValue || numericN < 10) {
            isWeak = true;
            reason = `특수토(${originalName}), N < 10 또는 N값 없음 (N=${hasNValue ? numericN : 'N/A'})`;
        } else {
            isWeak = false;
            reason = `특수토(${originalName}), N >= 10 (N=${numericN}) - 양호`;
        }
    } else {
        // 기타 토질 (풍화토, 잔류토 등)
        // 풍화토/잔류토는 일반적으로 N값이 높으면 양호
        soilType = 'other';

        // 풍화토/잔류토 판별
        const isWeathered = name.includes('풍화토') || name.includes('풍화잔류') ||
                           name.includes('잔류토') || name.includes('residual');

        if (isWeathered) {
            // 풍화토는 N >= 10이면 양호로 판정
            if (!hasNValue) {
                isWeak = true;
                reason = `풍화토(${originalName}), N값 없음 - 보수적 판정`;
            } else if (numericN < 10) {
                isWeak = true;
                reason = `풍화토, N < 10 (N=${numericN})`;
            } else {
                isWeak = false;
                reason = `풍화토, N >= 10 (N=${numericN}) - 양호`;
            }
        } else {
            // 그 외 미분류 토질: 보수적 판정 (N < 10이면 연약)
            if (!hasNValue || numericN < 10) {
                isWeak = true;
                reason = `기타토질(${originalName}), N < 10 (N=${hasNValue ? numericN : 'N/A'}) - 보수적 판정`;
            } else {
                isWeak = false;
                reason = `기타토질(${originalName}), N >= 10 (N=${numericN}) - 양호`;
            }
        }
    }

    return {
        soilType: soilType,
        isWeak: isWeak,
        reason: reason
    };
}

// 2. 연약지반 구간 병합 함수 (사용자 설정 두께 적용)
function mergeWeakZones(layers) {
    const weakZones = [];
    let currentZone = null;
    
    // 사용자가 설정한 최소 두께 가져오기
    const minThickness = parseFloat(document.getElementById('weakSoilThickness').value) || 3.0;
    
    layers.forEach((layer, index) => {
        if (layer.isWeak) {
            if (currentZone === null) {
                // 새로운 연약구간 시작
                currentZone = {
                    startDepth: layer.depthStart,
                    endDepth: layer.depthEnd,
                    startElevation: layer.elevationTop,
                    endElevation: layer.elevationBottom,
                    thickness: layer.thickness,
                    layers: [layer]
                };
            } else {
                // 기존 구간과의 간격 확인
                const gap = layer.depthStart - currentZone.endDepth;
                
                if (gap <= 0.5) {
                    // 간격이 0.5m 이하이면 병합
                    currentZone.endDepth = layer.depthEnd;
                    currentZone.endElevation = layer.elevationBottom;
                    currentZone.thickness += layer.thickness;
                    currentZone.layers.push(layer);
                } else {
                    // 간격이 0.5m 초과이면 별도 구간으로 분리
                    if (currentZone.thickness >= minThickness) {
                        weakZones.push(currentZone);
                    }
                    currentZone = {
                        startDepth: layer.depthStart,
                        endDepth: layer.depthEnd,
                        startElevation: layer.elevationTop,
                        endElevation: layer.elevationBottom,
                        thickness: layer.thickness,
                        layers: [layer]
                    };
                }
            }
        } else {
            // 연약층이 아닌 경우
            if (currentZone !== null) {
                if (currentZone.thickness >= minThickness) {
                    weakZones.push(currentZone);
                }
                currentZone = null;
            }
        }
    });
    
    // 마지막 구간 처리
    if (currentZone !== null && currentZone.thickness >= minThickness) {
        weakZones.push(currentZone);
    }

    return weakZones;
}

// 전역 노출
window.displayVerificationResults = displayVerificationResults;
window.verificationResults = verificationResults;

