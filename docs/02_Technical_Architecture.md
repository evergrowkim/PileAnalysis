# GeoAI 시스템 기술 아키텍처
## Technical Architecture Document

---

## 1. 시스템 개요

### 1.1 기술 스택

| 계층 | 기술 | 설명 |
|------|------|------|
| Frontend | HTML5/CSS3/JavaScript | 순수 웹 기술, 프레임워크 의존성 제로 |
| 시각화 | Plotly.js | 3D 지질모델 렌더링 |
| 그래픽 | HTML5 Canvas/SVG | 시추주상도 및 계산서 렌더링 |
| 데이터 | JSON | 시추데이터 입출력 표준 포맷 |
| 스타일 | CSS Variables | 테마 일관성 및 유지보수성 |

### 1.2 Zero-Dependency 아키텍처 장점

```
✅ 서버 불필요 - 로컬 브라우저에서 완전 실행
✅ 설치 불필요 - HTML 파일 열기만으로 즉시 사용
✅ 보안 - 외부 데이터 전송 없음 (온프레미스)
✅ 속도 - 네트워크 지연 없는 즉시 계산
✅ 유지보수 - 단일 파일 배포 및 업데이트
```

---

## 2. 핵심 모듈 구조

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    GeoAI Core System                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Data Layer     │  │  Computation    │                  │
│  │                 │  │  Engine         │                  │
│  │  • JSON Parser  │  │                 │                  │
│  │  • Normalizer   │→│  • Vertical     │                  │
│  │  • Validator    │  │  • Horizontal   │                  │
│  │                 │  │  • Uplift       │                  │
│  └────────┬────────┘  │  • Settlement   │                  │
│           │           └────────┬────────┘                  │
│           │                    │                           │
│  ┌────────▼────────────────────▼────────┐                  │
│  │        Visualization Layer            │                  │
│  │                                       │                  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │                  │
│  │  │Dashboard│ │Borehole │ │   3D    │ │                  │
│  │  │ Table   │ │ Canvas  │ │ Plotly  │ │                  │
│  │  └─────────┘ └─────────┘ └─────────┘ │                  │
│  └───────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Layer (데이터 계층)

#### JSON 파서 및 정규화
```javascript
// 시추 데이터 구조
{
  "hole_no": "BH-1",
  "metadata": {
    "ORIGINAL_GROUND_ELEVATION": "EL.52.30m",
    "GROUND_WATER_LEVEL": "GL-3.50m",
    "PROJECT_NAME": "포스코 OO 프로젝트"
  },
  "soil_data": [
    {
      "soil_name": "매립층",
      "depth_range": "0.00~2.50m",
      "samples": [
        { "Depth": 1.0, "Hits": "5/7/8" }
      ]
    }
  ]
}
```

#### 좌표 정규화 시스템
- **TM 좌표계** 자동 인식 및 변환
- **상대좌표** 계산 (최소 X, Y 기준)
- **유효성 검증** (범위, 중복, 누락)

### 2.3 Computation Engine (계산 엔진)

#### 설계기준 상수 정의
```javascript
const DESIGN_STANDARDS = {
    'kds-struct': {
        name: '구조물기초설계기준해설',
        shortName: '구조물기초',
        sandFriction: { coeff: 2.5, maxFs: 125 },  // kPa
        clayFriction: { alpha: 0.8, maxFs: 100 },
        endBearing: {
            driven: { coeff: 300, maxQp: 15000 },
            bored: { coeff: 200, maxQp: 12000 }
        }
    },
    'kds-road': {
        name: '도로교설계기준',
        shortName: '도로교',
        sandFriction: { coeff: 5.0, maxFs: 200 },
        // ...
    }
};
```

#### 말뚝 물성 데이터베이스
```javascript
// PHC 말뚝 규격 (KS F 4306 기준)
const PHC_PILES = {
    'A_400': {
        diameter: 0.4,     // m
        thickness: 0.065,  // m
        area: 0.0684,      // m² (콘크리트 순단면적)
        I: 5.54e-4,        // m⁴ (단면2차모멘트)
        allowable: 1225    // kN (허용압축력)
    },
    // ... 전체 규격
};

// 강관말뚝 규격 (API 5L 기준)
const STEEL_PIPE_SPECS = {
    materials: {
        'STK400': { yieldStrength: 235 },  // MPa
        'STK490': { yieldStrength: 315 }
    }
};
```

### 2.4 계산 알고리즘 상세

#### 1. 선단 N값 산정 (가중평균법)
```javascript
// 선단 N값 = (N1 + N2) / 2
// N1: 선단~4D 상부 평균 N값
// N2: 선단~4D 하부 평균 N값
function calculateTipNValue(borehole, pileTipDepth, D) {
    const range4D = 4 * D;  // 말뚝 직경의 4배
    const N1 = getAverageN(borehole, pileTipDepth - range4D, pileTipDepth);
    const N2 = getAverageN(borehole, pileTipDepth, pileTipDepth + range4D);
    return (N1 + N2) / 2;
}
```

#### 2. 주면마찰력 계산
```javascript
// 층별 주면마찰력 = fs × (π × D) × 층두께
function calculateSkinFriction(layer, N, D, designStandard) {
    const isSand = !isCohesive(layer.soil_name);

    if (isSand) {
        // 사질토: fs = β × N (상한값 적용)
        const beta = designStandard.sandFriction.coeff;
        const fs = Math.min(beta * N, designStandard.sandFriction.maxFs);
        return fs * Math.PI * D * layer.thickness;
    } else {
        // 점성토: fs = α × cu (cu = 6.25 × N)
        const cu = 6.25 * N;  // 비배수전단강도
        const alpha = designStandard.clayFriction.alpha;
        const fs = Math.min(alpha * cu, designStandard.clayFriction.maxFs);
        return fs * Math.PI * D * layer.thickness;
    }
}
```

#### 3. 선단지지력 계산
```javascript
// 선단지지력 = qp × Ap
function calculateEndBearing(tipN, D, constructionMethod, designStandard) {
    const method = designStandard.endBearing[constructionMethod];
    const Ap = Math.PI * D * D / 4;  // 말뚝 선단면적

    // qp = α × N (상한값 적용)
    const qp_raw = method.coeff * tipN;
    const qp = Math.min(qp_raw, method.maxQp);

    return qp * Ap;  // kN
}
```

#### 4. 침하량 계산 (Vesic 3성분 합산법)
```javascript
// St = Ss + Sp + Sps
function calculateSettlement(Q, pileLength, D, Ep, Qp, Qs, Cp) {
    const tipRatio = Qp / (Qp + Qs);
    const Qps = Q * tipRatio;      // 선단 전달 하중
    const Qfs = Q * (1 - tipRatio); // 주면 전달 하중

    // Ss: 말뚝 자체 탄성압축
    const Ss = (Qps + 0.5 * Qfs) * pileLength / (Ap * Ep) * 1000;

    // Sp: 선단하중에 의한 침하
    const qp = Qp / (Math.PI * D * D / 4);
    const Sp = (Qps * Cp) / (D * qp) * 1000;

    // Sps: 주면마찰력에 의한 침하
    const Cs = (0.93 + 0.16 * Math.sqrt(pileLength / D)) * Cp;
    const Sps = (Qfs * Cs) / (pileLength * qp) * 1000;

    return { Ss, Sp, Sps, St: Ss + Sp + Sps };
}
```

#### 5. 수평지지력 계산

##### Chang's Method
```javascript
function calculateChangMethod(kh, D, E, I, L) {
    // 특성값 β
    const beta = Math.pow((kh * D) / (4 * E * I), 0.25);
    const betaL = beta * L;
    const isLongPile = betaL > 2.5;

    // 허용 수평지지력
    const Y = 0.015;  // 허용변위 15mm
    const Ha = (2 * Math.sqrt(E * I * kh * D) * Y) / FSh;

    return { beta, betaL, isLongPile, Ha };
}
```

##### Broms' Method
```javascript
function calculateBromsMethod(pile, D, L) {
    // 소성단면계수
    const Zp = (4/3) * (Math.pow(D/2, 3) - Math.pow((D-2*t)/2, 3));

    // 항복모멘트
    const My = Zp * sigma_y;

    // 극한수평저항력 (사질토, 장말뚝)
    const Hu = (9 * My) / (gamma * D**3 * Kp);

    return { My, Hu, Ha: Hu / FSh };
}
```

---

## 3. 시각화 시스템

### 3.1 3D 지질모델 (Plotly.js)

#### IDW 보간법 (최적화 버전)
```javascript
// 배치 보간법: 가중치 한 번 계산, 모든 레이어 공유
function interpolateGridBatch(coords, gridX, gridY, layerValues) {
    const resolution = gridX.length;

    // 1. 가중치 사전 계산 (모든 레이어에서 공유)
    const weights = [];
    for (let i = 0; i < resolution; i++) {
        const rowWeights = [];
        for (let j = 0; j < resolution; j++) {
            const cellWeights = [];
            let sumW = 0;
            for (let k = 0; k < coords.length; k++) {
                const dx = coords[k].x - gridX[j];
                const dy = coords[k].y - gridY[i];
                const distSq = dx * dx + dy * dy;
                // sqrt 생략: 1/d² 대신 1/(dx²+dy²) 사용
                const w = distSq < 0.000001 ? 1e10 : 1 / distSq;
                cellWeights.push(w);
                sumW += w;
            }
            rowWeights.push({ weights: cellWeights, sum: sumW });
        }
        weights.push(rowWeights);
    }

    // 2. 각 레이어에 가중치 적용
    const results = {};
    Object.keys(layerValues).forEach(layerName => {
        const grid = [];
        for (let i = 0; i < resolution; i++) {
            const row = [];
            for (let j = 0; j < resolution; j++) {
                const { weights: w, sum: sumW } = weights[i][j];
                let sumVal = 0;
                for (let k = 0; k < coords.length; k++) {
                    sumVal += layerValues[layerName][k] * w[k];
                }
                row.push(sumVal / sumW);
            }
            grid.push(row);
        }
        results[layerName] = grid;
    });

    return results;
}
```

#### 성능 최적화 전략
| 최적화 항목 | 방법 | 효과 |
|------------|------|------|
| 그리드 해상도 | 40×40 → 20×20 | **4배 빠름** |
| 가중치 계산 | 배치 공유 | **6배 빠름** |
| sqrt 제거 | d² 직접 사용 | **20% 빠름** |
| 렌더링 | Plotly.react | **즉시 업데이트** |
| 캐싱 | plotly3DCache | **재계산 방지** |

### 3.2 시추주상도 (SVG)

#### 벡터 그래픽 장점
```
✅ 확대해도 선명 (무한 해상도)
✅ 텍스트 선택/복사 가능
✅ 인쇄 품질 최적화
✅ 파일 크기 최소화
✅ CSS 스타일링 가능
```

#### 레이아웃 구조
```javascript
const layout = {
    margin: { left: 120, top: 100, right: 50, bottom: 80 },
    columns: {
        depth: { width: 100 },      // 깊이/EL 표시
        borehole: { width: 180 },   // 시추주상도
        nValue: { width: 180 },     // N값 그래프
        capacity: { width: 200 }    // 누적 지지력
    }
};
```

---

## 4. 데이터 플로우

```
┌──────────────┐
│  JSON 파일   │
│  (시추데이터) │
└──────┬───────┘
       │ 업로드
       ▼
┌──────────────┐
│  파싱/검증   │ ← 좌표 정규화, 데이터 검증
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  입력 검토   │ ← 설계기준, 말뚝규격, 계수 설정
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  계산 엔진   │ ← 시추공별 지지력/침하/수평력 계산
└──────┬───────┘
       │
       ├──────────────────┬─────────────────┐
       ▼                  ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  대시보드    │  │ 3D 시각화   │  │  상세 계산서 │
│  (테이블)    │  │  (Plotly)   │  │   (Canvas)  │
└──────────────┘  └──────────────┘  └──────────────┘
       │                  │                 │
       └──────────────────┴─────────────────┘
                          │
                          ▼
                 ┌──────────────┐
                 │ Excel 출력  │
                 │ 이미지 저장 │
                 └──────────────┘
```

---

## 5. 파일 구조

```
Pile analysis_Jan10/
├── index.html              # 메인 HTML (UI 구조)
├── scripts/
│   └── app.js              # 핵심 로직 (8,000+ 라인)
│       ├── 설계기준 상수    # 라인 1-200
│       ├── 말뚝 데이터베이스 # 라인 200-500
│       ├── 계산 엔진        # 라인 2500-3500
│       ├── 시각화 함수      # 라인 5000-7500
│       └── 유틸리티         # 라인 7500-8000
├── styles/
│   └── (inline CSS)        # index.html 내장
└── docs/
    └── *.md                # 문서
```

---

## 6. 확장성 및 향후 계획

### 6.1 모듈화 로드맵
- **Phase 1**: ES6 모듈 분리 (계산/시각화/유틸)
- **Phase 2**: TypeScript 마이그레이션
- **Phase 3**: React/Vue 프론트엔드 전환

### 6.2 기능 확장 계획
- AI 기반 최적 말뚝장 추천
- BIM 연동 (IFC 포맷)
- 클라우드 협업 기능
- 모바일 대응 (PWA)

---

*문서 버전: 1.0*
*최종 수정: 2025.01*
