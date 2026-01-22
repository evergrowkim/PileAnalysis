// 3D Visualization Variables
let showBoreholes = true;
let showContours = true;
let current3DType = 'multilayer';

// 현재 프로젝트의 지역 힌트 (데이터 로딩 시 자동 설정)
// window 전역 변수로 선언하여 다른 모듈에서도 접근 가능
window.currentRegionHint = window.currentRegionHint || null;

/**
 * 프로젝트 이름에서 지역 힌트 추출
 * @param {string} projectName - 프로젝트 이름
 * @returns {string|null} 추출된 지역명
 */
function extractRegionHint(projectName) {
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
            window.currentRegionHint = region;  // window 전역 변수에 저장
            return region;
        }
    }

    return null;
}

/**
 * 범용 좌표 변환 헬퍼 함수
 * 자동 감지 모드의 KoreanCoordinateTransformer 사용
 * @param {number} x - X 좌표 (순서 자동 감지)
 * @param {number} y - Y 좌표 (순서 자동 감지)
 * @param {string} regionHint - 지역명 힌트 (선택)
 * @returns {Object|null} - { lat, lng } 또는 null
 */
function transformToWGS84Universal(x, y, regionHint = null) {
    try {
        // 지역 힌트 결정 (파라미터 > 현재 프로젝트 힌트 > null)
        const hint = regionHint || window.currentRegionHint;

        // KoreanCoordinateTransformer 사용 (자동 감지 모드)
        if (window.coordinateTransformer && typeof window.coordinateTransformer.transformToWGS84 === 'function') {
            const result = window.coordinateTransformer.transformToWGS84(x, y, hint);
            if (result && result.lat && result.lng) {
                return result;
            }
        }

        // 폴백: UniversalCoordinateTransformer 사용
        if (window.universalTransformer && typeof window.universalTransformer.transformToWGS84 === 'function') {
            const result = window.universalTransformer.transformToWGS84(x, y);
            if (result && result.lat && result.lng) {
                return result;
            }
        }

        return null;
    } catch (error) {
        console.warn('Coordinate transformation failed:', error.message);
        return null;
    }
}

// Drawing Overlay Variables
let pdfDoc = null;
let calibrationPoints = []; // { hole_no, pixelX, pixelY, geoX, geoY }
let transformMatrix = null; // Affine Transform Matrix
let canvasScale = 1;
let overlayTransform = { x: 0, y: 0, k: 1, rotate: 0 };
let isDragging = false;
let startX, startY;
let dragStartPos = null;
let wrapperOffset = { x: 0, y: 0 }; // wrapper의 offset 저장
let showContourOverlay = false;
let contourOverlayType = 'bedrock_elevation';
// ✅ 등고선 개별 레이어 상태 (체크박스로 직접 제어)
let contourOverlayLayers = {
    groundElevation: false,
    groundwaterLevel: false,
    weatheredRock: false,
    bedrock: false
};
// 필터링 및 구름 영역 변수
let foundationFilter = {
    direct: true,      // 직접 기초 가능
    replacement: true, // 치환 후 직접/파일 기초
    pile: true,        // 파일 기초 필요
    unknown: true      // 미판단
};
let showCloudAreas = false; // 구름 영역 표시 여부 (전체 토글)
// 구름 영역 판정별 개별 토글
let cloudAreaSettings = {
    foundation: true,    // 직접 기초 판정 구름
    softGround: true,    // 연약지반 구름
    specialLayer: true   // 전석/붕적/이암 구름
};
let multiBoreholeMode = false; // 다중 시추공 분석 모드
let drawingMultiBoreholeMode = false; // 도면 위 다중 시추공 분석 모드
let drawingSelectedBoreholes = []; // 도면에서 선택된 시추공 목록
let pdfOpacity = 100; // PDF 도면 투명도 (0-100)
let crossSectionScaleMode = 'auto'; // 'real' = 실축적(1:1), 'auto' = 자동 스케일

// 분석 섹션별 선택된 시추공 목록 (다중 선택용)
const analysisSelectedBoreholes = {
    depth: [],
    weakSoil: [],
    boulder: [],
    foundation: []
};
let scale3DMode = 'auto'; // 'real' = 실축적(1:1:1), 'auto' = 자동 스케일
let zScaleMultiplier = 1; // Z축 배율 (수동 조정용)

// 수동 배치 모드 변수
let placementMode = 'calib'; // 'calib' 또는 'manual'
let manualPlacements = []; // { holeNo, pixelX, pixelY, geoX, geoY, isNew }
let referencePoints = []; // { pixelX, pixelY, geoX, geoY }
let selectingRefPoint = 0; // 0: 선택 안함, 1: 기준점1 선택중, 2: 기준점2 선택중
let manualTransformMatrix = null; // 수동 배치용 변환 행렬

// 2D/3D 등고선 맵용 마커 색상 결정 함수
function getContourMarkerColor(bh, showFoundation, showSoftGround, showSpecialLayer) {
    const foundationResults = window.simpleFoundationResults || [];
    const selectedCount = [showFoundation, showSoftGround, showSpecialLayer].filter(v => v).length;

    // 아무것도 선택 안됨
    if (selectedCount === 0) {
        return '#9E9E9E';
    }

    // 판정 정보 가져오기
    const foundationInfo = getFoundationJudgmentInfo(bh, foundationResults);
    const softGroundInfo = getSoftGroundInfo(bh);
    const specialLayerInfo = getSpecialLayerInfo(bh);

    // 단일 선택
    if (selectedCount === 1) {
        if (showFoundation) {
            return foundationInfo.markerColor;
        } else if (showSoftGround) {
            return softGroundInfo.hasSoftGround ? '#E53935' : '#4CAF50';
        } else if (showSpecialLayer) {
            return specialLayerInfo.hasSpecialLayer ? '#6D4C41' : '#4CAF50';
        }
    }

    // 다중 선택 시 - 우선순위: 위험(적색) > 주의(주황) > 양호(녹색)
    // 가장 위험한 상태의 색상 반환
    let hasRisk = false;
    let hasWarning = false;

    if (showFoundation) {
        if (foundationInfo.judgmentType === 'pile') hasRisk = true;
        else if (foundationInfo.judgmentType === 'replacement') hasWarning = true;
    }
    if (showSoftGround && softGroundInfo.hasSoftGround) {
        hasRisk = true;
    }
    if (showSpecialLayer && specialLayerInfo.hasSpecialLayer) {
        hasRisk = true;
    }

    if (hasRisk) return '#C62828';  // 위험 (적색)
    if (hasWarning) return '#F57C00';  // 주의 (주황)

    // 직접기초만 선택되고 직접기초 가능인 경우
    if (showFoundation && foundationInfo.judgmentType === 'direct') {
        return '#2E7D32';  // 양호 (녹색)
    }

    return '#4CAF50';  // 기본 양호
}

// Visualization Tab Switching
function switchVisualizationTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.visualization-tab-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected tab
    const target = document.getElementById(tabId.replace('tab', 'visualization'));
    if (target) {
        target.style.display = 'block';
    }
    
    // Update buttons
    document.querySelectorAll('#tab-visualization .tab').forEach(btn => {
        btn.style.background = '#607D8B';
        btn.style.color = 'white';
    });
    const activeBtn = document.getElementById(tabId);
    if (activeBtn) {
        activeBtn.style.background = '#2C5F8D';
    }
    
    // Render content
    if (tabId === 'tabData') {
        renderBoreholeDataTable();
    } else if (tabId === 'tabMap') {
        if (typeof initMapView === 'function') {
            initMapView();
        }
    } else if (tabId === 'tab2d') {
        if (typeof updateContourMap === 'function') {
            updateContourMap();
        }
    } else if (tabId === 'tab3d') {
        if (typeof update3DVisualization === 'function') {
            update3DVisualization();
        }
    } else if (tabId === 'tabOverlay') {
        updateBoreholeSelector();
        if (typeof updateOverlayCanvas === 'function') {
            updateOverlayCanvas();
        }
    }
}

// Render Borehole Data Table
function renderBoreholeDataTable() {
    const tbody = document.getElementById('boreholeDataTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!boreholeData || boreholeData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">데이터가 없습니다.</td></tr>';
        return;
    }
    
    boreholeData.forEach(bh => {
        const bedrockLevel = bh.bedrockTopElevation !== '-' && bh.bedrockTopElevation !== 'N/A' ? bh.bedrockTopElevation : '-';
        const gwl = bh.waterTableElevation !== null ? bh.waterTableElevation : '-';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">${bh.holeNo}</td>
            <td style="text-align: center;">${(bh.x || 0).toFixed(1)}, ${(bh.y || 0).toFixed(1)}</td>
            <td style="text-align: center;">${parseFloat(bh.groundElevation).toFixed(2)}</td>
            <td style="text-align: center;">${gwl}</td>
            <td style="text-align: center;">${(bh.totalDepth || 0).toFixed(2)}</td>
            <td style="text-align: center;">${bedrockLevel}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Generate Visualization Data (Interpolation)
function generateVisualizationData() {
    if (!boreholeData || boreholeData.length === 0) return;

    // 좌표 변환기 자동 설정 (아직 설정되지 않은 경우)
    if (!window.universalTransformer?.detectedEPSG && boreholeData.length > 0) {
        const coordinates = boreholeData.map(bh => ({
            x: parseFloat(bh.x) || 0,
            y: parseFloat(bh.y) || 0
        })).filter(c => c.x !== 0 && c.y !== 0);

        if (coordinates.length > 0) {
            if (!window.universalTransformer) {
                window.universalTransformer = new UniversalCoordinateTransformer();
            }
            // 메타데이터 전달
            const firstBorehole = boreholeData[0];
            const metadata = firstBorehole?.metadata || {};

            // 프로젝트 이름에서 지역 힌트 추출 및 설정
            const projectName = metadata.PROJECT_NAME || metadata.projectName || '';
            window.currentRegionHint = extractRegionHint(projectName);
            if (window.currentRegionHint) {
                console.log(`[Region] Project region hint set to: ${window.currentRegionHint}`);
            }

            const detection = window.universalTransformer.detectCoordinateSystem(coordinates, {
                location: metadata.LOCATION || metadata.location || '',
                projectName: projectName,
                LOCATION: metadata.LOCATION || '',
                PROJECT_NAME: metadata.PROJECT_NAME || ''
            });
            console.log('Auto-detected coordinate system:', detection);

            // 자동 감지 모드의 KoreanCoordinateTransformer 사용 (지역 힌트 포함)
            window.coordinateTransformer = new KoreanCoordinateTransformer(); // 자동 감지 모드
            console.log('KoreanCoordinateTransformer set to AUTO-DETECT mode with region hint:', window.currentRegionHint);
        }
    }

    // ✅ Check if we have valid coordinates
    const hasValidCoordinates = boreholeData.every(bh => 
        bh.x !== undefined && bh.y !== undefined && 
        bh.x !== 0 && bh.y !== 0 &&
        !isNaN(parseFloat(bh.x)) && !isNaN(parseFloat(bh.y))
    );
    
    if (!hasValidCoordinates) {
        console.warn('⚠️ 경고: 모든 시추공에 유효한 좌표가 없습니다');
        
        // ✅ 좌표가 없는 시추공만 더미 좌표 할당 (다른 시추공에는 영향 없음)
        const withoutCoords = boreholeData.filter(bh => !bh.x || !bh.y || isNaN(parseFloat(bh.x)) || isNaN(parseFloat(bh.y)));
        console.warn(`좌표 없는 시추공 (${withoutCoords.length}개):`, 
                     withoutCoords.map(b => `${b.holeNo} (x:${b.x}, y:${b.y})`));
        
        withoutCoords.forEach((bh, i) => {
            if (!bh.x || isNaN(parseFloat(bh.x))) bh.x = i * 20;
            if (!bh.y || isNaN(parseFloat(bh.y))) bh.y = 100; // y도 의미있는 값으로
        });
    }
    
    const x = boreholeData.map(b => b.x || 0);
    const y = boreholeData.map(b => b.y || 0);
    
    if (x.length === 0) return;

    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const minY = Math.min(...y);
    const maxY = Math.max(...y);
    
    // Grid settings
    const gridResolution = 50;
    const gridX = [];
    const gridY = [];
    const margin = Math.max((maxX - minX) * 0.1, 10);
    const stepX = (maxX - minX + 2 * margin) / (gridResolution - 1) || 1;
    const stepY = (maxY - minY + 2 * margin) / (gridResolution - 1) || 1;
    
    const startX = minX - margin;
    const startY = minY - margin;
    
    for (let i = 0; i < gridResolution; i++) {
        gridX.push(startX + i * stepX);
        gridY.push(startY + i * stepY);
    }
    
    // 그리드 간격 (시추공 근처 판별용)
    const gridStep = Math.max(stepX, stepY);

    // IDW Interpolation (개선: 시추공 근처에서 정확한 값 반환)
    const interpolate = (points, values, queryX, queryY) => {
        // 가장 가까운 시추공 찾기
        let minDist = Infinity;
        let minIdx = -1;

        for (let i = 0; i < points.length; i++) {
            const dist = Math.sqrt(Math.pow(points[i].x - queryX, 2) + Math.pow(points[i].y - queryY, 2));
            if (dist < minDist) {
                minDist = dist;
                minIdx = i;
            }
        }

        // 시추공 위치에 가까우면 (그리드 간격의 0.7배 이내) 해당 시추공의 정확한 값 반환
        // 이렇게 하면 시추공 근처의 그리드 포인트는 항상 정확한 값을 가짐
        if (minDist < gridStep * 0.7 && minIdx >= 0) {
            return values[minIdx];
        }

        // IDW 보간
        let sumWeights = 0;
        let sumValues = 0;
        const power = 2;

        for (let i = 0; i < points.length; i++) {
            const dist = Math.sqrt(Math.pow(points[i].x - queryX, 2) + Math.pow(points[i].y - queryY, 2));
            if (dist < 0.01) return values[i];

            const weight = 1 / Math.pow(dist, power);
            sumWeights += weight;
            sumValues += values[i] * weight;
        }

        if (sumWeights === 0) return 0;
        return sumValues / sumWeights;
    };
    
    // Fields to interpolate
    const fieldMap = {
        'ground_elevation': 'groundElevation',
        'excavation_level': 'excavationLevelInput',
        'gwl_elevation': 'waterTableElevation',
        'bedrock_elevation': 'bedrockTopElevation',
        'weathered_rock_elevation': 'weatheredRockElevation',  // 풍화암 상단 표고
        'soft_rock_elevation': 'softRockPlusElevation'         // 연암 상단 표고
    };

    // Ensure visualizationData structure exists
    if (!window.visualizationData) {
        window.visualizationData = { contour_data: {}, '3d_data': {} };
    }
    
    // Ensure '3d_data' object exists
    if (!window.visualizationData['3d_data']) {
        window.visualizationData['3d_data'] = {};
    }
    
    // Ensure 'contour_data' object exists
    if (!window.visualizationData.contour_data) {
        window.visualizationData.contour_data = {};
    }
    
    Object.keys(fieldMap).forEach(key => {
        const sourceField = fieldMap[key];
        
        // ✅ 데이터 생성 추적
        console.log(`📊 [visualizationData] 필드 '${key}' 생성 - 시추공 수: ${boreholeData.length}`);
        
        const values = boreholeData.map((b, bidx) => {
            let val = parseFloat(b[sourceField]);
            
            // ✅ 데이터 유효성 로깅
            if (isNaN(val) || b[sourceField] === '-' || b[sourceField] === 'N/A') {
                 console.debug(`   시추공 ${bidx}[${b.holeNo}]: ${sourceField} = '${b[sourceField]}' → 기본값 적용`);
                 
                 if (key === 'bedrock_elevation') {
                     val = parseFloat(b.groundElevation) - 20; // Default depth
                 } else if (key === 'gwl_elevation') {
                     val = parseFloat(b.groundElevation) - 5;
                 } else if (key === 'weathered_rock_elevation') {
                     // 풍화암이 없으면 기반암 레벨 사용, 그것도 없으면 지표고 - 15m
                     const bedrockVal = parseFloat(b.bedrockTopElevation);
                     val = !isNaN(bedrockVal) ? bedrockVal : parseFloat(b.groundElevation) - 15;
                 } else if (key === 'soft_rock_elevation') {
                     // 연암이 없으면 풍화암 레벨 - 3m 또는 지표고 - 20m
                     const weatheredVal = parseFloat(b.weatheredRockElevation);
                     if (!isNaN(weatheredVal) && b.weatheredRockElevation !== '-') {
                         val = weatheredVal - 3;
                     } else {
                         const bedrockVal = parseFloat(b.bedrockTopElevation);
                         val = !isNaN(bedrockVal) ? bedrockVal - 3 : parseFloat(b.groundElevation) - 20;
                     }
                 } else {
                     val = 0;
                 }
            }
            return val;
        });
        
        // ✅ 데이터 검증: values 배열이 boreholeData와 동기화되는지 확인
        if (values.length !== boreholeData.length) {
            console.error(`❌ 데이터 불일치: values (${values.length}) vs boreholeData (${boreholeData.length})`);
        }
        
        const zGrid = [];
        for (let i = 0; i < gridResolution; i++) {
            const row = [];
            for (let j = 0; j < gridResolution; j++) {
                const val = interpolate(
                    boreholeData.map(b => ({x: b.x || 0, y: b.y || 0})),
                    values,
                    gridX[j],
                    gridY[i]
                );
                row.push(val);
            }
            zGrid.push(row);
        }
        
        window.visualizationData.contour_data[key] = {
            x: gridX,
            y: gridY,
            z: zGrid
        };
        
        window.visualizationData['3d_data'][key] = {
            x: gridX,
            y: gridY,
            z_surface: zGrid,
            colorscale: key === 'gwl_elevation' ? 'Blues' : 'Viridis'
        };
    });
    
    // Update aliases
    window.visualizationData['3d_data']['elevation'] = window.visualizationData['3d_data']['ground_elevation'];
    window.visualizationData['3d_data']['gwl'] = window.visualizationData['3d_data']['gwl_elevation'];
    window.visualizationData['3d_data']['bedrock'] = window.visualizationData['3d_data']['bedrock_elevation'];
    
    // Multilayer
    if (window.visualizationData['3d_data']['ground_elevation']) {
        window.visualizationData['3d_data']['multilayer'] = {
            x: gridX,
            y: gridY,
            z_surface: window.visualizationData['3d_data']['ground_elevation'].z_surface,
            z_gwl: window.visualizationData['3d_data']['gwl_elevation'].z_surface,
            z_bedrock: window.visualizationData['3d_data']['bedrock_elevation'].z_surface,
            z_weathered_rock: window.visualizationData['3d_data']['weathered_rock_elevation'] ?
                             window.visualizationData['3d_data']['weathered_rock_elevation'].z_surface : null,
            z_soft_rock: window.visualizationData['3d_data']['soft_rock_elevation'] ?
                        window.visualizationData['3d_data']['soft_rock_elevation'].z_surface : null,
            z_excavation: window.visualizationData['3d_data']['excavation_level'] ? window.visualizationData['3d_data']['excavation_level'].z_surface : null
        };
    }
}

// 좌표 반전/회전 상태 (VisualizationState 확장)
let contourFlipX = false;
let contourFlipY = false;
let contourRotation = 0;
let contourXMin = 0, contourXMax = 0, contourYMin = 0, contourYMax = 0;

// 칩(Chip) 선택 함수
function selectContourType(chip) {
    // 모든 칩에서 active 클래스 제거
    const allChips = document.querySelectorAll('.chip');
    allChips.forEach(c => c.classList.remove('active'));

    // 선택된 칩에 active 클래스 추가
    chip.classList.add('active');

    // 숨겨진 select 값 업데이트
    const selectEl = document.getElementById('contourType');
    if (selectEl) {
        selectEl.value = chip.dataset.value;
    }

    // 등고선 맵 업데이트
    updateContourMap();
}

// 등고선 표시 모드 변수
let contourDisplayMode = 'heatmap'; // 'heatmap' 또는 'lines'

// 등고선 표시 모드 설정 함수
function setContourDisplayMode(mode) {
    contourDisplayMode = mode;

    // 버튼 스타일 업데이트
    const btnHeatmap = document.getElementById('btnContourHeatmap');
    const btnLines = document.getElementById('btnContourLinesOnly');

    if (btnHeatmap && btnLines) {
        if (mode === 'heatmap') {
            btnHeatmap.style.background = '#455A64';
            btnHeatmap.style.color = 'white';
            btnLines.style.background = 'transparent';
            btnLines.style.color = '#666';
        } else {
            btnHeatmap.style.background = 'transparent';
            btnHeatmap.style.color = '#666';
            btnLines.style.background = '#455A64';
            btnLines.style.color = 'white';
        }
    }

    // 등고선 맵 업데이트
    updateContourMap();
}

// Update Contour Map
function updateContourMap() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 updateContourMap() 호출됨');
    
    const contourTypeEl = document.getElementById('contourType');
    if (!contourTypeEl) return;

    const contourType = contourTypeEl.value;

    // 도면 표시 옵션 확인
    const showDrawingCheckbox = document.getElementById('showDrawingOverlay2D');
    const showDrawingOverlay = showDrawingCheckbox?.checked ?? false;
    const pdfCanvas = document.getElementById('pdfCanvas');

    // ✅ 도면 매핑 모드 확인 (수동 배치 OR 좌표 매칭)
    const hasManualPlacements = manualPlacements && manualPlacements.length > 0;
    const hasCalibrationData = calibrationPoints && calibrationPoints.length > 0 && transformMatrix;
    const hasDrawingData = window.drawingImageData && window.drawingImageData.width > 0;
    const hasBoreholeData = boreholeData && boreholeData.length > 0;

    // ✅ 픽셀 모드 사용 조건: 도면 매핑이 있거나, 시추공 데이터가 있으면 사용
    const usePixelMode = hasManualPlacements || hasCalibrationData || (hasDrawingData && hasBoreholeData) || hasBoreholeData;

    console.log('🎯 등고선 맵 모드:', usePixelMode ? '✅ 픽셀/상대 좌표' : '❌ 일반 좌표 (WGS84)');
    console.log('📊 조건 확인:', {
        hasManualPlacements,
        manualPlacementsCount: manualPlacements ? manualPlacements.length : 0,
        hasCalibrationData,
        calibrationPointsCount: calibrationPoints ? calibrationPoints.length : 0,
        hasTransformMatrix: !!transformMatrix,
        hasDrawingData,
        hasBoreholeData,
        boreholeCount: boreholeData ? boreholeData.length : 0,
        drawingImageDataSize: window.drawingImageData ? `${window.drawingImageData.width}x${window.drawingImageData.height}` : '없음'
    });

    if (manualPlacements && manualPlacements.length > 0) {
        console.log('📍 수동 배치된 시추공 목록:', manualPlacements.map(mp => mp.holeNo).join(', '));
    }
    if (calibrationPoints && calibrationPoints.length > 0) {
        console.log('📍 좌표 매칭 시추공 목록:', calibrationPoints.map(cp => cp.hole_no).join(', '));
    }

    // ✅ 픽셀 모드: 도면 매핑 또는 시추공 좌표 기반 표시
    if (usePixelMode) {
        updateContourMapPixelMode();
        return;
    }

    // 일반 모드: 기존 로직
    if (typeof window.universalTransformer === 'undefined' && typeof window.coordinateTransformer === 'undefined') {
        console.error('Coordinate transformer not initialized');
        return;
    }

    if (!window.visualizationData || !window.visualizationData.contour_data) {
        if (boreholeData && boreholeData.length > 0) {
            generateVisualizationData();
        } else {
            return;
        }
    }

    const data = window.visualizationData.contour_data[contourType];

    if (!data) {
        document.getElementById('contourPlot').innerHTML = '<div style="text-align:center; padding:50px;">데이터가 없습니다.</div>';
        return;
    }

    let plotX = [];
    let plotY = [];

    // 일반 모드: WGS84로 변환
    for (let i = 0; i < data.x.length; i++) {
        const coordX = data.x[i];
        const coordY = data.y[i];
        const wgs84 = transformToWGS84Universal(coordX, coordY);
        if (wgs84) {
            plotX.push(wgs84.lng);
            plotY.push(wgs84.lat);
        } else {
            plotX.push(null);
            plotY.push(null);
        }
    }
    console.log('🌍 등고선 맵: WGS84 좌표 사용');
    
    // 기존 wgs84X, wgs84Y 변수 호환성을 위해
    const wgs84X = plotX;
    const wgs84Y = plotY;

    // Z 값 범위 계산 (등고선 간격 설정용)
    let zMin = Infinity, zMax = -Infinity;
    data.z.forEach(row => {
        row.forEach(val => {
            if (val !== null && !isNaN(val)) {
                if (val < zMin) zMin = val;
                if (val > zMax) zMax = val;
            }
        });
    });

    // 등고선만 표시 모드인지 확인
    const linesOnlyMode = contourDisplayMode === 'lines';

    let traces = [];

    // 등고선만 모드: 흰 배경에 등고선 라인만 표시
    // 히트맵 모드: 기존 색상 채움 방식
    const useLines = showDrawingOverlay || linesOnlyMode;

    traces.push({
        z: data.z,
        x: wgs84X,  // 경도
        y: wgs84Y,  // 위도
        type: 'contour',
        colorscale: linesOnlyMode ? [
            // 등고선만 모드: 진한 색상의 등고선
            [0, '#1565C0'],
            [0.25, '#1976D2'],
            [0.5, '#2196F3'],
            [0.75, '#42A5F5'],
            [1, '#64B5F6']
        ] : (showDrawingOverlay ? [
            [0, 'rgba(68, 1, 84, 0.7)'],
            [0.25, 'rgba(59, 82, 139, 0.7)'],
            [0.5, 'rgba(33, 145, 140, 0.7)'],
            [0.75, 'rgba(94, 201, 98, 0.7)'],
            [1, 'rgba(253, 231, 37, 0.7)']
        ] : 'Viridis'),
        contours: {
            coloring: useLines ? 'lines' : 'heatmap',
            showlabels: true,
            labelfont: {
                size: linesOnlyMode ? 12 : 11,
                color: linesOnlyMode ? '#1565C0' : (hasDrawingData ? '#333' : 'white'),
                family: 'Arial Black'
            },
            start: Math.floor(zMin * 5) / 5,  // 0.2m 단위로 시작점 맞춤
            end: Math.ceil(zMax * 5) / 5,    // 0.2m 단위로 끝점 맞춤
            size: 0.2  // 등고선 간격 0.2m (촘촘하게)
        },
        line: {
            width: linesOnlyMode ? 2.5 : (showDrawingOverlay ? 2 : 1),
            smoothing: 1.3
        },
        showscale: !useLines,
        opacity: 1.0,
        colorbar: linesOnlyMode ? {
            title: contourTypeEl.options[contourTypeEl.selectedIndex].text + ' (m)',
            titleside: 'right',
            tickfont: { size: 11 }
        } : {}
    });

    // ✅ 시추공 좌표 처리 (도면 모드: TM 좌표, 일반 모드: WGS84)
    const boreholeCoords = boreholeData.map(b => {
        if (!b.x || !b.y) {
            console.debug(`⚠️ 시추공 ${b.holeNo}: 좌표 없음`);
            return { lng: null, lat: null, holeNo: b.holeNo, bh: b };
        }
        
        const coordX = parseFloat(b.x);
        const coordY = parseFloat(b.y);
        
        // ✅ 좌표 유효성 검사 (합리적인 TM 좌표 범위)
        const isValidCoord = !isNaN(coordX) && !isNaN(coordY) && 
                            (Math.abs(coordX) > 10000 || Math.abs(coordY) > 10000);
        
        if (!isValidCoord) {
            console.warn(`⚠️ 시추공 ${b.holeNo}: 좌표가 유효하지 않음 (${coordX}, ${coordY})`);
            return { lng: null, lat: null, holeNo: b.holeNo, bh: b };
        }
        
        // 일반 모드: WGS84로 변환
        const wgs84 = transformToWGS84Universal(coordX, coordY);
        if (wgs84) {
            return { lng: wgs84.lng, lat: wgs84.lat, holeNo: b.holeNo, bh: b };
        }
        return { lng: null, lat: null, holeNo: b.holeNo, bh: b };
    });

    // 2D 맵 판정 결과 체크박스 상태 확인
    const show2DFoundation = document.getElementById('chk2DFoundation')?.checked ?? true;
    const show2DSoftGround = document.getElementById('chk2DSoftGround')?.checked ?? false;
    const show2DSpecialLayer = document.getElementById('chk2DSpecialLayer')?.checked ?? false;

    // 시추공별 마커 색상 결정
    const markerColors = boreholeCoords.map((b, idx) => {
        // ✅ boreholeData와 다시 매칭 시도
        const bh = b.bh || boreholeData.find(bd => bd.holeNo === b.holeNo);
        
        if (!bh) {
            console.warn(`⚠️ 마커 색상 판정: 시추공 ${b.holeNo} 정보 불완전`);
            return '#9E9E9E';
        }
        
        // ✅ 필수 필드 검증
        if (!bh.holeNo || !bh.soilData) {
            console.warn(`⚠️ 마커 색상 판정: 시추공 ${b.holeNo}의 토층 정보 없음`, bh);
            return '#9E9E9E';
        }
        
        // ✅ 마커 색상 판정 실행
        const color = getContourMarkerColor(bh, show2DFoundation, show2DSoftGround, show2DSpecialLayer);
        console.debug(`🎨 마커 색상: ${b.holeNo} = ${color}`);
        return color;
    });

    // 시추공별 마커 크기 (다중 선택 시 더 크게)
    const selectedCount = [show2DFoundation, show2DSoftGround, show2DSpecialLayer].filter(v => v).length;
    const markerSize = selectedCount >= 2 ? 14 : 10;

    const boreholesTrace = {
        x: boreholeCoords.map(b => b.lng),  // 경도
        y: boreholeCoords.map(b => b.lat),  // 위도
        mode: 'markers+text',
        type: 'scatter',
        marker: {
            size: markerSize + 4,  // ✅ 마커 크기 증가
            color: markerColors,
            line: { color: 'white', width: 2.5 }
        },
        text: boreholeCoords.map(b => b.holeNo),
        textposition: 'top center',
        textfont: {
            size: 14,  // ✅ 폰트 크기 증가 (11 → 14)
            color: '#1565C0',  // ✅ 진한 파란색으로 가독성 향상
            family: 'Arial Black, sans-serif',
            weight: 'bold'
        },
        hoverinfo: 'text',
        name: '시추공'
    };
    traces.push(boreholesTrace);

    // 좌표 범위 계산
    const validLngs = wgs84X.filter(v => v !== null);
    const validLats = wgs84Y.filter(v => v !== null);
    const lngMin = Math.min(...validLngs);
    const lngMax = Math.max(...validLngs);
    const latMin = Math.min(...validLats);
    const latMax = Math.max(...validLats);

    // 일반 모드: WGS84 (위도/경도 비율 보정)
    const avgLat = (latMin + latMax) / 2;
    const latToMeter = 111320;
    const lngToMeter = 111320 * Math.cos(avgLat * Math.PI / 180);
    const aspectRatio = lngToMeter / latToMeter;

    const layout = {
        title: contourTypeEl.options[contourTypeEl.selectedIndex].text + (linesOnlyMode ? ' 등고선' : ' (WGS84)'),
        xaxis: {
            title: '경도 (Longitude)',
            scaleanchor: 'y',
            scaleratio: aspectRatio,
            tickformat: '.6f',
            gridcolor: linesOnlyMode ? '#E0E0E0' : undefined,
            zerolinecolor: linesOnlyMode ? '#BDBDBD' : undefined
        },
        yaxis: {
            title: '위도 (Latitude)',
            tickformat: '.6f',
            gridcolor: linesOnlyMode ? '#E0E0E0' : undefined,
            zerolinecolor: linesOnlyMode ? '#BDBDBD' : undefined
        },
        margin: { l: 80, r: linesOnlyMode ? 100 : 50, b: 60, t: 50 },
        hovermode: 'closest',
        autosize: true,
        plot_bgcolor: linesOnlyMode ? 'white' : undefined,
        paper_bgcolor: linesOnlyMode ? 'white' : undefined
    };

    // 도면 배경 이미지 추가 (체크박스가 켜지고, transformMatrix 또는 manualTransformMatrix가 있는 경우)
    if (showDrawingOverlay) {
        // transformMatrix 또는 manualTransformMatrix를 사용하여 도면의 실제 좌표 경계 계산
        const geoBounds = getDrawingGeoBounds();
        const pdfCanvas = document.getElementById('pdfCanvas');

        if (geoBounds && pdfCanvas && pdfCanvas.width > 0) {
            // ✅ TM 좌표 그대로 사용 (도면 왜곡 방지)
            const imgXMin = geoBounds.xMin;
            const imgYMin = geoBounds.yMin;
            const imgXMax = geoBounds.xMax;
            const imgYMax = geoBounds.yMax;
            
            // ✅ 회전이 적용된 이미지 생성
            let imageSource;
            
            if (contourRotation !== 0) {
                imageSource = getRotatedCanvasDataURL(pdfCanvas, contourRotation);
                console.log(`🔄 도면 회전 적용: ${contourRotation}°`);
            } else {
                imageSource = pdfCanvas.toDataURL('image/png');
            }
            
            // ✅ 도면 경계 계산 (TM 좌표)
            // Plotly 이미지는 y 좌표가 상단 기준
            let imgX = imgXMin;
            let imgY = imgYMax;  // Plotly 이미지 Y는 상단 (최대값)
            let imgSizeX = imgXMax - imgXMin;
            let imgSizeY = imgYMax - imgYMin;
            
            // 90도 또는 270도 회전 시 가로/세로 교환
            if (contourRotation === 90 || contourRotation === 270) {
                const centerX = (imgXMin + imgXMax) / 2;
                const centerY = (imgYMin + imgYMax) / 2;
                
                // 가로/세로 교환
                const tempSizeX = imgSizeX;
                imgSizeX = imgSizeY;
                imgSizeY = tempSizeX;
                
                // 중심 기준으로 재배치
                imgX = centerX - imgSizeX / 2;
                imgY = centerY + imgSizeY / 2;
            }

            layout.images = [{
                source: imageSource,
                xref: 'x',
                yref: 'y',
                x: imgX,
                y: imgY,
                sizex: imgSizeX,
                sizey: imgSizeY,
                sizing: 'stretch',
                opacity: 0.85,
                layer: 'below'
            }];

            // 배경색을 흰색으로 설정
            layout.plot_bgcolor = 'white';
            layout.paper_bgcolor = 'white';
            
            console.log('📐 도면 오버레이 경계 (TM):', {
                bounds: { xMin: imgXMin, yMin: imgYMin, xMax: imgXMax, yMax: imgYMax },
                image: { x: imgX, y: imgY, sizeX: imgSizeX, sizeY: imgSizeY },
                rotation: contourRotation
            });
        }
    }

    Plotly.newPlot('contourPlot', traces, layout, {responsive: true, scrollZoom: true});

    // Add click event
    const contourPlotEl = document.getElementById('contourPlot');
    contourPlotEl.on('plotly_click', function(data) {
        if (data.points.length > 0) {
            const pt = data.points[0];
            // Find closest borehole
            if (pt.data.name === '시추공') {
                // pt.text는 배열일 수 있으므로 pointIndex를 사용
                const holeNo = Array.isArray(pt.data.text) ? pt.data.text[pt.pointIndex] : pt.text;
                if (holeNo) {
                    // ✅ 개선: 다중 시추공 분석 모드가 아니어도, Shift 키를 누르면 선택 모드로 작동
                    const shiftPressed = data.event && data.event.shiftKey;
                    
                    if (multiBoreholeMode || shiftPressed) {
                        selectBorehole(holeNo);
                        
                        // ✅ Shift 클릭으로 처음 선택 시 안내 메시지
                        if (shiftPressed && !multiBoreholeMode && selectedBoreholes.length === 1) {
                            console.log('💡 Shift+클릭으로 시추공 선택 중. 2개 이상 선택하면 단면도가 표시됩니다.');
                        }
                    } else {
                        if (typeof showBoreholeLog === 'function') {
                            showBoreholeLog(holeNo);
                        }
                    }
                }
            }
        }
    });
    
    console.log('📊 등고선 맵 생성 완료:', {
        시추공수: boreholeData.length,
        유효좌표: boreholeCoords.filter(b => b.lng !== null).length,
        회전각도: contourRotation,
        도면오버레이: showDrawingOverlay
    });
}

// 선택된 시추공 목록 (단면도/분석용)
let selectedBoreholes = [];

// 등고선 맵에서 선택된 시추공 표시 및 연결선 업데이트
function updateContourMapSelection() {
    const contourPlot = document.getElementById('contourPlot');
    if (!contourPlot || !contourPlot.data) return;

    // ✅ 데이터 검증 추가
    if (!selectedBoreholes || selectedBoreholes.length === 0) {
        console.debug('선택된 시추공 없음');
        return;
    }
    
    // 기존 트레이스 수 확인 (등고선 + 시추공 기본 2개)
    const baseTraceCount = 2;

    // 추가 트레이스 제거 (선택 시추공, 연결선)
    if (contourPlot.data.length > baseTraceCount) {
        Plotly.deleteTraces('contourPlot', Array.from({ length: contourPlot.data.length - baseTraceCount }, (_, i) => baseTraceCount + i));
    }

    // ✅ 선택된 시추공의 boreholeData 인덱스 재구성
    const selectedBoreholeData = selectedBoreholes
        .map(holeNo => boreholeData.find(b => b.holeNo === holeNo))
        .filter(bh => bh !== undefined);
    
    if (selectedBoreholeData.length === 0) {
        console.warn('⚠️ 선택된 시추공이 boreholeData에 없습니다:', selectedBoreholes);
        return;
    }

    // ✅ 선택된 시추공 좌표 및 정보 일관성 검증
    selectedBoreholeData.forEach(bh => {
        if (!bh.x || !bh.y) {
            console.error(`❌ 시추공 ${bh.holeNo}의 좌표가 누락되었습니다:`, bh);
        }
        if (!bh.soilData) {
            console.error(`❌ 시추공 ${bh.holeNo}의 토층 정보가 누락되었습니다:`, bh);
        }
    });

    // 선택된 시추공의 좌표 수집 (WGS84 변환 적용)
    const selectedPoints = selectedBoreholes.map(holeNo => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh || !bh.x || !bh.y) {
            console.warn(`⚠️ 시추공 ${holeNo}: 좌표 정보 없음`, bh);
            return null;
        }

        // 범용 좌표 변환 함수 사용
        const coordX = parseFloat(bh.x);
        const coordY = parseFloat(bh.y);
        
        if (isNaN(coordX) || isNaN(coordY)) {
            console.warn(`⚠️ 시추공 ${holeNo}: 유효하지 않은 좌표 (x:${bh.x}, y:${bh.y})`);
            return null;
        }
        
        const wgs84 = transformToWGS84Universal(coordX, coordY);

        if (!wgs84) {
            console.warn(`⚠️ 시추공 ${holeNo}: 좌표 변환 실패`);
            return null;
        }

        console.debug(`✅ 선택 시추공 ${holeNo}: WGS84(${wgs84.lat.toFixed(6)}, ${wgs84.lng.toFixed(6)})`);

        return {
            holeNo,
            x: wgs84.lng,  // 경도
            y: wgs84.lat,  // 위도
            origX: coordX,
            origY: coordY,
            bh: bh  // ✅ 시추공 객체 참조 추가
        };
    }).filter(p => p !== null);

    if (selectedPoints.length === 0) return;

    const newTraces = [];

    // 연결선 추가 (2개 이상 선택 시)
    if (selectedPoints.length >= 2) {
        newTraces.push({
            x: selectedPoints.map(p => p.x),
            y: selectedPoints.map(p => p.y),
            mode: 'lines',
            type: 'scatter',
            line: { color: '#FF5722', width: 3, dash: 'solid' },
            hoverinfo: 'skip',
            name: '단면선',
            showlegend: true
        });
    }

    // 선택된 시추공 강조 마커
    newTraces.push({
        x: selectedPoints.map(p => p.x),
        y: selectedPoints.map(p => p.y),
        mode: 'markers+text',
        type: 'scatter',
        marker: {
            size: 14,
            color: '#4CAF50',
            symbol: 'circle',
            line: { color: 'white', width: 2 }
        },
        text: selectedPoints.map((p, idx) => `${idx + 1}`),
        textposition: 'middle center',
        textfont: { size: 10, color: 'white', family: 'Arial Black' },
        hoverinfo: 'text',
        hovertext: selectedPoints.map(p => `선택됨: ${p.holeNo}`),
        name: '선택된 시추공',
        showlegend: true
    });

    // 시추공 이름 라벨 (선택된 것만 상단에 표시)
    newTraces.push({
        x: selectedPoints.map(p => p.x),
        y: selectedPoints.map(p => p.y),
        mode: 'text',
        type: 'scatter',
        text: selectedPoints.map(p => p.holeNo),
        textposition: 'top center',
        textfont: { size: 11, color: '#D32F2F', family: 'Malgun Gothic' },
        hoverinfo: 'skip',
        showlegend: false
    });

    Plotly.addTraces('contourPlot', newTraces);
}

// ✅ 픽셀 좌표 모드: 수동 배치 시 도면과 시추공을 픽셀 좌표 그대로 표시
function updateContourMapPixelMode() {
    console.log('🖼️ 픽셀 좌표 모드 시작');

    // ✅ 도면 표시 여부 확인
    const showDrawingOverlay = document.getElementById('showDrawingOverlay2D')?.checked ?? false;

    // ✅ 전역 변수에서 도면 데이터 가져오기
    let canvasWidth = 800;
    let canvasHeight = 600;
    let imageSource = null;

    if (window.drawingImageData && window.drawingImageData.width > 0) {
        canvasWidth = window.drawingImageData.width;
        canvasHeight = window.drawingImageData.height;
        imageSource = window.drawingImageData.dataURL;
    }

    // 도면이 없고 시추공 데이터도 없으면 안내 메시지
    const hasManualPlacements = manualPlacements && manualPlacements.length > 0;
    const hasCalibrationData = calibrationPoints && calibrationPoints.length > 0;

    if (!hasManualPlacements && !hasCalibrationData && !boreholeData?.length) {
        document.getElementById('contourPlot').innerHTML = '<div style="text-align:center; padding:50px; color:#666;"><p>시추공 데이터가 없습니다.</p></div>';
        return;
    }

    console.log(`📐 캔버스 크기: ${canvasWidth} x ${canvasHeight}, 도면 표시: ${showDrawingOverlay}`);

    // ✅ 판정 결과 표시 여부 확인
    const showFoundation = document.getElementById('chk2DFoundation')?.checked ?? true;
    const showSoftGround = document.getElementById('chk2DSoftGround')?.checked ?? false;
    const showSpecialLayer = document.getElementById('chk2DSpecialLayer')?.checked ?? false;
    const showContourOverlay = document.getElementById('chk2DContourOverlay')?.checked ?? false;
    const selectedContourType = document.getElementById('sel2DContourType')?.value || 'groundElevation';

    const foundationResults = window.simpleFoundationResults || [];
    const weakSoilResults = window.weakSoilAnalysisResults || window.weakSoilResults || [];
    const boulderResults = window.boulderDetectionResults || window.boulderResults || [];

    console.log(`📊 판정 결과 표시 옵션:`, { showFoundation, showSoftGround, showSpecialLayer, showContourOverlay });
    console.log(`📊 분석 결과 개수: 직접기초=${foundationResults.length}, 연약지반=${weakSoilResults.length}, 전석/특이층=${boulderResults.length}`);

    // ✅ 연약지반 체크 - 개선된 로직
    function hasSoftGround(holeNo) {
        const result = weakSoilResults.find(r => r.holeNo === holeNo || r.hole_no === holeNo);
        const hasSoft = result && (result.totalWeakZones > 0 || result.weak_soil_detected);
        if (hasSoft) console.log(`🔴 연약지반 탐지: ${holeNo}`);
        return hasSoft;
    }

    // ✅ 전석/붕적/이암 체크 - 개선된 로직
    function hasSpecialLayer(holeNo) {
        const result = boulderResults.find(r => r.holeNo === holeNo || r.hole_no === holeNo);
        const hasSpecial = result && (
            (result.totalBoulderCount && result.totalBoulderCount > 0) ||
            (result.totalColluvialCount && result.totalColluvialCount > 0) ||
            (result.detectedBoulders && result.detectedBoulders.length > 0) ||
            (result.detectedColluvial && result.detectedColluvial.length > 0)
        );
        if (hasSpecial) console.log(`🟠 전석/특이층 탐지: ${holeNo}`);
        return hasSpecial;
    }

    // ✅ 판정 결과에 따른 색상 및 필터링 결정 - 완전 개선된 로직
    function getBoreholeInfo(holeNo) {
        let color = '#1565C0'; // 기본 파란색
        let visible = true;
        let symbol = 'circle';

        const isSoft = hasSoftGround(holeNo);
        const isSpecial = hasSpecialLayer(holeNo);

        // ✅ 필터링 로직: 체크된 필터에 해당하는 시추공만 표시
        // 연약지반만 체크: 연약지반인 것만 표시
        // 전석/특이층만 체크: 전석/특이층인 것만 표시
        // 둘 다 체크: 둘 중 하나라도 해당하면 표시
        // 직접기초만 체크 (또는 아무것도 체크 안함): 모두 표시

        const onlySoftGround = showSoftGround && !showSpecialLayer && !showFoundation;
        const onlySpecialLayer = showSpecialLayer && !showSoftGround && !showFoundation;
        const softAndSpecial = showSoftGround && showSpecialLayer && !showFoundation;

        if (onlySoftGround) {
            visible = isSoft;
        } else if (onlySpecialLayer) {
            visible = isSpecial;
        } else if (softAndSpecial) {
            visible = isSoft || isSpecial;
        }
        // 그 외의 경우 (showFoundation이 true이거나 아무것도 안 체크)는 모두 표시

        // ✅ 색상 및 심볼 결정: 체크박스 상태에 따라 결정
        // 연약지반 체크 + 해당 시추공이 연약지반 -> 빨간색 삼각형
        // 전석/특이층 체크 + 해당 시추공이 특이층 -> 주황색 다이아몬드
        // 직접기초 체크 -> 판정 결과에 따른 색상
        // 기본 -> 파란색 원

        if (showSoftGround && isSoft) {
            color = '#E53935'; // 빨간색
            symbol = 'triangle-up';
        } else if (showSpecialLayer && isSpecial) {
            color = '#FF9800'; // 주황색
            symbol = 'diamond';
        } else if (showFoundation) {
            const result = foundationResults.find(r => r.holeNo === holeNo || r.hole_no === holeNo);
            if (result) {
                if (result.judgment === '직접 기초') {
                    color = '#2E7D32'; // 초록색
                    symbol = 'circle';
                } else if (result.judgment?.includes('치환')) {
                    color = '#F57C00'; // 주황색
                    symbol = 'square';
                } else if (result.judgment === '파일 기초 필요') {
                    color = '#C62828'; // 빨간색
                    symbol = 'x';
                }
            } else {
                color = '#9E9E9E'; // 미판정: 회색
            }
        }

        return { color, visible, symbol };
    }

    // ✅ 시추공들의 픽셀 좌표 (수동 배치 + 좌표 매칭 모두 지원)
    const boreholeX = [];
    const boreholeY = [];
    const boreholeNames = [];
    const boreholeColors = [];
    const boreholeSymbols = [];
    const processedHoles = new Set();

    // 헬퍼: 시추공 추가
    function addBorehole(holeNo, pixelX, pixelY) {
        const info = getBoreholeInfo(holeNo);
        if (!info.visible && (showSoftGround || showSpecialLayer)) return; // 필터링 적용

        boreholeX.push(pixelX);
        boreholeY.push(canvasHeight - pixelY);
        boreholeNames.push(holeNo);
        boreholeColors.push(info.color);
        boreholeSymbols.push(info.symbol);
    }

    // 1. 수동 배치된 시추공 먼저 추가
    if (manualPlacements && manualPlacements.length > 0) {
        console.log(`📍 수동 배치 시추공: ${manualPlacements.length}개`);
        manualPlacements.forEach(mp => {
            if (processedHoles.has(mp.holeNo)) return;
            processedHoles.add(mp.holeNo);
            addBorehole(mp.holeNo, mp.pixelX, mp.pixelY);
        });
    }

    // 2. ✅ 좌표 매칭된 시추공 추가 (calibrationPoints)
    if (calibrationPoints && calibrationPoints.length > 0) {
        console.log(`📍 좌표 매칭 시추공: ${calibrationPoints.length}개`);
        calibrationPoints.forEach(cp => {
            if (processedHoles.has(cp.hole_no)) return;
            processedHoles.add(cp.hole_no);
            addBorehole(cp.hole_no, cp.pixelX, cp.pixelY);
        });
    }

    // 3. ✅ transformMatrix가 있으면 나머지 시추공도 변환하여 추가
    if (transformMatrix && boreholeData && boreholeData.length > 0) {
        const { a, b, c, d, e, f } = transformMatrix;
        console.log(`📍 transformMatrix로 추가 시추공 변환`);

        boreholeData.forEach(bh => {
            const holeNo = bh.holeNo || bh.hole_no;
            if (processedHoles.has(holeNo)) return;
            if (!bh.x || !bh.y) return;

            const pixelX = a * parseFloat(bh.x) + b * parseFloat(bh.y) + c;
            const pixelY = d * parseFloat(bh.x) + e * parseFloat(bh.y) + f;

            if (pixelX >= 0 && pixelX <= canvasWidth && pixelY >= 0 && pixelY <= canvasHeight) {
                processedHoles.add(holeNo);
                addBorehole(holeNo, pixelX, pixelY);
            }
        });
    }

    // 4. ✅ 도면이 없을 때: TM 좌표를 직접 사용하여 상대적 위치로 표시
    if (processedHoles.size === 0 && boreholeData && boreholeData.length > 0) {
        console.log(`📍 도면 없음 - TM 좌표 기반 상대 위치 표시`);

        // TM 좌표 범위 계산
        const validBoreholes = boreholeData.filter(bh => bh.x && bh.y);
        if (validBoreholes.length > 0) {
            const xs = validBoreholes.map(bh => parseFloat(bh.x));
            const ys = validBoreholes.map(bh => parseFloat(bh.y));
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const rangeX = maxX - minX || 1;
            const rangeY = maxY - minY || 1;

            // 캔버스 크기 재설정 (TM 좌표 비율 유지)
            const aspectRatio = rangeX / rangeY;
            if (aspectRatio > 1) {
                canvasWidth = 800;
                canvasHeight = Math.round(800 / aspectRatio);
            } else {
                canvasHeight = 600;
                canvasWidth = Math.round(600 * aspectRatio);
            }
            const padding = 50;

            validBoreholes.forEach(bh => {
                const holeNo = bh.holeNo || bh.hole_no;
                if (processedHoles.has(holeNo)) return;

                // TM 좌표를 캔버스 픽셀로 변환
                const pixelX = padding + ((parseFloat(bh.x) - minX) / rangeX) * (canvasWidth - 2 * padding);
                const pixelY = padding + ((parseFloat(bh.y) - minY) / rangeY) * (canvasHeight - 2 * padding);

                processedHoles.add(holeNo);
                addBorehole(holeNo, pixelX, canvasHeight - pixelY); // Y 반전
            });
        }
    }

    console.log(`📍 총 시추공 ${boreholeX.length}개 표시 (수동: ${manualPlacements?.length || 0}, 매칭: ${calibrationPoints?.length || 0}, TM좌표: ${processedHoles.size})`);

    // ✅ 선택된 시추공 수 업데이트
    const countEl = document.getElementById('selectedBoreholeCount');
    if (countEl) {
        countEl.textContent = `선택: ${selectedBoreholes?.length || 0}개`;
    }
    
    // Plotly traces
    const traces = [];

    console.log(`📊 이미지 데이터 체크: dataURL 길이 = ${imageSource?.length || 0}바이트`);

    // ✅ 등고선 오버레이 추가 (선택된 경우)
    if (showContourOverlay && boreholeX.length >= 3) {
        console.log(`📈 등고선 오버레이 생성 시작 - 타입: ${selectedContourType}`);

        // 시추공 데이터에서 등고선 값 가져오기
        const contourPoints = [];
        boreholeNames.forEach((holeNo, idx) => {
            const bh = boreholeData?.find(b => (b.holeNo || b.hole_no) === holeNo);
            if (!bh) return;

            let zValue = null;
            switch (selectedContourType) {
                case 'groundElevation':
                    zValue = parseFloat(bh.groundElevation || bh.ground_elevation || bh.GL);
                    break;
                case 'groundwaterLevel':
                    zValue = parseFloat(bh.groundwaterLevel || bh.gwl || bh.GWL);
                    break;
                case 'weatheredRock':
                    zValue = parseFloat(bh.weatheredRockElevation || bh.weathered_rock_elevation);
                    break;
                case 'bedrock':
                    zValue = parseFloat(bh.bedrockElevation || bh.bedrock_elevation || bh.softRockElevation);
                    break;
            }

            if (zValue && !isNaN(zValue)) {
                contourPoints.push({
                    x: boreholeX[idx],
                    y: boreholeY[idx],
                    z: zValue
                });
            }
        });

        console.log(`📈 등고선용 데이터 포인트: ${contourPoints.length}개`);

        if (contourPoints.length >= 3) {
            // IDW 보간으로 그리드 생성
            const gridSize = 30; // 그리드 해상도
            const xMin = Math.min(...contourPoints.map(p => p.x));
            const xMax = Math.max(...contourPoints.map(p => p.x));
            const yMin = Math.min(...contourPoints.map(p => p.y));
            const yMax = Math.max(...contourPoints.map(p => p.y));

            const xRange = xMax - xMin;
            const yRange = yMax - yMin;
            const padding = Math.max(xRange, yRange) * 0.1;

            const gridX = [];
            const gridY = [];
            const gridZ = [];

            for (let i = 0; i <= gridSize; i++) {
                gridX.push(xMin - padding + (xRange + 2 * padding) * i / gridSize);
            }
            for (let j = 0; j <= gridSize; j++) {
                gridY.push(yMin - padding + (yRange + 2 * padding) * j / gridSize);
            }

            // IDW 보간
            const power = 2;
            for (let j = 0; j <= gridSize; j++) {
                const row = [];
                for (let i = 0; i <= gridSize; i++) {
                    const px = gridX[i];
                    const py = gridY[j];

                    let sumWeights = 0;
                    let sumValues = 0;

                    contourPoints.forEach(point => {
                        const dist = Math.sqrt((px - point.x) ** 2 + (py - point.y) ** 2);
                        if (dist < 0.001) {
                            sumWeights = 1;
                            sumValues = point.z;
                        } else {
                            const weight = 1 / Math.pow(dist, power);
                            sumWeights += weight;
                            sumValues += weight * point.z;
                        }
                    });

                    row.push(sumWeights > 0 ? sumValues / sumWeights : null);
                }
                gridZ.push(row);
            }

            // 등고선 Trace 추가
            const contourColors = {
                'groundElevation': [[0, '#4CAF50'], [0.5, '#FFC107'], [1, '#F44336']],
                'groundwaterLevel': [[0, '#2196F3'], [0.5, '#00BCD4'], [1, '#3F51B5']],
                'weatheredRock': [[0, '#795548'], [0.5, '#FF9800'], [1, '#FFEB3B']],
                'bedrock': [[0, '#607D8B'], [0.5, '#9E9E9E'], [1, '#E0E0E0']]
            };

            traces.push({
                x: gridX,
                y: gridY,
                z: gridZ,
                type: 'contour',
                colorscale: contourColors[selectedContourType] || contourColors['groundElevation'],
                contours: {
                    coloring: 'lines',
                    showlabels: true,
                    labelfont: { size: 10, color: '#333' }
                },
                line: { width: 1.5 },
                opacity: 0.7,
                showscale: false,
                hoverinfo: 'z',
                name: '등고선'
            });

            console.log(`✅ 등고선 오버레이 추가 완료`);
        } else {
            console.warn('⚠️ 등고선 생성을 위한 데이터가 부족합니다 (최소 3개 필요)');
        }
    }

    // ✅ 시추공 마커 - 등고선 위에 표시되도록 마지막에 추가
    traces.push({
        x: boreholeX,
        y: boreholeY,
        mode: 'markers+text',
        type: 'scatter',
        marker: {
            size: 20,
            color: boreholeColors,
            symbol: boreholeSymbols,
            line: { color: 'white', width: 2.5 }
        },
        text: boreholeNames,
        textposition: 'top center',
        textfont: {
            size: 12,
            color: '#333',
            family: 'Arial, sans-serif'
        },
        hoverinfo: 'text',
        hovertext: boreholeNames.map(name => `시추공: ${name}`),
        name: '시추공'
    });

    console.log(`📍 시추공 마커 추가: ${boreholeX.length}개, 색상: ${boreholeColors.join(', ')}`);

    // Layout - ✅ X/Y 축 라벨 및 눈금 숨김
    const layout = {
        title: '',
        xaxis: {
            range: [0, canvasWidth],
            scaleanchor: 'y',
            scaleratio: 1,
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            showline: false
        },
        yaxis: {
            range: [0, canvasHeight],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            showline: false
        },
        margin: { l: 10, r: 10, b: 10, t: 10 },
        hovermode: 'closest',
        autosize: true,
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent'
    };
    
    // ✅ 도면 이미지 배경 (showDrawingOverlay가 체크된 경우에만)
    if (showDrawingOverlay && imageSource && imageSource.length > 100) {
        layout.images = [{
            source: imageSource,
            xref: 'x',
            yref: 'y',
            x: 0,
            y: canvasHeight,  // Plotly 이미지는 상단 Y 기준
            sizex: canvasWidth,
            sizey: canvasHeight,
            sizing: 'stretch',
            opacity: 0.9,
            layer: 'below'
        }];
        console.log('✅ 도면 이미지가 Plotly 레이아웃에 추가됨');
    } else if (!showDrawingOverlay) {
        // 도면 표시 꺼짐 - 밝은 배경
        layout.plot_bgcolor = '#FAFAFA';
        layout.paper_bgcolor = '#FAFAFA';
        console.log('ℹ️ 도면 표시 꺼짐 - 시추공만 표시');
    } else {
        console.warn('⚠️ 도면 이미지 데이터가 유효하지 않음, 도면 없이 표시합니다');
    }

    Plotly.newPlot('contourPlot', traces, layout, {responsive: true, scrollZoom: true});

    // 클릭 이벤트 추가
    const contourPlotEl = document.getElementById('contourPlot');
    contourPlotEl.on('plotly_click', function(data) {
        if (data.points.length > 0) {
            const pt = data.points[0];
            if (pt.data.name === '시추공') {
                const holeNo = Array.isArray(pt.data.text) ? pt.data.text[pt.pointIndex] : pt.text;
                console.log(`🔍 시추공 클릭: ${holeNo}`);

                // ✅ Shift+클릭으로도 다중 선택 가능
                const shiftPressed = data.event && data.event.shiftKey;

                if (multiBoreholeMode || shiftPressed) {
                    // 다중 선택 모드 또는 Shift+클릭
                    if (!selectedBoreholes.includes(holeNo)) {
                        selectedBoreholes.push(holeNo);
                    } else {
                        selectedBoreholes = selectedBoreholes.filter(h => h !== holeNo);
                    }
                    updateSelectionUI();
                    updateContourMapSelectionPixelMode();

                    // ✅ Shift 클릭으로 처음 선택 시 안내 메시지
                    if (shiftPressed && !multiBoreholeMode && selectedBoreholes.length === 1) {
                        console.log('💡 Shift+클릭으로 시추공 선택 중. 2개 이상 선택하면 단면도가 표시됩니다.');
                    }

                    // 2개 이상 선택 시 자동으로 단면도 업데이트
                    if (selectedBoreholes.length >= 2) {
                        updateCrossSection();
                    }
                } else {
                    // ✅ 단일 선택 모드 - showBoreholeLog 호출
                    console.log(`🔍 단일 시추공 선택: ${holeNo}`);
                    if (typeof showBoreholeLog === 'function') {
                        showBoreholeLog(holeNo);
                    } else {
                        console.warn('⚠️ showBoreholeLog 함수가 없습니다');
                    }
                }
            }
        }
    });

    console.log('✅ 픽셀 좌표 모드 완료');
}

// 픽셀 모드에서 선택된 시추공 표시
function updateContourMapSelectionPixelMode() {
    if (selectedBoreholes.length < 2) return;
    if (!window.drawingImageData) return;
    
    const canvasHeight = window.drawingImageData.height;
    
    // 선택된 시추공들의 좌표
    const lineX = [];
    const lineY = [];
    
    selectedBoreholes.forEach(holeNo => {
        const mp = manualPlacements.find(m => m.holeNo === holeNo);
        if (mp) {
            lineX.push(mp.pixelX);
            lineY.push(canvasHeight - mp.pixelY);
        }
    });
    
    // 연결선 추가
    Plotly.addTraces('contourPlot', [{
        x: lineX,
        y: lineY,
        mode: 'lines',
        type: 'scatter',
        line: { color: '#4CAF50', width: 3, dash: 'dash' },
        name: '단면도 경로'
    }]);
}

// ✅ 회전된 캔버스 이미지 데이터 URL 생성
function getRotatedCanvasDataURL(sourceCanvas, rotationDegrees) {
    if (!sourceCanvas || rotationDegrees === 0) {
        return sourceCanvas.toDataURL('image/png');
    }
    
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    
    // 90도 또는 270도 회전 시 가로/세로 교환
    if (rotationDegrees === 90 || rotationDegrees === 270) {
        tempCanvas.width = h;
        tempCanvas.height = w;
    } else {
        tempCanvas.width = w;
        tempCanvas.height = h;
    }
    
    ctx.save();
    
    // 중심으로 이동
    ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    
    // 회전 (라디안으로 변환)
    ctx.rotate(rotationDegrees * Math.PI / 180);
    
    // 원본 이미지의 중심이 회전 중심에 오도록
    ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
    
    ctx.restore();
    
    return tempCanvas.toDataURL('image/png');
}

// 등고선 맵 회전 업데이트
function updateContourRotation() {
    const select = document.getElementById('contourRotation');
    if (select) {
        contourRotation = parseInt(select.value) || 0;
        console.log(`🔄 등고선 맵 회전 설정: ${contourRotation}°`);
        updateContourMap();
    }
}

// 등고선 맵 90도 회전 버튼
function rotateContour90() {
    const select = document.getElementById('contourRotation');
    if (select) {
        const currentValue = parseInt(select.value) || 0;
        const newValue = (currentValue + 90) % 360;
        select.value = newValue.toString();
        contourRotation = newValue;
        updateContourMap();
    }
}

// 등고선 맵 회전 초기화
function resetContourRotation() {
    const select = document.getElementById('contourRotation');
    if (select) {
        select.value = '0';
        contourRotation = 0;
        updateContourMap();
    }
}

function selectBorehole(holeNo) {
    const index = selectedBoreholes.indexOf(holeNo);
    if (index === -1) {
        // 제한 없이 추가 가능
        selectedBoreholes.push(holeNo);
    } else {
        selectedBoreholes.splice(index, 1);
    }

    updateSelectionUI();
    updateCrossSection();
    updateContourMapSelection(); // 등고선 맵에서 선택된 시추공 표시 및 연결선 업데이트
}

// 다중 시추공 분석 모드 토글
function toggleMultiBoreholeMode() {
    console.log('🔄 toggleMultiBoreholeMode 함수 실행');
    multiBoreholeMode = !multiBoreholeMode;
    console.log(`📌 multiBoreholeMode: ${multiBoreholeMode}`);

    const btn = document.getElementById('toggleMultiModeBtn');
    console.log(`🔘 버튼 요소:`, btn);

    if (btn) {
        if (multiBoreholeMode) {
            btn.textContent = '선택 완료';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            console.log('✅ 다중 시추공 분석 모드 활성화');
        } else {
            btn.textContent = '다중 선택 모드';
            btn.style.background = '';
            btn.style.color = '';
            clearSelection();
            console.log('✅ 다중 시추공 분석 모드 비활성화');
        }
    } else {
        console.error('❌ toggleMultiModeBtn 버튼을 찾을 수 없습니다');
    }

    updateSelectionUI();
}

function clearSelection() {
    selectedBoreholes = [];
    updateSelectionUI();
    updateContourMapSelection(); // 등고선 맵에서 선택 표시 제거
    const crossSectionDiv = document.getElementById('crossSectionPlot');
    if (crossSectionDiv) {
        crossSectionDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><p>단면도를 보려면 2개 이상의 시추공을 선택하세요.</p><p style="font-size: 12px; margin-top: 10px;">등고선 맵에서 시추공(빨간 마커)을 클릭하여 선택하세요.</p></div>';
    }
}

function updateSelectionUI() {
    const div = document.getElementById('selectedBoreholes');

    // ✅ 2D 맵의 선택 카운터 업데이트
    const countEl = document.getElementById('selectedBoreholeCount');
    if (countEl) {
        countEl.textContent = `선택: ${selectedBoreholes?.length || 0}개`;
    }

    // ✅ 단면도 버튼 활성화/비활성화
    const btn = document.getElementById('multiAnalysisBtn');
    if (btn) {
        btn.disabled = selectedBoreholes.length < 2;
        if (selectedBoreholes.length >= 2) {
            btn.textContent = `단면도 보기 (${selectedBoreholes.length}개)`;
            btn.style.background = '#e74c3c';
        } else {
            btn.textContent = '단면도 보기';
            btn.style.background = '#ccc';
        }
    }

    if (!div) return;

    if (selectedBoreholes.length === 0) {
        if (multiBoreholeMode) {
            div.textContent = '다중 시추공 분석 모드: 지도에서 시추공을 클릭하여 선택하세요';
        } else {
            div.textContent = '시추공을 클릭하면 주상도가 표시됩니다. 다중 시추공 분석 모드를 활성화하면 단면도를 작성할 수 있습니다.';
        }
    } else {
        div.innerHTML = `선택된 시추공 (${selectedBoreholes.length}개): ` + selectedBoreholes.map(h => `<span class="badge" style="background:#4CAF50; color:white; padding:4px 8px; border-radius:4px; margin:0 3px; font-weight:bold;">${h}</span>`).join(' ');
    }
}

function showMultiBoreholeAnalysis() {
    if (selectedBoreholes.length < 2) {
        alert('단면도를 보려면 2개 이상의 시추공을 선택해주세요.');
        return;
    }
    
    // 단면도 결과 영역 표시
    const resultArea = document.getElementById('multiBoreholeResultArea');
    if (resultArea) {
        resultArea.style.display = 'block';
    }
    
    // 단면도는 이미 updateCrossSection()에서 자동으로 그려지므로
    // 여기서는 단면도 영역으로 스크롤하거나 추가 분석을 수행할 수 있습니다
    const crossSectionDiv = document.getElementById('crossSectionPlot');
    if (crossSectionDiv) {
        crossSectionDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 1. 시추공 데이터에서 4대 지층 경계 추출 (기존 호환용)
function getLayerBoundaries(borehole) {
    const groundElev = parseFloat(borehole.groundElevation || 0);
    let boundaries = {
        surface: groundElev,
        layer1_bottom: groundElev,
        layer2_bottom: groundElev,
        layer3_bottom: groundElev,
        bedrock_top: groundElev - (parseFloat(borehole.totalDepth) || 0)
    };

    if (!borehole.soilData || borehole.soilData.length === 0) return boundaries;

    let currentDepth = 0;
    let currentLayer = 0;
    let layerDepths = { 1: 0, 2: 0, 3: 0, 4: 0 };

    borehole.soilData.forEach(layer => {
        const soilName = (layer.soil_name || '').trim();
        let layerType = 2; // 기본값: 퇴적/자갈

        if (soilName.includes('매립') || soilName.includes('표토')) layerType = 1;
        else if (soilName.includes('풍화')) layerType = 3;
        else if (soilName.includes('연암') || soilName.includes('보통암') || soilName.includes('경암') || soilName.includes('기반암') || soilName.includes('암반')) layerType = 4;

        // 심도 파싱
        let bottomDepth = currentDepth;
        const depthMatch = layer.depth_range.match(/~?\s*(\d+\.?\d*)/);
        if (depthMatch) {
            bottomDepth = parseFloat(depthMatch[1]);
        } else {
             const thickness = parseFloat(layer.thickness);
             if (!isNaN(thickness)) bottomDepth = currentDepth + thickness;
        }

        // 층서 논리 보정
        if (layerType > currentLayer) {
            for (let i = currentLayer + 1; i < layerType; i++) layerDepths[i] = currentDepth;
            currentLayer = layerType;
        }

        layerDepths[layerType] = bottomDepth;
        currentDepth = bottomDepth;
    });

    // 나머지 층도 채움
    for (let i = currentLayer + 1; i <= 4; i++) layerDepths[i] = currentDepth;

    // EL 계산
    boundaries.layer1_bottom = groundElev - layerDepths[1];
    boundaries.layer2_bottom = groundElev - layerDepths[2];
    boundaries.layer3_bottom = groundElev - layerDepths[3];
    boundaries.bedrock_top = groundElev - layerDepths[3];

    return boundaries;
}

// 토질명에서 지질 유형 분류 (단면도용)
function classifySoilTypeForCrossSection(soilName) {
    const name = (soilName || '').toLowerCase();

    // 암반류
    if (name.includes('경암') || name.includes('보통암'))
        return { type: 'hard_rock', label: '경암/보통암', color: '#2F4F4F', order: 10 };
    if (name.includes('연암'))
        return { type: 'soft_rock', label: '연암', color: '#696969', order: 9 };
    if (name.includes('풍화암'))
        return { type: 'weathered_rock', label: '풍화암', color: '#808080', order: 8 };

    // 풍화토/잔류토
    if (name.includes('풍화토') || name.includes('풍화잔류토') || name.includes('잔류토'))
        return { type: 'weathered_soil', label: '풍화토', color: '#CD853F', order: 7 };

    // 붕적층
    if (name.includes('붕적') || name.includes('colluvium') || name.includes('colluvial'))
        return { type: 'colluvial', label: '붕적층', color: '#03A9F4', order: 6 };

    // 이암/셰일
    if (name.includes('이암') || name.includes('셰일') || name.includes('shale') || name.includes('mudstone'))
        return { type: 'mudstone', label: '이암/셰일', color: '#607D8B', order: 5 };

    // 전석/호박돌
    if (name.includes('전석') || name.includes('호박돌') || name.includes('boulder') || name.includes('cobble'))
        return { type: 'boulder', label: '전석/호박돌', color: '#FF9800', order: 4 };

    // 자갈
    if (name.includes('자갈') || name.includes('역') || name.includes('gravel'))
        return { type: 'gravel', label: '자갈', color: '#A0522D', order: 3 };

    // 모래
    if (name.includes('모래') || name.includes('사') || name.includes('sand'))
        return { type: 'sand', label: '모래', color: '#F4A460', order: 2 };

    // 실트
    if (name.includes('실트') || name.includes('silt'))
        return { type: 'silt', label: '실트', color: '#D2691E', order: 1 };

    // 점토
    if (name.includes('점토') || name.includes('clay'))
        return { type: 'clay', label: '점토', color: '#8B4513', order: 0 };

    // 매립토/표토
    if (name.includes('매립') || name.includes('fill') || name.includes('표토'))
        return { type: 'fill', label: '매립토/표토', color: '#9ACD32', order: -1 };

    // 기타
    return { type: 'other', label: '기타', color: '#DEB887', order: -2 };
}

// 시추공별 상세 레이어 정보 추출
function getDetailedLayers(borehole) {
    const groundElev = parseFloat(borehole.groundElevation || 0);
    const layers = [];

    if (!borehole.soilData || borehole.soilData.length === 0) return layers;

    borehole.soilData.forEach((layer, idx) => {
        const soilName = (layer.soil_name || '').trim();
        const soilType = classifySoilTypeForCrossSection(soilName);

        // 심도 파싱
        let depthStart = 0, depthEnd = 0;
        const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
        if (depthMatch) {
            depthStart = parseFloat(depthMatch[1]);
            depthEnd = parseFloat(depthMatch[2]);
        } else {
            const singleDepthMatch = layer.depth_range.match(/(\d+\.?\d*)/);
            if (singleDepthMatch) {
                depthEnd = parseFloat(singleDepthMatch[1]);
                if (idx > 0 && layers.length > 0) {
                    depthStart = layers[layers.length - 1].depthEnd;
                }
            }
        }

        layers.push({
            index: idx,
            soilName: soilName,
            soilType: soilType.type,
            label: soilType.label,
            color: soilType.color,
            order: soilType.order,
            depthStart: depthStart,
            depthEnd: depthEnd,
            thickness: depthEnd - depthStart,
            elevationTop: groundElev - depthStart,
            elevationBottom: groundElev - depthEnd
        });
    });

    return layers;
}

// 2. IDW 보간
function calculateIDWValue(x, y, points, valueKey, p = 2) {
    let numerator = 0, denominator = 0;
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const dist = Math.sqrt(Math.pow(x - pt.x, 2) + Math.pow(y - pt.y, 2));
        if (dist < 0.1) return pt[valueKey];
        const weight = 1 / Math.pow(dist, p);
        numerator += weight * pt[valueKey];
        denominator += weight;
    }
    return denominator === 0 ? 0 : numerator / denominator;
}

// 3. 경로 생성
function generateInterpolatedPath(boreholes, segmentCount = 50) {
    let pathPoints = [], cumulativeDist = 0;
    for (let i = 0; i < boreholes.length - 1; i++) {
        const start = boreholes[i], end = boreholes[i+1];
        const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        for (let j = 0; j < segmentCount; j++) {
            const t = j / segmentCount;
            pathPoints.push({
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
                dist: cumulativeDist + dist * t
            });
        }
        cumulativeDist += dist;
    }
    const last = boreholes[boreholes.length - 1];
    pathPoints.push({ x: last.x, y: last.y, dist: cumulativeDist });
    return pathPoints;
}

// ============================================
// 고급 지층 보간 알고리즘 (Kriging + Spline)
// ============================================

// Catmull-Rom 스플라인 보간 (부드러운 곡선 생성)
function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

// 지층 경계 스플라인 보간
function interpolateLayerBoundary(controlPoints, numPoints) {
    if (controlPoints.length < 2) return controlPoints;
    if (controlPoints.length === 2) {
        // 선형 보간
        const result = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            result.push({
                dist: controlPoints[0].dist + t * (controlPoints[1].dist - controlPoints[0].dist),
                elev: controlPoints[0].elev + t * (controlPoints[1].elev - controlPoints[0].elev)
            });
        }
        return result;
    }

    const result = [];
    const n = controlPoints.length;

    // 끝점 확장 (스플라인 계산용)
    const extended = [
        { dist: controlPoints[0].dist - (controlPoints[1].dist - controlPoints[0].dist),
          elev: controlPoints[0].elev - (controlPoints[1].elev - controlPoints[0].elev) * 0.5 },
        ...controlPoints,
        { dist: controlPoints[n-1].dist + (controlPoints[n-1].dist - controlPoints[n-2].dist),
          elev: controlPoints[n-1].elev + (controlPoints[n-1].elev - controlPoints[n-2].elev) * 0.5 }
    ];

    const totalDist = controlPoints[n-1].dist - controlPoints[0].dist;
    const pointsPerSegment = Math.ceil(numPoints / (n - 1));

    for (let i = 0; i < n - 1; i++) {
        const segmentPoints = (i === n - 2) ? numPoints - result.length : pointsPerSegment;
        for (let j = 0; j < segmentPoints; j++) {
            const t = j / segmentPoints;
            const dist = catmullRomSpline(
                extended[i].dist, extended[i+1].dist, extended[i+2].dist, extended[i+3].dist, t
            );
            const elev = catmullRomSpline(
                extended[i].elev, extended[i+1].elev, extended[i+2].elev, extended[i+3].elev, t
            );
            result.push({ dist, elev });
        }
    }
    result.push(controlPoints[n-1]);

    return result;
}

// 지질학적 변동성을 고려한 레이어 두께 보간
function interpolateLayerThicknessWithVariability(pt1Layers, pt2Layers, dist1, dist2, numPoints, groundElev1, groundElev2) {
    const interpolatedLayers = [];

    // 지표면 보간 (스플라인)
    const surfacePoints = [
        { dist: dist1, elev: groundElev1 },
        { dist: dist2, elev: groundElev2 }
    ];

    // 각 레이어의 하단 경계 보간
    const maxLayers = Math.max(pt1Layers.length, pt2Layers.length);

    for (let layerIdx = 0; layerIdx < maxLayers; layerIdx++) {
        const l1 = pt1Layers[Math.min(layerIdx, pt1Layers.length - 1)];
        const l2 = pt2Layers[Math.min(layerIdx, pt2Layers.length - 1)];

        // 레이어 타입이 다르면 전이 구간 생성
        const isSameType = l1.soilType === l2.soilType;

        const layerPoints = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);

            // 비선형 보간 (지질학적 변동성 반영)
            // 지층 경계는 완전히 선형적이지 않음 - 약간의 곡률 추가
            const variability = Math.sin(t * Math.PI) * 0.15; // 중간 지점에서 약간의 변동

            const dist = dist1 + t * (dist2 - dist1);
            let elevTop, elevBottom;

            if (layerIdx === 0) {
                // 첫 번째 레이어 상단 = 지표면
                elevTop = groundElev1 + t * (groundElev2 - groundElev1);
            } else {
                elevTop = interpolatedLayers[layerIdx - 1].points[i].elevBottom;
            }

            // 하단 경계 보간 (두께 기반)
            const thickness1 = l1.thickness;
            const thickness2 = l2.thickness;

            // Hermite 스플라인 형태의 부드러운 전이
            const smoothT = t * t * (3 - 2 * t); // smoothstep
            const interpThickness = thickness1 + smoothT * (thickness2 - thickness1);

            // 변동성 추가 (지층이 완벽히 평평하지 않음)
            const thicknessVariation = interpThickness * variability * (isSameType ? 0.1 : 0.2);
            const finalThickness = Math.max(0.1, interpThickness + thicknessVariation);

            elevBottom = elevTop - finalThickness;

            layerPoints.push({
                dist,
                elevTop,
                elevBottom,
                t,
                soilType: t < 0.5 ? l1.soilType : l2.soilType,
                color: t < 0.5 ? l1.color : l2.color,
                soilName: t < 0.5 ? l1.soilName : l2.soilName
            });
        }

        interpolatedLayers.push({
            soilType1: l1.soilType,
            soilType2: l2.soilType,
            color1: l1.color,
            color2: l2.color,
            label1: l1.label,
            label2: l2.label,
            soilName1: l1.soilName,
            soilName2: l2.soilName,
            isSameType,
            points: layerPoints
        });
    }

    return interpolatedLayers;
}

// 색상 보간 (그라데이션 효과)
function interpolateColor(color1, color2, t) {
    // HEX to RGB
    const hex2rgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 200, g: 200, b: 200 };
    };

    const c1 = hex2rgb(color1);
    const c2 = hex2rgb(color2);

    const r = Math.round(c1.r + t * (c2.r - c1.r));
    const g = Math.round(c1.g + t * (c2.g - c1.g));
    const b = Math.round(c1.b + t * (c2.b - c1.b));

    return `rgb(${r},${g},${b})`;
}

// 하단 영역에 SVG 기반 상세 단면도 표시
function updateCrossSection() {
    // 여러 가능한 컨테이너 확인
    const plotDiv = document.getElementById('crossSectionPlot') || document.getElementById('drawingCrossSectionPlot');
    if (!plotDiv) {
        console.warn('⚠️ 단면도 컨테이너를 찾을 수 없습니다');
        return;
    }

    // ✅ 단면도 결과 영역 표시
    const resultArea = document.getElementById('multiBoreholeResultArea');
    if (resultArea && selectedBoreholes && selectedBoreholes.length >= 2) {
        resultArea.style.display = 'block';
    }

    // ✅ 도면 단면도 컨테이너도 표시
    const drawingContainer = document.getElementById('drawingCrossSectionContainer');
    if (drawingContainer && selectedBoreholes && selectedBoreholes.length >= 2) {
        drawingContainer.style.display = 'block';
    }

    if (!selectedBoreholes || selectedBoreholes.length < 2) {
        plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><p>단면도를 보려면 2개 이상의 시추공을 선택하세요.</p><p style="font-size: 12px; margin-top: 10px;">도면 또는 등고선 맵에서 시추공 마커를 클릭하여 선택하세요.</p></div>';
        return;
    }

    // ✅ 선택된 시추공 데이터 검증 (holeNo, hole_no 모두 지원)
    console.log('🔍 updateCrossSection - 시추공 검색:', selectedBoreholes);
    const selectedData = selectedBoreholes
        .map(holeNo => boreholeData.find(b => (b.holeNo === holeNo) || (b.hole_no === holeNo)))
        .filter(bh => bh !== undefined);

    console.log('🔍 찾은 시추공 데이터:', selectedData.length, '개');

    if (selectedData.length < 2) {
        console.warn('⚠️ 선택된 시추공이 boreholeData에 없거나 불충분합니다:', selectedBoreholes);
        console.warn('⚠️ boreholeData 목록:', boreholeData.map(b => b.holeNo || b.hole_no));
        plotDiv.innerHTML = `<div style="text-align: center; padding: 50px; color: #c62828;"><p>❌ 오류: 선택된 시추공 중 ${selectedBoreholes.length - selectedData.length}개가 데이터베이스에 없습니다.</p><p style="font-size: 12px; margin-top: 10px;">시추공을 다시 선택해 주세요.</p></div>`;
        return;
    }

    // ✅ 필수 정보 검증 및 로그
    selectedData.forEach(bh => {
        if (!bh.x || !bh.y) {
            console.warn(`⚠️ 시추공 ${bh.holeNo}: 좌표 정보 누락 - 수동 배치 좌표 사용 시도`);
        }
        if (!bh.soilData || bh.soilData.length === 0) {
            console.warn(`⚠️ 시추공 ${bh.holeNo}: 토층 정보 누락`, bh);
        }
    });

    // ✅ 새로운 수직 프로파일 기반 단면도 렌더링
    // ✅ renderVerticalProfileCrossSection 사용 (시추 위치 도면 모듈과 동일한 알고리즘)
    console.log(`✅ 수직 프로파일 단면도 생성: ${selectedBoreholes.join(' → ')}`);
    renderVerticalProfileCrossSection(plotDiv, selectedBoreholes);
}

/**
 * ✅ 수직 프로파일 기반 단면도 (Internal 버전)
 * - 각 시추공을 수직 막대(컬럼)로 표시
 * - 깊이별 토층을 온톨로지 색상으로 표시
 * - 동일/유사 지층은 점선으로 연결
 * - 시추공 간 실제 거리 비례 배치
 */
function renderVerticalProfileCrossSectionInternal(container, selectedHoleNos) {
    if (!container) return;

    // 지층 온톨로지 정의 (내부용)
    const LAYER_ONTOLOGY = {
        surface: { label: '지표/매립', color: '#8D6E63', keywords: ['매립', '매립층', '매립토', '성토', '복토', '표토', 'fill'] },
        clay: { label: '점토', color: '#FFCC80', keywords: ['점토', '실트질점토', '점토질', 'clay', 'CL', 'CH'] },
        silt: { label: '실트', color: '#A5D6A7', keywords: ['실트', '모래질실트', 'silt', 'ML', 'MH'] },
        sand: { label: '모래', color: '#FFF59D', keywords: ['모래', '사질', '세사', '중사', '조사', 'sand', 'SM', 'SP'] },
        gravel: { label: '자갈', color: '#BCAAA4', keywords: ['자갈', '역층', 'gravel', 'GP', 'GW'] },
        weatheredSoil: { label: '풍화토', color: '#CE93D8', keywords: ['풍화토', '풍화대', '잔적토'] },
        weatheredRock: { label: '풍화암', color: '#90CAF9', keywords: ['풍화암', '리핑암', 'weathered rock'] },
        softRock: { label: '연암', color: '#7986CB', keywords: ['연암', 'soft rock'] },
        mediumRock: { label: '보통암', color: '#5C6BC0', keywords: ['보통암', 'medium rock'] },
        hardRock: { label: '경암/기반암', color: '#3F51B5', keywords: ['경암', '극경암', '기반암', '화강암', '편마암', 'hard rock', 'bedrock'] },
        boulder: { label: '전석', color: '#795548', keywords: ['전석', '호박돌', '붕적토', 'boulder'] }
    };

    // 지층 분류 함수
    function classifyLayer(soilName) {
        if (!soilName) return { group: 'unknown', label: '미분류', color: '#9E9E9E' };
        const name = soilName.toLowerCase();
        for (const [group, data] of Object.entries(LAYER_ONTOLOGY)) {
            for (const kw of data.keywords) {
                if (name.includes(kw.toLowerCase())) {
                    return { group, label: data.label, color: data.color };
                }
            }
        }
        return { group: 'unknown', label: soilName, color: '#9E9E9E' };
    }

    // 선택된 시추공 데이터 수집
    const boreholes = selectedHoleNos.map(holeNo => {
        // holeNo 또는 hole_no 모두 지원
        const bh = boreholeData.find(b => (b.holeNo === holeNo) || (b.hole_no === holeNo));
        if (!bh) {
            console.warn(`[renderVerticalProfile] 시추공 '${holeNo}' 찾지 못함`);
            return null;
        }

        // 수동 배치 좌표 확인
        const mp = manualPlacements ? manualPlacements.find(m => m.holeNo === holeNo) : null;

        // soilData 또는 soil_data 필드 가져오기
        const soilDataField = bh.soilData || bh.soil_data || [];

        // soilData 처리 - depth_range 파싱
        let processedSoilData = [];
        if (soilDataField && soilDataField.length > 0) {
            processedSoilData = soilDataField.map(layer => {
                let depthFrom = 0, depthTo = 0;

                // depth_range 형식: "0.0~0.2m" 또는 "0.0-0.2m"
                if (layer.depth_range) {
                    const match = layer.depth_range.match(/([0-9.]+)[~\-]([0-9.]+)/);
                    if (match) {
                        depthFrom = parseFloat(match[1]) || 0;
                        depthTo = parseFloat(match[2]) || depthFrom + 1;
                    }
                } else {
                    depthFrom = parseFloat(layer.depth_from) || 0;
                    depthTo = parseFloat(layer.depth_to) || depthFrom + 1;
                }

                return {
                    soil_name: layer.soil_name || '미분류',
                    depth_from: depthFrom,
                    depth_to: depthTo
                };
            });
        }

        // 지표고 파싱
        let groundElev = 0;
        if (bh.groundElevation) {
            groundElev = parseFloat(bh.groundElevation) || 0;
        } else if (bh.metadata && bh.metadata.GROUND_SURFACE_LEVEL) {
            const match = bh.metadata.GROUND_SURFACE_LEVEL.match(/([0-9.]+)/);
            if (match) groundElev = parseFloat(match[1]) || 0;
        }

        // 시추 깊이
        let totalDepth = parseFloat(bh.totalDepth) || 0;
        if (totalDepth === 0 && processedSoilData.length > 0) {
            totalDepth = Math.max(...processedSoilData.map(l => l.depth_to));
        }

        return {
            holeNo: bh.holeNo || bh.hole_no,
            x: mp ? mp.geoX : parseFloat(bh.x) || 0,
            y: mp ? mp.geoY : parseFloat(bh.y) || 0,
            groundElevation: groundElev,
            totalDepth: totalDepth,
            soilData: processedSoilData
        };
    }).filter(b => b !== null);

    if (boreholes.length < 2) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">2개 이상의 시추공을 선택하세요.</div>';
        return;
    }

    console.log('📊 단면도 데이터:', boreholes);

    // 누적 거리 계산 (시추공 간 실제 거리)
    const distances = [0];
    for (let i = 1; i < boreholes.length; i++) {
        const prev = boreholes[i - 1];
        const curr = boreholes[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        distances.push(distances[i - 1] + (dist > 0 ? dist : 50)); // 최소 50m 간격
    }
    const totalDistance = distances[distances.length - 1] || 100;

    // 최대/최소 표고 계산
    let maxElev = -Infinity, minElev = Infinity;
    boreholes.forEach(bh => {
        maxElev = Math.max(maxElev, bh.groundElevation || 10);
        minElev = Math.min(minElev, (bh.groundElevation || 10) - (bh.totalDepth || 20));
    });
    if (maxElev === -Infinity) maxElev = 20;
    if (minElev === Infinity) minElev = -10;
    const elevRange = maxElev - minElev + 10;

    // SVG 크기
    const svgWidth = Math.max(900, container.clientWidth - 20);
    const svgHeight = 550;
    const margin = { top: 70, right: 120, bottom: 70, left: 90 };
    const plotWidth = svgWidth - margin.left - margin.right;
    const plotHeight = svgHeight - margin.top - margin.bottom;

    // 스케일 함수
    const xScale = (dist) => margin.left + (dist / totalDistance) * plotWidth;
    const yScale = (elev) => margin.top + ((maxElev + 5 - elev) / elevRange) * plotHeight;

    // 시추공 컬럼 너비
    const columnWidth = Math.min(70, Math.max(50, plotWidth / boreholes.length / 2.5));

    // SVG 시작
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" style="font-family: 'Malgun Gothic', Arial, sans-serif; background: white;">`;

    // 배경
    svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="#FAFAFA"/>`;
    svg += `<rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="white" stroke="#E0E0E0"/>`;

    // 표고 눈금 (Y축)
    svg += `<g class="y-axis">`;
    const elevStep = elevRange > 30 ? 5 : (elevRange > 15 ? 2 : 1);
    for (let elev = Math.floor(minElev / elevStep) * elevStep; elev <= Math.ceil(maxElev + 5); elev += elevStep) {
        const y = yScale(elev);
        if (y >= margin.top && y <= margin.top + plotHeight) {
            svg += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}" stroke="#E0E0E0" stroke-dasharray="3,3"/>`;
            svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#333" font-weight="500">EL.${elev.toFixed(0)}</text>`;
        }
    }
    svg += `<text x="${margin.left - 50}" y="${margin.top + plotHeight/2}" text-anchor="middle" font-size="13" fill="#333" font-weight="bold" transform="rotate(-90, ${margin.left - 50}, ${margin.top + plotHeight/2})">표고 (m)</text>`;
    svg += `</g>`;

    // 지층 그룹별 점선 연결 데이터
    const layerConnections = new Map();

    // 각 시추공의 수직 프로파일 그리기
    boreholes.forEach((bh, bhIndex) => {
        const xCenter = xScale(distances[bhIndex]);
        const groundY = yScale(bh.groundElevation);
        const bottomY = yScale(bh.groundElevation - bh.totalDepth);

        // 시추공 컬럼 배경
        svg += `<rect x="${xCenter - columnWidth/2}" y="${groundY}" width="${columnWidth}" height="${Math.max(10, bottomY - groundY)}" fill="white" stroke="#757575" stroke-width="1.5"/>`;

        // 지표면 마커 (두꺼운 갈색 선)
        svg += `<line x1="${xCenter - columnWidth/2 - 15}" y1="${groundY}" x2="${xCenter + columnWidth/2 + 15}" y2="${groundY}" stroke="#5D4037" stroke-width="4"/>`;
        svg += `<polygon points="${xCenter - columnWidth/2 - 15},${groundY} ${xCenter - columnWidth/2 - 10},${groundY - 6} ${xCenter - columnWidth/2 - 10},${groundY + 6}" fill="#5D4037"/>`;
        svg += `<polygon points="${xCenter + columnWidth/2 + 15},${groundY} ${xCenter + columnWidth/2 + 10},${groundY - 6} ${xCenter + columnWidth/2 + 10},${groundY + 6}" fill="#5D4037"/>`;

        // 토층 그리기
        if (bh.soilData && bh.soilData.length > 0) {
            bh.soilData.forEach(layer => {
                const yTop = yScale(bh.groundElevation - layer.depth_from);
                const yBottom = yScale(bh.groundElevation - layer.depth_to);
                const layerHeight = Math.max(5, yBottom - yTop);

                const classification = classifyLayer(layer.soil_name);

                // 지층 박스
                svg += `<rect x="${xCenter - columnWidth/2 + 1}" y="${yTop}" width="${columnWidth - 2}" height="${layerHeight}" fill="${classification.color}" fill-opacity="0.8" stroke="${classification.color}" stroke-width="1"/>`;

                // 지층명 표시 (충분한 높이가 있을 때)
                if (layerHeight > 18) {
                    const displayName = layer.soil_name.length > 5 ? layer.soil_name.substring(0, 5) + '..' : layer.soil_name;
                    svg += `<text x="${xCenter}" y="${yTop + layerHeight/2 + 4}" text-anchor="middle" font-size="10" fill="#333" font-weight="500">${displayName}</text>`;
                }

                // 점선 연결 데이터 저장
                if (!layerConnections.has(classification.group)) {
                    layerConnections.set(classification.group, []);
                }
                layerConnections.get(classification.group).push({
                    bhIndex, xCenter, yTop, yBottom, columnWidth,
                    color: classification.color
                });
            });
        } else {
            svg += `<text x="${xCenter}" y="${groundY + 30}" text-anchor="middle" font-size="11" fill="#999">정보 없음</text>`;
        }

        // 시추공명 (상단) - 크고 굵게
        svg += `<text x="${xCenter}" y="${groundY - 35}" text-anchor="middle" font-size="16" font-weight="bold" fill="#1565C0">${bh.holeNo}</text>`;
        svg += `<text x="${xCenter}" y="${groundY - 18}" text-anchor="middle" font-size="12" fill="#333">GL. ${bh.groundElevation.toFixed(1)}m</text>`;

        // 시추 깊이 (하단)
        svg += `<text x="${xCenter}" y="${bottomY + 18}" text-anchor="middle" font-size="11" fill="#666">심도 ${bh.totalDepth.toFixed(1)}m</text>`;
    });

    // 동일/유사 지층 점선 연결
    svg += `<g class="layer-connections">`;
    layerConnections.forEach((connections, group) => {
        if (connections.length < 2) return;

        connections.sort((a, b) => a.bhIndex - b.bhIndex);

        for (let i = 0; i < connections.length - 1; i++) {
            const curr = connections[i];
            const next = connections[i + 1];

            // 인접 시추공인 경우만 연결
            if (next.bhIndex - curr.bhIndex === 1) {
                // 상단 경계 점선 연결
                svg += `<line x1="${curr.xCenter + curr.columnWidth/2}" y1="${curr.yTop}" x2="${next.xCenter - next.columnWidth/2}" y2="${next.yTop}" stroke="${curr.color}" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>`;

                // 하단 경계 점선 연결
                svg += `<line x1="${curr.xCenter + curr.columnWidth/2}" y1="${curr.yBottom}" x2="${next.xCenter - next.columnWidth/2}" y2="${next.yBottom}" stroke="${curr.color}" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>`;
            }
        }
    });
    svg += `</g>`;

    // 거리 축 (X축)
    svg += `<g class="x-axis">`;
    svg += `<line x1="${margin.left}" y1="${margin.top + plotHeight + 10}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight + 10}" stroke="#333" stroke-width="1.5"/>`;

    boreholes.forEach((bh, idx) => {
        const x = xScale(distances[idx]);
        svg += `<line x1="${x}" y1="${margin.top + plotHeight + 5}" x2="${x}" y2="${margin.top + plotHeight + 15}" stroke="#333" stroke-width="1.5"/>`;
        svg += `<text x="${x}" y="${margin.top + plotHeight + 32}" text-anchor="middle" font-size="11" fill="#333">${distances[idx].toFixed(0)}m</text>`;
    });

    svg += `<text x="${margin.left + plotWidth/2}" y="${svgHeight - 15}" text-anchor="middle" font-size="13" fill="#333" font-weight="bold">수평 거리 (m)</text>`;
    svg += `</g>`;

    // 제목
    svg += `<text x="${svgWidth / 2}" y="28" text-anchor="middle" font-size="18" font-weight="bold" fill="#1565C0">지반 단면도</text>`;
    svg += `<text x="${svgWidth / 2}" y="50}" text-anchor="middle" font-size="13" fill="#555">${boreholes.map(b => b.holeNo).join(' → ')}</text>`;

    // 범례
    const legendX = svgWidth - margin.right + 15;
    let legendY = margin.top + 10;
    svg += `<g class="legend">`;
    svg += `<rect x="${legendX - 5}" y="${legendY - 15}" width="105" height="${Object.keys(LAYER_ONTOLOGY).length * 18 + 50}" fill="white" stroke="#E0E0E0" rx="4"/>`;
    svg += `<text x="${legendX}" y="${legendY}" font-size="12" font-weight="bold" fill="#333">범례</text>`;
    legendY += 20;

    // 사용된 지층만 범례에 표시
    const usedGroups = new Set();
    boreholes.forEach(bh => {
        bh.soilData?.forEach(layer => {
            usedGroups.add(classifyLayer(layer.soil_name).group);
        });
    });

    for (const [group, data] of Object.entries(LAYER_ONTOLOGY)) {
        if (usedGroups.has(group)) {
            svg += `<rect x="${legendX}" y="${legendY - 10}" width="14" height="14" fill="${data.color}" stroke="${data.color}" rx="2"/>`;
            svg += `<text x="${legendX + 20}" y="${legendY + 2}" font-size="10" fill="#333">${data.label}</text>`;
            legendY += 18;
        }
    }

    // 점선 설명
    legendY += 8;
    svg += `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 25}" y2="${legendY}" stroke="#666" stroke-dasharray="6,4" stroke-width="2"/>`;
    svg += `<text x="${legendX + 30}" y="${legendY + 4}" font-size="9" fill="#666">동일 지층</text>`;

    svg += `</g>`;

    svg += '</svg>';

    container.innerHTML = svg;
    console.log('✅ 수직 프로파일 단면도 생성 완료');
}

// Plotly 기반 간략 단면도 (내부 함수)
function _renderPlotlyCrossSection(targetDivId) {
    const plotDiv = document.getElementById(targetDivId);
    if (!plotDiv) return;

    if (!selectedBoreholes || selectedBoreholes.length < 2) {
        plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><p>단면도를 보려면 2개 이상의 시추공을 선택하세요.</p></div>';
        return;
    }

    // ✅ 선택된 시추공 데이터 검증
    const selectedPointsData = selectedBoreholes.map(holeNo => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh) {
            console.warn(`⚠️ 시추공 ${holeNo} 찾기 실패`);
            return null;
        }
        
        // ✅ 필수 정보 검증
        if (!bh.x || !bh.y || isNaN(parseFloat(bh.x)) || isNaN(parseFloat(bh.y))) {
            console.warn(`⚠️ 시추공 ${holeNo}: 유효하지 않은 좌표 (x:${bh.x}, y:${bh.y})`);
            return null;
        }
        
        if (!bh.soilData || bh.soilData.length === 0) {
            console.warn(`⚠️ 시추공 ${holeNo}: 토층 정보 없음 - 기본값 사용`);
        }
        
        const layers = getDetailedLayers(bh);
        const groundElev = parseFloat(bh.groundElevation || 0);
        const excavationLevel = parseFloat(bh.excavationLevelInput) || groundElev;
        
        const pointData = {
            holeNo,
            x: parseFloat(bh.x),
            y: parseFloat(bh.y),
            groundElevation: groundElev,
            excavationLevel: excavationLevel,
            layers: layers,
            totalDepth: parseFloat(bh.totalDepth || 0)
        };
        
        console.debug(`✅ 단면도 데이터: ${holeNo}`, pointData);
        return pointData;
    }).filter(p => p !== null && !isNaN(p.x) && !isNaN(p.y));

    if (selectedPointsData.length < 2) return;

    // 각 시추공 사이의 누적 거리 계산
    let cumulativeDistances = [0];
    for (let i = 1; i < selectedPointsData.length; i++) {
        const prev = selectedPointsData[i - 1];
        const curr = selectedPointsData[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }

    const maxDist = cumulativeDistances[cumulativeDistances.length - 1];

    // 모든 시추공에서 사용된 지질 유형 수집
    const allSoilTypes = new Map();
    selectedPointsData.forEach(pt => {
        pt.layers.forEach(layer => {
            if (!allSoilTypes.has(layer.soilType)) {
                allSoilTypes.set(layer.soilType, {
                    type: layer.soilType,
                    label: layer.label,
                    color: layer.color,
                    order: layer.order
                });
            }
        });
    });

    // 최대/최소 표고 계산
    let minElev = Infinity, maxElev = -Infinity;
    selectedPointsData.forEach(pt => {
        if (pt.groundElevation > maxElev) maxElev = pt.groundElevation;
        pt.layers.forEach(layer => {
            if (layer.elevationBottom < minElev) minElev = layer.elevationBottom;
        });
    });
    minElev -= 3;

    const traces = [];

    // ========================================
    // 지질학적 모델링 기반 단면도 생성
    // Cubic Spline + Perlin Noise + Layer Tracking
    // ========================================

    // Perlin Noise 구현 (지질학적 변동성)
    function perlinNoise(x, seed) {
        const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
        return n - Math.floor(n);
    }

    function smoothNoise(x, seed, octaves = 3) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += perlinNoise(x * frequency, seed + i * 100) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        return (total / maxValue) * 2 - 1; // -1 ~ 1 범위
    }

    // Cubic Hermite Spline 보간
    function cubicHermite(p0, p1, m0, m1, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2*t3 - 3*t2 + 1;
        const h10 = t3 - 2*t2 + t;
        const h01 = -2*t3 + 3*t2;
        const h11 = t3 - t2;
        return h00*p0 + h10*m0 + h01*p1 + h11*m1;
    }

    // 레이어 경계 스플라인 보간 (시추공 위치에서 정확히 일치)
    function interpolateLayerBoundarySpline(controlPoints, numPoints) {
        if (controlPoints.length < 2) return controlPoints;

        const result = [];
        const n = controlPoints.length;

        // 각 시추공 간 보간
        for (let i = 0; i < n - 1; i++) {
            const p0 = controlPoints[i];
            const p1 = controlPoints[i + 1];

            // 접선 계산 (Catmull-Rom style)
            let m0, m1;
            if (i === 0) {
                m0 = (p1.elev - p0.elev) / (p1.dist - p0.dist) * (p1.dist - p0.dist) * 0.5;
            } else {
                const pPrev = controlPoints[i - 1];
                m0 = (p1.elev - pPrev.elev) / (p1.dist - pPrev.dist) * (p1.dist - p0.dist) * 0.5;
            }
            if (i === n - 2) {
                m1 = (p1.elev - p0.elev) / (p1.dist - p0.dist) * (p1.dist - p0.dist) * 0.5;
            } else {
                const pNext = controlPoints[i + 2];
                m1 = (pNext.elev - p0.elev) / (pNext.dist - p0.dist) * (p1.dist - p0.dist) * 0.5;
            }

            // 구간 내 보간점 생성
            const segmentPoints = Math.max(10, Math.round(numPoints / (n - 1)));
            for (let j = 0; j <= segmentPoints; j++) {
                if (i > 0 && j === 0) continue; // 중복 방지

                const t = j / segmentPoints;
                const dist = p0.dist + t * (p1.dist - p0.dist);
                const elev = cubicHermite(p0.elev, p1.elev, m0, m1, t);

                result.push({ dist, elev });
            }
        }

        return result;
    }

    // 레이어에서 특정 표고의 토질 찾기
    function findLayerAtElevation(layers, elevation) {
        for (const l of layers) {
            if (elevation <= l.elevationTop + 0.01 && elevation >= l.elevationBottom - 0.01) {
                return l;
            }
        }
        if (layers.length > 0) {
            if (elevation > layers[0].elevationTop) return layers[0];
            return layers[layers.length - 1];
        }
        return { color: '#DEB887', soilName: '토사', soilType: 'other' };
    }

    // ========================================
    // 각 지층 경계선 추출 및 스플라인 보간
    // ========================================

    // 모든 시추공의 레이어 경계 표고 수집
    const allBoundaryElevations = new Set();
    selectedPointsData.forEach(pt => {
        allBoundaryElevations.add(pt.groundElevation);
        pt.layers.forEach(l => {
            allBoundaryElevations.add(l.elevationBottom);
        });
    });

    // 경계 표고 정렬 (내림차순)
    const sortedBoundaries = Array.from(allBoundaryElevations).sort((a, b) => b - a);

    // 각 경계선에 대해 스플라인 보간된 곡선 생성
    const boundaryLines = new Map();
    sortedBoundaries.forEach((boundaryElev, bIdx) => {
        const controlPoints = [];

        selectedPointsData.forEach((pt, ptIdx) => {
            const dist = cumulativeDistances[ptIdx];

            // 이 시추공에서 해당 표고와 가장 가까운 경계 찾기
            let closestBoundary = pt.groundElevation;
            let minDiff = Math.abs(pt.groundElevation - boundaryElev);

            pt.layers.forEach(l => {
                const diffTop = Math.abs(l.elevationTop - boundaryElev);
                const diffBottom = Math.abs(l.elevationBottom - boundaryElev);
                if (diffTop < minDiff) {
                    minDiff = diffTop;
                    closestBoundary = l.elevationTop;
                }
                if (diffBottom < minDiff) {
                    minDiff = diffBottom;
                    closestBoundary = l.elevationBottom;
                }
            });

            // 오차 범위 내면 해당 경계 사용, 아니면 보간
            if (minDiff < 2.0) {
                controlPoints.push({ dist, elev: closestBoundary });
            } else {
                // 해당 표고가 이 시추공 범위 내에 있으면 보간값 사용
                const topElev = pt.groundElevation;
                const bottomElev = pt.layers.length > 0 ? pt.layers[pt.layers.length - 1].elevationBottom : topElev - pt.totalDepth;
                if (boundaryElev <= topElev && boundaryElev >= bottomElev) {
                    controlPoints.push({ dist, elev: boundaryElev });
                }
            }
        });

        if (controlPoints.length >= 2) {
            // 스플라인 보간
            const interpolated = interpolateLayerBoundarySpline(controlPoints, 80);
            boundaryLines.set(bIdx, { elev: boundaryElev, points: interpolated });
        }
    });

    // ========================================
    // 지층 폴리곤 생성 (하이브리드 매칭 + 리샘플링 + 정밀 wedge-out)
    // ========================================

    const segmentPoints = 30; // 리샘플링 해상도

    // 색상 보간 함수
    function blendColors(color1, color2, ratio) {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');
        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);
        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // 암반 타입 확인 함수
    function isRockType(soilType) {
        return soilType === 'hard_rock' || soilType === 'soft_rock' || soilType === 'weathered_rock';
    }

    // 암반 계열 타입 확인 (연결 가능한 암반류)
    function isRockFamily(soilType) {
        return soilType === 'hard_rock' || soilType === 'soft_rock' ||
               soilType === 'weathered_rock' || soilType === 'weathered_soil';
    }

    // 특수 표층 타입 확인 (붕적층, 매립토 등 - 서로 다른 타입끼리 연결 금지)
    function isSpecialSurfaceLayer(soilType) {
        return soilType === 'colluvial' || soilType === 'fill';
    }

    // 두 레이어가 표고 기반으로 연결 가능한지 확인
    function canConnectByElevation(l1, l2) {
        // 특수 표층끼리는 같은 타입만 연결 가능 (붕적층-매립토 연결 금지)
        if (isSpecialSurfaceLayer(l1.soilType) && isSpecialSurfaceLayer(l2.soilType)) {
            return l1.soilType === l2.soilType;
        }
        // 특수 표층과 일반 토층의 연결도 금지
        if (isSpecialSurfaceLayer(l1.soilType) || isSpecialSurfaceLayer(l2.soilType)) {
            return false;
        }
        return true;
    }

    // 하이브리드 레이어 매칭 함수: soilType 우선, 그 다음 표고 기반 매칭
    function matchLayersHybrid(layers1, layers2) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();

        // 1단계: 같은 soilType 매칭 (우선)
        layers1.forEach((l1, idx1) => {
            layers2.forEach((l2, idx2) => {
                if (!used1.has(idx1) && !used2.has(idx2) && l1.soilType === l2.soilType) {
                    matches.push({ l1, l2, matchType: 'same' });
                    used1.add(idx1);
                    used2.add(idx2);
                }
            });
        });

        // 1.5단계: 암반 계열끼리 매칭 (풍화암-연암-보통암 연결)
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;
            if (!isRockFamily(l1.soilType)) return;

            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;
                if (!isRockFamily(l2.soilType)) return;

                // 암반 계열끼리는 연결 (단, 표고 구간이 어느 정도 겹쳐야 함)
                const overlapTop = Math.min(l1.elevationTop, l2.elevationTop);
                const overlapBottom = Math.max(l1.elevationBottom, l2.elevationBottom);
                const overlap = overlapTop - overlapBottom;

                if (overlap > -2.0) { // 2m 이내 간격까지 연결 허용
                    matches.push({ l1, l2, matchType: 'rock-transition' });
                    used1.add(idx1);
                    used2.add(idx2);
                }
            });
        });

        // 2단계: 매칭되지 않은 레이어는 표고 기반으로 인접 레이어와 매칭
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;

            // 특수 표층(붕적층, 매립토)은 표고 기반 매칭 건너뛰기 - 같은 타입만 연결
            if (isSpecialSurfaceLayer(l1.soilType)) {
                matches.push({ l1, l2: null, matchType: 'wedge-out' });
                used1.add(idx1);
                return;
            }

            // 표고 구간이 겹치는 레이어 찾기
            let bestMatch = null;
            let bestOverlap = 0;

            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;

                // 특수 표층과의 연결 금지
                if (!canConnectByElevation(l1, l2)) return;

                const overlapTop = Math.min(l1.elevationTop, l2.elevationTop);
                const overlapBottom = Math.max(l1.elevationBottom, l2.elevationBottom);
                const overlap = Math.max(0, overlapTop - overlapBottom);

                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestMatch = { l2, idx2 };
                }
            });

            if (bestMatch && bestOverlap > 0) {
                matches.push({ l1, l2: bestMatch.l2, matchType: 'elevation' });
                used1.add(idx1);
                used2.add(bestMatch.idx2);
            } else {
                // wedge-out: 왼쪽에만 존재
                // 암반인 경우 특별 처리 (rock-extend)
                if (isRockType(l1.soilType)) {
                    matches.push({ l1, l2: null, matchType: 'rock-extend-out' });
                } else {
                    matches.push({ l1, l2: null, matchType: 'wedge-out' });
                }
                used1.add(idx1);
            }
        });

        // 3단계: 오른쪽에만 있는 레이어 (wedge-in)
        layers2.forEach((l2, idx2) => {
            if (!used2.has(idx2)) {
                // 암반인 경우 특별 처리
                if (isRockType(l2.soilType)) {
                    matches.push({ l1: null, l2, matchType: 'rock-extend-in' });
                } else {
                    matches.push({ l1: null, l2, matchType: 'wedge-in' });
                }
            }
        });

        return matches;
    }

    // 리샘플링된 폴리곤 좌표 생성 함수 (깊이 기반 보간)
    // 깊이 보간 후 표고 역산 방식으로 지층이 지표면을 뚫지 않도록 함
    function createResampledPolygon(dist1, dist2, l1Top, l1Bottom, l2Top, l2Bottom, numPoints, ground1, ground2) {
        const topX = [], topY = [], bottomX = [], bottomY = [];

        // 지표면 정보가 제공된 경우 깊이 기반 보간 사용
        const useDepthBased = (ground1 !== undefined && ground2 !== undefined);

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t); // smoothstep

            topX.push(dist);
            bottomX.push(dist);

            if (useDepthBased) {
                // 깊이 기반 보간: 지표면에서의 깊이를 보간한 후 표고로 역산
                const groundLevel = ground1 + smoothT * (ground2 - ground1);

                // 각 지점에서의 깊이 계산
                const depth1Top = ground1 - l1Top;
                const depth1Bottom = ground1 - l1Bottom;
                const depth2Top = ground2 - l2Top;
                const depth2Bottom = ground2 - l2Bottom;

                // 깊이 보간
                const interpDepthTop = depth1Top + smoothT * (depth2Top - depth1Top);
                const interpDepthBottom = depth1Bottom + smoothT * (depth2Bottom - depth1Bottom);

                // 표고 역산 (항상 지표면 아래에 위치하게 됨)
                topY.push(groundLevel - interpDepthTop);
                bottomY.push(groundLevel - interpDepthBottom);
            } else {
                // 기존 방식 (하위 호환성 유지)
                topY.push(l1Top + smoothT * (l2Top - l1Top));
                bottomY.push(l1Bottom + smoothT * (l2Bottom - l1Bottom));
            }
        }

        // 폴리곤 좌표 생성 (시계방향: 상단 좌→우, 하단 우→좌)
        const polyX = [...topX, ...bottomX.slice().reverse()];
        const polyY = [...topY, ...bottomY.slice().reverse()];

        // 폴리곤 닫기
        polyX.push(polyX[0]);
        polyY.push(polyY[0]);

        return { polyX, polyY };
    }

    // Wedge-out 폴리곤 생성 (소멸하는 지층 - 상단/하단이 하나의 경계선으로 수렴)
    // 핵심 원칙:
    // 1. 소멸하는 지층은 상단과 하단이 "하나의 점(선)"으로 수렴해야 함
    // 2. 수렴점은 인접 시추공의 같은 깊이대에 있는 지층 경계선
    // 3. 지층이 확장되거나 다른 지층을 침범하면 안 됨
    function createWedgeOutPolygon(dist1, dist2, layer, direction, numPoints, ground1, ground2, aboveBottom1, aboveBottom2, belowTop1, belowTop2) {
        const polyX = [], polyY = [];

        if (direction === 'right') {
            // 왼쪽 시추공에만 존재하는 지층 → 오른쪽으로 가면서 소멸
            const topStart = layer.elevationTop;
            const bottomStart = layer.elevationBottom;
            const layerThickness = topStart - bottomStart;

            // 수렴점 계산: 지층의 중간 깊이가 인접 시추공에서 어디에 해당하는지
            const midElev = (topStart + bottomStart) / 2;
            const midDepth = ground1 - midElev;
            const targetMidElev = ground2 - midDepth;

            // 수렴점: 상단과 하단이 모두 이 점으로 수렴
            let convergenceElev;
            if (belowTop2 !== null && belowTop2 !== undefined && aboveBottom2 !== null && aboveBottom2 !== undefined) {
                convergenceElev = (belowTop2 + aboveBottom2) / 2;
            } else if (belowTop2 !== null && belowTop2 !== undefined) {
                convergenceElev = belowTop2;
            } else if (aboveBottom2 !== null && aboveBottom2 !== undefined) {
                convergenceElev = aboveBottom2;
            } else {
                convergenceElev = targetMidElev;
            }

            // 상단 경계 (좌→우): 레이어 상단에서 시작 → 수렴점으로
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = 1 - Math.pow(1 - t, 3); // ease-out

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * (1 - smoothT);
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);
                const topElev = currentMidElev + currentThickness / 2;

                polyX.push(dist);
                polyY.push(Math.min(topElev, groundLevel));
            }

            // 하단 경계 (우→좌)
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = 1 - Math.pow(1 - t, 3);

                const currentThickness = layerThickness * (1 - smoothT);
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);
                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        } else {
            // 오른쪽 시추공에만 존재하는 지층 → 왼쪽에서 시작하여 점점 나타남 (wedge-in)
            const topEnd = layer.elevationTop;
            const bottomEnd = layer.elevationBottom;
            const layerThickness = topEnd - bottomEnd;

            // 목표 지층의 깊이 (오른쪽 시추공 기준)
            const depthTop = ground2 - topEnd;
            const depthBottom = ground2 - bottomEnd;

            // 수렴점: 왼쪽 시추공에서 같은 깊이의 표고 (지표면 아래로 제한)
            let convergenceElev;
            if (belowTop1 !== null && belowTop1 !== undefined && aboveBottom1 !== null && aboveBottom1 !== undefined) {
                // 위/아래 지층 사이 중간점
                convergenceElev = (belowTop1 + aboveBottom1) / 2;
            } else if (belowTop1 !== null && belowTop1 !== undefined) {
                convergenceElev = belowTop1;
            } else if (aboveBottom1 !== null && aboveBottom1 !== undefined) {
                convergenceElev = aboveBottom1;
            } else {
                // 같은 깊이 기반 (지층 중심 깊이)
                const midDepth = (depthTop + depthBottom) / 2;
                convergenceElev = ground1 - midDepth;
            }

            // 수렴점이 지표면 위로 나가지 않도록 제한
            convergenceElev = Math.min(convergenceElev, ground1 - 0.1);

            // 상단 경계 (좌→우): 수렴점에서 시작 → 레이어 상단으로
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3); // ease-in: 시작은 천천히, 끝에서 빠르게

                const groundLevel = ground1 + t * (ground2 - ground1);

                // 두께: 0에서 시작하여 원래 두께로 증가
                const currentThickness = layerThickness * smoothT;

                // 깊이 기반 보간: 왼쪽 수렴점 깊이 → 오른쪽 지층 깊이
                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                // 상단 = 중심 + 두께/2 (지표면 제한)
                const topElev = Math.min(currentMidElev + currentThickness / 2, groundLevel - 0.05);

                polyX.push(dist);
                polyY.push(topElev);
            }

            // 하단 경계 (우→좌)
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3);

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * smoothT;

                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                // 하단 = 중심 - 두께/2
                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        }

        // 폴리곤 닫기
        polyX.push(polyX[0]);
        polyY.push(polyY[0]);

        return { polyX, polyY };
    }

    // ============================================
    // 가상 지층 찾기: 양쪽 인접 시추공에 없어도 더 먼 시추공에서 찾아 연결
    // ============================================
    function findVirtualLayer(allPoints, distances, layerSoilType, currentSegIdx) {
        // 현재 구간 왼쪽에서 해당 지층 찾기
        let leftPt = null, leftLayer = null, leftDist = null;
        for (let i = currentSegIdx - 1; i >= 0; i--) {
            const layer = allPoints[i].layers.find(l => l.soilType === layerSoilType);
            if (layer) {
                leftPt = allPoints[i];
                leftLayer = layer;
                leftDist = distances[i];
                break;
            }
        }

        // 현재 구간 오른쪽에서 해당 지층 찾기
        let rightPt = null, rightLayer = null, rightDist = null;
        for (let i = currentSegIdx + 2; i < allPoints.length; i++) {
            const layer = allPoints[i].layers.find(l => l.soilType === layerSoilType);
            if (layer) {
                rightPt = allPoints[i];
                rightLayer = layer;
                rightDist = distances[i];
                break;
            }
        }

        return { leftPt, leftLayer, leftDist, rightPt, rightLayer, rightDist };
    }

    // ============================================
    // 갭 구간에서 가상 레이어 폴리곤 생성
    // ============================================
    function createVirtualLayerPolygon(dist1, dist2, leftPt, leftLayer, leftDist, rightPt, rightLayer, rightDist, ground1, ground2, numPoints) {
        if (!leftPt || !rightPt || !leftLayer || !rightLayer) return null;

        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;

        // 전체 구간에서의 현재 세그먼트 위치
        const totalDist = rightDist - leftDist;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);

            // 전체 구간에서의 비율
            const globalT = (dist - leftDist) / totalDist;
            const smoothT = globalT * globalT * (3 - 2 * globalT);

            // 깊이 보간
            const leftDepthTop = leftPt.groundElevation - leftLayer.elevationTop;
            const leftDepthBottom = leftPt.groundElevation - leftLayer.elevationBottom;
            const rightDepthTop = rightPt.groundElevation - rightLayer.elevationTop;
            const rightDepthBottom = rightPt.groundElevation - rightLayer.elevationBottom;

            const interpDepthTop = leftDepthTop + smoothT * (rightDepthTop - leftDepthTop);
            const interpDepthBottom = leftDepthBottom + smoothT * (rightDepthBottom - leftDepthBottom);

            // 현재 위치의 지표면
            const groundLevel = ground1 + t * (ground2 - ground1);

            // 표고 역산
            let topElev = groundLevel - interpDepthTop;
            let bottomElev = groundLevel - interpDepthBottom;

            // 최소 시각적 두께 보장
            const thickness = topElev - bottomElev;
            if (thickness < MIN_VISUAL_THICKNESS && thickness > 0) {
                const center = (topElev + bottomElev) / 2;
                topElev = center + MIN_VISUAL_THICKNESS / 2;
                bottomElev = center - MIN_VISUAL_THICKNESS / 2;
            }

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        // 폴리곤 좌표 생성
        const polyY = [...topY, ...bottomY.reverse()];
        const fullPolyX = [...polyX, ...polyX.slice().reverse()];
        fullPolyX.push(fullPolyX[0]);
        polyY.push(polyY[0]);

        return { polyX: fullPolyX, polyY };
    }

    // ============================================
    // 암반 연장 폴리곤 생성 (한쪽에만 암반이 있을 때)
    // 암반은 wedge처럼 사라지지 않고, 깊이가 점진적으로 변화하며 연장됨
    // ============================================
    function createRockExtendPolygon(dist1, dist2, rockLayer, direction, numPoints, ground1, ground2, otherPtLayers, minElev) {
        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;

        const useDepthBased = (ground1 !== undefined && ground2 !== undefined);
        const rockGround = direction === 'right' ? ground1 : ground2;
        const otherGround = direction === 'right' ? ground2 : ground1;

        // 암반 상단 깊이
        const rockDepthTop = rockGround - rockLayer.elevationTop;
        const rockThickness = rockLayer.elevationTop - rockLayer.elevationBottom;

        // 반대편 시추공에서 가장 깊은 레이어 찾기
        let otherBottomElev = otherGround - 15; // 기본값: 지표면 -15m
        if (otherPtLayers && otherPtLayers.length > 0) {
            const deepestLayer = otherPtLayers[otherPtLayers.length - 1];
            otherBottomElev = deepestLayer.elevationBottom;
        }

        // 암반 상단이 반대편에서 예상되는 깊이 (점진적 변화)
        const otherDepthTop = otherGround - otherBottomElev + 1.0; // 가장 깊은 레이어 아래 1m

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const actualT = direction === 'right' ? t : (1 - t);

            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = actualT * actualT * (3 - 2 * actualT);

            // 지표면 보간
            const groundLevel = ground1 + t * (ground2 - ground1);

            // 암반 상단 깊이 보간 (암반에서 시작해서 점점 깊어짐)
            const interpDepthTop = rockDepthTop + smoothT * (otherDepthTop - rockDepthTop);

            // 두께는 점진적으로 유지 또는 약간 감소
            const thicknessFactor = 1 - smoothT * 0.3; // 끝에서 70% 두께 유지
            const interpThickness = Math.max(MIN_VISUAL_THICKNESS, rockThickness * thicknessFactor);

            const topElev = groundLevel - interpDepthTop;
            const bottomElev = Math.max(minElev, topElev - interpThickness);

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        // 폴리곤 좌표 생성
        const polyYResult = [...topY, ...bottomY.slice().reverse()];
        polyX.push(...polyX.slice().reverse());
        polyX.push(polyX[0]);
        polyYResult.push(polyYResult[0]);

        return { polyX, polyY: polyYResult };
    }

    // 암반 전이 폴리곤 (풍화암 ↔ 연암 ↔ 보통암)
    function createRockTransitionPolygon(dist1, dist2, l1, l2, numPoints, ground1, ground2) {
        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t);

            const groundLevel = ground1 + smoothT * (ground2 - ground1);

            // 깊이 기반 보간
            const depth1Top = ground1 - l1.elevationTop;
            const depth1Bottom = ground1 - l1.elevationBottom;
            const depth2Top = ground2 - l2.elevationTop;
            const depth2Bottom = ground2 - l2.elevationBottom;

            const interpDepthTop = depth1Top + smoothT * (depth2Top - depth1Top);
            const interpDepthBottom = depth1Bottom + smoothT * (depth2Bottom - depth1Bottom);

            let topElev = groundLevel - interpDepthTop;
            let bottomElev = groundLevel - interpDepthBottom;

            // 최소 두께 보장
            const thickness = topElev - bottomElev;
            if (thickness < MIN_VISUAL_THICKNESS && thickness > 0) {
                const center = (topElev + bottomElev) / 2;
                topElev = center + MIN_VISUAL_THICKNESS / 2;
                bottomElev = center - MIN_VISUAL_THICKNESS / 2;
            }

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        // 폴리곤 좌표 생성
        const polyYResult = [...topY, ...bottomY.slice().reverse()];
        const fullPolyX = [...polyX, ...polyX.slice().reverse()];
        fullPolyX.push(fullPolyX[0]);
        polyYResult.push(polyYResult[0]);

        return { polyX: fullPolyX, polyY: polyYResult };
    }

    // ============================================
    // 배경 채우기: 지층 사이 빈 틈 방지
    // 각 구간에서 지표면~최하단까지 기본 색상으로 먼저 채움
    // ============================================
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        // 양쪽 시추공의 최하단 표고
        const bottom1 = pt1.layers.length > 0 ? pt1.layers[pt1.layers.length - 1].elevationBottom : pt1.groundElevation - pt1.totalDepth;
        const bottom2 = pt2.layers.length > 0 ? pt2.layers[pt2.layers.length - 1].elevationBottom : pt2.groundElevation - pt2.totalDepth;

        // 배경 폴리곤 (토사 기본색)
        const bgResult = createResampledPolygon(
            dist1, dist2,
            pt1.groundElevation, bottom1,
            pt2.groundElevation, bottom2,
            30,
            pt1.groundElevation, pt2.groundElevation
        );

        traces.push({
            x: bgResult.polyX,
            y: bgResult.polyY,
            fill: 'toself',
            fillcolor: '#D2B48C',  // 기본 토사 색상
            line: { color: 'rgba(0,0,0,0)', width: 0 },
            mode: 'lines',
            showlegend: false,
            hoverinfo: 'skip'
        });
    }

    // 각 시추공 구간별로 레이어 폴리곤 생성
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        if (pt1.layers.length === 0 && pt2.layers.length === 0) continue;

        // 하이브리드 매칭 수행
        const matches = matchLayersHybrid(pt1.layers, pt2.layers);

        // 각 매칭된 레이어 쌍에 대해 폴리곤 생성
        matches.forEach((match, matchIdx) => {
            const { l1, l2, matchType } = match;
            let polyX, polyY, fillColor, layerLabel, lineStyle;

            if (matchType === 'same') {
                // 같은 토질: 정상 연결 (깊이 기반 보간)
                const result = createResampledPolygon(
                    dist1, dist2,
                    l1.elevationTop, l1.elevationBottom,
                    l2.elevationTop, l2.elevationBottom,
                    segmentPoints,
                    pt1.groundElevation, pt2.groundElevation
                );
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = l1.color;
                layerLabel = l1.soilName;
                lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };

            } else if (matchType === 'elevation') {
                // 다른 토질이지만 표고 기반 연결: 그라데이션 + 점선 경계 (깊이 기반 보간)
                const result = createResampledPolygon(
                    dist1, dist2,
                    l1.elevationTop, l1.elevationBottom,
                    l2.elevationTop, l2.elevationBottom,
                    segmentPoints,
                    pt1.groundElevation, pt2.groundElevation
                );
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = blendColors(l1.color, l2.color, 0.5);
                layerLabel = `${l1.soilName} → ${l2.soilName}`;
                lineStyle = { color: 'rgba(0,0,0,0.5)', width: 1, dash: 'dot' };

            } else if (matchType === 'wedge-out') {
                // 왼쪽에만 존재: 먼저 더 먼 시추공에서 연결 가능한 레이어 찾기
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l1.soilType, segIdx);

                if (virtual.rightPt && virtual.rightLayer) {
                    // 더 먼 시추공에 같은 지층이 있으면 가상 레이어로 연결
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        pt1, l1, dist1,
                        virtual.rightPt, virtual.rightLayer, virtual.rightDist,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l1.color;
                        layerLabel = `${l1.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.2)', width: 0.3, dash: 'dot' };
                    }
                }

                if (!polyX) {
                    // 연결할 지층이 없으면 wedge-out (위/아래 지층과 빈틈 없이 연결)
                    const l1Idx = pt1.layers.indexOf(l1);

                    // pt1에서 위 지층의 하단 경계
                    const aboveLayer1 = l1Idx > 0 ? pt1.layers[l1Idx - 1] : null;
                    const aboveBottom1 = aboveLayer1 ? aboveLayer1.elevationBottom : pt1.groundElevation;

                    // pt1에서 아래 지층의 상단 경계
                    const belowLayer1 = pt1.layers[l1Idx + 1];
                    const belowTop1 = belowLayer1 ? belowLayer1.elevationTop : l1.elevationBottom;

                    // pt2에서 위 지층의 하단 경계 (상단 목표점)
                    let aboveBottom2 = null;
                    const topDepth = pt1.groundElevation - l1.elevationTop;
                    for (let j = 0; j < pt2.layers.length; j++) {
                        const layerBottomDepth = pt2.groundElevation - pt2.layers[j].elevationBottom;
                        if (layerBottomDepth >= topDepth - 1) {
                            aboveBottom2 = pt2.layers[j].elevationBottom;
                            break;
                        }
                    }
                    if (aboveBottom2 === null) {
                        aboveBottom2 = pt2.groundElevation - topDepth;
                    }

                    // pt2에서 아래 지층의 상단 경계 (하단 목표점)
                    let belowTop2 = null;
                    const bottomDepth = pt1.groundElevation - l1.elevationBottom;
                    for (let j = 0; j < pt2.layers.length; j++) {
                        const layerTopDepth = pt2.groundElevation - pt2.layers[j].elevationTop;
                        if (layerTopDepth >= bottomDepth - 1) {
                            belowTop2 = pt2.layers[j].elevationTop;
                            break;
                        }
                    }
                    if (belowTop2 === null) {
                        belowTop2 = pt2.groundElevation - bottomDepth;
                    }

                    const result = createWedgeOutPolygon(dist1, dist2, l1, 'right', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l1.color;
                    layerLabel = `${l1.soilName} (소멸)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                }

            } else if (matchType === 'wedge-in') {
                // 오른쪽에만 존재: 먼저 더 먼 시추공에서 연결 가능한 레이어 찾기
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l2.soilType, segIdx);

                if (virtual.leftPt && virtual.leftLayer) {
                    // 더 먼 시추공에 같은 지층이 있으면 가상 레이어로 연결
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        virtual.leftPt, virtual.leftLayer, virtual.leftDist,
                        pt2, l2, dist2,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l2.color;
                        layerLabel = `${l2.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.2)', width: 0.3, dash: 'dot' };
                    }
                }

                if (!polyX) {
                    // 연결할 지층이 없으면 wedge-in (위/아래 지층과 빈틈 없이 연결)
                    const l2Idx = pt2.layers.indexOf(l2);

                    // pt2에서 위 지층의 하단 경계
                    const aboveLayer2 = l2Idx > 0 ? pt2.layers[l2Idx - 1] : null;
                    const aboveBottom2 = aboveLayer2 ? aboveLayer2.elevationBottom : pt2.groundElevation;

                    // pt2에서 아래 지층의 상단 경계
                    const belowLayer2 = pt2.layers[l2Idx + 1];
                    const belowTop2 = belowLayer2 ? belowLayer2.elevationTop : l2.elevationBottom;

                    // pt1에서 위 지층의 하단 경계 (출발 상단)
                    let aboveBottom1 = null;
                    const topDepth = pt2.groundElevation - l2.elevationTop;
                    for (let j = 0; j < pt1.layers.length; j++) {
                        const layerBottomDepth = pt1.groundElevation - pt1.layers[j].elevationBottom;
                        if (layerBottomDepth >= topDepth - 1) {
                            aboveBottom1 = pt1.layers[j].elevationBottom;
                            break;
                        }
                    }
                    if (aboveBottom1 === null) {
                        aboveBottom1 = pt1.groundElevation - topDepth;
                    }

                    // pt1에서 아래 지층의 상단 경계 (출발 하단)
                    let belowTop1 = null;
                    const bottomDepth = pt2.groundElevation - l2.elevationBottom;
                    for (let j = 0; j < pt1.layers.length; j++) {
                        const layerTopDepth = pt1.groundElevation - pt1.layers[j].elevationTop;
                        if (layerTopDepth >= bottomDepth - 1) {
                            belowTop1 = pt1.layers[j].elevationTop;
                            break;
                        }
                    }
                    if (belowTop1 === null) {
                        belowTop1 = pt1.groundElevation - bottomDepth;
                    }

                    const result = createWedgeOutPolygon(dist1, dist2, l2, 'left', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l2.color;
                    layerLabel = `${l2.soilName} (출현)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                }

            } else if (matchType === 'rock-transition') {
                // 암반 계열 전이 (풍화암 ↔ 연암 ↔ 보통암)
                const result = createRockTransitionPolygon(
                    dist1, dist2, l1, l2, segmentPoints,
                    pt1.groundElevation, pt2.groundElevation
                );
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = blendColors(l1.color, l2.color, 0.5);
                layerLabel = `${l1.soilName} → ${l2.soilName}`;
                lineStyle = { color: 'rgba(0,0,0,0.4)', width: 0.8, dash: 'dot' };

            } else if (matchType === 'rock-extend-out') {
                // 암반 연장 (왼쪽에만 암반 존재, 오른쪽으로 연장)
                // 먼저 더 먼 시추공에서 같은 암반 찾기
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l1.soilType, segIdx);

                if (virtual.rightPt && virtual.rightLayer) {
                    // 더 먼 시추공에 같은 암반이 있으면 연결
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        pt1, l1, dist1,
                        virtual.rightPt, virtual.rightLayer, virtual.rightDist,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l1.color;
                        layerLabel = `${l1.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                    }
                }

                if (!polyX) {
                    // 연결할 암반이 없으면 연장 (사라지지 않고 깊어지며 연장)
                    const result = createRockExtendPolygon(
                        dist1, dist2, l1, 'right', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        pt2.layers, minElev
                    );
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l1.color;
                    layerLabel = `${l1.soilName} (연장)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };
                }

            } else if (matchType === 'rock-extend-in') {
                // 암반 연장 (오른쪽에만 암반 존재, 왼쪽으로 연장)
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l2.soilType, segIdx);

                if (virtual.leftPt && virtual.leftLayer) {
                    // 더 먼 시추공에 같은 암반이 있으면 연결
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        virtual.leftPt, virtual.leftLayer, virtual.leftDist,
                        pt2, l2, dist2,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l2.color;
                        layerLabel = `${l2.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                    }
                }

                if (!polyX) {
                    // 연결할 암반이 없으면 연장
                    const result = createRockExtendPolygon(
                        dist1, dist2, l2, 'left', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        pt1.layers, minElev
                    );
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l2.color;
                    layerLabel = `${l2.soilName} (연장)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };
                }
            }

            if (polyX && polyY && polyX.length > 3) {
                traces.push({
                    x: polyX,
                    y: polyY,
                    fill: 'toself',
                    fillcolor: fillColor,
                    line: lineStyle,
                    mode: 'lines',
                    showlegend: false,
                    hoverinfo: 'text',
                    text: layerLabel,
                    hoverlabel: { bgcolor: 'rgba(255,255,255,0.95)', font: { size: 12, color: '#333' }, bordercolor: fillColor }
                });
            }
        });
    }

    // 시추공 기둥 (실제 데이터 표시)
    const columnWidth = Math.max(8, Math.min(20, maxDist * 0.03));

    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];

        pt.layers.forEach((layer, layerIdx) => {
            // 시추공 기둥 레이어
            traces.push({
                x: [dist - columnWidth/2, dist + columnWidth/2, dist + columnWidth/2, dist - columnWidth/2, dist - columnWidth/2],
                y: [layer.elevationTop, layer.elevationTop, layer.elevationBottom, layer.elevationBottom, layer.elevationTop],
                fill: 'toself',
                fillcolor: layer.color,
                line: { color: '#222', width: 1.5 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'text',
                text: `<b>${layer.soilName}</b><br>심도: ${layer.depthStart.toFixed(1)}~${layer.depthEnd.toFixed(1)}m<br>표고: EL.${layer.elevationTop.toFixed(1)}~${layer.elevationBottom.toFixed(1)}m<br>두께: ${layer.thickness.toFixed(1)}m`,
                hoverlabel: { bgcolor: 'rgba(255,255,255,0.95)', font: { size: 12, color: '#333' }, bordercolor: layer.color }
            });
        });
    });

    // 지표면 선 제외 - 지층 연결 보기에서는 지표면 선을 표시하지 않음
    // (사용자 요청: 지표면 연결선은 불필요)

    // 굴착면 레벨 선 추가 (스플라인 보간)
    const excavationControlPoints = selectedPointsData.map((pt, idx) => ({
        dist: cumulativeDistances[idx],
        elev: pt.excavationLevel
    }));
    const interpolatedExcavation = interpolateLayerBoundary(excavationControlPoints, 100);

    traces.push({
        x: interpolatedExcavation.map(p => p.dist),
        y: interpolatedExcavation.map(p => p.elev),
        mode: 'lines',
        line: { color: '#FF5722', width: 3, dash: 'dash' },
        name: '굴착면 레벨',
        hoverinfo: 'y',
        hoverlabel: { bgcolor: '#FF5722', font: { color: 'white' } }
    });

    // 시추공 위치 마커 및 라벨 (겹침 방지)
    selectedPointsData.forEach((pt, idx) => {
        const dist = cumulativeDistances[idx];
        const bottomElev = pt.layers.length > 0 ? pt.layers[pt.layers.length - 1].elevationBottom : pt.groundElevation - pt.totalDepth;

        // 시추공 수직선
        traces.push({
            x: [dist, dist],
            y: [pt.groundElevation, bottomElev],
            mode: 'lines',
            line: { color: '#D32F2F', width: 2 },
            showlegend: false,
            hoverinfo: 'skip'
        });

        // 시추공 상단 마커
        traces.push({
            x: [dist],
            y: [pt.groundElevation],
            mode: 'markers',
            marker: { size: 10, color: '#D32F2F', symbol: 'triangle-down', line: { color: 'white', width: 1 } },
            showlegend: false,
            hoverinfo: 'text',
            text: `${pt.holeNo}<br>지표고: EL.${pt.groundElevation.toFixed(2)}m`
        });
    });

    // 시추공 라벨을 annotations으로 처리 (겹침 방지)
    const annotations = selectedPointsData.map((pt, idx) => ({
        x: cumulativeDistances[idx],
        y: pt.groundElevation + (maxElev - minElev) * 0.08,
        text: `<b>${pt.holeNo}</b><br><span style="font-size:10px">EL.${pt.groundElevation.toFixed(1)}m</span>`,
        showarrow: true,
        arrowhead: 0,
        arrowsize: 0.5,
        arrowwidth: 1,
        arrowcolor: '#666',
        ax: 0,
        ay: -30,
        font: { size: 11, color: '#455A64' },
        bgcolor: 'rgba(255,255,255,0.9)',
        bordercolor: '#455A64',
        borderwidth: 1,
        borderpad: 4
    }));

    // 범례용 더미 트레이스 (각 지질 유형별)
    const sortedSoilTypes = Array.from(allSoilTypes.values()).sort((a, b) => b.order - a.order);
    sortedSoilTypes.forEach(soilType => {
        traces.push({
            x: [null],
            y: [null],
            mode: 'markers',
            marker: { size: 12, color: soilType.color, symbol: 'square', line: { color: '#333', width: 1 } },
            name: soilType.label,
            showlegend: true,
            hoverinfo: 'skip'
        });
    });

    // 스케일 모드에 따른 레이아웃 설정
    const elevRange = maxElev - minElev + (maxElev - minElev) * 0.25;
    const isRealScale = crossSectionScaleMode === 'real';

    // 실축적 모드일 때 플롯 크기 계산
    let plotWidth = null;
    let plotHeight = 500; // 기본 높이

    if (isRealScale) {
        // 실축적: 가로 1m = 세로 1m
        // 컨테이너 너비 기준으로 높이 계산 또는 높이 기준으로 너비 계산
        const containerWidth = document.getElementById('crossSectionPlotContainer')?.clientWidth || 800;
        const aspectRatio = maxDist / elevRange;

        if (aspectRatio > 1) {
            // 가로가 더 긴 경우 - 컨테이너 너비에 맞추고 높이 계산
            plotWidth = Math.max(containerWidth, maxDist * 10); // 최소 10px/m
            plotHeight = plotWidth / aspectRatio;
            // 최소 높이 보장
            if (plotHeight < 300) {
                plotHeight = 300;
                plotWidth = plotHeight * aspectRatio;
            }
        } else {
            // 세로가 더 긴 경우 - 높이에 맞추고 너비 계산
            plotHeight = Math.max(500, elevRange * 10);
            plotWidth = plotHeight * aspectRatio;
            // 최소 너비 보장
            if (plotWidth < containerWidth) {
                plotWidth = containerWidth;
            }
        }

        // 최대 크기 제한
        plotWidth = Math.min(plotWidth, 3000);
        plotHeight = Math.min(plotHeight, 1500);
    }

    const layout = {
        title: {
            text: `지반 단면도` + (isRealScale ? ' (실축적 1:1)' : ''),
            font: { size: 16, family: 'Malgun Gothic, sans-serif', color: '#455A64' },
            y: 0.98
        },
        xaxis: {
            title: { text: '거리 (m)', font: { size: 12 } },
            range: [-maxDist * 0.05, maxDist * 1.05],
            showgrid: true,
            gridcolor: '#e0e0e0',
            zeroline: false,
            tickfont: { size: 10 },
            // 실축적 모드에서 Y축에 고정
            ...(isRealScale && { scaleanchor: 'y', scaleratio: 1, constrain: 'domain' })
        },
        yaxis: {
            title: { text: '표고 (E.L. m)', font: { size: 12 } },
            range: [minElev, maxElev + (maxElev - minElev) * 0.25],
            showgrid: true,
            gridcolor: '#e0e0e0',
            zeroline: false,
            tickfont: { size: 10 },
            ...(isRealScale && { constrain: 'domain' })
        },
        margin: { l: 60, r: 20, b: 50, t: 100 },
        hovermode: 'closest',
        showlegend: true,
        legend: {
            orientation: 'h',
            y: 1.02,
            x: 0.5,
            xanchor: 'center',
            font: { size: 9 },
            bgcolor: 'rgba(255,255,255,0.8)',
            bordercolor: '#ddd',
            borderwidth: 1
        },
        font: { family: 'Malgun Gothic, sans-serif' },
        plot_bgcolor: '#FAFAFA',
        paper_bgcolor: 'white',
        annotations: annotations,
        // 실축적 모드에서 크기 지정
        ...(isRealScale && plotWidth && { width: plotWidth, height: plotHeight })
    };

    // 플롯 div 크기 조정 (plotDiv는 함수 시작에서 이미 선언됨)
    if (isRealScale && plotWidth) {
        plotDiv.style.width = plotWidth + 'px';
        plotDiv.style.height = plotHeight + 'px';
        plotDiv.style.minWidth = plotWidth + 'px';
    } else {
        plotDiv.style.width = '100%';
        plotDiv.style.height = '500px';
        plotDiv.style.minWidth = '100%';
    }

    // Plotly config - 줌/팬 기능 활성화
    const config = {
        responsive: true,
        displayModeBar: true,
        scrollZoom: true,
        modeBarButtonsToAdd: ['pan2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'resetScale2d'],
        displaylogo: false
    };

    Plotly.newPlot(targetDivId, traces, layout, config);
}

// 간략 단면도 보기 (Plotly 기반 - 모달)
function showSimpleCrossSection() {
    if (selectedBoreholes.length < 2) {
        alert('간략 단면도를 보려면 2개 이상의 시추공을 선택해주세요.');
        return;
    }

    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = `간략 지반 단면도 (${selectedBoreholes.join(' → ')})`;

    // 모달 본문에 Plotly 컨테이너 생성
    modalBody.innerHTML = `
        <div style="padding: 10px;">
            <div id="simpleCrossSectionPlot" style="width: 100%; height: 600px;"></div>
        </div>
    `;

    modal.style.display = 'block';

    // Plotly 단면도 렌더링
    setTimeout(() => {
        _renderPlotlyCrossSection('simpleCrossSectionPlot');
    }, 100);
}

// 스케일 모드 변경 함수 (더 이상 사용되지 않음, 호환성 유지)
function updateCrossSectionScale() {
    // SVG 기반으로 변경되어 별도 스케일 옵션 불필요
}

// SVG 기반 상세 단면도를 지정된 div에 렌더링
function renderDetailedCrossSectionToDiv(targetDiv, title) {
    if (selectedBoreholes.length < 2) {
        targetDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><p>단면도를 보려면 2개 이상의 시추공을 선택하세요.</p></div>';
        return;
    }

    // 선택된 시추공 데이터 준비
    const selectedPointsData = selectedBoreholes.map(holeNo => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh) return null;
        const layers = getDetailedLayers(bh);
        return {
            holeNo,
            x: parseFloat(bh.x),
            y: parseFloat(bh.y),
            groundElevation: parseFloat(bh.groundElevation || 0),
            layers: layers,
            totalDepth: parseFloat(bh.totalDepth || 0)
        };
    }).filter(p => p !== null);

    if (selectedPointsData.length < 2) {
        targetDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;"><p>유효한 시추공 데이터가 부족합니다.</p></div>';
        return;
    }

    // 누적 거리 계산
    let cumulativeDistances = [0];
    for (let i = 1; i < selectedPointsData.length; i++) {
        const prev = selectedPointsData[i - 1];
        const curr = selectedPointsData[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }

    const totalDist = cumulativeDistances[cumulativeDistances.length - 1];

    // 표고 범위 계산
    let minElev = Infinity, maxElev = -Infinity;
    selectedPointsData.forEach(pt => {
        if (pt.groundElevation > maxElev) maxElev = pt.groundElevation;
        pt.layers.forEach(layer => {
            if (layer.elevationBottom < minElev) minElev = layer.elevationBottom;
        });
    });

    // SVG 크기 설정 (컨테이너에 맞게 조정)
    const containerWidth = targetDiv.clientWidth || 900;
    const svgWidth = Math.max(800, containerWidth - 20);
    const svgHeight = 500;
    const margin = { top: 60, right: 30, bottom: 60, left: 80 };
    const plotWidth = svgWidth - margin.left - margin.right;
    const plotHeight = svgHeight - margin.top - margin.bottom;

    // 스케일 함수
    const xScale = (dist) => margin.left + (dist / totalDist) * plotWidth;
    const yScale = (elev) => margin.top + ((maxElev + 5 - elev) / (maxElev + 5 - minElev + 5)) * plotHeight;

    // 모든 지질 유형 수집 (범례용)
    const allSoilTypes = new Map();
    selectedPointsData.forEach(pt => {
        pt.layers.forEach(layer => {
            if (!allSoilTypes.has(layer.soilType)) {
                allSoilTypes.set(layer.soilType, { label: layer.label, color: layer.color, order: layer.order });
            }
        });
    });

    // SVG 생성
    let svgContent = `
        <svg width="${svgWidth}" height="${svgHeight}" style="background: #FAFAFA; border: 1px solid #ddd; border-radius: 8px;">
            <!-- 그리드 -->
            <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
                </pattern>
            </defs>
            <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="url(#grid)"/>
    `;

    // 시추공 기둥 및 지층 그리기
    const columnWidth = Math.min(40, plotWidth / (selectedPointsData.length * 2));

    selectedPointsData.forEach((pt, ptIdx) => {
        const xPos = xScale(cumulativeDistances[ptIdx]);

        pt.layers.forEach(layer => {
            const y1 = yScale(layer.elevationTop);
            const y2 = yScale(layer.elevationBottom);
            const height = y2 - y1;

            svgContent += `
                <rect x="${xPos - columnWidth / 2}" y="${y1}" width="${columnWidth}" height="${height}"
                      fill="${layer.color}" stroke="#333" stroke-width="1"
                      class="cross-section-layer"
                      data-soil="${layer.soilName}" data-depth="${layer.depthStart.toFixed(1)}~${layer.depthEnd.toFixed(1)}m"
                      data-elev="EL.${layer.elevationTop.toFixed(1)}~${layer.elevationBottom.toFixed(1)}m"/>
            `;

            // 레이어 라벨 (충분히 두꺼운 경우만)
            if (height > 20) {
                svgContent += `
                    <text x="${xPos}" y="${y1 + height / 2}" font-size="9" fill="white" text-anchor="middle"
                          dominant-baseline="middle" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                        ${layer.soilName.substring(0, 6)}
                    </text>
                `;
            }
        });

        // 시추공 라벨
        svgContent += `
            <text x="${xPos}" y="${yScale(pt.groundElevation) - 25}" font-size="12" fill="#455A64"
                  text-anchor="middle" font-weight="bold">${pt.holeNo}</text>
            <text x="${xPos}" y="${yScale(pt.groundElevation) - 10}" font-size="9" fill="#666"
                  text-anchor="middle">EL.${pt.groundElevation.toFixed(1)}m</text>
        `;
    });

    // 지표면 연결선 제거됨 - 지층 경계선이 중요함

    // X축 (거리)
    svgContent += `
        <line x1="${margin.left}" y1="${svgHeight - margin.bottom}" x2="${svgWidth - margin.right}" y2="${svgHeight - margin.bottom}" stroke="#333" stroke-width="2"/>
        <text x="${svgWidth / 2}" y="${svgHeight - 15}" font-size="12" fill="#333" text-anchor="middle">거리 (m)</text>
    `;

    // X축 눈금
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
        const dist = (totalDist / xTicks) * i;
        const xPos = xScale(dist);
        svgContent += `
            <line x1="${xPos}" y1="${svgHeight - margin.bottom}" x2="${xPos}" y2="${svgHeight - margin.bottom + 5}" stroke="#333"/>
            <text x="${xPos}" y="${svgHeight - margin.bottom + 18}" font-size="10" fill="#333" text-anchor="middle">${dist.toFixed(0)}</text>
        `;
    }

    // Y축 (표고)
    svgContent += `
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${svgHeight - margin.bottom}" stroke="#333" stroke-width="2"/>
        <text x="15" y="${svgHeight / 2}" font-size="12" fill="#333" text-anchor="middle" transform="rotate(-90, 15, ${svgHeight / 2})">표고 (E.L. m)</text>
    `;

    // Y축 눈금
    const yRange = maxElev + 5 - minElev + 5;
    const yTicks = Math.ceil(yRange / 5);
    for (let i = 0; i <= yTicks; i++) {
        const elev = minElev - 5 + (yRange / yTicks) * i;
        const yPos = yScale(elev);
        if (yPos >= margin.top && yPos <= svgHeight - margin.bottom) {
            svgContent += `
                <line x1="${margin.left - 5}" y1="${yPos}" x2="${margin.left}" y2="${yPos}" stroke="#333"/>
                <text x="${margin.left - 10}" y="${yPos + 4}" font-size="10" fill="#333" text-anchor="end">${elev.toFixed(0)}</text>
            `;
        }
    }

    // 범례
    const sortedTypes = Array.from(allSoilTypes.entries()).sort((a, b) => b[1].order - a[1].order);
    let legendX = margin.left;
    let legendY = 25;
    sortedTypes.forEach(([type, info], idx) => {
        if (legendX + 80 > svgWidth - margin.right) {
            legendX = margin.left;
            legendY += 18;
        }
        svgContent += `
            <rect x="${legendX}" y="${legendY - 10}" width="12" height="12" fill="${info.color}" stroke="#333" stroke-width="0.5"/>
            <text x="${legendX + 16}" y="${legendY}" font-size="10" fill="#333">${info.label}</text>
        `;
        legendX += 80;
    });

    svgContent += '</svg>';

    // 스타일 추가 (한 번만)
    if (!document.getElementById('crossSectionStyles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'crossSectionStyles';
        styleEl.textContent = `
            .cross-section-layer:hover {
                opacity: 0.8;
                cursor: pointer;
            }
            .cross-section-tooltip {
                position: absolute;
                background: rgba(0,0,0,0.85);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                pointer-events: none;
                z-index: 10000;
            }
        `;
        document.head.appendChild(styleEl);
    }

    targetDiv.innerHTML = `
        <div style="padding: 10px; overflow-x: auto;">
            <div style="min-width: ${svgWidth}px;">
                ${svgContent}
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #666; text-align: center;">
                지층에 마우스를 올리면 상세 정보를 확인할 수 있습니다.
            </div>
        </div>
    `;

    // 툴팁 이벤트
    setTimeout(() => {
        let tooltip = document.getElementById('crossSectionTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'crossSectionTooltip';
            tooltip.className = 'cross-section-tooltip';
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
        }

        targetDiv.querySelectorAll('.cross-section-layer').forEach(layer => {
            layer.addEventListener('mouseenter', (e) => {
                const soil = e.target.getAttribute('data-soil');
                const depth = e.target.getAttribute('data-depth');
                const elev = e.target.getAttribute('data-elev');
                tooltip.innerHTML = `<strong>${soil}</strong><br>심도: ${depth}<br>표고: ${elev}`;
                tooltip.style.display = 'block';
            });
            layer.addEventListener('mousemove', (e) => {
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY + 15) + 'px';
            });
            layer.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }, 100);
}

// 상세 단면도 보기 (모달 - 호환성 유지)
function showDetailedCrossSection() {
    if (selectedBoreholes.length < 2) {
        alert('상세 단면도를 보려면 2개 이상의 시추공을 선택해주세요.');
        return;
    }

    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = `지층 연결 단면도 (${selectedBoreholes.join(' → ')})`;
    modalBody.innerHTML = '<div id="modalCrossSectionDiv" style="min-height: 500px;"></div>';
    modal.style.display = 'block';

    setTimeout(() => {
        const modalDiv = document.getElementById('modalCrossSectionDiv');
        if (modalDiv) {
            renderDetailedCrossSectionToDiv(modalDiv, selectedBoreholes.join(' → '));
        }
    }, 100);
}

// Modal Close Function
function closeModal() {
    const modal = document.getElementById('calculationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 3D 좌표 반전 상태 (VisualizationState 확장)
let flip3dX = false;
let flip3dY = false;

// WGS84 좌표 캐시 (성능 개선)
let cached3dWgs84Coords = null;
let cached3dGridX = null;
let cached3dGridY = null;

// 3D Model Visualization (체크박스 기반 다중 선택)
function update3DVisualization() {
    console.log('[3D] update3DVisualization called');

    const plotDiv = document.getElementById('3dPlot');
    if (!plotDiv) {
        console.error('[3D] 3dPlot element not found');
        return;
    }

    if (!boreholeData || boreholeData.length === 0) {
        plotDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">데이터가 없습니다. JSON 파일을 업로드하세요.</p>';
        console.log('[3D] No borehole data available');
        return;
    }

    console.log('[3D] Borehole data count:', boreholeData.length);

    try {
        // 좌표 변환기 초기화 (필요시)
        if (!window.universalTransformer) {
            if (typeof UniversalCoordinateTransformer !== 'undefined') {
                window.universalTransformer = new UniversalCoordinateTransformer();
                console.log('[3D] Created new UniversalCoordinateTransformer');
            } else {
                console.warn('[3D] UniversalCoordinateTransformer not defined');
            }
        }

        // 좌표 시스템 자동 감지 (아직 감지되지 않은 경우)
        if (window.universalTransformer && !window.universalTransformer.detectedEPSG) {
            const coordinates = boreholeData.map(bh => ({
                x: parseFloat(bh.x) || 0,
                y: parseFloat(bh.y) || 0
            })).filter(c => c.x !== 0 && c.y !== 0);

            if (coordinates.length > 0) {
                const metadata = boreholeData[0]?.metadata || {};
                const detection = window.universalTransformer.detectCoordinateSystem(coordinates, metadata);
                console.log('[3D] Coordinate system detected:', detection);

                // 한국 좌표계인 경우 KoreanCoordinateTransformer도 업데이트
                if (detection.type === CRS_TYPE.KOREAN_TM) {
                    window.coordinateTransformer = new KoreanCoordinateTransformer(detection.epsg);
                    console.log('[3D] KoreanCoordinateTransformer updated to:', detection.epsg);
                }
            }
        }

        // 시각화 데이터 생성 (필요시)
        if (!window.visualizationData || !window.visualizationData['3d_data'] || !window.visualizationData['3d_data']['multilayer']) {
            console.log('[3D] Generating visualization data...');
            generateVisualizationData();
            cached3dWgs84Coords = null; // 새 데이터 생성시 캐시 무효화
            console.log('[3D] Visualization data generated');
        }

        const data3d = window.visualizationData?.['3d_data']?.['multilayer'];
        if (!data3d || !data3d.x || data3d.x.length === 0) {
            plotDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">3D 데이터가 없습니다. 분석 실행 버튼을 클릭하세요.</p>';
            console.log('[3D] No multilayer data available');
            return;
        }

        console.log('[3D] Data3d available, grid size:', data3d.x.length, 'x', data3d.y.length);

        // 체크박스 상태 확인
        const showElevation = document.getElementById('chk3dElevation')?.checked ?? true;
        const showGWL = document.getElementById('chk3dGWL')?.checked ?? true;
        const showWeatheredRock = document.getElementById('chk3dWeatheredRock')?.checked ?? true;
        const showSoftRock = document.getElementById('chk3dSoftRock')?.checked ?? true;
        const showExcavation = document.getElementById('chk3dExcavation')?.checked ?? true;

    // 3D 시각화에서 TM 좌표 직접 사용 (좌표 변환은 불안정하므로 제거)
    // 한국 TM 좌표계: X = Northing(북), Y = Easting(동)
    // Plotly 3D surface에서: x축 = 동서(Easting), y축 = 남북(Northing)
    // 따라서 축을 교환: data3d.y -> plotX, data3d.x -> plotY

    // TM 좌표 축 교환 (2D 맵과 방향 일치)
    const plotX = [...data3d.y];  // Easting -> X축 (동서 방향)
    const plotY = [...data3d.x];  // Northing -> Y축 (남북 방향)

    // Z 데이터도 축 교환에 맞게 전치 (transpose)
    function transposeZData(zData) {
        if (!zData || !Array.isArray(zData) || zData.length === 0) return zData;
        const rows = zData.length;
        const cols = zData[0]?.length || 0;
        if (cols === 0) return zData;

        const transposed = [];
        for (let j = 0; j < cols; j++) {
            const newRow = [];
            for (let i = 0; i < rows; i++) {
                newRow.push(zData[i][j]);
            }
            transposed.push(newRow);
        }
        return transposed;
    }

    // flipZDataY는 이제 transpose 역할
    function flipZDataY(zData) {
        return transposeZData(zData);
    }

    console.log('[3D] Using TM coordinates with axis swap');
    console.log('[3D] X(Easting) range:', Math.min(...plotX).toFixed(1), '~', Math.max(...plotX).toFixed(1));
    console.log('[3D] Y(Northing) range:', Math.min(...plotY).toFixed(1), '~', Math.max(...plotY).toFixed(1));

    const traces = [];

    // z 데이터 유효성 검사 헬퍼 함수
    function isValidZData(zData) {
        return zData && Array.isArray(zData) && zData.length > 0 &&
               zData[0] && Array.isArray(zData[0]) && zData[0].length > 0;
    }

    console.log('[3D] Surface data check - z_surface:', isValidZData(data3d.z_surface),
                'z_gwl:', isValidZData(data3d.z_gwl),
                'z_weathered_rock:', isValidZData(data3d.z_weathered_rock));

    // 좌표 및 Z값 범위 로깅
    const xRange = [Math.min(...plotX), Math.max(...plotX)];
    const yRange = [Math.min(...plotY), Math.max(...plotY)];

    // 각 레이어별 Z값 범위 계산
    function getZRange(zData) {
        if (!isValidZData(zData)) return [null, null];
        let min = Infinity, max = -Infinity;
        zData.forEach(row => row.forEach(v => {
            if (v !== null && !isNaN(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }));
        return [min, max];
    }

    const zRanges = {
        surface: getZRange(data3d.z_surface),
        gwl: getZRange(data3d.z_gwl),
        weathered: getZRange(data3d.z_weathered_rock),
        softRock: getZRange(data3d.z_soft_rock)
    };

    console.log('[3D] Coordinate ranges - X:', xRange, 'Y:', yRange);
    console.log('[3D] Z ranges - Surface:', zRanges.surface, 'GWL:', zRanges.gwl,
                'Weathered:', zRanges.weathered, 'SoftRock:', zRanges.softRock);

    // 레이어 순서 검증 (지표면 > 지하수위 > 풍화암 > 연암)
    if (zRanges.surface[0] !== null && zRanges.gwl[0] !== null) {
        if (zRanges.gwl[1] > zRanges.surface[1]) {
            console.warn('[3D] Warning: GWL max is higher than surface max!');
        }
    }

    // === 지층 레이어 (아래에서 위 순서로 추가: 연암 → 풍화암 → 지하수위 → 지표면) ===

    // 1. 연암 표면 (가장 아래)
    if (showSoftRock && isValidZData(data3d.z_soft_rock)) {
        traces.push({
            x: plotX,
            y: plotY,
            z: flipZDataY(data3d.z_soft_rock),
            type: 'surface',
            name: '연암',
            colorscale: [[0.0, '#4A5568'], [0.5, '#718096'], [1.0, '#A0AEC0']],
            opacity: 1.0,
            showscale: false,
            hovertemplate: '연암<br>X: %{x:.5f}<br>Y: %{y:.5f}<br>EL: %{z:.1f}m<extra></extra>',
            contours: {
                z: { show: showContours, color: 'rgba(47,79,79,0.5)', width: 1, highlightcolor: '#2F4F4F' }
            }
        });
    }

    // 2. 풍화암 표면
    if (showWeatheredRock && isValidZData(data3d.z_weathered_rock)) {
        traces.push({
            x: plotX,
            y: plotY,
            z: flipZDataY(data3d.z_weathered_rock),
            type: 'surface',
            name: '풍화암',
            colorscale: [[0.0, '#B7791F'], [0.5, '#D69E2E'], [1.0, '#ECC94B']],
            opacity: 0.95,
            showscale: false,
            hovertemplate: '풍화암<br>X: %{x:.5f}<br>Y: %{y:.5f}<br>EL: %{z:.1f}m<extra></extra>',
            contours: {
                z: { show: showContours, color: 'rgba(205,133,63,0.5)', width: 1 }
            }
        });
    }

    // 3. 지하수위
    if (showGWL && isValidZData(data3d.z_gwl)) {
        traces.push({
            x: plotX,
            y: plotY,
            z: flipZDataY(data3d.z_gwl),
            type: 'surface',
            name: '지하수위',
            colorscale: [[0.0, '#63B3ED'], [0.5, '#3182CE'], [1.0, '#2B6CB0']],
            opacity: 0.6,
            showscale: false,
            hovertemplate: '지하수위<br>X: %{x:.5f}<br>Y: %{y:.5f}<br>EL: %{z:.1f}m<extra></extra>',
            contours: {
                z: { show: showContours, color: 'rgba(0,0,255,0.4)', width: 1 }
            }
        });
    }

    // 4. 지표면 (가장 위)
    if (showElevation && isValidZData(data3d.z_surface)) {
        traces.push({
            x: plotX,
            y: plotY,
            z: flipZDataY(data3d.z_surface),
            type: 'surface',
            name: '지표면',
            colorscale: [[0.0, '#744210'], [0.3, '#975A16'], [0.5, '#68D391'], [0.7, '#48BB78'], [1.0, '#276749']],
            opacity: 0.85,
            showscale: false,
            hovertemplate: '지표면<br>X: %{x:.5f}<br>Y: %{y:.5f}<br>EL: %{z:.1f}m<extra></extra>',
            contours: {
                z: { show: showContours, color: 'rgba(0,0,0,0.4)', width: 2 }
            }
        });
    }

    // 굴착면
    if (showExcavation && isValidZData(data3d.z_excavation)) {
        traces.push({
            x: plotX,
            y: plotY,
            z: flipZDataY(data3d.z_excavation),
            type: 'surface',
            name: '굴착면',
            colorscale: [[0.0, '#E0E0E0'], [1.0, '#757575']],
            opacity: 0.6,
            showscale: false,
            contours: {
                x: { show: showContours, color: 'rgba(0,0,0,0.2)', width: 1 },
                y: { show: showContours, color: 'rgba(0,0,0,0.2)', width: 1 },
                z: { show: showContours, color: 'rgba(0,0,0,0.3)', width: 2 }
            }
        });
    }

    // 시추공 마커 (TM 좌표 축 교환 - 3D 표면과 동일하게)
    if (showBoreholes) {
        // 판정 결과 표시 체크박스 상태 확인
        const show3DFoundation = document.getElementById('chk3DFoundation')?.checked ?? true;
        const show3DSoftGround = document.getElementById('chk3DSoftGround')?.checked ?? false;
        const show3DSpecialLayer = document.getElementById('chk3DSpecialLayer')?.checked ?? false;

        // 시추공 데이터 처리 (TM 좌표 축 교환 - 2D 맵과 방향 일치)
        const boreholePositions = [];
        boreholeData.forEach(bh => {
            if (bh.x && bh.y) {
                const tmX = parseFloat(bh.x); // TM X (Northing)
                const tmY = parseFloat(bh.y); // TM Y (Easting)

                // 축 교환: 3D 표면과 동일하게 Y->X, X->Y
                // plotX = Easting (tmY), plotY = Northing (tmX)
                const coordX = tmY; // Easting -> 3D X축
                const coordY = tmX; // Northing -> 3D Y축

                // 판정 결과에 따른 마커 색상 결정
                const markerColor = getContourMarkerColor(bh, show3DFoundation, show3DSoftGround, show3DSpecialLayer);
                const groundEl = parseFloat(bh.groundElevation) || 0;
                const totalDepth = parseFloat(bh.totalDepth) || 20; // 시추 깊이
                const boreholeEndEl = groundEl - totalDepth; // 시추 종료 표고

                boreholePositions.push({
                    holeNo: bh.holeNo,
                    x: coordX,
                    y: coordY,
                    groundElevation: groundEl,
                    boreholeEndElevation: boreholeEndEl,
                    totalDepth: totalDepth,
                    color: markerColor
                });
            }
        });

        if (boreholePositions.length > 0) {
            // 가장 높은 지표고 찾기 (모든 마커를 이 높이에 배치)
            const maxElevation = Math.max(...boreholePositions.map(b => b.groundElevation));
            const markerLevel = maxElevation + 2; // 최고 지표고보다 2m 위에 마커 배치

            // 시추공 마커 색상 - 필터 선택에 따라 판정 결과 색상 또는 기본 색상 사용
            const useFilterColors = show3DFoundation || show3DSoftGround || show3DSpecialLayer;
            const defaultMarkerColor = '#00ACC1'; // Cyan 600 (기본)
            const boreholeLineColor = '#0097A7';   // Cyan 700

            // 판정 결과 색상 배열 (필터 활성화 시 사용)
            const markerColors = useFilterColors
                ? boreholePositions.map(b => b.color)
                : boreholePositions.map(() => defaultMarkerColor);

            console.log(`[3D Filter] useFilterColors: ${useFilterColors}, Foundation: ${show3DFoundation}, SoftGround: ${show3DSoftGround}, SpecialLayer: ${show3DSpecialLayer}`);
            if (useFilterColors) {
                const colorCounts = {};
                markerColors.forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
                console.log('[3D Filter] 마커 색상 분포:', colorCounts);
            }

            // 1. 시추공 위치 마커 (통일된 높이에 배치, 필터에 따른 색상 적용)
            traces.push({
                x: boreholePositions.map(b => b.x),
                y: boreholePositions.map(b => b.y),
                z: boreholePositions.map(() => markerLevel), // 모든 마커 동일 높이
                mode: 'markers+text',
                type: 'scatter3d',
                marker: {
                    size: useFilterColors ? 8 : 5,  // 필터 사용 시 더 크게
                    color: markerColors,  // 판정 결과에 따른 색상 배열
                    symbol: 'diamond',
                    line: { color: 'white', width: useFilterColors ? 2 : 1 }
                },
                text: boreholePositions.map(b => b.holeNo),
                textposition: 'top center',
                textfont: { size: 9, color: '#333', family: 'Arial' },
                name: '시추공',
                customdata: boreholePositions.map(b => ({
                    groundEl: b.groundElevation.toFixed(1),
                    depth: b.totalDepth.toFixed(1),
                    endEl: b.boreholeEndElevation.toFixed(1)
                })),
                hovertemplate: '<b>%{text}</b><br>지표고: EL.%{customdata.groundEl}m<br>시추깊이: %{customdata.depth}m<br>시추종료: EL.%{customdata.endEl}m<extra></extra>'
            });

            // 2. 시추공별 수직 점선 (마커에서 시추 종료 깊이까지)
            boreholePositions.forEach((bh, idx) => {
                // 점선 효과를 위해 여러 개의 점으로 구성된 라인
                const numPoints = 20; // 점선을 구성하는 점 개수
                const lineX = [];
                const lineY = [];
                const lineZ = [];

                for (let i = 0; i <= numPoints; i++) {
                    const t = i / numPoints;
                    lineX.push(bh.x);
                    lineY.push(bh.y);
                    // 마커 높이에서 시추 종료 표고까지
                    lineZ.push(markerLevel - t * (markerLevel - bh.boreholeEndElevation));
                }

                traces.push({
                    x: lineX,
                    y: lineY,
                    z: lineZ,
                    mode: 'lines',
                    type: 'scatter3d',
                    line: {
                        color: boreholeLineColor,
                        width: 3,
                        dash: 'dot'  // 점선
                    },
                    name: idx === 0 ? '시추 깊이' : '', // 첫 번째만 범례에 표시
                    showlegend: idx === 0,
                    hoverinfo: 'skip'
                });

                // 3. 시추 종료점 마커 (작은 점)
                traces.push({
                    x: [bh.x],
                    y: [bh.y],
                    z: [bh.boreholeEndElevation],
                    mode: 'markers',
                    type: 'scatter3d',
                    marker: {
                        size: 3,
                        color: '#FF7043', // Deep Orange 400
                        symbol: 'circle'
                    },
                    name: '',
                    showlegend: false,
                    hovertemplate: `<b>${bh.holeNo}</b><br>지표고: EL.${bh.groundElevation.toFixed(1)}m<br>시추깊이: ${bh.totalDepth.toFixed(1)}m<br>시추종료: EL.${bh.boreholeEndElevation.toFixed(1)}m<extra></extra>`
                });
            });
        }
    }

    // 선택된 레이어 이름으로 제목 생성
    const selectedLayers = [];
    if (showElevation) selectedLayers.push('지표면');
    if (showGWL) selectedLayers.push('지하수위');
    if (showWeatheredRock) selectedLayers.push('풍화암');
    if (showSoftRock) selectedLayers.push('연암');
    if (showExcavation) selectedLayers.push('굴착면');
    const isRealScale3D = scale3DMode === 'real';
    const scaleLabel = isRealScale3D ? ' - 실축적' : (zScaleMultiplier !== 1 ? ` - Z축 ${zScaleMultiplier}x` : '');
    const title = selectedLayers.length > 0 ? `3D 지질 모델 (${selectedLayers.join(', ')})${scaleLabel}` : '3D 지질 모델';

    // TM 좌표 범위 계산 (미터 단위)
    const xMin = Math.min(...plotX);
    const xMax = Math.max(...plotX);
    const yMin = Math.min(...plotY);
    const yMax = Math.max(...plotY);

    // X, Y 범위 (미터 단위)
    const xRangeMeters = xMax - xMin;
    const yRangeMeters = yMax - yMin;

    // Z 범위 계산 (모든 표면에서)
    let zMin = Infinity, zMax = -Infinity;
    [data3d.z_surface, data3d.z_gwl, data3d.z_weathered_rock, data3d.z_soft_rock, data3d.z_excavation].forEach(zData => {
        if (zData) {
            zData.forEach(row => {
                if (row) {
                    row.forEach(val => {
                        if (val !== null && val !== undefined && !isNaN(val)) {
                            if (val < zMin) zMin = val;
                            if (val > zMax) zMax = val;
                        }
                    });
                }
            });
        }
    });

    const zRange = zMax - zMin;

    // 스케일 비율 계산 (실제 미터 기준)
    let aspectRatio = {};
    if (isRealScale3D) {
        const maxRange = Math.max(xRangeMeters, yRangeMeters, zRange);
        aspectRatio = {
            x: xRangeMeters / maxRange,
            y: yRangeMeters / maxRange,
            z: zRange / maxRange
        };
    } else {
        const xyMaxRange = Math.max(xRangeMeters, yRangeMeters);
        aspectRatio = {
            x: xRangeMeters / xyMaxRange,
            y: yRangeMeters / xyMaxRange,
            z: (zRange / xyMaxRange) * zScaleMultiplier
        };
    }

    const layout = {
        title: title,
        scene: {
            xaxis: {
                title: 'X (m)',
                tickformat: '.0f'
            },
            yaxis: {
                title: 'Y (m)',
                tickformat: '.0f'
            },
            zaxis: { title: '표고 (E.L. m)' },
            camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
            aspectmode: isRealScale3D ? 'data' : 'manual',
            aspectratio: aspectRatio
        },
        width: document.getElementById('3dPlot').offsetWidth,
        height: 700,
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: 'rgba(255,255,255,0.8)'
        }
    };
    
    // Plotly 라이브러리 확인
    if (typeof Plotly === 'undefined') {
        console.error('[3D] Plotly library not loaded');
        plotDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #c00;">Plotly 라이브러리가 로드되지 않았습니다.</p>';
        return;
    }

    // traces 배열 유효성 확인
    if (!traces || traces.length === 0) {
        console.warn('[3D] No traces to render');
        plotDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">표시할 레이어를 선택하세요.</p>';
        return;
    }

    console.log('[3D] Rendering', traces.length, 'traces');

    // 성능 개선: Plotly.react 사용 (기존 플롯이 있으면 업데이트만)
    const hasExistingPlot = plotDiv.data && plotDiv.data.length > 0;
    const plotConfig = {responsive: true, scrollZoom: true};

    if (hasExistingPlot) {
        // 기존 플롯 업데이트 (더 빠름)
        Plotly.react(plotDiv, traces, layout, plotConfig).catch(function(err) {
            console.error('[3D] Plotly.react error:', err);
        });
    } else {
        // 새 플롯 생성
        Plotly.newPlot(plotDiv, traces, layout, plotConfig).then(function() {
            console.log('[3D] Plot rendered successfully');
            // 시추공 마커 클릭 이벤트 추가 (최초 생성시에만)
            plotDiv.on('plotly_click', function(data) {
                if (data.points && data.points.length > 0) {
                    const pt = data.points[0];
                    // 시추공 마커인지 확인 (scatter3d 타입이고 name이 '시추공'인 경우)
                    if (pt.data.type === 'scatter3d' && pt.data.name === '시추공') {
                        // text 배열에서 해당 인덱스의 holeNo 가져오기
                        const holeNo = pt.data.text[pt.pointIndex] || pt.text;
                        if (holeNo && typeof showBoreholeLog === 'function') {
                            showBoreholeLog(holeNo);
                        }
                    }
                }
            });
        }).catch(function(err) {
            console.error('[3D] Plotly.newPlot error:', err);
            plotDiv.innerHTML = `<p style="padding: 20px; text-align: center; color: #c00;">3D 렌더링 오류: ${err.message}</p>`;
        });
    }

    } catch (error) {
        console.error('[3D] Error in update3DVisualization:', error);
        plotDiv.innerHTML = `<p style="padding: 20px; text-align: center; color: #c00;">3D 시각화 오류: ${error.message}</p>`;
    }
}

// 호환성을 위한 기존 함수 (체크박스 기반으로 변경)
function show3DModel(type) {
    // 기존 호출을 위해 유지하되, 체크박스 기반으로 전환
    update3DVisualization();
}

// Toggle contour visibility
function toggleContourVisibility() {
    showContours = !showContours;
    const button = document.getElementById('toggleContours');
    if (button) {
        button.textContent = showContours ? '등고선 숨기기' : '등고선 표시';
    }
    show3DModel(current3DType);
}

// 3D 스케일 모드 변경 함수
function update3DScale() {
    const scaleReal = document.getElementById('scale3DReal');
    scale3DMode = scaleReal && scaleReal.checked ? 'real' : 'auto';

    // 실축적 모드에서는 Z축 배율 슬라이더 비활성화
    const sliderContainer = document.getElementById('zScaleSliderContainer');
    if (sliderContainer) {
        sliderContainer.style.opacity = scale3DMode === 'real' ? '0.5' : '1';
        sliderContainer.style.pointerEvents = scale3DMode === 'real' ? 'none' : 'auto';
    }

    // 실축적 모드에서는 배율을 1로 리셋
    if (scale3DMode === 'real') {
        zScaleMultiplier = 1;
        const slider = document.getElementById('zScaleSlider');
        const valueDisplay = document.getElementById('zScaleValue');
        if (slider) slider.value = 1;
        if (valueDisplay) valueDisplay.textContent = '1x';
    }

    // 3D 시각화 다시 그리기
    if (typeof update3DVisualization === 'function') {
        update3DVisualization();
    }
}

// Z축 배율 슬라이더 변경 함수
function update3DZScale() {
    const slider = document.getElementById('zScaleSlider');
    const valueDisplay = document.getElementById('zScaleValue');

    if (slider) {
        zScaleMultiplier = parseFloat(slider.value);
        if (valueDisplay) {
            valueDisplay.textContent = zScaleMultiplier + 'x';
        }

        // 3D 시각화 다시 그리기
        if (typeof update3DVisualization === 'function') {
            update3DVisualization();
        }
    }
}

// Drawing Overlay functions
function handleDrawingUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const overlayMessage = document.getElementById('overlayMessage');
    
    overlayTransform = { x: 0, y: 0, k: 1, rotate: 0 };
    wrapperOffset = { x: 0, y: 0 };
    
    if (file.type === 'application/pdf' && typeof pdfjsLib !== 'undefined') {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                pdfDoc = pdf;
                renderPdfPage(1);
                if (overlayMessage) overlayMessage.style.display = 'none';
            });
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        const img = new Image();
        img.onload = function() {
            window.currentImage = img;
            window.siteDrawingImage = img; // 3D 오버레이용 이미지 저장
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            if (overlayMessage) overlayMessage.style.display = 'none';
            
            // ✅ 도면 데이터를 전역 변수에 저장 (시각화 탭에서 사용)
            window.drawingImageData = {
                dataURL: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height
            };
            console.log('📁 도면 이미지 저장 완료:', window.drawingImageData.width + 'x' + window.drawingImageData.height);
            
            // 이미지 로드 후 약간의 지연을 두고 초기화 (레이아웃 안정화)
            setTimeout(() => {
                initZoomPan();
                updateOverlayCanvas();
                // 도면 업로드 시 2D/3D 시각화 자동 업데이트
                enableDrawingOverlayOnUpload();
            }, 100);
        };
        img.onerror = function() {
            if (overlayMessage) {
                overlayMessage.textContent = '이미지 로드에 실패했습니다.';
                overlayMessage.style.display = 'block';
            }
        };
        img.src = URL.createObjectURL(file);
    }
}

function renderPdfPage(num) {
    if (!pdfDoc || typeof pdfjsLib === 'undefined') return;
    return pdfDoc.getPage(num).then(function(page) {
        const scale = 3.0;
        const viewport = page.getViewport({scale: scale});
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvasScale = scale;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        return page.render(renderContext).promise.then(function() {
            // PDF를 이미지로 변환하여 저장 (3D 오버레이용)
            window.siteDrawingImage = new Image();
            window.siteDrawingImage.src = canvas.toDataURL('image/png');
            
            // ✅ 도면 데이터를 전역 변수에 저장 (시각화 탭에서 사용)
            window.drawingImageData = {
                dataURL: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height
            };
            console.log('📁 도면 이미지 저장 완료:', window.drawingImageData.width + 'x' + window.drawingImageData.height);

            // PDF 렌더링 후 약간의 지연을 두고 초기화 (레이아웃 안정화)
            setTimeout(() => {
                initZoomPan();
                updateOverlayCanvas();
                // 도면 업로드 시 2D/3D 시각화 자동 업데이트
                enableDrawingOverlayOnUpload();
            }, 100);
        }).catch(function(error) {
            // PDF 렌더링 오류 시 무시
        });
    });
}

function initZoomPan() {
    const canvas = document.getElementById('pdfCanvas');
    const container = document.querySelector('#overlayMain');
    if (!container || !canvas || canvas.width === 0 || canvas.height === 0) {
        return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const scaleX = (containerRect.width - 40) / canvas.width;
    const scaleY = (containerRect.height - 40) / canvas.height;
    const initialScale = Math.min(scaleX, scaleY, 1);
    
    overlayTransform.k = initialScale;
    overlayTransform.rotate = 0;
    
    // transform 적용
    updateTransform();
    
    container.onwheel = handleWheel;
    canvas.onmousedown = handleMouseDown;
    window.onmouseup = handleMouseUp;
    window.onmousemove = handleMouseMove;
    canvas.onclick = handleCanvasClick;
}

function handleWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    const newScale = overlayTransform.k * (1 + delta);
    
    if (newScale < 0.1 || newScale > 10) return;
    
    overlayTransform.k = newScale;
    updateTransform();
}

// 드래그 상호작용 타이밍
let lastDragEndTime = 0;

function handleMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = false;
    const container = document.querySelector('#overlayMain');
    const rect = container.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    dragStartPos = { x: e.clientX, y: e.clientY };
    if (container) container.style.cursor = 'grab';
}

function handleMouseUp(e) {
    const wasDragging = isDragging;
    isDragging = false;
    dragStartPos = null;
    const container = document.querySelector('#overlayMain');
    if (container) container.style.cursor = 'default';

    if (wasDragging) {
        lastDragEndTime = Date.now(); // 드래그 종료 시간 기록
        e.preventDefault();
        e.stopPropagation();
    }
}

function handleMouseMove(e) {
    if (!dragStartPos) return;
    
    const dx = Math.abs(e.clientX - dragStartPos.x);
    const dy = Math.abs(e.clientY - dragStartPos.y);
    
    if (dx > 5 || dy > 5) {
        isDragging = true;
        const container = document.querySelector('#overlayMain');
        if (container) container.style.cursor = 'grabbing';
    }
    
    if (isDragging) {
        e.preventDefault();
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        
        // wrapperOffset 업데이트
        wrapperOffset.x += deltaX;
        wrapperOffset.y += deltaY;
        
        dragStartPos = { x: e.clientX, y: e.clientY };
        updateTransform();
    }
}

function updateTransform() {
    const wrapper = document.getElementById('canvasWrapper');
    const canvas = document.getElementById('pdfCanvas');
    
    if (wrapper && canvas && canvas.width > 0 && canvas.height > 0) {
        // transform-origin을 canvas의 중앙으로 설정 (회전 기준점)
        wrapper.style.transformOrigin = `${canvas.width / 2}px ${canvas.height / 2}px`;
        
        // 기본 중앙 정렬은 CSS로 처리 (left: 50%, top: 50%, translate(-50%, -50%))
        // wrapperOffset을 추가하여 드래그 이동 반영
        // translate(-50%, -50%)는 중앙 정렬을 위해, 그 다음 scale과 rotate 적용
        wrapper.style.transform = `translate(calc(-50% + ${wrapperOffset.x}px), calc(-50% + ${wrapperOffset.y}px)) scale(${overlayTransform.k}) rotate(${overlayTransform.rotate || 0}deg)`;
    }
}

function rotateDrawing() {
    const canvas = document.getElementById('pdfCanvas');
    const container = document.querySelector('#overlayMain');
    if (!canvas || !container || canvas.width === 0 || canvas.height === 0) {
        console.warn('rotateDrawing: canvas not ready');
        return;
    }
    
    // 회전 각도 업데이트
    overlayTransform.rotate = (overlayTransform.rotate || 0) + 90;
    
    // 회전 후에도 중앙에 위치하도록 스케일 재조정
    const containerRect = container.getBoundingClientRect();
    const isRotated90or270 = (overlayTransform.rotate % 180) === 90;
    const canvasWidth = isRotated90or270 ? canvas.height : canvas.width;
    const canvasHeight = isRotated90or270 ? canvas.width : canvas.height;
    
    const scaleX = (containerRect.width - 40) / canvasWidth;
    const scaleY = (containerRect.height - 40) / canvasHeight;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    overlayTransform.k = newScale;
    
    updateTransform();
    updateOverlayCanvas();
}

function centerDrawing() {
    const canvas = document.getElementById('pdfCanvas');
    const container = document.querySelector('#overlayMain');
    
    if (!canvas || !container || canvas.width === 0 || canvas.height === 0) {
        console.warn('centerDrawing: canvas not ready');
        return;
    }
    
    const containerRect = container.getBoundingClientRect();
    
    // 회전을 고려한 실제 캔버스 크기
    const isRotated90or270 = (overlayTransform.rotate % 180) === 90;
    const canvasWidth = isRotated90or270 ? canvas.height : canvas.width;
    const canvasHeight = isRotated90or270 ? canvas.width : canvas.height;
    
    const scaleX = (containerRect.width - 40) / canvasWidth;
    const scaleY = (containerRect.height - 40) / canvasHeight;
    const initialScale = Math.min(scaleX, scaleY, 1);
    
    overlayTransform.k = initialScale;
    
    // wrapperOffset 초기화 (중앙 정렬)
    wrapperOffset.x = 0;
    wrapperOffset.y = 0;
    
    updateTransform();
    updateOverlayCanvas();
}

// ✅ 시각화 탭용 등고선 토글 (chkShowContour 체크박스 사용)
function toggleContourOverlayLegacy() {
    showContourOverlay = document.getElementById('chkShowContour').checked;
    const selContour = document.getElementById('selContourType');
    if (selContour) selContour.disabled = !showContourOverlay;
    updateOverlayCanvas();
}

function updateContourOverlayType() {
    contourOverlayType = document.getElementById('selContourType').value;
    updateOverlayCanvas();
}

// 직접 기초 판단 결과 필터링 업데이트
function updateFoundationFilter() {
    foundationFilter.direct = document.getElementById('filterDirect').checked;
    foundationFilter.replacement = document.getElementById('filterReplacement').checked;
    foundationFilter.pile = document.getElementById('filterPile').checked;
    foundationFilter.unknown = document.getElementById('filterUnknown').checked;
    updateOverlayCanvas();
}

// 구름 영역 토글
function toggleCloudAreas() {
    showCloudAreas = document.getElementById('chkShowCloudAreas').checked;
    // 개별 구름 영역 체크박스도 업데이트
    const cloudOptions = document.getElementById('cloudAreaOptions');
    if (cloudOptions) {
        cloudOptions.style.display = showCloudAreas ? 'block' : 'none';
    }
    updateOverlayCanvas();
}

// 개별 구름 영역 토글
function toggleCloudAreaType(type) {
    const checkbox = document.getElementById(`chkCloud_${type}`);
    if (checkbox) {
        cloudAreaSettings[type] = checkbox.checked;
        updateOverlayCanvas();
    }
}

// 직접 기초 판단 결과에 따른 색상 및 필터링 정보 가져오기
function getFoundationJudgmentInfo(bh, foundationResults) {
    let judgmentType = 'unknown'; // 'direct', 'replacement', 'pile', 'unknown'
    let markerColor = '#9E9E9E'; // 기본 색상 (회색 - 미판단)

    if (foundationResults && foundationResults.length > 0) {
        const result = foundationResults.find(r => r.holeNo === bh.holeNo);
        if (result) {
            if (result.judgment === '직접 기초') {
                judgmentType = 'direct';
                markerColor = '#2E7D32'; // 진한 초록색
            } else if (result.judgment.includes('치환 후 직접 기초 또는 파일 기초')) {
                judgmentType = 'replacement';
                markerColor = '#F57C00'; // 진한 주황색
            } else if (result.judgment === '파일 기초 필요') {
                judgmentType = 'pile';
                markerColor = '#C62828'; // 진한 붉은색
            }
        }
    }

    return { judgmentType, markerColor, shouldShow: true };
}

// 연약지반 판정 정보 가져오기
function getSoftGroundInfo(bh) {
    const weakSoilResults = Array.isArray(window.weakSoilAnalysisResults) ? window.weakSoilAnalysisResults :
                           Array.isArray(window.weakSoilResults) ? window.weakSoilResults : [];

    if (weakSoilResults.length > 0) {
        const result = weakSoilResults.find(r => r.holeNo === bh.holeNo);
        if (result && result.totalWeakZones > 0) {
            return { hasSoftGround: true, color: '#E53935' }; // 적색
        }
    }
    return { hasSoftGround: false, color: 'transparent' };
}

// 전석/붕적/이암 판정 정보 가져오기
function getSpecialLayerInfo(bh) {
    const boulderResults = Array.isArray(window.boulderDetectionResults) ? window.boulderDetectionResults :
                          Array.isArray(window.boulderResults) ? window.boulderResults : [];

    if (boulderResults.length > 0) {
        const result = boulderResults.find(r => r.holeNo === bh.holeNo);
        if (result) {
            // 전석/호박돌 체크
            const hasBoulder = result.totalBoulderCount > 0;
            // 붕적층/이암층 체크 (detectedColluvial 배열에서)
            const hasColluvium = result.totalColluvialCount > 0 ||
                                (result.detectedColluvial && result.detectedColluvial.length > 0);

            if (hasBoulder || hasColluvium) {
                // 상세 정보도 함께 반환
                return {
                    hasSpecialLayer: true,
                    hasBoulder: hasBoulder,
                    hasColluvium: hasColluvium,
                    boulderCount: result.totalBoulderCount || 0,
                    colluvialCount: result.totalColluvialCount || 0,
                    color: '#6D4C41' // 갈색
                };
            }
        }
    }
    return { hasSpecialLayer: false, hasBoulder: false, hasColluvium: false, boulderCount: 0, colluvialCount: 0, color: 'transparent' };
}

// 마커 표시 옵션 팝업 토글
function toggleMarkerOptionsPopup() {
    const popup = document.getElementById('markerOptionsPopup');
    if (popup) {
        const isVisible = popup.style.display === 'flex';
        popup.style.display = isVisible ? 'none' : 'flex';
    }
}

// 범례 표시 업데이트 함수
function updateOverlayMarkers() {
    // 체크박스 상태 확인
    const showFoundation = document.getElementById('chkShowFoundation')?.checked || false;
    const showSoftGround = document.getElementById('chkShowSoftGround')?.checked || false;
    const showSpecialLayer = document.getElementById('chkShowSpecialLayer')?.checked || false;

    // 구름 영역 설정 업데이트 (체크박스와 연동)
    cloudAreaSettings.foundation = showFoundation;
    cloudAreaSettings.softGround = showSoftGround;
    cloudAreaSettings.specialLayer = showSpecialLayer;

    // 하나라도 선택되면 구름 영역 활성화
    showCloudAreas = showFoundation || showSoftGround || showSpecialLayer;

    // 범례 박스 표시/숨김
    const legendBox = document.getElementById('overlayLegendBox');
    const anySelected = showFoundation || showSoftGround || showSpecialLayer;
    if (legendBox) legendBox.style.display = anySelected ? 'block' : 'none';

    // 범례 섹션 표시/숨김
    const legendFoundation = document.getElementById('legendFoundation');
    const legendSoftGround = document.getElementById('legendSoftGround');
    const legendSpecialLayer = document.getElementById('legendSpecialLayer');
    const legendMultiRing = document.getElementById('legendMultiRing');

    if (legendFoundation) legendFoundation.style.display = showFoundation ? 'block' : 'none';
    if (legendSoftGround) legendSoftGround.style.display = showSoftGround ? 'block' : 'none';
    if (legendSpecialLayer) legendSpecialLayer.style.display = showSpecialLayer ? 'block' : 'none';

    // 다중 선택 시 동심원 설명 표시
    const multiSelected = [showFoundation, showSoftGround, showSpecialLayer].filter(v => v).length;
    if (legendMultiRing) legendMultiRing.style.display = multiSelected >= 2 ? 'block' : 'none';

    // 캔버스 다시 그리기
    updateOverlayCanvas();
}

// 구름 영역 그리기 - 판정 유형별 분리
function drawCloudAreas(ctx, transformMatrix) {
    if (!transformMatrix || !boreholeData || boreholeData.length === 0) return;

    const foundationResults = window.simpleFoundationResults || [];
    const { a, b, c, d, e, f } = transformMatrix;

    // 모든 시추공의 좌표 수집
    const boreholeCoords = boreholeData
        .filter(bh => bh.x && bh.y)
        .map(bh => ({ bh, x: parseFloat(bh.x), y: parseFloat(bh.y) }));

    if (boreholeCoords.length < 2) return;

    // 최근접 시추공 간 거리 계산 (평균)
    let totalDist = 0;
    let distCount = 0;
    for (let i = 0; i < boreholeCoords.length; i++) {
        let minDist = Infinity;
        for (let j = 0; j < boreholeCoords.length; j++) {
            if (i !== j) {
                const dx = boreholeCoords[i].x - boreholeCoords[j].x;
                const dy = boreholeCoords[i].y - boreholeCoords[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) minDist = dist;
            }
        }
        if (minDist < Infinity) {
            totalDist += minDist;
            distCount++;
        }
    }
    const avgMinDist = distCount > 0 ? totalDist / distCount : 50; // 기본값 50m
    const cloudSizeMultiplier = window.cloudSizeMultiplier || 1.0;
    const cloudRadius = avgMinDist * 0.6 * cloudSizeMultiplier; // 최근접 거리의 60%를 반경으로 사용 (크기 조절 적용)

    // 픽셀 스케일 계산
    const scaleX = Math.sqrt(a * a + d * d);
    const scaleY = Math.sqrt(b * b + e * e);
    const avgScale = (scaleX + scaleY) / 2;
    const pixelRadius = cloudRadius * avgScale;

    // 레이어별로 구름 영역 그리기 (아래에서 위로: 직접기초 → 연약지반 → 전석/붕적/이암)

    // 1. 직접 기초 판정 구름 영역 (가장 아래 레이어)
    if (cloudAreaSettings.foundation) {
        boreholeCoords.forEach(({ bh }) => {
            const info = getFoundationJudgmentInfo(bh, foundationResults);
            if (!info.shouldShow) return;

            const u = a * bh.x + b * bh.y + c;
            const v = d * bh.x + e * bh.y + f;

            // 직접 기초 판정별 색상
            let cloudColor = 'rgba(158, 158, 158, 0.12)'; // 미판단 - 회색
            switch (info.judgmentType) {
                case 'direct':
                    cloudColor = 'rgba(46, 125, 50, 0.18)'; // 초록색
                    break;
                case 'replacement':
                    cloudColor = 'rgba(245, 124, 0, 0.18)'; // 주황색
                    break;
                case 'pile':
                    cloudColor = 'rgba(198, 40, 40, 0.18)'; // 빨간색
                    break;
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(u, v, pixelRadius, 0, 2 * Math.PI);
            ctx.fillStyle = cloudColor;
            ctx.fill();
            ctx.restore();
        });
    }

    // 2. 연약지반 구름 영역 (중간 레이어)
    if (cloudAreaSettings.softGround) {
        boreholeCoords.forEach(({ bh }) => {
            const softGroundInfo = getSoftGroundInfo(bh);
            if (!softGroundInfo.hasSoftGround) return;

            const u = a * bh.x + b * bh.y + c;
            const v = d * bh.x + e * bh.y + f;

            // 연약지반은 빨간색 구름으로 표시
            ctx.save();
            ctx.beginPath();
            ctx.arc(u, v, pixelRadius * 0.85, 0, 2 * Math.PI); // 약간 작게
            ctx.fillStyle = 'rgba(229, 57, 53, 0.25)'; // 빨간색
            ctx.fill();
            // 테두리 추가 (강조)
            ctx.strokeStyle = 'rgba(229, 57, 53, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        });
    }

    // 3. 전석/붕적/이암 구름 영역 (가장 위 레이어)
    if (cloudAreaSettings.specialLayer) {
        boreholeCoords.forEach(({ bh }) => {
            const specialLayerInfo = getSpecialLayerInfo(bh);
            if (!specialLayerInfo.hasSpecialLayer) return;

            const u = a * bh.x + b * bh.y + c;
            const v = d * bh.x + e * bh.y + f;

            // 전석/호박돌 또는 붕적/이암층 구분
            if (specialLayerInfo.hasBoulder) {
                // 전석/호박돌 - 주황색 (더 진하게)
                ctx.save();
                ctx.beginPath();
                ctx.arc(u, v, pixelRadius * 0.7, 0, 2 * Math.PI); // 더 작게
                ctx.fillStyle = 'rgba(255, 152, 0, 0.3)'; // 주황색
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            if (specialLayerInfo.hasColluvium) {
                // 붕적/이암층 - 갈색
                ctx.save();
                ctx.beginPath();
                ctx.arc(u, v, pixelRadius * 0.55, 0, 2 * Math.PI); // 가장 작게
                ctx.fillStyle = 'rgba(109, 76, 65, 0.3)'; // 갈색
                ctx.fill();
                ctx.strokeStyle = 'rgba(109, 76, 65, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        });
    }
}

function updateOverlayCanvas() {
    const overlayCanvas = document.getElementById('overlayCanvas');
    const pdfCanvas = document.getElementById('pdfCanvas');
    if (!overlayCanvas || !pdfCanvas || pdfCanvas.width === 0) return;

    overlayCanvas.width = pdfCanvas.width;
    overlayCanvas.height = pdfCanvas.height;

    // ✅ z-index 및 표시 강제 설정
    overlayCanvas.style.zIndex = '10';
    overlayCanvas.style.display = 'block';
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const foundationResults = window.simpleFoundationResults || [];

    // 구름 영역 먼저 그리기 (배경)
    if (showCloudAreas && transformMatrix) {
        drawCloudAreas(ctx, transformMatrix);
    }

    // Draw calibration points (동심원 마커로)
    if (calibrationPoints && calibrationPoints.length > 0) {
        console.log('🎯 시추공 마커 그리기 - calibrationPoints 좌표:',
            calibrationPoints.map(p => `${p.hole_no}:(${p.pixelX?.toFixed(0)}, ${p.pixelY?.toFixed(0)})`).join(', '));
        calibrationPoints.forEach(p => {
            const bh = boreholeData.find(b => b.holeNo === p.hole_no);
            if (bh) {
                const info = getFoundationJudgmentInfo(bh, foundationResults);
                drawMarkerOnCanvas(ctx, p.pixelX, p.pixelY, p.hole_no, info.markerColor, bh);
            } else {
                // 시추공 데이터를 찾을 수 없는 경우 기본 색상
                drawMarkerOnCanvas(ctx, p.pixelX, p.pixelY, p.hole_no, '#9E9E9E', null);
            }
        });
    }

    // Draw all other boreholes if transform matrix exists
    if (transformMatrix && boreholeData && boreholeData.length > 0) {
        const { a, b, c, d, e, f } = transformMatrix;

        boreholeData.forEach(bh => {
            if (!bh.x || !bh.y) return;
            const isCalib = calibrationPoints.some(p => p.hole_no === bh.holeNo);
            if (!isCalib) {
                const info = getFoundationJudgmentInfo(bh, foundationResults);
                const u = a * bh.x + b * bh.y + c;
                const v = d * bh.x + e * bh.y + f;
                drawMarkerOnCanvas(ctx, u, v, bh.holeNo, info.markerColor, bh);
            }
        });
    }

    // 마커 옵션 버튼 표시/숨김 (캘리브레이션 완료 시 표시)
    const markerOptionsBtn = document.getElementById('markerOptionsBtn');
    if (markerOptionsBtn) {
        markerOptionsBtn.style.display = transformMatrix ? 'block' : 'none';
    }
    
    // ✅ 등고선 오버레이: 개별 체크박스로 레이어별 on/off 제어
    // 체크박스 중 하나라도 체크되어 있으면 등고선 표시
    const chkGround = document.getElementById('chkContourGround');
    const chkWater = document.getElementById('chkContourWater');
    const chkWeathered = document.getElementById('chkContourWeathered');
    const chkBedrock = document.getElementById('chkContourBedrock');
    const anyContourEnabled = chkGround?.checked || chkWater?.checked || chkWeathered?.checked || chkBedrock?.checked;

    if (anyContourEnabled) {
        updateContourOverlayOnDrawing(true, ctx);
    }

    // 다중 시추공 선택 시 연결선 및 선택 표시 (수동 배치 모드에서도 작동)
    if (drawingMultiBoreholeMode && drawingSelectedBoreholes.length > 0) {
        if (transformMatrix || manualPlacements.length > 0 || calibrationPoints.length > 0) {
            drawSelectedBoreholeConnections(ctx);
        }
    }

    // 수동 배치 모드: 기준점 및 수동 배치 시추공 표시
    if (placementMode === 'manual') {
        drawManualPlacementOverlay(ctx);
    }
}

// 수동 배치 오버레이 그리기
function drawManualPlacementOverlay(ctx) {
    ctx.save();

    // 기준점 그리기
    referencePoints.forEach((rp, idx) => {
        if (!rp) return;

        // 기준점 마커 (십자 표시)
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rp.pixelX - 15, rp.pixelY);
        ctx.lineTo(rp.pixelX + 15, rp.pixelY);
        ctx.moveTo(rp.pixelX, rp.pixelY - 15);
        ctx.lineTo(rp.pixelX, rp.pixelY + 15);
        ctx.stroke();

        // 원 테두리
        ctx.beginPath();
        ctx.arc(rp.pixelX, rp.pixelY, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#FF9800';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`기준점 ${idx + 1}`, rp.pixelX, rp.pixelY - 20);

        if (rp.geoX !== null) {
            ctx.font = '9px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText(`(${rp.geoX.toFixed(1)}, ${rp.geoY.toFixed(1)})`, rp.pixelX, rp.pixelY + 28);
        }
    });

    // 수동 배치된 시추공 그리기
    manualPlacements.forEach((mp, idx) => {
        // 다중 선택 모드에서 선택된 시추공인지 확인
        const isSelected = drawingMultiBoreholeMode && drawingSelectedBoreholes.includes(mp.holeNo);
        const selectionIndex = drawingSelectedBoreholes.indexOf(mp.holeNo);

        // 마커 색상: 선택된 경우 빨간색, 신규는 주황색, 기존은 녹색
        let markerColor = mp.isNew ? '#FF5722' : '#4CAF50';
        if (isSelected) {
            markerColor = '#D32F2F';
        }

        // 선택된 경우 더 큰 마커
        const radius = isSelected ? 16 : 12;

        // 외곽 원
        ctx.beginPath();
        ctx.arc(mp.pixelX, mp.pixelY, radius, 0, Math.PI * 2);
        ctx.fillStyle = markerColor;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // 선택된 경우 순서 번호 표시, 아니면 내부 마커
        if (isSelected) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((selectionIndex + 1).toString(), mp.pixelX, mp.pixelY);
        } else {
            ctx.beginPath();
            ctx.arc(mp.pixelX, mp.pixelY, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }

        // 라벨
        ctx.fillStyle = markerColor;
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(mp.holeNo, mp.pixelX, mp.pixelY - (isSelected ? 22 : 18));

        // 좌표 표시
        if (manualTransformMatrix) {
            ctx.font = '9px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText(`(${mp.geoX.toFixed(1)}, ${mp.geoY.toFixed(1)})`, mp.pixelX, mp.pixelY + (isSelected ? 26 : 22));
        }
    });

    // 기준점 선택 대기중 표시
    if (selectingRefPoint > 0) {
        ctx.fillStyle = 'rgba(255, 152, 0, 0.1)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = '#FF9800';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`기준점 ${selectingRefPoint} 위치를 클릭하세요`, ctx.canvas.width / 2, 30);
    }

    ctx.restore();
}

// 도면 위 선택된 시추공 연결선 그리기
function drawSelectedBoreholeConnections(ctx) {
    const selectedPoints = drawingSelectedBoreholes.map(holeNo => {
        // 먼저 수동 배치된 시추공에서 찾기
        const manualPoint = manualPlacements.find(mp => mp.holeNo === holeNo);
        if (manualPoint) {
            return { holeNo, u: manualPoint.pixelX, v: manualPoint.pixelY };
        }

        // transformMatrix가 있으면 변환하여 찾기
        if (transformMatrix) {
            const bh = boreholeData.find(b => b.holeNo === holeNo);
            if (bh && bh.x && bh.y) {
                const pixel = transformGeoToPixel(bh.x, bh.y);
                return { holeNo, u: pixel.u, v: pixel.v };
            }
        }

        // 캘리브레이션 포인트에서 찾기
        const calibPoint = calibrationPoints.find(cp => cp.hole_no === holeNo);
        if (calibPoint) {
            return { holeNo, u: calibPoint.pixelX, v: calibPoint.pixelY };
        }

        return null;
    }).filter(p => p !== null);

    if (selectedPoints.length === 0) return;

    ctx.save();

    // 연결선 그리기
    if (selectedPoints.length >= 2) {
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(selectedPoints[0].u, selectedPoints[0].v);
        for (let i = 1; i < selectedPoints.length; i++) {
            ctx.lineTo(selectedPoints[i].u, selectedPoints[i].v);
        }
        ctx.stroke();
    }

    // 선택된 시추공 강조 마커
    selectedPoints.forEach((pt, idx) => {
        // 외곽 원 (녹색)
        ctx.fillStyle = '#4CAF50';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pt.u, pt.v, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // 번호 표시
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((idx + 1).toString(), pt.u, pt.v);

        // 시추공 이름 표시
        ctx.fillStyle = '#D32F2F';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(pt.holeNo, pt.u, pt.v - 20);
    });

    ctx.restore();
}

// Draw marker on canvas (동심원 링 방식)
function drawMarkerOnCanvas(ctx, x, y, text, color, bh = null) {
    ctx.save();

    // 체크박스 상태 확인
    const showFoundation = document.getElementById('chkShowFoundation')?.checked ?? true;
    const showSoftGround = document.getElementById('chkShowSoftGround')?.checked ?? false;
    const showSpecialLayer = document.getElementById('chkShowSpecialLayer')?.checked ?? false;

    const selectedCount = [showFoundation, showSoftGround, showSpecialLayer].filter(v => v).length;

    // 아무것도 선택되지 않으면 기본 마커만 표시
    if (selectedCount === 0) {
        ctx.strokeStyle = '#9E9E9E';
        ctx.fillStyle = '#9E9E9E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y + 12);
        ctx.restore();
        return;
    }

    // 판정 정보 가져오기
    const foundationResults = window.simpleFoundationResults || [];
    const foundationInfo = bh ? getFoundationJudgmentInfo(bh, foundationResults) : { markerColor: color };
    const softGroundInfo = bh ? getSoftGroundInfo(bh) : { hasSoftGround: false };
    const specialLayerInfo = bh ? getSpecialLayerInfo(bh) : { hasSpecialLayer: false };

    // 마커 크기 설정
    const outerRadius = 14;   // 외곽 링 (직접 기초)
    const middleRadius = 10;  // 중간 링 (연약지반)
    const innerRadius = 6;    // 내부 원 (전석/붕적/이암)

    // 단일 선택 시 - 단순 원형 마커
    if (selectedCount === 1) {
        let markerColor = '#9E9E9E';

        if (showFoundation) {
            markerColor = foundationInfo.markerColor;
        } else if (showSoftGround) {
            markerColor = softGroundInfo.hasSoftGround ? '#E53935' : '#4CAF50';
        } else if (showSpecialLayer) {
            markerColor = specialLayerInfo.hasSpecialLayer ? '#6D4C41' : '#4CAF50';
        }

        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = markerColor;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    // 다중 선택 시 - 동심원 링 방식
    else {
        // 1. 외곽 링: 직접 기초 판정 (가장 바깥)
        if (showFoundation) {
            ctx.beginPath();
            ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
            ctx.fillStyle = foundationInfo.markerColor;
            ctx.fill();
        }

        // 2. 중간 링: 연약지반
        if (showSoftGround) {
            const middleColor = softGroundInfo.hasSoftGround ? '#E53935' : (showFoundation ? 'rgba(255,255,255,0.8)' : '#4CAF50');
            ctx.beginPath();
            ctx.arc(x, y, middleRadius, 0, 2 * Math.PI);
            ctx.fillStyle = middleColor;
            ctx.fill();

            // 연약지반 없으면 테두리만
            if (!softGroundInfo.hasSoftGround && showFoundation) {
                ctx.strokeStyle = '#E0E0E0';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // 3. 내부 원: 전석/붕적/이암 (가장 안쪽)
        if (showSpecialLayer) {
            const innerColor = specialLayerInfo.hasSpecialLayer ? '#6D4C41' : (showSoftGround || showFoundation ? 'rgba(255,255,255,0.9)' : '#4CAF50');
            ctx.beginPath();
            ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
            ctx.fillStyle = innerColor;
            ctx.fill();

            // 특수지층 없으면 테두리만
            if (!specialLayerInfo.hasSpecialLayer && (showSoftGround || showFoundation)) {
                ctx.strokeStyle = '#BDBDBD';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // 외곽 테두리
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 시추공 번호 텍스트
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y + (selectedCount > 1 ? 18 : 14));

    ctx.restore();
}

// Handle canvas click for calibration
function handleCanvasClick(event) {
    // Prevent click if it was a drag or just finished dragging
    if (isDragging) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 드래그 직후 200ms 이내 클릭 무시
    if (Date.now() - lastDragEndTime < 200) {
        return;
    }
    
    const container = document.querySelector('#overlayMain');
    const wrapper = document.getElementById('canvasWrapper');
    const canvas = document.getElementById('pdfCanvas');

    if (!container || !wrapper || !canvas) return;

    // 방법: wrapper의 실제 화면 위치를 기준으로 계산
    const wrapperRect = wrapper.getBoundingClientRect();

    // 클릭 위치를 wrapper 기준으로 계산
    const clickXInWrapper = event.clientX - wrapperRect.left;
    const clickYInWrapper = event.clientY - wrapperRect.top;

    // wrapper의 스케일된 크기에서 캔버스의 원본 좌표로 변환
    // wrapperRect는 이미 scale이 적용된 크기이므로, 비율로 계산
    const scaleApplied = overlayTransform.k;

    // 회전이 적용된 경우를 고려
    const rotateRad = -(overlayTransform.rotate || 0) * Math.PI / 180;
    const cos = Math.cos(rotateRad);
    const sin = Math.sin(rotateRad);

    // wrapper 중심 기준으로 좌표 변환
    const wrapperCenterX = wrapperRect.width / 2;
    const wrapperCenterY = wrapperRect.height / 2;

    // 클릭 위치를 wrapper 중심 기준으로 변환
    const relX = clickXInWrapper - wrapperCenterX;
    const relY = clickYInWrapper - wrapperCenterY;

    // 역회전 적용
    const unrotatedX = relX * cos - relY * sin;
    const unrotatedY = relX * sin + relY * cos;

    // 역스케일 적용하여 캔버스 좌표로 변환
    const canvasX = canvas.width / 2 + unrotatedX / scaleApplied;
    const canvasY = canvas.height / 2 + unrotatedY / scaleApplied;
    
    // Check if clicked on an existing borehole marker
    // Bounds check
    if (canvasX < 0 || canvasX > canvas.width || canvasY < 0 || canvasY > canvas.height) return;

    // 수동 배치 모드 처리
    if (placementMode === 'manual') {
        // 기준점 선택 모드인 경우
        if (selectingRefPoint > 0) {
            handleReferencePointClick(canvasX, canvasY);
            return;
        }

        // 기존 수동 배치된 시추공 클릭 확인
        const clickedManual = manualPlacements.find(mp => {
            const dist = Math.sqrt(Math.pow(canvasX - mp.pixelX, 2) + Math.pow(canvasY - mp.pixelY, 2));
            return dist < 20;
        });

        if (clickedManual) {
            // 클릭된 시추공 선택 또는 삭제 옵션
            if (drawingMultiBoreholeMode) {
                selectDrawingBorehole(clickedManual.holeNo);
            } else {
                showBoreholeLog(clickedManual.holeNo);
            }
            return;
        }

        // 새 시추공 배치
        handleManualPlacement(canvasX, canvasY);
        return;
    }

    // 좌표 매칭 모드 (기존 캘리브레이션)
    if (transformMatrix) {
        const clickedBorehole = boreholeData.find(bh => {
            if (!bh.x || !bh.y) return false;
            const pixel = transformGeoToPixel(bh.x, bh.y);
            const dist = Math.sqrt(Math.pow(canvasX - pixel.u, 2) + Math.pow(canvasY - pixel.v, 2));
            return dist < 20; // Hit radius
        });

        if (clickedBorehole) {
            // 다중 시추공 분석 모드인 경우 선택/해제
            if (drawingMultiBoreholeMode) {
                selectDrawingBorehole(clickedBorehole.holeNo);
            } else {
                // Show borehole log when clicking on existing marker
                if (clickedBorehole.holeNo && typeof showBoreholeLog === 'function') {
                    showBoreholeLog(clickedBorehole.holeNo);
                }
            }
            return;
        }
    }

    const selector = document.getElementById('boreholeSelector');
    if (!selector) return;

    const selectedId = selector.value;
    if (!selectedId) {
        return;
    }

    // Check if already calibrated
    if (calibrationPoints.some(p => p.hole_no === selectedId)) {
        return;
    }

    // Find borehole data
    const borehole = boreholeData.find(b => b.holeNo === selectedId);
    if (!borehole || !borehole.x || !borehole.y) {
        alert('선택한 시추공에 좌표 정보가 없습니다. 수동 배치 모드를 사용해주세요.');
        return;
    }

    addCalibrationPoint({
        hole_no: selectedId,
        pixelX: canvasX,
        pixelY: canvasY,
        geoX: borehole.x,
        geoY: borehole.y
    });

    updateOverlayCanvas();
}

// Add calibration point
function addCalibrationPoint(point) {
    calibrationPoints.push(point);
    updateCalibrationList();
}

// Update calibration list UI
function updateCalibrationList() {
    const list = document.getElementById('calibrationList');
    const btnCalibrate = document.getElementById('btnCalibrate');
    const countSpan = document.getElementById('calibCount');
    
    if (!list) return;
    
    list.innerHTML = '';
    
    if (countSpan) {
        countSpan.textContent = calibrationPoints.length;
    }
    
    calibrationPoints.forEach((p, i) => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 4px 6px; margin-bottom: 3px; background: #e8f5e9; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;';
        li.innerHTML = `
            <span style="font-size: 10px; color: #555;"><strong>${p.hole_no}</strong></span>
            <button onclick="removeCalibrationPoint(${i})" style="border: none; background: none; color: red; cursor: pointer; font-size: 14px; padding: 0; width: 16px; height: 16px; line-height: 14px;">×</button>
        `;
        list.appendChild(li);
    });
    
    if (btnCalibrate) {
        if (calibrationPoints.length >= 3) {
            btnCalibrate.disabled = false;
            btnCalibrate.style.opacity = 1;
        } else {
            btnCalibrate.disabled = true;
            btnCalibrate.style.opacity = 0.6;
        }
    }
}

// Remove calibration point
function removeCalibrationPoint(index) {
    calibrationPoints.splice(index, 1);
    updateCalibrationList();
    updateOverlayCanvas();
}

// Reset calibration
function resetCalibration() {
    calibrationPoints = [];
    transformMatrix = null;
    updateCalibrationList();
    updateOverlayCanvas();
}

// Apply calibration (calculate transform matrix)
function applyCalibration() {
    if (calibrationPoints.length < 3) return;

    // Compute Affine Transform: Geo (x,y) -> Pixel (u,v)
    const p1 = calibrationPoints[0];
    const p2 = calibrationPoints[1];
    const p3 = calibrationPoints[2];

    const A = [
        [p1.geoX, p1.geoY, 1],
        [p2.geoX, p2.geoY, 1],
        [p3.geoX, p3.geoY, 1]
    ];

    const detA = A[0][0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1]) -
                 A[0][1]*(A[1][0]*A[2][2] - A[1][2]*A[2][0]) +
                 A[0][2]*(A[1][0]*A[2][1] - A[1][1]*A[2][0]);

    if (Math.abs(detA) < 1e-10) {
        alert('캘리브레이션 포인트가 일직선상에 있습니다. 다른 위치의 시추공을 선택해주세요.');
        return;
    }

    const invDet = 1 / detA;
    const invA = [
        [
            (A[1][1]*A[2][2] - A[1][2]*A[2][1]) * invDet,
            (A[0][2]*A[2][1] - A[0][1]*A[2][2]) * invDet,
            (A[0][1]*A[1][2] - A[0][2]*A[1][1]) * invDet
        ],
        [
            (A[1][2]*A[2][0] - A[1][0]*A[2][2]) * invDet,
            (A[0][0]*A[2][2] - A[0][2]*A[2][0]) * invDet,
            (A[0][2]*A[1][0] - A[0][0]*A[1][2]) * invDet
        ],
        [
            (A[1][0]*A[2][1] - A[1][1]*A[2][0]) * invDet,
            (A[0][1]*A[2][0] - A[0][0]*A[2][1]) * invDet,
            (A[0][0]*A[1][1] - A[0][1]*A[1][0]) * invDet
        ]
    ];

    const u_vec = [p1.pixelX, p2.pixelX, p3.pixelX];
    const v_vec = [p1.pixelY, p2.pixelY, p3.pixelY];

    const coeffs_u = multiplyMatrixVector(invA, u_vec);
    const coeffs_v = multiplyMatrixVector(invA, v_vec);

    transformMatrix = {
        a: coeffs_u[0], b: coeffs_u[1], c: coeffs_u[2],
        d: coeffs_v[0], e: coeffs_v[1], f: coeffs_v[2]
    };

    // DrawingCoordinateMapper에도 캘리브레이션 포인트 적용
    if (typeof window.drawingCoordinateMapper !== 'undefined') {
        window.drawingCoordinateMapper.clearCalibrationPoints();
        calibrationPoints.forEach(pt => {
            window.drawingCoordinateMapper.addCalibrationPoint(
                pt.pixelX, pt.pixelY, pt.geoX, pt.geoY, pt.hole_no
            );
        });
        console.log('DrawingCoordinateMapper calibration applied');
        console.log('Pixel to meter scale:', window.drawingCoordinateMapper.pixelToMeterScale);
    }

    updateOverlayCanvas();

    // 굴착면 레벨 편집 섹션 표시
    showExcavationLevelEditSection();

    // 다중 시추공 선택 섹션 표시
    const crossSectionControls = document.getElementById('drawingCrossSectionControls');
    if (crossSectionControls) {
        crossSectionControls.style.display = 'block';
    }

    // 다중 분석 버튼 활성화
    const enableMultiModeBtn = document.getElementById('enableMultiModeBtn');
    if (enableMultiModeBtn) {
        enableMultiModeBtn.style.display = 'block';
    }

    // 마커 옵션 버튼 숨기기 (좌측 패널로 이동했으므로)
    const markerOptionsBtn = document.getElementById('markerOptionsBtn');
    if (markerOptionsBtn) {
        markerOptionsBtn.style.display = 'none';
    }

    // 구름 영역 자동 표시 (직접 기초 판정 기준)
    showCloudAreas = true;
    cloudAreaSettings.foundation = true;
    const chkShowCloud = document.getElementById('chkShowCloud');
    if (chkShowCloud) chkShowCloud.checked = true;
    const chkCloudFoundation = document.getElementById('chkCloudFoundation');
    if (chkCloudFoundation) chkCloudFoundation.checked = true;

    // 캔버스 업데이트하여 구름 영역 표시
    updateOverlayCanvas();

    console.log('[Calibration] Cloud areas auto-enabled for foundation assessment');
}

// Show excavation level edit section after calibration
function showExcavationLevelEditSection() {
    const section = document.getElementById('excavationLevelEditSection');
    const listDiv = document.getElementById('excavationLevelEditList');
    
    if (!section || !listDiv || !boreholeData || boreholeData.length === 0) return;
    
    // Show section
    section.style.display = 'block';
    
    // Generate edit list for all boreholes
    let html = '';
    boreholeData.forEach((borehole, index) => {
        const holeNo = borehole.holeNo || `BH-${index + 1}`;
        const currentLevel = parseFloat(borehole.excavationLevelInput) || 0;
        const groundElevation = parseFloat(borehole.groundElevation) || 0;
        
        html += `
            <div style="padding: 10px; margin-bottom: 10px; background: #F5F5F5; border-radius: 4px; border: 1px solid #E0E0E0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #455A64; font-size: 13px;">${holeNo}</strong>
                    <span style="font-size: 11px; color: #666;">지표고: ${groundElevation.toFixed(2)}m</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label style="font-size: 12px; min-width: 80px;">굴착면 레벨 (E.L.):</label>
                    <input type="number"
                           id="excavationLevel_${index}"
                           value="${currentLevel.toFixed(2)}"
                           step="0.1"
                           class="input-field"
                           style="flex: 1; padding: 6px; font-size: 12px;"
                           oninput="validateExcavationLevel(${index}, this.value)">
                    <span style="font-size: 11px; color: #666;">m</span>
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 5px;">
                    굴착 깊이: <span id="excavationDepth_${index}">${(groundElevation - currentLevel).toFixed(2)}</span>m
                    <span id="excavationStatus_${index}" style="margin-left: 10px; color: #4CAF50;"></span>
                </div>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

// Step 6 굴착면 레벨 편집 UI 갱신 (Step 2에서 변경 시 호출됨)
function refreshExcavationLevelEditUI() {
    if (!boreholeData || boreholeData.length === 0) return;

    // 각 시추공의 입력 필드 값 업데이트 (전체 재렌더링 없이)
    boreholeData.forEach((borehole, index) => {
        const inputField = document.getElementById(`excavationLevel_${index}`);
        const depthSpan = document.getElementById(`excavationDepth_${index}`);

        if (inputField) {
            const currentValue = parseFloat(borehole.excavationLevelInput) || 0;
            const inputValue = parseFloat(inputField.value) || 0;

            // 값이 다른 경우에만 업데이트 (사용자 입력 중 방해 방지)
            if (Math.abs(currentValue - inputValue) > 0.001) {
                inputField.value = currentValue.toFixed(2);

                // 깊이 표시도 업데이트
                if (depthSpan) {
                    const groundElevation = parseFloat(borehole.groundElevation) || 0;
                    const depth = groundElevation - currentValue;
                    depthSpan.textContent = depth.toFixed(2);
                    depthSpan.style.color = depth < 0 ? '#F44336' : (depth > 50 ? '#FF9800' : '#666');
                }
            }
        }
    });
}

// Validate excavation level input and sync to other modules (실시간 연동)
function validateExcavationLevel(index, value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const borehole = boreholeData[index];
    const groundElevation = parseFloat(borehole.groundElevation) || 0;

    // Update depth display
    const depthSpan = document.getElementById(`excavationDepth_${index}`);
    const statusSpan = document.getElementById(`excavationStatus_${index}`);

    if (depthSpan) {
        const depth = groundElevation - numValue;
        depthSpan.textContent = depth.toFixed(2);

        // Warning if depth is negative or too large
        if (depth < 0) {
            depthSpan.style.color = '#F44336';
            depthSpan.textContent += ' (경고: 지표고보다 높음)';
        } else if (depth > 50) {
            depthSpan.style.color = '#FF9800';
            depthSpan.textContent += ' (주의: 굴착 깊이가 매우 깊음)';
        } else {
            depthSpan.style.color = '#666';
        }
    }

    // ★ 핵심: boreholeData 업데이트 및 다른 모듈과 동기화 (디바운스 적용됨)
    const oldValue = parseFloat(borehole.excavationLevelInput) || 0;
    if (Math.abs(numValue - oldValue) > 0.001) {
        // 상태 표시
        if (statusSpan) {
            statusSpan.textContent = '저장 중...';
            statusSpan.style.color = '#FF9800';
        }

        // updateLevel 함수를 통해 boreholeData 업데이트 및 다른 Step들 재실행
        if (typeof updateLevel === 'function') {
            updateLevel(index, 'excavationLevelInput', numValue);

            // 저장 완료 표시 (디바운스 후)
            setTimeout(() => {
                if (statusSpan) {
                    statusSpan.textContent = '✓ 저장됨';
                    statusSpan.style.color = '#4CAF50';
                    setTimeout(() => { statusSpan.textContent = ''; }, 1500);
                }
            }, 350);
        } else {
            // updateLevel이 없으면 직접 업데이트
            boreholeData[index].excavationLevelInput = numValue.toFixed(2);
            if (statusSpan) {
                statusSpan.textContent = '✓ 저장됨';
                statusSpan.style.color = '#4CAF50';
                setTimeout(() => { statusSpan.textContent = ''; }, 1500);
            }
        }
    }
}

// Apply bulk excavation level to all boreholes (자동 저장)
function applyBulkExcavationLevel() {
    const input = document.getElementById('bulkExcavationLevel');
    if (!input || !input.value || input.value.trim() === '') {
        alert('굴착면 레벨을 입력해주세요.');
        input.focus();
        return;
    }

    const bulkLevel = parseFloat(input.value);
    if (isNaN(bulkLevel)) {
        alert('올바른 숫자를 입력해주세요.');
        input.focus();
        return;
    }

    if (!boreholeData || boreholeData.length === 0) {
        alert('시추공 데이터가 없습니다.');
        return;
    }

    let updatedCount = 0;

    // Update all input fields and save immediately
    boreholeData.forEach((borehole, index) => {
        const inputField = document.getElementById(`excavationLevel_${index}`);
        if (inputField) {
            const oldValue = parseFloat(borehole.excavationLevelInput) || 0;
            inputField.value = bulkLevel.toFixed(2);

            // 값이 변경된 경우에만 업데이트
            if (Math.abs(bulkLevel - oldValue) > 0.001) {
                // updateLevel을 통해 boreholeData 업데이트 및 모든 모듈 동기화
                if (typeof updateLevel === 'function') {
                    updateLevel(index, 'excavationLevelInput', bulkLevel);
                } else {
                    boreholeData[index].excavationLevelInput = bulkLevel.toFixed(2);
                }
                updatedCount++;
            }

            // 화면 표시 업데이트
            const depthSpan = document.getElementById(`excavationDepth_${index}`);
            if (depthSpan) {
                const groundElevation = parseFloat(borehole.groundElevation) || 0;
                depthSpan.textContent = (groundElevation - bulkLevel).toFixed(2);
                depthSpan.style.color = '#666';
            }
        }
    });

    if (updatedCount === 0) {
        alert('변경된 시추공이 없습니다. (이미 동일한 값입니다)');
    } else {
        alert(`✓ 모든 시추공(${updatedCount}개)의 굴착면 레벨이 ${bulkLevel.toFixed(2)}m로 설정 및 저장되었습니다.\n\n모든 모듈이 자동으로 업데이트되었습니다.`);
    }
}

// Apply bedrock level to all boreholes (자동 저장)
function applyBedrockLevelToAll() {
    if (!boreholeData || boreholeData.length === 0) {
        alert('시추공 데이터가 없습니다.');
        return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    // Update all input fields with bedrock level
    boreholeData.forEach((borehole, index) => {
        // Find bedrock level
        let bedrockLevel = null;

        // Try to get from bedrockTopElevation
        if (borehole.bedrockTopElevation && borehole.bedrockTopElevation !== '-' && borehole.bedrockTopElevation !== 'N/A') {
            bedrockLevel = parseFloat(borehole.bedrockTopElevation);
        } else {
            // Try to find from soil data
            if (borehole.soilData && borehole.soilData.length > 0) {
                for (let layer of borehole.soilData) {
                    const soilName = layer.soil_name || '';
                    if (isBedrockLayer(soilName)) {
                        const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
                        if (depthMatch) {
                            const depthStart = parseFloat(depthMatch[1]);
                            const groundElevation = parseFloat(borehole.groundElevation) || 0;
                            bedrockLevel = groundElevation - depthStart;
                            break;
                        }
                    }
                }
            }
        }

        if (bedrockLevel !== null && !isNaN(bedrockLevel)) {
            const inputField = document.getElementById(`excavationLevel_${index}`);
            if (inputField) {
                const oldValue = parseFloat(borehole.excavationLevelInput) || 0;
                inputField.value = bedrockLevel.toFixed(2);

                // updateLevel을 통해 자동 저장 및 모든 모듈 동기화
                if (typeof updateLevel === 'function') {
                    updateLevel(index, 'excavationLevelInput', bedrockLevel);
                } else {
                    boreholeData[index].excavationLevelInput = bedrockLevel.toFixed(2);
                }

                // 화면 표시 업데이트
                const depthSpan = document.getElementById(`excavationDepth_${index}`);
                if (depthSpan) {
                    const groundElevation = parseFloat(borehole.groundElevation) || 0;
                    depthSpan.textContent = (groundElevation - bedrockLevel).toFixed(2);
                    depthSpan.style.color = '#666';
                }
                updatedCount++;
            }
        } else {
            skippedCount++;
        }
    });

    if (updatedCount === 0) {
        alert('기반암 레벨을 찾을 수 있는 시추공이 없습니다.');
    } else {
        let message = `✓ ${updatedCount}개 시추공의 굴착면 레벨이 기반암 레벨로 설정 및 저장되었습니다.`;
        if (skippedCount > 0) {
            message += `\n(${skippedCount}개 시추공은 기반암 레벨을 찾을 수 없어 건너뛰었습니다.)`;
        }
        message += '\n\n모든 모듈이 자동으로 업데이트되었습니다.';
        alert(message);
    }
}

// Show drawing upload help modal
function showDrawingUploadHelp() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    modalTitle.textContent = '현장 도면 업로드 사용법';
    modalBody.innerHTML = `
        <div style="padding: 20px;">
            <h3 style="color: #455A64; margin-bottom: 15px;">사용 방법</h3>
            <ol style="line-height: 2; font-size: 14px; padding-left: 20px;">
                <li>도면 업로드: PDF 또는 이미지 파일을 선택합니다.</li>
                <li>시추공 선택: 왼쪽 사이드바에서 시추공을 선택합니다.</li>
                <li>도면에서 해당 위치 클릭: 선택한 시추공의 실제 위치를 도면에서 클릭합니다.</li>
                <li>3개 시추공 설정 후 캘리브레이션 적용: 최소 3개의 시추공 위치를 설정한 후 '캘리브레이션 적용' 버튼을 클릭합니다.</li>
            </ol>
            <div style="margin-top: 20px; padding: 15px; background: #E3F2FD; border-radius: 8px;">
                <strong>TIP:</strong> 캘리브레이션이 완료되면 모든 시추공이 도면에 자동으로 표시됩니다.
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// Show cloud area help modal
function showCloudAreaHelp() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }

    modalTitle.textContent = '구름 영역 표시';
    modalBody.innerHTML = `
        <div style="padding: 20px;">
            <h3 style="color: #455A64; margin-bottom: 15px;">구름 영역 표시 기능</h3>
            <p style="line-height: 1.8; font-size: 14px; margin-bottom: 15px;">
                각 시추공 주변의 영향 범위를 투명한 원으로 표시하여 지반 조건의 분포를 시각적으로 파악할 수 있습니다.
            </p>

            <h4 style="color: #455A64; margin: 20px 0 10px 0;">판정 유형별 구름 영역</h4>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 12px; background: #E8F5E9; border-radius: 6px; border-left: 4px solid #2E7D32;">
                    <strong style="color: #2E7D32;">직접 기초 판정</strong>
                    <p style="font-size: 13px; margin-top: 5px;">Step 5의 직접 기초 판정 결과 (직접기초/치환/파일)를 색상으로 구분</p>
                </div>
                <div style="padding: 12px; background: #FFEBEE; border-radius: 6px; border-left: 4px solid #E53935;">
                    <strong style="color: #E53935;">연약지반</strong>
                    <p style="font-size: 13px; margin-top: 5px;">Step 3의 연약지반 판정 결과 - 점선 테두리로 강조 표시</p>
                </div>
                <div style="padding: 12px; background: #FFF3E0; border-radius: 6px; border-left: 4px solid #FF9800;">
                    <strong style="color: #6D4C41;">전석/붕적/이암</strong>
                    <p style="font-size: 13px; margin-top: 5px;">Step 4의 전석/호박돌(주황) 및 붕적/이암층(갈색) 판정 결과</p>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: #E3F2FD; border-radius: 8px;">
                <strong>사용 방법:</strong>
                <ul style="margin-top: 10px; padding-left: 20px; line-height: 1.8; font-size: 13px;">
                    <li>구름 영역 표시 체크박스를 켜면 개별 옵션이 나타납니다</li>
                    <li>각 판정 유형별로 표시 여부를 선택할 수 있습니다</li>
                    <li>여러 판정이 겹치는 경우 레이어별로 중첩 표시됩니다</li>
                </ul>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// Show excavation level edit help modal
function showExcavationLevelHelp() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    modalTitle.textContent = '굴착면 레벨 편집';
    modalBody.innerHTML = `
        <div style="padding: 20px;">
            <h3 style="color: #455A64; margin-bottom: 15px;">설명</h3>
            <p style="line-height: 1.8; font-size: 14px; margin-bottom: 15px;">
                각 시추공의 굴착면 레벨을 편집할 수 있습니다. 편집한 값은 모든 Step에 자동으로 적용됩니다.
            </p>
            <div style="margin-top: 20px; padding: 15px; background: #E3F2FD; border-radius: 8px;">
                <strong>기능:</strong>
                <ul style="margin-top: 10px; padding-left: 20px; line-height: 1.8;">
                    <li><strong>일괄 편집:</strong> 모든 시추공에 동일한 굴착면 레벨을 한 번에 적용할 수 있습니다.</li>
                    <li><strong>기반암 레벨로 자동 설정:</strong> 각 시추공의 기반암 레벨을 자동으로 찾아 굴착면 레벨로 설정합니다.</li>
                    <li><strong>개별 편집:</strong> 각 시추공별로 개별적으로 굴착면 레벨을 수정할 수 있습니다.</li>
                </ul>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// Save excavation levels and update all steps (강제 적용)
function saveExcavationLevels() {
    if (!boreholeData || boreholeData.length === 0) {
        alert('시추공 데이터가 없습니다.');
        return;
    }

    let updatedCount = 0;

    // 모든 입력 필드의 값을 강제로 적용
    boreholeData.forEach((borehole, index) => {
        const input = document.getElementById(`excavationLevel_${index}`);
        if (!input) return;

        const newValue = parseFloat(input.value);
        if (isNaN(newValue)) return;

        // boreholeData 업데이트
        boreholeData[index].excavationLevelInput = newValue.toFixed(2);
        updatedCount++;
    });

    if (updatedCount === 0) {
        alert('업데이트할 시추공이 없습니다.');
        return;
    }

    // 모든 모듈 동기화 (한 번만 실행)
    // Step 2 검증 재수행
    if (typeof performVerification === 'function') {
        performVerification();
    }
    // Step 3, 4 재실행
    if (typeof runWeakSoilAnalysis === 'function' && window.weakSoilResults) {
        runWeakSoilAnalysis();
    }
    if (typeof runBoulderDetection === 'function' && window.boulderDetectionResults) {
        runBoulderDetection();
    }
    // Step 5 재실행
    if (typeof performSimpleFoundationAssessment === 'function') {
        performSimpleFoundationAssessment();
    }
    if (typeof runCompleteAnalysis === 'function' && window.analysisResults) {
        runCompleteAnalysis();
    }
    // Step 6 말뚝 지지력 재계산
    if (typeof runPileCalculation === 'function' && window.pileCalculationResults) {
        runPileCalculation();
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
    if (typeof updateOverlayCanvas === 'function') {
        updateOverlayCanvas();
    }

    // Show success message
    alert(`✓ 굴착면 레벨이 저장되었습니다!\n\n• 업데이트된 시추공: ${updatedCount}개\n• 모든 Step의 계산이 자동으로 업데이트되었습니다.`);
}

// Multiply matrix by vector
function multiplyMatrixVector(m, v) {
    return [
        m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
        m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
        m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2]
    ];
}

// Transform geographic coordinates to pixel coordinates
function transformGeoToPixel(geoX, geoY) {
    if (!transformMatrix) return { u: 0, v: 0 };
    const { a, b, c, d, e, f } = transformMatrix;
    return {
        u: a * geoX + b * geoY + c,
        v: d * geoX + e * geoY + f
    };
}

// Transform pixel coordinates to geographic coordinates (역변환)
function transformPixelToGeo(pixelU, pixelV) {
    if (!transformMatrix) return { x: 0, y: 0 };
    const { a, b, c, d, e, f } = transformMatrix;
    // 역행렬 계산: [a b; d e]^-1
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-10) return { x: 0, y: 0 };

    const invA = e / det;
    const invB = -b / det;
    const invD = -d / det;
    const invE = a / det;

    const u = pixelU - c;
    const v = pixelV - f;

    return {
        x: invA * u + invB * v,
        y: invD * u + invE * v
    };
}

// 도면의 4개 코너 픽셀 좌표를 실제 좌표로 변환하여 경계 계산
function getDrawingGeoBounds() {
    const canvas = document.getElementById('pdfCanvas');
    if (!canvas || canvas.width === 0) return null;
    
    // ✅ transformMatrix 또는 manualTransformMatrix 중 하나라도 있으면 진행
    if (!transformMatrix && !manualTransformMatrix) return null;

    const w = canvas.width;
    const h = canvas.height;

    // 캔버스 4개 코너를 실제 좌표로 변환
    let corners;
    
    if (transformMatrix) {
        // 캘리브레이션 기반 변환 행렬 사용
        corners = [
            transformPixelToGeo(0, 0),      // 좌상단
            transformPixelToGeo(w, 0),      // 우상단
            transformPixelToGeo(w, h),      // 우하단
            transformPixelToGeo(0, h)       // 좌하단
        ];
    } else if (manualTransformMatrix) {
        // ✅ 수동 배치 변환 행렬 사용
        corners = [
            pixelToGeoManual(0, 0),         // 좌상단
            pixelToGeoManual(w, 0),         // 우상단
            pixelToGeoManual(w, h),         // 우하단
            pixelToGeoManual(0, h)          // 좌하단
        ];
        console.log('📐 수동 배치 변환 행렬 사용:', manualTransformMatrix);
    }

    const xCoords = corners.map(c => c.x);
    const yCoords = corners.map(c => c.y);
    
    // ✅ 좌표 유효성 검증
    const validX = xCoords.filter(x => x !== 0 && !isNaN(x) && isFinite(x));
    const validY = yCoords.filter(y => y !== 0 && !isNaN(y) && isFinite(y));
    
    if (validX.length < 4 || validY.length < 4) {
        console.warn('⚠️ 도면 경계 좌표 계산 오류:', { xCoords, yCoords });
    }

    return {
        xMin: Math.min(...xCoords),
        xMax: Math.max(...xCoords),
        yMin: Math.min(...yCoords),
        yMax: Math.max(...yCoords),
        corners: corners,
        canvasWidth: w,
        canvasHeight: h
    };
}

// Draw contour lines directly on canvas using transformation matrix
function drawContourLinesDirect(ctx) {
    if (!window.visualizationData || !window.visualizationData.contour_data) return;
    
    const contourData = window.visualizationData.contour_data[contourOverlayType];
    if (!contourData) return;
    
    const { x, y, z } = contourData;
    
    if (!x || !y || !z || x.length < 2 || y.length < 2) return;
    
    // Calculate value range
    let minZ = Infinity, maxZ = -Infinity;
    z.forEach(row => {
        if (Array.isArray(row)) {
            row.forEach(v => {
                if(v !== null && v !== undefined && isFinite(v)) {
                    if(v < minZ) minZ = v;
                    if(v > maxZ) maxZ = v;
                }
            });
        }
    });
    
    if (minZ === Infinity || maxZ === -Infinity || maxZ === minZ) return;
    
    const gridSize = x.length;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    // Draw filled contours (simplified grid-based)
    for (let i = 0; i < gridSize - 1; i++) {
        for (let j = 0; j < gridSize - 1; j++) {
            if (!z[i] || !z[i+1] || !z[i][j] || !z[i][j+1] || !z[i+1][j] || !z[i+1][j+1]) continue;
            
            const val = (z[i][j] + z[i][j+1] + z[i+1][j] + z[i+1][j+1]) / 4;
            if (!isFinite(val)) continue;
            
            const normalized = (val - minZ) / (maxZ - minZ);
            // Color mapping (simplified blue-green-red heatmap)
            let r, g, b;
            if (normalized < 0.5) {
                r = 0;
                g = Math.floor(255 * (normalized * 2));
                b = Math.floor(255 * (1 - normalized * 2));
            } else {
                r = Math.floor(255 * ((normalized - 0.5) * 2));
                g = Math.floor(255 * (1 - (normalized - 0.5) * 2));
                b = 0;
            }
            
            // Transform 4 corners
            const p1 = transformGeoToPixel(x[j], y[i]);
            const p2 = transformGeoToPixel(x[j+1], y[i]);
            const p3 = transformGeoToPixel(x[j+1], y[i+1]);
            const p4 = transformGeoToPixel(x[j], y[i+1]);
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
            ctx.beginPath();
            ctx.moveTo(p1.u, p1.v);
            ctx.lineTo(p2.u, p2.v);
            ctx.lineTo(p3.u, p3.v);
            ctx.lineTo(p4.u, p4.v);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    ctx.restore();
    
    // Draw contour lines (Marching Squares - simplified for 15 levels)
    ctx.lineWidth = 1;

    const numLevels = 15;
    const step = (maxZ - minZ) / numLevels;

    // 레벨별 선 세그먼트 수집 (라벨 위치 결정용)
    const levelSegments = new Map();

    for (let level = 0; level <= numLevels; level++) {
        const threshold = minZ + level * step;
        const segments = [];

        // 주요 등고선 (5단위) 강조
        const isMajor = level % 5 === 0;
        ctx.strokeStyle = isMajor ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = isMajor ? 2 : 1;

        ctx.beginPath();
        for (let i = 0; i < gridSize - 1; i++) {
            for (let j = 0; j < gridSize - 1; j++) {
                if (!z[i] || !z[i+1]) continue;

                const v00 = z[i][j];
                const v10 = z[i][j+1];
                const v11 = z[i+1] ? z[i+1][j+1] : null;
                const v01 = z[i+1] ? z[i+1][j] : null;

                if (!isFinite(v00) || !isFinite(v10) || !isFinite(v11) || !isFinite(v01)) continue;

                // Edges
                const edges = [];

                // Top
                if ((v00 < threshold && v10 >= threshold) || (v00 >= threshold && v10 < threshold)) {
                    const t = (threshold - v00) / (v10 - v00 || 0.001);
                    const gx = x[j] + t * (x[j+1] - x[j]);
                    const gy = y[i];
                    edges.push(transformGeoToPixel(gx, gy));
                }
                // Right
                if ((v10 < threshold && v11 >= threshold) || (v10 >= threshold && v11 < threshold)) {
                    const t = (threshold - v10) / (v11 - v10 || 0.001);
                    const gx = x[j+1];
                    const gy = y[i] + t * (y[i+1] - y[i]);
                    edges.push(transformGeoToPixel(gx, gy));
                }
                // Bottom
                if ((v11 < threshold && v01 >= threshold) || (v11 >= threshold && v01 < threshold)) {
                    const t = (threshold - v11) / (v01 - v11 || 0.001);
                    const gx = x[j+1] - t * (x[j+1] - x[j]);
                    const gy = y[i+1];
                    edges.push(transformGeoToPixel(gx, gy));
                }
                // Left
                if ((v01 < threshold && v00 >= threshold) || (v01 >= threshold && v00 < threshold)) {
                    const t = (threshold - v01) / (v00 - v01 || 0.001);
                    const gx = x[j];
                    const gy = y[i+1] - t * (y[i+1] - y[i]);
                    edges.push(transformGeoToPixel(gx, gy));
                }

                if (edges.length >= 2) {
                    ctx.moveTo(edges[0].u, edges[0].v);
                    ctx.lineTo(edges[1].u, edges[1].v);
                    segments.push({ p1: edges[0], p2: edges[1] });
                }
            }
        }
        ctx.stroke();

        levelSegments.set(level, { threshold, segments, isMajor });
    }

    // 등고선 레벨 라벨 그리기 (모든 등고선에 여러 위치에 표시)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    levelSegments.forEach(({ threshold, segments, isMajor }) => {
        if (segments.length === 0) return;

        // 라벨 텍스트 및 폰트 설정 (주요 등고선은 더 큰 폰트)
        const labelText = threshold.toFixed(1);
        const fontSize = isMajor ? 14 : 11;
        ctx.font = `bold ${fontSize}px Arial`;

        // 라벨 표시 간격 (세그먼트 수에 따라 조절)
        const labelInterval = isMajor ? Math.max(1, Math.floor(segments.length / 4)) : Math.max(1, Math.floor(segments.length / 2));
        const labelsToShow = isMajor ? 4 : 2; // 주요 등고선은 4개, 일반 등고선은 2개

        // 균등하게 분배된 위치에 라벨 표시
        for (let labelIdx = 0; labelIdx < labelsToShow; labelIdx++) {
            const segIdx = Math.floor((segments.length / (labelsToShow + 1)) * (labelIdx + 1));
            if (segIdx >= segments.length) continue;

            const seg = segments[segIdx];
            if (!seg) continue;

            // 라벨 위치: 세그먼트 중간점
            const labelX = (seg.p1.u + seg.p2.u) / 2;
            const labelY = (seg.p1.v + seg.p2.v) / 2;

            // 배경 그리기 (주요 등고선은 더 큰 배경)
            const textWidth = ctx.measureText(labelText).width;
            const bgPadding = isMajor ? 4 : 3;
            const bgHeight = isMajor ? 18 : 14;

            ctx.fillStyle = isMajor ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(labelX - textWidth/2 - bgPadding, labelY - bgHeight/2, textWidth + bgPadding*2, bgHeight);

            // 테두리 (주요 등고선만)
            if (isMajor) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(labelX - textWidth/2 - bgPadding, labelY - bgHeight/2, textWidth + bgPadding*2, bgHeight);
            }

            // 텍스트 그리기
            ctx.fillStyle = isMajor ? '#000' : '#444';
            ctx.fillText(labelText, labelX, labelY);
        }
    });
}

// Update borehole selector dropdown
function updateBoreholeSelector() {
    const selector = document.getElementById('boreholeSelector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">시추공 선택...</option>';
    
    if (boreholeData && boreholeData.length > 0) {
        boreholeData.forEach(bh => {
            const option = document.createElement('option');
            option.value = bh.holeNo;
            option.textContent = bh.holeNo;
            selector.appendChild(option);
        });
    }
}

// Show borehole log modal - 개선된 우측 슬라이드인 패널
function showBoreholeLog(holeNo) {
    // Find borehole data
    let dataSource = null;
    if (typeof boreholeData !== 'undefined' && Array.isArray(boreholeData) && boreholeData.length > 0) {
        dataSource = boreholeData;
    } else if (window.boreholeData && window.boreholeData.boreholes && Array.isArray(window.boreholeData.boreholes)) {
        dataSource = window.boreholeData.boreholes;
    } else {
        alert(`시추공 데이터를 찾을 수 없습니다. 먼저 Step 1에서 데이터를 업로드해주세요.`);
        return;
    }

    const borehole = dataSource.find(bh => bh.holeNo === holeNo);
    if (!borehole) {
        alert(`시추공 ${holeNo}의 데이터를 찾을 수 없습니다.`);
        return;
    }

    const metadata = borehole.metadata || {};
    const soilData = borehole.soilData || [];
    const groundElevation = parseFloat(borehole.groundElevation) || 0;
    const waterTableElevation = borehole.waterTableElevation !== null ? parseFloat(borehole.waterTableElevation) : null;

    // Calculate max depth
    let maxDepth = 0;
    soilData.forEach(layer => {
        if (layer.depth_range) {
            const match = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
            if (match) {
                maxDepth = Math.max(maxDepth, parseFloat(match[2]));
            }
        }
    });

    // 지층별 색상 정의
    function getSoilColor(soilName) {
        const name = (soilName || '').toLowerCase();
        if (name.includes('매립') || name.includes('성토')) return { bg: '#8B7355', text: '#fff' };
        if (name.includes('퇴적') || name.includes('충적')) return { bg: '#D2B48C', text: '#333' };
        if (name.includes('실트') || name.includes('점토')) return { bg: '#A0522D', text: '#fff' };
        if (name.includes('모래') || name.includes('사질')) return { bg: '#F4A460', text: '#333' };
        if (name.includes('자갈') || name.includes('역')) return { bg: '#CD853F', text: '#fff' };
        if (name.includes('풍화토')) return { bg: '#DEB887', text: '#333' };
        if (name.includes('풍화암')) return { bg: '#BDB76B', text: '#333' };
        if (name.includes('연암')) return { bg: '#A9A9A9', text: '#fff' };
        if (name.includes('경암') || name.includes('보통암')) return { bg: '#808080', text: '#fff' };
        if (name.includes('화강')) return { bg: '#C0C0C0', text: '#333' };
        if (name.includes('편마')) return { bg: '#778899', text: '#fff' };
        return { bg: '#E8E8E8', text: '#333' };
    }

    // N값 추출 함수 (환산 포함)
    function extractNValue(hitsString) {
        if (!hitsString || typeof hitsString !== 'string') return null;
        const match = hitsString.match(/(\d+)\/(\d+)/);
        if (!match) return null;
        const blows = parseInt(match[1]);
        const penetration = parseInt(match[2]);
        if (isNaN(blows) || isNaN(penetration) || penetration <= 0) return null;

        let nValue;
        if (penetration >= 30) {
            nValue = blows;
        } else {
            if (blows >= 50) {
                nValue = Math.round(50 * 30 / penetration);
            } else {
                nValue = Math.round(blows * 30 / penetration);
            }
        }
        return Math.min(nValue, 50);
    }

    // Collect N-value data with proper calculation
    const nValueData = [];
    soilData.forEach(layer => {
        if (layer.samples) {
            layer.samples.forEach(sample => {
                if (sample.Depth !== undefined && sample.Hits) {
                    const hitsStr = sample.Hits.toString();
                    const nValue = extractNValue(hitsStr);
                    if (nValue !== null && nValue > 0) {
                        nValueData.push({
                            depth: parseFloat(sample.Depth),
                            nValue: nValue,
                            hits: hitsStr,
                            sampleNo: sample.Sample_number || '',
                            elevation: sample.Elevation !== undefined ? parseFloat(sample.Elevation) : (groundElevation - parseFloat(sample.Depth)),
                            soilName: layer.soil_name || ''
                        });
                    }
                }
            });
        }
    });

    // 스케일 계산 (최소 20px/m, 화면에 맞게 조정)
    const minPixelsPerMeter = 25;
    const maxPixelsPerMeter = 40;
    const availableHeight = window.innerHeight - 280;
    let pixelsPerMeter = Math.max(minPixelsPerMeter, Math.min(maxPixelsPerMeter, availableHeight / maxDepth));

    const totalHeight = maxDepth * pixelsPerMeter;
    const excavationLevel = parseFloat(borehole.excavationLevelInput) || groundElevation;
    const excavationDepth = groundElevation - excavationLevel;

    // Get analysis results
    let weakSoilResult = null;
    if (window.weakSoilResults && Array.isArray(window.weakSoilResults)) {
        weakSoilResult = window.weakSoilResults.find(r => r.holeNo === holeNo);
    } else if (window.weakSoilAnalysisResults && Array.isArray(window.weakSoilAnalysisResults)) {
        weakSoilResult = window.weakSoilAnalysisResults.find(r => r.holeNo === holeNo);
    }
    
    let boulderResult = null;
    if (window.boulderDetectionResults && Array.isArray(window.boulderDetectionResults)) {
        boulderResult = window.boulderDetectionResults.find(r => r.holeNo === holeNo);
    }

    // Generate stratigraphy HTML
    let stratigraphyHtml = '';
    let depthMarkersHtml = '';
    let specialMarkersHtml = '';

    // 얇은 지층 처리를 위한 최소 높이 (픽셀)
    const minLayerHeight = 24;

    // 지층 데이터 전처리 - 겹침 방지를 위한 표시 위치 계산
    const layerDisplayData = [];
    let accumulatedOffset = 0;

    soilData.forEach((layer, idx) => {
        if (layer.depth_range) {
            const match = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
            if (match) {
                const depthStart = parseFloat(match[1]);
                const depthEnd = parseFloat(match[2]);
                const actualHeight = (depthEnd - depthStart) * pixelsPerMeter;
                const displayHeight = Math.max(actualHeight, minLayerHeight);

                layerDisplayData.push({
                    layer,
                    idx,
                    depthStart,
                    depthEnd,
                    actualTop: depthStart * pixelsPerMeter,
                    actualHeight,
                    displayHeight,
                    isCompressed: actualHeight < minLayerHeight
                });
            }
        }
    });

    // 굴착면 마커 (굴착면이 지표고보다 위에 있어도 표시)
    const excavationLabelText = `굴착면 (EL.${excavationLevel.toFixed(2)}m)`;

    if (excavationDepth >= 0 && excavationDepth <= maxDepth) {
        // 굴착면이 지표고 아래에 있는 경우 (일반적인 경우)
        const excavationTop = excavationDepth * pixelsPerMeter;
        specialMarkersHtml += `
            <div style="position: absolute; top: ${excavationTop}px; left: -10px; right: -10px; border-top: 3px dashed #FF6F00; z-index: 100; pointer-events: none;">
                <div style="position: absolute; right: 0; top: -14px; background: #FF6F00; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    ${excavationLabelText}
                </div>
            </div>
        `;
    } else if (excavationDepth < 0) {
        // 굴착면이 지표고보다 위에 있는 경우 (상단에 표시)
        specialMarkersHtml += `
            <div style="position: absolute; top: -8px; left: -10px; right: -10px; border-top: 3px dashed #FF6F00; z-index: 100; pointer-events: none;">
                <div style="position: absolute; right: 0; top: -16px; background: #FF6F00; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    ${excavationLabelText} ▲${Math.abs(excavationDepth).toFixed(1)}m 상부
                </div>
            </div>
        `;
    }

    // 지층 HTML 생성
    layerDisplayData.forEach((data, displayIdx) => {
        const { layer, idx, depthStart, depthEnd, actualTop, actualHeight, displayHeight, isCompressed } = data;

        const soilName = layer.soil_name || '';
        const observation = layer.observation || '';
        const tcrMatch = observation.match(/TCR[:\s]*(\d+)%/i);
        const rqdMatch = observation.match(/RQD[:\s]*(\d+)%/i);
        const tcr = tcrMatch ? tcrMatch[1] : null;
        const rqd = rqdMatch ? rqdMatch[1] : null;

        // 지층 색상 가져오기
        const soilColor = getSoilColor(soilName);

        // EL 값 계산
        const elStart = (groundElevation - depthStart).toFixed(1);
        const elEnd = (groundElevation - depthEnd).toFixed(1);

        // 연약지반/전석층 마커 (좌측 바로 표시)
        let leftMarker = '';
        if (weakSoilResult && weakSoilResult.layerAnalysis) {
            const layerAnalysis = weakSoilResult.layerAnalysis.find(la => la.layerIndex === idx);
            if (layerAnalysis && layerAnalysis.isWeak) {
                const riskLevel = weakSoilResult.weakZones?.find(zone =>
                    zone.layers.some(l => l.layerIndex === idx)
                )?.riskLevel || 'LOW';
                if (riskLevel !== 'LOW') {
                    const riskColors = { 'CRITICAL': '#f44336', 'HIGH': '#ff9800', 'MEDIUM': '#ffc107' };
                    leftMarker = `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${riskColors[riskLevel] || '#ffc107'};"></div>`;
                }
            }
        }

        // 얇은 지층은 호버 시 상세 정보 표시
        const tooltipData = isCompressed ? `
            data-tooltip="true"
            data-soil="${soilName}"
            data-depth="${depthStart.toFixed(1)}~${depthEnd.toFixed(1)}m"
            data-el="EL.${elStart}~${elEnd}m"
            data-tcr="${tcr || '-'}"
            data-rqd="${rqd || '-'}"
            onmouseenter="showLayerTooltip(event, this)"
            onmouseleave="hideLayerTooltip()"
        ` : '';

        stratigraphyHtml += `
            <div class="soil-layer-box ${isCompressed ? 'compressed-layer' : ''}"
                 style="position: absolute; top: ${actualTop}px; left: 0; right: 0; height: ${actualHeight}px; min-height: ${minLayerHeight}px; display: flex; align-items: stretch; border: 1px solid #888; overflow: visible; border-radius: 2px; cursor: ${isCompressed ? 'pointer' : 'default'}; transition: z-index 0.1s;"
                 ${tooltipData}>
                ${leftMarker}
                <div style="width: 40px; flex-shrink: 0; background: ${soilColor.bg}; display: flex; align-items: center; justify-content: center; border-right: 1px solid #888; position: relative;">
                    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${actualHeight >= 20 ? `<span style="color: ${soilColor.text}; font-size: 9px; font-weight: 600; text-align: center; line-height: 1.1; padding: 2px;">${soilName.length > 4 ? soilName.substring(0,4) : soilName}</span>` : ''}
                    </div>
                </div>
                <div style="flex: 1; min-width: 0; padding: 2px 6px; background: linear-gradient(to right, ${soilColor.bg}15, #fff); display: flex; align-items: center; gap: 4px; overflow: hidden;">
                    <span style="font-size: 11px; font-weight: 600; color: #455A64; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${soilName}</span>
                    ${!isCompressed && (tcr || rqd) ? `<span style="font-size: 9px; color: #d32f2f; white-space: nowrap;">${tcr ? 'T:'+tcr+'%' : ''} ${rqd ? 'R:'+rqd+'%' : ''}</span>` : ''}
                </div>
            </div>
        `;
    });

    // Depth markers - 개선된 깊이 스케일 (GL + EL 표시)
    const depthInterval = maxDepth > 20 ? 5 : (maxDepth > 10 ? 2 : 1);
    for (let d = 0; d <= maxDepth; d += depthInterval) {
        const top = d * pixelsPerMeter;
        const isMajor = d % 5 === 0 || d === 0;
        const elValue = (groundElevation - d).toFixed(1);
        depthMarkersHtml += `
            <div style="position: absolute; top: ${top}px; left: 0; right: 0; height: 0; z-index: 2;">
                <div style="position: absolute; left: 0; right: 0; border-top: ${isMajor ? '1px solid #aaa' : '1px dotted #ddd'};"></div>
                <div style="position: absolute; right: 2px; top: -10px; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
                    <span style="font-size: ${isMajor ? '12px' : '10px'}; color: ${isMajor ? '#455A64' : '#666'}; font-weight: ${isMajor ? '600' : '500'};">${d.toFixed(0)}m</span>
                    <span style="font-size: 10px; color: ${isMajor ? '#546E7A' : '#888'};">EL.${elValue}</span>
                </div>
            </div>
        `;
    }

    // N-value graph - 깊이와 동기화된 수평 바 그래프
    nValueData.sort((a, b) => a.depth - b.depth);
    let nValueGraphHtml = '';

    // 깊이 눈금선 (N값 영역에도 동일하게 표시)
    for (let d = 0; d <= maxDepth; d += depthInterval) {
        const top = d * pixelsPerMeter;
        const isMajor = d % 5 === 0 || d === 0;
        nValueGraphHtml += `
            <div style="position: absolute; top: ${top}px; left: 0; right: 0; border-top: ${isMajor ? '1px solid #ddd' : '1px dotted #eee'}; z-index: 0;"></div>
        `;
    }

    // N값 스케일 헤더
    nValueGraphHtml += `
        <div style="position: absolute; top: -22px; left: 0; right: 25px; height: 20px; display: flex; align-items: flex-end; border-bottom: 1px solid #666;">
            <span style="position: absolute; left: 0; bottom: 2px; font-size: 8px; color: #666;">0</span>
            <span style="position: absolute; left: 25%; bottom: 2px; font-size: 8px; color: #888; transform: translateX(-50%);">12</span>
            <span style="position: absolute; left: 50%; bottom: 2px; font-size: 8px; color: #888; transform: translateX(-50%);">25</span>
            <span style="position: absolute; left: 75%; bottom: 2px; font-size: 8px; color: #888; transform: translateX(-50%);">37</span>
            <span style="position: absolute; right: 0; bottom: 2px; font-size: 8px; color: #2E7D32; font-weight: 600;">50</span>
        </div>
    `;

    // N값 바 그래프
    nValueData.forEach((point, idx) => {
        const top = point.depth * pixelsPerMeter;
        const barWidthPercent = Math.min((point.nValue / 50) * 100, 100);
        const isRefusal = point.nValue >= 50;

        // 수평 바 그래프 - 깊이에 맞춰 정확히 배치
        nValueGraphHtml += `
            <div class="nvalue-bar-row"
                 style="position: absolute; top: ${top - 6}px; left: 0; right: 25px; height: 12px; display: flex; align-items: center; cursor: pointer; z-index: 5;"
                 data-hits="${point.hits}"
                 data-sample="${point.sampleNo}"
                 data-depth="${point.depth.toFixed(2)}"
                 data-nvalue="${point.nValue}"
                 data-elevation="${point.elevation.toFixed(2)}"
                 data-soil="${point.soilName}"
                 onmouseenter="showNValueTooltip(event, this)"
                 onmouseleave="hideNValueTooltip()">
                <div style="width: ${barWidthPercent}%; height: 10px; background: ${isRefusal ? 'linear-gradient(to right, #1976d2, #2E7D32)' : 'linear-gradient(to right, #90CAF9, #1976d2)'}; border-radius: 1px; min-width: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);"></div>
            </div>
            <div style="position: absolute; top: ${top - 6}px; right: 2px; font-size: 9px; font-weight: 600; color: ${isRefusal ? '#2E7D32' : '#1976d2'}; z-index: 6; line-height: 12px;">${point.nValue}</div>
        `;

        // 깊이 마커 연결 (수평 점선)
        nValueGraphHtml += `
            <div style="position: absolute; top: ${top}px; left: -8px; width: 8px; border-top: 1px dotted #aaa; z-index: 1;"></div>
        `;
    });

    // 지하수위 표시 HTML
    let waterTableHtml = '';
    if (waterTableElevation !== null) {
        const waterDepth = groundElevation - waterTableElevation;
        if (waterDepth >= 0 && waterDepth <= maxDepth) {
            const waterTop = waterDepth * pixelsPerMeter;
            waterTableHtml = `
                <div style="position: absolute; top: ${waterTop}px; left: 0; right: 0; height: 0; border-top: 2px dashed #2196F3; z-index: 90;">
                    <div style="position: absolute; right: 0; top: -12px; background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; white-space: nowrap;">
                        지하수위 GL-${waterDepth.toFixed(1)}m
                    </div>
                </div>
            `;
        }
    }

    // Modal HTML - 우측 슬라이드인 패널
    const modalHtml = `
        <div class="borehole-log-modal" id="boreholeLogModal" onclick="if(event.target.id === 'boreholeLogModal') closeBoreholeLog()"
             style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; justify-content: flex-end;">
            <div class="borehole-log-panel"
                 style="background: white; width: 520px; max-width: 95vw; height: 100%; box-shadow: -4px 0 20px rgba(0,0,0,0.3); display: flex; flex-direction: column; animation: slideInRight 0.3s ease-out;">

                <!-- 컴팩트 헤더 -->
                <div style="padding: 10px 16px; background: linear-gradient(135deg, #455A64, #2C5F8D); color: white; flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <!-- 좌측: 시추공 정보 -->
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <div style="font-size: 20px; font-weight: 700; min-width: 70px;">${holeNo}</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; opacity: 0.95;">
                                <div><span style="opacity: 0.7;">지표고</span> <span style="font-weight: 600;">EL.${groundElevation.toFixed(2)}m</span></div>
                                <div><span style="opacity: 0.7;">시추</span> <span style="font-weight: 600;">${maxDepth.toFixed(1)}m</span></div>
                                <div><span style="opacity: 0.7;">지하수위</span> <span style="font-weight: 600;">${waterTableElevation !== null ? 'GL-' + (groundElevation - waterTableElevation).toFixed(1) + 'm' : 'N/A'}</span></div>
                                <div><span style="opacity: 0.7;">굴착면</span> <span style="font-weight: 600; color: #FFCC80;">${excavationLevel !== groundElevation ? 'EL.' + excavationLevel.toFixed(2) + 'm' : '미설정'}</span></div>
                            </div>
                        </div>
                        <!-- 우측: 닫기 버튼 -->
                        <button onclick="closeBoreholeLog()" style="background: rgba(255,255,255,0.2); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; flex-shrink: 0; margin-left: 8px;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">&times;</button>
                    </div>
                    <!-- 범례 (헤더에 통합) -->
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 9px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <div style="display: flex; align-items: center; gap: 3px;"><div style="width: 12px; height: 12px; background: #8B7355; border-radius: 2px;"></div>매립</div>
                        <div style="display: flex; align-items: center; gap: 3px;"><div style="width: 12px; height: 12px; background: #DEB887; border-radius: 2px;"></div>풍화토</div>
                        <div style="display: flex; align-items: center; gap: 3px;"><div style="width: 12px; height: 12px; background: #BDB76B; border-radius: 2px;"></div>풍화암</div>
                        <div style="display: flex; align-items: center; gap: 3px;"><div style="width: 12px; height: 12px; background: #A9A9A9; border-radius: 2px;"></div>연암</div>
                        <div style="display: flex; align-items: center; gap: 3px;"><div style="width: 12px; height: 12px; background: #808080; border-radius: 2px;"></div>경암</div>
                    </div>
                </div>

                <!-- 본문 (스크롤 영역) -->
                <div style="flex: 1; overflow-y: auto; padding: 16px 20px;">
                    <!-- 컬럼 헤더 (고정) -->
                    <div style="display: grid; grid-template-columns: 55px 1fr 130px; gap: 6px; margin-bottom: 4px; position: sticky; top: 0; background: white; z-index: 10; padding-bottom: 4px; border-bottom: 2px solid #455A64;">
                        <div style="font-size: 10px; font-weight: 600; color: #455A64; text-align: center; padding: 4px 0;">
                            <div>깊이(GL)</div>
                            <div style="font-size: 8px; color: #666; font-weight: 400;">표고(EL)</div>
                        </div>
                        <div style="font-size: 10px; font-weight: 600; color: #455A64; text-align: center; padding: 4px 0;">지층</div>
                        <div style="font-size: 10px; font-weight: 600; color: #455A64; text-align: center; padding: 4px 0;">N값 (0~50)</div>
                    </div>

                    <!-- 데이터 영역 -->
                    <div style="display: grid; grid-template-columns: 55px 1fr 130px; gap: 6px; min-height: ${totalHeight}px; position: relative;">

                        <!-- 깊이 스케일 -->
                        <div style="position: relative; height: ${totalHeight}px; border-right: 1px solid #e0e0e0;">
                            ${depthMarkersHtml}
                        </div>

                        <!-- 지층 정보 -->
                        <div style="position: relative; height: ${totalHeight}px;">
                            ${specialMarkersHtml}
                            ${waterTableHtml}
                            ${stratigraphyHtml}
                        </div>

                        <!-- N값 그래프 -->
                        <div style="position: relative; height: ${totalHeight}px; border-left: 1px solid #e0e0e0; padding-left: 6px;">
                            <div style="position: relative; height: 100%; padding-top: 22px;">
                                ${nValueGraphHtml}
                            </div>
                        </div>
                    </div>

                    <!-- N값 범례 -->
                    <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                        <div style="font-size: 11px; font-weight: 600; color: #455A64; margin-bottom: 8px;">N값 범례</div>
                        <div style="display: flex; gap: 16px; font-size: 10px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 40px; height: 10px; background: linear-gradient(to right, #64B5F6, #1976d2); border-radius: 2px;"></div>
                                <span>N &lt; 50 (일반)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 40px; height: 10px; background: linear-gradient(to right, #1976d2, #2E7D32); border-radius: 2px;"></div>
                                <span style="color: #2E7D32; font-weight: 600;">N = 50 (Refusal, 견고한 지반)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 푸터 -->
                <div style="padding: 12px 20px; background: #f5f5f5; border-top: 1px solid #e0e0e0; flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: #666;">
                            좌표: X=${metadata.X_COORDINATE || 'N/A'}, Y=${metadata.Y_COORDINATE || 'N/A'}
                        </div>
                        <button onclick="closeBoreholeLog()" style="background: #455A64; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">닫기</button>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('boreholeLogModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeBoreholeLog() {
    const modal = document.getElementById('boreholeLogModal');
    if (modal) {
        modal.remove();
    }
}

// ESC 키로 시추주상도 팝업 닫기
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        const modal = document.getElementById('boreholeLogModal');
        if (modal) {
            closeBoreholeLog();
            event.preventDefault();
        }
    }
});

function showNValueTooltip(event, element) {
    hideNValueTooltip();

    const hits = element.getAttribute('data-hits');
    const sample = element.getAttribute('data-sample');
    const depth = element.getAttribute('data-depth');
    const nValue = element.getAttribute('data-nvalue');
    const elevation = element.getAttribute('data-elevation');
    const soil = element.getAttribute('data-soil') || '';
    const isRefusal = parseInt(nValue) >= 50;

    const tooltip = document.createElement('div');
    tooltip.id = 'nvalueTooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: linear-gradient(135deg, #455A64, #2C5F8D);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 12px;
        z-index: 10001;
        pointer-events: none;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        min-width: 160px;
    `;
    tooltip.innerHTML = `
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3);">
            N = ${nValue} ${isRefusal ? '<span style="background:#2E7D32; padding:2px 6px; border-radius:3px; font-size:10px; margin-left:4px;">Refusal (견고)</span>' : ''}
        </div>
        <div style="display: grid; gap: 4px; font-size: 11px; opacity: 0.95;">
            <div><span style="opacity:0.7;">깊이:</span> GL-${depth}m</div>
            <div><span style="opacity:0.7;">표고:</span> E.L. ${elevation}m</div>
            <div><span style="opacity:0.7;">타격:</span> ${hits}</div>
            ${soil ? `<div><span style="opacity:0.7;">지층:</span> ${soil}</div>` : ''}
            ${sample ? `<div><span style="opacity:0.7;">샘플:</span> ${sample}</div>` : ''}
        </div>
    `;

    document.body.appendChild(tooltip);

    // 툴팁 위치 계산 (화면 벗어나지 않도록)
    const rect = element.getBoundingClientRect();
    let left = rect.left - tooltip.offsetWidth - 10;
    let top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2;

    // 왼쪽 공간 부족시 오른쪽에 표시
    if (left < 10) {
        left = rect.right + 10;
    }
    // 상하 경계 체크
    if (top < 10) top = 10;
    if (top + tooltip.offsetHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltip.offsetHeight - 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// 얇은 지층 호버 툴팁
function showLayerTooltip(event, element) {
    hideLayerTooltip();

    const soil = element.getAttribute('data-soil');
    const depth = element.getAttribute('data-depth');
    const el = element.getAttribute('data-el');
    const tcr = element.getAttribute('data-tcr');
    const rqd = element.getAttribute('data-rqd');

    const tooltip = document.createElement('div');
    tooltip.id = 'layerTooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: white;
        border: 2px solid #455A64;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 12px;
        z-index: 10002;
        pointer-events: none;
        box-shadow: 0 4px 15px rgba(0,0,0,0.25);
        min-width: 150px;
        max-width: 250px;
    `;
    tooltip.innerHTML = `
        <div style="font-size: 14px; font-weight: 700; color: #455A64; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0;">
            ${soil}
        </div>
        <div style="display: grid; gap: 4px; font-size: 11px;">
            <div><span style="color: #666;">깊이:</span> <strong>${depth}</strong></div>
            <div><span style="color: #666;">표고:</span> <strong>${el}</strong></div>
            ${tcr !== '-' ? `<div><span style="color: #666;">TCR:</span> <strong style="color: #d32f2f;">${tcr}%</strong></div>` : ''}
            ${rqd !== '-' ? `<div><span style="color: #666;">RQD:</span> <strong style="color: #d32f2f;">${rqd}%</strong></div>` : ''}
        </div>
    `;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2;

    if (left + tooltip.offsetWidth > window.innerWidth - 10) {
        left = rect.left - tooltip.offsetWidth - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltip.offsetHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltip.offsetHeight - 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // 호버된 요소 하이라이트
    element.style.zIndex = '100';
    element.style.boxShadow = '0 2px 10px rgba(30, 69, 112, 0.4)';
    element.style.transform = 'scale(1.02)';
}

function hideLayerTooltip() {
    const tooltip = document.getElementById('layerTooltip');
    if (tooltip) {
        tooltip.remove();
    }
    // 모든 지층 요소 스타일 복원
    document.querySelectorAll('.compressed-layer').forEach(el => {
        el.style.zIndex = '';
        el.style.boxShadow = '';
        el.style.transform = '';
    });
}

function hideNValueTooltip() {
    const tooltip = document.getElementById('nvalueTooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// ========================================
// PDF 도면 투명도 조절 기능 (도면만 투명, 오버레이는 불투명 유지)
// ========================================
function updatePdfOpacity(value) {
    pdfOpacity = parseInt(value);
    const pdfCanvas = document.getElementById('pdfCanvas');
    const opacitySpan = document.getElementById('pdfOpacityValue');

    if (pdfCanvas) {
        // pdfCanvas만 투명하게 (overlayCanvas는 별도 레이어이므로 영향 없음)
        pdfCanvas.style.opacity = pdfOpacity / 100;
    }
    if (opacitySpan) {
        opacitySpan.textContent = pdfOpacity + '%';
    }

    // overlayCanvas는 항상 불투명하게 유지
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (overlayCanvas) {
        overlayCanvas.style.opacity = 1;
    }
}

// ========================================
// 도면 위 다중 시추공 선택 및 단면도 생성
// ========================================
function toggleDrawingMultiBoreholeMode() {
    drawingMultiBoreholeMode = !drawingMultiBoreholeMode;
    const btn = document.getElementById('toggleDrawingMultiModeBtn');
    if (btn) {
        if (drawingMultiBoreholeMode) {
            btn.textContent = '단일 시추공 보기 모드';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
        } else {
            btn.textContent = '다중 시추공 분석 모드';
            btn.style.background = '#607D8B';
            btn.style.color = 'white';
            clearDrawingSelection();
        }
    }
    updateDrawingSelectionUI();
}

function clearDrawingSelection() {
    drawingSelectedBoreholes = [];
    updateDrawingSelectionUI();
    updateOverlayCanvas();
}

function selectDrawingBorehole(holeNo) {
    const index = drawingSelectedBoreholes.indexOf(holeNo);
    if (index === -1) {
        drawingSelectedBoreholes.push(holeNo);
        console.log(`✅ 시추공 선택: ${holeNo} (총 ${drawingSelectedBoreholes.length}개)`);
    } else {
        drawingSelectedBoreholes.splice(index, 1);
        console.log(`❌ 시추공 선택 해제: ${holeNo} (총 ${drawingSelectedBoreholes.length}개)`);
    }
    updateDrawingSelectionUI();
    updateOverlayCanvas();

    // ✅ 2개 이상 선택 시 자동으로 단면도 업데이트
    if (drawingSelectedBoreholes.length >= 2) {
        const container = document.getElementById('drawingCrossSectionContainer');
        if (container) {
            container.style.display = 'block';
        }
        generateDrawingCrossSection();
    }
}

function updateDrawingSelectionUI() {
    const div = document.getElementById('drawingSelectedBoreholes');
    if (!div) return;

    if (drawingSelectedBoreholes.length === 0) {
        if (drawingMultiBoreholeMode) {
            div.textContent = '다중 시추공 분석 모드: 도면에서 시추공을 클릭하여 선택하세요';
        } else {
            div.textContent = '시추공 매칭 완료 후 다중 분석 모드를 활성화하세요';
        }
    } else {
        div.innerHTML = `선택된 시추공 (${drawingSelectedBoreholes.length}개): ` +
            drawingSelectedBoreholes.map(h => `<span style="background:#4CAF50; color:white; padding:4px 8px; border-radius:4px; margin:0 3px; font-weight:bold;">${h}</span>`).join(' ');
    }

    const btn = document.getElementById('drawingMultiAnalysisBtn');
    if (btn) {
        btn.disabled = drawingSelectedBoreholes.length < 2;
        btn.style.opacity = drawingSelectedBoreholes.length < 2 ? '0.6' : '1';
        if (drawingSelectedBoreholes.length >= 2) {
            btn.textContent = `단면도 보기 (${drawingSelectedBoreholes.length}개)`;
        } else {
            btn.textContent = '단면도 보기 (2개 이상 필요)';
        }
    }
}

function showDrawingCrossSection() {
    if (drawingSelectedBoreholes.length < 2) {
        alert('단면도를 보려면 2개 이상의 시추공을 선택해주세요.');
        return;
    }

    // 인라인 컨테이너에 단면도 표시 (우선)
    const container = document.getElementById('drawingCrossSectionContainer');
    const plotDiv = document.getElementById('drawingCrossSectionPlot');

    if (container && plotDiv) {
        container.style.display = 'block';
        // 스크롤하여 단면도 보이도록
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 단면도 생성
        setTimeout(() => {
            generateDrawingCrossSection();
        }, 100);
        return;
    }

    // 폴백: 모달에 표시
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('단면도를 표시할 수 없습니다.');
        return;
    }

    modalTitle.textContent = `지반 단면도 (${drawingSelectedBoreholes.join(' → ')})`;

    modalBody.innerHTML = `
        <div id="drawingCrossSectionPlot" style="height: 500px; margin-bottom: 20px;"></div>
        <div style="text-align: center;">
            <button onclick="closeModal()" class="btn btn-secondary" style="padding: 10px 30px;">닫기</button>
        </div>
    `;

    modal.style.display = 'block';

    // 단면도 생성
    setTimeout(() => {
        generateDrawingCrossSection();
    }, 100);
}

function generateDrawingCrossSection() {
    // ✅ 새로운 수직 프로파일 단면도 사용
    const plotDiv = document.getElementById('drawingCrossSectionPlot');
    if (!plotDiv) {
        console.warn('⚠️ drawingCrossSectionPlot 컨테이너를 찾을 수 없습니다');
        return;
    }

    if (drawingSelectedBoreholes.length < 2) {
        plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">2개 이상의 시추공을 선택하세요.</div>';
        return;
    }

    console.log('🎨 generateDrawingCrossSection - 수직 프로파일 방식으로 생성:', drawingSelectedBoreholes);

    // renderVerticalProfileCrossSection 함수 사용
    renderVerticalProfileCrossSection(plotDiv, drawingSelectedBoreholes);
    return;  // 이하 기존 코드는 실행되지 않음

    // ========== 기존 코드 (폴백용으로 보존) ==========
    // 선택된 시추공 데이터 준비
    const selectedPointsData = drawingSelectedBoreholes.map((holeNo, idx) => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh) return null;

        // 수동 배치에서 좌표 가져오기
        const manualPoint = manualPlacements.find(mp => mp.holeNo === holeNo);
        let xCoord = parseFloat(bh.x);
        let yCoord = parseFloat(bh.y);

        // 수동 배치 좌표가 있으면 사용
        if (manualPoint) {
            xCoord = manualPoint.geoX;
            yCoord = manualPoint.geoY;
        }

        // 좌표가 없거나 유효하지 않으면 순서 기반 임시 좌표 사용
        if (isNaN(xCoord) || isNaN(yCoord)) {
            xCoord = idx * 20;
            yCoord = 0;
        }

        const layers = getDetailedLayers(bh);
        const groundElev = parseFloat(bh.groundElevation || 0);
        const excavationLevel = parseFloat(bh.excavationLevelInput) || groundElev;
        return {
            holeNo,
            x: xCoord,
            y: yCoord,
            groundElevation: groundElev,
            excavationLevel: excavationLevel,
            layers: layers,
            totalDepth: parseFloat(bh.totalDepth || 0)
        };
    }).filter(p => p !== null);

    if (selectedPointsData.length < 2) return;

    // 누적 거리 계산
    let cumulativeDistances = [0];
    for (let i = 1; i < selectedPointsData.length; i++) {
        const prev = selectedPointsData[i - 1];
        const curr = selectedPointsData[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }

    const maxDist = cumulativeDistances[cumulativeDistances.length - 1];

    // 지질 유형 수집
    const allSoilTypes = new Map();
    selectedPointsData.forEach(pt => {
        pt.layers.forEach(layer => {
            if (!allSoilTypes.has(layer.soilType)) {
                allSoilTypes.set(layer.soilType, {
                    type: layer.soilType,
                    label: layer.label,
                    color: layer.color,
                    order: layer.order
                });
            }
        });
    });

    // 표고 범위 계산
    let minElev = Infinity, maxElev = -Infinity;
    selectedPointsData.forEach(pt => {
        if (pt.groundElevation > maxElev) maxElev = pt.groundElevation;
        pt.layers.forEach(layer => {
            if (layer.elevationBottom < minElev) minElev = layer.elevationBottom;
        });
    });
    minElev -= 3;

    const traces = [];

    // 지층 보간 (updateCrossSection과 동일한 로직)
    function perlinNoise(x, seed) {
        const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
        return n - Math.floor(n);
    }

    function smoothNoise(x, seed, octaves = 3) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += perlinNoise(x * frequency, seed + i * 100) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        return (total / maxValue) * 2 - 1;
    }

    // 지층 폴리곤 생성 (하이브리드 매칭 + 리샘플링 + 정밀 wedge-out)
    const segmentPoints = 30;

    // 색상 보간 함수
    function blendColors(color1, color2, ratio) {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');
        const r1 = parseInt(hex1.substr(0, 2), 16);
        const g1 = parseInt(hex1.substr(2, 2), 16);
        const b1 = parseInt(hex1.substr(4, 2), 16);
        const r2 = parseInt(hex2.substr(0, 2), 16);
        const g2 = parseInt(hex2.substr(2, 2), 16);
        const b2 = parseInt(hex2.substr(4, 2), 16);
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // 암반 타입 확인 함수
    function isRockType(soilType) {
        return soilType === 'hard_rock' || soilType === 'soft_rock' || soilType === 'weathered_rock';
    }

    function isRockFamily(soilType) {
        return soilType === 'hard_rock' || soilType === 'soft_rock' ||
               soilType === 'weathered_rock' || soilType === 'weathered_soil';
    }

    // 하이브리드 레이어 매칭 함수
    function matchLayersHybrid(layers1, layers2) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();

        // 1단계: 같은 soilType 매칭
        layers1.forEach((l1, idx1) => {
            layers2.forEach((l2, idx2) => {
                if (!used1.has(idx1) && !used2.has(idx2) && l1.soilType === l2.soilType) {
                    matches.push({ l1, l2, matchType: 'same' });
                    used1.add(idx1);
                    used2.add(idx2);
                }
            });
        });

        // 1.5단계: 암반 계열끼리 매칭
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;
            if (!isRockFamily(l1.soilType)) return;

            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;
                if (!isRockFamily(l2.soilType)) return;

                const overlapTop = Math.min(l1.elevationTop, l2.elevationTop);
                const overlapBottom = Math.max(l1.elevationBottom, l2.elevationBottom);
                const overlap = overlapTop - overlapBottom;

                if (overlap > -2.0) {
                    matches.push({ l1, l2, matchType: 'rock-transition' });
                    used1.add(idx1);
                    used2.add(idx2);
                }
            });
        });

        // 2단계: 표고 기반 매칭
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;
            let bestMatch = null;
            let bestOverlap = 0;

            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;
                const overlapTop = Math.min(l1.elevationTop, l2.elevationTop);
                const overlapBottom = Math.max(l1.elevationBottom, l2.elevationBottom);
                const overlap = Math.max(0, overlapTop - overlapBottom);
                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestMatch = { l2, idx2 };
                }
            });

            if (bestMatch && bestOverlap > 0) {
                matches.push({ l1, l2: bestMatch.l2, matchType: 'elevation' });
                used1.add(idx1);
                used2.add(bestMatch.idx2);
            } else {
                if (isRockType(l1.soilType)) {
                    matches.push({ l1, l2: null, matchType: 'rock-extend-out' });
                } else {
                    matches.push({ l1, l2: null, matchType: 'wedge-out' });
                }
                used1.add(idx1);
            }
        });

        // 3단계: 오른쪽에만 있는 레이어
        layers2.forEach((l2, idx2) => {
            if (!used2.has(idx2)) {
                if (isRockType(l2.soilType)) {
                    matches.push({ l1: null, l2, matchType: 'rock-extend-in' });
                } else {
                    matches.push({ l1: null, l2, matchType: 'wedge-in' });
                }
            }
        });

        return matches;
    }

    // 리샘플링된 폴리곤 좌표 생성 (깊이 기반 보간)
    function createResampledPolygon(dist1, dist2, l1Top, l1Bottom, l2Top, l2Bottom, numPoints, ground1, ground2) {
        const topX = [], topY = [], bottomX = [], bottomY = [];
        const useDepthBased = (ground1 !== undefined && ground2 !== undefined);

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t);
            topX.push(dist);
            bottomX.push(dist);

            if (useDepthBased) {
                const groundLevel = ground1 + smoothT * (ground2 - ground1);
                const depth1Top = ground1 - l1Top;
                const depth1Bottom = ground1 - l1Bottom;
                const depth2Top = ground2 - l2Top;
                const depth2Bottom = ground2 - l2Bottom;
                const interpDepthTop = depth1Top + smoothT * (depth2Top - depth1Top);
                const interpDepthBottom = depth1Bottom + smoothT * (depth2Bottom - depth1Bottom);
                topY.push(groundLevel - interpDepthTop);
                bottomY.push(groundLevel - interpDepthBottom);
            } else {
                topY.push(l1Top + smoothT * (l2Top - l1Top));
                bottomY.push(l1Bottom + smoothT * (l2Bottom - l1Bottom));
            }
        }
        const polyX = [...topX, ...bottomX.slice().reverse()];
        const polyY = [...topY, ...bottomY.slice().reverse()];
        polyX.push(polyX[0]);
        polyY.push(polyY[0]);
        return { polyX, polyY };
    }

    // Wedge-out 폴리곤 생성 (두께가 0으로 수렴하며 자연스럽게 소멸)
    function createWedgeOutPolygon(dist1, dist2, layer, direction, numPoints, ground1, ground2, aboveBottom1, aboveBottom2, belowTop1, belowTop2) {
        const polyX = [], polyY = [];

        if (direction === 'right') {
            // 오른쪽으로 소멸: 왼쪽 시추공에 레이어 존재, 오른쪽에 없음
            const topStart = layer.elevationTop;
            const bottomStart = layer.elevationBottom;
            const layerThickness = topStart - bottomStart;

            // 레이어 중심 표고
            const midElev = (topStart + bottomStart) / 2;
            // 레이어 중심의 깊이 (지표에서부터)
            const midDepth = ground1 - midElev;
            // 목표 지점에서 같은 깊이의 표고
            const targetMidElev = ground2 - midDepth;

            // 수렴점 결정: 위/아래 지층 경계의 중간 또는 깊이 기반 표고
            let convergenceElev;
            if (belowTop2 !== null && belowTop2 !== undefined &&
                aboveBottom2 !== null && aboveBottom2 !== undefined) {
                // 위/아래 지층 모두 존재: 그 사이 중간점으로 수렴
                convergenceElev = (belowTop2 + aboveBottom2) / 2;
            } else if (belowTop2 !== null && belowTop2 !== undefined) {
                // 아래 지층만 존재: 아래 지층 상단으로 수렴
                convergenceElev = belowTop2;
            } else if (aboveBottom2 !== null && aboveBottom2 !== undefined) {
                // 위 지층만 존재: 위 지층 하단으로 수렴
                convergenceElev = aboveBottom2;
            } else {
                // 둘 다 없음: 같은 깊이의 목표 표고 사용
                convergenceElev = targetMidElev;
            }

            // 상단 경계 (좌→우): 두께가 점점 줄어들며 수렴점으로 이동
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                // ease-out: 시작은 빠르게, 끝은 부드럽게 (1 - (1-t)^3)
                const smoothT = 1 - Math.pow(1 - t, 3);

                const groundLevel = ground1 + t * (ground2 - ground1);
                // 두께가 점점 줄어듦 (원래 두께 → 0)
                const currentThickness = layerThickness * (1 - smoothT);
                // 중심이 수렴점으로 이동
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);
                // 상단 = 중심 + 두께/2
                const topElev = currentMidElev + currentThickness / 2;

                polyX.push(dist);
                polyY.push(Math.min(topElev, groundLevel));
            }

            // 하단 경계 (우→좌)
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = 1 - Math.pow(1 - t, 3);

                const currentThickness = layerThickness * (1 - smoothT);
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);
                // 하단 = 중심 - 두께/2
                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        } else {
            // 왼쪽으로 소멸 (wedge-in): 오른쪽 시추공에 레이어 존재, 왼쪽에 없음
            const topEnd = layer.elevationTop;
            const bottomEnd = layer.elevationBottom;
            const layerThickness = topEnd - bottomEnd;

            // 목표 지층의 깊이 (오른쪽 시추공 기준)
            const depthTop = ground2 - topEnd;
            const depthBottom = ground2 - bottomEnd;

            // 수렴점: 왼쪽 시추공에서 같은 깊이의 표고 (지표면 아래로 제한)
            let convergenceElev;
            if (belowTop1 !== null && belowTop1 !== undefined &&
                aboveBottom1 !== null && aboveBottom1 !== undefined) {
                convergenceElev = (belowTop1 + aboveBottom1) / 2;
            } else if (belowTop1 !== null && belowTop1 !== undefined) {
                convergenceElev = belowTop1;
            } else if (aboveBottom1 !== null && aboveBottom1 !== undefined) {
                convergenceElev = aboveBottom1;
            } else {
                // 같은 깊이 기반 (지층 중심 깊이)
                const midDepth = (depthTop + depthBottom) / 2;
                convergenceElev = ground1 - midDepth;
            }

            // 수렴점이 지표면 위로 나가지 않도록 제한
            convergenceElev = Math.min(convergenceElev, ground1 - 0.1);

            // 상단 경계 (좌→우): 수렴점에서 시작하여 두께가 점점 늘어남
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3); // ease-in

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * smoothT;

                // 깊이 기반 보간: 왼쪽 수렴점 깊이 → 오른쪽 지층 깊이
                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                const topElev = Math.min(currentMidElev + currentThickness / 2, groundLevel - 0.05);

                polyX.push(dist);
                polyY.push(topElev);
            }

            // 하단 경계 (우→좌)
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3);

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * smoothT;

                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        }
        polyX.push(polyX[0]);
        polyY.push(polyY[0]);
        return { polyX, polyY };
    }

    // 가상 지층 찾기
    function findVirtualLayer(allPoints, distances, layerSoilType, currentSegIdx) {
        let leftPt = null, leftLayer = null, leftDist = null;
        for (let i = currentSegIdx - 1; i >= 0; i--) {
            const layer = allPoints[i].layers.find(l => l.soilType === layerSoilType);
            if (layer) {
                leftPt = allPoints[i];
                leftLayer = layer;
                leftDist = distances[i];
                break;
            }
        }

        let rightPt = null, rightLayer = null, rightDist = null;
        for (let i = currentSegIdx + 2; i < allPoints.length; i++) {
            const layer = allPoints[i].layers.find(l => l.soilType === layerSoilType);
            if (layer) {
                rightPt = allPoints[i];
                rightLayer = layer;
                rightDist = distances[i];
                break;
            }
        }

        return { leftPt, leftLayer, leftDist, rightPt, rightLayer, rightDist };
    }

    // 가상 레이어 폴리곤 생성
    function createVirtualLayerPolygon(dist1, dist2, leftPt, leftLayer, leftDist, rightPt, rightLayer, rightDist, ground1, ground2, numPoints) {
        if (!leftPt || !rightPt || !leftLayer || !rightLayer) return null;

        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;
        const totalDist = rightDist - leftDist;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const globalT = (dist - leftDist) / totalDist;
            const smoothT = globalT * globalT * (3 - 2 * globalT);

            const leftDepthTop = leftPt.groundElevation - leftLayer.elevationTop;
            const leftDepthBottom = leftPt.groundElevation - leftLayer.elevationBottom;
            const rightDepthTop = rightPt.groundElevation - rightLayer.elevationTop;
            const rightDepthBottom = rightPt.groundElevation - rightLayer.elevationBottom;

            const interpDepthTop = leftDepthTop + smoothT * (rightDepthTop - leftDepthTop);
            const interpDepthBottom = leftDepthBottom + smoothT * (rightDepthBottom - leftDepthBottom);
            const groundLevel = ground1 + t * (ground2 - ground1);

            let topElev = groundLevel - interpDepthTop;
            let bottomElev = groundLevel - interpDepthBottom;

            const thickness = topElev - bottomElev;
            if (thickness < MIN_VISUAL_THICKNESS && thickness > 0) {
                const center = (topElev + bottomElev) / 2;
                topElev = center + MIN_VISUAL_THICKNESS / 2;
                bottomElev = center - MIN_VISUAL_THICKNESS / 2;
            }

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        const polyY = [...topY, ...bottomY.reverse()];
        const fullPolyX = [...polyX, ...polyX.slice().reverse()];
        fullPolyX.push(fullPolyX[0]);
        polyY.push(polyY[0]);

        return { polyX: fullPolyX, polyY };
    }

    // 암반 연장 폴리곤 생성
    function createRockExtendPolygon(dist1, dist2, rockLayer, direction, numPoints, ground1, ground2, otherPtLayers, minElevation) {
        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;

        const rockGround = direction === 'right' ? ground1 : ground2;
        const otherGround = direction === 'right' ? ground2 : ground1;

        const rockDepthTop = rockGround - rockLayer.elevationTop;
        const rockThickness = rockLayer.elevationTop - rockLayer.elevationBottom;

        let otherBottomElev = otherGround - 15;
        if (otherPtLayers && otherPtLayers.length > 0) {
            const deepestLayer = otherPtLayers[otherPtLayers.length - 1];
            otherBottomElev = deepestLayer.elevationBottom;
        }

        const otherDepthTop = otherGround - otherBottomElev + 1.0;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const actualT = direction === 'right' ? t : (1 - t);
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = actualT * actualT * (3 - 2 * actualT);

            const groundLevel = ground1 + t * (ground2 - ground1);
            const interpDepthTop = rockDepthTop + smoothT * (otherDepthTop - rockDepthTop);
            const thicknessFactor = 1 - smoothT * 0.3;
            const interpThickness = Math.max(MIN_VISUAL_THICKNESS, rockThickness * thicknessFactor);

            const topElev = groundLevel - interpDepthTop;
            const bottomElev = Math.max(minElevation, topElev - interpThickness);

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        const polyYResult = [...topY, ...bottomY.slice().reverse()];
        polyX.push(...polyX.slice().reverse());
        polyX.push(polyX[0]);
        polyYResult.push(polyYResult[0]);

        return { polyX, polyY: polyYResult };
    }

    // 암반 전이 폴리곤
    function createRockTransitionPolygon(dist1, dist2, l1, l2, numPoints, ground1, ground2) {
        const polyX = [], topY = [], bottomY = [];
        const MIN_VISUAL_THICKNESS = 0.3;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t);

            const groundLevel = ground1 + smoothT * (ground2 - ground1);
            const depth1Top = ground1 - l1.elevationTop;
            const depth1Bottom = ground1 - l1.elevationBottom;
            const depth2Top = ground2 - l2.elevationTop;
            const depth2Bottom = ground2 - l2.elevationBottom;

            const interpDepthTop = depth1Top + smoothT * (depth2Top - depth1Top);
            const interpDepthBottom = depth1Bottom + smoothT * (depth2Bottom - depth1Bottom);

            let topElev = groundLevel - interpDepthTop;
            let bottomElev = groundLevel - interpDepthBottom;

            const thickness = topElev - bottomElev;
            if (thickness < MIN_VISUAL_THICKNESS && thickness > 0) {
                const center = (topElev + bottomElev) / 2;
                topElev = center + MIN_VISUAL_THICKNESS / 2;
                bottomElev = center - MIN_VISUAL_THICKNESS / 2;
            }

            polyX.push(dist);
            topY.push(topElev);
            bottomY.push(bottomElev);
        }

        const polyYResult = [...topY, ...bottomY.slice().reverse()];
        const fullPolyX = [...polyX, ...polyX.slice().reverse()];
        fullPolyX.push(fullPolyX[0]);
        polyYResult.push(polyYResult[0]);

        return { polyX: fullPolyX, polyY: polyYResult };
    }

    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        if (pt1.layers.length === 0 && pt2.layers.length === 0) continue;

        const matches = matchLayersHybrid(pt1.layers, pt2.layers);

        matches.forEach((match) => {
            const { l1, l2, matchType } = match;
            let polyX, polyY, fillColor, layerLabel, lineStyle;

            if (matchType === 'same') {
                const result = createResampledPolygon(dist1, dist2, l1.elevationTop, l1.elevationBottom, l2.elevationTop, l2.elevationBottom, segmentPoints, pt1.groundElevation, pt2.groundElevation);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = l1.color;
                layerLabel = l1.soilName;
                lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
            } else if (matchType === 'elevation') {
                const result = createResampledPolygon(dist1, dist2, l1.elevationTop, l1.elevationBottom, l2.elevationTop, l2.elevationBottom, segmentPoints, pt1.groundElevation, pt2.groundElevation);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = blendColors(l1.color, l2.color, 0.5);
                layerLabel = `${l1.soilName} → ${l2.soilName}`;
                lineStyle = { color: 'rgba(0,0,0,0.5)', width: 1, dash: 'dot' };
            } else if (matchType === 'wedge-out') {
                // 먼저 더 먼 시추공에서 연결 가능한 레이어 찾기
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l1.soilType, segIdx);

                if (virtual.rightPt && virtual.rightLayer) {
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        pt1, l1, dist1,
                        virtual.rightPt, virtual.rightLayer, virtual.rightDist,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l1.color;
                        layerLabel = `${l1.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.2)', width: 0.3, dash: 'dot' };
                    }
                }

                if (!polyX) {
                    // 위/아래 지층의 경계를 찾아 빈틈 없이 연결
                    const l1Idx = pt1.layers.indexOf(l1);

                    // pt1에서 위 지층의 하단 경계
                    const aboveLayer1 = l1Idx > 0 ? pt1.layers[l1Idx - 1] : null;
                    const aboveBottom1 = aboveLayer1 ? aboveLayer1.elevationBottom : pt1.groundElevation;

                    // pt1에서 아래 지층의 상단 경계
                    const belowLayer1 = pt1.layers[l1Idx + 1];
                    const belowTop1 = belowLayer1 ? belowLayer1.elevationTop : l1.elevationBottom;

                    // pt2에서 위 지층의 하단 경계 (상단 목표점)
                    let aboveBottom2 = null;
                    const topDepth = pt1.groundElevation - l1.elevationTop;
                    for (let j = 0; j < pt2.layers.length; j++) {
                        const layerBottomDepth = pt2.groundElevation - pt2.layers[j].elevationBottom;
                        if (layerBottomDepth >= topDepth - 1) {
                            aboveBottom2 = pt2.layers[j].elevationBottom;
                            break;
                        }
                    }
                    if (aboveBottom2 === null) {
                        aboveBottom2 = pt2.groundElevation - topDepth;
                    }

                    // pt2에서 아래 지층의 상단 경계 (하단 목표점)
                    let belowTop2 = null;
                    const bottomDepth = pt1.groundElevation - l1.elevationBottom;
                    for (let j = 0; j < pt2.layers.length; j++) {
                        const layerTopDepth = pt2.groundElevation - pt2.layers[j].elevationTop;
                        if (layerTopDepth >= bottomDepth - 1) {
                            belowTop2 = pt2.layers[j].elevationTop;
                            break;
                        }
                    }
                    if (belowTop2 === null) {
                        belowTop2 = pt2.groundElevation - bottomDepth;
                    }

                    const result = createWedgeOutPolygon(dist1, dist2, l1, 'right', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l1.color;
                    layerLabel = `${l1.soilName} (소멸)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                }
            } else if (matchType === 'wedge-in') {
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l2.soilType, segIdx);

                if (virtual.leftPt && virtual.leftLayer) {
                    const result = createVirtualLayerPolygon(
                        dist1, dist2,
                        virtual.leftPt, virtual.leftLayer, virtual.leftDist,
                        pt2, l2, dist2,
                        pt1.groundElevation, pt2.groundElevation,
                        segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l2.color;
                        layerLabel = `${l2.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.2)', width: 0.3, dash: 'dot' };
                    }
                }

                if (!polyX) {
                    // 위/아래 지층의 경계를 찾아 빈틈 없이 연결
                    const l2Idx = pt2.layers.indexOf(l2);

                    // pt2에서 위 지층의 하단 경계
                    const aboveLayer2 = l2Idx > 0 ? pt2.layers[l2Idx - 1] : null;
                    const aboveBottom2 = aboveLayer2 ? aboveLayer2.elevationBottom : pt2.groundElevation;

                    // pt2에서 아래 지층의 상단 경계
                    const belowLayer2 = pt2.layers[l2Idx + 1];
                    const belowTop2 = belowLayer2 ? belowLayer2.elevationTop : l2.elevationBottom;

                    // pt1에서 위 지층의 하단 경계 (출발 상단)
                    let aboveBottom1 = null;
                    const topDepth = pt2.groundElevation - l2.elevationTop;
                    for (let j = 0; j < pt1.layers.length; j++) {
                        const layerBottomDepth = pt1.groundElevation - pt1.layers[j].elevationBottom;
                        if (layerBottomDepth >= topDepth - 1) {
                            aboveBottom1 = pt1.layers[j].elevationBottom;
                            break;
                        }
                    }
                    if (aboveBottom1 === null) {
                        aboveBottom1 = pt1.groundElevation - topDepth;
                    }

                    // pt1에서 아래 지층의 상단 경계 (출발 하단)
                    let belowTop1 = null;
                    const bottomDepth = pt2.groundElevation - l2.elevationBottom;
                    for (let j = 0; j < pt1.layers.length; j++) {
                        const layerTopDepth = pt1.groundElevation - pt1.layers[j].elevationTop;
                        if (layerTopDepth >= bottomDepth - 1) {
                            belowTop1 = pt1.layers[j].elevationTop;
                            break;
                        }
                    }
                    if (belowTop1 === null) {
                        belowTop1 = pt1.groundElevation - bottomDepth;
                    }

                    const result = createWedgeOutPolygon(dist1, dist2, l2, 'left', segmentPoints,
                        pt1.groundElevation, pt2.groundElevation,
                        aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l2.color;
                    layerLabel = `${l2.soilName} (출현)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                }

            } else if (matchType === 'rock-transition') {
                // 암반 계열 전이
                const result = createRockTransitionPolygon(dist1, dist2, l1, l2, segmentPoints, pt1.groundElevation, pt2.groundElevation);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = blendColors(l1.color, l2.color, 0.5);
                layerLabel = `${l1.soilName} → ${l2.soilName}`;
                lineStyle = { color: 'rgba(0,0,0,0.4)', width: 0.8, dash: 'dot' };

            } else if (matchType === 'rock-extend-out') {
                // 암반 연장 (오른쪽으로)
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l1.soilType, segIdx);

                if (virtual.rightPt && virtual.rightLayer) {
                    const result = createVirtualLayerPolygon(
                        dist1, dist2, pt1, l1, dist1,
                        virtual.rightPt, virtual.rightLayer, virtual.rightDist,
                        pt1.groundElevation, pt2.groundElevation, segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l1.color;
                        layerLabel = `${l1.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                    }
                }

                if (!polyX) {
                    const result = createRockExtendPolygon(dist1, dist2, l1, 'right', segmentPoints, pt1.groundElevation, pt2.groundElevation, pt2.layers, minElev);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l1.color;
                    layerLabel = `${l1.soilName} (연장)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };
                }

            } else if (matchType === 'rock-extend-in') {
                // 암반 연장 (왼쪽으로)
                const virtual = findVirtualLayer(selectedPointsData, cumulativeDistances, l2.soilType, segIdx);

                if (virtual.leftPt && virtual.leftLayer) {
                    const result = createVirtualLayerPolygon(
                        dist1, dist2, virtual.leftPt, virtual.leftLayer, virtual.leftDist,
                        pt2, l2, dist2,
                        pt1.groundElevation, pt2.groundElevation, segmentPoints
                    );
                    if (result) {
                        polyX = result.polyX;
                        polyY = result.polyY;
                        fillColor = l2.color;
                        layerLabel = `${l2.soilName} (연속)`;
                        lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5 };
                    }
                }

                if (!polyX) {
                    const result = createRockExtendPolygon(dist1, dist2, l2, 'left', segmentPoints, pt1.groundElevation, pt2.groundElevation, pt1.layers, minElev);
                    polyX = result.polyX;
                    polyY = result.polyY;
                    fillColor = l2.color;
                    layerLabel = `${l2.soilName} (연장)`;
                    lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };
                }
            }

            if (polyX && polyY && polyX.length > 3) {
                traces.push({
                    x: polyX,
                    y: polyY,
                    fill: 'toself',
                    fillcolor: fillColor,
                    line: lineStyle,
                    mode: 'lines',
                    showlegend: false,
                    hoverinfo: 'text',
                    text: layerLabel,
                    hoverlabel: { bgcolor: 'rgba(255,255,255,0.95)', font: { size: 12, color: '#333' }, bordercolor: fillColor }
                });
            }
        });
    }

    // 시추공 기둥
    const columnWidth = Math.max(8, Math.min(20, maxDist * 0.03));
    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];
        pt.layers.forEach(layer => {
            traces.push({
                x: [dist - columnWidth/2, dist + columnWidth/2, dist + columnWidth/2, dist - columnWidth/2, dist - columnWidth/2],
                y: [layer.elevationTop, layer.elevationTop, layer.elevationBottom, layer.elevationBottom, layer.elevationTop],
                fill: 'toself',
                fillcolor: layer.color,
                line: { color: '#222', width: 1.5 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'text',
                text: `<b>${layer.soilName}</b><br>심도: ${layer.depthStart.toFixed(1)}~${layer.depthEnd.toFixed(1)}m<br>표고: EL.${layer.elevationTop.toFixed(1)}~${layer.elevationBottom.toFixed(1)}m`,
                hoverlabel: { bgcolor: 'rgba(255,255,255,0.95)', font: { size: 12, color: '#333' }, bordercolor: layer.color }
            });
        });
    });

    // 굴착면 레벨 선 추가
    const excavationX = [];
    const excavationY = [];
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t);
            const elev = pt1.excavationLevel + smoothT * (pt2.excavationLevel - pt1.excavationLevel);
            excavationX.push(dist);
            excavationY.push(elev);
        }
    }

    traces.push({
        x: excavationX,
        y: excavationY,
        mode: 'lines',
        line: { color: '#FF5722', width: 3, dash: 'dash' },
        name: '굴착면 레벨',
        hoverinfo: 'y'
    });

    // 시추공 위치 마커
    selectedPointsData.forEach((pt, idx) => {
        const dist = cumulativeDistances[idx];
        const bottomElev = pt.layers.length > 0 ? pt.layers[pt.layers.length - 1].elevationBottom : pt.groundElevation - pt.totalDepth;

        traces.push({
            x: [dist, dist],
            y: [pt.groundElevation, bottomElev],
            mode: 'lines',
            line: { color: '#D32F2F', width: 2 },
            showlegend: false,
            hoverinfo: 'skip'
        });

        traces.push({
            x: [dist],
            y: [pt.groundElevation],
            mode: 'markers',
            marker: { size: 10, color: '#D32F2F', symbol: 'triangle-down', line: { color: 'white', width: 1 } },
            showlegend: false,
            hoverinfo: 'text',
            text: `${pt.holeNo}<br>지표고: EL.${pt.groundElevation.toFixed(2)}m<br>굴착면: EL.${pt.excavationLevel.toFixed(2)}m`
        });
    });

    // 범례
    const sortedSoilTypes = Array.from(allSoilTypes.values()).sort((a, b) => b.order - a.order);
    sortedSoilTypes.forEach(soilType => {
        traces.push({
            x: [null],
            y: [null],
            mode: 'markers',
            marker: { size: 12, color: soilType.color, symbol: 'square', line: { color: '#333', width: 1 } },
            name: soilType.label,
            showlegend: true,
            hoverinfo: 'skip'
        });
    });

    // annotations
    const annotations = selectedPointsData.map((pt, idx) => ({
        x: cumulativeDistances[idx],
        y: pt.groundElevation + (maxElev - minElev) * 0.08,
        text: `<b>${pt.holeNo}</b><br><span style="font-size:10px">EL.${pt.groundElevation.toFixed(1)}m</span>`,
        showarrow: true,
        arrowhead: 0,
        arrowsize: 0.5,
        arrowwidth: 1,
        arrowcolor: '#666',
        ax: 0,
        ay: -30,
        font: { size: 11, color: '#455A64' },
        bgcolor: 'rgba(255,255,255,0.9)',
        bordercolor: '#455A64',
        borderwidth: 1,
        borderpad: 4
    }));

    const layout = {
        title: { text: '지반 단면도', font: { size: 16, color: '#455A64' }, y: 0.98 },
        xaxis: {
            title: { text: '거리 (m)', font: { size: 12 } },
            range: [-maxDist * 0.05, maxDist * 1.05],
            showgrid: true,
            gridcolor: '#e0e0e0'
        },
        yaxis: {
            title: { text: '표고 (E.L. m)', font: { size: 12 } },
            range: [minElev, maxElev + (maxElev - minElev) * 0.25],
            showgrid: true,
            gridcolor: '#e0e0e0'
        },
        margin: { l: 60, r: 20, b: 50, t: 80 },
        hovermode: 'closest',
        showlegend: true,
        legend: { orientation: 'h', y: 1.02, x: 0.5, xanchor: 'center', font: { size: 9 } },
        plot_bgcolor: '#FAFAFA',
        paper_bgcolor: 'white',
        annotations: annotations
    };

    Plotly.newPlot('drawingCrossSectionPlot', traces, layout, { responsive: true, displayModeBar: true, scrollZoom: true });
}

// ==================== 수동 배치 모드 함수 ====================

// 모드 전환
function switchPlacementMode(mode) {
    placementMode = mode;

    const calibSection = document.getElementById('calibModeSection');
    const manualSection = document.getElementById('manualModeSection');
    const tabCalib = document.getElementById('tabCalibMode');
    const tabManual = document.getElementById('tabManualMode');

    if (mode === 'calib') {
        if (calibSection) calibSection.style.display = 'block';
        if (manualSection) manualSection.style.display = 'none';
        if (tabCalib) { tabCalib.classList.remove('btn-secondary'); tabCalib.classList.add('btn-primary'); }
        if (tabManual) { tabManual.classList.remove('btn-primary'); tabManual.classList.add('btn-secondary'); }
    } else {
        if (calibSection) calibSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'block';
        if (tabCalib) { tabCalib.classList.remove('btn-primary'); tabCalib.classList.add('btn-secondary'); }
        if (tabManual) { tabManual.classList.remove('btn-secondary'); tabManual.classList.add('btn-primary'); }

        // 수동 배치용 시추공 선택기 업데이트
        updateManualBoreholeSelector();

        // 다중 시추공 분석 컨트롤 표시 (배치된 시추공이 있으면)
        const crossSectionControls = document.getElementById('drawingCrossSectionControls');
        if (crossSectionControls && manualPlacements.length >= 2) {
            crossSectionControls.style.display = 'block';
        }
    }

    // 기준점 선택 모드 초기화
    selectingRefPoint = 0;
    updateRefPointButtons();

    updateOverlayCanvas();
}

// 수동 배치용 시추공 선택기 업데이트
function updateManualBoreholeSelector() {
    const selector = document.getElementById('manualBoreholeSelector');
    if (!selector) return;

    selector.innerHTML = '<option value="">배치할 시추공 선택...</option>';

    if (boreholeData && boreholeData.length > 0) {
        boreholeData.forEach(bh => {
            // 이미 배치된 시추공은 제외
            const alreadyPlaced = manualPlacements.some(mp => mp.holeNo === bh.holeNo);
            if (!alreadyPlaced) {
                const option = document.createElement('option');
                option.value = bh.holeNo;
                // 좌표가 없는 시추공 표시
                const hasCoords = bh.x !== undefined && bh.y !== undefined && bh.x !== 0 && bh.y !== 0;
                option.textContent = hasCoords ? bh.holeNo : `${bh.holeNo} (좌표 없음)`;
                if (!hasCoords) {
                    option.style.color = '#E65100';
                    option.style.fontWeight = 'bold';
                }
                selector.appendChild(option);
            }
        });
    }
}

// 기준점 선택 시작
function startRefPointSelection(pointNum) {
    selectingRefPoint = pointNum;
    updateRefPointButtons();

    // 안내 메시지
    alert(`도면에서 기준점 ${pointNum}의 위치를 클릭하세요.`);
}

// 기준점 버튼 상태 업데이트
function updateRefPointButtons() {
    const btn1 = document.getElementById('btnSetRefPoint1');
    const btn2 = document.getElementById('btnSetRefPoint2');
    const refPointInputs = document.getElementById('refPointInputs');
    const refPoint1Inputs = document.getElementById('refPoint1Inputs');
    const refPoint2Inputs = document.getElementById('refPoint2Inputs');

    if (btn1) {
        if (selectingRefPoint === 1) {
            btn1.textContent = '클릭 대기중...';
            btn1.style.background = '#FF9800';
        } else if (referencePoints.length >= 1 && referencePoints[0]) {
            btn1.textContent = '기준점 1 ✓';
            btn1.style.background = '#4CAF50';
        } else {
            btn1.textContent = '기준점 1';
            btn1.style.background = '';
        }
    }

    if (btn2) {
        if (selectingRefPoint === 2) {
            btn2.textContent = '클릭 대기중...';
            btn2.style.background = '#FF9800';
        } else if (referencePoints.length >= 2 && referencePoints[1]) {
            btn2.textContent = '기준점 2 ✓';
            btn2.style.background = '#4CAF50';
        } else {
            btn2.textContent = '기준점 2';
            btn2.style.background = '';
        }
    }

    // 기준점이 설정되면 좌표 입력 필드 표시
    if (refPointInputs) {
        if (referencePoints.length > 0) {
            refPointInputs.style.display = 'block';
        }
    }

    if (refPoint1Inputs && referencePoints.length >= 1 && referencePoints[0]) {
        refPoint1Inputs.style.display = 'block';
    }

    if (refPoint2Inputs && referencePoints.length >= 2 && referencePoints[1]) {
        refPoint2Inputs.style.display = 'block';
    }
}

// 기준점 클릭 처리
function handleReferencePointClick(canvasX, canvasY) {
    if (selectingRefPoint === 0) return;

    const pointIndex = selectingRefPoint - 1;

    // referencePoints 배열 초기화
    while (referencePoints.length <= pointIndex) {
        referencePoints.push(null);
    }

    referencePoints[pointIndex] = {
        pixelX: canvasX,
        pixelY: canvasY,
        geoX: null,
        geoY: null
    };

    selectingRefPoint = 0;
    updateRefPointButtons();
    updateOverlayCanvas();
}

// 기준점 좌표 적용
function applyReferencePoints() {
    const ref1X = parseFloat(document.getElementById('refPoint1X')?.value);
    const ref1Y = parseFloat(document.getElementById('refPoint1Y')?.value);
    const ref2X = parseFloat(document.getElementById('refPoint2X')?.value);
    const ref2Y = parseFloat(document.getElementById('refPoint2Y')?.value);

    if (referencePoints.length >= 1 && referencePoints[0]) {
        if (!isNaN(ref1X) && !isNaN(ref1Y)) {
            referencePoints[0].geoX = ref1X;
            referencePoints[0].geoY = ref1Y;
        }
    }

    if (referencePoints.length >= 2 && referencePoints[1]) {
        if (!isNaN(ref2X) && !isNaN(ref2Y)) {
            referencePoints[1].geoX = ref2X;
            referencePoints[1].geoY = ref2Y;
        }
    }

    // 두 기준점이 모두 설정되면 변환 행렬 계산
    if (referencePoints.length >= 2 &&
        referencePoints[0] && referencePoints[1] &&
        referencePoints[0].geoX !== null && referencePoints[1].geoX !== null) {
        calculateManualTransformMatrix();

        // 기존 배치된 시추공들의 좌표 재계산
        recalculateManualPlacementCoordinates();

        alert('기준점이 적용되었습니다. 배치된 시추공의 좌표가 자동 계산됩니다.');
    } else {
        alert('기준점 좌표가 저장되었습니다. 두 기준점 모두 설정하면 좌표 변환이 활성화됩니다.');
    }

    updateOverlayCanvas();
}

// 수동 변환 행렬 계산 (2점 기반 스케일 + 회전)
function calculateManualTransformMatrix() {
    if (referencePoints.length < 2 || !referencePoints[0] || !referencePoints[1]) return;

    const p1 = referencePoints[0];
    const p2 = referencePoints[1];

    if (p1.geoX === null || p2.geoX === null) return;

    // 픽셀 거리와 지리 거리 계산
    const pixelDist = Math.sqrt(
        Math.pow(p2.pixelX - p1.pixelX, 2) +
        Math.pow(p2.pixelY - p1.pixelY, 2)
    );

    const geoDist = Math.sqrt(
        Math.pow(p2.geoX - p1.geoX, 2) +
        Math.pow(p2.geoY - p1.geoY, 2)
    );

    if (pixelDist < 0.001 || geoDist < 0.001) return;

    // 스케일 계산
    const scale = geoDist / pixelDist;

    // ✅ 회전각 계산 - Y축 반전 적용 (캔버스 Y는 아래로 증가, 지리 Y는 위로 증가)
    const pixelAngle = Math.atan2(-(p2.pixelY - p1.pixelY), p2.pixelX - p1.pixelX);  // Y축 반전
    const geoAngle = Math.atan2(p2.geoY - p1.geoY, p2.geoX - p1.geoX);
    const rotation = geoAngle - pixelAngle;
    
    console.log('📐 변환 행렬 계산:', {
        pixelAngle: (pixelAngle * 180 / Math.PI).toFixed(1) + '°',
        geoAngle: (geoAngle * 180 / Math.PI).toFixed(1) + '°',
        rotation: (rotation * 180 / Math.PI).toFixed(1) + '°',
        scale: scale.toFixed(4)
    });

    manualTransformMatrix = {
        scale: scale,
        rotation: rotation,
        refPixel: { x: p1.pixelX, y: p1.pixelY },
        refGeo: { x: p1.geoX, y: p1.geoY }
    };
}

// 픽셀 좌표를 지리 좌표로 변환 (수동 배치용)
function pixelToGeoManual(pixelX, pixelY) {
    if (!manualTransformMatrix) return { x: 0, y: 0 };

    const dx = pixelX - manualTransformMatrix.refPixel.x;
    // ✅ Y축 반전 적용 (캔버스 Y↓ → TM 좌표 Y↑)
    const dy = -(pixelY - manualTransformMatrix.refPixel.y);

    // 회전 적용
    const cos = Math.cos(manualTransformMatrix.rotation);
    const sin = Math.sin(manualTransformMatrix.rotation);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // 스케일 적용
    const geoX = manualTransformMatrix.refGeo.x + rotatedX * manualTransformMatrix.scale;
    const geoY = manualTransformMatrix.refGeo.y + rotatedY * manualTransformMatrix.scale;

    return { x: geoX, y: geoY };
}

// 배치된 시추공 좌표 재계산
function recalculateManualPlacementCoordinates() {
    if (!manualTransformMatrix) return;

    manualPlacements.forEach(mp => {
        const geo = pixelToGeoManual(mp.pixelX, mp.pixelY);
        mp.geoX = geo.x;
        mp.geoY = geo.y;
    });

    updateManualPlacedList();
}

// 수동 배치 처리
function handleManualPlacement(canvasX, canvasY) {
    // 선택된 시추공 또는 새 이름 확인
    const selector = document.getElementById('manualBoreholeSelector');
    const newNameInput = document.getElementById('newBoreholeNameInput');

    let holeNo = selector?.value || '';
    let isNew = false;

    // 새 시추공 이름이 입력된 경우
    if (!holeNo && newNameInput?.value.trim()) {
        holeNo = newNameInput.value.trim();
        isNew = true;

        // 중복 체크
        const exists = boreholeData.some(bh => bh.holeNo === holeNo);
        const alreadyPlaced = manualPlacements.some(mp => mp.holeNo === holeNo);

        if (exists) {
            alert(`${holeNo}는 이미 존재하는 시추공입니다. 기존 시추공을 선택하거나 다른 이름을 입력하세요.`);
            return;
        }

        if (alreadyPlaced) {
            alert(`${holeNo}는 이미 배치되어 있습니다.`);
            return;
        }
    }

    if (!holeNo) {
        // 시추공이 선택되지 않은 경우 조용히 무시 (드래그 중일 수 있음)
        return;
    }

    // ✅ 좌표 계산 개선
    let geoX = 0, geoY = 0;
    let coordinateType = 'pixel'; // 'pixel' 또는 'geo'
    
    if (manualTransformMatrix) {
        // 기준점이 설정되어 있으면 실제 좌표로 변환
        const geo = pixelToGeoManual(canvasX, canvasY);
        geoX = geo.x;
        geoY = geo.y;
        coordinateType = 'geo';
        console.log(`✅ 시추공 ${holeNo}: 실제 좌표로 변환 (${geoX.toFixed(1)}, ${geoY.toFixed(1)})`);
    } else {
        // ✅ 기준점이 없으면 기존 시추공 좌표 범위를 참조하여 상대 좌표 계산
        if (boreholeData && boreholeData.length > 0) {
            // 기존 시추공 좌표 범위 계산
            const existingWithCoords = boreholeData.filter(bh => 
                bh.x !== undefined && bh.y !== undefined && 
                !isNaN(parseFloat(bh.x)) && !isNaN(parseFloat(bh.y)) &&
                Math.abs(parseFloat(bh.x)) > 1000 && Math.abs(parseFloat(bh.y)) > 1000 // 합리적인 TM 좌표 범위
            );
            
            if (existingWithCoords.length > 0) {
                // 기존 시추공 중심 좌표 계산
                const avgX = existingWithCoords.reduce((sum, bh) => sum + parseFloat(bh.x), 0) / existingWithCoords.length;
                const avgY = existingWithCoords.reduce((sum, bh) => sum + parseFloat(bh.y), 0) / existingWithCoords.length;
                
                // 도면 크기 기준 스케일 추정 (픽셀 -> 미터, 기본 1:100)
                const canvas = document.getElementById('pdfCanvas');
                const canvasWidth = canvas ? canvas.width : 1000;
                const canvasHeight = canvas ? canvas.height : 1000;
                
                // 도면 중심 기준 상대 좌표 계산
                const offsetX = (canvasX - canvasWidth / 2);
                const offsetY = (canvasHeight / 2 - canvasY); // Y축 반전
                
                geoX = avgX + offsetX;
                geoY = avgY + offsetY;
                coordinateType = 'relative';
                
                console.log(`📍 시추공 ${holeNo}: 상대 좌표로 계산 (기준: ${avgX.toFixed(0)}, ${avgY.toFixed(0)})`);
            } else {
                // 기존 좌표 없으면 픽셀 좌표 그대로 사용 (후에 기준점 설정 필요)
                geoX = canvasX;
                geoY = canvasY;
                coordinateType = 'pixel';
                console.warn(`⚠️ 시추공 ${holeNo}: 기준점 없음, 픽셀 좌표 사용 (배치 적용 전 기준점 설정 권장)`);
            }
        } else {
            geoX = canvasX;
            geoY = canvasY;
            coordinateType = 'pixel';
        }
    }

    // 배치 정보 추가
    manualPlacements.push({
        holeNo: holeNo,
        pixelX: canvasX,
        pixelY: canvasY,
        geoX: geoX,
        geoY: geoY,
        isNew: isNew
    });

    // UI 업데이트
    updateManualPlacedList();
    updateManualBoreholeSelector();

    // 입력 필드 초기화
    if (selector) selector.value = '';
    if (newNameInput) newNameInput.value = '';

    updateOverlayCanvas();
}

// 배치된 시추공 목록 업데이트
function updateManualPlacedList() {
    const list = document.getElementById('manualPlacedList');
    const countSpan = document.getElementById('manualPlacedCount');

    if (countSpan) {
        countSpan.textContent = manualPlacements.length;
    }

    if (!list) return;

    list.innerHTML = '';

    manualPlacements.forEach((mp, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 6px 8px; margin-bottom: 4px; background: #E8F5E9; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';

        const coordText = manualTransformMatrix ?
            `(${mp.geoX.toFixed(1)}, ${mp.geoY.toFixed(1)})` :
            '(좌표 미설정)';

        div.innerHTML = `
            <span style="font-size: 11px;">
                <strong>${mp.holeNo}</strong>
                ${mp.isNew ? '<span style="color: #E65100; font-size: 9px;">(신규)</span>' : ''}
                <br><span style="color: #666; font-size: 9px;">${coordText}</span>
            </span>
            <button onclick="removeManualPlacement(${idx})" style="border: none; background: #ffebee; color: #c62828; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 3px;">삭제</button>
        `;
        list.appendChild(div);
    });
}

// 배치된 시추공 제거
function removeManualPlacement(index) {
    manualPlacements.splice(index, 1);
    updateManualPlacedList();
    updateManualBoreholeSelector();
    updateOverlayCanvas();
}

// 전체 수동 배치 초기화
function clearManualPlacements() {
    if (manualPlacements.length === 0) return;

    if (confirm('모든 수동 배치를 초기화하시겠습니까?')) {
        manualPlacements = [];
        referencePoints = [];
        manualTransformMatrix = null;
        selectingRefPoint = 0;

        // UI 초기화
        document.getElementById('refPoint1X').value = '';
        document.getElementById('refPoint1Y').value = '';
        document.getElementById('refPoint2X').value = '';
        document.getElementById('refPoint2Y').value = '';
        document.getElementById('refPointInputs').style.display = 'none';
        document.getElementById('refPoint1Inputs').style.display = 'none';
        document.getElementById('refPoint2Inputs').style.display = 'none';

        updateRefPointButtons();
        updateManualPlacedList();
        updateManualBoreholeSelector();
        updateOverlayCanvas();
    }
}

// 수동 배치 적용 (boreholeData에 반영)
function applyManualPlacements() {
    if (manualPlacements.length === 0) {
        alert('배치된 시추공이 없습니다.');
        return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    manualPlacements.forEach(mp => {
        // 기존 시추공 업데이트 또는 새 시추공 추가
        const existingIndex = boreholeData.findIndex(bh => bh.holeNo === mp.holeNo);

        if (existingIndex >= 0) {
            // ✅ 기존 시추공 좌표 업데이트 (수동 배치된 좌표만 사용, 원래 좌표 제거)
            console.log(`🔄 기존 시추공 ${mp.holeNo} 좌표 업데이트:`, {
                oldCoords: { x: boreholeData[existingIndex].x, y: boreholeData[existingIndex].y },
                newCoords: { x: mp.geoX, y: mp.geoY }
            });
            boreholeData[existingIndex].x = mp.geoX;
            boreholeData[existingIndex].y = mp.geoY;
            boreholeData[existingIndex].manuallyPlaced = true;
            updatedCount++;
        } else if (mp.isNew) {
            // 새 시추공 추가 (필수 정보 포함)
            const newBorehole = {
                holeNo: mp.holeNo,
                x: mp.geoX,
                y: mp.geoY,
                groundElevation: 100,      // ✅ 기본값 명확히
                totalDepth: 10,            // ✅ 기본값 명확히
                boreholeEndElevation: 90,  // ✅ 추가
                waterTableElevation: null,
                bedrockTopElevation: null,
                weatheredRockElevation: null,
                softRockPlusElevation: null,
                excavationLevelInput: null,
                // ✅ 최소 1개 토층 정보 추가 (마커 색상 판정을 위해 필수)
                soilData: [{
                    depth_from: 0,
                    depth_to: 10,
                    soil_name: '미분류',
                    description: '수동 배치 시추공'
                }],
                // ✅ 메타데이터 추가
                metadata: { 
                    manuallyAdded: true,
                    addedDate: new Date().toISOString()
                },
                manuallyPlaced: true,
                isNewManual: true,
                notes: '수동 배치 시추공 - 정보 입력 필요'
            };
            
            // 🔴 검증: 필수 필드 확인
            if (!newBorehole.holeNo || !newBorehole.soilData || newBorehole.soilData.length === 0) {
                console.warn(`⚠️ 시추공 ${mp.holeNo}의 필수 정보가 불완전합니다`);
            }
            
            boreholeData.push(newBorehole);
            addedCount++;
            
            console.log(`✅ 새 시추공 추가: ${mp.holeNo}`, newBorehole);
        }
    });

    // 시각화 데이터 재생성
    generateVisualizationData();

    // 등고선/3D 업데이트
    updateContourMap();
    if (document.getElementById('visualization3d')?.style.display !== 'none') {
        update3DVisualization();
    }

    // 데이터 테이블 업데이트
    renderBoreholeDataTable();

    // 수동 배치용 변환 행렬을 캘리브레이션으로 전환
    if (manualPlacements.length >= 3) {
        // 3개 이상의 배치된 시추공으로 정식 캘리브레이션 생성
        createCalibrationFromManualPlacements();
    } else if (manualPlacements.length >= 2) {
        // 2개인 경우에도 변환 행렬 생성
        createSimpleTransformFromManualPlacements();
    } else if (manualPlacements.length === 1) {
        // 1개인 경우 단순 좌표 매핑 (스케일 1:1)
        createSinglePointTransform();
    }

    // 굴착면 레벨 편집 섹션 표시
    const excavationSection = document.getElementById('excavationLevelEditSection');
    if (excavationSection) excavationSection.style.display = 'block';

    // 다중 시추공 분석 컨트롤 표시
    const crossSectionControls = document.getElementById('drawingCrossSectionControls');
    if (crossSectionControls) crossSectionControls.style.display = 'block';

    populateExcavationLevelEditList();

    // 좌표 매칭 모드로 자동 전환 (수동 배치 적용 완료 후)
    switchPlacementMode('calib');

    let message = '배치가 적용되었습니다.';
    if (updatedCount > 0) message += `\n- ${updatedCount}개 시추공 좌표 업데이트`;
    if (addedCount > 0) message += `\n- ${addedCount}개 새 시추공 추가`;
    message += '\n\n등고선 맵 표시, 구름 영역, 굴착면 편집 등 모든 기능을 사용할 수 있습니다.';

    alert(message);

    updateOverlayCanvas();
}

// 수동 배치에서 캘리브레이션 생성
function createCalibrationFromManualPlacements() {
    if (manualPlacements.length < 3) return;

    // 처음 3개의 배치 사용
    calibrationPoints = manualPlacements.slice(0, 3).map(mp => ({
        hole_no: mp.holeNo,
        pixelX: mp.pixelX,
        pixelY: mp.pixelY,
        geoX: mp.geoX,
        geoY: mp.geoY
    }));

    // 캘리브레이션 적용
    applyCalibration();
}

// 2개 시추공으로 간소화된 변환 행렬 생성
function createSimpleTransformFromManualPlacements() {
    if (manualPlacements.length < 2) return;

    // ✅ 기존 시추공의 원래 좌표를 우선 사용
    const getOriginalGeoCoords = (mp) => {
        // 새 시추공이 아닌 경우, boreholeData에서 원래 좌표 검색
        if (!mp.isNew) {
            const original = boreholeData.find(bh => bh.holeNo === mp.holeNo);
            if (original && original.x && original.y && 
                !original.manuallyPlaced && 
                Math.abs(parseFloat(original.x)) > 10000) {
                console.log(`📍 ${mp.holeNo}: 원본 좌표 사용 (${original.x}, ${original.y})`);
                return { geoX: parseFloat(original.x), geoY: parseFloat(original.y) };
            }
        }
        // 원래 좌표가 없으면 현재 geoX, geoY 사용
        return { geoX: mp.geoX, geoY: mp.geoY };
    };

    const coords1 = getOriginalGeoCoords(manualPlacements[0]);
    const coords2 = getOriginalGeoCoords(manualPlacements[1]);
    
    const p1 = { ...manualPlacements[0], geoX: coords1.geoX, geoY: coords1.geoY };
    const p2 = { ...manualPlacements[1], geoX: coords2.geoX, geoY: coords2.geoY };

    // 스케일과 회전 계산
    const pixelDist = Math.sqrt(Math.pow(p2.pixelX - p1.pixelX, 2) + Math.pow(p2.pixelY - p1.pixelY, 2));
    const geoDist = Math.sqrt(Math.pow(p2.geoX - p1.geoX, 2) + Math.pow(p2.geoY - p1.geoY, 2));
    
    console.log('📐 변환 행렬 계산:', {
        p1: { pixel: `(${p1.pixelX}, ${p1.pixelY})`, geo: `(${p1.geoX}, ${p1.geoY})` },
        p2: { pixel: `(${p2.pixelX}, ${p2.pixelY})`, geo: `(${p2.geoX}, ${p2.geoY})` },
        pixelDist, geoDist
    });

    // 거리가 0인 경우 기본 스케일 사용
    let scale = 1;
    let rotation = 0;

    if (pixelDist > 0.001 && geoDist > 0.001) {
        scale = geoDist / pixelDist;
        const pixelAngle = Math.atan2(p2.pixelY - p1.pixelY, p2.pixelX - p1.pixelX);
        const geoAngle = Math.atan2(p2.geoY - p1.geoY, p2.geoX - p1.geoX);
        rotation = geoAngle - pixelAngle;
    }

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // 아핀 변환 행렬 계산: [a, b, c, d, e, f]
    // u = a*x + b*y + c, v = d*x + e*y + f (Geo -> Pixel)
    // 역변환 필요: Pixel -> Geo
    const a_inv = cos * scale;
    const b_inv = -sin * scale;
    const d_inv = sin * scale;
    const e_inv = cos * scale;

    // c_inv, f_inv 계산 (p1을 기준점으로)
    const c_inv = p1.geoX - (a_inv * p1.pixelX + b_inv * p1.pixelY);
    const f_inv = p1.geoY - (d_inv * p1.pixelX + e_inv * p1.pixelY);

    // Geo -> Pixel 역변환
    const det = a_inv * e_inv - b_inv * d_inv;
    if (Math.abs(det) < 1e-10) {
        // det가 0이면 단순 변환 사용
        transformMatrix = {
            a: 1, b: 0, c: p1.pixelX - p1.geoX,
            d: 0, e: 1, f: p1.pixelY - p1.geoY
        };
    } else {
        const a = e_inv / det;
        const b = -b_inv / det;
        const d = -d_inv / det;
        const e = a_inv / det;
        const c = -(a * c_inv + b * f_inv);
        const f_val = -(d * c_inv + e * f_inv);

        transformMatrix = { a, b, c, d, e, f: f_val };
    }

    // 캘리브레이션 리스트 업데이트
    calibrationPoints = manualPlacements.map(mp => ({
        hole_no: mp.holeNo,
        pixelX: mp.pixelX,
        pixelY: mp.pixelY,
        geoX: mp.geoX,
        geoY: mp.geoY
    }));

    updateCalibrationList();
}

// 1개 시추공으로 단순 변환 행렬 생성 (스케일 1:1, 회전 없음)
function createSinglePointTransform() {
    if (manualPlacements.length < 1) return;

    const p1 = manualPlacements[0];

    // 단순 변환: pixel = geo + offset
    // u = 1*x + 0*y + (pixelX - geoX)
    // v = 0*x + 1*y + (pixelY - geoY)
    transformMatrix = {
        a: 1,
        b: 0,
        c: p1.pixelX - p1.geoX,
        d: 0,
        e: 1,
        f: p1.pixelY - p1.geoY
    };

    // 캘리브레이션 리스트 업데이트
    calibrationPoints = [{
        hole_no: p1.holeNo,
        pixelX: p1.pixelX,
        pixelY: p1.pixelY,
        geoX: p1.geoX,
        geoY: p1.geoY
    }];

    updateCalibrationList();
}

// DXF 내보내기 기능은 chunk6-dxf.js로 분리됨

// ===== 3D 도면 오버레이 기능 =====

// 3D에 현장 도면을 오버레이하는 함수 - pdfCanvas에서 직접 이미지 추출
function create3DDrawingOverlay(data3d) {
    // pdfCanvas와 transformMatrix 확인
    const pdfCanvas = document.getElementById('pdfCanvas');
    if (!pdfCanvas || pdfCanvas.width === 0 || !transformMatrix) {
        return null;
    }

    // 좌표 변환기 확인
    if (typeof window.coordinateTransformer === 'undefined') {
        console.error('KoreanCoordinateTransformer not initialized for 3D overlay');
        return null;
    }

    // transformMatrix를 사용하여 도면의 실제 좌표 경계 계산 (TM 좌표)
    const geoBounds = getDrawingGeoBounds();
    if (!geoBounds) {
        return null;
    }

    const overlayXMin = geoBounds.xMin;  // TM Northing
    const overlayXMax = geoBounds.xMax;
    const overlayYMin = geoBounds.yMin;  // TM Easting
    const overlayYMax = geoBounds.yMax;
    const canvasWidth = geoBounds.canvasWidth;
    const canvasHeight = geoBounds.canvasHeight;

    // Z 레벨 계산 (최저 표고 아래에 배치)
    let zLevel = Infinity;
    [data3d.z_excavation, data3d.z_soft_rock, data3d.z_weathered_rock, data3d.z_surface].forEach(zData => {
        if (zData) {
            zData.forEach(row => {
                if (row) row.forEach(val => {
                    if (val !== null && !isNaN(val) && val < zLevel) zLevel = val;
                });
            });
        }
    });
    if (zLevel === Infinity) zLevel = 0;
    zLevel = zLevel - 10; // 최저점 아래 10m에 배치

    // Z 레벨 정보 저장
    window.drawing3DOverlayInfo = { zLevel: zLevel };

    // pdfCanvas에서 이미지 데이터 추출
    const ctx = pdfCanvas.getContext('2d', { willReadFrequently: true });

    // 그리드 해상도 (높을수록 품질 향상, 성능 저하)
    const gridResolution = 60;

    const vertices_x = [];  // WGS84 경도
    const vertices_y = [];  // WGS84 위도
    const vertices_z = [];
    const faces_i = [];
    const faces_j = [];
    const faces_k = [];
    const faceColors = [];

    // 정점 그리드 생성 - 좌표를 WGS84로 변환
    for (let row = 0; row <= gridResolution; row++) {
        for (let col = 0; col <= gridResolution; col++) {
            const coordX = overlayXMin + (overlayXMax - overlayXMin) * col / gridResolution;
            const coordY = overlayYMin + (overlayYMax - overlayYMin) * row / gridResolution;

            // 범용 좌표 변환 함수 사용
            const wgs84 = transformToWGS84Universal(coordX, coordY);
            if (wgs84) {
                vertices_x.push(wgs84.lng);  // 경도
                vertices_y.push(wgs84.lat);  // 위도
            } else {
                // 변환 실패 시 선형 보간 사용 (edge case)
                vertices_x.push(127.0 + col * 0.001);
                vertices_y.push(35.8 + row * 0.001);
            }
            vertices_z.push(zLevel);
        }
    }

    // 삼각형 면 생성 및 색상 추출
    for (let row = 0; row < gridResolution; row++) {
        for (let col = 0; col < gridResolution; col++) {
            const idx = row * (gridResolution + 1) + col;
            const idx_right = idx + 1;
            const idx_top = idx + (gridResolution + 1);
            const idx_top_right = idx_top + 1;

            // 면 중심의 TM 좌표 (캔버스 픽셀 색상 추출용)
            const centerCol = col + 0.5;
            const centerRow = row + 0.5;
            const realX = overlayXMin + (overlayXMax - overlayXMin) * centerCol / gridResolution;
            const realY = overlayYMin + (overlayYMax - overlayYMin) * centerRow / gridResolution;

            // TM 좌표를 캔버스 픽셀 좌표로 변환 (transformMatrix 사용)
            const pixel = transformGeoToPixel(realX, realY);
            const canvasX = Math.floor(pixel.u);
            const canvasY = Math.floor(pixel.v);

            // 픽셀 색상 추출 (pdfCanvas에서)
            let r = 250, g = 250, b = 250;  // 기본 밝은 회색
            try {
                if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
                    const pixelData = ctx.getImageData(canvasX, canvasY, 1, 1).data;
                    if (pixelData[3] > 50) {  // 투명도 체크
                        r = pixelData[0];
                        g = pixelData[1];
                        b = pixelData[2];
                    }
                }
            } catch (e) {
                // 에러 시 기본색 유지
            }

            const color = `rgb(${r},${g},${b})`;

            // 첫 번째 삼각형
            faces_i.push(idx);
            faces_j.push(idx_right);
            faces_k.push(idx_top);
            faceColors.push(color);

            // 두 번째 삼각형
            faces_i.push(idx_right);
            faces_j.push(idx_top_right);
            faces_k.push(idx_top);
            faceColors.push(color);
        }
    }

    return {
        type: 'mesh3d',
        x: vertices_x,  // WGS84 경도
        y: vertices_y,  // WGS84 위도
        z: vertices_z,
        i: faces_i,
        j: faces_j,
        k: faces_k,
        facecolor: faceColors,
        opacity: 0.95,
        flatshading: true,
        name: '현장 도면',
        showscale: false,
        hoverinfo: 'name',
        lighting: {
            ambient: 1.0,
            diffuse: 0,
            specular: 0,
            fresnel: 0
        }
    };
}

// 도면 업로드 시 2D/3D 시각화 자동 업데이트
function enableDrawingOverlayOnUpload() {
    // 3D 시각화 체크박스 자동 활성화
    const chk3dDrawing = document.getElementById('chk3dDrawingOverlay');
    if (chk3dDrawing && !chk3dDrawing.checked) {
        chk3dDrawing.checked = true;
    }

    // 2D 등고선 맵 도면 표시 체크박스 자동 활성화
    const chk2dDrawing = document.getElementById('showDrawingOverlay2D');
    if (chk2dDrawing && !chk2dDrawing.checked) {
        chk2dDrawing.checked = true;
    }

    // 2D 등고선 맵 업데이트 (도면 배경 표시)
    if (typeof updateContourMap === 'function' && boreholeData && boreholeData.length > 0) {
        updateContourMap();
    }

    // 3D 시각화 업데이트 (도면 바닥면 표시)
    if (typeof update3DVisualization === 'function' && boreholeData && boreholeData.length > 0) {
        update3DVisualization();
    }
}

// =========================================
// 지도 시각화 (Leaflet) 관련 함수
// =========================================

let leafletMap = null;
let boreholeMarkers = [];
let wgs84Coordinates = []; // 변환된 WGS84 좌표 저장

/**
 * 지도 뷰 초기화
 */
function initMapView() {
    const mapContainer = document.getElementById('leafletMap');
    if (!mapContainer) return;

    // 데이터 확인
    if (!boreholeData || boreholeData.length === 0) {
        mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">시추공 데이터를 먼저 업로드하세요.</div>';
        return;
    }

    // 좌표계 자동 감지 실행 (처음 한 번만)
    if (window.universalTransformer && !window.universalTransformer.detectedEPSG) {
        const coordinates = boreholeData.map(bh => ({
            x: parseFloat(bh.x) || 0,
            y: parseFloat(bh.y) || 0
        })).filter(c => c.x !== 0 && c.y !== 0);

        if (coordinates.length > 0) {
            // 메타데이터 전달 (대문자 필드명 지원)
            const firstBorehole = boreholeData[0];
            const metadata = firstBorehole?.metadata || {};
            const detection = window.universalTransformer.detectCoordinateSystem(coordinates, {
                location: metadata.LOCATION || metadata.location || firstBorehole?.location || '',
                projectName: metadata.PROJECT_NAME || metadata.projectName || firstBorehole?.projectName || '',
                LOCATION: metadata.LOCATION || '',
                PROJECT_NAME: metadata.PROJECT_NAME || ''
            });

            console.log('Coordinate system detection result:', detection);

            // 감지 결과 UI 업데이트
            updateCoordinateSystemUI(detection);

            // 한국 좌표계인 경우 KoreanCoordinateTransformer도 업데이트 (핵심 수정!)
            if (detection.type === CRS_TYPE.KOREAN_TM) {
                window.coordinateTransformer = new KoreanCoordinateTransformer(detection.epsg);
                console.log('KoreanCoordinateTransformer updated to:', detection.epsg);
            }
        }
    }

    // 이미 초기화된 경우 업데이트만 수행
    if (leafletMap) {
        // 탭 전환 후 지도 크기 재조정
        setTimeout(() => {
            leafletMap.invalidateSize();
            updateMapMarkers();
        }, 100);
        return;
    }

    // 초기 지도 중심 결정 (감지된 좌표계에 따라)
    let initialCenter = [36.5, 127.5]; // 기본: 한국
    let initialZoom = 7;

    if (window.universalTransformer) {
        const summary = window.universalTransformer.getSummary();
        if (summary.crsType === CRS_TYPE.WGS84) {
            // 이미 WGS84면 첫 번째 좌표로 중심 설정
            const firstCoord = boreholeData.find(bh => bh.x && bh.y);
            if (firstCoord) {
                initialCenter = [parseFloat(firstCoord.y), parseFloat(firstCoord.x)];
                initialZoom = 12;
            }
        } else if (summary.crsType !== CRS_TYPE.KOREAN_TM) {
            // 국제 좌표계: 첫 번째 변환 좌표로 중심 설정
            const firstCoord = boreholeData.find(bh => bh.x && bh.y);
            if (firstCoord) {
                const wgs84 = window.universalTransformer.transformToWGS84(
                    parseFloat(firstCoord.x),
                    parseFloat(firstCoord.y)
                );
                if (wgs84) {
                    initialCenter = [wgs84.lat, wgs84.lng];
                    initialZoom = 12;
                }
            }
        }
    }

    // Leaflet 지도 초기화
    leafletMap = L.map('leafletMap').setView(initialCenter, initialZoom);

    // 기본 지도 레이어들 정의
    const baseLayers = {
        // OpenStreetMap 기본 지도
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }),
        // Google 위성 이미지
        'Google 위성': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 20
        }),
        // Google 위성 + 라벨
        'Google 위성+라벨': L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 20
        }),
        // Google 지형도
        'Google 지형': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 20
        }),
        // Esri 위성 이미지
        'Esri 위성': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri',
            maxZoom: 19
        }),
        // Esri 위성 + 라벨
        'Esri 위성+라벨': L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19
            }),
            L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19
            })
        ])
    };

    // 기본 레이어 추가 (OpenStreetMap)
    baseLayers['OpenStreetMap'].addTo(leafletMap);

    // 레이어 컨트롤 추가
    L.control.layers(baseLayers, null, {
        position: 'topright',
        collapsed: false
    }).addTo(leafletMap);

    // 약간의 지연 후 마커 추가 (지도 렌더링 완료 대기)
    setTimeout(() => {
        leafletMap.invalidateSize();
        updateMapMarkers();
    }, 200);
}

/**
 * 좌표계 감지 결과 UI 업데이트
 */
function updateCoordinateSystemUI(detection) {
    const infoEl = document.getElementById('mapCoordinateInfo');
    const selectEl = document.getElementById('mapCoordinateSystem');

    if (infoEl) {
        let statusColor = '#4CAF50';
        let statusText = detection.message;

        if (detection.confidence < 70) {
            statusColor = '#FF9800';
            statusText += ` (신뢰도: ${detection.confidence}%)`;
        } else if (detection.confidence >= 90) {
            statusColor = '#4CAF50';
        }

        infoEl.innerHTML = `<span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>`;

        // UTM Zone인 경우 추가 정보 표시
        if (detection.zone) {
            infoEl.innerHTML += `<br><small style="color: #666;">Zone ${detection.zone}${detection.hemisphere}</small>`;
        }
    }

    // ✅ 자동 감지 시에는 select를 'auto'로 유지 (사용자가 수동 선택할 때만 변경)
    // 감지된 좌표계 정보는 infoEl에 표시되므로 select는 건드리지 않음
}

/**
 * 좌표계 변경 시 호출
 */
function updateMapCoordinateSystem() {
    const epsgSelect = document.getElementById('mapCoordinateSystem');
    if (!epsgSelect) return;

    const selectedEpsg = epsgSelect.value;

    // 자동 감지 모드
    if (selectedEpsg === 'auto') {
        if (boreholeData && boreholeData.length > 0) {
            const coordinates = boreholeData.map(bh => ({
                x: parseFloat(bh.x) || 0,
                y: parseFloat(bh.y) || 0
            })).filter(c => c.x !== 0 && c.y !== 0);

            if (coordinates.length > 0) {
                window.universalTransformer = new UniversalCoordinateTransformer();
                // 메타데이터 전달 (대문자 필드명 지원)
                const firstBorehole = boreholeData[0];
                const metadata = firstBorehole?.metadata || {};
                const detection = window.universalTransformer.detectCoordinateSystem(coordinates, {
                    location: metadata.LOCATION || metadata.location || '',
                    projectName: metadata.PROJECT_NAME || metadata.projectName || '',
                    LOCATION: metadata.LOCATION || '',
                    PROJECT_NAME: metadata.PROJECT_NAME || ''
                });

                updateCoordinateSystemUI(detection);

                // 한국 좌표계인 경우 기존 변환기도 업데이트
                if (detection.type === CRS_TYPE.KOREAN_TM) {
                    window.coordinateTransformer = new KoreanCoordinateTransformer(detection.epsg);
                }
            }
        }
    }
    // 수동 선택 모드
    else if (selectedEpsg === 'other') {
        // UTM Zone 수동 입력 UI 표시
        showUTMZoneSelector();
        return;
    }
    // 한국 좌표계 선택
    else if (selectedEpsg.startsWith('EPSG:5') || selectedEpsg === 'EPSG:2097') {
        window.universalTransformer.setCoordinateSystem(selectedEpsg, true);
        window.coordinateTransformer = new KoreanCoordinateTransformer(selectedEpsg);
        document.getElementById('mapCoordinateInfo').textContent = `수동 선택: ${selectedEpsg} (한국 TM)`;
    }
    // WGS84 직접
    else if (selectedEpsg === 'EPSG:4326') {
        window.universalTransformer.setCoordinateSystem(selectedEpsg, false);
        document.getElementById('mapCoordinateInfo').textContent = `수동 선택: WGS84 (변환 없음)`;
    }

    updateMapMarkers();
}

/**
 * UTM Zone 수동 선택 UI 표시
 */
function showUTMZoneSelector() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('UTM Zone을 입력하세요 (예: 51)');
        return;
    }

    modalTitle.textContent = 'UTM Zone 선택';
    modalBody.innerHTML = `
        <div style="padding: 20px;">
            <p style="margin-bottom: 15px;">UTM Zone과 반구를 선택하세요:</p>
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Zone (1-60)</label>
                    <input type="number" id="utmZoneInput" min="1" max="60" value="51" style="width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">반구</label>
                    <select id="utmHemisphere" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="N">북반구 (N)</option>
                        <option value="S">남반구 (S)</option>
                    </select>
                </div>
            </div>
            <div style="background: #E3F2FD; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                <strong>참고:</strong> 지역별 대표 UTM Zone
                <ul style="margin: 10px 0 0 20px; font-size: 13px;">
                    <li>필리핀: Zone 51</li>
                    <li>베트남: Zone 48</li>
                    <li>인도네시아: Zone 48-54</li>
                    <li>중동 (UAE, 카타르): Zone 39-40</li>
                    <li>호주: Zone 50-56</li>
                </ul>
            </div>
            <div style="text-align: right;">
                <button onclick="applyUTMZone()" style="padding: 10px 20px; background: #455A64; color: white; border: none; border-radius: 4px; cursor: pointer;">적용</button>
                <button onclick="document.getElementById('calculationModal').style.display='none'" style="padding: 10px 20px; background: #9E9E9E; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">취소</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

/**
 * UTM Zone 적용
 */
function applyUTMZone() {
    const zone = parseInt(document.getElementById('utmZoneInput')?.value) || 51;
    const hemisphere = document.getElementById('utmHemisphere')?.value || 'N';

    if (zone < 1 || zone > 60) {
        alert('UTM Zone은 1~60 사이여야 합니다.');
        return;
    }

    window.universalTransformer.setUTMZone(zone, hemisphere);

    const epsg = window.universalTransformer.detectedEPSG;
    document.getElementById('mapCoordinateInfo').textContent = `수동 선택: UTM Zone ${zone}${hemisphere} (${epsg})`;

    document.getElementById('calculationModal').style.display = 'none';

    updateMapMarkers();
}

/**
 * 지도 마커 업데이트
 */
function updateMapMarkers() {
    if (!leafletMap || !boreholeData || boreholeData.length === 0) {
        updateMapBoreholeList();
        return;
    }

    // 기존 마커 제거
    boreholeMarkers.forEach(marker => leafletMap.removeLayer(marker));
    boreholeMarkers = [];
    wgs84Coordinates = [];

    // 좌표 변환기 확인 - 유니버설 또는 한국 변환기 중 하나는 필요
    const useUniversal = window.universalTransformer && window.universalTransformer.detectedEPSG;

    if (!useUniversal && typeof window.coordinateTransformer === 'undefined') {
        console.warn('No coordinate transformer available, will use transformToWGS84Universal');
    }

    // 판정 결과 표시 체크박스 상태 확인
    const showMapFoundation = document.getElementById('chkMapFoundation')?.checked ?? true;
    const showMapSoftGround = document.getElementById('chkMapSoftGround')?.checked ?? false;
    const showMapSpecialLayer = document.getElementById('chkMapSpecialLayer')?.checked ?? false;

    let validCount = 0;
    let invalidCount = 0;

    const crsInfo = useUniversal ? window.universalTransformer.getSummary() : { crsType: 'KOREAN_TM' };
    console.log('Updating map markers for', boreholeData.length, 'boreholes using', crsInfo);

    boreholeData.forEach(bh => {
        const coordX = parseFloat(bh.x) || 0;
        const coordY = parseFloat(bh.y) || 0;

        // 좌표가 0이 아닌지 확인
        if (coordX === 0 || coordY === 0) {
            invalidCount++;
            return;
        }

        // WGS84인 경우 범위 체크
        if (crsInfo.crsType === 'WGS84') {
            if (Math.abs(coordX) > 180 || Math.abs(coordY) > 90) {
                invalidCount++;
                return;
            }
        } else {
            // TM/UTM 좌표인 경우 최소값 체크
            if (coordX < 100 && coordY < 100) {
                invalidCount++;
                return;
            }
        }

        // 좌표 변환 (범용 변환 함수 사용)
        let wgs84 = transformToWGS84Universal(coordX, coordY);

        if (wgs84) {
            validCount++;
            wgs84Coordinates.push({
                holeNo: bh.holeNo || bh.hole_no,
                lat: wgs84.lat,
                lng: wgs84.lng,
                origX: coordX,
                origY: coordY,
                groundElevation: bh.groundElevation || bh.ground_elevation,
                bh: bh  // 원본 시추공 데이터 저장
            });

            // 판정 결과에 따른 마커 색상 결정
            const markerColor = getContourMarkerColor(bh, showMapFoundation, showMapSoftGround, showMapSpecialLayer);

            // 마커 생성
            const marker = L.circleMarker([wgs84.lat, wgs84.lng], {
                radius: 8,
                fillColor: markerColor,
                color: '#333',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });

            // 팝업 설정
            const holeNo = bh.holeNo || bh.hole_no;
            const groundEl = bh.groundElevation || bh.ground_elevation || 0;
            const coordLabel = crsInfo.crsType === 'WGS84' ? 'WGS84' :
                              (crsInfo.crsType === 'KOREAN_TM' ? 'TM' : 'UTM');

            marker.bindPopup(`
                <div style="min-width: 220px;">
                    <strong style="font-size: 14px;">${holeNo}</strong>
                    <hr style="margin: 5px 0;">
                    <table style="font-size: 12px; width: 100%;">
                        <tr><td>지표고:</td><td style="text-align: right;">${groundEl} m</td></tr>
                        <tr><td>WGS84:</td><td style="text-align: right;">${wgs84.lat.toFixed(6)}, ${wgs84.lng.toFixed(6)}</td></tr>
                        <tr><td>${coordLabel} X:</td><td style="text-align: right;">${coordX.toFixed(2)}</td></tr>
                        <tr><td>${coordLabel} Y:</td><td style="text-align: right;">${coordY.toFixed(2)}</td></tr>
                    </table>
                    <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="showBoreholeLog('${holeNo}')" style="background: #455A64; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                            주상도 보기
                        </button>
                        <a href="${UniversalCoordinateTransformer.getGoogleMapsUrl(wgs84.lat, wgs84.lng)}"
                           target="_blank" style="color: #1976D2; font-size: 11px; display: flex; align-items: center;">
                           Google Maps
                        </a>
                    </div>
                </div>
            `);

            marker.addTo(leafletMap);
            boreholeMarkers.push(marker);
        } else {
            invalidCount++;
            console.warn(`Borehole ${bh.holeNo || bh.hole_no}: Failed to transform coordinates`);
        }
    });

    // 전체 보기로 맞춤
    if (wgs84Coordinates.length > 0) {
        fitMapToBounds();
    }

    // 목록 업데이트
    updateMapBoreholeList();

    // 변환 상태 표시
    const statusEl = document.getElementById('mapConversionStatus');
    const detailsEl = document.getElementById('mapConversionDetails');
    if (statusEl && detailsEl) {
        statusEl.style.display = 'block';
        detailsEl.innerHTML = `
            <div>성공: ${validCount}개</div>
            <div>실패: ${invalidCount}개</div>
            <div>좌표계: ${window.coordinateTransformer?.sourceEpsg || 'AUTO'}</div>
        `;
    }

    // 다중 분석 버튼 표시 (시추공이 2개 이상일 때)
    const multiBtn = document.getElementById('enableMapMultiModeBtn');
    if (multiBtn && validCount >= 2) {
        multiBtn.style.display = mapMultiBoreholeMode ? 'none' : 'block';
    }
}

/**
 * 지도 마커 색상만 업데이트 (체크박스 변경 시)
 */
function updateMapMarkerColors() {
    if (!leafletMap || boreholeMarkers.length === 0 || wgs84Coordinates.length === 0) {
        return;
    }

    // 판정 결과 표시 체크박스 상태 확인
    const showMapFoundation = document.getElementById('chkMapFoundation')?.checked ?? true;
    const showMapSoftGround = document.getElementById('chkMapSoftGround')?.checked ?? false;
    const showMapSpecialLayer = document.getElementById('chkMapSpecialLayer')?.checked ?? false;

    // 각 마커의 색상 업데이트
    boreholeMarkers.forEach((marker, index) => {
        const coordData = wgs84Coordinates[index];
        if (coordData && coordData.bh) {
            const markerColor = getContourMarkerColor(coordData.bh, showMapFoundation, showMapSoftGround, showMapSpecialLayer);
            marker.setStyle({ fillColor: markerColor });
        }
    });
}

/**
 * 시추공 기초 판단 결과에 따른 색상 반환
 */
function getFoundationColor(bh) {
    if (!bh.foundationAssessment) return '#2196F3'; // 미판단

    const result = bh.foundationAssessment.result;
    if (result === 'direct_possible') return '#2E7D32';      // 직접 기초 가능
    if (result === 'replacement_needed') return '#F57C00';   // 치환 필요
    if (result === 'pile_needed') return '#C62828';          // 파일 기초 필요
    return '#2196F3';
}

/**
 * 지도 전체 보기
 */
function fitMapToBounds() {
    if (!leafletMap || wgs84Coordinates.length === 0) return;

    const bounds = L.latLngBounds(
        wgs84Coordinates.map(c => [c.lat, c.lng])
    );
    leafletMap.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * 지도 새로고침
 */
function refreshMapView() {
    updateMapMarkers();
}

/**
 * 시추공 목록 업데이트
 */
function updateMapBoreholeList() {
    const listEl = document.getElementById('mapBoreholeList');
    if (!listEl) return;

    if (wgs84Coordinates.length === 0) {
        if (boreholeData && boreholeData.length > 0) {
            // 데이터는 있지만 변환 실패
            const firstBh = boreholeData[0];
            const tmX = parseFloat(firstBh.x) || 0;
            const tmY = parseFloat(firstBh.y) || 0;
            listEl.innerHTML = `
                <div style="color: #666; text-align: center; padding: 20px;">
                    <div style="margin-bottom: 10px;">좌표 변환에 실패했습니다.</div>
                    <div style="font-size: 11px; background: #FFF3E0; padding: 10px; border-radius: 4px; text-align: left;">
                        <div><strong>첫 번째 시추공 좌표:</strong></div>
                        <div>X (Northing): ${tmX}</div>
                        <div>Y (Easting): ${tmY}</div>
                        <div style="margin-top: 8px; color: #E65100;">좌표계를 확인하세요.</div>
                    </div>
                </div>
            `;
        } else {
            listEl.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">시추공 데이터를 먼저 업로드하세요.</div>';
        }
        return;
    }

    let html = '';
    wgs84Coordinates.forEach(coord => {
        html += `
            <div style="padding: 8px; margin-bottom: 8px; background: #F5F5F5; border-radius: 4px; cursor: pointer;"
                 onclick="panToMarker('${coord.holeNo}')">
                <div style="font-weight: bold; color: #455A64;">${coord.holeNo}</div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                    위도: ${coord.lat.toFixed(6)}<br>
                    경도: ${coord.lng.toFixed(6)}<br>
                    지표고: ${coord.groundElevation} m
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

/**
 * 특정 시추공으로 지도 이동
 */
function panToMarker(holeNo) {
    const coord = wgs84Coordinates.find(c => c.holeNo === holeNo);
    if (coord && leafletMap) {
        leafletMap.setView([coord.lat, coord.lng], 17);

        // 해당 마커 팝업 열기
        const markerIndex = wgs84Coordinates.indexOf(coord);
        if (markerIndex >= 0 && boreholeMarkers[markerIndex]) {
            boreholeMarkers[markerIndex].openPopup();
        }
    }
}

// =========================================
// 지도 등고선 오버레이 기능
// =========================================

let mapContourLayer = null;
let mapMultiBoreholeMode = false;
let mapSelectedBoreholes = [];
let mapConnectionLine = null;

/**
 * 등고선 오버레이 토글
 */
function toggleMapContourOverlay() {
    const checkbox = document.getElementById('mapContourOverlay');
    if (checkbox && checkbox.checked) {
        updateMapContourOverlay();
    } else {
        removeMapContourLayer();
    }
}

/**
 * 등고선 레이어 제거
 */
function removeMapContourLayer() {
    if (mapContourLayer && leafletMap) {
        leafletMap.removeLayer(mapContourLayer);
        mapContourLayer = null;
    }
}

/**
 * 지도 위 등고선 오버레이 업데이트
 * 시추공 위치 기반으로 등고선 라인을 직접 그림
 */
function updateMapContourOverlay() {
    const checkbox = document.getElementById('mapContourOverlay');
    if (!checkbox || !checkbox.checked) return;

    if (!leafletMap || !boreholeData || boreholeData.length === 0) return;

    // 기존 레이어 제거
    removeMapContourLayer();

    // 시추공 WGS84 좌표 및 표고 데이터 수집
    const contourType = document.getElementById('mapContourType')?.value || 'ground_elevation';
    const boreholePoints = [];

    boreholeData.forEach(bh => {
        if (!bh.x || !bh.y) return;

        const wgs84 = transformToWGS84Universal(parseFloat(bh.x), parseFloat(bh.y));
        if (!wgs84) return;

        // 등고선 유형에 따른 값 선택
        let value = null;
        switch (contourType) {
            case 'ground_elevation':
                value = parseFloat(bh.groundElevation) || parseFloat(bh.excavationLevel);
                break;
            case 'gwl_elevation':
                value = parseFloat(bh.waterTableElevation) || parseFloat(bh.gwl_elevation);
                break;
            case 'bedrock_elevation':
                value = parseFloat(bh.bedrockTopElevation) || parseFloat(bh.bedrock_elevation);
                break;
            case 'weathered_rock_elevation':
                value = parseFloat(bh.weatheredRockElevation);
                break;
            case 'soft_rock_elevation':
                value = parseFloat(bh.softRockPlusElevation);
                break;
            default:
                value = parseFloat(bh.groundElevation);
        }

        if (value !== null && !isNaN(value) && value !== 0 && String(value) !== '-') {
            boreholePoints.push({
                lat: wgs84.lat,
                lng: wgs84.lng,
                value: value,
                holeNo: bh.holeNo
            });
        }
    });

    if (boreholePoints.length < 3) {
        console.warn('등고선 표시에 필요한 유효 데이터가 부족합니다 (최소 3개 시추공 필요)');
        return;
    }

    // Z 값 범위 계산
    const values = boreholePoints.map(p => p.value);
    const zMin = Math.min(...values);
    const zMax = Math.max(...values);
    const zRange = zMax - zMin;

    if (zRange < 0.1) {
        console.warn('등고선 표시: 값 범위가 너무 작습니다');
        return;
    }

    // 등고선 간격 결정 (1m 또는 범위에 따라 조정)
    const contourInterval = zRange > 20 ? 5 : (zRange > 10 ? 2 : 1);
    const contourLevels = [];
    const startLevel = Math.ceil(zMin / contourInterval) * contourInterval;
    for (let level = startLevel; level <= zMax; level += contourInterval) {
        contourLevels.push(level);
    }

    // 시추공 범위 계산 (여유 있게)
    const latMin = Math.min(...boreholePoints.map(p => p.lat));
    const latMax = Math.max(...boreholePoints.map(p => p.lat));
    const lngMin = Math.min(...boreholePoints.map(p => p.lng));
    const lngMax = Math.max(...boreholePoints.map(p => p.lng));
    const latMargin = (latMax - latMin) * 0.2 || 0.001;
    const lngMargin = (lngMax - lngMin) * 0.2 || 0.001;

    // 그리드 생성 및 IDW 보간
    const gridSize = 30;
    const grid = [];
    const gridLats = [];
    const gridLngs = [];

    for (let i = 0; i < gridSize; i++) {
        gridLats.push(latMin - latMargin + (latMax - latMin + 2 * latMargin) * i / (gridSize - 1));
        gridLngs.push(lngMin - lngMargin + (lngMax - lngMin + 2 * lngMargin) * i / (gridSize - 1));
    }

    // IDW 보간 함수
    function idwInterpolate(lat, lng, points, power = 2) {
        let sumWeights = 0;
        let sumValues = 0;

        for (const p of points) {
            const dist = Math.sqrt(Math.pow(lat - p.lat, 2) + Math.pow(lng - p.lng, 2));
            if (dist < 0.00001) return p.value;

            const weight = 1 / Math.pow(dist, power);
            sumWeights += weight;
            sumValues += p.value * weight;
        }

        return sumWeights > 0 ? sumValues / sumWeights : null;
    }

    // 그리드 값 계산
    for (let i = 0; i < gridSize; i++) {
        grid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            grid[i][j] = idwInterpolate(gridLats[i], gridLngs[j], boreholePoints);
        }
    }

    // Marching Squares 알고리즘으로 등고선 추출
    function extractContourLines(grid, gridLats, gridLngs, level) {
        const lines = [];
        const rows = grid.length;
        const cols = grid[0].length;

        for (let i = 0; i < rows - 1; i++) {
            for (let j = 0; j < cols - 1; j++) {
                const v00 = grid[i][j];
                const v10 = grid[i + 1][j];
                const v01 = grid[i][j + 1];
                const v11 = grid[i + 1][j + 1];

                if (v00 === null || v10 === null || v01 === null || v11 === null) continue;

                // 셀의 4개 꼭짓점에서 등고선 레벨과의 관계 확인
                const b00 = v00 >= level ? 1 : 0;
                const b10 = v10 >= level ? 1 : 0;
                const b01 = v01 >= level ? 1 : 0;
                const b11 = v11 >= level ? 1 : 0;
                const caseIndex = b00 + b10 * 2 + b01 * 4 + b11 * 8;

                if (caseIndex === 0 || caseIndex === 15) continue;

                // 선형 보간으로 교차점 계산
                function lerp(v1, v2, lat1, lng1, lat2, lng2, level) {
                    const t = (level - v1) / (v2 - v1);
                    return { lat: lat1 + t * (lat2 - lat1), lng: lng1 + t * (lng2 - lng1) };
                }

                const lat0 = gridLats[i], lat1 = gridLats[i + 1];
                const lng0 = gridLngs[j], lng1 = gridLngs[j + 1];

                // 각 엣지에서의 교차점
                const edges = {};
                if ((b00 !== b10)) edges.left = lerp(v00, v10, lat0, lng0, lat1, lng0, level);
                if ((b01 !== b11)) edges.right = lerp(v01, v11, lat0, lng1, lat1, lng1, level);
                if ((b00 !== b01)) edges.bottom = lerp(v00, v01, lat0, lng0, lat0, lng1, level);
                if ((b10 !== b11)) edges.top = lerp(v10, v11, lat1, lng0, lat1, lng1, level);

                // 케이스별 라인 연결
                const lineSegments = {
                    1: ['left', 'bottom'], 2: ['left', 'top'], 3: ['bottom', 'top'],
                    4: ['bottom', 'right'], 5: ['left', 'right'], 6: ['left', 'bottom', 'top', 'right'],
                    7: ['top', 'right'], 8: ['top', 'right'], 9: ['left', 'top', 'bottom', 'right'],
                    10: ['left', 'right'], 11: ['bottom', 'right'], 12: ['bottom', 'top'],
                    13: ['left', 'top'], 14: ['left', 'bottom']
                };

                const segs = lineSegments[caseIndex];
                if (segs && segs.length >= 2) {
                    if (segs.length === 2 && edges[segs[0]] && edges[segs[1]]) {
                        lines.push([edges[segs[0]], edges[segs[1]]]);
                    } else if (segs.length === 4) {
                        if (edges[segs[0]] && edges[segs[1]]) lines.push([edges[segs[0]], edges[segs[1]]]);
                        if (edges[segs[2]] && edges[segs[3]]) lines.push([edges[segs[2]], edges[segs[3]]]);
                    }
                }
            }
        }
        return lines;
    }

    // 등고선 색상 (파란색 계열)
    const contourColors = ['#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5'];

    // 레이어 그룹 생성
    mapContourLayer = L.layerGroup();

    // 각 등고선 레벨에 대해 라인 생성
    contourLevels.forEach((level, idx) => {
        const lines = extractContourLines(grid, gridLats, gridLngs, level);
        const color = contourColors[idx % contourColors.length];

        lines.forEach(line => {
            if (line.length >= 2) {
                const polyline = L.polyline(
                    line.map(p => [p.lat, p.lng]),
                    {
                        color: color,
                        weight: 2,
                        opacity: 0.8
                    }
                );

                // 툴팁 추가
                polyline.bindTooltip(`${level.toFixed(1)}m`, {
                    permanent: false,
                    direction: 'center',
                    className: 'contour-tooltip'
                });

                mapContourLayer.addLayer(polyline);
            }
        });

        // 등고선 레이블 추가 (일부 라인에만)
        if (lines.length > 0 && idx % 2 === 0) {
            const midLine = lines[Math.floor(lines.length / 2)];
            if (midLine && midLine.length >= 2) {
                const midPoint = {
                    lat: (midLine[0].lat + midLine[1].lat) / 2,
                    lng: (midLine[0].lng + midLine[1].lng) / 2
                };

                const label = L.marker([midPoint.lat, midPoint.lng], {
                    icon: L.divIcon({
                        className: 'contour-label',
                        html: `<span style="background: white; padding: 1px 3px; border-radius: 2px; font-size: 10px; color: ${color}; font-weight: bold;">${level.toFixed(0)}m</span>`,
                        iconSize: [30, 15],
                        iconAnchor: [15, 7]
                    })
                });
                mapContourLayer.addLayer(label);
            }
        }
    });

    mapContourLayer.addTo(leafletMap);
    console.log(`등고선 오버레이 생성 완료: ${contourLevels.length}개 레벨, 시추공 ${boreholePoints.length}개 기반`);
}

/**
 * 지도 다중 시추공 모드 토글
 */
function toggleMapMultiBoreholeMode() {
    mapMultiBoreholeMode = !mapMultiBoreholeMode;
    const btn = document.getElementById('mapMultiModeBtn');

    if (mapMultiBoreholeMode) {
        btn.style.background = '#e74c3c';
        btn.style.color = 'white';
        btn.textContent = '선택 모드 ON';

        // 마커 클릭 이벤트 변경
        boreholeMarkers.forEach((marker, idx) => {
            marker.off('click');
            marker.on('click', function() {
                selectMapBorehole(wgs84Coordinates[idx].holeNo);
            });
        });
    } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.textContent = '다중 시추공 선택';

        // 마커 클릭 이벤트 복원 (팝업)
        boreholeMarkers.forEach((marker, idx) => {
            marker.off('click');
            marker.on('click', function() {
                marker.openPopup();
            });
        });
    }
}

/**
 * 지도에서 시추공 선택
 */
function selectMapBorehole(holeNo) {
    const idx = mapSelectedBoreholes.indexOf(holeNo);
    if (idx >= 0) {
        mapSelectedBoreholes.splice(idx, 1);
    } else {
        mapSelectedBoreholes.push(holeNo);
    }

    updateMapSelection();
}

/**
 * 지도 다중 선택 모드 활성화
 */
function enableMapMultiMode() {
    mapMultiBoreholeMode = true;
    mapSelectedBoreholes = [];

    // UI 업데이트
    const bar = document.getElementById('mapMultiBoreholeBar');
    const btn = document.getElementById('enableMapMultiModeBtn');
    if (bar) bar.style.display = 'block';
    if (btn) btn.style.display = 'none';

    // 마커 클릭 이벤트를 선택 모드로 변경
    boreholeMarkers.forEach((marker, idx) => {
        marker.off('click');
        marker.on('click', function() {
            selectMapBorehole(wgs84Coordinates[idx].holeNo);
        });
    });

    updateMapSelection();
}

/**
 * 지도 다중 선택 모드 종료
 */
function exitMapMultiMode() {
    mapMultiBoreholeMode = false;
    mapSelectedBoreholes = [];

    // 연결선 제거
    if (mapConnectionLine && leafletMap) {
        leafletMap.removeLayer(mapConnectionLine);
        mapConnectionLine = null;
    }

    // UI 업데이트
    const bar = document.getElementById('mapMultiBoreholeBar');
    const btn = document.getElementById('enableMapMultiModeBtn');
    if (bar) bar.style.display = 'none';
    if (btn) btn.style.display = 'block';

    // 마커 클릭 이벤트를 팝업으로 복원
    boreholeMarkers.forEach((marker, idx) => {
        marker.off('click');
        marker.on('click', function() {
            marker.openPopup();
        });
    });

    // 마커 스타일 초기화
    updateMapSelection();

    // 단면도 컨테이너 숨김
    closeMapCrossSection();
}

/**
 * 지도 선택 상태 업데이트
 */
function updateMapSelection() {
    // 마커 스타일 업데이트
    boreholeMarkers.forEach((marker, idx) => {
        const holeNo = wgs84Coordinates[idx]?.holeNo;
        const isSelected = mapSelectedBoreholes.includes(holeNo);

        marker.setStyle({
            fillColor: isSelected ? '#e74c3c' : getFoundationColor(boreholeData.find(b => b.holeNo === holeNo)),
            weight: isSelected ? 3 : 2,
            color: isSelected ? '#fff' : '#333'
        });
    });

    // 선택된 시추공 표시 (새 UI)
    const selectedListEl = document.getElementById('mapSelectedBoreholesList');
    if (selectedListEl) {
        if (mapSelectedBoreholes.length > 0) {
            selectedListEl.textContent = mapSelectedBoreholes.join(' → ');
        } else {
            selectedListEl.textContent = '(지도에서 시추공을 클릭하세요)';
        }
    }

    // 기존 UI 호환성
    const selectedEl = document.getElementById('mapSelectedBoreholes');
    if (selectedEl) {
        if (mapSelectedBoreholes.length > 0) {
            selectedEl.textContent = `선택: ${mapSelectedBoreholes.join(' → ')}`;
        } else {
            selectedEl.textContent = '';
        }
    }

    // 단면도 버튼 활성화
    const btn = document.getElementById('mapCrossSectionBtn');
    if (btn) {
        btn.disabled = mapSelectedBoreholes.length < 2;
    }

    // 연결선 업데이트
    updateMapConnectionLine();
}

/**
 * 지도 연결선 업데이트
 */
function updateMapConnectionLine() {
    if (mapConnectionLine && leafletMap) {
        leafletMap.removeLayer(mapConnectionLine);
        mapConnectionLine = null;
    }

    if (mapSelectedBoreholes.length < 2) return;

    const coords = mapSelectedBoreholes.map(holeNo => {
        const c = wgs84Coordinates.find(w => w.holeNo === holeNo);
        return c ? [c.lat, c.lng] : null;
    }).filter(c => c !== null);

    if (coords.length >= 2) {
        mapConnectionLine = L.polyline(coords, {
            color: '#e74c3c',
            weight: 3,
            dashArray: '10, 5'
        }).addTo(leafletMap);
    }
}

/**
 * 지도 선택 초기화
 */
function clearMapSelection() {
    mapSelectedBoreholes = [];
    updateMapSelection();
}

/**
 * 지도에서 단면도 표시
 */
function showMapCrossSection() {
    if (mapSelectedBoreholes.length < 2) return;

    const container = document.getElementById('mapCrossSectionContainer');
    if (container) {
        container.style.display = 'block';
        generateMapCrossSection();
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * 지도 단면도 닫기
 */
function closeMapCrossSection() {
    const container = document.getElementById('mapCrossSectionContainer');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * 지도 단면도 생성 (updateCrossSection 기반)
 */
function generateMapCrossSection() {
    const plotDiv = document.getElementById('mapCrossSectionPlot');
    if (!plotDiv) return;

    if (mapSelectedBoreholes.length < 2) {
        plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">2개 이상의 시추공을 선택하세요.</div>';
        return;
    }

    // 기존 updateCrossSection과 동일한 로직 사용
    // selectedBoreholes를 임시로 교체
    const originalSelected = selectedBoreholes;
    selectedBoreholes = mapSelectedBoreholes.slice();

    // 선택된 시추공 데이터 준비
    const selectedPointsData = selectedBoreholes.map(holeNo => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh) return null;
        const layers = getDetailedLayers(bh);
        const groundElev = parseFloat(bh.groundElevation || 0);
        const excavationLevel = parseFloat(bh.excavationLevelInput) || groundElev;
        return {
            holeNo,
            x: parseFloat(bh.x),
            y: parseFloat(bh.y),
            groundElevation: groundElev,
            excavationLevel: excavationLevel,
            layers: layers,
            totalDepth: parseFloat(bh.totalDepth || 0)
        };
    }).filter(p => p !== null && !isNaN(p.x) && !isNaN(p.y));

    if (selectedPointsData.length < 2) {
        plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">유효한 시추공이 2개 이상 필요합니다.</div>';
        selectedBoreholes = originalSelected;
        return;
    }

    // 누적 거리 계산
    let cumulativeDistances = [0];
    for (let i = 1; i < selectedPointsData.length; i++) {
        const prev = selectedPointsData[i - 1];
        const curr = selectedPointsData[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }

    const maxDist = cumulativeDistances[cumulativeDistances.length - 1];

    // 최대/최소 표고 계산
    let minElev = Infinity, maxElev = -Infinity;
    selectedPointsData.forEach(pt => {
        if (pt.groundElevation > maxElev) maxElev = pt.groundElevation;
        pt.layers.forEach(layer => {
            if (layer.elevationBottom < minElev) minElev = layer.elevationBottom;
        });
    });
    minElev -= 3;

    const traces = [];

    // ============================================
    // soilType 기반 지층 매칭 함수 (동일 지층끼리 연결)
    // ============================================
    function matchLayersBySoilType(layers1, layers2) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();

        // 1단계: 같은 soilType 매칭 (우선)
        layers1.forEach((l1, idx1) => {
            layers2.forEach((l2, idx2) => {
                if (!used1.has(idx1) && !used2.has(idx2) && l1.soilType === l2.soilType) {
                    matches.push({ l1, l2, matchType: 'same' });
                    used1.add(idx1);
                    used2.add(idx2);
                }
            });
        });

        // 2단계: 매칭되지 않은 레이어 처리
        layers1.forEach((l1, idx1) => {
            if (!used1.has(idx1)) {
                matches.push({ l1, l2: null, matchType: 'wedge-out' });
                used1.add(idx1);
            }
        });

        layers2.forEach((l2, idx2) => {
            if (!used2.has(idx2)) {
                matches.push({ l1: null, l2, matchType: 'wedge-in' });
            }
        });

        return matches;
    }

    // 부드러운 보간 폴리곤 생성
    function createSmoothPolygon(dist1, dist2, l1Top, l1Bottom, l2Top, l2Bottom, numPoints) {
        const topX = [], topY = [], bottomX = [], bottomY = [];

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const dist = dist1 + t * (dist2 - dist1);
            const smoothT = t * t * (3 - 2 * t); // smoothstep

            topX.push(dist);
            bottomX.push(dist);
            topY.push(l1Top + smoothT * (l2Top - l1Top));
            bottomY.push(l1Bottom + smoothT * (l2Bottom - l1Bottom));
        }

        const polyX = [...topX, ...bottomX.slice().reverse()];
        const polyY = [...topY, ...bottomY.slice().reverse()];
        polyX.push(polyX[0]);
        polyY.push(polyY[0]);

        return { polyX, polyY };
    }

    // Wedge-out 폴리곤 (소멸하는 지층 - 상단/하단이 하나의 경계선으로 수렴)
    // 핵심 원칙:
    // 1. 소멸하는 지층은 상단과 하단이 "하나의 점(선)"으로 수렴해야 함
    // 2. 수렴점은 인접 시추공의 같은 깊이대에 있는 지층 경계선
    // 3. 지층이 확장되거나 다른 지층을 침범하면 안 됨
    function createWedgeOutPoly(dist1, dist2, layer, direction, numPoints, ground1, ground2, aboveBottom1, aboveBottom2, belowTop1, belowTop2) {
        const polyX = [], polyY = [];

        if (direction === 'right') {
            // 왼쪽 시추공에만 존재하는 지층 → 오른쪽으로 가면서 소멸
            const topStart = layer.elevationTop;
            const bottomStart = layer.elevationBottom;
            const layerThickness = topStart - bottomStart;

            // 수렴점 계산: 지층의 중간 깊이가 인접 시추공에서 어디에 해당하는지
            const midElev = (topStart + bottomStart) / 2;
            const midDepth = ground1 - midElev;

            // 인접 시추공에서 같은 상대 깊이의 표고
            const targetMidElev = ground2 - midDepth;

            // 수렴점: 상단과 하단이 모두 이 점으로 수렴
            // (위/아래 지층 경계 중 더 적절한 값 선택)
            let convergenceElev;
            if (belowTop2 !== null && aboveBottom2 !== null) {
                // 두 경계 사이의 중간점 또는 더 가까운 경계
                convergenceElev = (belowTop2 + aboveBottom2) / 2;
            } else if (belowTop2 !== null) {
                convergenceElev = belowTop2;
            } else if (aboveBottom2 !== null) {
                convergenceElev = aboveBottom2;
            } else {
                convergenceElev = targetMidElev;
            }

            // 상단 경계 (좌→우): 레이어 상단에서 시작 → 수렴점으로
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                // ease-out: 처음에는 천천히, 끝에서 빠르게 수렴
                const smoothT = 1 - Math.pow(1 - t, 3);

                const groundLevel = ground1 + t * (ground2 - ground1);

                // 현재 두께: 처음에는 원래 두께, 끝에서는 0
                const currentThickness = layerThickness * (1 - smoothT);

                // 현재 중심: 시작 중심에서 수렴점으로 이동
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);

                const topElev = currentMidElev + currentThickness / 2;

                polyX.push(dist);
                polyY.push(Math.min(topElev, groundLevel));
            }

            // 하단 경계 (우→좌): 수렴점에서 시작 → 레이어 하단으로
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = 1 - Math.pow(1 - t, 3);

                const currentThickness = layerThickness * (1 - smoothT);
                const currentMidElev = midElev + smoothT * (convergenceElev - midElev);

                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        } else {
            // 오른쪽 시추공에만 존재하는 지층 → 왼쪽에서 시작하여 점점 나타남 (wedge-in)
            const topEnd = layer.elevationTop;
            const bottomEnd = layer.elevationBottom;
            const layerThickness = topEnd - bottomEnd;

            // 목표 지층의 깊이 (오른쪽 시추공 기준)
            const depthTop = ground2 - topEnd;
            const depthBottom = ground2 - bottomEnd;

            // 수렴점: 왼쪽 시추공에서 같은 깊이의 표고 (지표면 아래로 제한)
            let convergenceElev;
            if (belowTop1 !== null && aboveBottom1 !== null) {
                convergenceElev = (belowTop1 + aboveBottom1) / 2;
            } else if (belowTop1 !== null) {
                convergenceElev = belowTop1;
            } else if (aboveBottom1 !== null) {
                convergenceElev = aboveBottom1;
            } else {
                // 같은 깊이 기반 (지층 중심 깊이)
                const midDepth = (depthTop + depthBottom) / 2;
                convergenceElev = ground1 - midDepth;
            }

            // 수렴점이 지표면 위로 나가지 않도록 제한
            convergenceElev = Math.min(convergenceElev, ground1 - 0.1);

            // 상단 경계 (좌→우): 수렴점에서 시작 → 레이어 상단으로
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3); // ease-in

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * smoothT;

                // 깊이 기반 보간: 왼쪽 수렴점 깊이 → 오른쪽 지층 깊이
                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                const topElev = Math.min(currentMidElev + currentThickness / 2, groundLevel - 0.05);

                polyX.push(dist);
                polyY.push(topElev);
            }

            // 하단 경계 (우→좌)
            for (let i = numPoints; i >= 0; i--) {
                const t = i / numPoints;
                const dist = dist1 + t * (dist2 - dist1);
                const smoothT = Math.pow(t, 3);

                const groundLevel = ground1 + t * (ground2 - ground1);
                const currentThickness = layerThickness * smoothT;

                const convergenceDepth = ground1 - convergenceElev;
                const targetMidDepth = (depthTop + depthBottom) / 2;
                const currentMidDepth = convergenceDepth + smoothT * (targetMidDepth - convergenceDepth);
                const currentMidElev = groundLevel - currentMidDepth;

                const bottomElev = currentMidElev - currentThickness / 2;

                polyX.push(dist);
                polyY.push(bottomElev);
            }
        }

        polyX.push(polyX[0]);
        polyY.push(polyY[0]);
        return { polyX, polyY };
    }

    // 전체 단면 최저 표고 계산 (배경 채우기용)
    let globalMinElev = minElev;
    selectedPointsData.forEach(pt => {
        pt.layers.forEach(l => {
            if (l.elevationBottom < globalMinElev) globalMinElev = l.elevationBottom;
        });
    });
    globalMinElev -= 5; // 여유 공간

    // 배경 채우기 (빈틈 방지) - 전체 영역을 기본 암반색으로 먼저 채움
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        // 전체 영역 배경 (암반색)
        const bgResult = createSmoothPolygon(dist1, dist2, pt1.groundElevation, globalMinElev, pt2.groundElevation, globalMinElev, 20);
        traces.push({
            x: bgResult.polyX,
            y: bgResult.polyY,
            fill: 'toself',
            fillcolor: '#808080',  // 기본 암반색 (회색)
            line: { color: 'rgba(0,0,0,0)', width: 0 },
            mode: 'lines',
            showlegend: false,
            hoverinfo: 'skip'
        });
    }

    // soilType 기반 지층 폴리곤 생성
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        if (pt1.layers.length === 0 && pt2.layers.length === 0) continue;

        const matches = matchLayersBySoilType(pt1.layers, pt2.layers);

        matches.forEach(match => {
            const { l1, l2, matchType } = match;
            let polyX, polyY, fillColor, layerLabel;

            if (matchType === 'same' && l1 && l2) {
                // 동일 지층 연결
                const result = createSmoothPolygon(dist1, dist2, l1.elevationTop, l1.elevationBottom, l2.elevationTop, l2.elevationBottom, 20);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = l1.color;
                layerLabel = l1.soilName;
            } else if (matchType === 'wedge-out' && l1) {
                // 왼쪽에만 있는 지층 (자연스럽게 사라짐)
                // 위/아래 지층의 경계를 찾아 빈틈 없이 연결
                const l1Idx = pt1.layers.indexOf(l1);

                // pt1에서 위 지층의 하단 경계
                const aboveLayer1 = l1Idx > 0 ? pt1.layers[l1Idx - 1] : null;
                const aboveBottom1 = aboveLayer1 ? aboveLayer1.elevationBottom : pt1.groundElevation;

                // pt1에서 아래 지층의 상단 경계
                const belowLayer1 = pt1.layers[l1Idx + 1];
                const belowTop1 = belowLayer1 ? belowLayer1.elevationTop : l1.elevationBottom;

                // pt2에서 위 지층의 하단 경계 (상단 목표점)
                // 소멸 지층 상단의 깊이와 비슷한 위치에 있는 지층 경계 찾기
                let aboveBottom2 = null;
                const topDepth = pt1.groundElevation - l1.elevationTop;
                for (let j = 0; j < pt2.layers.length; j++) {
                    const layerBottomDepth = pt2.groundElevation - pt2.layers[j].elevationBottom;
                    if (layerBottomDepth >= topDepth - 1) {
                        aboveBottom2 = pt2.layers[j].elevationBottom;
                        break;
                    }
                }
                if (aboveBottom2 === null) {
                    aboveBottom2 = pt2.groundElevation - topDepth;
                }

                // pt2에서 아래 지층의 상단 경계 (하단 목표점)
                let belowTop2 = null;
                const bottomDepth = pt1.groundElevation - l1.elevationBottom;
                for (let j = 0; j < pt2.layers.length; j++) {
                    const layerTopDepth = pt2.groundElevation - pt2.layers[j].elevationTop;
                    if (layerTopDepth >= bottomDepth - 1) {
                        belowTop2 = pt2.layers[j].elevationTop;
                        break;
                    }
                }
                if (belowTop2 === null) {
                    belowTop2 = pt2.groundElevation - bottomDepth;
                }

                const result = createWedgeOutPoly(dist1, dist2, l1, 'right', 20,
                    pt1.groundElevation, pt2.groundElevation,
                    aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = l1.color;
                layerLabel = `${l1.soilName} (소멸)`;
            } else if (matchType === 'wedge-in' && l2) {
                // 오른쪽에만 있는 지층 (자연스럽게 나타남)
                const l2Idx = pt2.layers.indexOf(l2);

                // pt2에서 위 지층의 하단 경계
                const aboveLayer2 = l2Idx > 0 ? pt2.layers[l2Idx - 1] : null;
                const aboveBottom2 = aboveLayer2 ? aboveLayer2.elevationBottom : pt2.groundElevation;

                // pt2에서 아래 지층의 상단 경계
                const belowLayer2 = pt2.layers[l2Idx + 1];
                const belowTop2 = belowLayer2 ? belowLayer2.elevationTop : l2.elevationBottom;

                // pt1에서 위 지층의 하단 경계 (출발 상단)
                let aboveBottom1 = null;
                const topDepth = pt2.groundElevation - l2.elevationTop;
                for (let j = 0; j < pt1.layers.length; j++) {
                    const layerBottomDepth = pt1.groundElevation - pt1.layers[j].elevationBottom;
                    if (layerBottomDepth >= topDepth - 1) {
                        aboveBottom1 = pt1.layers[j].elevationBottom;
                        break;
                    }
                }
                if (aboveBottom1 === null) {
                    aboveBottom1 = pt1.groundElevation - topDepth;
                }

                // pt1에서 아래 지층의 상단 경계 (출발 하단)
                let belowTop1 = null;
                const bottomDepth = pt2.groundElevation - l2.elevationBottom;
                for (let j = 0; j < pt1.layers.length; j++) {
                    const layerTopDepth = pt1.groundElevation - pt1.layers[j].elevationTop;
                    if (layerTopDepth >= bottomDepth - 1) {
                        belowTop1 = pt1.layers[j].elevationTop;
                        break;
                    }
                }
                if (belowTop1 === null) {
                    belowTop1 = pt1.groundElevation - bottomDepth;
                }

                const result = createWedgeOutPoly(dist1, dist2, l2, 'left', 20,
                    pt1.groundElevation, pt2.groundElevation,
                    aboveBottom1, aboveBottom2, belowTop1, belowTop2);
                polyX = result.polyX;
                polyY = result.polyY;
                fillColor = l2.color;
                layerLabel = `${l2.soilName} (출현)`;
            }

            if (polyX && polyY && polyX.length > 3) {
                traces.push({
                    x: polyX,
                    y: polyY,
                    fill: 'toself',
                    fillcolor: fillColor,
                    line: { color: 'rgba(0,0,0,0.3)', width: 0.5 },
                    mode: 'lines',
                    showlegend: false,
                    hoverinfo: 'text',
                    text: layerLabel
                });
            }
        });
    }

    // 시추공 기둥
    const columnWidth = Math.max(5, Math.min(15, maxDist * 0.02));
    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];
        pt.layers.forEach(layer => {
            traces.push({
                x: [dist - columnWidth/2, dist + columnWidth/2, dist + columnWidth/2, dist - columnWidth/2, dist - columnWidth/2],
                y: [layer.elevationTop, layer.elevationTop, layer.elevationBottom, layer.elevationBottom, layer.elevationTop],
                fill: 'toself',
                fillcolor: layer.color,
                line: { color: '#222', width: 1.5 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'text',
                text: `${layer.soilName}<br>EL.${layer.elevationTop.toFixed(1)}~${layer.elevationBottom.toFixed(1)}m`
            });
        });
    });

    // 시추공 마커
    selectedPointsData.forEach((pt, idx) => {
        traces.push({
            x: [cumulativeDistances[idx]],
            y: [pt.groundElevation],
            mode: 'markers+text',
            marker: { size: 10, color: '#D32F2F', symbol: 'triangle-down' },
            text: [pt.holeNo],
            textposition: 'top center',
            showlegend: false
        });
    });

    const layout = {
        title: { text: `지반 단면도 (${mapSelectedBoreholes.join(' → ')})`, font: { size: 14 } },
        xaxis: { title: '거리 (m)' },
        yaxis: { title: '표고 (E.L. m)', scaleanchor: 'x', scaleratio: 1 },
        height: 400,
        margin: { l: 60, r: 30, t: 40, b: 50 },
        showlegend: false
    };

    Plotly.newPlot('mapCrossSectionPlot', traces, layout, { responsive: true, scrollZoom: true });

    // 원래 selectedBoreholes 복원
    selectedBoreholes = originalSelected;
}

// ===== 분석 섹션용 2D 등고선 맵 =====
/**
 * 분석 결과에 표시할 2D 등고선 맵 생성 (2D 등고선 맵과 동일한 방식)
 * @param {string} targetElementId - 맵을 표시할 div의 ID
 * @param {string} contourType - 등고선 타입 (ground_elevation, bedrock_elevation 등)
 * @param {Array} markerData - 시추공별 마커 색상 데이터 [{holeNo, color, status, isDetected}]
 */
function createMiniContourMap(targetElementId, contourType, markerData) {
    const targetEl = document.getElementById(targetElementId);
    if (!targetEl) return;

    if (!window.visualizationData || !window.visualizationData.contour_data) {
        targetEl.innerHTML = '<div style="text-align:center; padding:50px; color:#888;">등고선 데이터가 없습니다.</div>';
        return;
    }

    const data = window.visualizationData.contour_data[contourType];
    if (!data) {
        targetEl.innerHTML = '<div style="text-align:center; padding:50px; color:#888;">해당 타입의 등고선 데이터가 없습니다.</div>';
        return;
    }

    // WGS84로 변환 (2D 등고선 맵과 동일)
    const wgs84X = [];
    const wgs84Y = [];
    for (let i = 0; i < data.x.length; i++) {
        const wgs84 = typeof transformToWGS84Universal === 'function' ?
            transformToWGS84Universal(data.x[i], data.y[i]) : null;
        if (wgs84) {
            wgs84X.push(wgs84.lng);
            wgs84Y.push(wgs84.lat);
        } else {
            wgs84X.push(data.x[i]);
            wgs84Y.push(data.y[i]);
        }
    }

    // Z 값 범위 계산
    let zMin = Infinity, zMax = -Infinity;
    data.z.forEach(row => {
        row.forEach(val => {
            if (val !== null && !isNaN(val)) {
                if (val < zMin) zMin = val;
                if (val > zMax) zMax = val;
            }
        });
    });

    const traces = [];

    // 등고선 (2D 맵과 동일한 스타일)
    traces.push({
        z: data.z,
        x: wgs84X,
        y: wgs84Y,
        type: 'contour',
        colorscale: 'Viridis',
        contours: {
            coloring: 'heatmap',
            showlabels: true,
            labelfont: { size: 10, color: 'white' },
            start: Math.floor(zMin),
            end: Math.ceil(zMax),
            size: 1
        },
        line: { width: 1, smoothing: 1.3 },
        showscale: true,
        colorbar: {
            title: '지표고 (m)',
            titleside: 'right',
            tickfont: { size: 10 },
            len: 0.8
        }
    });

    // 시추공 마커 (탐지된 시추공 강조 표시)
    if (boreholeData && boreholeData.length > 0) {
        // 일반 시추공 (탐지되지 않은 것)
        const normalBoreholes = [];
        // 탐지된 시추공 (강조 표시)
        const detectedBoreholes = [];

        boreholeData.forEach((b, index) => {
            const coordX = parseFloat(b.x) || 0;
            const coordY = parseFloat(b.y) || 0;
            const wgs84 = typeof transformToWGS84Universal === 'function' ?
                transformToWGS84Universal(coordX, coordY) : null;

            const boreholeInfo = {
                x: wgs84 ? wgs84.lng : coordX,
                y: wgs84 ? wgs84.lat : coordY,
                holeNo: b.holeNo
            };

            // 마커 데이터에서 탐지 여부 확인
            if (markerData) {
                const marker = markerData.find(m => m.holeNo === b.holeNo);
                if (marker && marker.isDetected) {
                    boreholeInfo.color = marker.color;
                    boreholeInfo.status = marker.status;
                    detectedBoreholes.push(boreholeInfo);
                } else {
                    boreholeInfo.color = '#9E9E9E';
                    normalBoreholes.push(boreholeInfo);
                }
            } else {
                normalBoreholes.push(boreholeInfo);
            }
        });

        // 일반 시추공 (작은 회색 마커)
        if (normalBoreholes.length > 0) {
            traces.push({
                x: normalBoreholes.map(b => b.x),
                y: normalBoreholes.map(b => b.y),
                mode: 'markers+text',
                type: 'scatter',
                marker: {
                    size: 8,
                    color: '#9E9E9E',
                    line: { width: 1, color: '#FFF' }
                },
                text: normalBoreholes.map(b => b.holeNo),
                textposition: 'top center',
                textfont: { size: 8, color: '#666' },
                hoverinfo: 'text',
                name: '시추공'
            });
        }

        // 탐지된 시추공 (큰 색상 마커 + 강조)
        if (detectedBoreholes.length > 0) {
            traces.push({
                x: detectedBoreholes.map(b => b.x),
                y: detectedBoreholes.map(b => b.y),
                mode: 'markers+text',
                type: 'scatter',
                marker: {
                    size: 14,
                    color: detectedBoreholes.map(b => b.color),
                    line: { width: 2, color: '#FFF' },
                    symbol: 'circle'
                },
                text: detectedBoreholes.map(b => b.holeNo),
                textposition: 'top center',
                textfont: { size: 10, color: '#333', weight: 'bold' },
                hovertemplate: '%{text}<br>%{customdata}<extra></extra>',
                customdata: detectedBoreholes.map(b => b.status),
                name: '탐지됨'
            });
        }
    }

    const layout = {
        margin: { l: 50, r: 80, t: 20, b: 50 },
        xaxis: {
            title: '경도',
            showgrid: true,
            gridcolor: '#E0E0E0',
            tickfont: { size: 10 }
        },
        yaxis: {
            title: '위도',
            showgrid: true,
            gridcolor: '#E0E0E0',
            scaleanchor: 'x',
            scaleratio: 1,
            tickfont: { size: 10 }
        },
        showlegend: false,
        hovermode: 'closest'
    };

    Plotly.newPlot(targetElementId, traces, layout, {
        responsive: true,
        displayModeBar: true,
        scrollZoom: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    }).then(function() {
        // 시추공 클릭 이벤트 추가 (단면도 생성)
        const plotEl = document.getElementById(targetElementId);
        if (plotEl) {
            plotEl.on('plotly_click', function(data) {
                // 시추공 마커 클릭 확인
                if (data.points && data.points.length > 0) {
                    const point = data.points[0];
                    const holeNo = point.text;
                    if (holeNo && boreholeData) {
                        const bh = boreholeData.find(b => b.holeNo === holeNo);
                        if (bh) {
                            // 해당 분석 섹션의 단면도 컨테이너 찾기
                            const sectionId = targetElementId.replace('MiniMap', 'CrossSection');
                            generateAnalysisCrossSection(sectionId, holeNo);
                        }
                    }
                }
            });
        }
    });
}

/**
 * 분석 섹션별 시추공 선택 토글
 * @param {string} analysisType - 분석 타입 (depth, weakSoil, boulder, foundation)
 * @param {string} holeNo - 시추공 번호
 */
function toggleAnalysisBoreholeSelection(analysisType, holeNo) {
    if (!analysisSelectedBoreholes[analysisType]) return;

    const idx = analysisSelectedBoreholes[analysisType].indexOf(holeNo);
    if (idx >= 0) {
        // 이미 선택됨 -> 제거
        analysisSelectedBoreholes[analysisType].splice(idx, 1);
    } else {
        // 선택 안됨 -> 추가
        analysisSelectedBoreholes[analysisType].push(holeNo);
    }

    // 선택된 시추공 표시 업데이트
    updateAnalysisSelectedDisplay(analysisType);

    // 2개 이상 선택시 단면도 자동 생성
    if (analysisSelectedBoreholes[analysisType].length >= 2) {
        const sectionId = analysisType === 'depth' ? 'depthCrossSection' :
                          analysisType === 'weakSoil' ? 'weakSoilCrossSection' :
                          analysisType === 'boulder' ? 'boulderCrossSection' :
                          'foundationCrossSection';
        generateAnalysisCrossSectionMulti(sectionId, analysisType);
    } else {
        // 1개 이하면 안내 메시지
        const sectionId = analysisType === 'depth' ? 'depthCrossSection' :
                          analysisType === 'weakSoil' ? 'weakSoilCrossSection' :
                          analysisType === 'boulder' ? 'boulderCrossSection' :
                          'foundationCrossSection';
        const targetEl = document.getElementById(sectionId);
        if (targetEl) {
            targetEl.innerHTML = '<div style="text-align: center; padding: 50px; color: #888;">시추공을 2개 이상 선택하면 단면도가 생성됩니다.</div>';
        }
    }

    // 등고선 맵에서 선택 상태 표시 업데이트
    updateMiniMapMarkerStyles(analysisType);
}

/**
 * 선택된 시추공 표시 업데이트
 */
function updateAnalysisSelectedDisplay(analysisType) {
    const displayId = analysisType === 'depth' ? 'depthSelectedBoreholes' :
                      analysisType === 'weakSoil' ? 'weakSoilSelectedBoreholes' :
                      analysisType === 'boulder' ? 'boulderSelectedBoreholes' :
                      'foundationSelectedBoreholes';

    const displayEl = document.getElementById(displayId);
    if (!displayEl) return;

    const selected = analysisSelectedBoreholes[analysisType] || [];
    if (selected.length === 0) {
        displayEl.textContent = '없음';
        displayEl.style.color = '#666';
    } else {
        displayEl.textContent = selected.join(' -> ');
        displayEl.style.color = '#4CAF50';
    }
}

/**
 * 분석 섹션 단면도 초기화
 */
function resetAnalysisCrossSection(analysisType) {
    if (!analysisSelectedBoreholes[analysisType]) return;

    // 선택 초기화
    analysisSelectedBoreholes[analysisType] = [];

    // 표시 업데이트
    updateAnalysisSelectedDisplay(analysisType);

    // 단면도 영역 초기화
    const sectionId = analysisType === 'depth' ? 'depthCrossSection' :
                      analysisType === 'weakSoil' ? 'weakSoilCrossSection' :
                      analysisType === 'boulder' ? 'boulderCrossSection' :
                      'foundationCrossSection';
    const targetEl = document.getElementById(sectionId);
    if (targetEl) {
        targetEl.innerHTML = '<div style="text-align: center; padding: 50px; color: #888;">시추공을 2개 이상 선택하면 단면도가 생성됩니다.</div>';
    }

    // 등고선 맵 마커 스타일 초기화
    updateMiniMapMarkerStyles(analysisType);
}

/**
 * 미니맵 마커 스타일 업데이트 (선택 상태 표시)
 */
function updateMiniMapMarkerStyles(analysisType) {
    const mapId = analysisType === 'depth' ? 'depthMiniMap' :
                  analysisType === 'weakSoil' ? 'weakSoilMiniMap' :
                  analysisType === 'boulder' ? 'boulderMiniMap' :
                  'foundationMiniMap';

    const plotEl = document.getElementById(mapId);
    if (!plotEl || !plotEl.data) return;

    const selected = analysisSelectedBoreholes[analysisType] || [];

    // 마커 데이터 찾기 (시추공 마커 trace)
    const traceIndex = plotEl.data.findIndex(trace => trace.mode === 'markers+text' || trace.mode === 'markers');
    if (traceIndex < 0) return;

    const trace = plotEl.data[traceIndex];
    if (!trace.text || !Array.isArray(trace.text)) return;

    // 선택된 시추공의 마커 크기/스타일 변경
    const newSizes = trace.text.map(holeNo => selected.includes(holeNo) ? 14 : 10);
    const newLineWidths = trace.text.map(holeNo => selected.includes(holeNo) ? 3 : 1);
    const newLineColors = trace.text.map(holeNo => selected.includes(holeNo) ? '#FF5722' : 'white');

    Plotly.restyle(mapId, {
        'marker.size': [newSizes],
        'marker.line.width': [newLineWidths],
        'marker.line.color': [newLineColors]
    }, [traceIndex]);
}

/**
 * 분석 섹션용 다중 선택 단면도 생성
 * @param {string} targetId - 단면도를 표시할 div ID
 * @param {string} analysisType - 분석 타입
 */
function generateAnalysisCrossSectionMulti(targetId, analysisType) {
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    const selectedHoles = analysisSelectedBoreholes[analysisType] || [];
    if (selectedHoles.length < 2) {
        targetEl.innerHTML = '<div style="text-align: center; padding: 50px; color: #888;">시추공을 2개 이상 선택하면 단면도가 생성됩니다.</div>';
        return;
    }

    // 단면도 데이터 생성 (기존 로직 활용)
    generateAnalysisCrossSectionFromHoles(targetId, selectedHoles);
}

/**
 * 분석 섹션용 단면도 생성 (호환성 유지 - 단일 클릭 시)
 * @param {string} targetId - 단면도를 표시할 div ID
 * @param {string} clickedHoleNo - 클릭한 시추공 번호
 */
function generateAnalysisCrossSection(targetId, clickedHoleNo) {
    // 분석 타입 추출
    const analysisType = targetId.includes('depth') ? 'depth' :
                         targetId.includes('weakSoil') ? 'weakSoil' :
                         targetId.includes('boulder') ? 'boulder' :
                         'foundation';

    // 다중 선택 모드로 토글
    toggleAnalysisBoreholeSelection(analysisType, clickedHoleNo);
}

/**
 * 표준 지층 스타일 정의 (SOIL_PROFILE_ALGORITHM.md 기반)
 * order: 지층 순서 (상부→하부, 낮은 번호가 상부)
 */
const SOIL_STYLES = {
    '매립층':     { order: 1, color: '#8B7355', pattern: 'fill' },
    '매립토':     { order: 1, color: '#8B7355', pattern: 'fill' },
    '성토층':     { order: 1, color: '#8B6914', pattern: 'fill' },
    '붕적층':     { order: 2, color: '#D2B48C', pattern: 'colluvium' },
    '붕적토':     { order: 2, color: '#D2B48C', pattern: 'colluvium' },
    '퇴적층':     { order: 3, color: '#F4A460', pattern: 'sediment' },
    '충적층':     { order: 3, color: '#E8C496', pattern: 'sediment' },
    '점토':       { order: 3, color: '#C4A484', pattern: 'clay' },
    '점토층':     { order: 3, color: '#C4A484', pattern: 'clay' },
    '실트':       { order: 3, color: '#DEB887', pattern: 'silt' },
    '실트층':     { order: 3, color: '#DEB887', pattern: 'silt' },
    '모래':       { order: 3, color: '#F5DEB3', pattern: 'sand' },
    '모래층':     { order: 3, color: '#F5DEB3', pattern: 'sand' },
    '사질토':     { order: 3, color: '#F5DEB3', pattern: 'sand' },
    '자갈':       { order: 3, color: '#D2B48C', pattern: 'gravel' },
    '자갈층':     { order: 3, color: '#D2B48C', pattern: 'gravel' },
    '풍화잔류토': { order: 4, color: '#CD853F', pattern: 'residual' },
    '풍화토':     { order: 4, color: '#CD853F', pattern: 'residual' },
    '잔류토':     { order: 4, color: '#CD853F', pattern: 'residual' },
    '풍화암':     { order: 5, color: '#BC8F8F', pattern: 'weathered_rock' },
    '연암':       { order: 6, color: '#A9A9A9', pattern: 'soft_rock' },
    '보통암':     { order: 7, color: '#808080', pattern: 'medium_rock' },
    '경암':       { order: 8, color: '#696969', pattern: 'hard_rock' },
    '암반':       { order: 8, color: '#5A5A5A', pattern: 'hard_rock' }
};

/**
 * 지층명 정규화 (층, 반 등 제거)
 */
function normalizeSoilName(name) {
    if (!name) return '';
    return name.replace(/층$/, '').replace(/반$/, '').replace(/질$/, '').trim();
}

/**
 * 지층 스타일 가져오기
 */
function getSoilStyle(soilName) {
    if (!soilName) return { order: 99, color: '#AAAAAA', pattern: 'unknown' };

    // 정확한 매칭
    if (SOIL_STYLES[soilName]) return SOIL_STYLES[soilName];

    // 정규화된 이름으로 매칭
    const normalized = normalizeSoilName(soilName);
    if (SOIL_STYLES[normalized]) return SOIL_STYLES[normalized];

    // 키워드 기반 매칭
    const name = soilName.toLowerCase();
    if (name.includes('매립') || name.includes('fill') || name.includes('성토')) {
        return { order: 1, color: '#8B7355', pattern: 'fill' };
    }
    if (name.includes('붕적') || name.includes('colluvium') || name.includes('talus')) {
        return { order: 2, color: '#D2B48C', pattern: 'colluvium' };
    }
    if (name.includes('점토') || name.includes('clay')) {
        return { order: 3, color: '#C4A484', pattern: 'clay' };
    }
    if (name.includes('실트') || name.includes('silt')) {
        return { order: 3, color: '#DEB887', pattern: 'silt' };
    }
    if (name.includes('모래') || name.includes('sand') || name.includes('사질')) {
        return { order: 3, color: '#F5DEB3', pattern: 'sand' };
    }
    if (name.includes('자갈') || name.includes('gravel')) {
        return { order: 3, color: '#D2B48C', pattern: 'gravel' };
    }
    if (name.includes('잔류') || name.includes('풍화토') || name.includes('residual')) {
        return { order: 4, color: '#CD853F', pattern: 'residual' };
    }
    if (name.includes('풍화암') || name.includes('weathered')) {
        return { order: 5, color: '#BC8F8F', pattern: 'weathered_rock' };
    }
    if (name.includes('연암') || name.includes('soft rock')) {
        return { order: 6, color: '#A9A9A9', pattern: 'soft_rock' };
    }
    if (name.includes('보통암') || name.includes('medium')) {
        return { order: 7, color: '#808080', pattern: 'medium_rock' };
    }
    if (name.includes('경암') || name.includes('hard') || name.includes('암반')) {
        return { order: 8, color: '#696969', pattern: 'hard_rock' };
    }

    return { order: 99, color: '#AAAAAA', pattern: 'unknown' };
}

/**
 * 선택된 시추공들로 상세 단면도 생성 (SOIL_PROFILE_ALGORITHM.md 기반)
 * - 지층명 기반 매칭 우선 (동일한 지층은 반드시 연결)
 * - order 기반 보조 매칭
 * - 시추공 컬럼 경계에서 레이어 연결 (스파이크 방지)
 * - pinch_out / pinch_in 처리
 * @param {string} targetId - 단면도를 표시할 div ID
 * @param {Array} selectedHoles - 선택된 시추공 번호 배열
 */
function generateAnalysisCrossSectionFromHoles(targetId, selectedHoles) {
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    if (selectedHoles.length < 2) {
        targetEl.innerHTML = '<div style="text-align: center; padding: 50px; color: #888;">시추공을 2개 이상 선택하면 단면도가 생성됩니다.</div>';
        return;
    }

    // 선택된 시추공 데이터 준비
    const selectedPointsData = selectedHoles.map(holeNo => {
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (!bh) return null;

        const rawLayers = typeof getDetailedLayers === 'function' ? getDetailedLayers(bh) : (bh.layers || bh.soilLayers || bh.soilData || []);
        const groundElev = parseFloat(bh.groundElevation || 0);

        // 레이어 데이터 정규화
        const layers = rawLayers.map(layer => {
            const soilName = layer.soilName || layer.label || layer.name || layer.soil_name || '미분류';
            const style = getSoilStyle(soilName);

            // 심도 정보 파싱
            let startDepth = 0, endDepth = 0;
            if (layer.depthTop !== undefined && layer.depth !== undefined) {
                startDepth = parseFloat(layer.depthTop) || 0;
                endDepth = parseFloat(layer.depth) || 0;
            } else if (layer.depth_range) {
                const match = layer.depth_range.match(/(\d+\.?\d*)\s*[~\-]\s*(\d+\.?\d*)/);
                if (match) {
                    startDepth = parseFloat(match[1]);
                    endDepth = parseFloat(match[2]);
                }
            } else if (layer.elevationTop !== undefined && layer.elevationBottom !== undefined) {
                startDepth = groundElev - layer.elevationTop;
                endDepth = groundElev - layer.elevationBottom;
            }

            return {
                soilName: soilName,
                normalizedName: normalizeSoilName(soilName),
                startDepth: startDepth,
                endDepth: endDepth,
                thickness: endDepth - startDepth,
                elevationTop: groundElev - startDepth,
                elevationBottom: groundElev - endDepth,
                style: style,
                color: layer.color || style.color,
                samples: layer.samples || []
            };
        }).filter(l => l.thickness > 0).sort((a, b) => a.startDepth - b.startDepth); // 깊이 순으로 정렬

        // 지하수위
        let waterLevel = null;
        if (bh.gwl !== undefined && bh.gwl !== null && bh.gwl !== '-') {
            waterLevel = parseFloat(bh.gwl);
        } else if (bh.groundwaterLevel !== undefined && bh.groundwaterLevel !== null) {
            waterLevel = parseFloat(bh.groundwaterLevel);
        }

        return {
            holeNo,
            x: parseFloat(bh.x),
            y: parseFloat(bh.y),
            groundElevation: groundElev,
            totalDepth: parseFloat(bh.totalDepth || 0),
            waterLevel: waterLevel,
            layers: layers
        };
    }).filter(p => p !== null && !isNaN(p.x) && !isNaN(p.y) && p.layers.length > 0);

    if (selectedPointsData.length < 2) {
        targetEl.innerHTML = '<div style="text-align: center; padding: 50px; color: #888;">유효한 시추공이 2개 이상 필요합니다.</div>';
        return;
    }

    // 누적 거리 계산
    let cumulativeDistances = [0];
    for (let i = 1; i < selectedPointsData.length; i++) {
        const prev = selectedPointsData[i - 1];
        const curr = selectedPointsData[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }

    const maxDist = cumulativeDistances[cumulativeDistances.length - 1];
    const traces = [];

    // 표고 범위 계산
    let minElev = Infinity, maxElev = -Infinity;
    selectedPointsData.forEach(pt => {
        if (pt.groundElevation > maxElev) maxElev = pt.groundElevation;
        pt.layers.forEach(layer => {
            if (layer.elevationBottom < minElev) minElev = layer.elevationBottom;
        });
    });
    minElev -= 2;
    maxElev += 2;

    // 시추공 컬럼 폭 계산 (거리에 비례)
    const BOREHOLE_WIDTH_RATIO = 0.03; // 전체 거리의 3%
    const boreholeWidth = Math.max(5, Math.min(20, maxDist * BOREHOLE_WIDTH_RATIO));
    const halfWidth = boreholeWidth / 2;

    /**
     * 레이어 매칭 알고리즘 (SOIL_PROFILE_ALGORITHM.md 기반)
     * 1순위: 지층명 완전 일치
     * 2순위: 정규화 이름 일치
     * 3순위: order(지층 순서) 일치
     * 4순위: pinch_out / pinch_in
     */
    function matchLayers(borehole1, borehole2) {
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();

        const layers1 = borehole1.layers.slice().sort((a, b) => a.style.order - b.style.order);
        const layers2 = borehole2.layers.slice().sort((a, b) => a.style.order - b.style.order);

        // 1단계: 지층명 완전 일치
        layers1.forEach((l1, idx1) => {
            layers2.forEach((l2, idx2) => {
                if (used1.has(idx1) || used2.has(idx2)) return;
                if (l1.soilName === l2.soilName) {
                    used1.add(idx1);
                    used2.add(idx2);
                    matches.push({ layer1: l1, layer2: l2, connectionType: 'continuous' });
                }
            });
        });

        // 2단계: 정규화 이름 일치
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;
            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;
                if (l1.normalizedName === l2.normalizedName && l1.normalizedName !== '') {
                    used1.add(idx1);
                    used2.add(idx2);
                    matches.push({ layer1: l1, layer2: l2, connectionType: 'continuous' });
                }
            });
        });

        // 3단계: order(지층 순서) 일치
        layers1.forEach((l1, idx1) => {
            if (used1.has(idx1)) return;
            layers2.forEach((l2, idx2) => {
                if (used2.has(idx2)) return;
                if (l1.style.order === l2.style.order) {
                    used1.add(idx1);
                    used2.add(idx2);
                    matches.push({ layer1: l1, layer2: l2, connectionType: 'continuous' });
                }
            });
        });

        // 4단계: 미매칭 레이어 처리 (pinch_out / pinch_in)
        layers1.forEach((l1, idx1) => {
            if (!used1.has(idx1)) {
                matches.push({ layer1: l1, layer2: null, connectionType: 'pinch_out_right' });
            }
        });

        layers2.forEach((l2, idx2) => {
            if (!used2.has(idx2)) {
                matches.push({ layer1: null, layer2: l2, connectionType: 'pinch_in_left' });
            }
        });

        return matches;
    }

    /**
     * 연결 레이어 그리기 (컬럼 경계에서 연결 - 스파이크 방지)
     */
    function drawConnectedLayer(dist1, dist2, gl1, layer1, gl2, layer2) {
        // 시추공 컬럼 경계에서 연결 (중심이 아닌 경계)
        const x1 = dist1 + halfWidth;  // 왼쪽 시추공 오른쪽 경계
        const x2 = dist2 - halfWidth;  // 오른쪽 시추공 왼쪽 경계

        const y1Top = gl1 - layer1.startDepth;
        const y1Bottom = gl1 - layer1.endDepth;
        const y2Top = gl2 - layer2.startDepth;
        const y2Bottom = gl2 - layer2.endDepth;

        return {
            polyX: [x1, x2, x2, x1, x1],
            polyY: [y1Top, y2Top, y2Bottom, y1Bottom, y1Top]
        };
    }

    /**
     * Pinch-out 레이어 그리기 (한쪽에만 존재하는 레이어 → 소멸)
     *
     * 핵심 원리:
     * - 소멸하는 레이어는 옆 시추공의 최하단 레이어 하부로 자연스럽게 수렴해야 함
     * - 중간에서 뾰족하게 튀어나오지 않도록 옆 시추공 기둥 경계에서 수렴점 결정
     */
    function drawPinchOutLayer(dist1, dist2, gl1, layer, direction, matches, gl2, targetBorehole) {
        const x1 = dist1 + halfWidth;
        const x2 = dist2 - halfWidth;

        if (direction === 'right') {
            // 왼쪽에만 있는 레이어가 오른쪽으로 소멸
            const y1Top = gl1 - layer.startDepth;
            const y1Bottom = gl1 - layer.endDepth;

            // 수렴점 결정: 옆 시추공의 최하단 레이어 하부 또는 상부
            let convergenceYTop, convergenceYBottom;

            // 연속 레이어 중 해당 레이어와 인접한 것 찾기
            const continuousMatches = matches.filter(m => m.connectionType === 'continuous' && m.layer2);

            if (continuousMatches.length > 0) {
                // 가장 가까운 상부/하부 연속 레이어 찾기
                const aboveMatch = continuousMatches
                    .filter(m => m.layer1 && m.layer1.endDepth <= layer.startDepth)
                    .sort((a, b) => b.layer1.endDepth - a.layer1.endDepth)[0];

                const belowMatch = continuousMatches
                    .filter(m => m.layer1 && m.layer1.startDepth >= layer.endDepth)
                    .sort((a, b) => a.layer1.startDepth - b.layer1.startDepth)[0];

                if (aboveMatch && belowMatch) {
                    // 상부와 하부 연속 레이어 사이로 수렴
                    convergenceYTop = gl2 - aboveMatch.layer2.endDepth;
                    convergenceYBottom = gl2 - belowMatch.layer2.startDepth;
                } else if (belowMatch) {
                    // 하부 연속 레이어 상부로 수렴
                    convergenceYTop = gl2 - belowMatch.layer2.startDepth;
                    convergenceYBottom = convergenceYTop;
                } else if (aboveMatch) {
                    // 상부 연속 레이어 하부로 수렴 (최하단 레이어 소멸 시)
                    convergenceYTop = gl2 - aboveMatch.layer2.endDepth;
                    convergenceYBottom = convergenceYTop;
                } else {
                    // 옆 시추공의 최하단으로 수렴
                    const targetBottomElev = targetBorehole && targetBorehole.layers.length > 0
                        ? Math.min(...targetBorehole.layers.map(l => l.elevationBottom))
                        : gl2 - layer.endDepth;
                    convergenceYTop = targetBottomElev;
                    convergenceYBottom = targetBottomElev;
                }
            } else {
                // 연속 레이어가 없으면 옆 시추공의 최하단으로 수렴
                const targetBottomElev = targetBorehole && targetBorehole.layers.length > 0
                    ? Math.min(...targetBorehole.layers.map(l => l.elevationBottom))
                    : gl2 - layer.endDepth;
                convergenceYTop = targetBottomElev;
                convergenceYBottom = targetBottomElev;
            }

            // 사다리꼴 형태로 자연스럽게 수렴 (스파이크 방지)
            return {
                polyX: [x1, x2, x2, x1, x1],
                polyY: [y1Top, convergenceYTop, convergenceYBottom, y1Bottom, y1Top]
            };

        } else {
            // 오른쪽에만 있는 레이어가 왼쪽에서 출현 (pinch-in)
            const y2Top = gl2 - layer.startDepth;
            const y2Bottom = gl2 - layer.endDepth;

            let convergenceYTop, convergenceYBottom;

            const continuousMatches = matches.filter(m => m.connectionType === 'continuous' && m.layer1);

            if (continuousMatches.length > 0) {
                const aboveMatch = continuousMatches
                    .filter(m => m.layer2 && m.layer2.endDepth <= layer.startDepth)
                    .sort((a, b) => b.layer2.endDepth - a.layer2.endDepth)[0];

                const belowMatch = continuousMatches
                    .filter(m => m.layer2 && m.layer2.startDepth >= layer.endDepth)
                    .sort((a, b) => a.layer2.startDepth - b.layer2.startDepth)[0];

                if (aboveMatch && belowMatch) {
                    convergenceYTop = gl1 - aboveMatch.layer1.endDepth;
                    convergenceYBottom = gl1 - belowMatch.layer1.startDepth;
                } else if (belowMatch) {
                    convergenceYTop = gl1 - belowMatch.layer1.startDepth;
                    convergenceYBottom = convergenceYTop;
                } else if (aboveMatch) {
                    convergenceYTop = gl1 - aboveMatch.layer1.endDepth;
                    convergenceYBottom = convergenceYTop;
                } else {
                    const sourceBottomElev = targetBorehole && targetBorehole.layers.length > 0
                        ? Math.min(...targetBorehole.layers.map(l => l.elevationBottom))
                        : gl1 - layer.endDepth;
                    convergenceYTop = sourceBottomElev;
                    convergenceYBottom = sourceBottomElev;
                }
            } else {
                const sourceBottomElev = targetBorehole && targetBorehole.layers.length > 0
                    ? Math.min(...targetBorehole.layers.map(l => l.elevationBottom))
                    : gl1 - layer.endDepth;
                convergenceYTop = sourceBottomElev;
                convergenceYBottom = sourceBottomElev;
            }

            return {
                polyX: [x1, x2, x2, x1, x1],
                polyY: [convergenceYTop, y2Top, y2Bottom, convergenceYBottom, convergenceYTop]
            };
        }
    }

    // 각 세그먼트별 지층 렌더링
    for (let segIdx = 0; segIdx < selectedPointsData.length - 1; segIdx++) {
        const pt1 = selectedPointsData[segIdx];
        const pt2 = selectedPointsData[segIdx + 1];
        const dist1 = cumulativeDistances[segIdx];
        const dist2 = cumulativeDistances[segIdx + 1];

        const matches = matchLayers(pt1, pt2);

        matches.forEach(match => {
            const { layer1, layer2, connectionType } = match;
            let polyResult, fillColor, layerLabel;
            let lineStyle = { color: 'rgba(0,0,0,0.4)', width: 0.8 };

            if (connectionType === 'continuous') {
                polyResult = drawConnectedLayer(
                    dist1, dist2,
                    pt1.groundElevation, layer1,
                    pt2.groundElevation, layer2
                );
                fillColor = layer1.color;
                layerLabel = layer1.soilName;

            } else if (connectionType === 'pinch_out_right') {
                // pt2(오른쪽 시추공)로 수렴
                polyResult = drawPinchOutLayer(
                    dist1, dist2,
                    pt1.groundElevation, layer1, 'right',
                    matches, pt2.groundElevation, pt2
                );
                fillColor = layer1.color;
                layerLabel = `${layer1.soilName} (소멸)`;
                lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };

            } else if (connectionType === 'pinch_in_left') {
                // pt1(왼쪽 시추공)에서 출현
                polyResult = drawPinchOutLayer(
                    dist1, dist2,
                    pt2.groundElevation, layer2, 'left',
                    matches, pt1.groundElevation, pt1
                );
                fillColor = layer2.color;
                layerLabel = `${layer2.soilName} (출현)`;
                lineStyle = { color: 'rgba(0,0,0,0.3)', width: 0.5, dash: 'dot' };
            }

            if (polyResult && polyResult.polyX.length > 2) {
                traces.push({
                    x: polyResult.polyX,
                    y: polyResult.polyY,
                    fill: 'toself',
                    fillcolor: fillColor,
                    line: lineStyle,
                    mode: 'lines',
                    showlegend: false,
                    hoverinfo: 'text',
                    text: layerLabel,
                    hoverlabel: { bgcolor: 'rgba(255,255,255,0.95)', font: { size: 10, color: '#333' }, bordercolor: fillColor }
                });
            }
        });
    }

    // 시추공 컬럼 렌더링 (레이어 채움 위에)
    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];

        pt.layers.forEach(layer => {
            const y1 = layer.elevationTop;
            const y2 = layer.elevationBottom;

            // 시추공 컬럼 (직사각형)
            traces.push({
                x: [dist - halfWidth, dist + halfWidth, dist + halfWidth, dist - halfWidth, dist - halfWidth],
                y: [y1, y1, y2, y2, y1],
                fill: 'toself',
                fillcolor: layer.color,
                line: { color: '#222', width: 1 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'text',
                text: `${layer.soilName}<br>GL(-) ${layer.startDepth.toFixed(1)}~${layer.endDepth.toFixed(1)}m<br>EL. ${y1.toFixed(1)}~${y2.toFixed(1)}m`
            });
        });
    });

    // 시추공 마커 및 라벨
    selectedPointsData.forEach((pt, idx) => {
        const dist = cumulativeDistances[idx];

        // 시추공 이름 라벨
        traces.push({
            x: [dist],
            y: [pt.groundElevation + 1.5],
            mode: 'text',
            text: [pt.holeNo],
            textfont: { size: 10, color: '#333', family: 'Arial Black' },
            showlegend: false,
            hoverinfo: 'skip'
        });

        // 지표고 라벨
        traces.push({
            x: [dist],
            y: [pt.groundElevation + 0.5],
            mode: 'text',
            text: [`E.L.${pt.groundElevation.toFixed(1)}m`],
            textfont: { size: 8, color: '#666' },
            showlegend: false,
            hoverinfo: 'skip'
        });

        // 지표면 삼각형 마커
        traces.push({
            x: [dist],
            y: [pt.groundElevation],
            mode: 'markers',
            marker: { size: 10, color: '#333', symbol: 'triangle-down' },
            showlegend: false,
            hoverinfo: 'text',
            hovertext: `${pt.holeNo}<br>지표고: E.L.${pt.groundElevation.toFixed(1)}m`
        });
    });

    // 지하수위선 렌더링
    const waterPoints = selectedPointsData.filter(pt => pt.waterLevel !== null && !isNaN(pt.waterLevel));
    if (waterPoints.length >= 2) {
        const waterX = waterPoints.map(pt => cumulativeDistances[selectedPointsData.indexOf(pt)]);
        const waterY = waterPoints.map(pt => pt.groundElevation - pt.waterLevel);

        traces.push({
            x: waterX,
            y: waterY,
            mode: 'lines+markers',
            line: { color: '#1E90FF', width: 2, dash: 'dash' },
            marker: { size: 8, color: '#1E90FF', symbol: 'triangle-down' },
            name: '지하수위',
            showlegend: true,
            hoverinfo: 'text',
            hovertext: waterPoints.map(pt => `지하수위: GL(-) ${pt.waterLevel.toFixed(1)}m`)
        });
    }

    // 거리 라벨 (시추공 간)
    for (let i = 0; i < selectedPointsData.length - 1; i++) {
        const dist1 = cumulativeDistances[i];
        const dist2 = cumulativeDistances[i + 1];
        const midDist = (dist1 + dist2) / 2;
        const segmentDist = dist2 - dist1;

        traces.push({
            x: [midDist],
            y: [minElev - 1],
            mode: 'text',
            text: [`${segmentDist.toFixed(1)}m`],
            textfont: { size: 9, color: '#888' },
            showlegend: false,
            hoverinfo: 'skip'
        });
    }

    // 시추공 기둥
    const columnWidth = Math.max(3, Math.min(10, maxDist * 0.015));
    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];
        pt.layers.forEach(layer => {
            traces.push({
                x: [dist - columnWidth/2, dist + columnWidth/2, dist + columnWidth/2, dist - columnWidth/2, dist - columnWidth/2],
                y: [layer.elevationTop, layer.elevationTop, layer.elevationBottom, layer.elevationBottom, layer.elevationTop],
                fill: 'toself',
                fillcolor: layer.color,
                line: { color: '#222', width: 1 },
                mode: 'lines',
                showlegend: false,
                hoverinfo: 'text',
                text: `${layer.soilName || layer.label}<br>EL.${layer.elevationTop.toFixed(1)}~${layer.elevationBottom.toFixed(1)}m`
            });
        });
    });

    // 지하수위 표시 (boreholeData에서 직접 조회)
    const gwlPoints = selectedPointsData.filter(pt => {
        const bh = boreholeData.find(b => b.holeNo === pt.holeNo);
        return bh && (bh.gwl || bh.groundwaterLevel);
    });
    if (gwlPoints.length > 1) {
        traces.push({
            x: gwlPoints.map(pt => cumulativeDistances[selectedPointsData.indexOf(pt)]),
            y: gwlPoints.map(pt => {
                const bh = boreholeData.find(b => b.holeNo === pt.holeNo);
                const gwl = parseFloat(bh.gwl || bh.groundwaterLevel) || 0;
                return pt.groundElevation - gwl;
            }),
            mode: 'lines+markers',
            line: { color: '#2196F3', width: 2, dash: 'dash' },
            marker: { size: 5, color: '#2196F3', symbol: 'triangle-down' },
            name: '지하수위',
            showlegend: true
        });
    }

    // SPT N값 그래프 렌더링
    const SPT_GRAPH_WIDTH = Math.max(30, maxDist * 0.05); // 그래프 폭
    const MAX_N_VALUE = 60; // N값 최대치

    selectedPointsData.forEach((pt, ptIdx) => {
        const dist = cumulativeDistances[ptIdx];
        const bh = boreholeData.find(b => b.holeNo === pt.holeNo);

        if (!bh) return;

        // SPT 샘플 데이터 수집
        let sptSamples = [];
        if (bh.soilData && Array.isArray(bh.soilData)) {
            bh.soilData.forEach(layer => {
                if (layer.samples && Array.isArray(layer.samples)) {
                    layer.samples.forEach(sample => {
                        if (sample.type === 'SPT' || sample.sample_type === 'SPT' || sample.blowCount !== undefined) {
                            const depth = parseFloat(sample.depth || sample.sample_depth || 0);
                            const nValue = parseFloat(sample.blowCount || sample.n_value || sample.nValue || 0);
                            if (depth > 0 && nValue >= 0) {
                                sptSamples.push({
                                    depth: depth,
                                    nValue: Math.min(nValue, MAX_N_VALUE),
                                    elevation: pt.groundElevation - depth
                                });
                            }
                        }
                    });
                }
            });
        }

        // 깊이 순으로 정렬
        sptSamples.sort((a, b) => a.depth - b.depth);

        if (sptSamples.length >= 2) {
            // N값 그래프 라인
            const graphX = sptSamples.map(s => dist + columnWidth + 5 + (s.nValue / MAX_N_VALUE) * SPT_GRAPH_WIDTH);
            const graphY = sptSamples.map(s => s.elevation);

            traces.push({
                x: graphX,
                y: graphY,
                mode: 'lines+markers',
                line: { color: '#FF4500', width: 1.5 },
                marker: { size: 3, color: '#FF4500' },
                showlegend: ptIdx === 0,
                name: 'SPT N값',
                hoverinfo: 'text',
                hovertext: sptSamples.map(s => `N=${s.nValue.toFixed(0)}<br>깊이: ${s.depth.toFixed(1)}m`)
            });

            // N값 스케일 라인 (첫 번째 시추공에만)
            if (ptIdx === 0) {
                const scaleX = dist + columnWidth + 5;
                traces.push({
                    x: [scaleX, scaleX + SPT_GRAPH_WIDTH],
                    y: [pt.groundElevation - 1, pt.groundElevation - 1],
                    mode: 'lines',
                    line: { color: '#888', width: 0.5 },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
                traces.push({
                    x: [scaleX + SPT_GRAPH_WIDTH],
                    y: [pt.groundElevation - 0.5],
                    mode: 'text',
                    text: ['N=60'],
                    textfont: { size: 7, color: '#666' },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
            }
        }
    });

    const layout = {
        margin: { l: 45, r: 15, t: 25, b: 35 },
        title: {
            text: `단면도: ${selectedHoles.join(' → ')}`,
            font: { size: 11, color: '#455A64' }
        },
        xaxis: {
            title: '거리 (m)',
            titlefont: { size: 9 },
            showgrid: true,
            gridcolor: '#E0E0E0',
            zeroline: false,
            tickfont: { size: 8 }
        },
        yaxis: {
            title: '표고 (m)',
            titlefont: { size: 9 },
            showgrid: true,
            gridcolor: '#E0E0E0',
            tickfont: { size: 8 }
        },
        showlegend: true,
        legend: {
            orientation: 'h',
            x: 0.5,
            y: 1.02,
            xanchor: 'center',
            font: { size: 8 },
            bgcolor: 'rgba(255,255,255,0.8)'
        },
        hovermode: 'closest',
        plot_bgcolor: '#FAFAFA'
    };

    Plotly.newPlot(targetId, traces, layout, {
        responsive: true,
        displayModeBar: false,
        scrollZoom: true
    });
}

// 토질명에서 지질 유형 분류 (단면도용 보조 함수)
function classifySoilTypeForAnalysisCrossSection(soilName) {
    if (!soilName) return 'unknown';
    const name = soilName.toLowerCase();

    if (name.includes('매립') || name.includes('성토') || name.includes('fill')) return 'fill';
    if (name.includes('점토') || name.includes('clay')) return 'clay';
    if (name.includes('모래') || name.includes('sand')) return 'sand';
    if (name.includes('자갈') || name.includes('gravel')) return 'gravel';
    if (name.includes('실트') || name.includes('silt')) return 'silt';
    if (name.includes('풍화토') || name.includes('잔류토')) return 'weathered_soil';
    if (name.includes('풍화암')) return 'weathered_rock';
    if (name.includes('연암')) return 'soft_rock';
    if (name.includes('경암') || name.includes('암반')) return 'hard_rock';
    if (name.includes('전석') || name.includes('boulder')) return 'boulder';
    if (name.includes('붕적') || name.includes('colluvium')) return 'colluvium';

    return 'unknown';
}

/**
 * 분석 결과에 따른 마커 색상 데이터 생성
 * @param {string} analysisType - 분석 타입 (depth, weakSoil, boulder, foundation)
 * @returns {Array} - [{holeNo, color, status, isDetected}]
 */
function getAnalysisMarkerData(analysisType) {
    const markerData = [];

    if (!boreholeData || boreholeData.length === 0) return markerData;

    boreholeData.forEach((bh, index) => {
        let color = '#9E9E9E';
        let status = '미분석';
        let isDetected = false; // 탐지 여부 (문제가 있는 시추공)

        switch (analysisType) {
            case 'depth':
                if (window.verificationResults && window.verificationResults[index]) {
                    const result = window.verificationResults[index];
                    if (result.shallow && result.shallow.pass) {
                        color = '#2E7D32';
                        status = '적정';
                        isDetected = false;
                    } else {
                        color = '#C62828';
                        status = '깊이 부족';
                        isDetected = true; // 부족한 경우 강조
                    }
                }
                break;

            case 'weakSoil':
                if (window.weakSoilResults) {
                    const result = window.weakSoilResults.find(r => r.holeNo === bh.holeNo);
                    if (result) {
                        if (result.totalWeakZones > 0) {
                            color = '#F57C00';
                            status = '연약지반 탐지';
                            isDetected = true; // 연약지반 탐지시 강조
                        } else {
                            color = '#2E7D32';
                            status = '양호';
                            isDetected = false;
                        }
                    }
                }
                break;

            case 'boulder':
                if (window.boulderResults) {
                    const result = window.boulderResults.find(r => r.holeNo === bh.holeNo);
                    if (result) {
                        if (result.totalBoulderCount > 0 || result.totalColluvialCount > 0) {
                            color = '#8D6E63';
                            status = '전석/특이층 탐지';
                            isDetected = true; // 탐지시 강조
                        } else {
                            color = '#2E7D32';
                            status = '양호';
                            isDetected = false;
                        }
                    }
                }
                break;

            case 'foundation':
                if (window.simpleFoundationResults) {
                    const result = window.simpleFoundationResults.find(r => r.holeNo === bh.holeNo);
                    if (result) {
                        if (result.judgment === '직접 기초') {
                            color = '#2E7D32';
                            status = '직접기초';
                            isDetected = false;
                        } else if (result.judgment === '파일 기초 필요') {
                            color = '#C62828';
                            status = '파일기초 필요';
                            isDetected = true; // 파일기초 필요시 강조
                        } else {
                            color = '#F57C00';
                            status = '치환/파일 검토';
                            isDetected = true; // 검토 필요시 강조
                        }
                    }
                }
                break;
        }

        markerData.push({
            holeNo: bh.holeNo,
            color: color,
            status: status,
            isDetected: isDetected
        });
    });

    return markerData;
}

/**
 * 모든 분석 섹션에 미니 등고선 맵 업데이트
 */
function updateAnalysisMiniMaps() {
    // 깊이 검증 맵
    const depthMapContainer = document.getElementById('depthMiniMapContainer');
    if (depthMapContainer) {
        createMiniContourMap('depthMiniMap', 'ground_elevation', getAnalysisMarkerData('depth'));
    }

    // 연약지반 맵
    const weakSoilMapContainer = document.getElementById('weakSoilMiniMapContainer');
    if (weakSoilMapContainer) {
        createMiniContourMap('weakSoilMiniMap', 'ground_elevation', getAnalysisMarkerData('weakSoil'));
    }

    // 전석/붕적층 맵
    const boulderMapContainer = document.getElementById('boulderMiniMapContainer');
    if (boulderMapContainer) {
        createMiniContourMap('boulderMiniMap', 'ground_elevation', getAnalysisMarkerData('boulder'));
    }

    // 직접기초 판정 맵
    const foundationMapContainer = document.getElementById('foundationMiniMapContainer');
    if (foundationMapContainer) {
        createMiniContourMap('foundationMiniMap', 'ground_elevation', getAnalysisMarkerData('foundation'));
    }
}

// ✅ 전역 함수 노출 (HTML onclick/onchange 이벤트에서 접근 가능하도록)
// 도면 업로드
window.handleDrawingUpload = handleDrawingUpload;

// 다중 시추공 분석
window.toggleMultiBoreholeMode = toggleMultiBoreholeMode;
window.showMultiBoreholeAnalysis = showMultiBoreholeAnalysis;
window.selectBorehole = selectBorehole;
window.clearSelection = clearSelection;

// 2D 등고선 맵
window.updateContourMap = updateContourMap;
window.updateContourRotation = updateContourRotation;
window.rotateContour90 = rotateContour90;
window.resetContourRotation = resetContourRotation;
window.setContourDisplayMode = setContourDisplayMode;

// 단면도
window.showSimpleCrossSection = showSimpleCrossSection;
window.updateCrossSection = updateCrossSection;
window.showDetailedCrossSection = showDetailedCrossSection;

// 수동 배치 기준점 함수
window.startRefPointSelection = startRefPointSelection;
window.applyReferencePoints = applyReferencePoints;
window.applyManualPlacements = applyManualPlacements;
window.switchPlacementMode = switchPlacementMode;

// 등고선 오버레이
window.updateContourOverlayOnDrawing = updateContourOverlayOnDrawing;

// 지반 단면 보기
window.enableMultiBoreholeBar = enableMultiBoreholeBar;
window.showDrawingCrossSection = showDrawingCrossSection;

console.log('✅ chunk6.js 로드 완료 - 모든 주요 함수 전역 노출');

// ==================== 지층 온톨로지 (그룹핑) ====================

/**
 * 지층명 온톨로지 - 유사 지층을 그룹으로 묶음
 * 프로젝트별 다양한 지층 명칭을 표준화
 */
const SOIL_LAYER_ONTOLOGY = {
    // 지표/매립 그룹
    surface: {
        group: 'surface',
        label: '지표/매립',
        color: '#8D6E63',
        keywords: ['매립', '매립층', '매립토', '성토', '성토층', '복토', '객토', '표토', '잔디', '아스팔트', '콘크리트', 'fill', 'Fill']
    },

    // 점토 그룹
    clay: {
        group: 'clay',
        label: '점토',
        color: '#FFCC80',
        keywords: ['점토', '점토층', '점토질', '실트질점토', '점토질실트', '해성점토', '연약점토', '경점토', 'clay', 'Clay', 'CL', 'CH']
    },

    // 실트 그룹
    silt: {
        group: 'silt',
        label: '실트',
        color: '#A5D6A7',
        keywords: ['실트', '실트층', '실트질', 'silt', 'Silt', 'ML', 'MH']
    },

    // 모래 그룹
    sand: {
        group: 'sand',
        label: '모래',
        color: '#FFF59D',
        keywords: ['모래', '사질토', '세사', '중사', '조사', '사층', '모래층', 'sand', 'Sand', 'SM', 'SP', 'SW', 'SC']
    },

    // 자갈 그룹
    gravel: {
        group: 'gravel',
        label: '자갈',
        color: '#BCAAA4',
        keywords: ['자갈', '자갈층', '자갈질', '역층', '역질', 'gravel', 'Gravel', 'GP', 'GW', 'GM', 'GC']
    },

    // 풍화토 그룹
    weatheredSoil: {
        group: 'weatheredSoil',
        label: '풍화토',
        color: '#CE93D8',
        keywords: ['풍화토', '풍화대', '풍화층', '잔적토', '화강풍화토', '편마풍화토']
    },

    // 풍화암 그룹 (연약~보통 풍화)
    weatheredRock: {
        group: 'weatheredRock',
        label: '풍화암',
        color: '#90CAF9',
        keywords: ['풍화암', '완전풍화암', '심한풍화암', '보통풍화암', '약한풍화암', '연풍화암', '풍화대', 'WR', 'weathered rock', 'Weathered Rock', '리핑암']
    },

    // 연암 그룹 (풍화~보통암 경계)
    softRock: {
        group: 'softRock',
        label: '연암',
        color: '#7986CB',
        keywords: ['연암', '연암층', '약한암', '파쇄암', '절리발달', 'soft rock', 'Soft Rock', 'SR']
    },

    // 보통암 그룹
    mediumRock: {
        group: 'mediumRock',
        label: '보통암',
        color: '#5C6BC0',
        keywords: ['보통암', '중경암', 'medium rock', 'Medium Rock', 'MR']
    },

    // 경암 그룹 (최하부 기반암)
    hardRock: {
        group: 'hardRock',
        label: '경암/기반암',
        color: '#3F51B5',
        keywords: ['경암', '극경암', '기반암', '신선암', '암반', '화강암', '편마암', '셰일', '사암', '석회암', 'hard rock', 'Hard Rock', 'HR', 'bedrock', 'Bedrock']
    },

    // 전석/호박돌 그룹
    boulder: {
        group: 'boulder',
        label: '전석/호박돌',
        color: '#795548',
        keywords: ['전석', '호박돌', '붕적토', '붕적층', '큰자갈', 'boulder', 'Boulder', 'cobble']
    },

    // 지하수 (특수)
    groundwater: {
        group: 'groundwater',
        label: '지하수위',
        color: '#29B6F6',
        keywords: ['지하수', '지하수위', '수위', 'GWL', 'groundwater', 'water table']
    }
};

/**
 * 지층명을 온톨로지 그룹으로 분류
 * @param {string} soilName - 원본 지층명
 * @returns {object} - { group, label, color }
 */
function classifySoilLayer(soilName) {
    if (!soilName) return { group: 'unknown', label: '미분류', color: '#9E9E9E' };

    const normalizedName = soilName.toLowerCase().trim();

    for (const [groupKey, groupData] of Object.entries(SOIL_LAYER_ONTOLOGY)) {
        for (const keyword of groupData.keywords) {
            if (normalizedName.includes(keyword.toLowerCase())) {
                return {
                    group: groupData.group,
                    label: groupData.label,
                    color: groupData.color
                };
            }
        }
    }

    return { group: 'unknown', label: soilName, color: '#9E9E9E' };
}

/**
 * 지층 온톨로지 설명 팝업 표시
 */
function showOntologyExplanation() {
    const explanation = `
<div style="max-height: 400px; overflow-y: auto;">
    <h4 style="margin-top: 0; color: #1565C0;">📚 지층 분류 기준 (온톨로지)</h4>
    <p style="font-size: 12px; color: #666; margin-bottom: 16px;">
        다양한 프로젝트에서 사용되는 지층 명칭을 표준 그룹으로 분류합니다.
    </p>

    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
            <tr style="background: #E3F2FD;">
                <th style="padding: 8px; border: 1px solid #90CAF9; text-align: left;">그룹</th>
                <th style="padding: 8px; border: 1px solid #90CAF9; text-align: left;">포함 지층명</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(SOIL_LAYER_ONTOLOGY).map(([key, data]) => `
                <tr>
                    <td style="padding: 6px; border: 1px solid #E0E0E0;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${data.color}; border-radius: 2px; margin-right: 6px; vertical-align: middle;"></span>
                        <strong>${data.label}</strong>
                    </td>
                    <td style="padding: 6px; border: 1px solid #E0E0E0; color: #666;">
                        ${data.keywords.slice(0, 8).join(', ')}${data.keywords.length > 8 ? ' ...' : ''}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div style="margin-top: 16px; padding: 10px; background: #FFF3E0; border-radius: 4px; font-size: 11px;">
        <strong>📌 등고선 생성 대상 지층:</strong><br>
        <span style="color: #E65100;">지표고, 지하수위, 풍화암, 연암/기반암</span> - 이 4가지 경계면의 등고선을 생성합니다.
    </div>
</div>
    `;

    // 간단한 모달 표시
    const modal = document.createElement('div');
    modal.id = 'ontologyModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            ${explanation}
            <button onclick="document.getElementById('ontologyModal').remove()" style="margin-top: 16px; width: 100%; padding: 10px; background: #1976D2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">확인</button>
        </div>
    `;
    document.body.appendChild(modal);
}
window.showOntologyExplanation = showOntologyExplanation;

// ==================== 도면 위 등고선 오버레이 ====================

/**
 * 등고선 오버레이 지우기
 */
function clearContourOverlay() {
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (!overlayCanvas) return;

    // 기존 오버레이 다시 그리기 (등고선 제외)
    updateOverlayCanvas();
}

/**
 * 시추공 데이터에서 특정 지층의 표고 추출
 * ✅ depth_range 형식("0.0~7.8m")과 metadata.GROUND_SURFACE_LEVEL 지원
 * ✅ soilData / soil_data 두 형식 모두 지원
 */
function extractLayerElevation(borehole, layerType) {
    // soilData 또는 soil_data 필드 가져오기
    const soilDataField = borehole.soilData || borehole.soil_data || [];

    // 지표고 파싱 (여러 소스에서)
    let groundElev = 0;
    if (borehole.groundElevation) {
        groundElev = parseFloat(borehole.groundElevation) || 0;
    } else if (borehole.metadata && borehole.metadata.GROUND_SURFACE_LEVEL) {
        const match = borehole.metadata.GROUND_SURFACE_LEVEL.match(/([0-9.]+)/);
        if (match) groundElev = parseFloat(match[1]) || 0;
    }

    console.log(`🔍 [extractLayerElevation] ${borehole.holeNo || borehole.hole_no}: groundElev=${groundElev}, layerType=${layerType}, soilData=${soilDataField.length}개`);

    // depth_range 파싱 헬퍼 함수
    function parseDepthRange(layer) {
        if (layer.depth_from !== undefined) {
            return { from: parseFloat(layer.depth_from) || 0, to: parseFloat(layer.depth_to) || 0 };
        }
        if (layer.depth_range) {
            const match = layer.depth_range.match(/([0-9.]+)[~\-]([0-9.]+)/);
            if (match) {
                return { from: parseFloat(match[1]) || 0, to: parseFloat(match[2]) || 0 };
            }
        }
        return { from: 0, to: 0 };
    }

    switch (layerType) {
        case 'groundElevation':
            return groundElev > 0 ? groundElev : null;

        case 'groundwaterLevel':
            // 지하수위 표고 직접 값
            if (borehole.waterTableElevation !== null && borehole.waterTableElevation !== undefined) {
                return parseFloat(borehole.waterTableElevation);
            }
            // 지하수위 깊이로부터 계산
            if (borehole.waterTableDepth !== null && borehole.waterTableDepth !== undefined) {
                return groundElev - parseFloat(borehole.waterTableDepth);
            }
            // metadata에서 지하수위 파싱: "(GL-) 2.40 M"
            if (borehole.metadata && borehole.metadata.GROUND_WATER_LEVEL) {
                const match = borehole.metadata.GROUND_WATER_LEVEL.match(/([0-9.]+)/);
                if (match) {
                    const gwDepth = parseFloat(match[1]) || 0;
                    return groundElev - gwDepth;
                }
            }
            return null;

        case 'weatheredRock':
            // 풍화암 상단 표고 직접 값
            if (borehole.weatheredRockElevation !== null && borehole.weatheredRockElevation !== undefined) {
                return parseFloat(borehole.weatheredRockElevation);
            }
            // soilData에서 풍화암 찾기
            if (soilDataField && soilDataField.length > 0) {
                for (const layer of soilDataField) {
                    const classification = classifySoilLayer(layer.soil_name);
                    if (classification.group === 'weatheredRock' || classification.group === 'weatheredSoil') {
                        const depths = parseDepthRange(layer);
                        return groundElev - depths.from;
                    }
                }
            }
            return null;

        case 'bedrock':
            // 연암/기반암 상단 표고 직접 값
            if (borehole.bedrockTopElevation !== null && borehole.bedrockTopElevation !== undefined) {
                return parseFloat(borehole.bedrockTopElevation);
            }
            if (borehole.softRockPlusElevation !== null && borehole.softRockPlusElevation !== undefined) {
                return parseFloat(borehole.softRockPlusElevation);
            }
            // soilData에서 연암/경암 찾기
            if (soilDataField && soilDataField.length > 0) {
                for (const layer of soilDataField) {
                    const classification = classifySoilLayer(layer.soil_name);
                    if (['softRock', 'mediumRock', 'hardRock'].includes(classification.group)) {
                        const depths = parseDepthRange(layer);
                        return groundElev - depths.from;
                    }
                }
            }
            return null;
    }

    return null;
}

/**
 * 도면 위에 등고선 오버레이 그리기
 * ✅ 오직 수동 배치(manualPlacements) 및 좌표 매칭(calibrationPoints)된 시추공만 사용
 * @param {boolean} forceRender - true이면 contourOverlayEnabled 체크 우회 (updateOverlayCanvas에서 사용)
 * @param {CanvasRenderingContext2D} externalCtx - 외부에서 전달된 캔버스 컨텍스트
 */
function updateContourOverlayOnDrawing(forceRender = false, externalCtx = null) {
    // forceRender가 false이고 contourOverlayEnabled도 false이면 리턴
    if (!forceRender && !contourOverlayEnabled) {
        console.log('🚫 등고선 오버레이 비활성화 상태');
        return;
    }

    let ctx = externalCtx;
    let overlayCanvas = null;

    if (!ctx) {
        overlayCanvas = document.getElementById('overlayCanvas');
        if (!overlayCanvas) {
            console.warn('⚠️ overlayCanvas를 찾을 수 없습니다');
            return;
        }
        ctx = overlayCanvas.getContext('2d');
    } else {
        overlayCanvas = ctx.canvas;
    }

    // 체크박스 상태 읽기 (체크박스가 없으면 기본값 true 사용)
    const chkGround = document.getElementById('chkContourGround');
    const chkWater = document.getElementById('chkContourWater');
    const chkWeathered = document.getElementById('chkContourWeathered');
    const chkBedrock = document.getElementById('chkContourBedrock');

    // ✅ 체크박스 상태에 따라 개별 레이어 on/off (기본값: off)
    contourOverlayLayers.groundElevation = chkGround?.checked === true;
    contourOverlayLayers.groundwaterLevel = chkWater?.checked === true;
    contourOverlayLayers.weatheredRock = chkWeathered?.checked === true;
    contourOverlayLayers.bedrock = chkBedrock?.checked === true;

    // 하나라도 체크되어 있지 않으면 등고선 그리기 스킵
    const anyLayerEnabled = contourOverlayLayers.groundElevation ||
                            contourOverlayLayers.groundwaterLevel ||
                            contourOverlayLayers.weatheredRock ||
                            contourOverlayLayers.bedrock;

    if (!anyLayerEnabled) {
        console.log('📈 등고선 오버레이: 선택된 레이어 없음');
        return;
    }

    console.log('📈 등고선 오버레이 시작:', contourOverlayLayers);
    console.log('📈 체크박스 요소 확인:', {
        chkGround: chkGround ? `존재(${chkGround.checked})` : '없음(기본true)',
        chkWater: chkWater ? `존재(${chkWater.checked})` : '없음(기본true)',
        chkWeathered: chkWeathered ? `존재(${chkWeathered.checked})` : '없음(기본true)',
        chkBedrock: chkBedrock ? `존재(${chkBedrock.checked})` : '없음(기본true)'
    });

    // 시추공 좌표가 없으면 리턴 - calibrationPoints도 확인
    const hasManualPlacements = manualPlacements && manualPlacements.length >= 3;
    const hasCalibration = calibrationPoints && calibrationPoints.length >= 3;

    console.log('📊 시추공 데이터:', {
        manualPlacements: manualPlacements?.length || 0,
        calibrationPoints: calibrationPoints?.length || 0,
        boreholeData: boreholeData?.length || 0
    });

    // ✅ 디버깅: calibrationPoints 상세 출력
    if (calibrationPoints && calibrationPoints.length > 0) {
        console.log('📍 calibrationPoints 상세:', calibrationPoints.map(cp =>
            `${cp.hole_no}: pixel(${cp.pixelX?.toFixed(0)}, ${cp.pixelY?.toFixed(0)}), geo(${cp.geoX?.toFixed(1)}, ${cp.geoY?.toFixed(1)})`
        ));
    }

    if (!hasManualPlacements && !hasCalibration) {
        console.warn('⚠️ 등고선 생성에 최소 3개 시추공 배치가 필요합니다.');
        // forceRender가 아닐 때만 알림 표시 (updateOverlayCanvas에서 호출 시 알림 표시 안 함)
        if (!forceRender) {
            alert('등고선을 표시하려면 최소 3개의 시추공이 배치되어야 합니다.\n\n' +
                  '좌표 매칭 또는 수동 배치를 통해 시추공을 먼저 배치하세요.');
        }
        return;
    }

    // ✅ 캔버스 강제 설정
    overlayCanvas.style.zIndex = '10';
    overlayCanvas.style.display = 'block';
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';

    // ✅ 캔버스 크기 확인
    console.log(`📐 overlayCanvas 크기: ${overlayCanvas.width}x${overlayCanvas.height}`);

    // 각 지층별 등고선 데이터 수집 - 더 굵은 선 사용
    const layerTypes = [
        { type: 'groundElevation', label: '지표고', color: '#8D6E63', lineWidth: 3 },
        { type: 'groundwaterLevel', label: '지하수위', color: '#29B6F6', lineWidth: 3, dash: [5, 3] },
        { type: 'weatheredRock', label: '풍화암', color: '#9C27B0', lineWidth: 4 },
        { type: 'bedrock', label: '연암', color: '#3F51B5', lineWidth: 4 }
    ];

    layerTypes.forEach(layerInfo => {
        if (!contourOverlayLayers[layerInfo.type]) return;

        // 해당 지층의 데이터 포인트 수집
        const points = [];

        // 시추공 찾기 헬퍼 함수 (holeNo, hole_no 모두 지원)
        const findBorehole = (holeNo) => {
            return boreholeData.find(b => (b.holeNo === holeNo) || (b.hole_no === holeNo));
        };

        // ✅ 오직 명시적으로 배치된 픽셀 좌표만 사용 (transformMatrix 변환 제외)
        // 이렇게 해야 도면 스케일과 좌표 불일치 문제가 발생하지 않음
        const processedHoles = new Set();

        // 1. 수동 배치 모드에서 포인트 수집
        if (manualPlacements && manualPlacements.length > 0) {
            console.log(`📍 수동 배치 포인트 수집: ${manualPlacements.length}개`);
            manualPlacements.forEach(mp => {
                if (processedHoles.has(mp.holeNo)) return;

                const bh = findBorehole(mp.holeNo);
                if (!bh) {
                    console.warn(`⚠️ 시추공 '${mp.holeNo}' 찾지 못함`);
                    return;
                }

                const elevation = extractLayerElevation(bh, layerInfo.type);
                if (elevation !== null && !isNaN(elevation)) {
                    processedHoles.add(mp.holeNo);
                    points.push({
                        x: mp.pixelX,
                        y: mp.pixelY,
                        z: elevation
                    });
                    console.log(`  ✓ ${mp.holeNo}: ${layerInfo.type}=${elevation.toFixed(1)}m (${mp.pixelX.toFixed(0)}, ${mp.pixelY.toFixed(0)})`);
                }
            });
        }

        // 2. 좌표 매칭 모드에서 포인트 수집 (calibrationPoints의 픽셀 좌표 사용)
        if (calibrationPoints && calibrationPoints.length > 0) {
            console.log(`📍 좌표 매칭 포인트 수집: ${calibrationPoints.length}개`);
            calibrationPoints.forEach(cp => {
                if (processedHoles.has(cp.hole_no)) return;

                const bh = findBorehole(cp.hole_no);
                if (!bh) {
                    console.warn(`⚠️ 시추공 '${cp.hole_no}' 찾지 못함`);
                    return;
                }

                const elevation = extractLayerElevation(bh, layerInfo.type);
                if (elevation !== null && !isNaN(elevation)) {
                    processedHoles.add(cp.hole_no);
                    points.push({
                        x: cp.pixelX,
                        y: cp.pixelY,
                        z: elevation
                    });
                    console.log(`  ✓ ${cp.hole_no}: ${layerInfo.type}=${elevation.toFixed(1)}m (${cp.pixelX.toFixed(0)}, ${cp.pixelY.toFixed(0)})`);
                }
            });
        }

        // 3. ✅ transformMatrix가 있으면 나머지 시추공도 변환하여 추가
        if (transformMatrix && boreholeData && boreholeData.length > 0) {
            const { a, b, c, d, e, f } = transformMatrix;
            let transformedCount = 0;

            boreholeData.forEach(bh => {
                const holeNo = bh.holeNo || bh.hole_no;
                if (processedHoles.has(holeNo)) return;
                if (!bh.x || !bh.y) return;

                // TM 좌표를 픽셀 좌표로 변환
                const pixelX = a * parseFloat(bh.x) + b * parseFloat(bh.y) + c;
                const pixelY = d * parseFloat(bh.x) + e * parseFloat(bh.y) + f;

                // 캔버스 범위 내에 있는지 확인
                if (pixelX < 0 || pixelY < 0 || pixelX > overlayCanvas.width || pixelY > overlayCanvas.height) {
                    return;
                }

                const elevation = extractLayerElevation(bh, layerInfo.type);
                if (elevation !== null && !isNaN(elevation)) {
                    processedHoles.add(holeNo);
                    points.push({
                        x: pixelX,
                        y: pixelY,
                        z: elevation
                    });
                    transformedCount++;
                }
            });

            if (transformedCount > 0) {
                console.log(`  📍 transformMatrix로 ${transformedCount}개 시추공 추가 (총 ${points.length}개)`);
            }
        }

        console.log(`📍 ${layerInfo.label}: 총 ${points.length}개 포인트 수집 완료`);

        console.log(`📍 ${layerInfo.label} 등고선 포인트:`, points.length, '개');
        if (points.length > 0) {
            console.log(`  📍 포인트 좌표:`, points.map(p => `(${p.x?.toFixed(0)}, ${p.y?.toFixed(0)}, z=${p.z?.toFixed(1)})`));

            // ✅ 포인트 좌표 유효성 검사
            const validPoints = points.filter(p =>
                p.x !== undefined && p.y !== undefined && p.z !== undefined &&
                !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z) &&
                p.x >= 0 && p.y >= 0
            );

            if (validPoints.length !== points.length) {
                console.warn(`⚠️ 유효하지 않은 포인트 ${points.length - validPoints.length}개 제외`);
                points.length = 0;
                points.push(...validPoints);
            }
        }

        if (points.length < 3) {
            console.warn(`⚠️ ${layerInfo.label}: 포인트 부족 (${points.length}개, 최소 3개 필요)`);
            return;
        }

        // ✅ 디버깅: 포인트 위치 시각적으로 표시
        ctx.save();
        points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = layerInfo.color;
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.z.toFixed(0), p.x, p.y);
        });
        ctx.restore();
        console.log(`🔴 ${layerInfo.label} 포인트 ${points.length}개 마커 표시 완료`);

        // 등고선 생성 및 그리기
        drawContourLines(ctx, points, layerInfo);
    });

    console.log('✅ 등고선 오버레이 완료');
}

/**
 * 등고선 그리기 (Marching Squares 알고리즘 간소화 버전)
 * ✅ 2026-01-12 개선: 포인트 범위 기반 보간, 더 작은 power값 사용
 * ✅ 2026-01-19 개선: 동적 등고선 간격, 적응형 그리드 크기
 */
function drawContourLines(ctx, points, layerInfo) {
    console.log(`🎨 ${layerInfo.label} 등고선 그리기 시작, 포인트 수:`, points.length);

    // 캔버스 정보 확인
    const cvs = ctx.canvas;
    console.log(`📐 캔버스 크기: ${cvs.width}x${cvs.height}, display: ${cvs.style.display}, zIndex: ${cvs.style.zIndex}`);

    // 포인트에서 Z값 범위 계산
    const zValues = points.map(p => p.z);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);
    const zRange = zMax - zMin;

    console.log(`📊 ${layerInfo.label} 표고 범위: ${zMin.toFixed(1)} ~ ${zMax.toFixed(1)}m (범위: ${zRange.toFixed(1)}m)`);

    if (zRange < 0.5) {
        console.warn(`⚠️ ${layerInfo.label}: 표고 변화량 부족 (${zRange.toFixed(2)}m)`);
        return; // 변화량이 너무 작으면 스킵
    }

    // ✅ 포인트 범위 계산 (포인트 범위 내에서만 보간)
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // ✅ 포인트 분포 분석 (평균 거리 계산)
    let totalDist = 0;
    let distCount = 0;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dist = Math.sqrt(Math.pow(points[i].x - points[j].x, 2) + Math.pow(points[i].y - points[j].y, 2));
            totalDist += dist;
            distCount++;
        }
    }
    const avgPointDistance = distCount > 0 ? totalDist / distCount : 100;

    // 포인트 범위에 마진 추가 (분포 밀도에 따라 조정)
    const spreadFactor = Math.max(0.3, Math.min(0.5, avgPointDistance / 200));
    const marginX = (maxX - minX) * spreadFactor;
    const marginY = (maxY - minY) * spreadFactor;
    const boundsMinX = Math.max(0, minX - marginX);
    const boundsMaxX = Math.min(cvs.width, maxX + marginX);
    const boundsMinY = Math.max(0, minY - marginY);
    const boundsMaxY = Math.min(cvs.height, maxY + marginY);

    console.log(`📍 포인트 X범위: ${minX.toFixed(0)} ~ ${maxX.toFixed(0)}, Y범위: ${minY.toFixed(0)} ~ ${maxY.toFixed(0)}`);
    console.log(`📐 보간 영역: (${boundsMinX.toFixed(0)}, ${boundsMinY.toFixed(0)}) ~ (${boundsMaxX.toFixed(0)}, ${boundsMaxY.toFixed(0)})`);
    console.log(`📏 평균 포인트 간 거리: ${avgPointDistance.toFixed(0)}px`);

    // ✅ 등고선 간격: 슬라이더 값 사용 (기본값 0.2m, 범위 0.2~2.0m)
    const contourInterval = window.contourInterval || 0.2;

    const startLevel = Math.ceil(zMin / contourInterval) * contourInterval;
    const endLevel = Math.floor(zMax / contourInterval) * contourInterval;
    const numLevels = Math.floor((endLevel - startLevel) / contourInterval) + 1;

    console.log(`📏 등고선 간격: ${contourInterval}m, 레벨 수: ${numLevels}개 (${startLevel.toFixed(1)} ~ ${endLevel.toFixed(1)}m)`);

    // ✅ 폰트 크기: 슬라이더 값 또는 캔버스 크기 기반 기본값
    const canvasSize = Math.max(cvs.width, cvs.height);
    const baseFontSize = Math.max(14, Math.min(24, Math.round(canvasSize / 150)));
    const contourFontSize = window.contourFontSize || baseFontSize;
    const contourFontColor = window.contourFontColor || layerInfo.color;

    // ✅ 적응형 그리드 크기 결정 (포인트 분포에 따라)
    // 포인트가 적으면 더 큰 셀 사용, 많으면 작은 셀
    const boundsWidth = boundsMaxX - boundsMinX;
    const boundsHeight = boundsMaxY - boundsMinY;

    // 그리드 셀 수 목표: 15~30개 정도
    const targetGridCells = points.length <= 5 ? 12 : (points.length <= 10 ? 18 : 25);
    const baseGridSize = Math.max(boundsWidth, boundsHeight) / targetGridCells;
    const gridSize = Math.max(20, Math.min(50, Math.round(baseGridSize))); // 20~50px 범위

    const cols = Math.max(8, Math.ceil(boundsWidth / gridSize));
    const rows = Math.max(8, Math.ceil(boundsHeight / gridSize));

    console.log(`🔢 그리드 크기: ${cols}x${rows} (셀 크기: ${gridSize}px, 포인트 수: ${points.length})`);

    // IDW (Inverse Distance Weighting) 보간으로 그리드 값 계산
    // ✅ power=1.5로 낮춰서 더 넓은 범위에 영향 주도록
    const grid = [];
    let gridMin = Infinity, gridMax = -Infinity;

    for (let row = 0; row < rows; row++) {
        grid[row] = [];
        for (let col = 0; col < cols; col++) {
            const px = boundsMinX + col * gridSize + gridSize / 2;
            const py = boundsMinY + row * gridSize + gridSize / 2;
            const value = idwInterpolation(px, py, points, 1.5); // ✅ power=1.5
            grid[row][col] = value;
            if (value < gridMin) gridMin = value;
            if (value > gridMax) gridMax = value;
        }
    }

    console.log(`📈 그리드 값 범위: ${gridMin.toFixed(2)} ~ ${gridMax.toFixed(2)}`);

    // ✅ 그리드 샘플 값 출력 (항상)
    console.log(`🔢 그리드 샘플 값 (첫 5개 셀):`, grid[0]?.slice(0, 5).map(v => v?.toFixed(1)));
    console.log(`🔢 그리드 샘플 값 (마지막 5개 셀):`, grid[rows-1]?.slice(-5).map(v => v?.toFixed(1)));

    // 그리드 값 범위가 너무 좁으면 경고
    if (gridMax - gridMin < 0.5) {
        console.warn(`⚠️ 그리드 보간 값 범위 부족 - IDW 문제 가능성`);
        // 디버깅: 포인트 위치에서의 그리드 값 확인
        points.slice(0, 5).forEach((p, i) => {
            const col = Math.floor((p.x - boundsMinX) / gridSize);
            const row = Math.floor((p.y - boundsMinY) / gridSize);
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                console.log(`  📍 포인트${i} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}): z=${p.z.toFixed(1)}, grid[${row}][${col}]=${grid[row][col]?.toFixed(1)}`);
            }
        });
    }

    // ✅ 그리드 코너 값 확인 (디버깅)
    console.log(`📐 그리드 코너 값: TL=${grid[0][0]?.toFixed(1)}, TR=${grid[0][cols-1]?.toFixed(1)}, BL=${grid[rows-1][0]?.toFixed(1)}, BR=${grid[rows-1][cols-1]?.toFixed(1)}`);

    // ✅ Marching Squares에서 실제 인덱스 분포 확인
    let indexCounts = new Array(16).fill(0);
    for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
            const tl = grid[row][col];
            const tr = grid[row][col + 1];
            const br = grid[row + 1][col + 1];
            const bl = grid[row + 1][col];
            const testLevel = startLevel;
            let index = 0;
            if (tl >= testLevel) index |= 8;
            if (tr >= testLevel) index |= 4;
            if (br >= testLevel) index |= 2;
            if (bl >= testLevel) index |= 1;
            indexCounts[index]++;
        }
    }
    console.log(`🔍 첫 레벨(${startLevel}m) Marching Squares 인덱스 분포:`, indexCounts.map((c, i) => `${i}:${c}`).filter(s => !s.endsWith(':0')).join(', '));

    // 각 등고선 레벨에 대해 Marching Squares
    ctx.save();
    ctx.strokeStyle = layerInfo.color;
    ctx.lineWidth = layerInfo.lineWidth || 2;
    ctx.font = `bold ${contourFontSize}px Arial`;
    ctx.fillStyle = contourFontColor;

    if (layerInfo.dash) {
        ctx.setLineDash(layerInfo.dash);
    }

    console.log(`🔄 등고선 레벨 생성: ${startLevel} ~ ${endLevel}, 간격: ${contourInterval}m`);

    let totalSegments = 0;
    let labelCount = 0;
    for (let level = startLevel; level <= endLevel; level += contourInterval) {
        const segments = marchingSquaresWithOffset(grid, level, gridSize, boundsMinX, boundsMinY);

        if (segments.length > 0) {
            totalSegments += segments.length;

            // ✅ 디버깅: 첫 레벨 첫 세그먼트 좌표 출력
            if (level === startLevel && segments.length > 0) {
                console.log(`🔴 첫 등고선(${level}m) 첫 세그먼트: (${segments[0].x1.toFixed(0)}, ${segments[0].y1.toFixed(0)}) → (${segments[0].x2.toFixed(0)}, ${segments[0].y2.toFixed(0)})`);
            }

            // 연결된 등고선 그리기
            ctx.beginPath();
            segments.forEach(seg => {
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
            });
            ctx.stroke();

            // ✅ 레벨 라벨 표시 (배경 박스 없이 텍스트만)
            const isIntegerLevel = Math.abs(level - Math.round(level)) < 0.01;

            // 세그먼트가 충분히 있으면 라벨 표시
            if (segments.length > 3) {
                const midSeg = segments[Math.floor(segments.length / 2)];
                const labelX = (midSeg.x1 + midSeg.x2) / 2;
                const labelY = (midSeg.y1 + midSeg.y2) / 2;

                // ✅ 소수점 표시 (정수는 .0 없이, 소수점은 .5 등으로 표시)
                const labelText = isIntegerLevel ? `${level.toFixed(0)}` : `${level.toFixed(1)}`;

                // ✅ 배경 박스 제거 - 텍스트만 표시 (큰 폰트로 가독성 확보)
                ctx.setLineDash([]); // 대시 초기화
                ctx.fillStyle = contourFontColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${contourFontSize}px Arial`;
                ctx.fillText(labelText, labelX, labelY);

                // 대시 복원
                if (layerInfo.dash) ctx.setLineDash(layerInfo.dash);
                labelCount++;
            }
        }
    }

    console.log(`✅ ${layerInfo.label} 총 ${totalSegments}개 세그먼트, ${labelCount}개 라벨 생성`);

    ctx.restore();
}

/**
 * IDW 보간
 */
function idwInterpolation(px, py, points, power = 2) {
    let sumWeightedValues = 0;
    let sumWeights = 0;

    for (const point of points) {
        const dist = Math.sqrt(Math.pow(px - point.x, 2) + Math.pow(py - point.y, 2));

        if (dist < 1) {
            return point.z; // 매우 가까우면 해당 값 반환
        }

        const weight = 1 / Math.pow(dist, power);
        sumWeightedValues += weight * point.z;
        sumWeights += weight;
    }

    return sumWeights > 0 ? sumWeightedValues / sumWeights : 0;
}

/**
 * Marching Squares 알고리즘 (등고선 세그먼트 추출)
 */
function marchingSquares(grid, level, cellSize) {
    return marchingSquaresWithOffset(grid, level, cellSize, 0, 0);
}

/**
 * ✅ Marching Squares 알고리즘 (오프셋 지원 버전)
 * 포인트 범위 기반 보간에서 좌표를 캔버스 전체 좌표로 변환
 */
function marchingSquaresWithOffset(grid, level, cellSize, offsetX = 0, offsetY = 0) {
    const segments = [];
    const rows = grid.length;
    const cols = grid[0].length;

    for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
            // ✅ 오프셋 적용
            const x = offsetX + col * cellSize;
            const y = offsetY + row * cellSize;

            // 4개 코너 값
            const tl = grid[row][col];
            const tr = grid[row][col + 1];
            const br = grid[row + 1][col + 1];
            const bl = grid[row + 1][col];

            // 이진 인덱스 계산
            let index = 0;
            if (tl >= level) index |= 8;
            if (tr >= level) index |= 4;
            if (br >= level) index |= 2;
            if (bl >= level) index |= 1;

            // 모든 코너가 동일한 상태이면 경계 없음
            if (index === 0 || index === 15) continue;

            // 보간된 교차점 위치 계산
            const lerp = (v1, v2, t) => v1 + t * (v2 - v1);
            const getT = (v1, v2) => (v2 - v1 !== 0) ? (level - v1) / (v2 - v1) : 0.5;

            // 각 변의 교차점
            const top = { x: lerp(x, x + cellSize, getT(tl, tr)), y: y };
            const right = { x: x + cellSize, y: lerp(y, y + cellSize, getT(tr, br)) };
            const bottom = { x: lerp(x, x + cellSize, getT(bl, br)), y: y + cellSize };
            const left = { x: x, y: lerp(y, y + cellSize, getT(tl, bl)) };

            // Marching Squares 룩업 테이블에 따른 세그먼트 생성
            switch (index) {
                case 1: case 14:
                    segments.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
                    break;
                case 2: case 13:
                    segments.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
                    break;
                case 3: case 12:
                    segments.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
                    break;
                case 4: case 11:
                    segments.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
                    break;
                case 5:
                    segments.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
                    segments.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
                    break;
                case 6: case 9:
                    segments.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
                    break;
                case 7: case 8:
                    segments.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
                    break;
                case 10:
                    segments.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
                    segments.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
                    break;
            }
        }
    }

    return segments;
}

// ==================== 지반 단면 보기 버튼 기능 ====================

/**
 * 지반 단면 보기 활성화
 */
function enableMultiBoreholeBar() {
    console.log('🗻 지반 단면 보기 활성화');

    // ✅ 도면 모듈용 다중 선택 모드 활성화
    drawingMultiBoreholeMode = true;
    drawingSelectedBoreholes = [];

    // 시각화 모듈용도 동기화
    multiBoreholeMode = true;
    selectedBoreholes = [];

    // UI 업데이트
    const btn = document.getElementById('enableMultiModeBtn');
    if (btn) {
        btn.textContent = '시추공 선택 중...';
        btn.style.background = '#4CAF50';
    }

    // 단면도 컨테이너 표시
    const container = document.getElementById('drawingCrossSectionContainer');
    if (container) {
        container.style.display = 'block';
    }

    // 안내 메시지
    alert('도면에서 시추공을 클릭하여 선택하세요.\n\n' +
          '• 순서대로 클릭하면 단면도 경로가 결정됩니다.\n' +
          '• 2개 이상 선택 시 자동으로 단면도가 생성됩니다.\n' +
          '• 같은 시추공을 다시 클릭하면 선택 해제됩니다.');

    updateDrawingSelectionUI();
    updateSelectionUI();
}

// ==================== 개선된 단면도 시각화 ====================

/**
 * 수직 프로파일 기반 단면도 (점선 연결)
 * - 각 시추공을 수직 막대(컬럼)로 표시
 * - 동일/유사 지층은 점선으로 연결
 * - 시추공 간 실제 거리 비례
 */
function renderVerticalProfileCrossSection(targetDiv, selectedHoleNos) {
    const container = typeof targetDiv === 'string' ? document.getElementById(targetDiv) : targetDiv;
    if (!container) return;

    console.log('🎨 renderVerticalProfileCrossSection 호출됨:', selectedHoleNos);

    // 선택된 시추공 데이터 수집
    const boreholes = selectedHoleNos.map(holeNo => {
        // holeNo 또는 hole_no 모두 지원
        const bh = boreholeData.find(b => (b.holeNo === holeNo) || (b.hole_no === holeNo));
        if (!bh) {
            console.warn(`[renderVerticalProfileCrossSection] 시추공 '${holeNo}' 찾지 못함`);
            return null;
        }

        // 수동 배치 좌표 확인
        const mp = manualPlacements ? manualPlacements.find(m => m.holeNo === holeNo) : null;

        // soilData 또는 soil_data 필드 가져오기 + depth_range 파싱
        const soilDataField = bh.soilData || bh.soil_data || [];
        const processedSoilData = soilDataField.map(layer => {
            let depthFrom = 0, depthTo = 0;

            // depth_range 형식: "0.0~0.2m" 또는 "0.0-0.2m"
            if (layer.depth_range) {
                const match = layer.depth_range.match(/([0-9.]+)[~\-]([0-9.]+)/);
                if (match) {
                    depthFrom = parseFloat(match[1]) || 0;
                    depthTo = parseFloat(match[2]) || depthFrom + 1;
                }
            } else {
                depthFrom = parseFloat(layer.depth_from) || 0;
                depthTo = parseFloat(layer.depth_to) || depthFrom + 1;
            }

            return {
                soil_name: layer.soil_name || '미분류',
                depth_from: depthFrom,
                depth_to: depthTo
            };
        });

        // 지표고 파싱 (여러 소스에서)
        let groundElev = 0;
        if (bh.groundElevation) {
            groundElev = parseFloat(bh.groundElevation) || 0;
        } else if (bh.metadata && bh.metadata.GROUND_SURFACE_LEVEL) {
            const match = bh.metadata.GROUND_SURFACE_LEVEL.match(/([0-9.]+)/);
            if (match) groundElev = parseFloat(match[1]) || 0;
        }

        // 시추 깊이
        let totalDepth = parseFloat(bh.totalDepth) || 0;
        if (totalDepth === 0 && processedSoilData.length > 0) {
            totalDepth = Math.max(...processedSoilData.map(l => l.depth_to));
        }

        return {
            holeNo: bh.holeNo || bh.hole_no,
            x: mp ? mp.geoX : parseFloat(bh.x) || 0,
            y: mp ? mp.geoY : parseFloat(bh.y) || 0,
            groundElevation: groundElev,
            totalDepth: totalDepth,
            soilData: processedSoilData
        };
    }).filter(b => b !== null);

    console.log('📊 처리된 시추공 데이터:', boreholes);

    if (boreholes.length < 2) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">2개 이상의 시추공을 선택하세요.</div>';
        return;
    }

    // 누적 거리 계산 (시추공 간 실제 거리)
    const distances = [0];
    for (let i = 1; i < boreholes.length; i++) {
        const prev = boreholes[i - 1];
        const curr = boreholes[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        distances.push(distances[i - 1] + dist);
    }
    const totalDistance = distances[distances.length - 1] || 1;

    // 최대/최소 표고 계산
    let maxElev = -Infinity, minElev = Infinity;
    boreholes.forEach(bh => {
        maxElev = Math.max(maxElev, bh.groundElevation);
        minElev = Math.min(minElev, bh.groundElevation - bh.totalDepth);
    });
    const elevRange = maxElev - minElev + 10;

    // SVG 크기 - ✅ 범례를 하단으로 이동하므로 right margin 축소, bottom 확대
    // ✅ left margin을 확대하여 EL 레이블이 잘리지 않도록 함
    const svgWidth = Math.max(800, container.clientWidth - 40);
    const svgHeight = 550;
    const margin = { top: 80, right: 50, bottom: 100, left: 75 };

    // ✅ 시추공 컬럼 너비 먼저 계산 (플롯 영역 계산에 필요)
    const tempPlotWidth = svgWidth - margin.left - margin.right;
    const columnWidth = Math.min(70, Math.max(40, tempPlotWidth / boreholes.length / 2.5));

    // ✅ 첫 번째/마지막 시추공이 EL 레이블과 겹치지 않도록 패딩 추가
    const xPadding = columnWidth / 2 + 10;
    const plotWidth = svgWidth - margin.left - margin.right - xPadding * 2;
    const plotHeight = svgHeight - margin.top - margin.bottom;

    // 스케일 함수 - ✅ 시추공이 EL 레이블과 겹치지 않도록 xPadding 적용
    const xScale = (dist) => margin.left + xPadding + (dist / totalDistance) * plotWidth;
    const yScale = (elev) => margin.top + ((maxElev + 5 - elev) / elevRange) * plotHeight;

    // SVG 시작
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" style="font-family: Arial, sans-serif;">`;

    // 배경
    svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="white"/>`;

    // 그리드 라인 - ✅ EL 레이블이 시추공 컬럼과 겹치지 않도록 위치 조정
    svg += `<g class="grid">`;
    for (let elev = Math.floor(minElev); elev <= Math.ceil(maxElev + 5); elev += 2) {
        const y = yScale(elev);
        svg += `<line x1="${margin.left}" y1="${y}" x2="${svgWidth - margin.right}" y2="${y}" stroke="#E0E0E0" stroke-dasharray="2,2"/>`;
        svg += `<text x="${margin.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#555">EL.${elev}</text>`;
    }
    svg += `</g>`;

    // 지층 그룹별로 점선 연결을 위한 데이터 수집
    const layerConnections = new Map(); // group -> [{bhIndex, yTop, yBottom}]

    // 각 시추공의 수직 프로파일 그리기
    boreholes.forEach((bh, bhIndex) => {
        const xCenter = xScale(distances[bhIndex]);
        const groundY = yScale(bh.groundElevation);
        const bottomY = yScale(bh.groundElevation - bh.totalDepth);

        // 시추공 컬럼 배경
        svg += `<rect x="${xCenter - columnWidth/2}" y="${groundY}" width="${columnWidth}" height="${bottomY - groundY}" fill="#FAFAFA" stroke="#BDBDBD" stroke-width="1"/>`;

        // 지표면 마커
        svg += `<line x1="${xCenter - columnWidth/2 - 10}" y1="${groundY}" x2="${xCenter + columnWidth/2 + 10}" y2="${groundY}" stroke="#795548" stroke-width="3"/>`;

        // 토층 그리기
        if (bh.soilData && bh.soilData.length > 0) {
            bh.soilData.forEach((layer, layerIdx) => {
                const depthFrom = parseFloat(layer.depth_from) || 0;
                const depthTo = parseFloat(layer.depth_to) || depthFrom + 1;
                const thickness = depthTo - depthFrom;
                const yTop = yScale(bh.groundElevation - depthFrom);
                const yBottom = yScale(bh.groundElevation - depthTo);
                const elevTop = bh.groundElevation - depthFrom;
                const elevBottom = bh.groundElevation - depthTo;

                const classification = classifySoilLayer(layer.soil_name);

                // 호버 데이터 (JSON으로 인코딩하여 data 속성에 저장)
                const hoverData = JSON.stringify({
                    holeNo: bh.holeNo,
                    soilName: layer.soil_name,
                    depthFrom: depthFrom.toFixed(1),
                    depthTo: depthTo.toFixed(1),
                    thickness: thickness.toFixed(1),
                    elevTop: elevTop.toFixed(2),
                    elevBottom: elevBottom.toFixed(2),
                    color: classification.color
                }).replace(/"/g, '&quot;');

                // 지층 박스 (호버 이벤트 추가)
                svg += `<rect class="soil-layer-rect" x="${xCenter - columnWidth/2 + 2}" y="${yTop}" width="${columnWidth - 4}" height="${yBottom - yTop}" fill="${classification.color}" fill-opacity="0.7" stroke="${classification.color}" stroke-width="1" style="cursor: pointer;" data-layer-info="${hoverData}" onmouseenter="showLayerTooltip(event, this)" onmouseleave="hideLayerTooltip()" onmousemove="moveLayerTooltip(event)"/>`;

                // 지층명 (컬럼 내부) - 포인터 이벤트 없음
                if (yBottom - yTop > 15) {
                    const displayName = layer.soil_name.length > 6 ? layer.soil_name.substring(0, 6) + '..' : layer.soil_name;
                    svg += `<text x="${xCenter}" y="${(yTop + yBottom) / 2 + 4}" text-anchor="middle" font-size="9" fill="#333" style="pointer-events: none;">${displayName}</text>`;
                }

                // 점선 연결을 위한 데이터 저장
                if (!layerConnections.has(classification.group)) {
                    layerConnections.set(classification.group, []);
                }
                layerConnections.get(classification.group).push({
                    bhIndex,
                    xCenter,
                    yTop,
                    yBottom,
                    yMid: (yTop + yBottom) / 2
                });
            });
        } else {
            // 토층 정보 없음
            svg += `<text x="${xCenter}" y="${(groundY + bottomY) / 2}" text-anchor="middle" font-size="10" fill="#999">정보 없음</text>`;
        }

        // 시추공명 (상단) - ✅ 더 위로 이동하여 겹침 방지
        svg += `<text x="${xCenter}" y="${groundY - 45}" text-anchor="middle" font-size="13" font-weight="bold" fill="#1565C0">${bh.holeNo}</text>`;
        svg += `<text x="${xCenter}" y="${groundY - 30}" text-anchor="middle" font-size="10" fill="#666">GL.${bh.groundElevation.toFixed(1)}m</text>`;

        // 시추 깊이 (하단)
        svg += `<text x="${xCenter}" y="${bottomY + 18}" text-anchor="middle" font-size="10" fill="#666">${bh.totalDepth.toFixed(1)}m</text>`;
    });

    // ✅ 개선된 지층 점선 연결 알고리즘 - 지층 순서 고려하여 크로스 방지
    // ID 추가하여 토글 가능하도록 함
    svg += `<g id="layerConnectionLines" class="layer-connections">`;

    // 인접 시추공 쌍별로 연결 처리
    for (let bhIdx = 0; bhIdx < boreholes.length - 1; bhIdx++) {
        const currBh = boreholes[bhIdx];
        const nextBh = boreholes[bhIdx + 1];
        const currX = xScale(distances[bhIdx]) + columnWidth/2;
        const nextX = xScale(distances[bhIdx + 1]) - columnWidth/2;

        // 각 시추공의 지층을 깊이 순서대로 정렬하여 매칭
        const currLayers = (currBh.soilData || []).map((layer, idx) => ({
            ...layer,
            yTop: yScale(currBh.groundElevation - layer.depth_from),
            yBottom: yScale(currBh.groundElevation - layer.depth_to),
            classification: classifySoilLayer(layer.soil_name),
            depthOrder: idx
        }));

        const nextLayers = (nextBh.soilData || []).map((layer, idx) => ({
            ...layer,
            yTop: yScale(nextBh.groundElevation - layer.depth_from),
            yBottom: yScale(nextBh.groundElevation - layer.depth_to),
            classification: classifySoilLayer(layer.soil_name),
            depthOrder: idx
        }));

        // 매칭된 연결을 저장 (크로스 방지를 위해)
        const connections = [];

        // 같은 그룹끼리 매칭 - 깊이 순서 유지
        currLayers.forEach(currLayer => {
            // 같은 그룹의 next 레이어 중 아직 매칭되지 않은 것 찾기
            const matchedNext = nextLayers.find(nextLayer =>
                nextLayer.classification.group === currLayer.classification.group &&
                !connections.some(c => c.nextIdx === nextLayer.depthOrder)
            );

            if (matchedNext) {
                connections.push({
                    currIdx: currLayer.depthOrder,
                    nextIdx: matchedNext.depthOrder,
                    currYTop: currLayer.yTop,
                    currYBottom: currLayer.yBottom,
                    nextYTop: matchedNext.yTop,
                    nextYBottom: matchedNext.yBottom,
                    color: currLayer.classification.color || '#9E9E9E',
                    group: currLayer.classification.group
                });
            }
        });

        // 크로스 체크 및 제거 - 연결선이 교차하면 제거
        const validConnections = connections.filter((conn, idx) => {
            for (let i = 0; i < connections.length; i++) {
                if (i === idx) continue;
                const other = connections[i];
                // 크로스 조건: 한 쪽은 위, 다른 쪽은 아래인 경우
                const currAbove = conn.currYTop < other.currYTop;
                const nextAbove = conn.nextYTop < other.nextYTop;
                if (currAbove !== nextAbove) {
                    // 크로스 발생 - 더 얕은(위쪽) 연결 우선
                    const connAvgY = (conn.currYTop + conn.nextYTop) / 2;
                    const otherAvgY = (other.currYTop + other.nextYTop) / 2;
                    if (connAvgY > otherAvgY) return false; // 이 연결은 제거
                }
            }
            return true;
        });

        // 연결선 그리기
        validConnections.forEach(conn => {
            // 상단 경계 연결 (점선)
            svg += `<line x1="${currX}" y1="${conn.currYTop}" x2="${nextX}" y2="${conn.nextYTop}" stroke="${conn.color}" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>`;
            // 하단 경계 연결 (점선)
            svg += `<line x1="${currX}" y1="${conn.currYBottom}" x2="${nextX}" y2="${conn.nextYBottom}" stroke="${conn.color}" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>`;
        });
    }
    svg += `</g>`;

    // 거리 눈금 (하단)
    svg += `<g class="distance-axis">`;
    svg += `<line x1="${margin.left}" y1="${svgHeight - margin.bottom + 20}" x2="${svgWidth - margin.right}" y2="${svgHeight - margin.bottom + 20}" stroke="#333" stroke-width="1"/>`;

    boreholes.forEach((bh, idx) => {
        const x = xScale(distances[idx]);
        svg += `<line x1="${x}" y1="${svgHeight - margin.bottom + 15}" x2="${x}" y2="${svgHeight - margin.bottom + 25}" stroke="#333" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${svgHeight - margin.bottom + 40}" text-anchor="middle" font-size="10" fill="#666">${distances[idx].toFixed(0)}m</text>`;
    });

    svg += `<text x="${svgWidth / 2}" y="${svgHeight - 10}" text-anchor="middle" font-size="11" fill="#333">수평 거리 (m)</text>`;
    svg += `</g>`;

    // 제목
    svg += `<text x="${svgWidth / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333">지반 단면도</text>`;
    svg += `<text x="${svgWidth / 2}" y="45" text-anchor="middle" font-size="12" fill="#666">${boreholes.map(b => b.holeNo).join(' → ')}</text>`;

    // ✅ 범례 - 하단으로 이동
    const usedGroups = new Set();
    boreholes.forEach(bh => {
        bh.soilData?.forEach(layer => {
            usedGroups.add(classifySoilLayer(layer.soil_name).group);
        });
    });

    const legendY = svgHeight - 35;
    const legendItems = Array.from(usedGroups).map(group => SOIL_LAYER_ONTOLOGY[group]).filter(Boolean);
    const legendItemWidth = 80;
    const totalLegendWidth = legendItems.length * legendItemWidth + 100; // +100 for 점선 설명
    let legendX = (svgWidth - totalLegendWidth) / 2;

    svg += `<g class="legend">`;
    svg += `<text x="${legendX - 40}" y="${legendY + 4}" font-size="10" font-weight="bold" fill="#333">범례:</text>`;

    legendItems.forEach((info, idx) => {
        const x = legendX + idx * legendItemWidth;
        svg += `<rect x="${x}" y="${legendY - 6}" width="12" height="12" fill="${info.color}" stroke="${info.color}"/>`;
        svg += `<text x="${x + 16}" y="${legendY + 4}" font-size="9" fill="#333">${info.label}</text>`;
    });

    // 점선 설명
    const dashX = legendX + legendItems.length * legendItemWidth + 10;
    svg += `<line x1="${dashX}" y1="${legendY}" x2="${dashX + 20}" y2="${legendY}" stroke="#666" stroke-dasharray="5,3" stroke-width="1.5"/>`;
    svg += `<text x="${dashX + 25}" y="${legendY + 4}" font-size="9" fill="#666">동일 지층 연결</text>`;

    svg += `</g>`;

    svg += '</svg>';

    container.innerHTML = svg;
    console.log('✅ 수직 프로파일 단면도 생성 완료');
}

// ✅ 전역 함수 등록 - updateCrossSection은 이미 원본 함수에서 renderVerticalProfileCrossSectionInternal 호출
window.updateCrossSection = updateCrossSection;
window.renderVerticalProfileCrossSection = renderVerticalProfileCrossSection;
window.renderVerticalProfileCrossSectionInternal = renderVerticalProfileCrossSectionInternal;

/**
 * 동일 지층 연결선 토글 함수
 * 체크박스 상태에 따라 SVG 내 연결선 그룹의 표시/숨김 전환
 */
function toggleLayerConnectionLines() {
    const checkbox = document.getElementById('chkLayerConnection');
    const connectionGroup = document.getElementById('layerConnectionLines');

    if (connectionGroup) {
        if (checkbox && checkbox.checked) {
            connectionGroup.style.display = '';
            connectionGroup.style.visibility = 'visible';
        } else {
            connectionGroup.style.display = 'none';
            connectionGroup.style.visibility = 'hidden';
        }
        console.log('✅ 동일지층 연결선:', checkbox?.checked ? '표시' : '숨김');
    }
}

/**
 * 지층 호버 툴팁 표시
 * @param {Event} event - 마우스 이벤트
 * @param {Element} element - SVG rect 요소
 */
function showLayerTooltip(event, element) {
    // 툴팁 요소 생성 또는 가져오기
    let tooltip = document.getElementById('layerHoverTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'layerHoverTooltip';
        tooltip.style.cssText = `
            position: fixed;
            z-index: 10000;
            background: white;
            border: 2px solid #1565C0;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            padding: 0;
            pointer-events: none;
            max-width: 280px;
            font-family: 'Noto Sans KR', Arial, sans-serif;
            display: none;
        `;
        document.body.appendChild(tooltip);
    }

    // data 속성에서 정보 가져오기
    const dataStr = element.getAttribute('data-layer-info');
    if (!dataStr) return;

    try {
        const data = JSON.parse(dataStr);

        // 툴팁 내용 구성
        tooltip.innerHTML = `
            <div style="background: ${data.color}; color: white; padding: 8px 12px; font-weight: 600; font-size: 13px; border-radius: 6px 6px 0 0;">
                ${data.soilName}
            </div>
            <div style="padding: 10px 12px;">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px;">
                    <span style="color: #666;">시추공:</span>
                    <span style="font-weight: 600; color: #1565C0;">${data.holeNo}</span>

                    <span style="color: #666;">심도:</span>
                    <span>GL(-) ${data.depthFrom}m ~ ${data.depthTo}m</span>

                    <span style="color: #666;">표고:</span>
                    <span>EL. ${data.elevTop}m ~ ${data.elevBottom}m</span>

                    <span style="color: #666;">두께:</span>
                    <span style="font-weight: 600; color: #E65100;">${data.thickness}m</span>
                </div>
                <div style="margin-top: 8px; height: 6px; background: ${data.color}; border-radius: 3px;"></div>
            </div>
        `;

        // 위치 설정
        tooltip.style.display = 'block';
        moveLayerTooltip(event);
    } catch (e) {
        console.warn('툴팁 데이터 파싱 오류:', e);
    }
}

/**
 * 툴팁 위치 업데이트
 * @param {Event} event - 마우스 이벤트
 */
function moveLayerTooltip(event) {
    const tooltip = document.getElementById('layerHoverTooltip');
    if (!tooltip || tooltip.style.display === 'none') return;

    const offsetX = 15;
    const offsetY = 15;
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;

    // 화면 경계 체크
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxX = window.innerWidth - tooltipRect.width - 10;
    const maxY = window.innerHeight - tooltipRect.height - 10;

    if (x > maxX) x = event.clientX - tooltipRect.width - offsetX;
    if (y > maxY) y = event.clientY - tooltipRect.height - offsetY;

    tooltip.style.left = `${Math.max(10, x)}px`;
    tooltip.style.top = `${Math.max(10, y)}px`;
}

/**
 * 툴팁 숨기기
 */
function hideLayerTooltip() {
    const tooltip = document.getElementById('layerHoverTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// 토글 및 툴팁 함수 전역 등록
window.toggleLayerConnectionLines = toggleLayerConnectionLines;
window.showLayerTooltip = showLayerTooltip;
window.moveLayerTooltip = moveLayerTooltip;
window.hideLayerTooltip = hideLayerTooltip;

