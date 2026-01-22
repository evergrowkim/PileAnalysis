/**
 * 지반조사 검토 시스템 - 대시보드 및 분석 모듈 (chunk7.js)
 *
 * 이 모듈은 대시보드 테이블, 연약지반 분석, 기초 판정, Excel 내보내기 등의 기능을 제공합니다.
 *
 * @module chunk7
 * @version 1.0.0
 */

// ===== 대시보드 테이블 관련 함수 =====

/** @type {{key: string, direction: 'asc'|'desc'}} 대시보드 테이블 정렬 설정 */
let dashboardSortConfig = { key: 'holeNo', direction: 'asc' };

/**
 * 대시보드 테이블 전체 업데이트
 *
 * 시추공 데이터를 기반으로 대시보드 통계와 테이블을 갱신합니다.
 * 데이터가 없는 경우 아무 동작도 하지 않습니다.
 *
 * @returns {void}
 */
function updateDashboardTable() {
    if (!boreholeData || boreholeData.length === 0) return;
    
    // 대시보드 탭 버튼 표시
    const dashboardTab = document.getElementById('mainTabDashboard');
    if (dashboardTab) dashboardTab.style.display = 'flex';
    
    // 통계 업데이트
    updateDashboardStats();
    
    // 토질 필터 옵션 업데이트
    updateSoilFilterOptions();
    
    // 테이블 렌더링
    renderDashboardTable();
}

function updateDashboardStats() {
    const count = boreholeData.length;
    const avgGL = boreholeData.reduce((sum, bh) => sum + (parseFloat(bh.groundElevation) || 0), 0) / count;
    
    // 지하수위 평균
    const bhWithGW = boreholeData.filter(bh => bh.waterTableElevation != null);
    const avgGW = bhWithGW.length > 0 ? bhWithGW.reduce((sum, bh) => sum + bh.waterTableElevation, 0) / bhWithGW.length : null;
    
    // 풍화암 평균 (weatheredRockElevation 필드 사용)
    const bhWithWR = boreholeData.filter(bh => bh.weatheredRockElevation && bh.weatheredRockElevation !== '-');
    const avgWR = bhWithWR.length > 0 ? bhWithWR.reduce((sum, bh) => sum + parseFloat(bh.weatheredRockElevation), 0) / bhWithWR.length : null;
    
    document.getElementById('statTotalCount').textContent = `${count}공`;
    document.getElementById('statAvgGL').textContent = avgGL ? `EL.${avgGL >= 0 ? '+' : ''}${avgGL.toFixed(2)}m` : '-';
    document.getElementById('statAvgGW').textContent = avgGW ? `EL.${avgGW >= 0 ? '+' : ''}${avgGW.toFixed(2)}m` : '-';
    document.getElementById('statAvgWR').textContent = avgWR ? `EL.${avgWR >= 0 ? '+' : ''}${avgWR.toFixed(2)}m` : '-';
}

function updateSoilFilterOptions() {
    const select = document.getElementById('dashboardSoilFilter');
    if (!select) return;
    
    const soilTypes = new Set();
    boreholeData.forEach(bh => {
        if (bh.soilData) {
            bh.soilData.forEach(layer => {
                if (layer.soil_name) soilTypes.add(layer.soil_name);
            });
        }
    });
    
    select.innerHTML = '<option value="all">모든 토질</option>';
    Array.from(soilTypes).sort().forEach(type => {
        select.innerHTML += `<option value="${type}">${type}</option>`;
    });
}

function filterDashboardTable() {
    renderDashboardTable();
}

function sortDashboardTable(key) {
    if (dashboardSortConfig.key === key) {
        dashboardSortConfig.direction = dashboardSortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        dashboardSortConfig.key = key;
        dashboardSortConfig.direction = 'asc';
    }
    renderDashboardTable();
}

function renderDashboardTable() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody || !boreholeData || boreholeData.length === 0) return;
    
    const searchTerm = (document.getElementById('dashboardSearch')?.value || '').toLowerCase();
    const soilFilter = document.getElementById('dashboardSoilFilter')?.value || 'all';
    
    // 필터링
    let filteredData = boreholeData.filter(bh => {
        const matchSearch = bh.holeNo.toLowerCase().includes(searchTerm);
        const matchSoil = soilFilter === 'all' || (bh.soilData && bh.soilData.some(l => l.soil_name === soilFilter));
        return matchSearch && matchSoil;
    });
    
    // 정렬
    filteredData.sort((a, b) => {
        let aVal, bVal;
        switch (dashboardSortConfig.key) {
            case 'holeNo':
                // 숫자 부분 추출하여 정렬 (예: BH-1, BH-2, NBH-10 등)
                const extractNum = (str) => {
                    const match = str.match(/(\d+)/g);
                    return match ? parseInt(match[match.length - 1]) : 0;
                };
                aVal = extractNum(a.holeNo);
                bVal = extractNum(b.holeNo);
                break;
            case 'groundLevel':
                aVal = parseFloat(a.groundElevation) || 0;
                bVal = parseFloat(b.groundElevation) || 0;
                break;
            case 'gwLevel':
                aVal = a.waterTableElevation ?? -9999;
                bVal = b.waterTableElevation ?? -9999;
                break;
            case 'weatheredRock':
                aVal = (a.weatheredRockElevation && a.weatheredRockElevation !== '-') ? parseFloat(a.weatheredRockElevation) : -9999;
                bVal = (b.weatheredRockElevation && b.weatheredRockElevation !== '-') ? parseFloat(b.weatheredRockElevation) : -9999;
                break;
            case 'softRock':
                aVal = (a.softRockPlusElevation && a.softRockPlusElevation !== '-') ? parseFloat(a.softRockPlusElevation) : -9999;
                bVal = (b.softRockPlusElevation && b.softRockPlusElevation !== '-') ? parseFloat(b.softRockPlusElevation) : -9999;
                break;
            case 'endLevel':
                aVal = a.drillingEndLevel ?? -9999;
                bVal = b.drillingEndLevel ?? -9999;
                break;
            default:
                aVal = a[dashboardSortConfig.key];
                bVal = b[dashboardSortConfig.key];
        }
        if (dashboardSortConfig.direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
    });
    
    // 렌더링
    tbody.innerHTML = filteredData.map(bh => {
        const gl = parseFloat(bh.groundElevation) || 0;
        const gwEL = bh.waterTableElevation;
        // 풍화암/연암 EL 값 (문자열 '-' 처리)
        const wrEL = (bh.weatheredRockElevation && bh.weatheredRockElevation !== '-') ? parseFloat(bh.weatheredRockElevation) : null;
        const srEL = (bh.softRockPlusElevation && bh.softRockPlusElevation !== '-') ? parseFloat(bh.softRockPlusElevation) : null;
        const endEL = bh.boreholeEndElevation ? parseFloat(bh.boreholeEndElevation) : null;
        
        // N값 스파크라인 생성
        const sparkline = generateNValueSparkline(bh);
        
        // 토질 태그 생성
        const soilTags = generateSoilTags(bh);
        
        return `
            <tr style="border-bottom: 1px solid #F0F0F0;" onmouseover="this.style.background='#F8F9FA'" onmouseout="this.style.background='white'">
                <td style="padding: 10px 8px; font-weight: 600; color: #1F2937; font-size: 13px;">${bh.holeNo}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #333;">${formatEL(gl)}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #333;">${formatEL(gwEL)}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #333;">${formatEL(wrEL)}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #333;">${formatEL(srEL)}</td>
                <td style="padding: 10px 8px; text-align: center; font-size: 12px; color: #333;">${formatEL(endEL)}</td>
                <td style="padding: 10px 8px; text-align: center;">${sparkline}</td>
                <td style="padding: 10px 8px;">${soilTags}</td>
                <td style="padding: 10px 8px; text-align: center;">
                    <button onclick="showBoreholeDetail('${bh.holeNo}')"
                        style="color: #0284C7; background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 500;">
                        로그 보기
                    </button>
                </td>
                <td style="padding: 10px 8px; text-align: center;">
                    <button onclick="deleteBorehole('${bh.holeNo}')"
                        style="color: #EF4444; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 600;"
                        title="${bh.holeNo} 삭제">
                        ✕
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="padding: 40px; text-align: center; color: #9E9E9E;">검색 결과가 없습니다</td></tr>';
    }
}

function formatEL(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function generateNValueSparkline(bh) {
    if (!bh.sptData || bh.sptData.length === 0) return '<span style="color: #9E9E9E;">-</span>';
    
    const maxN = 50;
    const width = 70;
    const height = 18;
    
    const nValues = bh.sptData.map(s => Math.min(s.nValue || 0, maxN));
    
    const points = nValues.map((n, i) => {
        const x = (i / (nValues.length - 1 || 1)) * width;
        const y = height - (n / maxN) * height;
        return `${x},${y}`;
    }).join(' ');
    
    return `
        <div style="display: flex; align-items: center; justify-content: center;">
            <svg width="${width}" height="${height}">
                <polyline points="${points}" fill="none" stroke="#546E7A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `;
}

// 토질 태그 확장 상태 저장
window.expandedSoilTags = window.expandedSoilTags || {};

function generateSoilTags(bh) {
    if (!bh.soilData || bh.soilData.length === 0) return '-';

    const soilColors = {
        '매립층': { bg: '#78716C', text: '#FFFFFF' },
        '매립토': { bg: '#78716C', text: '#FFFFFF' },
        '성토': { bg: '#78716C', text: '#FFFFFF' },
        '붕적층': { bg: '#A8A29E', text: '#1F2937' },
        '퇴적층': { bg: '#9CA3AF', text: '#1F2937' },
        '충적층': { bg: '#D2B48C', text: '#1F2937' },
        '풍화잔류토': { bg: '#92816B', text: '#FFFFFF' },
        '잔류토': { bg: '#92816B', text: '#FFFFFF' },
        '풍화토': { bg: '#92816B', text: '#FFFFFF' },
        '풍화암': { bg: '#57534E', text: '#FFFFFF' },
        '연암': { bg: '#44403C', text: '#FFFFFF' },
        '경암': { bg: '#292524', text: '#FFFFFF' },
        '보통암': { bg: '#3F3F46', text: '#FFFFFF' },
        '점토': { bg: '#A0522D', text: '#FFFFFF' },
        '실트': { bg: '#BC8F8F', text: '#1F2937' },
        '모래': { bg: '#F4A460', text: '#1F2937' },
        '사질토': { bg: '#F4A460', text: '#1F2937' },
        '자갈': { bg: '#CD853F', text: '#FFFFFF' }
    };

    // 지층 이름에서 색상 매핑 함수
    function getLayerColor(name) {
        // 정확한 매칭 먼저
        if (soilColors[name]) return soilColors[name];
        // 부분 매칭
        for (const [key, colors] of Object.entries(soilColors)) {
            if (name.includes(key)) return colors;
        }
        return { bg: '#6B7280', text: '#FFFFFF' };
    }

    const holeNo = bh.holeNo;
    const isExpanded = window.expandedSoilTags[holeNo];
    const totalLayers = bh.soilData.length;

    // 기본 표시 개수: 7개까지는 접기 없이 모두 표시
    const defaultShowCount = 7;
    const layers = isExpanded ? bh.soilData : bh.soilData.slice(0, defaultShowCount);
    const remaining = totalLayers - defaultShowCount;

    let html = `<div style="display: flex; flex-wrap: wrap; gap: 3px; align-items: center;">`;

    layers.forEach((layer, idx) => {
        const name = layer.soil_name || 'Unknown';
        const colors = getLayerColor(name);

        // 심도 정보 추출
        let depthInfo = '';
        if (layer.depth_range) {
            const match = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
            if (match) {
                const thickness = (parseFloat(match[2]) - parseFloat(match[1])).toFixed(1);
                depthInfo = thickness + 'm';
            }
        }

        html += `<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; background: ${colors.bg}; color: ${colors.text}; display: inline-flex; align-items: center; gap: 3px;" title="${name} (${layer.depth_range || ''})">${name}${depthInfo ? '<span style="opacity:0.8;font-size:9px;">'+depthInfo+'</span>' : ''}</span>`;
    });

    if (remaining > 0) {
        if (isExpanded) {
            html += `<span onclick="event.stopPropagation(); collapseSoilTags('${holeNo}')" style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: #DBEAFE; color: #1D4ED8; cursor: pointer; border: 1px solid #93C5FD;">접기 ▲</span>`;
        } else {
            html += `<span onclick="event.stopPropagation(); expandSoilTags('${holeNo}')" style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; background: #FEF3C7; color: #92400E; cursor: pointer; border: 1px solid #FCD34D;">+${remaining} 더보기</span>`;
        }
    }
    html += '</div>';
    return html;
}

// 토질 태그 확장
function expandSoilTags(holeNo) {
    window.expandedSoilTags[holeNo] = true;
    renderDashboardTable();
}

// 토질 태그 접기
function collapseSoilTags(holeNo) {
    window.expandedSoilTags[holeNo] = false;
    renderDashboardTable();
}

function showBoreholeDetail(holeNo) {
    // 기존 시추주상도 상세 보기 함수 호출
    if (typeof showBoreholeLog === 'function') {
        showBoreholeLog(holeNo);
    } else if (typeof openBoreholeDetailModal === 'function') {
        openBoreholeDetailModal(holeNo);
    } else {
        // 대체 모달
        const bh = boreholeData.find(b => b.holeNo === holeNo);
        if (bh) {
            alert(`시추공: ${holeNo}\n지표고: EL.${formatEL(parseFloat(bh.groundElevation))}\n시추심도: ${bh.drillingDepth || '-'}m`);
        }
    }
}

// Debounce 함수 for 연약지반 최소 두께 실시간 반영
let weakSoilDebounceTimer = null;
function debounceWeakSoilAnalysis() {
    if (weakSoilDebounceTimer) {
        clearTimeout(weakSoilDebounceTimer);
    }
    weakSoilDebounceTimer = setTimeout(() => {
        runWeakSoilAnalysis();
    }, 300); // 300ms 대기 후 실행
}

function runWeakSoilAnalysis() {
    if (!boreholeData || boreholeData.length === 0) {
        // alert('먼저 시추공 데이터를 업로드하세요.'); // Don't alert on auto-run
        return;
    }

    window.weakSoilResults = []; // Store results globally
    window.weakSoilAnalysisResults = []; // Alias for compatibility

    boreholeData.forEach((borehole, index) => {
        if (!borehole || !borehole.soilData) return;

        const holeNo = borehole.holeNo || `BH-${index + 1}`;
        const groundElevation = parseFloat(borehole.groundElevation) || 0;
        const excavationLevel = parseFloat(borehole.excavationLevelInput) || 0;

        // Analyze layers
        const layerAnalysis = [];
        const layersForMerge = [];

        borehole.soilData.forEach((layer, layerIndex) => {
            if (!layer || !layer.depth_range) return;
            const depthMatch = layer.depth_range.match(/(\d+\.?\d*)\s*~\s*(\d+\.?\d*)/);
            if (!depthMatch) return;
            
            const depthStart = parseFloat(depthMatch[1]);
            const depthEnd = parseFloat(depthMatch[2]);
            const thickness = depthEnd - depthStart;
            const elevationTop = groundElevation - depthStart;
            const elevationBottom = groundElevation - depthEnd;
            
            // Get N value (average for layer)
            let avgN = null;
            if (borehole.sptData) {
                const layerSPT = borehole.sptData.filter(spt => spt.soilLayer === layerIndex);
                if (layerSPT.length > 0) {
                    avgN = Math.round(layerSPT.reduce((sum, spt) => sum + spt.nValue, 0) / layerSPT.length);
                }
            }
            
            // Classify
            const classification = classifySoilType(layer.soil_name, avgN, thickness);
            
            const layerInfo = {
                layerIndex,
                depthStart,
                depthEnd,
                thickness,
                elevationTop,
                elevationBottom,
                soilName: layer.soil_name,
                avgN,
                ...classification,
                sptSamples: borehole.sptData ? borehole.sptData.filter(spt => spt.soilLayer === layerIndex) : []
            };
            
            layerAnalysis.push(layerInfo);
            
            if (classification.isWeak) {
                layersForMerge.push(layerInfo);
            }
        });
        
        // Merge weak zones
        const weakZones = mergeWeakZones(layersForMerge);
        
        // Determine risk level for zones
        weakZones.forEach(zone => {
            // Simple risk assessment logic
            const distToExcavation = Math.min(
                Math.abs(zone.startElevation - excavationLevel),
                Math.abs(zone.endElevation - excavationLevel)
            );
            
            // Check if excavation is within zone
            if (excavationLevel <= zone.startElevation && excavationLevel >= zone.endElevation) {
                zone.riskLevel = 'CRITICAL';
                zone.description = '굴착면이 연약지반 내에 위치함';
            } else if (distToExcavation < 3.0) {
                zone.riskLevel = 'HIGH';
                zone.description = '굴착면 3m 이내에 연약지반 존재';
            } else if (distToExcavation < 5.0) {
                zone.riskLevel = 'MEDIUM';
                zone.description = '굴착면 5m 이내에 연약지반 존재';
            } else {
                zone.riskLevel = 'LOW';
                zone.description = '굴착면과 이격되어 있음';
            }
            
            zone.zoneType = zone.layers[0].soilType === 'cohesive' ? '점성토(압밀침하)' : '사질토/기타(즉시침하/전단파괴)';
        });
        
        const result = {
            holeNo,
            groundElevation,
            excavationLevel,
            layerAnalysis,
            weakZones,
            totalWeakZones: weakZones.length,
            weak_soil_detected: weakZones.length > 0,
            weak_soil_depth: weakZones.length > 0 ? weakZones[0].startDepth : 0,
            weak_soil_thickness: weakZones.length > 0 ? weakZones.reduce((sum, z) => sum + z.thickness, 0) : 0
        };
        
        window.weakSoilResults.push(result);
        window.weakSoilAnalysisResults.push(result);
    });
    
    displayWeakSoilResults();
}

function displayWeakSoilResults() {
    const resultsDiv = document.getElementById('weakSoilResults');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';

    // 상태 배지 업데이트 (미판정 → 판정 완료)
    const statusBadge = document.getElementById('weakSoilStatus');
    if (statusBadge) {
        statusBadge.textContent = '판정 완료';
        statusBadge.classList.add('success');
    }

    if (!window.weakSoilResults || window.weakSoilResults.length === 0) {
        resultsDiv.innerHTML = '<p>분석 결과가 없습니다.</p>';
        return;
    }

    const totalBoreholes = window.weakSoilResults.length;
    const weakDetectedCount = window.weakSoilResults.filter(r => r.totalWeakZones > 0).length;
    
    let html = `
        <div class="summary-cards" style="text-align: center;">
            <div class="summary-card">
                <h3>총 시추공</h3>
                <div class="value">${totalBoreholes}</div>
            </div>
            <div class="summary-card" style="border-left-color: ${weakDetectedCount > 0 ? '#F57F17' : '#2E7D32'};">
                <h3>연약지반 탐지</h3>
                <div class="value" style="color: ${weakDetectedCount > 0 ? '#F57F17' : '#2E7D32'};">${weakDetectedCount} 공</div>
            </div>
        </div>
        
        <div class="borehole-table-wrapper" style="margin-top: 20px;">
            <table class="borehole-table">
                <thead>
                    <tr>
                        <th>시추공</th>
                        <th>지표고(m)</th>
                        <th>굴착면(m)</th>
                        <th>연약지반<br>탐지결과</th>
                        <th>구간 수</th>
                        <th>총 두께(m)</th>
                        <th>상세</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    window.weakSoilResults.forEach((result, index) => {
        const hasWeakSoil = result.totalWeakZones > 0;
        const statusClass = hasWeakSoil ? 'status-warning' : 'status-pass';
        const statusText = hasWeakSoil ? '탐지됨' : '미탐지';
        
        html += `
            <tr>
                <td style="text-align: center;"><strong class="clickable-hole-no" onclick="showBoreholeLog('${result.holeNo}')" style="cursor: pointer; color: #1976D2; text-decoration: underline;">${result.holeNo}</strong></td>
                <td style="text-align: center;">${result.groundElevation.toFixed(2)}</td>
                <td style="text-align: center;">${result.excavationLevel.toFixed(2)}</td>
                <td style="text-align: center;"><span class="${statusClass}">${statusText}</span></td>
                <td style="text-align: center;">${result.totalWeakZones}</td>
                <td style="text-align: center;">${result.weak_soil_thickness.toFixed(2)}</td>
                <td style="text-align: center;">
                    ${hasWeakSoil ? `<button class="btn-detail-small" onclick="showWeakSoilDetails(${index}, 0)">상세</button>` : '-'}
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
    `;
    
    resultsDiv.innerHTML = html;

    // 미니 맵 업데이트 (연약지반 결과 반영)
    if (typeof createMiniContourMap === 'function' && typeof getAnalysisMarkerData === 'function') {
        setTimeout(() => {
            createMiniContourMap('weakSoilMiniMap', 'ground_elevation', getAnalysisMarkerData('weakSoil'));
        }, 100);
    }

    // Step 7 종합 검토 결과 자동 업데이트 (에러 발생 시에도 Step 3 결과는 유지)
    try {
        if (typeof displayCombinedResults === 'function') {
            displayCombinedResults();
        }
    } catch (error) {
        console.error('Step 7 종합 검토 결과 업데이트 중 오류:', error);
        // 에러가 발생해도 Step 3 결과는 유지됨
    }
}

function performSimpleFoundationAssessment() {
    if (boreholeData.length === 0) return;
    
    window.simpleFoundationResults = [];
    
    boreholeData.forEach((borehole, index) => {
        const holeNo = borehole.holeNo;
        const excavationLevel = parseFloat(borehole.excavationLevelInput);
        const bedrockLevel = borehole.bedrockTopElevation !== '-' && borehole.bedrockTopElevation !== 'N/A' ? parseFloat(borehole.bedrockTopElevation) : null;
        
        let judgment = '미판단';
        let reason = '';
        let judgmentColor = '#757575';
        
        if (bedrockLevel !== null) {
            if (excavationLevel <= bedrockLevel) {
                judgment = '직접 기초';
                reason = '굴착면이 기반암 하부에 위치함';
                judgmentColor = '#2E7D32';
            } else {
                const distToBedrock = excavationLevel - bedrockLevel;
                if (distToBedrock <= 3.0) {
                    judgment = '치환 후 직접 기초 또는 파일 기초';
                    reason = `굴착면 하부 ${distToBedrock.toFixed(2)}m 위치에 기반암 존재`;
                    judgmentColor = '#F57C00';
                } else {
                    judgment = '파일 기초 필요';
                    reason = `기반암이 굴착면 하부 ${distToBedrock.toFixed(2)}m 깊이에 위치함`;
                    judgmentColor = '#C62828';
                }
            }
        } else {
            judgment = '파일 기초 필요';
            reason = '기반암 미출현 (심도 깊음)';
            judgmentColor = '#C62828';
        }
        
        window.simpleFoundationResults.push({
            holeNo,
            judgment,
            reason,
            color: judgmentColor
        });
    });
    
    displaySimpleFoundationResults();

    // 오버레이 업데이트 (시각화 탭의 캔버스 업데이트)
    if (typeof updateOverlayCanvas === 'function') {
        updateOverlayCanvas();
    }
}

function displaySimpleFoundationResults() {
    const resultsDiv = document.getElementById('simpleFoundationResults');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';

    // 상태 배지 업데이트 (미판정 → 판정 완료)
    const statusBadge = document.getElementById('foundationStatus');
    if (statusBadge) {
        statusBadge.textContent = '판정 완료';
        statusBadge.classList.add('success');
    }

    if (!window.simpleFoundationResults || window.simpleFoundationResults.length === 0) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    let html = `
        <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" onclick="showFoundationOn2DMap()" style="font-size: 12px; padding: 6px 12px;">2D 맵에서 보기</button>
        </div>
        <div class="standard-box" style="margin-bottom: 20px;">
            <h3>1차 기초 형식 판단 결과 (간이)</h3>
            <div class="borehole-table-wrapper">
                <table class="borehole-table">
                    <thead>
                        <tr>
                            <th>시추공</th>
                            <th>판단 결과</th>
                            <th>판단 근거</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    window.simpleFoundationResults.forEach(result => {
        html += `
            <tr>
                <td style="text-align: center;"><strong class="clickable-hole-no" onclick="showBoreholeLog('${result.holeNo}')" style="cursor: pointer; color: #1976D2; text-decoration: underline;">${result.holeNo}</strong></td>
                <td style="text-align: center;">
                    <span style="color: white; background: ${result.color}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        ${result.judgment}
                    </span>
                </td>
                <td style="font-size: 13px;">${result.reason}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                ※ 이 결과는 굴착면과 기반암의 위치 관계만을 고려한 1차 간이 판단 결과입니다. 종합 검토 결과는 Step 7에서 확인할 수 있습니다.
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;

    // 미니 맵 업데이트 (직접기초 판정 결과 반영)
    if (typeof createMiniContourMap === 'function' && typeof getAnalysisMarkerData === 'function') {
        setTimeout(() => {
            createMiniContourMap('foundationMiniMap', 'ground_elevation', getAnalysisMarkerData('foundation'));
        }, 100);
    }

    // Step 7 종합 검토 결과 자동 업데이트 (에러 발생 시에도 Step 5 결과는 유지)
    try {
        if (typeof displayCombinedResults === 'function') {
            displayCombinedResults();
        }
    } catch (error) {
        console.error('Step 7 종합 검토 결과 업데이트 중 오류:', error);
        // 에러가 발생해도 Step 5 결과는 유지됨
    }
}

function findBedrockDepth(borehole) {
    // Try to use pre-calculated values if available
    if (borehole.bedrockTopElevation !== '-' && borehole.bedrockTopElevation !== 'N/A') {
        return parseFloat(borehole.groundElevation) - parseFloat(borehole.bedrockTopElevation);
    }
    
    // Otherwise search in soil data
    const soilData = borehole.soilData || [];
    for (let layer of soilData) {
        if (isBedrockLayer(layer.soil_name)) {
            const match = layer.depth_range.match(/(\d+\.?\d*)/);
            if (match) return parseFloat(match[1]);
        }
    }
    return null;
}

// Helper function for visualization (needed for weak soil visualization)
function findBedrockLevelFromResult(result) {
    // Try to find bedrock level from ground elevation - bedrock depth
    // Since we don't have bedrock depth in result directly, we might need to look it up
    const borehole = boreholeData.find(bh => bh.holeNo === result.holeNo);
    if (borehole && borehole.bedrockTopElevation !== '-' && borehole.bedrockTopElevation !== 'N/A') {
        return parseFloat(borehole.bedrockTopElevation);
    }
    return null;
}

// Calculate Es from soil name and N value (Bowles method)
function calculateEsFromSoilAndN(soilName, nValue) {
    if (!soilName || !nValue || nValue <= 0) return 15000; // Default
    
    const name = soilName.toLowerCase();
    let es = 15000; // Default
    
    // 기반암 (우선순위 최상위)
    if (name.includes('암') || name.includes('rock') || name.includes('기반암') || name.includes('풍화암')) {
        return 255000; // 고정값
    }
    
    // 사질토 (Bowles 공식)
    if (name.includes('모래') || name.includes('sand') || name.includes('사질')) {
        if (name.includes('실트') || name.includes('silt')) {
            es = 300 * nValue;
        } else if (name.includes('세립') || name.includes('fine')) {
            es = 400 * nValue;
        } else if (name.includes('중립') || name.includes('medium')) {
            es = 500 * nValue;
        } else if (name.includes('조립') || name.includes('coarse')) {
            es = 600 * nValue;
        } else if (name.includes('자갈') || name.includes('gravel')) {
            es = 700 * nValue;
        } else {
            es = 500 * nValue; // 기본값
        }
    }
    // 점성토 (Bowles 공식)
    else if (name.includes('점토') || name.includes('clay') || name.includes('점질')) {
        if (nValue < 4) {
            es = 200 * nValue;
        } else if (nValue < 8) {
            es = 400 * nValue;
        } else if (nValue < 15) {
            es = 600 * nValue;
        } else {
            es = 800 * nValue;
        }
    }
    // 실트
    else if (name.includes('실트') || name.includes('silt')) {
        es = 400 * nValue;
    }
    // 기타
    else {
        es = 400 * nValue;
    }
    
    // 최소값 제한
    return Math.max(es, 3000);
}

// Update foundation depth type globally
function updateFoundationDepthTypeGlobal(value) {
    // This function can be used to update global settings if needed
    // Currently just a placeholder
    if (window.foundationDepthType) {
        window.foundationDepthType = value;
    }
}

// Modal functions for showing criteria
function showVerificationCriteriaModal() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    modalTitle.textContent = '시추 깊이 검증 기준';
    modalBody.innerHTML = `
        <div style="padding: 20px;">
            <h3 style="color: #455A64; margin-bottom: 15px;">시추 깊이 검증 기준</h3>
            <div style="background: #F5F5F5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">전제 조건</h4>
                <ul style="margin: 5px 0; padding-left: 20px; font-size: 14px;">
                    <li>시추 종료 레벨 < 굴착면 레벨 (시추가 굴착면보다 깊어야 함)</li>
                </ul>
            </div>
            <div style="background: #E3F2FD; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Case 1: 굴착면이 기반암 상부에 위치</h4>
                <p style="font-size: 13px; color: #666; margin: 5px 0 10px 0;">굴착면 레벨 > 암반 출현 레벨</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
                    <tr style="background: #BBDEFB;">
                        <th style="border: 1px solid #90CAF9; padding: 8px; text-align: left;">Case</th>
                        <th style="border: 1px solid #90CAF9; padding: 8px; text-align: left;">암종 조합</th>
                        <th style="border: 1px solid #90CAF9; padding: 8px; text-align: left;">기준</th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">1-A</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">풍화암만</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">풍화암 + <strong>5m</strong></td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">1-B</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">연암 이상만</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">연암 + <strong>3m</strong></td>
                    </tr>
                    <tr style="background: #FFF9C4;">
                        <td style="border: 1px solid #90CAF9; padding: 8px;">1-C</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;">풍화암 + 연암</td>
                        <td style="border: 1px solid #90CAF9; padding: 8px;"><strong style="color: #D32F2F;">★ 연암 + 3m</strong> (우선)</td>
                    </tr>
                </table>
            </div>
            <div style="background: #E8F5E9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Case 2: 굴착면이 기반암에 걸침</h4>
                <p style="font-size: 13px; color: #666; margin: 5px 0 10px 0;">굴착면 레벨 ≤ 암반 출현 레벨</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
                    <tr style="background: #C8E6C9;">
                        <th style="border: 1px solid #A5D6A7; padding: 8px; text-align: left;">Case</th>
                        <th style="border: 1px solid #A5D6A7; padding: 8px; text-align: left;">조건</th>
                        <th style="border: 1px solid #A5D6A7; padding: 8px; text-align: left;">기준</th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">2-A</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">풍화암에 걸침 (연암 없음)</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">굴착면 + <strong>5m</strong></td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">2-B</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">연암에 걸침</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">굴착면 + <strong>3m</strong></td>
                    </tr>
                    <tr style="background: #FFF9C4;">
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">2-C</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;">풍화암 걸침 + 연암 존재</td>
                        <td style="border: 1px solid #A5D6A7; padding: 8px;"><strong style="color: #D32F2F;">★ 연암 + 3m</strong> (우선)</td>
                    </tr>
                </table>
            </div>
            <div style="background: #FFF3E0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">토사층만 있는 경우</h4>
                <ul style="margin: 5px 0; padding-left: 20px; font-size: 14px;">
                    <li>굴착면 하부 <strong>3m 이상</strong> 시추 필요</li>
                </ul>
            </div>
            <div style="background: #FCE4EC; padding: 15px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #C62828;">★ 핵심 원칙</h4>
                <p style="font-size: 14px; margin: 0; color: #333;">
                    풍화암/연암 동시 존재 시 → <strong>연암 이상 기준 우선 적용</strong>
                </p>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

function showWeakSoilCriteriaModal() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    modalTitle.textContent = '연약지반 판정 기준';
    modalBody.innerHTML = `
        <div style="padding: 24px; font-family: 'Noto Sans KR', sans-serif; color: #333; line-height: 1.7;">
            <h3 style="color: #37474F; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">연약지반 판정 기준</h3>
            
            <!-- 점성토 -->
            <div style="background: #F5F5F5; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">점성토 (점토, Clay, CL, CH, ML)</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li style="margin-bottom: 4px;">두께 &lt; 10m: <strong>N ≤ 4</strong></li>
                    <li>두께 ≥ 10m: <strong>N ≤ 6</strong></li>
                </ul>
            </div>
            
            <!-- 사질토 -->
            <div style="background: #FAFAFA; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px; border: 1px solid #E0E0E0;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">사질토 (모래, Sand, SP, SW, SM)</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li><strong>N &lt; 10</strong></li>
                </ul>
            </div>
            
            <!-- 특수토 -->
            <div style="background: #F5F5F5; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">특수토 (붕적토, 매립토, Fill, OH, OL)</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li><strong>N &lt; 10</strong> 또는 N값 없음</li>
                </ul>
            </div>
            
            <!-- 최소 두께 기준 -->
            <div style="background: #ECEFF1; padding: 16px 20px; border-radius: 4px; border-left: 4px solid #546E7A;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">최소 두께 기준</h4>
                <p style="margin: 0; font-size: 14px; color: #455A64;">
                    연속된 연약지반 구간이 사용자가 설정한 최소 두께 이상일 때만 연약지반으로 판정합니다.<br>
                    <strong>(기본값: 1.0m, 조정 가능)</strong>
                </p>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// 2D 맵에서 연약지반 결과 보기
function showWeakSoilOn2DMap() {
    // 연약지반 체크박스 활성화
    const softGroundCheckbox = document.getElementById('chk2DSoftGround');
    if (softGroundCheckbox) {
        softGroundCheckbox.checked = true;
    }

    // 시각화 탭으로 이동
    if (typeof switchMainTab === 'function') {
        switchMainTab('visualization');
    }

    // 2D 등고선 맵 탭 선택
    setTimeout(() => {
        if (typeof switchSubTab === 'function') {
            switchSubTab('contour');
        }
        // 2D 맵 업데이트
        if (typeof updateContourMap === 'function') {
            updateContourMap();
        }
    }, 200);
}

// 2D 맵에서 전석/붕적층 결과 보기
function showBoulderOn2DMap() {
    // 특수지층 체크박스 활성화
    const specialLayerCheckbox = document.getElementById('chk2DSpecialLayer');
    if (specialLayerCheckbox) {
        specialLayerCheckbox.checked = true;
    }

    // 시각화 탭으로 이동
    if (typeof switchMainTab === 'function') {
        switchMainTab('visualization');
    }

    // 2D 등고선 맵 탭 선택
    setTimeout(() => {
        if (typeof switchSubTab === 'function') {
            switchSubTab('contour');
        }
        // 2D 맵 업데이트
        if (typeof updateContourMap === 'function') {
            updateContourMap();
        }
    }, 200);
}

// 2D 맵에서 직접기초 판정 결과 보기
function showFoundationOn2DMap() {
    // 직접기초 체크박스 활성화
    const foundationCheckbox = document.getElementById('chk2DFoundation');
    if (foundationCheckbox) {
        foundationCheckbox.checked = true;
    }

    // 시각화 탭으로 이동
    if (typeof switchMainTab === 'function') {
        switchMainTab('visualization');
    }

    // 2D 등고선 맵 탭 선택
    setTimeout(() => {
        if (typeof switchSubTab === 'function') {
            switchSubTab('contour');
        }
        // 2D 맵 업데이트
        if (typeof updateContourMap === 'function') {
            updateContourMap();
        }
    }, 200);
}

function showBoulderCriteriaModal() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }

    modalTitle.textContent = '전석/호박돌 및 붕적/이암층 판정 기준';
    modalBody.innerHTML = `
        <div style="padding: 24px; font-family: 'Noto Sans KR', sans-serif; color: #333; line-height: 1.7;">
            <h3 style="color: #37474F; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">전석/호박돌 및 붕적/이암층 판정 기준</h3>
            
            <!-- 전석/호박돌 판정 -->
            <div style="background: #F5F5F5; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">전석/호박돌 판정</h4>
                <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li style="margin-bottom: 4px;"><strong>조건:</strong> 토층 내에서만 판정 (기반암층 제외)</li>
                    <li style="margin-bottom: 4px;"><strong>키워드:</strong> 전석, 호박돌, boulder, cobble, 핵석, 거력, 왕자갈, 자갈</li>
                    <li><strong>주의:</strong> 기반암층의 암편은 전석이 아님 (원지반)</li>
                </ul>
            </div>
            
            <!-- 토질 분류 기준 -->
            <div style="background: #FAFAFA; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px; border: 1px solid #E0E0E0;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">토질 분류 기준 (USCS/KS F 2324)</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background: #546E7A; color: white;">
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #455A64;">분류</th>
                            <th style="padding: 10px 12px; text-align: center; border: 1px solid #455A64;">크기 범위</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">자갈 (Gravel)</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center;"><strong>4.75mm ~ 75mm</strong></td>
                        </tr>
                        <tr style="background: #F5F5F5;">
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">호박돌 (Cobble)</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center;"><strong>75mm ~ 300mm</strong></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">전석 (Boulder)</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center;"><strong>300mm 이상</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- 붕적층 판정 -->
            <div style="background: #F5F5F5; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">붕적층 판정</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li style="margin-bottom: 4px;"><strong>키워드:</strong> 붕적, colluvial, talus, scree</li>
                    <li><strong>특징:</strong> 산사면에서 이동한 토사층</li>
                </ul>
            </div>
            
            <!-- 이암층 판정 -->
            <div style="background: #FAFAFA; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px; border: 1px solid #E0E0E0;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">이암층 판정</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #455A64;">
                    <li style="margin-bottom: 4px;"><strong>키워드:</strong> 이암, shale, 셰일</li>
                    <li><strong>특징:</strong> 퇴적암 중 하나로, 시공 시 주의 필요</li>
                </ul>
            </div>
            
            <!-- 굴착 작업 시 주의 기준 -->
            <div style="background: #ECEFF1; padding: 16px 20px; border-radius: 4px; margin-bottom: 16px; border-left: 4px solid #546E7A;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">굴착 작업 시 주의 기준</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #455A64;">
                    <li style="margin-bottom: 4px;"><strong>100~150mm 이상:</strong> 일반 굴착에 지장 시작</li>
                    <li style="margin-bottom: 4px;"><strong>200mm 이상 호박돌:</strong> 리퍼(Ripper) 작업 또는 브레이커 병행 필요</li>
                    <li><strong>300mm 이상 전석:</strong> 암반에 준하는 취급, 별도 파쇄 공정 계획 필요</li>
                </ul>
            </div>
            
            <!-- 파일 항타 시 주의 기준 -->
            <div style="background: #F5F5F5; padding: 16px 20px; border-radius: 4px; border-left: 4px solid #78909C;">
                <h4 style="margin: 0 0 10px 0; color: #37474F; font-size: 14px; font-weight: 600;">파일 항타 시 주의 기준</h4>
                <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 13px; color: #455A64;">
                    <li style="margin-bottom: 4px;"><strong>50~75mm 이상 자갈 밀집층:</strong> 관입 저항 급격 증가</li>
                    <li><strong>100mm 이상 자갈 존재 시:</strong> 다음 문제 발생</li>
                </ul>
                <div style="margin-left: 20px; padding: 10px 16px; background: white; border-radius: 4px; font-size: 13px; color: #546E7A;">
                    <ul style="margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 4px;"><strong>PHC/PC 파일:</strong> 두부 파손, 본체 균열 위험</li>
                        <li style="margin-bottom: 4px;"><strong>강관 파일:</strong> 선단부 변형, 편타(偏打) 발생</li>
                        <li><strong>공통:</strong> 항타 에너지 손실 및 지지력 산정 오류</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// 시추 깊이 검증 기준 모달
function showDepthCriteriaModal() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }

    modalTitle.textContent = '시추 깊이 검증 기준';
    modalBody.innerHTML = `
        <div style="padding: 24px; font-family: 'Noto Sans KR', sans-serif; color: #333; line-height: 1.7;">
            
            <!-- 개요 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #F5F5F5; border-left: 4px solid #546E7A; border-radius: 2px;">
                <h4 style="margin: 0 0 8px 0; color: #37474F; font-size: 14px; font-weight: 600;">개요</h4>
                <p style="margin: 0; font-size: 13px; color: #546E7A;">
                    시추 깊이 검증은 지반조사 결과가 설계 및 시공에 필요한 정보를 충분히 제공하는지 확인하는 절차입니다. 
                    본 기준은 「지반조사 편람」 및 「구조물 기초 설계기준(KDS 11 10 05)」에 따라 굴착면과 기반암 조건을 
                    고려한 최소 시추 깊이를 규정합니다.
                </p>
            </div>

            <!-- 전제 조건 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 2px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">전제 조건</h4>
                <p style="margin: 0; font-size: 13px; color: #546E7A;">
                    <strong>시추 종료 레벨 &lt; 굴착면 레벨</strong> — 시추공이 설계 굴착면보다 충분히 깊은 심도까지 
                    조사되어야 기초 지지층의 특성을 파악할 수 있습니다.
                </p>
            </div>

            <!-- Case 1 -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px;">
                    Case 1: 굴착면이 기반암 상부에 위치
                </h4>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #78909C;">
                    조건: 굴착면 레벨 &gt; 암반 출현 레벨 (토사층 내 굴착)
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #455A64; color: white;">
                            <th style="padding: 10px 12px; text-align: center; border: 1px solid #37474F; font-weight: 500; width: 80px;">Case</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">암종 조합</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">최소 시추 깊이 기준</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; background: #FAFAFA; font-weight: 500;">1-A</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;">풍화암만 존재</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;"><strong>풍화암 상단 + 5m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA; font-size: 12px; color: #666;">풍화암 관입 5m</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 500;">1-B</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">연암 이상만 존재</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;"><strong>연암 상단 + 3m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">연암 관입 3m</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; background: #FAFAFA; font-weight: 500;">1-C</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;">풍화암 + 연암 동시 존재</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;"><strong>연암 상단 + 3m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA; font-size: 12px; color: #455A64;">★ 연암 기준 우선</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Case 2 -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px;">
                    Case 2: 굴착면이 기반암에 걸침
                </h4>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #78909C;">
                    조건: 굴착면 레벨 ≤ 암반 출현 레벨 (암반 내 굴착)
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #546E7A; color: white;">
                            <th style="padding: 10px 12px; text-align: center; border: 1px solid #455A64; font-weight: 500; width: 80px;">Case</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #455A64; font-weight: 500;">조건</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #455A64; font-weight: 500;">최소 시추 깊이 기준</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #455A64; font-weight: 500;">비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; background: #FAFAFA; font-weight: 500;">2-A</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;">풍화암에 걸침 (연암 미출현)</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;"><strong>굴착면 + 5m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA; font-size: 12px; color: #666;">굴착면 하부 5m</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 500;">2-B</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">연암에 걸침</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;"><strong>굴착면 + 3m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">굴착면 하부 3m</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; text-align: center; background: #FAFAFA; font-weight: 500;">2-C</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;">풍화암 걸침 + 연암 존재</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA;"><strong>연암 상단 + 3m</strong></td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FAFAFA; font-size: 12px; color: #455A64;">★ 연암 기준 우선</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 토사층만 있는 경우 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 2px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">토사층만 존재하는 경우</h4>
                <p style="margin: 0; font-size: 13px; color: #546E7A;">
                    기반암(풍화암, 연암)이 확인되지 않은 경우, 굴착면 하부 <strong>최소 3m 이상</strong> 시추하여 
                    기초 지지층의 특성을 파악해야 합니다. 다만, 구조물 규모 및 기초 형식에 따라 추가 심도 확보가 
                    필요할 수 있습니다.
                </p>
            </div>

            <!-- 핵심 원칙 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #ECEFF1; border: 1px solid #CFD8DC; border-radius: 2px;">
                <h4 style="margin: 0 0 8px 0; color: #455A64; font-size: 14px; font-weight: 600;">핵심 원칙</h4>
                <p style="margin: 0; font-size: 13px; color: #546E7A;">
                    풍화암과 연암이 동시에 존재하는 경우, <strong>연암 이상 기준을 우선 적용</strong>합니다. 
                    이는 연암 이상의 암반이 보다 신뢰성 있는 지지층으로 기능하므로, 해당 암종에 대한 
                    충분한 관입 깊이를 확보하기 위함입니다.
                </p>
            </div>

            <!-- 암반 분류 -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px;">
                    암반 분류 기준
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #607D8B; color: white;">
                            <th style="padding: 8px 12px; text-align: left; border: 1px solid #546E7A; font-weight: 500;">암반 등급</th>
                            <th style="padding: 8px 12px; text-align: center; border: 1px solid #546E7A; font-weight: 500;">풍화도</th>
                            <th style="padding: 8px 12px; text-align: left; border: 1px solid #546E7A; font-weight: 500;">포함 분류</th>
                            <th style="padding: 8px 12px; text-align: center; border: 1px solid #546E7A; font-weight: 500;">관입 기준</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">풍화암</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center;">CW ~ HW</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">풍화암, 풍화암반, 완전풍화, 심한풍화</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center;">5m</td>
                        </tr>
                        <tr style="background: #FAFAFA;">
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">연암 이상</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center;">MW ~ FR</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">연암, 보통암, 경암, 기반암</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center;">3m</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 참고문헌 -->
            <div style="padding: 12px 16px; background: #ECEFF1; border-radius: 2px; font-size: 12px; color: #607D8B;">
                <strong>참고 기준:</strong> KDS 11 10 05 (지반조사), 지반조사 편람, 구조물 기초 설계기준 해설
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

// 직접기초 판정 기준 모달
function showFoundationCriteriaModal() {
    const modal = document.getElementById('calculationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) {
        alert('모달 요소를 찾을 수 없습니다.');
        return;
    }

    modalTitle.textContent = '직접기초 판정 기준 (간이)';
    modalBody.innerHTML = `
        <div style="padding: 24px; font-family: 'Noto Sans KR', sans-serif; color: #333; line-height: 1.7;">
            
            <!-- 개요 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #F5F5F5; border-left: 4px solid #546E7A; border-radius: 2px;">
                <h4 style="margin: 0 0 8px 0; color: #37474F; font-size: 14px; font-weight: 600;">개요</h4>
                <p style="margin: 0; font-size: 13px; color: #546E7A;">
                    본 판정은 <strong>기반암(풍화암/연암) 출현 레벨과 굴착 레벨의 관계</strong>를 기준으로 
                    직접기초 적용 가능성을 간이 판정합니다. 최종 기초 형식 결정은 상세 지지력 검토를 통해 확정해야 합니다.
                </p>
            </div>

            <!-- 핵심 원칙 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #E8F5E9; border: 1px solid #A5D6A7; border-radius: 2px;">
                <h4 style="margin: 0 0 8px 0; color: #2E7D32; font-size: 14px; font-weight: 600;">핵심 원칙</h4>
                <p style="margin: 0; font-size: 13px; color: #388E3C;">
                    <strong>굴착 레벨이 기반암 출현 레벨과 같거나 그 하부에 위치하면 직접 기초 가능</strong><br>
                    (굴착면 EL ≤ 기반암 EL → 직접 기초 적합)
                </p>
            </div>

            <!-- 판정 기준표 -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px;">
                    기초 형식 판정 기준
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #455A64; color: white;">
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">판정 결과</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">조건</th>
                            <th style="padding: 10px 12px; text-align: left; border: 1px solid #37474F; font-weight: 500;">설명</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #E8F5E9; font-weight: 500; color: #2E7D32;">직접 기초</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #E8F5E9;">
                                굴착면 EL ≤ 기반암 EL
                            </td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #E8F5E9; font-size: 12px;">
                                굴착면이 기반암 레벨과 같거나 하부에 위치하므로<br>직접 기초 지지층 확보 가능
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; font-weight: 500; color: #F57C00;">치환 후 직접기초<br>또는 파일기초</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0;">
                                굴착면 EL > 기반암 EL<br>(이격거리 ≤ 3m)
                            </td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; font-size: 12px;">
                                기반암까지 3m 이내이므로 치환 공법 또는<br>짧은 말뚝 적용 검토
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FFEBEE; font-weight: 500; color: #C62828;">파일 기초 필요</td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FFEBEE;">
                                굴착면 EL > 기반암 EL<br>(이격거리 > 3m) 또는<br>기반암 미출현
                            </td>
                            <td style="padding: 10px 12px; border: 1px solid #E0E0E0; background: #FFEBEE; font-size: 12px;">
                                기반암까지 거리가 멀거나 미출현으로<br>말뚝 기초 검토 필요
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 지지층 N값 기준 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 2px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">참고 1. 지지층 N값 기준</h4>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #546E7A;">
                    직접기초의 지지층은 기초 저면 하부 유효 영향 깊이(B~1.5B) 내에서 충분한 N값을 확보해야 합니다.
                </p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #546E7A; color: white;">
                            <th style="padding: 8px 12px; text-align: left; border: 1px solid #455A64; font-weight: 500;">토질 유형</th>
                            <th style="padding: 8px 12px; text-align: center; border: 1px solid #455A64; font-weight: 500;">최소 N값</th>
                            <th style="padding: 8px 12px; text-align: left; border: 1px solid #455A64; font-weight: 500;">비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">점성토 (CL, CH, ML)</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 600;">N ≥ 15</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">견고(Stiff) 이상</td>
                        </tr>
                        <tr style="background: #FAFAFA;">
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">사질토 (SP, SW, SM)</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 600;">N ≥ 20</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">중간조밀(Medium Dense) 이상</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">풍화토/잔류토</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 600;">N ≥ 15</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">조밀한 상태</td>
                        </tr>
                        <tr style="background: #FAFAFA;">
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0;">풍화암/연암</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; text-align: center; font-weight: 600;">N ≥ 50 (또는 코어 회수)</td>
                            <td style="padding: 8px 12px; border: 1px solid #E0E0E0; font-size: 12px; color: #666;">양호한 지지층</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 연약지반 판정 연계 -->
            <div style="margin-bottom: 24px; padding: 16px 20px; background: #FAFAFA; border: 1px solid #E0E0E0; border-radius: 2px;">
                <h4 style="margin: 0 0 12px 0; color: #37474F; font-size: 14px; font-weight: 600;">참고 2. 연약지반 판정과의 연계</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #546E7A;">
                    <li style="margin-bottom: 6px;">
                        <strong>연약지반 두께:</strong> 연약지반 판정(Step 3)에서 산출된 연약구간 두께를 기준으로 판정합니다.
                    </li>
                    <li style="margin-bottom: 6px;">
                        <strong>두께 3m 기준:</strong> 연약지반 두께가 3m 미만이면 치환 공법으로 제거가 가능하나, 
                        3m 이상이면 경제성 및 시공성 측면에서 파일기초가 유리합니다.
                    </li>
                    <li>
                        <strong>복합 조건:</strong> 전석층, 붕적층 등 시공성 저해 요인이 있는 경우 별도 검토가 필요합니다.
                    </li>
                </ul>
            </div>

        </div>
    `;
    modal.style.display = 'block';
}

// ===== Excel 내보내기 기능 =====

/**
 * 시추 데이터를 Excel 파일로 내보내기
 * @returns {boolean} 내보내기 성공 여부
 */
function exportToExcel() {
    // 데이터 유효성 검사
    if (!boreholeData || boreholeData.length === 0) {
        alert('내보낼 데이터가 없습니다. 먼저 시추 데이터를 업로드하세요.');
        return false;
    }

    // SheetJS 라이브러리 로드 확인
    if (typeof XLSX === 'undefined') {
        alert('Excel 내보내기 라이브러리(SheetJS)가 로드되지 않았습니다.\n페이지를 새로고침 후 다시 시도해주세요.');
        console.error('XLSX library not loaded');
        return false;
    }

    // 로딩 표시
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('active');

    try {
        const wb = XLSX.utils.book_new();
        let sheetCount = 0;
        const errors = [];

        // 1. 시추공 요약 시트
        try {
            const summarySheet = createBoreholeSummarySheet();
            if (summarySheet) {
                XLSX.utils.book_append_sheet(wb, summarySheet, '시추공 요약');
                sheetCount++;
            }
        } catch (e) {
            console.error('시추공 요약 시트 생성 오류:', e);
            errors.push('시추공 요약 시트 생성 실패');
        }

        // 2. 전체 지층 요약 시트
        try {
            const layerSummarySheet = createLayerSummarySheet();
            if (layerSummarySheet) {
                XLSX.utils.book_append_sheet(wb, layerSummarySheet, '전체 지층 요약');
                sheetCount++;
            }
        } catch (e) {
            console.error('지층 요약 시트 생성 오류:', e);
            errors.push('지층 요약 시트 생성 실패');
        }

        // 3. 각 시추공별 상세 시트
        boreholeData.forEach((bh, index) => {
            try {
                const detailSheet = createBoreholeDetailSheet(bh);
                if (detailSheet) {
                    // 시트 이름은 31자 제한, 특수문자 제거, 중복 방지
                    let sheetName = (bh.holeNo || `BH-${index + 1}`)
                        .replace(/[\\\/\?\*\[\]:]/g, '')
                        .substring(0, 28);

                    // 중복 시트명 처리
                    let suffix = 1;
                    let finalName = sheetName;
                    while (wb.SheetNames && wb.SheetNames.includes(finalName)) {
                        finalName = `${sheetName}_${suffix++}`;
                    }

                    XLSX.utils.book_append_sheet(wb, detailSheet, finalName);
                    sheetCount++;
                }
            } catch (e) {
                console.error(`시추공 ${bh.holeNo || index + 1} 시트 생성 오류:`, e);
                errors.push(`${bh.holeNo || `BH-${index + 1}`} 시트 생성 실패`);
            }
        });

        // 시트가 하나도 생성되지 않은 경우
        if (sheetCount === 0) {
            throw new Error('내보낼 수 있는 시트가 없습니다.');
        }

        // 파일명 생성 (프로젝트명 + 날짜)
        const projectName = boreholeData[0]?.metadata?.PROJECT_NAME || '시추조사';
        const safeProjectName = projectName.replace(/[\\\/\?\*\[\]:]/g, '').substring(0, 20);
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `${safeProjectName}_시추데이터_${dateStr}.xlsx`;

        // 다운로드
        XLSX.writeFile(wb, fileName);

        // 부분 성공 시 경고 메시지
        if (errors.length > 0) {
            console.warn('일부 시트 생성 실패:', errors);
            alert(`Excel 파일이 생성되었습니다.\n\n⚠️ 일부 시트 생성 실패:\n- ${errors.join('\n- ')}`);
        }

        return true;

    } catch (error) {
        console.error('Excel 내보내기 오류:', error);

        // 사용자 친화적 에러 메시지
        let userMessage = 'Excel 내보내기 중 오류가 발생했습니다.';
        if (error.message.includes('memory') || error.message.includes('Memory')) {
            userMessage += '\n\n원인: 데이터 크기가 너무 큽니다.\n해결: 시추공 수를 줄여서 다시 시도하세요.';
        } else if (error.message.includes('permission') || error.message.includes('access')) {
            userMessage += '\n\n원인: 파일 접근 권한 문제\n해결: 다른 위치에 저장하거나 열려있는 Excel 파일을 닫아주세요.';
        } else {
            userMessage += `\n\n상세: ${error.message}`;
        }

        alert(userMessage);
        return false;

    } finally {
        // 로딩 숨김
        if (loadingEl) loadingEl.classList.remove('active');
    }
}

// 시추공 요약 시트 생성
function createBoreholeSummarySheet() {
    const data = [];
    
    // 헤더
    data.push([
        '시추공', '지표고 (E.L m)', '지하수위 (E.L m)', '풍화암 (E.L m)', 
        '연암 (E.L m)', '시추종료 (E.L m)', '총심도 (m)', 'SPT 시료 개수',
        '평균 N값', '최대 N값', '토질 구성'
    ]);
    
    boreholeData.forEach(bh => {
        const gl = parseFloat(bh.groundElevation) || 0;
        const gwEL = bh.waterTableElevation;
        const wrEL = (bh.weatheredRockElevation && bh.weatheredRockElevation !== '-') ? parseFloat(bh.weatheredRockElevation) : null;
        const srEL = (bh.softRockPlusElevation && bh.softRockPlusElevation !== '-') ? parseFloat(bh.softRockPlusElevation) : null;
        const endEL = bh.boreholeEndElevation ? parseFloat(bh.boreholeEndElevation) : null;
        
        // N값 통계
        const nValues = bh.sptData ? bh.sptData.map(s => s.nValue).filter(n => n != null && n > 0) : [];
        const avgN = nValues.length > 0 ? Math.round(nValues.reduce((a, b) => a + b, 0) / nValues.length) : null;
        const maxN = nValues.length > 0 ? Math.max(...nValues) : null;
        
        // 토질 구성
        const soilLayers = bh.soilData ? bh.soilData.map(l => l.soil_name).filter(Boolean).join(', ') : '';
        
        data.push([
            bh.holeNo,
            formatExcelEL(gl),
            formatExcelEL(gwEL),
            formatExcelEL(wrEL),
            formatExcelEL(srEL),
            formatExcelEL(endEL),
            bh.drillingDepth || calculateTotalDepth(bh),
            bh.sptData ? bh.sptData.length : 0,
            avgN,
            maxN,
            soilLayers
        ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 열 너비 설정
    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 40 }
    ];
    
    return ws;
}

// 전체 지층 요약 시트 생성
function createLayerSummarySheet() {
    const data = [];
    
    // 헤더
    data.push([
        '시추공', '심도 (GL-)', '표고 범위 (E.L m)', '지층명', 'USCS', 
        '층후 (m)', '핵심 특성', 'TCR (%)', 'RQD (%)'
    ]);
    
    boreholeData.forEach(bh => {
        const gl = parseFloat(bh.groundElevation) || 0;
        
        if (bh.soilData && bh.soilData.length > 0) {
            bh.soilData.forEach(layer => {
                const depthRange = parseDepthRangeForExcel(layer.depth_range);
                const startEL = gl - depthRange.start;
                const endEL = gl - depthRange.end;
                const thickness = depthRange.end - depthRange.start;
                
                // USCS 추출
                const uscsMatch = layer.soil_name?.match(/\b([A-Z]{2}(?:-[A-Z]{2})?)\b/);
                const uscs = uscsMatch ? uscsMatch[1] : '-';
                
                // 핵심 특성 추출
                const keywords = extractKeywordsFromObservation(layer.observation);
                
                // TCR/RQD 추출
                const { tcr, rqd } = extractTcrRqdFromObservation(layer.observation);
                
                data.push([
                    bh.holeNo,
                    layer.depth_range || '-',
                    `EL.${startEL.toFixed(2)} ~ EL.${endEL.toFixed(2)}`,
                    layer.soil_name?.replace(/\s+[A-Z]{2}(-[A-Z]{2})?$/, '').trim() || '-',
                    uscs,
                    thickness.toFixed(1),
                    keywords,
                    tcr,
                    rqd
                ]);
            });
        }
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 열 너비 설정
    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 8 },
        { wch: 10 }, { wch: 35 }, { wch: 10 }, { wch: 10 }
    ];
    
    return ws;
}

// 개별 시추공 상세 시트 생성
function createBoreholeDetailSheet(bh) {
    const data = [];
    const gl = parseFloat(bh.groundElevation) || 0;
    
    // ===== 시추공 상세 정보 헤더 =====
    data.push([`${bh.holeNo} 시추공 상세 정보`]);
    data.push([]);
    
    // 기본 정보
    const gwEL = bh.waterTableElevation;
    const wrEL = (bh.weatheredRockElevation && bh.weatheredRockElevation !== '-') ? parseFloat(bh.weatheredRockElevation) : null;
    const srEL = (bh.softRockPlusElevation && bh.softRockPlusElevation !== '-') ? parseFloat(bh.softRockPlusElevation) : null;
    const endEL = bh.boreholeEndElevation ? parseFloat(bh.boreholeEndElevation) : null;
    const totalDepth = bh.drillingDepth || calculateTotalDepth(bh);
    const sptCount = bh.sptData ? bh.sptData.length : 0;
    
    data.push(['지표고', '지하수위', '풍화암', '연암', '시추종료', '총심도', 'SPT 시료']);
    data.push([
        formatExcelEL(gl),
        formatExcelEL(gwEL),
        formatExcelEL(wrEL),
        formatExcelEL(srEL),
        formatExcelEL(endEL),
        `${totalDepth}m`,
        `${sptCount}개`
    ]);
    data.push([]);
    
    // ===== 지층별 요약 =====
    data.push(['▶ 지층별 요약']);
    data.push(['심도 (GL-)', '표고 범위', '지층명', 'USCS', '층후 (m)', '핵심 특성', 'TCR (%)', 'RQD (%)']);
    
    if (bh.soilData && bh.soilData.length > 0) {
        bh.soilData.forEach(layer => {
            const depthRange = parseDepthRangeForExcel(layer.depth_range);
            const startEL = gl - depthRange.start;
            const endEL = gl - depthRange.end;
            const thickness = depthRange.end - depthRange.start;
            
            const uscsMatch = layer.soil_name?.match(/\b([A-Z]{2}(?:-[A-Z]{2})?)\b/);
            const uscs = uscsMatch ? uscsMatch[1] : '-';
            const keywords = extractKeywordsFromObservation(layer.observation);
            const { tcr, rqd } = extractTcrRqdFromObservation(layer.observation);
            
            data.push([
                layer.depth_range || '-',
                `EL.${startEL.toFixed(2)} ~ EL.${endEL.toFixed(2)}`,
                layer.soil_name?.replace(/\s+[A-Z]{2}(-[A-Z]{2})?$/, '').trim() || '-',
                uscs,
                thickness.toFixed(1),
                keywords,
                tcr,
                rqd
            ]);
        });
    }
    data.push([]);
    
    // ===== SPT 샘플 상세 =====
    data.push(['▶ SPT 샘플 상세']);
    data.push(['시료번호', '심도 (GL-m)', '표고 (EL.m)', '관입깊이 (cm)', '해당 지층', '상대밀도', 'N값 평가', 'TCR (%)', 'RQD (%)', 'RQD 등급']);
    
    if (bh.sptData && bh.sptData.length > 0) {
        bh.sptData.forEach((spt, idx) => {
            const depth = spt.depth || (idx + 1);
            const elevation = gl - depth;
            
            // 해당 지층 찾기
            const layerInfo = findLayerAtDepth(bh.soilData, depth);
            const layerName = layerInfo?.soil_name?.replace(/\s+[A-Z]{2}(-[A-Z]{2})?$/, '').trim() || '-';
            
            // N값 분석
            const nValue = spt.nValue || 0;
            const density = getNValueDensity(nValue);
            const nEval = getNValueEvaluation(nValue);
            
            // TCR/RQD (해당 지층에서 추출)
            const { tcr, rqd } = layerInfo ? extractTcrRqdFromObservation(layerInfo.observation) : { tcr: '-', rqd: '-' };
            const rqdGrade = getRqdGrade(rqd);
            
            data.push([
                spt.sampleNo || `S-${idx + 1}`,
                depth.toFixed(1),
                elevation.toFixed(2),
                spt.penetration || 30,
                layerName,
                density,
                nEval,
                tcr,
                rqd,
                rqdGrade
            ]);
        });
    }
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 열 너비 설정
    ws['!cols'] = [
        { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
    ];
    
    // 병합 셀 (헤더)
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    
    return ws;
}

// ===== Excel 내보내기 유틸리티 함수들 =====

function formatExcelEL(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `EL.${value >= 0 ? '+' : ''}${parseFloat(value).toFixed(2)}`;
}

function parseDepthRangeForExcel(depthStr) {
    if (!depthStr) return { start: 0, end: 0 };
    const match = depthStr.match(/([\d.]+)\s*~\s*([\d.]+)/);
    if (match) return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
    return { start: 0, end: 0 };
}

function calculateTotalDepth(bh) {
    if (!bh.soilData || bh.soilData.length === 0) return 0;
    let maxDepth = 0;
    bh.soilData.forEach(layer => {
        const range = parseDepthRangeForExcel(layer.depth_range);
        maxDepth = Math.max(maxDepth, range.end);
    });
    return maxDepth;
}

function extractKeywordsFromObservation(observation) {
    if (!observation) return '-';
    const text = observation.replace(/\n/g, ' ').replace(/-/g, ' ');
    const keywords = [];
    
    // 토질 유형
    const soilTypes = ['실트질 모래', '모래질 자갈', '자갈질 모래', '실트질 점토'];
    soilTypes.forEach(t => { if (text.includes(t)) keywords.push(t); });
    
    // 상대밀도
    const densities = ['매우느슨', '느슨', '보통조밀', '조밀', '매우조밀'];
    densities.forEach(d => { if (text.includes(d)) keywords.push(d); });
    
    // 함수율
    if (text.includes('습윤')) keywords.push('습윤');
    if (text.includes('포화')) keywords.push('포화');
    
    // 풍화도
    const weathering = ['완전풍화', '심한풍화', '보통풍화'];
    weathering.forEach(w => { if (text.includes(w)) keywords.push(w); });
    
    // 특이사항
    if (text.toLowerCase().includes('파쇄대')) keywords.push('파쇄대 발달');
    if (text.toLowerCase().includes('절리')) keywords.push('절리 발달');
    if (text.toLowerCase().includes('암편')) keywords.push('암편으로 분해');
    
    return keywords.length > 0 ? keywords.join(', ') : '-';
}

function extractTcrRqdFromObservation(observation) {
    if (!observation) return { tcr: '-', rqd: '-' };
    
    const tcrMatches = observation.match(/TCR\s*[:：]\s*([\d.]+)\s*%/gi);
    const rqdMatches = observation.match(/RQD\s*[:：]\s*([\d.]+)\s*%/gi);
    
    let tcr = '-';
    let rqd = '-';
    
    if (tcrMatches) {
        const values = tcrMatches.map(m => parseFloat(m.match(/[\d.]+/)[0]));
        tcr = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    
    if (rqdMatches) {
        const values = rqdMatches.map(m => parseFloat(m.match(/[\d.]+/)[0]));
        rqd = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    
    return { tcr, rqd };
}

function findLayerAtDepth(soilData, depth) {
    if (!soilData) return null;
    return soilData.find(layer => {
        const range = parseDepthRangeForExcel(layer.depth_range);
        return depth >= range.start && depth <= range.end;
    });
}

function getNValueDensity(nValue) {
    if (nValue === null || nValue === undefined) return '-';
    if (nValue < 4) return '매우느슨';
    if (nValue < 10) return '느슨';
    if (nValue < 30) return '보통조밀';
    if (nValue < 50) return '조밀';
    return '매우조밀';
}

function getNValueEvaluation(nValue) {
    if (nValue === null || nValue === undefined) return '-';
    if (nValue < 4) return '매우느슨';
    if (nValue < 10) return '느슨';
    if (nValue < 30) return '보통';
    if (nValue < 50) return '조밀';
    return '매우조밀';
}

function getRqdGrade(rqd) {
    if (rqd === '-' || rqd === null || rqd === undefined) return '-';
    const val = typeof rqd === 'string' ? parseFloat(rqd) : rqd;
    if (isNaN(val)) return '-';
    if (val < 25) return 'Very Poor';
    if (val < 50) return 'Poor';
    if (val < 75) return 'Fair';
    if (val < 90) return 'Good';
    return 'Excellent';
}

// ===== 시추공 삭제 기능 =====

/**
 * 시추공을 삭제합니다.
 * 확인 다이얼로그를 표시하고 사용자 승인 후 삭제를 진행합니다.
 *
 * @param {string} holeNo - 삭제할 시추공 번호
 * @returns {void}
 */
function deleteBorehole(holeNo) {
    // 삭제 확인
    const confirmed = confirm(`"${holeNo}" 시추공을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    // 삭제할 시추공 인덱스 찾기
    const index = boreholeData.findIndex(bh => bh.holeNo === holeNo || bh.hole_no === holeNo);
    if (index === -1) {
        alert('시추공을 찾을 수 없습니다.');
        return;
    }

    // 배열에서 제거
    boreholeData.splice(index, 1);

    console.log(`[삭제] ${holeNo} 시추공이 삭제되었습니다. 남은 시추공: ${boreholeData.length}개`);

    // 모든 관련 화면 업데이트
    refreshAllViewsAfterDeletion(holeNo);

    // 사용자 피드백
    showDeleteNotification(holeNo);
}

/**
 * 시추공 삭제 후 모든 관련 화면을 업데이트합니다.
 *
 * @param {string} deletedHoleNo - 삭제된 시추공 번호
 * @returns {void}
 */
function refreshAllViewsAfterDeletion(deletedHoleNo) {
    // 1. 대시보드 테이블 업데이트
    updateDashboardTable();

    // 2. 데이터 테이블 업데이트 (만약 표시 중이라면)
    if (typeof updateDataTable === 'function') {
        updateDataTable();
    }

    // 3. 시추공 수 카운트 업데이트
    const countEl = document.getElementById('boreholeCount');
    if (countEl) {
        countEl.textContent = `(${boreholeData.length}공)`;
    }

    // 4. 지도/도면 마커 업데이트
    if (typeof updateBoreholeMarkers === 'function') {
        updateBoreholeMarkers();
    }

    // 5. 2D 시각화 업데이트
    if (typeof create2DVisualization === 'function' && document.getElementById('plot2D')) {
        try {
            create2DVisualization();
        } catch (e) {
            console.warn('2D 시각화 업데이트 실패:', e);
        }
    }

    // 6. 3D 시각화 업데이트
    if (typeof create3DVisualization === 'function' && document.getElementById('plot3D')) {
        try {
            create3DVisualization();
        } catch (e) {
            console.warn('3D 시각화 업데이트 실패:', e);
        }
    }

    // 7. 등고선 오버레이 업데이트 (표시 중인 경우)
    if (typeof updateOverlayCanvas === 'function') {
        try {
            updateOverlayCanvas();
        } catch (e) {
            console.warn('등고선 오버레이 업데이트 실패:', e);
        }
    }

    // 8. 도면 위 시추공 마커 업데이트
    if (typeof renderDrawingBoreholes === 'function') {
        try {
            renderDrawingBoreholes();
        } catch (e) {
            console.warn('도면 시추공 마커 업데이트 실패:', e);
        }
    }

    // 9. 상세 분석 모듈 - 삭제된 시추공 결과 제거 및 UI 업데이트

    // 9-1. 깊이 검증 결과에서 삭제된 시추공 제거
    if (window.verificationResults && Array.isArray(window.verificationResults)) {
        window.verificationResults = window.verificationResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
        console.log(`[삭제] 깊이 검증 결과 업데이트: ${window.verificationResults.length}개`);

        // 깊이 검증 결과 UI 업데이트
        if (typeof displayVerificationResults === 'function') {
            try {
                displayVerificationResults();
            } catch (e) {
                console.warn('깊이 검증 결과 UI 업데이트 실패:', e);
            }
        }
    }

    // 9-2. 연약지반 분석 결과에서 삭제된 시추공 제거 (두 변수 모두 동기화)
    if (window.weakSoilResults && Array.isArray(window.weakSoilResults)) {
        window.weakSoilResults = window.weakSoilResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
    }
    if (window.weakSoilAnalysisResults && Array.isArray(window.weakSoilAnalysisResults)) {
        window.weakSoilAnalysisResults = window.weakSoilAnalysisResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
    }
    // 두 변수 동기화
    if (window.weakSoilResults) {
        window.weakSoilAnalysisResults = window.weakSoilResults;
    } else if (window.weakSoilAnalysisResults) {
        window.weakSoilResults = window.weakSoilAnalysisResults;
    }
    console.log(`[삭제] 연약지반 분석 결과 업데이트: ${(window.weakSoilResults || []).length}개`);

    // 연약지반 결과 UI 업데이트
    if (typeof displayWeakSoilResults === 'function') {
        try {
            displayWeakSoilResults();
        } catch (e) {
            console.warn('연약지반 결과 UI 업데이트 실패:', e);
        }
    }

    // 9-3. 전석/호박돌 탐지 결과에서 삭제된 시추공 제거 (두 변수 모두 동기화)
    if (window.boulderDetectionResults && Array.isArray(window.boulderDetectionResults)) {
        window.boulderDetectionResults = window.boulderDetectionResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
    }
    if (window.boulderResults && Array.isArray(window.boulderResults)) {
        window.boulderResults = window.boulderResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
    }
    // 두 변수 동기화
    if (window.boulderDetectionResults) {
        window.boulderResults = window.boulderDetectionResults;
    } else if (window.boulderResults) {
        window.boulderDetectionResults = window.boulderResults;
    }
    console.log(`[삭제] 전석/호박돌 탐지 결과 업데이트: ${(window.boulderDetectionResults || []).length}개`);

    // 전석/호박돌 결과 UI 업데이트
    if (typeof displayBoulderResults === 'function') {
        try {
            displayBoulderResults(window.boulderDetectionResults || []);
        } catch (e) {
            console.warn('전석/호박돌 결과 UI 업데이트 실패:', e);
        }
    }

    // 9-4. 기초 판정 결과에서 삭제된 시추공 제거
    if (window.simpleFoundationResults && Array.isArray(window.simpleFoundationResults)) {
        window.simpleFoundationResults = window.simpleFoundationResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
        console.log(`[삭제] 기초 판정 결과 업데이트: ${window.simpleFoundationResults.length}개`);

        // 기초 판정 결과 UI 업데이트
        if (typeof displaySimpleFoundationResults === 'function') {
            try {
                displaySimpleFoundationResults();
            } catch (e) {
                console.warn('기초 판정 결과 UI 업데이트 실패:', e);
            }
        }
    }

    // 9-5. 종합 분석 결과에서 삭제된 시추공 제거
    if (window.analysisResults && Array.isArray(window.analysisResults)) {
        window.analysisResults = window.analysisResults.filter(
            r => r.holeNo !== deletedHoleNo && r.hole_no !== deletedHoleNo
        );
        console.log(`[삭제] 종합 분석 결과 업데이트: ${window.analysisResults.length}개`);
    }

    // 10. 종합 검토 모듈 업데이트
    if (typeof updateOverviewDashboard === 'function') {
        try {
            updateOverviewDashboard();
        } catch (e) {
            console.warn('종합 검토 대시보드 업데이트 실패:', e);
        }
    }

    // 10-1. 종합 검토 결과 테이블 업데이트
    if (typeof displayCombinedResults === 'function') {
        try {
            displayCombinedResults();
        } catch (e) {
            console.warn('종합 검토 결과 업데이트 실패:', e);
        }
    }

    // 10-2. 종합 검토 카드 카운트 업데이트
    updateOverviewCounts();

    // 10-3. 결과 요약 카드 업데이트 (module_5.html의 updateResultSummaryCards)
    if (typeof updateResultSummaryCards === 'function') {
        try {
            updateResultSummaryCards();
        } catch (e) {
            console.warn('결과 요약 카드 업데이트 실패:', e);
        }
    }

    // 11. 선택된 시추공 목록에서 제거 (단면도용)
    if (window.selectedBoreholes) {
        const selectedIndex = window.selectedBoreholes.indexOf(deletedHoleNo);
        if (selectedIndex > -1) {
            window.selectedBoreholes.splice(selectedIndex, 1);
        }
    }

    // 12. StateManager 상태 동기화 (존재하는 경우)
    if (window.StateManager && typeof window.StateManager.syncFromGlobals === 'function') {
        try {
            window.StateManager.syncFromGlobals();
        } catch (e) {
            console.warn('StateManager 동기화 실패:', e);
        }
    }
}

/**
 * 종합 검토 카드의 카운트를 업데이트합니다.
 * 모든 분석 결과 카운트를 갱신하여 대시보드 카드에 반영합니다.
 * @returns {void}
 */
function updateOverviewCounts() {
    // 1. 총 시추공 카운트
    const totalBoreholes = boreholeData ? boreholeData.length : 0;

    // statTotalCount (대시보드 헤더)
    const statTotalCountEl = document.getElementById('statTotalCount');
    if (statTotalCountEl) {
        statTotalCountEl.textContent = `${totalBoreholes}공`;
    }

    // totalBoreholes (결과 요약 카드)
    const totalBoreholesEl = document.getElementById('totalBoreholes');
    if (totalBoreholesEl) {
        totalBoreholesEl.textContent = totalBoreholes || '-';
    }

    // 2. 깊이 적합 카운트 (verificationResults 기반)
    const depthSuitableCountEl = document.getElementById('depthSuitableCount');
    if (depthSuitableCountEl) {
        const verResults = window.verificationResults || [];
        // shallow.pass 또는 다른 형태의 pass 속성 확인
        const depthPassCount = verResults.filter(r =>
            (r.shallow && r.shallow.pass) ||
            r.depthPass ||
            r.isDepthSufficient ||
            r.overallOK
        ).length;
        depthSuitableCountEl.textContent = depthPassCount;
    }

    // 3. 연약지반 카운트
    const softGroundCountEl = document.getElementById('softGroundCount');
    if (softGroundCountEl) {
        const weakResults = window.weakSoilResults || window.weakSoilAnalysisResults || [];
        const weakCount = weakResults.filter(r =>
            r.isWeakSoil || r.totalWeakZones > 0 || (r.weakSoilLayers && r.weakSoilLayers.length > 0)
        ).length;
        softGroundCountEl.textContent = weakCount;
    }

    // 4. 전석/호박돌 카운트
    const boulderCountEl = document.getElementById('boulderCount');
    if (boulderCountEl) {
        const boulderResults = window.boulderDetectionResults || window.boulderResults || [];
        const boulderCount = boulderResults.filter(r =>
            r.totalBoulderCount > 0 || r.totalColluvialCount > 0 || r.hasBoulder
        ).length;
        boulderCountEl.textContent = boulderCount;
    }

    // 5. 기초 판정 관련 카운트 (직접기초, 치환, 파일)
    const foundationResults = window.simpleFoundationResults || [];

    // 직접기초 카운트
    const directCount = foundationResults.filter(r =>
        r.judgment === '직접 기초' || r.recommendation === '직접기초' || r.foundationType === 'direct'
    ).length;

    // 치환/파일 검토 카운트
    const replaceCount = foundationResults.filter(r =>
        r.judgment === '치환 후 직접 기초 또는 파일 기초' ||
        r.recommendation === '치환' ||
        r.foundationType === 'replacement'
    ).length;

    // 파일기초 필요 카운트
    const pileCount = foundationResults.filter(r =>
        r.judgment === '파일 기초 필요' ||
        r.recommendation === '파일기초' ||
        r.foundationType === 'pile'
    ).length;

    const directCountEl = document.getElementById('directFoundationCount');
    const replaceCountEl = document.getElementById('replacementCount');
    const pileCountEl = document.getElementById('pileRequiredCount');

    if (directCountEl) directCountEl.textContent = directCount;
    if (replaceCountEl) replaceCountEl.textContent = replaceCount;
    if (pileCountEl) pileCountEl.textContent = pileCount;

    console.log(`[카운트 업데이트] 총:${totalBoreholes}, 깊이적합:${depthSuitableCountEl?.textContent}, 연약:${softGroundCountEl?.textContent}, 전석:${boulderCountEl?.textContent}, 직접:${directCount}, 치환:${replaceCount}, 파일:${pileCount}`);
}

/**
 * 삭제 완료 알림을 표시합니다.
 *
 * @param {string} holeNo - 삭제된 시추공 번호
 * @returns {void}
 */
function showDeleteNotification(holeNo) {
    // 알림 요소 생성
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1F2937;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `<span style="color: #F87171;">✕</span> "${holeNo}" 시추공이 삭제되었습니다.`;

    // 애니메이션 스타일 추가
    if (!document.getElementById('deleteNotificationStyle')) {
        const style = document.createElement('style');
        style.id = 'deleteNotificationStyle';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // 3초 후 자동 제거
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 전역 노출
window.deleteBorehole = deleteBorehole;
window.displayWeakSoilResults = displayWeakSoilResults;
window.displaySimpleFoundationResults = displaySimpleFoundationResults;
window.updateOverviewCounts = updateOverviewCounts;
window.updateDashboardTable = updateDashboardTable;