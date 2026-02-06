/**
 * IDW (Inverse Distance Weighting) 보간 Web Worker
 * 메인 스레드에서 분리하여 UI 블로킹 방지 + 최대 성능 달성
 *
 * 최적화 기법:
 * 1. Float64Array (Typed Array) 사용 → 메모리 접근 패턴 최적화
 * 2. 가중치 사전 계산 → 6개 레이어에서 공유
 * 3. 인라인 거리 계산 → 함수 호출 오버헤드 제거
 * 4. 루프 언롤링 및 직접 인덱싱
 */

self.onmessage = function(e) {
    const { coords, gridX, gridY, layerValues, taskId } = e.data;

    const resolution = gridX.length;
    const numPoints = coords.length;
    const layerNames = Object.keys(layerValues);
    const numLayers = layerNames.length;

    // Typed Array로 좌표 변환 (캐시 친화적 메모리 레이아웃)
    const coordsX = new Float64Array(numPoints);
    const coordsY = new Float64Array(numPoints);
    for (let k = 0; k < numPoints; k++) {
        coordsX[k] = coords[k].x;
        coordsY[k] = coords[k].y;
    }

    // 레이어 값들도 Typed Array로 변환
    const layerArrays = {};
    for (const name of layerNames) {
        layerArrays[name] = new Float64Array(layerValues[name]);
    }

    // 가중치 사전 계산 (resolution × resolution × numPoints) - Flat Typed Array
    const totalCells = resolution * resolution;
    const weights = new Float64Array(totalCells * numPoints);
    const weightSums = new Float64Array(totalCells);

    for (let i = 0; i < resolution; i++) {
        const gy = gridY[i];
        const rowOffset = i * resolution;

        for (let j = 0; j < resolution; j++) {
            const gx = gridX[j];
            const cellIdx = (rowOffset + j) * numPoints;
            let sumW = 0;

            for (let k = 0; k < numPoints; k++) {
                const dx = coordsX[k] - gx;
                const dy = coordsY[k] - gy;
                const distSq = dx * dx + dy * dy;

                // power=2일 때 distSq 그대로 사용 (sqrt 불필요)
                const w = distSq < 1e-6 ? 1e10 : 1 / distSq;
                weights[cellIdx + k] = w;
                sumW += w;
            }
            weightSums[rowOffset + j] = sumW;
        }
    }

    // 각 레이어에 대해 보간 수행 (가중치 재사용)
    const results = {};
    for (const name of layerNames) {
        const values = layerArrays[name];
        const zGrid = new Array(resolution);

        for (let i = 0; i < resolution; i++) {
            const row = new Float64Array(resolution);
            const rowOffset = i * resolution;

            for (let j = 0; j < resolution; j++) {
                const cellIdx = (rowOffset + j) * numPoints;
                const sumW = weightSums[rowOffset + j];
                let sumV = 0;

                for (let k = 0; k < numPoints; k++) {
                    sumV += values[k] * weights[cellIdx + k];
                }

                row[j] = sumW > 0 ? sumV / sumW : 0;
            }
            // Plotly는 일반 배열 필요 → 변환
            zGrid[i] = Array.from(row);
        }
        results[name] = zGrid;
    }

    self.postMessage({ results, taskId });
};
