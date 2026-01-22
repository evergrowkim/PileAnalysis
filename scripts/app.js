        // Global Variables
        let boreholeData = [];
        let selectedBorehole = null;
        let calculationResults = [];
        let charts = {};
        let sensitivityChart = null;

        // PHC Pile Database
        const PHC_PILES = {
            '400-A': { diameter: 0.4, thickness: 0.065, area: 0.0684, crossArea: 0.1256, allowable: 1120, I: 0.00126 },
            '450-A': { diameter: 0.45, thickness: 0.070, area: 0.0836, crossArea: 0.1590, allowable: 1370, I: 0.00201 },
            '500-A': { diameter: 0.5, thickness: 0.080, area: 0.1056, crossArea: 0.1963, allowable: 1730, I: 0.00307 },
            '500-B': { diameter: 0.5, thickness: 0.080, area: 0.1056, crossArea: 0.1963, allowable: 1780, I: 0.00307 },
            '600-A': { diameter: 0.6, thickness: 0.090, area: 0.1442, crossArea: 0.2827, allowable: 2360, I: 0.00636 },
            '600-B': { diameter: 0.6, thickness: 0.090, area: 0.1442, crossArea: 0.2827, allowable: 2430, I: 0.00636 }
        };

        // Steel Pipe Pile Database
        const STEEL_PIPE_SPECS = {
            standards: {
                'KS F 4602': { name: 'Steel Pipe Piles (KS)', year: 2022 },
                'JIS A 5525': { name: 'Steel Pipe Piles (JIS)', year: 2019 },
                'ASTM A252': { name: 'Welded and Seamless Steel Pipe Piles', year: 2021 }
            },
            materials: {
                'SKK400': { standard: 'KS F 4602', yieldStrength: 235, tensileStrength: 400, elongation: 17, description: '일반 강관말뚝용 강재' },
                'SKK490': { standard: 'KS F 4602', yieldStrength: 315, tensileStrength: 490, elongation: 17, description: '고강도 강관말뚝용 강재' },
                'SKK540': { standard: 'KS F 4602', yieldStrength: 380, tensileStrength: 540, elongation: 15, description: '고강도 강관말뚝용 강재' },
                'SYW295': { standard: 'KS F 4602', yieldStrength: 295, tensileStrength: 400, elongation: 30, description: '용접 강관말뚝용 강재 (소성 변형 능력 우수)' },
                'SYW390': { standard: 'KS F 4602', yieldStrength: 390, tensileStrength: 490, elongation: 25, description: '용접 강관말뚝용 강재 (소성 변형 능력 우수)' },
                'STK400': { standard: 'JIS A 5525', yieldStrength: 235, tensileStrength: 400, elongation: 17, description: '일반 구조용 탄소강 강관' },
                'STK490': { standard: 'JIS A 5525', yieldStrength: 315, tensileStrength: 490, elongation: 17, description: '일반 구조용 탄소강 강관' },
                'ASTM_A252_Grade1': { standard: 'ASTM A252', yieldStrength: 207, tensileStrength: 310, elongation: 30, description: 'Low strength grade' },
                'ASTM_A252_Grade2': { standard: 'ASTM A252', yieldStrength: 241, tensileStrength: 345, elongation: 30, description: 'Medium strength grade' },
                'ASTM_A252_Grade3': { standard: 'ASTM A252', yieldStrength: 310, tensileStrength: 455, elongation: 25, description: 'High strength grade' },
                // Legacy support
                'Grade1': { standard: 'ASTM A252', yieldStrength: 207, tensileStrength: 310, elongation: 30, description: 'Low strength grade' },
                'Grade2': { standard: 'ASTM A252', yieldStrength: 241, tensileStrength: 345, elongation: 30, description: 'Medium strength grade' },
                'Grade3': { standard: 'ASTM A252', yieldStrength: 310, tensileStrength: 455, elongation: 25, description: 'High strength grade' }
            },
            dimensions: [
                { diameter: 318.5, thicknesses: [6.0, 6.9, 7.9, 9.3, 10.3, 12.7] },
                { diameter: 355.6, thicknesses: [6.0, 6.9, 7.9, 9.3, 10.3, 12.7, 15.9] },
                { diameter: 406.4, thicknesses: [6.9, 7.9, 9.3, 10.3, 12.7, 15.9] },
                { diameter: 457.2, thicknesses: [6.9, 7.9, 9.3, 10.3, 12.7, 15.9] },
                { diameter: 508.0, thicknesses: [6.9, 7.9, 9.3, 10.3, 12.7, 15.9, 19.1] },
                { diameter: 558.8, thicknesses: [6.9, 7.9, 9.3, 10.3, 12.7, 15.9, 19.1] },
                { diameter: 609.6, thicknesses: [6.9, 7.9, 9.3, 10.3, 12.7, 15.9, 19.1] },
                { diameter: 711.2, thicknesses: [7.9, 9.3, 10.3, 12.7, 15.9, 19.1] },
                { diameter: 812.8, thicknesses: [7.9, 9.3, 10.3, 12.7, 15.9, 19.1, 22.2] },
                { diameter: 914.4, thicknesses: [9.3, 10.3, 12.7, 15.9, 19.1, 22.2] },
                { diameter: 1016.0, thicknesses: [9.3, 10.3, 12.7, 15.9, 19.1, 22.2, 25.4] },
                { diameter: 1219.2, thicknesses: [10.3, 12.7, 15.9, 19.1, 22.2, 25.4] },
                { diameter: 1524.0, thicknesses: [12.7, 15.9, 19.1, 22.2, 25.4] }
            ],
            coatings: {
                'NONE': { description: '무도장', thicknessReduction: 0 },
                'EP': { description: '에폭시 도장', thicknessReduction: 0.5 },
                'TEP': { description: '타르에폭시 도장', thicknessReduction: 0.5 },
                'MOR': { description: '모르타르 피복', thicknessReduction: 1.0 }
            },
            elasticModulus: 200000, // MPa (구조물 기초 설계기준 해설 표 5.3.10 기준: 2.00×10⁸ kN/m²)
            poissonRatio: 0.3,
            density: 7.85 // t/m³
        };

        // ============================================================
        // 말뚝재료 탄성계수 (구조물 기초 설계기준 해설 표 5.3.10)
        // ============================================================
        const PILE_ELASTIC_MODULUS = {
            source: {
                document: "구조물 기초 설계기준 해설",
                table_id: "표 5.3.10",
                title: "말뚝재료의 탄성계수"
            },
            RC: {
                name: "RC 말뚝",
                E_kPa: 3.43e7,      // kN/m² = kPa
                E_MPa: 34300        // MPa
            },
            PHC: {
                name: "PC 및 PHC 말뚝",
                E_kPa: 3.92e7,      // kN/m² = kPa
                E_MPa: 39200        // MPa
            },
            CAST_IN_PLACE: {
                name: "현장타설 콘크리트 말뚝",
                E_kPa: 2.45e7,      // kN/m² = kPa
                E_MPa: 24500        // MPa
            },
            STEEL: {
                name: "강관말뚝",
                E_kPa: 2.00e8,      // kN/m² = kPa
                E_MPa: 200000       // MPa
            },
            CONCRETE_FILLED_STEEL: {
                name: "콘크리트 속채움 강관말뚝",
                concrete: {
                    E_kPa: 3.43e7,
                    E_MPa: 34300
                },
                steel: {
                    E_kPa: 2.00e8,
                    E_MPa: 200000
                }
            }
        };

        // ============================================================
        // 토질별 단위중량 Ontology (기본값)
        // ============================================================
        const SOIL_UNIT_WEIGHT = {
            source: {
                section: "1. 단위중량",
                document: "말뚝지지력 계산서 물성치"
            },
            units: {
                unit_weight: "t/m³",
                submerged_unit_weight: "t/m³"
            },
            // 토질 분류별 기본 단위중량 (t/m³)
            classification: {
                // 성토층
                "성토": { gamma: 1.9, gamma_sub: 0.9, description: "성토층, 매립층" },
                "성토층": { gamma: 1.9, gamma_sub: 0.9, description: "성토층" },
                "매립": { gamma: 1.8, gamma_sub: 0.8, description: "매립층" },
                "매립층": { gamma: 1.8, gamma_sub: 0.8, description: "매립층" },

                // 점성토
                "점토": { gamma: 1.7, gamma_sub: 0.7, description: "점성토 (CL)" },
                "점담토": { gamma: 1.7, gamma_sub: 0.7, description: "점성토 (CL)" },
                "실트질점토": { gamma: 1.7, gamma_sub: 0.7, description: "실트질 점토" },
                "CL": { gamma: 1.7, gamma_sub: 0.7, description: "저소성 점토" },
                "CH": { gamma: 1.6, gamma_sub: 0.6, description: "고소성 점토" },
                "ML": { gamma: 1.7, gamma_sub: 0.7, description: "저소성 실트" },
                "MH": { gamma: 1.6, gamma_sub: 0.6, description: "고소성 실트" },

                // 사질토
                "모래": { gamma: 1.8, gamma_sub: 0.8, description: "사질토" },
                "사질토": { gamma: 1.8, gamma_sub: 0.8, description: "사질토" },
                "실트질모래": { gamma: 1.8, gamma_sub: 0.8, description: "실트질 모래 (SM)" },
                "SM": { gamma: 1.8, gamma_sub: 0.8, description: "실트질 모래" },
                "SP": { gamma: 1.8, gamma_sub: 0.8, description: "입도분포 불량 모래" },
                "SW": { gamma: 1.9, gamma_sub: 0.9, description: "입도분포 양호 모래" },
                "SC": { gamma: 1.8, gamma_sub: 0.8, description: "점토질 모래" },

                // 자갈
                "자갈": { gamma: 2.0, gamma_sub: 1.0, description: "자갈" },
                "자갈섞인모래": { gamma: 1.9, gamma_sub: 0.9, description: "자갈섞인 모래" },
                "GP": { gamma: 2.0, gamma_sub: 1.0, description: "입도분포 불량 자갈" },
                "GW": { gamma: 2.1, gamma_sub: 1.1, description: "입도분포 양호 자갈" },
                "GM": { gamma: 1.9, gamma_sub: 0.9, description: "실트질 자갈" },
                "GC": { gamma: 1.9, gamma_sub: 0.9, description: "점토질 자갈" },

                // 퇴적층
                "퇴적층": { gamma: 1.8, gamma_sub: 0.8, description: "퇴적층 (SM/SP)" },
                "퇴적토": { gamma: 1.8, gamma_sub: 0.8, description: "퇴적토" },
                "충적층": { gamma: 1.8, gamma_sub: 0.8, description: "충적층" },
                "충적토": { gamma: 1.8, gamma_sub: 0.8, description: "충적토" },

                // 풍화토/풍화잔류토/풍화암
                "풍화토": { gamma: 1.9, gamma_sub: 0.9, description: "풍화토 (SM)" },
                "풍화잔류토": { gamma: 1.9, gamma_sub: 0.9, description: "풍화잔류토 (SM, 마사토)" },
                "잔류토": { gamma: 1.9, gamma_sub: 0.9, description: "잔류토" },
                "마사토": { gamma: 1.9, gamma_sub: 0.9, description: "마사토" },
                "풍화암": { gamma: 2.1, gamma_sub: 1.1, description: "풍화암" },
                "연암": { gamma: 2.3, gamma_sub: 1.3, description: "연암" },
                "경암": { gamma: 2.5, gamma_sub: 1.5, description: "경암" },
                "암반": { gamma: 2.5, gamma_sub: 1.5, description: "암반" }
            },
            // 단위중량 조회 함수
            getUnitWeight: function(soilName) {
                // 정확히 일치하는 경우
                if (this.classification[soilName]) {
                    return this.classification[soilName];
                }
                // 부분 일치 검색
                const lowerName = soilName.toLowerCase();
                for (const [key, value] of Object.entries(this.classification)) {
                    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
                        return value;
                    }
                }
                // 기본값 (사질토 기준)
                return { gamma: 1.8, gamma_sub: 0.8, description: "기본값 (사질토 기준)" };
            }
        };

        // ============================================================
        // 지질층명 온톨로지 (오타 자동 수정)
        // ============================================================
        const SOIL_NAME_ONTOLOGY = {
            // 정규화된 지질층명 매핑 (오타 → 정확한 이름)
            corrections: {
                // 전답토 관련 오타
                "전달토": "전답토",
                "전단토": "전답토",
                "전닥토": "전답토",
                "전답": "전답토",
                "전답층": "전답토",

                // 붕적층 관련 오타
                "봉적층": "붕적층",
                "붕적": "붕적층",
                "봉적": "붕적층",
                "붕적토": "붕적층",
                "봉적토": "붕적층",

                // 풍화토 관련 오타
                "풍화토층": "풍화토",
                "풍화토": "풍화토",
                "풍화 토": "풍화토",
                "풍화도": "풍화토",

                // 풍화잔류토 관련 (정규화하지 않고 유지 - 풍화암과 구분 필요)
                "풍화잔류토층": "풍화잔류토",
                "풍화 잔류토": "풍화잔류토",
                "잔류토층": "풍화잔류토",
                "잔류토": "풍화잔류토",
                "마사토": "풍화잔류토",
                "마사": "풍화잔류토",

                // 풍화암 관련 오타
                "풍화암층": "풍화암",
                "풍화암": "풍화암",
                "풍화 암": "풍화암",
                "풍화암반": "풍화암",

                // 연암 관련 오타
                "연암층": "연암",
                "연암반": "연암",
                "연 암": "연암",
                "년암": "연암",

                // 경암 관련 오타
                "경암층": "경암",
                "경암반": "경암",
                "견암": "경암",

                // 점토 관련 오타
                "점토층": "점토",
                "점담토": "점토",
                "점 토": "점토",

                // 실트 관련 오타
                "실트층": "실트",
                "실트질": "실트",
                "실트 질": "실트",

                // 모래 관련 오타
                "모래층": "모래",
                "사질토": "모래",
                "사질토층": "모래",

                // 자갈 관련 오타
                "자갈층": "자갈",
                "자갈토": "자갈",

                // 매립층 관련 오타
                "매립": "매립층",
                "매립토": "매립층",
                "메립층": "매립층",
                "메립토": "매립층",

                // 성토층 관련 오타
                "성토": "성토층",
                "성토재": "성토층",

                // 퇴적층 관련 오타
                "퇴적": "퇴적층",
                "퇴적토": "퇴적층",
                "퇴적 층": "퇴적층",

                // 충적층 관련 오타
                "충적": "충적층",
                "충적토": "충적층",
                "충적 층": "충적층",

                // 부식토/표토 관련 오타
                "부식층": "표토",
                "부식토": "표토",
                "표토층": "표토",

                // 암반 관련 오타
                "암반층": "암반",
                "기반암": "암반"
            },

            // 유사도 기반 매칭을 위한 표준 지질층 목록
            standardNames: [
                "전답토", "붕적층", "풍화토", "풍화잔류토", "풍화암", "연암", "경암",
                "점토", "실트", "모래", "자갈", "매립층", "성토층",
                "퇴적층", "충적층", "표토", "암반", "사력층", "호박돌층"
            ],

            // 지질층명 정규화 함수
            normalize: function(soilName) {
                if (!soilName || typeof soilName !== 'string') return soilName;

                const trimmed = soilName.trim();

                // 1. 정확한 매칭 (corrections 테이블)
                if (this.corrections[trimmed]) {
                    console.log(`지질층명 자동 수정: "${trimmed}" → "${this.corrections[trimmed]}"`);
                    return this.corrections[trimmed];
                }

                // 2. 공백 제거 후 매칭
                const noSpace = trimmed.replace(/\s+/g, '');
                if (this.corrections[noSpace]) {
                    console.log(`지질층명 자동 수정: "${trimmed}" → "${this.corrections[noSpace]}"`);
                    return this.corrections[noSpace];
                }

                // 3. 유사도 기반 매칭 (레벤슈타인 거리)
                const bestMatch = this.findBestMatch(trimmed);
                if (bestMatch && bestMatch.distance <= 2) {
                    console.log(`지질층명 유사도 수정: "${trimmed}" → "${bestMatch.name}" (거리: ${bestMatch.distance})`);
                    return bestMatch.name;
                }

                // 4. 매칭 실패 시 원본 반환
                return trimmed;
            },

            // 레벤슈타인 거리 계산
            levenshteinDistance: function(a, b) {
                if (a.length === 0) return b.length;
                if (b.length === 0) return a.length;

                const matrix = [];
                for (let i = 0; i <= b.length; i++) {
                    matrix[i] = [i];
                }
                for (let j = 0; j <= a.length; j++) {
                    matrix[0][j] = j;
                }

                for (let i = 1; i <= b.length; i++) {
                    for (let j = 1; j <= a.length; j++) {
                        if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
                return matrix[b.length][a.length];
            },

            // 가장 유사한 표준 지질층명 찾기
            findBestMatch: function(input) {
                let bestMatch = null;
                let minDistance = Infinity;

                // corrections 키와 비교
                for (const key of Object.keys(this.corrections)) {
                    const distance = this.levenshteinDistance(input, key);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestMatch = { name: this.corrections[key], distance: distance };
                    }
                }

                // 표준 이름과 비교
                for (const name of this.standardNames) {
                    const distance = this.levenshteinDistance(input, name);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestMatch = { name: name, distance: distance };
                    }
                }

                return bestMatch;
            }
        };

        // Calculate steel pipe properties
        function calculateSteelPipeProperties(diameter, thickness, material) {
            const D = diameter / 1000; // mm to m
            const t = thickness / 1000;
            const d = D - 2 * t; // Inner diameter
            
            const A = Math.PI / 4 * (D * D - d * d); // Cross-sectional area (m²)
            const I = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4)); // Moment of inertia (m⁴)
            const Z = I / (D / 2); // Section modulus (m³)
            const r = Math.sqrt(I / A); // Radius of gyration (m)
            const weight = A * 7.85; // Unit weight (t/m)
            
            const mat = STEEL_PIPE_SPECS.materials[material];
            const allowableStress = mat ? mat.yieldStrength / 1.5 : 235 / 1.5; // Short-term allowable stress
            const allowableLoad = allowableStress * A * 1000; // kN
            
            return {
                diameter: D,
                thickness: t,
                area: A,
                crossArea: Math.PI * D * D / 4,
                I: I,
                Z: Z,
                r: r,
                weight: weight,
                allowable: allowableLoad
            };
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            initializeEventListeners();
            initializeDefaultData();
            initializeSensitivityAnalysis();
        });

        function initializeEventListeners() {
            // File upload
            document.getElementById('boringLogFile').addEventListener('change', handleFileUpload);
            
            // Target ground elevation input - bulk setting for all boreholes
            document.getElementById('targetGroundElevation').addEventListener('change', function() {
                const bulkTargetElevation = parseFloat(this.value);
                if (!isNaN(bulkTargetElevation) && boreholeData.length > 0) {
                    // Update all boreholes' target elevation
                    boreholeData.forEach(borehole => {
                        borehole._targetElevation = bulkTargetElevation;
                    });
                    
                    // Recalculate all boreholes
                    if (calculationResults && calculationResults.length > 0) {
                        const updatedResults = [];
                        boreholeData.forEach(borehole => {
                            try {
                                const result = calculateForBorehole(borehole);
                                updatedResults.push(result);
                            } catch (error) {
                                console.error('Recalculation error for', borehole.hole_no, ':', error);
                                const existingResult = calculationResults.find(r => r.borehole === borehole.hole_no);
                                updatedResults.push(existingResult || createDefaultResult(borehole.hole_no));
                            }
                        });
                        calculationResults = updatedResults;
                        updateSummaryTable();
                        updateSummaryCards();
                        updateCharts();
                    }
                }
                updateGroundModificationStatus();
            });
            
            // Also update on input for real-time status update
            document.getElementById('targetGroundElevation').addEventListener('input', function() {
                updateGroundModificationStatus();
            });

            // Tab navigation
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', function() {
                    switchTab(this.dataset.tab);
                });
            });
            
            // End bearing coefficient change - update calculations if already calculated
            const endBearingCoeffInput = document.getElementById('endBearingCoefficient');
            if (endBearingCoeffInput) {
                endBearingCoeffInput.addEventListener('change', function() {
                    // If calculations have been performed, update the display
                    if (calculationResults && calculationResults.length > 0) {
                        updateCalculations();
                    }
                });
            }
            
            // Allowable lateral displacement change - update calculations if already calculated
            const allowableLateralDispInput = document.getElementById('allowableLateralDisplacement');
            if (allowableLateralDispInput) {
                allowableLateralDispInput.addEventListener('change', function() {
                    // If calculations have been performed, recalculate and update
                    if (calculationResults && calculationResults.length > 0) {
                        // Recalculate all results
                        const updatedResults = [];
                        boreholeData.forEach(borehole => {
                            const result = calculateForBorehole(borehole);
                            updatedResults.push(result);
                        });
                        calculationResults = updatedResults;
                updateSummaryTable();
                updateCharts();
                updateCalculations();
                updateSensitivityBoreholeSelect();
                    }
                });
            }
        }

        // Update ground modification status based on target elevation vs original ground
        function updateGroundModificationStatus() {
            const targetElevation = parseFloat(document.getElementById('targetGroundElevation').value);
            const statusElement = document.getElementById('groundModificationStatus');
            const fillInputs = document.getElementById('fillInputs');
            
            if (isNaN(targetElevation) || boreholeData.length === 0) {
                statusElement.textContent = '시추공 데이터 로드 후 원지반고와 비교하여 성토/절토가 자동으로 판단됩니다.';
                fillInputs.style.display = 'none';
                return;
            }
            
            // Get first borehole's original ground elevation
            const firstBorehole = boreholeData[0];
            const originalElevation = getGroundSurfaceElevation(firstBorehole.metadata) || 0;
            
            if (!originalElevation || isNaN(originalElevation)) {
                statusElement.textContent = '원지반고 정보를 찾을 수 없습니다.';
                fillInputs.style.display = 'none';
                return;
            }
            
            const difference = targetElevation - originalElevation;
            
            if (difference > 0.01) {
                // Fill (성토)
                statusElement.innerHTML = `<span style="color: var(--status-pass); font-weight: 600;">성토 계획</span> - 원지반고: EL.${originalElevation.toFixed(1)}m, 계획고: EL.${targetElevation.toFixed(1)}m (성토 ${difference.toFixed(1)}m)`;
                fillInputs.style.display = 'block';
            } else if (difference < -0.01) {
                // Excavation (절토)
                statusElement.innerHTML = `<span style="color: var(--status-warning); font-weight: 600;">절토 계획</span> - 원지반고: EL.${originalElevation.toFixed(1)}m, 계획고: EL.${targetElevation.toFixed(1)}m (절토 ${Math.abs(difference).toFixed(1)}m)`;
                fillInputs.style.display = 'none';
            } else {
                // No change
                statusElement.innerHTML = `<span style="color: var(--text-secondary);">변경 없음</span> - 원지반고: EL.${originalElevation.toFixed(1)}m`;
                fillInputs.style.display = 'none';
            }
        }

        function togglePileTypeInputs() {
            const pileType = document.getElementById('pileTypeSelector').value;
            const phcOptions = document.getElementById('phcPileOptions');
            const steelOptions = document.getElementById('steelPileOptions');
            
            if (pileType === 'phc') {
                phcOptions.style.display = 'block';
                steelOptions.style.display = 'none';
            } else {
                phcOptions.style.display = 'none';
                steelOptions.style.display = 'block';
                updateSteelThicknessOptions();
            }
        }

        function updateSteelMaterialOptions() {
            const standard = document.getElementById('steelStandard').value;
            const materialSelect = document.getElementById('steelMaterial');
            
            materialSelect.innerHTML = '';
            
            if (standard === 'KS F 4602') {
                materialSelect.innerHTML = `
                    <option value="SKK400" selected>SKK400 (Fy=235 MPa)</option>
                    <option value="SKK490">SKK490 (Fy=315 MPa)</option>
                    <option value="SKK540">SKK540 (Fy=380 MPa)</option>
                    <option value="SYW295">SYW295 (Fy=295 MPa, 용접용)</option>
                    <option value="SYW390">SYW390 (Fy=390 MPa, 용접용)</option>
                `;
            } else if (standard === 'JIS A 5525') {
                materialSelect.innerHTML = `
                    <option value="STK400" selected>STK400 (Fy=235 MPa)</option>
                    <option value="STK490">STK490 (Fy=315 MPa)</option>
                `;
            } else if (standard === 'ASTM A252') {
                materialSelect.innerHTML = `
                    <option value="ASTM_A252_Grade1" selected>Grade 1 (Fy=207 MPa)</option>
                    <option value="ASTM_A252_Grade2">Grade 2 (Fy=241 MPa)</option>
                    <option value="ASTM_A252_Grade3">Grade 3 (Fy=310 MPa)</option>
                `;
            }
        }

        function updateSteelThicknessOptions() {
            const diameter = parseFloat(document.getElementById('steelDiameter').value);
            const thicknessSelect = document.getElementById('steelThickness');
            
            const dimSpec = STEEL_PIPE_SPECS.dimensions.find(d => d.diameter === diameter);
            if (!dimSpec) return;
            
            thicknessSelect.innerHTML = '';
            dimSpec.thicknesses.forEach((t, index) => {
                const option = document.createElement('option');
                option.value = t;
                option.textContent = t;
                if (index === Math.floor(dimSpec.thicknesses.length / 2)) {
                    option.selected = true;
                }
                thicknessSelect.appendChild(option);
            });
        }

        function getCurrentPile() {
            const pileType = document.getElementById('pileTypeSelector').value;
            
            if (pileType === 'phc') {
                const pileSpec = document.getElementById('phcPileType').value;
                return {
                    type: 'phc',
                    spec: pileSpec,
                    ...PHC_PILES[pileSpec]
                };
            } else {
                const diameter = parseFloat(document.getElementById('steelDiameter').value);
                const thickness = parseFloat(document.getElementById('steelThickness').value);
                const material = document.getElementById('steelMaterial').value;
                const coating = document.getElementById('steelCoating').value;
                
                const coatingReduction = STEEL_PIPE_SPECS.coatings[coating].thicknessReduction;
                const effectiveThickness = thickness - coatingReduction;
                
                const props = calculateSteelPipeProperties(diameter, effectiveThickness, material);
                
                return {
                    type: 'steel',
                    spec: `Ø${diameter}×${thickness}`,
                    material: material,
                    coating: coating,
                    ...props
                };
            }
        }

        function initializeDefaultData() {
            // Create sample data for testing
            const sampleData = {
                extracted_data: [
                    {
                        hole_no: "NBH-1",
                        metadata: {
                            PROJECT_NAME: "청년가스발전소 1호기 파워플랜트 EPC 시공사업",
                            LOCATION: "충청북도 음성군 음성읍 평곡리",
                            Excavation_level: 138.4,
                            GROUND_WATER_LEVEL: "-6.40"
                        },
                        soil_data: [
                            {
                                depth_range: "0.0~4.3m",
                                soil_name: "매립토",
                                soil_color: "갈색",
                                samples: [
                                    { Depth: 1, Hits: "3/30" },
                                    { Depth: 2, Hits: "2/30" },
                                    { Depth: 3, Hits: "1/30" },
                                    { Depth: 4, Hits: "4/30" }
                                ]
                            },
                            {
                                depth_range: "4.3~6.7m",
                                soil_name: "퇴적토",
                                soil_color: "황갈색",
                                samples: [
                                    { Depth: 5, Hits: "34/30" },
                                    { Depth: 6, Hits: "50/14" }
                                ]
                            },
                            {
                                depth_range: "6.7~18.5m",
                                soil_name: "풍화암",
                                soil_color: "갈색",
                                samples: [
                                    { Depth: 7, Hits: "50/8" },
                                    { Depth: 8, Hits: "50/6" },
                                    { Depth: 15, Hits: "50/5" }
                                ]
                            },
                            {
                                depth_range: "18.5~21.5m",
                                soil_name: "연암",
                                soil_color: "회색",
                                samples: []
                            }
                        ]
                    },
                    {
                        hole_no: "NBH-2",
                        metadata: {
                            PROJECT_NAME: "청년가스발전소 1호기 파워플랜트 EPC 시공사업",
                            LOCATION: "충청북도 음성군 음성읍 평곡리",
                            Excavation_level: 143.3,
                            GROUND_WATER_LEVEL: ""
                        },
                        soil_data: [
                            {
                                depth_range: "0.0~2.0m",
                                soil_name: "매립토",
                                soil_color: "갈색",
                                samples: []
                            },
                            {
                                depth_range: "2.0~5.0m",
                                soil_name: "퇴적토",
                                soil_color: "황갈색",
                                samples: []
                            },
                            {
                                depth_range: "5.0~6.3m",
                                soil_name: "풍화암",
                                soil_color: "황갈색",
                                samples: []
                            },
                            {
                                depth_range: "6.3~9.3m",
                                soil_name: "연암",
                                soil_color: "회색",
                                samples: []
                            }
                        ]
                    }
                ]
            };

            processBoreholeData(sampleData);
            
            // Initialize Appendix tab with PHC pile specifications
            initializeAppendixTab();
        }
        
        function initializeAppendixTab() {
            // Populate PHC pile specifications table
            const phcTableBody = document.getElementById('phcSpecTable');
            if (phcTableBody) {
                phcTableBody.innerHTML = Object.entries(PHC_PILES).map(([spec, props]) => `
                    <tr>
                        <td><strong>${spec}</strong></td>
                        <td>${props.diameter.toFixed(2)}</td>
                        <td>${props.thickness.toFixed(3)}</td>
                        <td>${props.area.toFixed(4)}</td>
                        <td>${props.I.toFixed(5)}</td>
                        <td>${props.allowable.toFixed(0)}</td>
                    </tr>
                `).join('');
            }
        }

        function switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
                if (button.dataset.tab === tabName) {
                    button.classList.add('active');
                }
            });

            // Update tab panels
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');

            // Render MathJax if calculations or appendix tab
            if (tabName === 'calculations' || tabName === 'appendix') {
                setTimeout(() => {
                    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                        MathJax.typesetPromise().catch((err) => console.log('MathJax typeset error:', err));
                    }
                }, 100);
            }
            
            // Initialize sensitivity analysis when tab is opened
            if (tabName === 'sensitivity') {
                updateSensitivityBoreholeSelect();
                updateSensitivityRangeControls();
            }
        }

        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 업로드 상태 표시
            const uploadStatus = document.getElementById('uploadStatus');
            if (uploadStatus) {
                uploadStatus.style.background = '#fff3e0';
                uploadStatus.style.color = '#e65100';
                uploadStatus.innerHTML = '⏳ 파일 로딩 중...';
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    if (!text) {
                        if (uploadStatus) {
                            uploadStatus.style.background = '#ffebee';
                            uploadStatus.style.color = '#c62828';
                            uploadStatus.innerHTML = '❌ 파일이 비어있습니다';
                        }
                        alert('파일이 비어있습니다.');
                        return;
                    }

                    const data = JSON.parse(text);
                    if (!data) {
                        if (uploadStatus) {
                            uploadStatus.style.background = '#ffebee';
                            uploadStatus.style.color = '#c62828';
                            uploadStatus.innerHTML = '❌ 유효하지 않은 JSON';
                        }
                        alert('유효한 JSON 데이터가 아닙니다.');
                        return;
                    }

                    processBoreholeData(data);

                    // 업로드 성공 표시
                    if (uploadStatus) {
                        const boreholeCount = boreholeData ? boreholeData.length : 0;
                        uploadStatus.style.background = '#e8f5e9';
                        uploadStatus.style.color = '#2e7d32';
                        uploadStatus.innerHTML = `✅ ${file.name}<br><small>${boreholeCount}개 시추공 로드됨</small>`;
                    }
                } catch (error) {
                    console.error('File upload error:', error);
                    if (uploadStatus) {
                        uploadStatus.style.background = '#ffebee';
                        uploadStatus.style.color = '#c62828';
                        uploadStatus.innerHTML = '❌ JSON 파싱 오류';
                    }
                    alert('파일 읽기 오류: JSON 형식이 올바르지 않습니다.\n' + error.message);
                }
            };

            reader.onerror = function(error) {
                console.error('FileReader error:', error);
                if (uploadStatus) {
                    uploadStatus.style.background = '#ffebee';
                    uploadStatus.style.color = '#c62828';
                    uploadStatus.innerHTML = '❌ 파일 읽기 오류';
                }
                alert('파일을 읽을 수 없습니다.');
            };

            reader.readAsText(file);
        }

        // Helper function to parse elevation from various formats
        function parseElevation(elevationString) {
            if (!elevationString) return null;

            // If it's already a number, return it
            const num = parseFloat(elevationString);
            if (!isNaN(num)) return num;

            // Convert to string for parsing
            const str = String(elevationString).trim();

            // Parse formats like "E.L(+)51.05m", "E.L(-)5.8m", "EL.51.05m", "E.L.(+)51.05m" etc.
            // Pattern: E.L or EL followed by optional (+ or -) then number
            const patterns = [
                /E\.?L\.?\s*\(\s*([+\-])\s*\)\s*(\d+\.?\d*)/i,  // E.L(+)51.05 or E.L(-)5.8
                /E\.?L\.?\s*\(\s*([+\-]?\d+\.?\d*)\s*\)/i,      // E.L(51.05) or E.L(-5.8)
                /E\.?L\.?\s*([+\-]?\d+\.?\d*)/i,                 // EL.51.05 or EL-5.8
                /([+\-]?\d+\.?\d*)\s*m?$/i                       // Just number with optional m
            ];

            // Try pattern 1: E.L(+)51.05m format
            let match = str.match(patterns[0]);
            if (match) {
                const sign = match[1] === '-' ? -1 : 1;
                return sign * parseFloat(match[2]);
            }

            // Try pattern 2: E.L(51.05) format
            match = str.match(patterns[1]);
            if (match) {
                return parseFloat(match[1]);
            }

            // Try pattern 3: EL.51.05 format
            match = str.match(patterns[2]);
            if (match) {
                return parseFloat(match[1]);
            }

            // Try pattern 4: Just extract number
            match = str.match(patterns[3]);
            if (match) {
                return parseFloat(match[1]);
            }

            return null;
        }

        // Helper function to parse groundwater level from various formats
        function parseGroundwaterLevel(gwlString) {
            if (!gwlString || gwlString.trim() === '') return null;
            
            // If it's already a number (like "-6.40"), return it
            const num = parseFloat(gwlString);
            if (!isNaN(num)) return num;
            
            // Parse formats like "GL(-)5.8m", "GL(-5.8m)", "GWL: -5.8m", etc.
            // Extract depth value (negative or positive)
            const match = gwlString.match(/GL\s*[\(]?[+\-]?\)?\s*([+\-]?\d+\.?\d*)/i);
            if (match) {
                const depth = parseFloat(match[1]);
                // If depth is positive, make it negative (below ground)
                return depth > 0 ? -depth : depth;
            }
            
            // Try to extract any number from the string
            const numMatch = gwlString.match(/([+\-]?\d+\.?\d*)/);
            if (numMatch) {
                const depth = parseFloat(numMatch[1]);
                return depth > 0 ? -depth : depth;
            }
            
            return null;
        }

        // Helper function to get ground surface elevation from metadata
        function getGroundSurfaceElevation(metadata) {
            if (!metadata) return null;

            // Priority 1: Try GROUND_SURFACE_LEVEL first (more reliable, explicit elevation format)
            if (metadata.GROUND_SURFACE_LEVEL) {
                const val = parseElevation(metadata.GROUND_SURFACE_LEVEL);
                if (val !== null) {
                    console.log(`[getGroundSurfaceElevation] GROUND_SURFACE_LEVEL 파싱: "${metadata.GROUND_SURFACE_LEVEL}" → ${val}`);
                    return val;
                }
            }

            // Priority 2: Try Excavation_level (legacy format, may be unreliable)
            // Only use if it's a reasonable elevation value (typically > 0 and < 500 for Korea)
            if (metadata.Excavation_level !== undefined) {
                const val = parseElevation(metadata.Excavation_level);
                if (val !== null) {
                    // Sanity check: if GROUND_SURFACE_LEVEL exists but couldn't parse,
                    // and Excavation_level is very different, warn and prefer GROUND_SURFACE_LEVEL pattern
                    if (metadata.GROUND_SURFACE_LEVEL) {
                        const gslMatch = String(metadata.GROUND_SURFACE_LEVEL).match(/(\d+\.?\d*)/);
                        if (gslMatch) {
                            const gslVal = parseFloat(gslMatch[1]);
                            if (Math.abs(val - gslVal) > 10) {
                                console.warn(`[getGroundSurfaceElevation] Excavation_level(${val})와 GROUND_SURFACE_LEVEL(${gslVal}) 불일치 - GROUND_SURFACE_LEVEL 값 사용`);
                                return gslVal;
                            }
                        }
                    }
                    console.log(`[getGroundSurfaceElevation] Excavation_level 파싱: "${metadata.Excavation_level}" → ${val}`);
                    return val;
                }
            }

            return null;
        }

        // 중복된 깊이 범위를 가진 지층 제거 함수
        function removeDuplicateLayers(soilData) {
            if (!Array.isArray(soilData) || soilData.length === 0) return soilData;

            const seenDepthRanges = new Map();
            const uniqueLayers = [];

            soilData.forEach(layer => {
                if (!layer.depth_range) {
                    uniqueLayers.push(layer);
                    return;
                }

                const depthRange = layer.depth_range.trim();

                // 이미 같은 깊이 범위가 있는 경우
                if (seenDepthRanges.has(depthRange)) {
                    const existingLayer = seenDepthRanges.get(depthRange);

                    // 더 많은 샘플 데이터가 있는 것을 우선
                    const existingSamples = existingLayer.samples?.length || 0;
                    const currentSamples = layer.samples?.length || 0;

                    if (currentSamples > existingSamples) {
                        // 현재 레이어가 더 많은 정보를 가지고 있으면 교체
                        console.log(`중복 지층 제거: "${existingLayer.soil_name}" → "${layer.soil_name}" (${depthRange})`);
                        const idx = uniqueLayers.indexOf(existingLayer);
                        if (idx >= 0) {
                            uniqueLayers[idx] = layer;
                            seenDepthRanges.set(depthRange, layer);
                        }
                    } else {
                        console.log(`중복 지층 무시: "${layer.soil_name}" (${depthRange})`);
                    }
                } else {
                    seenDepthRanges.set(depthRange, layer);
                    uniqueLayers.push(layer);
                }
            });

            // 깊이순 정렬
            uniqueLayers.sort((a, b) => {
                const aMatch = a.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                const bMatch = b.depth_range?.match(/([\d.]+)~([\d.]+)m/);

                const aStart = aMatch ? parseFloat(aMatch[1]) : 0;
                const bStart = bMatch ? parseFloat(bMatch[1]) : 0;

                return aStart - bStart;
            });

            return uniqueLayers;
        }

        function processBoreholeData(data) {
            try {
                boreholeData = data.extracted_data || data;

                // Validate data structure
                if (!Array.isArray(boreholeData) || boreholeData.length === 0) {
                    alert('데이터 형식이 올바르지 않습니다.');
                    return;
                }

                // Normalize metadata and soil data for all boreholes
                boreholeData.forEach(borehole => {
                    if (borehole.metadata) {
                        // Normalize Excavation_level from GROUND_SURFACE_LEVEL if needed
                        if (!borehole.metadata.Excavation_level && borehole.metadata.GROUND_SURFACE_LEVEL) {
                            const elevation = parseElevation(borehole.metadata.GROUND_SURFACE_LEVEL);
                            if (elevation !== null) {
                                borehole.metadata.Excavation_level = elevation;
                            }
                        }

                        // Normalize GROUND_WATER_LEVEL format
                        if (borehole.metadata.GROUND_WATER_LEVEL) {
                            const gwl = parseGroundwaterLevel(borehole.metadata.GROUND_WATER_LEVEL);
                            if (gwl !== null) {
                                // Store as string in original format for display, but also store parsed value
                                borehole.metadata._GROUND_WATER_LEVEL_PARSED = gwl;
                            }
                        }
                    }

                    // ========================================
                    // 지질층 데이터 정규화 (온톨로지 적용 + 중복 제거)
                    // ========================================
                    if (borehole.soil_data && Array.isArray(borehole.soil_data)) {
                        // 1. 지질층명 온톨로지 적용 (오타 자동 수정)
                        borehole.soil_data.forEach(layer => {
                            if (layer.soil_name) {
                                layer._original_soil_name = layer.soil_name; // 원본 보존
                                layer.soil_name = SOIL_NAME_ONTOLOGY.normalize(layer.soil_name);
                            }
                        });

                        // 2. 중복 깊이 범위 지층 제거
                        borehole.soil_data = removeDuplicateLayers(borehole.soil_data);
                    }

                    // Initialize per-borehole target elevation (default to original elevation)
                    if (!borehole._targetElevation) {
                        const originalElevation = getGroundSurfaceElevation(borehole.metadata);
                        borehole._targetElevation = originalElevation !== null ? originalElevation : 0;
                    }
                });
                
                // Update project info
                const firstBorehole = boreholeData[0];
                if (firstBorehole && firstBorehole.metadata) {
                    document.getElementById('projectName').value = firstBorehole.metadata.PROJECT_NAME || '';
                    document.getElementById('projectLocation').value = firstBorehole.metadata.LOCATION || '';
                    
                    // Set default target elevation to original ground elevation (for bulk setting)
                    const originalElevation = getGroundSurfaceElevation(firstBorehole.metadata);
                    if (originalElevation !== null) {
                        document.getElementById('targetGroundElevation').value = originalElevation.toFixed(1);
                    }
                }

                // Update ground modification status
                updateGroundModificationStatus();

                // Populate borehole selects
                updateBoreholeSelects();

                // 보고서 탭 시추공 선택 UI 업데이트
                updateBoreholeSelection();

                // 입력 검토 탭 업데이트 (지층별 통계 분석 및 토질정수 추천)
                updateInputReviewTab();

                // Auto-run analysis
                performAnalysis();
            } catch (error) {
                console.error('Data processing error:', error);
                alert('데이터 처리 중 오류가 발생했습니다: ' + error.message);
            }
        }

        function updateBoreholeSelects() {
            const selects = ['boreholeSelect', 'calcBoreholeSelect'];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">-- 시추공을 선택하세요 --</option>';
                
                boreholeData.forEach((borehole, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = borehole.hole_no;
                    if (index === 0) option.selected = true;
                    select.appendChild(option);
                });
            });
        }

        function performAnalysis() {
            try {
                showLoading();
                calculationResults = [];

                // Table header is now fixed as "계획고" - no need to update dynamically

                // Check if we have data
                if (!boreholeData || boreholeData.length === 0) {
                    hideLoading();
                    alert('시추공 데이터가 없습니다. 파일을 업로드해주세요.');
                    return;
                }

                // Perform calculations for each borehole
                boreholeData.forEach(borehole => {
                    try {
                        const result = calculateForBorehole(borehole);
                        calculationResults.push(result);
                    } catch (error) {
                        console.error('Calculation error for borehole', borehole.hole_no, ':', error);
                        calculationResults.push(createDefaultResult(borehole.hole_no));
                    }
                });

                // Update all displays
                updateSummaryTable();
                updateSummaryCards();
                updateCharts();
                updateCalculations();
                
                // Auto-draw first borehole (SVG 기반)
                const boreholeSelect = document.getElementById('boreholeSelect');
                if (boreholeSelect && boreholeSelect.options.length > 1) {
                    // 첫 번째 시추공 자동 선택 및 시각화
                    boreholeSelect.value = '0';
                    drawBoreholeSVG();
                }

                hideLoading();
            } catch (error) {
                hideLoading();
                console.error('Analysis error:', error);
                alert('분석 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // Legacy functions removed - now uses updateDepthAnalysisCharts directly

        function calculateForBorehole(borehole) {
            try {
                const pile = getCurrentPile();
                const D = pile.diameter;
                
                // Get original ground elevation and target elevation
                const originalElevation = getGroundSurfaceElevation(borehole.metadata);
                if (originalElevation === null || isNaN(originalElevation)) {
                    console.error('Invalid excavation level for', borehole.hole_no);
                    return createDefaultResult(borehole.hole_no);
                }
                
                // Use per-borehole target elevation if set, otherwise use bulk setting
                let targetElevation = borehole._targetElevation;
                if (targetElevation === undefined || isNaN(targetElevation)) {
                    // Fallback to bulk setting
                    targetElevation = parseFloat(document.getElementById('targetGroundElevation').value);
                if (isNaN(targetElevation)) {
                    // If target elevation not set, use original elevation
                        targetElevation = originalElevation;
                        borehole._targetElevation = originalElevation;
                    } else {
                        borehole._targetElevation = targetElevation;
                    }
                }
                
                // 디버깅: 계획고 적용 확인
                console.log(`[calculateForBorehole] ${borehole.hole_no}: 원지반고=${originalElevation}, 계획고=${targetElevation}, 차이=${(targetElevation - originalElevation).toFixed(2)}m`);

                // Determine ground modification type based on elevation difference
                const elevationDiff = targetElevation - originalElevation;
                let groundMod = 'none';
                let fillHeight = 0;
                let excavationDepth = 0;
                
                if (elevationDiff > 0.01) {
                    // Fill (성토)
                    groundMod = 'fill';
                    fillHeight = elevationDiff;
                } else if (elevationDiff < -0.01) {
                    // Excavation (절토)
                    groundMod = 'excavation';
                    excavationDepth = Math.abs(elevationDiff);
                }
                
                // Pile start level is the target elevation (work surface)
                const pileStartLevel = targetElevation;
                
                // Find bearing layer (independent of ground modification)
                const bearingType = document.getElementById('bearingLayer').value;
                let bearingDepth = 15; // default depth from original ground level
                let bearingLayer = null;
                
                if (borehole.soil_data && Array.isArray(borehole.soil_data)) {
                    borehole.soil_data.forEach(layer => {
                        const soilName = layer.soil_name || '';

                        // 지지층 판정 로직 개선
                        // weathered_rock: 풍화암, 풍화잔류토(N>=50인 경우), 풍화토(N>=50인 경우)
                        // soft_rock: 연암
                        // n50: N값 50 이상인 모든 지층
                        let isBearingLayer = false;

                        if (bearingType === 'weathered_rock') {
                            // 풍화암은 무조건 지지층
                            if (soilName.includes('풍화암')) {
                                isBearingLayer = true;
                            }
                            // 풍화잔류토, 풍화토는 N>=50인 경우에만 지지층으로 인정
                            else if (soilName.includes('풍화잔류토') || soilName.includes('풍화토') || soilName.includes('잔류토')) {
                                const avgN = getAverageN(layer);
                                if (avgN >= 50) {
                                    isBearingLayer = true;
                                    console.log(`[지지층 탐지] ${soilName}: N값=${avgN} >= 50 → 지지층으로 인정`);
                                }
                            }
                        } else if (bearingType === 'weathered_residual') {
                            // 풍화잔류토 전용 옵션: N>=50인 풍화잔류토/풍화토를 지지층으로 선택
                            if (soilName.includes('풍화잔류토') || soilName.includes('풍화토') || soilName.includes('잔류토') || soilName.includes('마사토')) {
                                const avgN = getAverageN(layer);
                                if (avgN >= 50) {
                                    isBearingLayer = true;
                                    console.log(`[지지층 탐지] ${soilName}: N값=${avgN} >= 50 → 풍화잔류토 지지층으로 인정`);
                                }
                            }
                        } else if (bearingType === 'soft_rock') {
                            if (soilName.includes('연암')) {
                                isBearingLayer = true;
                            }
                        } else if (bearingType === 'n50') {
                            const avgN = getAverageN(layer);
                            if (avgN >= 50) {
                                isBearingLayer = true;
                            }
                        }

                        if (isBearingLayer) {
                            const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                            if (depthMatch && !bearingLayer) {
                                bearingDepth = parseFloat(depthMatch[1]) || bearingDepth;
                                bearingLayer = layer;
                                console.log(`[지지층 탐지] ${borehole.hole_no}: 지지층 발견 - ${soilName}, 깊이 ${bearingDepth}m`);
                            }
                        }
                    });
                }
                
                // Pile tip depth (from original ground level, user-defined penetration into bearing layer)
                const penetration = parseFloat(document.getElementById('penetrationDepth')?.value) || 1.0;
                let pileTipDepth = bearingDepth + penetration;

                // Pile tip level (absolute elevation) - from original ground level
                // Check if custom tip elevation is set for this borehole
                let pileTipLevel;
                if (borehole._customPileTipLevel !== undefined && !isNaN(borehole._customPileTipLevel)) {
                    pileTipLevel = borehole._customPileTipLevel;
                    // 커스텀 선단지지고에서 pileTipDepth 역산 (원지반고 기준 깊이)
                    pileTipDepth = originalElevation - pileTipLevel;
                    console.log(`[calculateForBorehole] ${borehole.hole_no}: 사용자 지정 선단지지고 = EL.${pileTipLevel.toFixed(2)}m, 역산 깊이 = ${pileTipDepth.toFixed(2)}m`);

                    // 새로운 깊이에 해당하는 지지층 재결정
                    bearingLayer = findLayerAtDepth(borehole, pileTipDepth);
                    if (bearingLayer) {
                        console.log(`[calculateForBorehole] ${borehole.hole_no}: 새 선단 위치 지층 = ${bearingLayer.soil_name}`);
                    }
                } else {
                    pileTipLevel = originalElevation - pileTipDepth;
                }
                
                // Total pile length (from pile start to pile tip)
                const pileLength = pileStartLevel - pileTipLevel;

                // 말뚝 길이가 0 이하인 경우 계산 중단 - 산정 불가 결과 반환
                if (pileLength <= 0) {
                    return {
                        borehole: borehole.hole_no,
                        elevation: originalElevation,
                        excavation: targetElevation,
                        pileLength: pileLength,
                        pileTipLevel: pileTipLevel,
                        pileTipDepth: pileTipDepth,
                        bearingLayer: bearingLayer,
                        groundMod: groundMod,
                        fillHeight: fillHeight,
                        excavationDepth: excavationDepth,
                        // 모든 계산 결과를 null 또는 0으로 설정
                        Qs: null,
                        Qp: null,
                        Qu: null,
                        Qa: null,
                        Ra: null,
                        Se: null,
                        Sp: null,
                        Sps: null,
                        totalSettlement: null,
                        Hu: null,
                        Ha: null,
                        skinFrictionDetails: [],
                        // 산정 불가 플래그
                        isInvalid: true,
                        invalidReason: '말뚝 길이가 0 이하로 지지력 산정 불가'
                    };
                }

                // Calculate bearing capacity components
                let Qs = 0; // Skin friction
                let skinFrictionDetails = [];
                
                // 1. Calculate fill zone friction (if fill exists)
                if (groundMod === 'fill') {
                    // 성토재 커스텀 파라미터 확인
                    let fillN = parseFloat(document.getElementById('fillNValue').value || 8);
                    let fillCu = null;

                    // 커스텀 파라미터에서 성토재 값 가져오기 (_customLayerList 우선)
                    let customFillParams = null;
                    if (borehole._customLayerList && borehole._customLayerList.length > 0) {
                        customFillParams = borehole._customLayerList.find(l => l.layerName === '성토재');
                    }
                    if (!customFillParams && borehole._customParams && borehole._customParams['성토재']) {
                        customFillParams = borehole._customParams['성토재'];
                    }
                    if (customFillParams) {
                        if (customFillParams.N > 0) {
                            fillN = customFillParams.N;
                            console.log(`[계산] ${borehole.hole_no} 성토재 - 커스텀 N값 적용: ${fillN}`);
                        }
                        if (customFillParams.cu > 0) {
                            fillCu = customFillParams.cu;
                        }
                    }

                    if (fillHeight > 0 && !isNaN(fillN)) {
                        // Fill zone skin friction
                        const fillThickness = fillHeight;
                        const fillAs = Math.PI * D * fillThickness;

                        // 성토재 주면마찰응력 계산 (입력 검토 탭에서 설정한 계수 사용)
                        const method = document.getElementById('constructionMethod').value;
                        const methodFactor = method === 'driven' ? 1.0 : 0.7;
                        // 성토재는 사질토 계수 적용 (입력 검토 탭에서 설정한 값)
                        const betaSandForFill = parseFloat(document.getElementById('betaSand')?.value) || 2.0;
                        let fillFs = betaSandForFill * fillN * methodFactor;

                        const fillQs = fillFs * fillAs;
                        Qs += fillQs;

                        skinFrictionDetails.push({
                            depth: `0.0-${fillHeight.toFixed(1)} (성토)`,
                            layer: '성토재',
                            soilType: 'sand',  // 성토재는 사질토로 분류
                            thickness: fillThickness,
                            N: fillN,
                            fs: fillFs,
                            As: fillAs,
                            Qs: fillQs
                        });

                        console.log(`[계산] ${borehole.hole_no} 성토재: N=${fillN}, fs=${fillFs.toFixed(1)}, Qs=${fillQs.toFixed(1)}`);
                    }
                }
                
                // 2. Calculate original ground friction (샘플 깊이 기반 구간 분할)
                // Start depth: 0 for fill, excavationDepth for excavation
                const startDepth = groundMod === 'excavation' ? excavationDepth : 0;
                const endDepth = pileTipDepth;
                const method = document.getElementById('constructionMethod').value;
                // 전역 설계 파라미터의 시공방법 보정계수 사용
                const factorDriven = globalDesignParameters.formulaCoeffs?.factorDriven || 1.0;
                const factorBored = globalDesignParameters.formulaCoeffs?.factorBored || 0.7;
                const methodFactor = method === 'driven' ? factorDriven : factorBored;

                // 샘플 깊이 기반 구간 분할점 수집
                let segmentBreaks = new Set();
                segmentBreaks.add(Math.ceil(startDepth));
                segmentBreaks.add(endDepth);

                // 모든 샘플 깊이 수집
                if (borehole.soil_data && Array.isArray(borehole.soil_data)) {
                    borehole.soil_data.forEach(layer => {
                        if (layer.samples && Array.isArray(layer.samples)) {
                            layer.samples.forEach(sample => {
                                const sampleDepth = parseFloat(sample.Depth);
                                if (!isNaN(sampleDepth) && sampleDepth >= startDepth && sampleDepth <= endDepth) {
                                    segmentBreaks.add(sampleDepth);
                                }
                            });
                        }
                        // 레이어 경계도 추가
                        const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (depthMatch) {
                            const layerFrom = parseFloat(depthMatch[1]);
                            const layerTo = parseFloat(depthMatch[2]);
                            if (layerFrom >= startDepth && layerFrom <= endDepth) segmentBreaks.add(layerFrom);
                            if (layerTo >= startDepth && layerTo <= endDepth) segmentBreaks.add(layerTo);
                        }
                    });
                }

                // 정렬된 분할점 배열
                const sortedBreaks = Array.from(segmentBreaks).sort((a, b) => a - b);

                // 각 구간별로 계산
                for (let i = 0; i < sortedBreaks.length - 1; i++) {
                    const segmentFrom = sortedBreaks[i];
                    const segmentTo = sortedBreaks[i + 1];
                    const segmentThickness = segmentTo - segmentFrom;

                    if (segmentThickness <= 0) continue;

                    // 구간 중간 깊이에서 N값 조회
                    const midDepth = (segmentFrom + segmentTo) / 2;
                    let N = getNValueAtDepth(borehole, midDepth);

                    // 해당 깊이의 토층 찾기
                    const currentLayer = findLayerAtDepth(borehole, midDepth);
                    const layerName = currentLayer ? currentLayer.soil_name : '원지반';

                    // 사용자 정의 매개변수가 있는 경우 적용
                    let customCu = null;
                    let customParams = null;
                    let paramSource = null;

                    // 1. 깊이 범위 기반 검색 (가장 정확한 방법)
                    if (borehole._customLayerList && borehole._customLayerList.length > 0) {
                        for (const layer of borehole._customLayerList) {
                            // midDepth가 레이어의 깊이 범위 내에 있는지 확인
                            if (midDepth >= layer.depthFrom && midDepth < layer.depthTo) {
                                customParams = layer;
                                paramSource = `깊이범위(${layer.depthFrom.toFixed(1)}~${layer.depthTo.toFixed(1)}m, ${layer.layerName})`;
                                break;
                            }
                        }
                    }

                    // 2. 토층명별 커스텀 파라미터 확인 (보조)
                    if (!customParams && borehole._customParams && borehole._customParams[layerName]) {
                        customParams = borehole._customParams[layerName];
                        paramSource = `토층명(${layerName})`;
                    }

                    // 커스텀 파라미터 적용
                    if (customParams) {
                        if (customParams.N !== undefined && customParams.N > 0) {
                            N = customParams.N;  // 사용자 정의 N값 사용
                        }
                        if (customParams.cu !== undefined && customParams.cu > 0) {
                            customCu = customParams.cu;  // 사용자 정의 cu 사용
                        }
                        // 디버깅용 로그 (각 구간별)
                        console.log(`[계산] ${borehole.hole_no} 깊이${midDepth.toFixed(1)}m - ${paramSource}, N=${N}, cu=${customCu || '없음'}`);
                    }

                    // 주면마찰응력 계산 (구조물기초설계기준해설 p.302)
                    // 사질토: Qs = βs × Ns × As (βs = 2.0)
                    // 점성토: Qs = βc × Nc × Ac (βc = 6.25)
                    // 항상 DOM에서 최신 값을 읽어옴 (입력 검토 탭에서 설정한 값)
                    const betaSand = parseFloat(document.getElementById('betaSand')?.value) || 2.0;
                    const betaClay = parseFloat(document.getElementById('betaClay')?.value) || 6.25;

                    // N값 상한 50 적용
                    const cappedN = Math.min(N, 50);

                    // 토층 분류 판정 - 토질 분류 엔진 사용
                    const classResult = classifySoilBehavior(layerName);
                    const behavior = classResult.behavior;

                    // 사용자가 입력 검토 탭에서 수동 분류한 경우 해당 값 사용
                    let actualBehavior = behavior;
                    if (soilLayerStatistics[layerName] && soilLayerStatistics[layerName].behavior) {
                        actualBehavior = soilLayerStatistics[layerName].behavior;
                    }

                    let fs = 0;
                    let soilType = '';
                    if (actualBehavior === 'cohesive') {
                        // 점성토: fs = βc × N (구조물기초설계기준해설)
                        fs = betaClay * cappedN;
                        soilType = 'clay';
                    } else if (actualBehavior === 'sandy') {
                        // 사질토: fs = βs × N (구조물기초설계기준해설)
                        fs = betaSand * cappedN;
                        soilType = 'sand';
                    } else if (actualBehavior === 'rock') {
                        // 암반 - 주면마찰력 별도 기준 (여기서는 사질토 기준 적용)
                        fs = betaSand * cappedN;
                        soilType = 'rock';
                    } else {
                        // 알 수 없는 경우 - 보수적으로 점성토 계수 적용
                        fs = betaClay * cappedN;
                        soilType = 'unknown';
                    }

                    // 시공방법 보정계수 적용
                    fs *= methodFactor;

                    // 주면 면적 및 주면마찰력
                    const As = Math.PI * D * segmentThickness;
                    const segmentQs = fs * As;
                    Qs += segmentQs;

                    // 해당 깊이의 샘플 정보 찾기
                    let sampleInfo = null;
                    if (currentLayer && currentLayer.samples) {
                        const matchingSample = currentLayer.samples.find(s =>
                            Math.abs(parseFloat(s.Depth) - midDepth) < 0.5 ||
                            (parseFloat(s.Depth) >= segmentFrom && parseFloat(s.Depth) <= segmentTo)
                        );
                        if (matchingSample) {
                            sampleInfo = {
                                sampleNo: matchingSample.Sample_number,
                                depth: matchingSample.Depth,
                                hits: matchingSample.Hits
                            };
                        }
                    }

                    skinFrictionDetails.push({
                        depth: `${segmentFrom.toFixed(1)}-${segmentTo.toFixed(1)}`,
                        layer: layerName,
                        soilType: soilType,  // 'sand' or 'clay'
                        thickness: segmentThickness,
                        N: cappedN,
                        fs: fs,
                        As: As,
                        Qs: segmentQs,
                        sampleInfo: sampleInfo  // 샘플 정보 추가
                    });
                }
                
                // Calculate end bearing (구조물기초설계기준해설 p.302)
                // Qp = α × N × Ap (선단지지력)
                // N = (N1 + N2) / 2 ≤ 50
                // N1: 선단 N치, N2: 선단 위 4D 범위 평균 N치
                const Ap = Math.PI * D * D / 4;

                // N1: 선단 위치의 N값
                const N1_raw = getNValueAtDepth(borehole, pileTipDepth);
                const N1 = Math.min(N1_raw, 50);

                // N2: 선단 위 4D 범위의 평균 N값
                const range4D = 4 * D;
                const startDepth4D = Math.max(0, pileTipDepth - range4D);
                let N2_sum = 0;
                let N2_count = 0;
                for (let d = startDepth4D; d < pileTipDepth; d += 0.5) {
                    const nVal = getNValueAtDepth(borehole, d);
                    if (nVal > 0) {
                        N2_sum += Math.min(nVal, 50);
                        N2_count++;
                    }
                }
                const N2 = N2_count > 0 ? N2_sum / N2_count : N1;

                // 설계 N값: (N1 + N2) / 2, 상한 50
                const tipN = Math.min((N1 + N2) / 2, 50);

                // 선단지지력 계수 - 입력 검토 탭에서 설정한 값 사용 (endBearingAlpha)
                const endBearingCoeff = parseFloat(document.getElementById('endBearingAlpha')?.value) ||
                                        parseFloat(document.getElementById('endBearingCoefficient')?.value) || 250;
                const qp = endBearingCoeff * tipN; // kPa (구조물기초설계기준해설: α × N)
                const Qp = qp * Ap;

                // 디버깅: 선단지지력 계산 정보
                console.log(`[선단지지력] ${borehole.hole_no}: 선단깊이=${pileTipDepth.toFixed(2)}m, 선단지지고=EL.${pileTipLevel.toFixed(2)}m`);
                console.log(`[선단지지력] ${borehole.hole_no}: N1=${N1.toFixed(1)}, N2=${N2.toFixed(1)}, N=(N1+N2)/2=${tipN.toFixed(1)}, α=${endBearingCoeff}`);
                console.log(`[선단지지력] ${borehole.hole_no}: 지지층=${bearingLayer?.soil_name || '미확인'}, qp=${qp.toFixed(0)}kPa, Qp=${Qp.toFixed(1)}kN`);
                
                // Ultimate and allowable capacity - 전역 설계 파라미터 사용
                const Qu = Qs + Qp;
                const FSv = globalDesignParameters.formulaCoeffs?.sfCompression ||
                            parseFloat(document.getElementById('sfVertical').value) || 3.0;
                const Qa_soil = Qu / FSv;
                
                // Calculate splice reduction based on number of joints
                // ============================================================
                // 말뚝 재료의 허용연직지지력 (구조물기초설계기준해설 p.281)
                // Qp = (1 - μ1/100 - μ2/100) × Qap
                // μ1: 장경비(L/d)에 의한 감소율
                // μ2: 이음에 의한 감소율
                // ============================================================

                // 1. 장경비 검토 (μ1)
                const slendernessRatio = pileLength / D; // L/d
                const slendernessLimits = {
                    'RC': { n: 70, upper: 90 },
                    'PC': { n: 80, upper: 105 },
                    'PHC': { n: 85, upper: 110 },
                    'steel': { n: 100, upper: 130 },
                    'cast_in_place': { n: 60, upper: 80 }
                };
                const pileCategory = pile.type === 'steel' ? 'steel' : 'PHC';
                const slendernessLimit = slendernessLimits[pileCategory] || { n: 85, upper: 110 };

                let mu1 = 0.0; // 장경비 감소율 (%)
                let slendernessCheck = 'OK';
                if (slendernessRatio > slendernessLimit.upper) {
                    slendernessCheck = 'NG (상한초과)';
                    mu1 = 0; // 상한 초과 시 사용 불가하지만 일단 0으로 처리
                } else if (slendernessRatio > slendernessLimit.n) {
                    // n 초과 시 감소율 적용 (간략화: 초과분에 비례)
                    mu1 = (slendernessRatio - slendernessLimit.n) * 0.5; // 초과 1당 0.5% 감소 (간략화)
                }

                // 2. 이음 감소율 (μ2)
                const spliceMethod = document.getElementById('spliceMethod').value;
                const PILE_UNIT_LENGTH = 15.0; // 말뚝 한 본당 길이 (m)
                const numberOfSplices = Math.floor(pileLength / PILE_UNIT_LENGTH); // 이음 개소 수

                let mu2 = 0.0; // 이음 감소율 (%)
                let spliceDetails = []; // 이음별 감소율 상세

                if (spliceMethod !== 'none' && numberOfSplices > 0) {
                    if (spliceMethod === 'welding') {
                        // 용접이음: 개소당 5%
                        mu2 = numberOfSplices * 5.0;
                        spliceDetails = Array(numberOfSplices).fill(5.0);
                    } else if (spliceMethod === 'bolting') {
                        // 볼트식이음: 개소당 10%
                        mu2 = numberOfSplices * 10.0;
                        spliceDetails = Array(numberOfSplices).fill(10.0);
                    } else if (spliceMethod === 'filled') {
                        // 충전식이음: 최초 2개소 20%/개소, 3개소째 30%/개소
                        for (let i = 0; i < numberOfSplices; i++) {
                            const reductionPerSplice = i < 2 ? 20.0 : 30.0;
                            mu2 += reductionPerSplice;
                            spliceDetails.push(reductionPerSplice);
                        }
                    }
                }

                // 3. 총 감소율 및 재료 허용지지력 계산
                // Qp = (1 - μ1/100 - μ2/100) × Qap
                const totalReduction = Math.min(mu1 + mu2, 100.0); // 최대 100% 제한
                const materialFactor = 1.0 - (totalReduction / 100.0);
                const spliceReductionRate = mu2; // 기존 호환용
                const spliceFactor = materialFactor; // 기존 호환용

                const Qa_material = pile.allowable * materialFactor;
                const Qa = Math.min(Qa_soil, Qa_material);

                // 디버깅 로그
                console.log(`[재료지지력] ${borehole.hole_no}: L/d=${slendernessRatio.toFixed(1)}, n=${slendernessLimit.n}, μ1=${mu1.toFixed(1)}%, μ2=${mu2.toFixed(1)}%`);
                console.log(`[재료지지력] ${borehole.hole_no}: Qap=${pile.allowable}kN, 감소율=${totalReduction.toFixed(1)}%, Qp_material=${Qa_material.toFixed(1)}kN`);
                
                // ============================================================
                // Settlement calculation (Vesic 3성분 합산법, 구조물 기초 설계 기준)
                // 구조물기초설계기준 해설 p.8~9 기준
                // ============================================================
                const Q = Qa; // 설계하중 (허용지지력 사용)

                // 1. 하중 분담비 산정 (선단:주면)
                const Ra_total = Qa_soil; // 지반 허용지지력 (허용 선단 + 허용 주면)
                const Rp = Qp / FSv; // 허용 선단지지력
                const Rf = Qs / FSv; // 허용 주면마찰력
                const tipRatio = (Rp + Rf) > 0 ? Rp / (Rp + Rf) : 0.5;
                const shaftRatio = 1 - tipRatio;

                // 선단/주면 전달하중 (설계하중 × 분담율)
                const Qps = Q * tipRatio; // 선단 전달 하중 (kN)
                const Qfs = Q * shaftRatio; // 주면 전달 하중 (kN)

                // 2. 말뚝 탄성계수 (구조물 기초 설계기준 해설 표 5.3.10)
                let Ep; // kN/m² (말뚝 탄성계수)
                if (pile.type === 'steel') {
                    Ep = PILE_ELASTIC_MODULUS.STEEL.E_kPa; // 2.00×10⁸ kN/m²
                } else {
                    Ep = PILE_ELASTIC_MODULUS.PHC.E_kPa; // 3.92×10⁷ kN/m²
                }

                // 3. 침하량 계수 가져오기 (입력 검토 탭에서 설정된 값)
                const settlementCoeffs = getSettlementCoefficients();
                const alpha_s = settlementCoeffs.alphaS; // 주면마찰력 분포계수 (0.5~0.67)
                const Cp = settlementCoeffs.Cp; // 경험계수 (시공법/지반조건별)

                // 4. 총단면적 (Gross Area) - 침하량 계산 시 사용
                const grossArea = Math.PI * D * D / 4; // 총단면적 (m²)
                const netArea = pile.area; // 순단면적 (m²)

                // 5. 극한 선단지지력도 (qp) - 총단면적 기준
                // qp = Qpu / Ag (극한 선단지지력 / 총단면적)
                const Qpu = Qp; // 극한 선단지지력 (kN)
                const qp_settlement = Qpu / grossArea; // kN/m²

                // ============================================================
                // Ss: 말뚝 자체의 탄성압축
                // Ss = (Qps + αs × Qfs) × L / (Ap × Ep)
                // ============================================================
                const L_mm = pileLength * 1000; // mm 단위
                const Ss = ((Qps + alpha_s * Qfs) * L_mm) / (netArea * Ep); // mm

                // ============================================================
                // Sp: 선단하중에 의한 침하
                // Sp = (Qps × Cp) / (B × qp)
                // B = 말뚝 직경 (m), qp = 극한 선단지지력도 (kN/m²)
                // ============================================================
                const B = D; // 말뚝 직경 (m)
                const Sp = qp_settlement > 0 ? (Qps * Cp) / (B * qp_settlement) * 1000 : 0; // mm

                // ============================================================
                // Sps: 주면마찰력에 의한 침하 (Vesic 변형식)
                // Cs = (0.93 + 0.16 × √(Lp/B)) × Cp
                // Sps = (Qfs × Cs) / (Lp × qp)
                // ============================================================
                const Lp = pileLength; // 근입길이 (m)
                const Cs = (0.93 + 0.16 * Math.sqrt(Lp / B)) * Cp;
                const Sps = qp_settlement > 0 ? (Qfs * Cs) / (Lp * qp_settlement) * 1000 : 0; // mm

                // ============================================================
                // 총 침하량 (St = Ss + Sp + Sps)
                // ============================================================
                const Sc = 0; // 압밀침하 (암반 지지 시 무시)
                const St = Ss + Sp + Sps + Sc;

                // 디버깅용 로그 (침하량 상세)
                console.log(`[침하량] ${borehole.hole_no}: tipRatio=${tipRatio.toFixed(2)}, Qps=${Qps.toFixed(1)}kN, Qfs=${Qfs.toFixed(1)}kN`);
                console.log(`[침하량] αs=${alpha_s}, Cp=${Cp}, qp=${qp_settlement.toFixed(0)}kN/m², 허용침하=${settlementCoeffs.allowableSettlement}mm`);
                console.log(`[침하량] Ss=${Ss.toFixed(2)}mm, Sp=${Sp.toFixed(2)}mm, Sps=${Sps.toFixed(2)}mm, St=${St.toFixed(2)}mm`);

                // 기존 변수명 호환을 위해 Se 유지
                const Se = Ss;

                // Calculate settlement check (getSettlementCoefficients에서 이미 가져온 값 사용)
                const allowableSettlement = settlementCoeffs.allowableSettlement;
                const settlementCheck = St <= allowableSettlement ? 'PASS' : 'FAIL';
                
                // ============================================================
                // Horizontal Bearing Capacity Calculation
                // ============================================================
                const horizontalResult = calculateHorizontalCapacity(borehole, pile, pileLength, D);
                
                // ============================================================
                // Uplift Resistance Calculation
                // ============================================================
                const upliftResult = calculateUpliftCapacity(borehole, pile, pileLength, D, Qs, Qp, Qu, originalElevation, pileTipLevel);
                
                return {
                    borehole: borehole.hole_no || 'Unknown',
                    elevation: originalElevation || 0,
                    excavation: pileStartLevel || 0,
                    pileLength: pileLength || 0,
                    pileTipLevel: pileTipLevel || 0,
                    pileTipDepth: pileTipDepth || 0,
                    // 선단 N값 상세 (구조물기초설계기준해설)
                    N1: N1 || 0,
                    N2: N2 || 0,
                    tipN: tipN || 0,
                    qp: qp || 0,
                    Qs: Qs || 0,
                    Qp: Qp || 0,
                    Qu: Qu || 0,
                    endBearingCoeff: endBearingCoeff,
                    Qa: Qa || 0,
                    Qa_soil: Qa_soil || 0,
                    Qa_material: Qa_material || 0,
                    Se: Se || 0,
                    Ss: Ss || 0,
                    Sp: Sp || 0,
                    Sps: Sps || 0,
                    Sc: Sc || 0,
                    St: St || 0,
                    skinFrictionDetails: skinFrictionDetails,
                    bearingLayer: bearingLayer,
                    groundMod: groundMod,
                    fillHeight: fillHeight,
                    excavationDepth: excavationDepth,
                    settlementCheck: settlementCheck,
                    horizontalCapacity: horizontalResult,
                    upliftCapacity: upliftResult,
                    spliceMethod: spliceMethod,
                    numberOfSplices: numberOfSplices,
                    spliceReductionRate: spliceReductionRate,
                    spliceDetails: spliceDetails,
                    spliceFactor: spliceFactor,
                    // 장경비 검토 (구조물기초설계기준해설)
                    slendernessRatio: slendernessRatio,
                    slendernessLimit: slendernessLimit,
                    slendernessCheck: slendernessCheck,
                    mu1: mu1,
                    mu2: mu2,
                    hasCustomTipLevel: borehole._customPileTipLevel !== undefined
                };
            } catch (error) {
                console.error('Calculation error for', borehole.hole_no, ':', error);
                return createDefaultResult(borehole.hole_no);
            }
        }

        // ============================================================
        // Horizontal Bearing Capacity Calculation
        // ============================================================
        function calculateHorizontalCapacity(borehole, pile, pileLength, D) {
            try {
                // 1. Calculate horizontal subgrade reaction coefficient (kh)
                // Based on soil conditions and N-values
                const khResult = calculateKh(borehole, pileLength);
                const kh = khResult.value;

                // 2. Get pile properties
                // 구조물 기초 설계기준 해설 표 5.3.10 기준
                let E, I, EI;
                const t = pile.thickness || 0.08; // 말뚝 두께 (m)
                const d_inner = pile.diameter - 2 * t; // 내경
                if (pile.type === 'steel') {
                    // 강관말뚝: 2.00×10⁸ kN/m²
                    E = PILE_ELASTIC_MODULUS.STEEL.E_kPa;
                    I = pile.I; // Already calculated
                } else {
                    // PC 및 PHC 말뚝: 3.92×10⁷ kN/m²
                    E = PILE_ELASTIC_MODULUS.PHC.E_kPa;
                    I = pile.I; // From PHC_PILES database
                }
                EI = E * I; // kN·m²

                // 3. Chang's Method
                const changResult = calculateChangMethod(kh, D, E, I, pileLength);

                // 4. Broms' Method
                const bromsResult = calculateBromsMethod(pile, D, pileLength);

                // 5. Final horizontal capacity (minimum of two methods)
                const Ha_final = Math.min(changResult.Ha, bromsResult.Ha);

                return {
                    kh: kh,
                    khDetail: khResult, // kh 상세 정보 추가
                    E: E,
                    I: I,
                    EI: EI,
                    thickness: t,
                    innerDiameter: d_inner,
                    chang: changResult,
                    broms: bromsResult,
                    Ha_final: Ha_final
                };
            } catch (error) {
                console.error('Horizontal capacity calculation error:', error);
                return {
                    kh: 0,
                    khDetail: null,
                    E: 0,
                    I: 0,
                    EI: 0,
                    thickness: 0,
                    innerDiameter: 0,
                    chang: { beta: 0, Ha: 0 },
                    broms: { My: 0, Hu: 0, Ha: 0 },
                    Ha_final: 0
                };
            }
        }

        // Calculate horizontal subgrade reaction coefficient (kh)
        // KDS 도로교설계기준 유도식 적용
        function calculateKh(borehole, pileLength) {
            // Get average N-value in the upper portion of pile (typically 0-5m depth)
            let sumN = 0;
            let countN = 0;
            const depthLimit = Math.min(5.0, pileLength);

            for (let depth = 0; depth < depthLimit; depth += 0.5) {
                const N = getNValueAtDepth(borehole, depth);
                if (N > 0) {
                    sumN += N;
                    countN++;
                }
            }

            const avgN = countN > 0 ? sumN / countN : 15;

            // Check soil type in upper layers
            const upperLayer = findLayerAtDepth(borehole, 2.0);
            const isCohesive = upperLayer && (upperLayer.soil_name.includes('점토') || upperLayer.soil_name.includes('실트'));
            const isWeathered = upperLayer && (upperLayer.soil_name.includes('풍화') || avgN >= 30);

            // E0 산정 (지반변형계수) - KDS 기준
            // 일반토사: E0 = 700 × N, 풍화암/조밀토: E0 = 2800 × N
            let E0;
            if (isWeathered || avgN >= 30) {
                E0 = 2800 * avgN; // kN/m² (풍화암 또는 조밀한 지반)
            } else {
                E0 = 700 * avgN; // kN/m² (일반 토사)
            }

            // 참고식 적용 (도로교 유도식 간략화)
            // 점성토: 후쿠오카식 kh = 6910 × N^0.406
            // 사질토: 요코야마식 kh = 2000 × N
            let kh_calculated;
            let method;
            let formula;
            if (isCohesive) {
                // 후쿠오카식 (점성토)
                kh_calculated = 6910 * Math.pow(avgN, 0.406); // kN/m³
                method = '후쿠오카식 (점성토)';
                formula = `6910 × N^0.406 = 6910 × ${avgN.toFixed(1)}^0.406`;
            } else {
                // 요코야마식 (사질토)
                kh_calculated = 2000 * avgN; // kN/m³
                method = '요코야마식 (사질토)';
                formula = `2000 × N = 2000 × ${avgN.toFixed(1)}`;
            }

            // Apply minimum value (typically 10,000 kN/m³)
            const kh_min = 10000;
            const kh_final = Math.max(kh_calculated, kh_min);

            // 상세 정보 반환
            return {
                value: kh_final,
                avgN: avgN,
                depthLimit: depthLimit,
                isCohesive: isCohesive,
                method: method,
                formula: formula,
                kh_calculated: kh_calculated,
                kh_min: kh_min,
                upperLayerName: upperLayer ? upperLayer.soil_name : '불명'
            };
        }

        // Chang's Method for horizontal capacity
        function calculateChangMethod(kh, D, E, I, L) {
            // Characteristic value (beta)
            const beta = Math.pow((kh * D) / (4 * E * I), 0.25); // m⁻¹
            
            // Allowable displacement (Y)
            const Y = parseFloat(document.getElementById('allowableLateralDisplacement').value) || 1.5; // cm
            const Y_m = Y / 100; // Convert to meters
            
            // Safety factor
            const FSh = parseFloat(document.getElementById('sfHorizontal').value) || 2.0;
            
            // Check if long pile (beta * L > 2.5)
            const betaL = beta * L;
            const isLongPile = betaL > 2.5;
            
            // Horizontal capacity (Chang's formula)
            // For long pile: Ha = (2 * sqrt(EI * kh * D) * Y) / FSh
            const Ha = (2 * Math.sqrt(E * I * kh * D) * Y_m) / FSh; // kN
            
            return {
                beta: beta,
                betaL: betaL,
                isLongPile: isLongPile,
                Y: Y,
                Ha: Ha
            };
        }

        // Broms' Method for horizontal capacity
        function calculateBromsMethod(pile, D, L) {
            // Safety factor
            const FSh = parseFloat(document.getElementById('sfHorizontal').value) || 2.0;
            
            let My, Hu, Ha;
            
            if (pile.type === 'steel') {
                // Steel pipe pile
                const mat = STEEL_PIPE_SPECS.materials[pile.material];
                const sigma_y = mat ? mat.yieldStrength : 235; // MPa
                const sigma_y_kPa = sigma_y * 1000; // Convert to kPa
                
                // Plastic section modulus (Zp) for circular hollow section
                // Zp = (4/3) * (R³ - r³) where R = D/2, r = d/2
                const d = D - 2 * pile.thickness;
                const R = D / 2;
                const r = d / 2;
                const Zp = (4 / 3) * (Math.pow(R, 3) - Math.pow(r, 3)); // m³
                
                // Yield moment
                My = Zp * sigma_y_kPa; // kN·m
            } else {
                // PHC pile
                // Plastic section modulus for PHC (circular hollow section)
                // Zp = (4/3) * (R³ - r³) where R = D/2, r = d/2
                const t = pile.thickness;
                const d = D - 2 * t;
                const R = D / 2;
                const r = d / 2;
                const Zp = (4 / 3) * (Math.pow(R, 3) - Math.pow(r, 3)); // m³
                
                // PHC concrete yield strength (typically 20 MPa = 20,000 kPa)
                const sigma_y_kPa = 20000; // kPa
                
                // Yield moment
                My = Zp * sigma_y_kPa; // kN·m
            }
            
            // Ultimate horizontal capacity (Broms' method for long pile in cohesionless soil)
            // Hu = 9 * My / (gamma * D^3 * Kp)
            // Simplified: Hu = 9 * My / (gamma * D^3)
            // For typical soil: gamma = 18 kN/m³, Kp ≈ 3
            const gamma = 18; // kN/m³
            const Kp = 3; // Passive earth pressure coefficient
            Hu = (9 * My) / (gamma * Math.pow(D, 3) * Kp); // kN
            
            // Allowable horizontal capacity
            Ha = Hu / FSh; // kN
            
            return {
                My: My,
                Hu: Hu,
                Ha: Ha
            };
        }

        // ============================================================
        // Uplift Resistance Calculation
        // ============================================================
        function calculateUpliftCapacity(borehole, pile, pileLength, D, Qs, Qp, Qu, originalElevation, pileTipLevel) {
            try {
                // 1. Get groundwater level
                // Parse groundwater level using helper function
                let gwlElevation = null;
                const gwlString = borehole.metadata?.GROUND_WATER_LEVEL || '';
                
                if (gwlString) {
                    // Use parsed value if available (from normalization)
                    if (borehole.metadata._GROUND_WATER_LEVEL_PARSED !== undefined) {
                        const gwlDepth = borehole.metadata._GROUND_WATER_LEVEL_PARSED;
                        // gwlDepth is negative depth from ground level
                        gwlElevation = originalElevation + gwlDepth;
                    } else {
                        // Fallback: parse directly
                        const gwlDepth = parseGroundwaterLevel(gwlString);
                        if (gwlDepth !== null) {
                            gwlElevation = originalElevation + gwlDepth;
                        }
                    }
                }
                
                // If no GWL data, assume no groundwater
                if (gwlElevation === null) {
                    gwlElevation = pileTipLevel - 100; // Very deep, no effect
                }
                
                // 2. Calculate lengths (l1: above water, l2: below water)
                const pileTopElevation = originalElevation; // Pile top is at original ground level
                const pileTipElevation = pileTipLevel;
                
                // l2 = length below groundwater level
                const l2 = Math.max(0, gwlElevation - pileTipElevation);
                const l1 = pileLength - l2;
                
                // 3. Calculate pile unit weight
                let unitWeightPile; // kN/m
                if (pile.type === 'steel') {
                    // Steel pipe: weight = area * density
                    unitWeightPile = pile.area * 7.85 * 9.81; // t/m³ * m² * 9.81 = kN/m
                } else {
                    // PHC pile: typically 2.5-2.8 kN/m (depends on size)
                    // Use approximate value based on diameter
                    const unitWeights = {
                        0.4: 1.75,
                        0.45: 2.20,
                        0.5: 2.74,
                        0.6: 3.95
                    };
                    unitWeightPile = unitWeights[D] || 2.74; // Default for 500mm
                }
                
                // 4. Calculate effective weight (Wp)
                const gamma_w = 10.0; // kN/m³ (water unit weight)
                const weightTotal = unitWeightPile * pileLength; // kN
                const buoyancy = pile.crossArea * l2 * gamma_w; // kN
                const Wp = weightTotal - buoyancy; // kN
                
                // 5. Calculate allowable uplift capacity (KDS 기준)
                // 인발 시 주면마찰력은 압축의 80% 적용 (저감계수 0.8)
                const pulloutReductionFactor = 0.8;
                const Qs_pullout = Qs * pulloutReductionFactor; // Qu에서 Qp 제외 (선단 기여 없음)
                const FSp = parseFloat(document.getElementById('sfPullout').value) || 3.0;
                const Q_pull = (Qs_pullout / FSp) + Wp; // kN
                
                return {
                    gwlElevation: gwlElevation,
                    l1: l1,
                    l2: l2,
                    unitWeightPile: unitWeightPile,
                    weightTotal: weightTotal,
                    buoyancy: buoyancy,
                    Wp: Wp,
                    Qs_pullout: Qs_pullout,
                    pulloutReductionFactor: pulloutReductionFactor,
                    Q_pull: Q_pull
                };
            } catch (error) {
                console.error('Uplift capacity calculation error:', error);
                return {
                    gwlElevation: 0,
                    l1: 0,
                    l2: 0,
                    unitWeightPile: 0,
                    weightTotal: 0,
                    buoyancy: 0,
                    Wp: 0,
                    Q_pull: 0
                };
            }
        }

        function createDefaultResult(boreholeNo) {
            return {
                borehole: boreholeNo || 'Unknown',
                elevation: 0,
                excavation: 0,
                pileLength: 0,
                pileTipLevel: 0,
                pileTipDepth: 0,
                Qs: 0,
                Qp: 0,
                Qu: 0,
                endBearingCoeff: 300,
                Qa: 0,
                Se: 0,
                Ss: 0,
                Sp: 0,
                Sps: 0,
                Sc: 0,
                St: 0,
                skinFrictionDetails: [],
                bearingLayer: null,
                groundMod: 'none',
                fillHeight: 0,
                excavationDepth: 0,
                settlementCheck: 'FAIL',
                horizontalCapacity: {
                    kh: 0,
                    EI: 0,
                    chang: { beta: 0, betaL: 0, isLongPile: false, Y: 1.5, Ha: 0 },
                    broms: { My: 0, Hu: 0, Ha: 0 },
                    Ha_final: 0
                },
                upliftCapacity: {
                    gwlElevation: 0,
                    l1: 0,
                    l2: 0,
                    unitWeightPile: 0,
                    weightTotal: 0,
                    buoyancy: 0,
                    Wp: 0,
                    Q_pull: 0
                }
            };
        }

        // 깊이별 N값 조회 (보간 포함)
        function getNValueAtDepth(borehole, depth) {
            if (!borehole || !borehole.soil_data) return 15;
            
            // 모든 샘플 수집
            let allSamples = [];
            borehole.soil_data.forEach(layer => {
                if (layer.samples && Array.isArray(layer.samples)) {
                    layer.samples.forEach(sample => {
                        if (sample && sample.Depth !== undefined && sample.Hits) {
                            const n = extractNValue(sample.Hits);
                            if (n && n > 0) {
                                allSamples.push({
                                    depth: parseFloat(sample.Depth),
                                    nValue: n,
                                    layer: layer.soil_name
                                });
                            }
                        }
                    });
                }
            });
            
            if (allSamples.length === 0) return 15;
            
            // 깊이순 정렬
            allSamples.sort((a, b) => a.depth - b.depth);
            
            // 정확히 일치하는 샘플 찾기
            const exactMatch = allSamples.find(s => Math.abs(s.depth - depth) < 0.01);
            if (exactMatch) return exactMatch.nValue;
            
            // 선형 보간
            let lower = null, upper = null;
            for (let i = 0; i < allSamples.length; i++) {
                if (allSamples[i].depth <= depth) {
                    lower = allSamples[i];
                }
                if (allSamples[i].depth > depth && !upper) {
                    upper = allSamples[i];
                    break;
                }
            }
            
            if (lower && upper) {
                // 선형 보간
                const ratio = (depth - lower.depth) / (upper.depth - lower.depth);
                return Math.round(lower.nValue + ratio * (upper.nValue - lower.nValue));
            } else if (lower) {
                // 가장 깊은 샘플보다 깊은 경우 → 마지막 샘플 값 사용
                return lower.nValue;
            } else if (upper) {
                // 가장 얕은 샘플보다 얕은 경우 → 첫 샘플 값 사용
                return upper.nValue;
            }
            
            return 15; // fallback
        }
        
        // 레거시 함수 (호환성 유지 - 지층 평균)
        function getAverageN(layer) {
            if (!layer) return 15;
            
            if (!layer.samples || !Array.isArray(layer.samples) || layer.samples.length === 0) {
                // Estimate from layer name
                const soilName = layer.soil_name || '';
                if (soilName.includes('매립')) return 5;
                if (soilName.includes('퇴적')) return 15;
                if (soilName.includes('풍화토')) return 30;
                if (soilName.includes('풍화암')) return 50;
                if (soilName.includes('연암')) return 100;
                return 15;
            }
            
            let sum = 0;
            let count = 0;
            
            layer.samples.forEach(sample => {
                if (!sample) return;
                const n = extractNValue(sample.Hits);
                if (n && n > 0) {
                    sum += n;
                    count++;
                }
            });
            
            return count > 0 ? Math.round(sum / count) : 15;
        }

        function extractNValue(hitsString) {
            if (!hitsString || typeof hitsString !== 'string') return null;
            
            const match = hitsString.match(/(\d+)\/(\d+)/);
            if (!match) return null;
            
            const blows = parseInt(match[1]);
            const penetration = parseInt(match[2]);
            
            if (isNaN(blows) || isNaN(penetration) || penetration <= 0) return null;
            
            let nValue;
            
            if (penetration >= 30) {
                // Rule 2: 30cm 완전 관입 → N값 그대로
                nValue = blows;
            } else {
                // 30cm 미만 관입 → 환산
                if (blows >= 50) {
                    // 50타 도달
                    nValue = Math.round(50 * 30 / penetration);
                } else {
                    // Rule 3: N<50, 환산값 사용
                    nValue = Math.round(blows * 30 / penetration);
                }
            }
            
            // Rule 1: N≥50 → N=50 적용 (Refusal, 상한값)
            return Math.min(nValue, 50);
        }

        function updateSummaryTable() {
            const tbody = document.getElementById('summaryTableBody');
            tbody.innerHTML = '';

            calculationResults.forEach(result => {
                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                row.onclick = () => openDetailModal(result.borehole);

                // Add null checks for all numeric values
                const elevation = result.elevation || 0;
                const excavation = result.excavation || 0;
                const pileLength = result.pileLength || 0;
                const Qa = result.Qa || 0;
                const St = result.St || 0;
                const Ha = result.horizontalCapacity ? result.horizontalCapacity.Ha_final : 0;
                const Qpull = result.upliftCapacity ? result.upliftCapacity.Q_pull : 0;

                const pileTipLevel = result.pileTipLevel || 0;
                // Get groundwater level elevation
                const gwlElevation = result.upliftCapacity ? result.upliftCapacity.gwlElevation : null;
                const gwlDisplay = gwlElevation !== null && gwlElevation > -1000 ? gwlElevation.toFixed(1) : '-';

                // Find corresponding borehole for target elevation
                const boreholeIndex = boreholeData.findIndex(b => b.hole_no === result.borehole);
                const targetElevation = boreholeIndex >= 0 && boreholeData[boreholeIndex]._targetElevation !== undefined
                    ? boreholeData[boreholeIndex]._targetElevation
                    : excavation;

                // 말뚝 길이가 음수이거나 0 이하인 경우 N/A 표시
                const isValidPileLength = pileLength > 0;
                const pileLengthDisplay = isValidPileLength ? pileLength.toFixed(1) : 'N/A';
                const pileTipDisplay = isValidPileLength ? pileTipLevel.toFixed(1) : 'N/A';
                const QaDisplay = isValidPileLength ? Qa.toFixed(0) : 'N/A';
                const StDisplay = isValidPileLength ? St.toFixed(1) : 'N/A';
                const HaDisplay = isValidPileLength ? Ha.toFixed(1) : 'N/A';
                const QpullDisplay = isValidPileLength ? Qpull.toFixed(1) : 'N/A';

                // 유효하지 않은 행은 회색 처리
                const rowStyle = isValidPileLength ? '' : 'background-color: #f5f5f5; color: #999;';

                // Check if custom tip level is set
                const hasCustomTip = boreholeIndex >= 0 && boreholeData[boreholeIndex]._customPileTipLevel !== undefined;
                const tipInputStyle = hasCustomTip ?
                    'width: 80px; padding: 4px; font-size: 0.9rem; text-align: center; background-color: #e3f2fd; border-color: #2196f3;' :
                    'width: 80px; padding: 4px; font-size: 0.9rem; text-align: center;';

                // 선단 지지층 정보 (툴팁용)
                const bearingLayerName = result.bearingLayer ? result.bearingLayer.soil_name : '지지층 미확인';
                const tipN = result.tipN || 0;
                const qp = result.qp || 0;
                const tipTooltip = `지지층: ${bearingLayerName}\\n선단 N값: ${tipN}\\n선단지지력도(qp): ${qp.toFixed(0)} kPa`;

                // 상세 계산 팝업 HTML 생성
                const Qs = result.Qs || 0;
                const Qp = result.Qp || 0;
                const Qu = result.Qu || 0;
                const FSv = parseFloat(document.getElementById('sfVertical')?.value) || 3.0;
                const Qa_soil = Qu / FSv;
                const pile = getCurrentPile();
                const Qa_material = pile.allowable || 0;

                const qaTooltipHTML = isValidPileLength ? `
                    <div class="calc-tooltip-title">허용지지력 (Qa) 계산</div>
                    <div class="calc-tooltip-formula">Qa = min(Qa,soil, Qa,material)</div>
                    <div class="calc-tooltip-step">• Qs (주면마찰력) = ${Qs.toFixed(1)} kN</div>
                    <div class="calc-tooltip-step">• Qp (선단지지력) = ${Qp.toFixed(1)} kN</div>
                    <div class="calc-tooltip-step">• Qu = Qs + Qp = ${Qu.toFixed(1)} kN</div>
                    <div class="calc-tooltip-step">• Qa,soil = Qu / FS = ${Qu.toFixed(1)} / ${FSv} = ${Qa_soil.toFixed(1)} kN</div>
                    <div class="calc-tooltip-step">• Qa,material = ${Qa_material.toFixed(0)} kN</div>
                    <div class="calc-tooltip-result">Qa = min(${Qa_soil.toFixed(1)}, ${Qa_material.toFixed(0)}) = ${Qa.toFixed(0)} kN</div>
                ` : '';

                // 침하량 상세
                const Ss = result.Ss || 0;
                const Sp = result.Sp || 0;
                const Sps = result.Sps || 0;
                const stTooltipHTML = isValidPileLength ? `
                    <div class="calc-tooltip-title">침하량 (St) 계산</div>
                    <div class="calc-tooltip-formula">St = Ss + Sp + Sps</div>
                    <div class="calc-tooltip-step">• Ss (말뚝 탄성압축) = ${Ss.toFixed(2)} mm</div>
                    <div class="calc-tooltip-step">• Sp (선단 침하) = ${Sp.toFixed(2)} mm</div>
                    <div class="calc-tooltip-step">• Sps (주면마찰력 침하) = ${Sps.toFixed(2)} mm</div>
                    <div class="calc-tooltip-result">St = ${Ss.toFixed(2)} + ${Sp.toFixed(2)} + ${Sps.toFixed(2)} = ${St.toFixed(2)} mm</div>
                ` : '';

                // 수평지지력 상세
                const haTooltipHTML = isValidPileLength && result.horizontalCapacity ? `
                    <div class="calc-tooltip-title">수평지지력 (Ha) 계산</div>
                    <div class="calc-tooltip-formula">Ha = min(Chang, Broms)</div>
                    <div class="calc-tooltip-step">• Chang 방법 = ${result.horizontalCapacity.chang?.Ha?.toFixed(1) || '-'} kN</div>
                    <div class="calc-tooltip-step">• Broms 방법 = ${result.horizontalCapacity.broms?.Ha?.toFixed(1) || '-'} kN</div>
                    <div class="calc-tooltip-result">Ha (최종) = ${Ha.toFixed(1)} kN</div>
                ` : '';

                // 인발저항력 상세
                const qpullTooltipHTML = isValidPileLength && result.upliftCapacity ? `
                    <div class="calc-tooltip-title">인발저항력 (Qpull) 계산</div>
                    <div class="calc-tooltip-formula">Qpull = Qs / FSp + Wp</div>
                    <div class="calc-tooltip-step">• Qs (주면마찰력) = ${Qs.toFixed(1)} kN</div>
                    <div class="calc-tooltip-step">• FSp (인발 안전율) = ${result.upliftCapacity.FSp || 3.0}</div>
                    <div class="calc-tooltip-step">• Wp (말뚝 자중) = ${(result.upliftCapacity.Wp || 0).toFixed(1)} kN</div>
                    <div class="calc-tooltip-result">Qpull = ${Qpull.toFixed(1)} kN</div>
                ` : '';

                row.innerHTML = `
                    <td style="font-weight: 600;">${result.borehole}</td>
                    <td>${elevation.toFixed(1)}</td>
                    <td>
                        <input type="number"
                               class="form-input"
                               style="width: 80px; padding: 4px; font-size: 0.9rem; text-align: center;"
                               value="${targetElevation.toFixed(1)}"
                               step="0.1"
                               data-borehole-index="${boreholeIndex}"
                               onclick="event.stopPropagation();"
                               onchange="updateBoreholeTargetElevation(${boreholeIndex}, this.value)">
                    </td>
                    <td>${gwlDisplay}</td>
                    <td style="${!isValidPileLength ? 'color: #c62828; font-weight: 600;' : ''}">${pileLengthDisplay}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 4px;" title="${tipTooltip}">
                            <input type="number"
                                   class="form-input tip-elevation-input"
                                   style="${tipInputStyle}"
                                   value="${pileTipLevel.toFixed(1)}"
                                   step="0.1"
                                   data-borehole-index="${boreholeIndex}"
                                   onclick="event.stopPropagation();"
                                   onchange="updateBoreholeTipElevation(${boreholeIndex}, this.value)"
                                   title="${tipTooltip}">
                            ${hasCustomTip ? '<span style="color: #2196f3; font-size: 0.7rem; cursor: pointer;" onclick="event.stopPropagation(); resetBoreholeTipElevation(' + boreholeIndex + ')" title="기본값으로 복원">↺</span>' : ''}
                        </div>
                    </td>
                    <td class="calc-tooltip" style="font-weight: 600;">
                        ${isValidPileLength ? `<span class="calc-tooltip-trigger">${QaDisplay}</span><div class="calc-tooltip-content">${qaTooltipHTML}</div>` : QaDisplay}
                    </td>
                    <td class="calc-tooltip">
                        ${isValidPileLength ? `<span class="calc-tooltip-trigger">${StDisplay}</span><div class="calc-tooltip-content">${stTooltipHTML}</div>` : StDisplay}
                    </td>
                    <td class="calc-tooltip">
                        ${isValidPileLength ? `<span class="calc-tooltip-trigger">${HaDisplay}</span><div class="calc-tooltip-content">${haTooltipHTML}</div>` : HaDisplay}
                    </td>
                    <td class="calc-tooltip">
                        ${isValidPileLength ? `<span class="calc-tooltip-trigger">${QpullDisplay}</span><div class="calc-tooltip-content">${qpullTooltipHTML}</div>` : QpullDisplay}
                    </td>
                `;

                if (!isValidPileLength) {
                    row.style.backgroundColor = '#fff8f8';
                }

                tbody.appendChild(row);
            });
        }

        function updateCharts() {
            if (!calculationResults || calculationResults.length === 0) return;
            
            // Populate chart borehole select
            const chartSelect = document.getElementById('chartBoreholeSelect');
            chartSelect.innerHTML = '';
            
            boreholeData.forEach((borehole, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = borehole.hole_no;
                if (index === 0) option.selected = true;
                chartSelect.appendChild(option);
            });
            
            // Initial chart rendering
            updateDepthAnalysisCharts();
        }

        // 분석결과 그래프에서 산정 불가 메시지 표시
        function showInvalidChartMessage(result) {
            // 차트 영역 클리어 및 메시지 표시
            const chartCanvas = document.getElementById('depthCapacityChart');
            if (chartCanvas) {
                // 기존 차트 제거
                if (charts.depthCapacity) {
                    charts.depthCapacity.destroy();
                    charts.depthCapacity = null;
                }

                // 차트 컨테이너에 메시지 표시
                const container = chartCanvas.parentElement;
                if (container) {
                    // 캔버스 숨기고 메시지 표시
                    chartCanvas.style.display = 'none';

                    // 기존 메시지 제거
                    const existingMsg = container.querySelector('.invalid-chart-message');
                    if (existingMsg) existingMsg.remove();

                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'invalid-chart-message';
                    msgDiv.innerHTML = `
                        <div style="
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 300px;
                            background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
                            border: 2px dashed #c62828;
                            border-radius: 12px;
                            color: #c62828;
                        ">
                            <div style="font-size: 40px; margin-bottom: 10px;">📊</div>
                            <h4 style="margin: 0 0 10px 0;">말뚝 지지력 산정 불가</h4>
                            <p style="margin: 0; color: #888; font-size: 0.9rem;">
                                ${result.invalidReason || '말뚝 길이가 0 이하로 분석 결과를 표시할 수 없습니다.'}
                            </p>
                        </div>
                    `;
                    container.appendChild(msgDiv);
                }
            }

            // 테이블도 클리어
            const tbody = document.getElementById('depthAnalysisTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; color: #c62828; padding: 40px; background: #fff5f5;">
                            <strong>⚠️ 말뚝 지지력 산정 불가</strong><br>
                            <span style="color: #888; font-size: 0.9rem;">${result.invalidReason || '말뚝 길이가 0 이하입니다.'}</span>
                        </td>
                    </tr>
                `;
            }
        }

        function updateDepthAnalysisCharts() {
            const index = parseInt(document.getElementById('chartBoreholeSelect').value);
            if (isNaN(index) || !boreholeData[index] || !calculationResults[index]) return;

            const borehole = boreholeData[index];
            const result = calculationResults[index];
            document.getElementById('selectedChartTarget').textContent = borehole.hole_no;

            // 말뚝 길이가 0 이하인 경우 - 산정 불가 메시지 표시
            if (result.isInvalid || result.pileLength <= 0) {
                showInvalidChartMessage(result);
                return;
            }

            // 차트 캔버스 다시 표시 (이전에 숨겨졌을 수 있음)
            const chartCanvas = document.getElementById('depthCapacityChart');
            if (chartCanvas) {
                chartCanvas.style.display = 'block';
                const container = chartCanvas.parentElement;
                const existingMsg = container?.querySelector('.invalid-chart-message');
                if (existingMsg) existingMsg.remove();
            }

            // Calculate depth-by-depth data (1m intervals)
            const pile = getCurrentPile();
            const D = pile.diameter;
            const pileLength = result.pileTipDepth || 20;
            const depthData = [];
            
            // Get ground modification info from result
            const groundMod = result.groundMod || 'none';
            const fillHeight = result.fillHeight || 0;
            const excavationDepth = result.excavationDepth || 0;
            const fillN = parseFloat(document.getElementById('fillNValue').value || 8);
            
            // Determine pile start position in original ground coordinates
            let pileStartDepthInGround = 0;
            
            if (groundMod === 'fill') {
                pileStartDepthInGround = -fillHeight; // Negative: pile starts above original ground
            } else if (groundMod === 'excavation') {
                pileStartDepthInGround = excavationDepth; // Positive: pile starts below original ground
            }
            
            let cumulativeFriction = 0;

            // 커스텀 파라미터에서 깊이에 해당하는 값 찾기
            function getCustomParamsAtDepth(depth) {
                if (borehole._customLayerList && borehole._customLayerList.length > 0) {
                    for (const layer of borehole._customLayerList) {
                        if (depth >= layer.depthFrom && depth < layer.depthTo) {
                            return layer;
                        }
                    }
                }
                return null;
            }

            // Start from top of pile (pileDepth=0 is at pile top)
            for (let pileDepth = 0; pileDepth <= Math.ceil(pileLength); pileDepth += 1) {
                const actualDepthInGround = pileStartDepthInGround + pileDepth;

                let currentLayer = null;
                let avgN = 15;
                let layerName = '-';
                let customCu = null;

                // Determine which zone/layer we're in
                if (groundMod === 'fill' && actualDepthInGround < 0) {
                    // Still in fill zone (above original ground)
                    layerName = '성토재';
                    avgN = fillN;

                    // 커스텀 성토재 값 확인 (_customLayerList 우선)
                    const fillCustom = getCustomParamsAtDepth(actualDepthInGround);
                    if (fillCustom && fillCustom.layerName === '성토재') {
                        if (fillCustom.N > 0) avgN = fillCustom.N;
                        if (fillCustom.cu > 0) customCu = fillCustom.cu;
                    } else if (borehole._customParams && borehole._customParams['성토재']) {
                        const customFill = borehole._customParams['성토재'];
                        if (customFill.N > 0) avgN = customFill.N;
                        if (customFill.cu > 0) customCu = customFill.cu;
                    }
                } else {
                    // In original ground (or below for excavation case)
                    currentLayer = findLayerAtDepth(borehole, actualDepthInGround);
                    avgN = currentLayer ? getAverageN(currentLayer) : 15;
                    layerName = currentLayer ? currentLayer.soil_name : '-';

                    // 커스텀 파라미터 확인
                    const customParams = getCustomParamsAtDepth(actualDepthInGround);
                    if (customParams) {
                        if (customParams.N > 0) avgN = customParams.N;
                        if (customParams.cu > 0) customCu = customParams.cu;
                        layerName = customParams.layerName || layerName;
                    } else if (borehole._customParams && borehole._customParams[layerName]) {
                        const customByName = borehole._customParams[layerName];
                        if (customByName.N > 0) avgN = customByName.N;
                        if (customByName.cu > 0) customCu = customByName.cu;
                    }
                }

                // Calculate skin friction stress for this 1m segment
                const As = Math.PI * D * 1.0; // 1m segment
                let fs = 0;

                if (groundMod === 'fill' && actualDepthInGround < 0) {
                    // Fill zone - use 2N method (사질토 기준)
                    fs = Math.min(2 * avgN, 200);
                } else if (currentLayer) {
                    // Original ground
                    if (currentLayer.soil_name.includes('점토') || currentLayer.soil_name.includes('실트')) {
                        const cu = customCu !== null ? customCu : 12 * avgN;
                        const alpha = cu < 25 ? 1.0 : cu < 50 ? 0.9 : cu < 100 ? 0.7 : 0.5;
                        fs = Math.min(alpha * cu, 150);
                    } else {
                        // 사질토: 2N법
                        fs = Math.min(2 * avgN, 200);
                    }
                }

                const method = document.getElementById('constructionMethod').value;
                const methodFactor = method === 'driven' ? 1.0 : 0.7;
                fs *= methodFactor;

                const segmentFriction = fs * As;
                cumulativeFriction += segmentFriction;

                // Calculate end bearing for this depth (only relevant at pile tip)
                const Ap = Math.PI * D * D / 4;
                const endBearingCoeff = parseFloat(document.getElementById('endBearingCoefficient').value) || 300;
                const qp = Math.min(endBearingCoeff * avgN, 10000);
                const Qp = qp * Ap;

                const totalCapacity = cumulativeFriction + Qp;

                depthData.push({
                    depth: actualDepthInGround,
                    pileDepth: pileDepth,
                    layer: layerName,
                    N: avgN,
                    fs: fs,
                    cumulativeFriction: cumulativeFriction,
                    qp: qp,
                    Qp: Qp,
                    total: totalCapacity,
                    isTipAtTarget: Math.abs(actualDepthInGround - pileLength) < 0.5,
                    isInFill: (groundMod === 'fill' && actualDepthInGround < 0),
                    isInExcavation: false // Excavation zone has no pile, so always false here
                });
            }
            
            // Update charts
            updateDepthCapacityChart(depthData);
            updateDepthAnalysisTable(depthData, result);
        }

        function findLayerAtDepth(borehole, depth) {
            if (!borehole.soil_data) return null;
            
            for (let layer of borehole.soil_data) {
                const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                if (depthMatch) {
                    const from = parseFloat(depthMatch[1]);
                    const to = parseFloat(depthMatch[2]);
                    if (depth >= from && depth < to) {
                        return layer;
                    }
                }
            }
            return null;
        }

        function updateDepthCapacityChart(depthData) {
            const ctx = document.getElementById('depthCapacityChart');
            if (!ctx) return;

            if (charts.depthCapacity) charts.depthCapacity.destroy();

            // 지표고 EL 가져오기
            const index = parseInt(document.getElementById('chartBoreholeSelect').value);
            let groundEL = 0;
            if (!isNaN(index) && boreholeData[index]) {
                groundEL = getGroundSurfaceElevation(boreholeData[index].metadata) || 0;
            }

            // 선단지지력과 주면마찰력 최대값 계산 (비율 확인)
            const maxQp = Math.max(...depthData.map(d => d.Qp));
            const maxQs = Math.max(...depthData.map(d => d.cumulativeFriction));
            const ratio = maxQp / (maxQs || 1);

            // 선단지지력이 너무 큰 경우 별도 스케일 사용 여부 결정
            const useDualScale = ratio > 3;

            // 깊이 레이블 생성 (GL과 EL 모두 표시)
            const depthLabels = depthData.map(d => {
                const glValue = d.depth;
                const elValue = groundEL - d.depth;
                if (d.depth < 0) {
                    // 성토 구간
                    return `성토 ${(-d.depth).toFixed(0)}m (EL.${elValue.toFixed(1)})`;
                }
                return `GL-${d.depth.toFixed(0)}m (EL.${elValue.toFixed(1)})`;
            });

            // 선단지지력 스케일 조정 (비율이 너무 큰 경우)
            let adjustedQpData = depthData.map(d => d.Qp);
            let qpLabel = '선단지지력 Qp (kN)';
            if (useDualScale) {
                // 선단지지력을 로그 스케일로 표시하거나 별도 처리
                qpLabel = `선단지지력 Qp (kN) [max=${maxQp.toFixed(0)}]`;
            }

            charts.depthCapacity = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: depthLabels,
                    datasets: [
                        {
                            type: 'bar',
                            label: '누적 주면마찰력 Qs (kN)',
                            data: depthData.map(d => d.cumulativeFriction),
                            backgroundColor: 'rgba(46, 125, 50, 0.7)',
                            borderColor: 'rgba(46, 125, 50, 1)',
                            borderWidth: 1,
                            order: 2,
                            stack: 'capacity'
                        },
                        {
                            type: 'bar',
                            label: qpLabel,
                            data: adjustedQpData,
                            backgroundColor: 'rgba(30, 58, 95, 0.7)',
                            borderColor: 'rgba(30, 58, 95, 1)',
                            borderWidth: 1,
                            order: 2,
                            stack: 'endBearing'
                        },
                        {
                            type: 'line',
                            label: '총 극한지지력 Qu (kN)',
                            data: depthData.map(d => d.total),
                            borderColor: 'rgba(198, 40, 40, 1)',
                            backgroundColor: 'rgba(198, 40, 40, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.3,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointBackgroundColor: 'rgba(198, 40, 40, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            order: 1
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: '지지력 (kN)',
                                font: { weight: 'bold', size: 12 }
                            },
                            beginAtZero: true,
                            stacked: false,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: '말뚝 깊이 (GL)',
                                font: { weight: 'bold', size: 12 }
                            },
                            stacked: false,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(30, 58, 95, 0.95)',
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 12,
                            callbacks: {
                                title: function(context) {
                                    const dataIndex = context[0].dataIndex;
                                    const dataPoint = depthData[dataIndex];
                                    const elValue = groundEL - dataPoint.depth;
                                    if (dataPoint.depth < 0) {
                                        return `성토 구간: ${(-dataPoint.depth).toFixed(1)}m (EL.${elValue.toFixed(2)}m)`;
                                    }
                                    return `심도: GL-${dataPoint.depth.toFixed(1)}m (EL.${elValue.toFixed(2)}m)`;
                                },
                                afterLabel: function(context) {
                                    const dataIndex = context.dataIndex;
                                    const dataPoint = depthData[dataIndex];
                                    if (dataPoint) {
                                        return [
                                            `지층: ${dataPoint.layer}`,
                                            `N값: ${dataPoint.N}`,
                                            `주면마찰응력 fs: ${dataPoint.fs.toFixed(1)} kPa`
                                        ];
                                    }
                                    return '';
                                }
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 11 },
                                usePointStyle: true,
                                padding: 15
                            }
                        }
                    }
                }
            });
        }

        function updateDepthAnalysisTable(depthData, result) {
            const tbody = document.getElementById('depthAnalysisTableBody');
            tbody.innerHTML = '';

            // 지표고 EL 가져오기
            const index = parseInt(document.getElementById('chartBoreholeSelect').value);
            let groundEL = 0;
            if (!isNaN(index) && boreholeData[index]) {
                groundEL = getGroundSurfaceElevation(boreholeData[index].metadata) || 0;
            }

            depthData.forEach(data => {
                const row = document.createElement('tr');
                if (data.isTipAtTarget) {
                    row.style.backgroundColor = 'rgba(46, 125, 50, 0.15)';
                    row.style.fontWeight = '600';
                }

                // Highlight fill zone with different color
                if (data.depth < 0) {
                    row.style.backgroundColor = 'rgba(139, 115, 85, 0.15)';
                }

                // GL과 EL 값 계산
                const elValue = groundEL - data.depth;
                let depthLabel;
                if (data.depth < 0) {
                    depthLabel = `성토 ${(-data.depth).toFixed(1)}m`;
                } else {
                    depthLabel = `GL-${data.depth.toFixed(1)}m`;
                }
                const elLabel = `EL.${elValue.toFixed(2)}m`;

                row.innerHTML = `
                    <td>${depthLabel}<br><small style="color:#666;">${elLabel}</small></td>
                    <td>${data.layer}</td>
                    <td>${data.N}</td>
                    <td>${data.fs.toFixed(1)}</td>
                    <td>${data.cumulativeFriction.toFixed(0)}</td>
                    <td>${data.qp.toFixed(0)}</td>
                    <td>${data.Qp.toFixed(0)}</td>
                    <td style="font-weight: 600; color: #1e3a5f;">${data.total.toFixed(0)}</td>
                    <td>${data.isTipAtTarget ? '<span style="color: var(--status-pass); font-weight:bold;">● 말뚝선단</span>' : ''}</td>
                `;
                tbody.appendChild(row);
            });
        }

        function updateComparisonCharts() {
            // Update chart titles
            document.getElementById('capacityChartTitle').textContent = '전체 시추공 지지력 구성 비교';
            document.getElementById('settlementChartTitle').textContent = '전체 시추공 침하량 구성 비교';
            document.getElementById('safetyChartTitle').textContent = '전체 시추공 안전율 검증';
            document.getElementById('nValueChartTitle').textContent = '시추공별 평균 N값 비교';
            document.getElementById('frictionChartTitle').textContent = '시추공별 마찰력 기여도 비교';
            document.getElementById('loadSettlementChartTitle').textContent = '시추공별 Load-Settlement Curves';
            
            // 1. Bearing Capacity Comparison Chart (개선됨)
            const ctx1 = document.getElementById('capacityChart');
            if (ctx1) {
                const chartCtx = ctx1.getContext('2d');
                if (charts.capacity) charts.capacity.destroy();

                // 선단지지력과 주면마찰력 비율 계산
                const qsValues = calculationResults.map(r => r.Qs || 0);
                const qpValues = calculationResults.map(r => r.Qp || 0);
                const totalValues = calculationResults.map(r => (r.Qs || 0) + (r.Qp || 0));
                const maxTotal = Math.max(...totalValues);

                // 비율 표시용 데이터 계산
                const qsRatios = calculationResults.map((r, i) => {
                    const total = (r.Qs || 0) + (r.Qp || 0);
                    return total > 0 ? ((r.Qs || 0) / total * 100).toFixed(1) : 0;
                });

                charts.capacity = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: calculationResults.map(r => r.borehole),
                        datasets: [
                            {
                                label: '주면마찰력 Qs (kN)',
                                data: qsValues,
                                backgroundColor: 'rgba(46, 125, 50, 0.75)',
                                borderColor: '#2e7d32',
                                borderWidth: 1
                            },
                            {
                                label: '선단지지력 Qp (kN)',
                                data: qpValues,
                                backgroundColor: 'rgba(30, 58, 95, 0.75)',
                                borderColor: '#1e3a5f',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: { display: false },
                            legend: {
                                position: 'bottom',
                                labels: {
                                    font: { size: 11 },
                                    usePointStyle: true
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(30, 58, 95, 0.95)',
                                callbacks: {
                                    afterBody: function(context) {
                                        const idx = context[0].dataIndex;
                                        const r = calculationResults[idx];
                                        const total = (r.Qs || 0) + (r.Qp || 0);
                                        const qsRatio = total > 0 ? ((r.Qs || 0) / total * 100).toFixed(1) : 0;
                                        const qpRatio = total > 0 ? ((r.Qp || 0) / total * 100).toFixed(1) : 0;
                                        return [
                                            '',
                                            `총 극한지지력: ${total.toFixed(0)} kN`,
                                            `주면마찰력 비율: ${qsRatio}%`,
                                            `선단지지력 비율: ${qpRatio}%`
                                        ];
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                title: {
                                    display: true,
                                    text: '시추공',
                                    font: { weight: 'bold' }
                                }
                            },
                            y: {
                                stacked: true,
                                title: {
                                    display: true,
                                    text: '극한지지력 Qu (kN)',
                                    font: { weight: 'bold' }
                                },
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        }
                    }
                });
            }
            
            // 2. Settlement Comparison Chart
            const ctx2 = document.getElementById('settlementChart');
            if (ctx2) {
                const chartCtx = ctx2.getContext('2d');
                if (charts.settlement) charts.settlement.destroy();
                
                charts.settlement = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: calculationResults.map(r => r.borehole),
                        datasets: [
                            {
                                label: '탄성침하 (Se)',
                                data: calculationResults.map(r => r.Se || 0),
                                backgroundColor: 'rgba(54, 162, 235, 0.7)'
                            },
                            {
                                label: '선단침하 (Sp)',
                                data: calculationResults.map(r => (r.Sp || 0) - (r.Se || 0)),
                                backgroundColor: 'rgba(255, 206, 86, 0.7)'
                            },
                            {
                                label: '압밀침하 (Sc)',
                                data: calculationResults.map(r => r.Sc || 0),
                                backgroundColor: 'rgba(255, 99, 132, 0.7)'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { stacked: true },
                            y: { 
                                stacked: true,
                                title: { display: true, text: '침하량 (mm)' }
                            }
                        }
                    }
                });
            }
            
            // 3. Safety Factor Chart
            const ctx3 = document.getElementById('safetyChart');
            if (ctx3) {
                const chartCtx = ctx3.getContext('2d');
                if (charts.safety) charts.safety.destroy();
                
                const FSv = parseFloat(document.getElementById('sfVertical').value) || 3.0;
                
                charts.safety = new Chart(chartCtx, {
                    type: 'line',
                    data: {
                        labels: calculationResults.map(r => r.borehole),
                        datasets: [
                            {
                                label: '실제 안전율',
                                data: calculationResults.map(r => r.actualFS || 0),
                                borderColor: '#1e3a5f',
                                backgroundColor: 'rgba(30, 58, 95, 0.1)',
                                borderWidth: 2,
                                pointRadius: 5,
                                tension: 0.2
                            },
                            {
                                label: '요구 안전율',
                                data: calculationResults.map(() => FSv),
                                borderColor: '#c62828',
                                borderDash: [5, 5],
                                borderWidth: 2,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                            y: {
                                title: { display: true, text: '안전율' },
                                min: 0
                            }
                        }
                    }
                });
            }
            
            // 4. Average N-value Comparison
            const ctx4 = document.getElementById('nValueChart');
            if (ctx4) {
                const chartCtx = ctx4.getContext('2d');
                if (charts.nValue) charts.nValue.destroy();
                
                // Calculate average N-values for each borehole
                const avgNValues = boreholeData.map(borehole => {
                    let totalN = 0;
                    let count = 0;
                    if (borehole.soil_data) {
                        borehole.soil_data.forEach(layer => {
                            const avgN = getAverageN(layer);
                            if (avgN > 0) {
                                totalN += avgN;
                                count++;
                            }
                        });
                    }
                    return count > 0 ? totalN / count : 0;
                });
                
                charts.nValue = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: boreholeData.map(b => b.hole_no),
                        datasets: [{
                            label: '평균 N값',
                            data: avgNValues,
                            backgroundColor: 'rgba(44, 78, 126, 0.7)',
                            borderColor: '#2c4e7e',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                title: { display: true, text: 'N값' },
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
            
            // 5. Friction Contribution Comparison
            const ctx5 = document.getElementById('frictionChart');
            if (ctx5) {
                const chartCtx = ctx5.getContext('2d');
                if (charts.friction) charts.friction.destroy();
                
                const frictionRatios = calculationResults.map(r => {
                    const total = (r.Qu || 1);
                    return {
                        friction: ((r.Qs || 0) / total * 100),
                        bearing: ((r.Qp || 0) / total * 100)
                    };
                });
                
                charts.friction = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: calculationResults.map(r => r.borehole),
                        datasets: [
                            {
                                label: '주면마찰 비율 (%)',
                                data: frictionRatios.map(r => r.friction),
                                backgroundColor: 'rgba(44, 78, 126, 0.7)'
                            },
                            {
                                label: '선단지지 비율 (%)',
                                data: frictionRatios.map(r => r.bearing),
                                backgroundColor: 'rgba(46, 125, 50, 0.7)'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { stacked: true },
                            y: {
                                stacked: true,
                                title: { display: true, text: '기여도 (%)' },
                                max: 100
                            }
                        }
                    }
                });
            }
            
            // 6. Load-Settlement Curves
            const ctx6 = document.getElementById('loadSettlementChart');
            if (ctx6) {
                const chartCtx = ctx6.getContext('2d');
                if (charts.loadSettlement) charts.loadSettlement.destroy();
                
                const datasets = calculationResults.map((result, index) => {
                    const loads = [];
                    const settlements = [];
                    const maxLoad = result.Qu || 2000;
                    
                    for (let i = 0; i <= 20; i++) {
                        const load = (maxLoad / 20) * i;
                        loads.push(load);
                        const s = (load / maxLoad) * 25 / (1 + (load / maxLoad));
                        settlements.push(s);
                    }
                    
                    return {
                        label: result.borehole,
                        data: loads.map((load, i) => ({ x: load, y: settlements[i] })),
                        borderColor: `hsl(${index * 60}, 70%, 50%)`,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        showLine: true,
                        pointRadius: 0
                    };
                });
                
                charts.loadSettlement = new Chart(chartCtx, {
                    type: 'scatter',
                    data: { datasets: datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                type: 'linear',
                                title: { display: true, text: '하중 (kN)' }
                            },
                            y: {
                                title: { display: true, text: '침하량 (mm)' }
                            }
                        }
                    }
                });
            }
        }

        function updateIndividualCharts(borehole, result) {
            const boreholeNo = borehole.hole_no;
            
            // Update chart titles
            document.getElementById('capacityChartTitle').textContent = `${boreholeNo} 지지력 구성`;
            document.getElementById('settlementChartTitle').textContent = `${boreholeNo} 침하량 구성`;
            document.getElementById('safetyChartTitle').textContent = `${boreholeNo} 하중-안전율 관계`;
            document.getElementById('nValueChartTitle').textContent = `${boreholeNo} 깊이별 N값 분포`;
            document.getElementById('frictionChartTitle').textContent = `${boreholeNo} 층별 마찰력 기여도`;
            document.getElementById('loadSettlementChartTitle').textContent = `${boreholeNo} Load-Settlement Curve`;
            
            // 1. Individual Bearing Capacity
            const ctx1 = document.getElementById('capacityChart');
            if (ctx1) {
                const chartCtx = ctx1.getContext('2d');
                if (charts.capacity) charts.capacity.destroy();
                
                charts.capacity = new Chart(chartCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['주면마찰력 (Qs)', '선단지지력 (Qp)'],
                        datasets: [{
                            data: [result.Qs || 0, result.Qp || 0],
                            backgroundColor: [
                                'rgba(44, 78, 126, 0.7)',
                                'rgba(46, 125, 50, 0.7)'
                            ],
                            borderColor: ['#2c4e7e', '#2e7d32'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.raw;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${context.label}: ${value.toFixed(0)} kN (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // 2. N-value Distribution with Depth
            const ctx2 = document.getElementById('nValueChart');
            if (ctx2) {
                const chartCtx = ctx2.getContext('2d');
                if (charts.nValue) charts.nValue.destroy();
                
                const depths = [];
                const nValues = [];
                const colors = [];
                
                if (borehole.soil_data) {
                    borehole.soil_data.forEach(layer => {
                        const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (depthMatch) {
                            const depthFrom = parseFloat(depthMatch[1]);
                            const depthTo = parseFloat(depthMatch[2]);
                            const midDepth = (depthFrom + depthTo) / 2;
                            const avgN = getAverageN(layer);
                            
                            depths.push(-midDepth); // Negative for downward
                            nValues.push(avgN);
                            
                            // Color based on N-value
                            if (avgN < 10) colors.push('rgba(255, 99, 132, 0.7)');
                            else if (avgN < 30) colors.push('rgba(255, 206, 86, 0.7)');
                            else if (avgN < 50) colors.push('rgba(54, 162, 235, 0.7)');
                            else colors.push('rgba(46, 125, 50, 0.7)');
                        }
                    });
                }
                
                charts.nValue = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: depths.map(d => `${Math.abs(d).toFixed(1)}m`),
                        datasets: [{
                            label: 'N값',
                            data: nValues,
                            backgroundColor: colors,
                            borderColor: colors.map(c => c.replace('0.7', '1')),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                title: { display: true, text: 'N값' },
                                beginAtZero: true
                            },
                            y: {
                                title: { display: true, text: '깊이' },
                                reverse: false
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
            
            // 3. Layer Friction Contribution
            const ctx3 = document.getElementById('frictionChart');
            if (ctx3) {
                const chartCtx = ctx3.getContext('2d');
                if (charts.friction) charts.friction.destroy();
                
                if (result.skinFrictionDetails && result.skinFrictionDetails.length > 0) {
                    const labels = result.skinFrictionDetails.map(d => `${d.depth}m\n${d.layer}`);
                    const data = result.skinFrictionDetails.map(d => d.Qs || 0);
                    
                    charts.friction = new Chart(chartCtx, {
                        type: 'pie',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: data,
                                backgroundColor: [
                                    'rgba(255, 99, 132, 0.7)',
                                    'rgba(54, 162, 235, 0.7)',
                                    'rgba(255, 206, 86, 0.7)',
                                    'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)'
                                ],
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'right' },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            const value = context.raw;
                                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                            return `${value.toFixed(1)} kN (${percentage}%)`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                } else {
                    // Show empty state
                    charts.friction = new Chart(chartCtx, {
                        type: 'bar',
                        data: { labels: ['No Data'], datasets: [] },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false
                        }
                    });
                }
            }
            
            // 4. Settlement Components
            const ctx4 = document.getElementById('settlementChart');
            if (ctx4) {
                const chartCtx = ctx4.getContext('2d');
                if (charts.settlement) charts.settlement.destroy();
                
                charts.settlement = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Ss(탄성압축)', 'Sp(선단침하)', 'Sps(주면침하)', 'St(총침하)'],
                        datasets: [{
                            label: '침하량 (mm)',
                            data: [
                                result.Ss || 0,
                                result.Sp || 0,
                                result.Sps || 0,
                                result.St || 0
                            ],
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(75, 192, 192, 0.7)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                title: { display: true, text: '침하량 (mm)' },
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
            
            // 5. Safety Factor vs Load
            const ctx5 = document.getElementById('safetyChart');
            if (ctx5) {
                const chartCtx = ctx5.getContext('2d');
                if (charts.safety) charts.safety.destroy();
                
                const loads = [];
                const safetyFactors = [];
                const Qu = result.Qu || 2000;
                
                for (let load = 100; load <= Qu; load += 100) {
                    loads.push(load);
                    safetyFactors.push(Qu / load);
                }
                
                charts.safety = new Chart(chartCtx, {
                    type: 'line',
                    data: {
                        labels: loads,
                        datasets: [{
                            label: '안전율',
                            data: safetyFactors,
                            borderColor: '#1e3a5f',
                            backgroundColor: 'rgba(30, 58, 95, 0.1)',
                            borderWidth: 2,
                            tension: 0.2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                title: { display: true, text: '작용하중 (kN)' }
                            },
                            y: {
                                title: { display: true, text: '안전율' },
                                min: 0
                            }
                        }
                    }
                });
            }
            
            // 6. Load-Settlement Curve
            const ctx6 = document.getElementById('loadSettlementChart');
            if (ctx6) {
                const chartCtx = ctx6.getContext('2d');
                if (charts.loadSettlement) charts.loadSettlement.destroy();
                
                const loads = [];
                const settlements = [];
                const maxLoad = result.Qu || 2000;
                
                for (let i = 0; i <= 40; i++) {
                    const load = (maxLoad / 40) * i;
                    loads.push(load);
                    const s = (load / maxLoad) * 25 / (1 + (load / maxLoad));
                    settlements.push(s);
                }
                
                charts.loadSettlement = new Chart(chartCtx, {
                    type: 'line',
                    data: {
                        labels: loads.map(l => l.toFixed(0)),
                        datasets: [{
                            label: 'Load-Settlement',
                            data: settlements,
                            borderColor: '#2c4e7e',
                            backgroundColor: 'rgba(44, 78, 126, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                title: { display: true, text: '하중 (kN)' }
                            },
                            y: {
                                title: { display: true, text: '침하량 (mm)' }
                            }
                        }
                    }
                });
            }
        }

        function updateSummaryCards() {
            if (!calculationResults || calculationResults.length === 0) return;
            
            // Average pile length
            const avgLength = calculationResults.reduce((sum, r) => sum + (r.pileLength || 0), 0) / calculationResults.length;
            document.getElementById('avgPileLength').textContent = avgLength.toFixed(1);
            
            // Average capacity
            const avgCapacity = calculationResults.reduce((sum, r) => sum + (r.Qa || 0), 0) / calculationResults.length;
            document.getElementById('avgCapacity').textContent = avgCapacity.toFixed(0);
            
            // Min capacity with borehole info
            const validCapacities = calculationResults.filter(r => r.Qa > 0);
            if (validCapacities.length > 0) {
                const minCapacityResult = validCapacities.reduce((min, r) => (r.Qa < min.Qa ? r : min), validCapacities[0]);
                document.getElementById('minCapacity').textContent = minCapacityResult.Qa.toFixed(0);
                document.getElementById('minCapacityBorehole').textContent = `시추공: ${minCapacityResult.borehole}`;
            } else {
                document.getElementById('minCapacity').textContent = '-';
                document.getElementById('minCapacityBorehole').textContent = '-';
            }
            
            // Max settlement with borehole info
            const maxSettlementResult = calculationResults.reduce((max, r) => (r.St > max.St ? r : max), calculationResults[0]);
            const maxSettlement = maxSettlementResult.St || 0;
            document.getElementById('maxSettlement').textContent = maxSettlement.toFixed(1);
            const maxSettlementBoreholeEl = document.getElementById('maxSettlementBorehole');
            if (maxSettlementBoreholeEl) {
                maxSettlementBoreholeEl.textContent = `시추공: ${maxSettlementResult.borehole}`;
            }
            
            // Min horizontal capacity with borehole info
            const validHorizontal = calculationResults.filter(r => r.horizontalCapacity && r.horizontalCapacity.Ha_final > 0);
            if (validHorizontal.length > 0) {
                const minHorizontalResult = validHorizontal.reduce((min, r) => 
                    (r.horizontalCapacity.Ha_final < min.horizontalCapacity.Ha_final ? r : min), validHorizontal[0]);
                document.getElementById('minHorizontal').textContent = minHorizontalResult.horizontalCapacity.Ha_final.toFixed(1);
                document.getElementById('minHorizontalBorehole').textContent = `시추공: ${minHorizontalResult.borehole}`;
            } else {
                document.getElementById('minHorizontal').textContent = '-';
                document.getElementById('minHorizontalBorehole').textContent = '-';
            }
        }

        // N값 포인트 저장 배열 (툴팁용)
        let nValuePoints = [];

        function drawBorehole() {
            const index = document.getElementById('boreholeSelect').value;
            if (index === '') return;

            selectedBorehole = boreholeData[index];
            if (!selectedBorehole) return;

            const canvas = document.getElementById('boreholeCanvas');
            const ctx = canvas.getContext('2d');

            // 캔버스 크기 확장 (더 많은 정보 표시)
            canvas.width = 1200;
            canvas.height = 750;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // N값 포인트 초기화
            nValuePoints = [];

            // ============================================================
            // 레이아웃 설정 (전문가용 확장 레이아웃)
            // ============================================================
            const layout = {
                margin: { left: 120, top: 100, right: 50, bottom: 80 },
                depthColumn: { width: 100 },      // 깊이/EL 표시 영역
                boreholeColumn: { width: 180 },   // 시추주상도 영역
                nValueColumn: { width: 180 },     // N값 그래프 영역
                capacityColumn: { width: 200 },   // 지지력 그래프 영역
                infoPanel: { width: 280 }         // 정보 패널 영역
            };

            const startX = layout.margin.left;
            const startY = layout.margin.top;
            const boreholeX = startX + layout.depthColumn.width;
            const nValueX = boreholeX + layout.boreholeColumn.width + 20;
            const capacityX = nValueX + layout.nValueColumn.width + 30;

            // ============================================================
            // 기본 데이터 수집
            // ============================================================
            const originalElevation = getGroundSurfaceElevation(selectedBorehole.metadata) || 0;

            // 시추공별 계획고 사용 (수정된 부분)
            let targetElevation = selectedBorehole._targetElevation;
            if (targetElevation === undefined || isNaN(targetElevation)) {
                const targetInput = document.getElementById('targetGroundElevation');
                targetElevation = targetInput ? parseFloat(targetInput.value) : originalElevation;
                if (isNaN(targetElevation)) targetElevation = originalElevation;
            }

            // 계산 결과 가져오기
            const result = calculationResults.find(r => r.borehole === selectedBorehole.hole_no);

            // 자동 스케일 계산
            let actualMaxDepth = 0;
            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach(layer => {
                    if (layer && layer.depth_range) {
                        const depthMatch = layer.depth_range.match(/([\d.]+)~([\d.]+)m/);
                        if (depthMatch) {
                            const depthTo = parseFloat(depthMatch[2]) || 0;
                            if (depthTo > actualMaxDepth) actualMaxDepth = depthTo;
                        }
                    }
                });
            }

            // 말뚝 선단까지 표시되도록 깊이 확장
            if (result && result.pileTipDepth) {
                actualMaxDepth = Math.max(actualMaxDepth, result.pileTipDepth + 2);
            }

            const minDisplayDepth = 10;
            const maxDisplayDepth = 35;
            const displayDepth = Math.max(minDisplayDepth, Math.min(actualMaxDepth + 3, maxDisplayDepth));
            const availableHeight = canvas.height - startY - layout.margin.bottom;
            const scale = Math.min(25, Math.max(12, availableHeight / displayDepth));
            const maxDepth = displayDepth;

            // ============================================================
            // 헤더 영역 그리기
            // ============================================================
            // 배경 그라데이션
            const headerGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            headerGradient.addColorStop(0, '#1e3a5f');
            headerGradient.addColorStop(1, '#2c5282');
            ctx.fillStyle = headerGradient;
            ctx.fillRect(0, 0, canvas.width, 70);

            // 제목
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`시추주상도 및 말뚝 설계 현황`, 20, 30);

            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#90caf9';
            ctx.fillText(`${selectedBorehole.hole_no || 'Unknown'}`, 20, 55);

            // 프로젝트 정보
            ctx.font = '12px Arial';
            ctx.fillStyle = '#b0bec5';
            ctx.textAlign = 'right';
            const projectName = selectedBorehole.metadata?.PROJECT_NAME || '';
            if (projectName) {
                ctx.fillText(projectName.substring(0, 40), canvas.width - 20, 30);
            }
            ctx.fillText(`지표고: EL.${originalElevation.toFixed(2)}m | 계획고: EL.${targetElevation.toFixed(2)}m`, canvas.width - 20, 50);

            // ============================================================
            // 컬럼 헤더
            // ============================================================
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 70, canvas.width, 25);

            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#1e3a5f';
            ctx.textAlign = 'center';
            ctx.fillText('깊이(GL) / 표고(EL)', startX + layout.depthColumn.width/2, 86);
            ctx.fillText('시추주상도', boreholeX + layout.boreholeColumn.width/2, 86);
            ctx.fillText('N값 (타격횟수)', nValueX + layout.nValueColumn.width/2, 86);
            ctx.fillText('누적 지지력 (kN)', capacityX + layout.capacityColumn.width/2, 86);

            // ============================================================
            // 깊이 눈금 및 EL 표기 (좌측)
            // ============================================================
            ctx.strokeStyle = '#dee2e6';
            ctx.lineWidth = 1;

            for (let depth = 0; depth <= maxDepth; depth += 2) {
                const y = startY + depth * scale;
                const el = originalElevation - depth;

                // 눈금선
                ctx.beginPath();
                ctx.moveTo(startX, y);
                ctx.lineTo(startX + layout.depthColumn.width - 10, y);
                ctx.stroke();

                // 깊이 표시 (GL)
                ctx.font = '10px Arial';
                ctx.fillStyle = '#495057';
                ctx.textAlign = 'right';
                ctx.fillText(`GL-${depth.toFixed(0)}m`, startX + 45, y + 4);

                // EL 표시
                ctx.fillStyle = '#1976d2';
                ctx.fillText(`EL.${el.toFixed(1)}`, startX + layout.depthColumn.width - 15, y + 4);
            }

            // ============================================================
            // 지층 그리기 (시추주상도)
            // ============================================================
            const layerColors = {
                '매립': { fill: '#8B7355', stroke: '#5D4E37', pattern: 'dots' },
                '붕적': { fill: '#C4A484', stroke: '#8B7355', pattern: 'diagonal' },
                '퇴적': { fill: '#D2B48C', stroke: '#A08060', pattern: 'horizontal' },
                '충적': { fill: '#DEB887', stroke: '#B8956B', pattern: 'horizontal' },
                '풍화잔류토': { fill: '#E8C872', stroke: '#B89B4A', pattern: 'dots' },
                '풍화토': { fill: '#DEB887', stroke: '#B8956B', pattern: 'dots' },
                '풍화암': { fill: '#BDB76B', stroke: '#8B864E', pattern: 'brick' },
                '연암': { fill: '#A9A9A9', stroke: '#808080', pattern: 'cross' },
                '경암': { fill: '#808080', stroke: '#606060', pattern: 'solid' },
                'default': { fill: '#E0E0E0', stroke: '#9E9E9E', pattern: 'none' }
            };

            let bearingLayerY = null; // 지지층 시작 위치 저장

            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach((layer, layerIndex) => {
                    if (!layer || !layer.depth_range) return;

                    const depthMatch = layer.depth_range.match(/([\d.]+)~([\d.]+)m/);
                    if (!depthMatch) return;

                    const depthFrom = parseFloat(depthMatch[1]) || 0;
                    const depthTo = Math.min(parseFloat(depthMatch[2]) || 0, maxDepth);
                    const thickness = (depthTo - depthFrom) * scale;

                    if (thickness <= 0) return;

                    const layerY = startY + depthFrom * scale;
                    const soilName = layer.soil_name || '';

                    // 색상 결정
                    let colorInfo = layerColors.default;
                    for (const [key, value] of Object.entries(layerColors)) {
                        if (soilName.includes(key)) {
                            colorInfo = value;
                            break;
                        }
                    }

                    // 지지층 여부 확인 (풍화암, 연암)
                    const isBearingLayer = soilName.includes('풍화암') || soilName.includes('연암');
                    if (isBearingLayer && bearingLayerY === null) {
                        bearingLayerY = layerY;
                    }

                    // 지층 사각형
                    ctx.fillStyle = colorInfo.fill;
                    ctx.fillRect(boreholeX, layerY, layout.boreholeColumn.width, thickness);

                    // 지지층 강조 (두꺼운 테두리)
                    if (isBearingLayer) {
                        ctx.strokeStyle = '#c62828';
                        ctx.lineWidth = 3;
                        ctx.setLineDash([]);
                    } else {
                        ctx.strokeStyle = colorInfo.stroke;
                        ctx.lineWidth = 1;
                    }
                    ctx.strokeRect(boreholeX, layerY, layout.boreholeColumn.width, thickness);

                    // 지층명 표시 (주상도 내부)
                    ctx.fillStyle = '#212529';
                    ctx.font = thickness > 30 ? 'bold 11px Arial' : '10px Arial';
                    ctx.textAlign = 'center';
                    const nameY = layerY + thickness / 2 + 4;
                    ctx.fillText(soilName, boreholeX + layout.boreholeColumn.width / 2, nameY);

                    // 깊이 범위 표시 (지층 옆)
                    ctx.font = '9px Arial';
                    ctx.fillStyle = '#666';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${depthFrom.toFixed(1)}~${depthTo.toFixed(1)}m`, boreholeX + layout.boreholeColumn.width + 5, nameY);
                });
            }

            // ============================================================
            // N값 그래프 그리기
            // ============================================================
            // N값 축 배경
            ctx.fillStyle = 'rgba(66, 165, 245, 0.05)';
            ctx.fillRect(nValueX, startY, layout.nValueColumn.width, maxDepth * scale);

            // N값 눈금 (0, 25, 50)
            ctx.strokeStyle = '#90caf9';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 2]);
            [0, 25, 50].forEach((n, i) => {
                const x = nValueX + (n / 50) * (layout.nValueColumn.width - 20);
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, startY + maxDepth * scale);
                ctx.stroke();

                ctx.font = '9px Arial';
                ctx.fillStyle = '#1976d2';
                ctx.textAlign = 'center';
                ctx.fillText(n.toString(), x, startY - 5);
            });
            ctx.setLineDash([]);

            // N값 바 및 포인트 그리기
            const nValueData = [];
            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach(layer => {
                    if (layer.samples && Array.isArray(layer.samples)) {
                        layer.samples.forEach(sample => {
                            if (!sample || sample.Depth > maxDepth) return;
                            const nValue = extractNValue(sample.Hits);
                            if (nValue) {
                                nValueData.push({
                                    depth: sample.Depth,
                                    nValue: nValue,
                                    layer: layer.soil_name
                                });
                            }
                        });
                    }
                });
            }

            // N값 연결선
            if (nValueData.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = '#1976d2';
                ctx.lineWidth = 2;
                nValueData.forEach((data, i) => {
                    const x = nValueX + (Math.min(data.nValue, 50) / 50) * (layout.nValueColumn.width - 20);
                    const y = startY + data.depth * scale;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
            }

            // N값 포인트 및 바
            nValueData.forEach(data => {
                const x = nValueX + (Math.min(data.nValue, 50) / 50) * (layout.nValueColumn.width - 20);
                const y = startY + data.depth * scale;
                const barWidth = (Math.min(data.nValue, 50) / 50) * (layout.nValueColumn.width - 20);

                // N값 바
                ctx.fillStyle = data.nValue >= 50 ? 'rgba(198, 40, 40, 0.3)' : 'rgba(25, 118, 210, 0.2)';
                ctx.fillRect(nValueX, y - 4, barWidth, 8);

                // N값 포인트
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = data.nValue >= 50 ? '#c62828' : '#1976d2';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // N값 텍스트
                ctx.font = data.nValue >= 50 ? 'bold 9px Arial' : '9px Arial';
                ctx.fillStyle = data.nValue >= 50 ? '#c62828' : '#1e3a5f';
                ctx.textAlign = 'left';
                ctx.fillText(data.nValue.toString(), x + 8, y + 3);

                // 툴팁용 포인트 저장
                nValuePoints.push({
                    x: x,
                    y: y,
                    radius: 8,
                    depth: data.depth,
                    nValue: data.nValue,
                    layer: data.layer,
                    elevation: originalElevation - data.depth
                });
            });

            // ============================================================
            // 누적 지지력 그래프 그리기
            // ============================================================
            if (result && result.skinFrictionDetails && result.skinFrictionDetails.length > 0) {
                // 지지력 축 배경
                ctx.fillStyle = 'rgba(76, 175, 80, 0.05)';
                ctx.fillRect(capacityX, startY, layout.capacityColumn.width, maxDepth * scale);

                // 최대 지지력 (스케일용)
                const maxCapacity = result.Qu || 3000;
                const capacityScale = (layout.capacityColumn.width - 30) / maxCapacity;

                // 지지력 눈금
                ctx.strokeStyle = '#81c784';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([2, 2]);
                const capacityTicks = [0, Math.round(maxCapacity/3), Math.round(maxCapacity*2/3), Math.round(maxCapacity)];
                capacityTicks.forEach(cap => {
                    const x = capacityX + cap * capacityScale;
                    ctx.beginPath();
                    ctx.moveTo(x, startY);
                    ctx.lineTo(x, startY + maxDepth * scale);
                    ctx.stroke();

                    ctx.font = '9px Arial';
                    ctx.fillStyle = '#2e7d32';
                    ctx.textAlign = 'center';
                    ctx.fillText(cap.toString(), x, startY - 5);
                });
                ctx.setLineDash([]);

                // 누적 주면마찰력 그래프
                let cumulativeQs = 0;
                const capacityPoints = [];

                result.skinFrictionDetails.forEach(detail => {
                    const depthMatch = detail.depth.match(/([\d.]+)/);
                    if (depthMatch) {
                        const depth = parseFloat(depthMatch[1]);
                        cumulativeQs += detail.Qs || 0;
                        capacityPoints.push({ depth, capacity: cumulativeQs, type: 'skin' });
                    }
                });

                // 선단지지력 추가
                if (result.pileTipDepth) {
                    capacityPoints.push({
                        depth: result.pileTipDepth,
                        capacity: cumulativeQs + (result.Qp || 0),
                        type: 'tip'
                    });
                }

                // 누적 지지력 영역 채우기
                if (capacityPoints.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(capacityX, startY);
                    capacityPoints.forEach(point => {
                        const x = capacityX + point.capacity * capacityScale;
                        const y = startY + point.depth * scale;
                        ctx.lineTo(x, y);
                    });
                    ctx.lineTo(capacityX, startY + capacityPoints[capacityPoints.length-1].depth * scale);
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
                    ctx.fill();

                    // 누적 지지력 선
                    ctx.beginPath();
                    ctx.strokeStyle = '#2e7d32';
                    ctx.lineWidth = 2;
                    ctx.moveTo(capacityX, startY);
                    capacityPoints.forEach(point => {
                        const x = capacityX + point.capacity * capacityScale;
                        const y = startY + point.depth * scale;
                        ctx.lineTo(x, y);
                    });
                    ctx.stroke();

                    // 포인트 표시
                    capacityPoints.forEach(point => {
                        const x = capacityX + point.capacity * capacityScale;
                        const y = startY + point.depth * scale;

                        ctx.beginPath();
                        ctx.arc(x, y, 4, 0, Math.PI * 2);
                        ctx.fillStyle = point.type === 'tip' ? '#c62828' : '#2e7d32';
                        ctx.fill();
                    });
                }
            }

            // ============================================================
            // 계획고 및 작업면 표시 (수정된 부분)
            // ============================================================
            const elevationDiff = targetElevation - originalElevation;
            let workSurfaceY = startY;
            let workSurfaceDepth = 0;

            if (Math.abs(elevationDiff) > 0.01) {
                if (elevationDiff > 0) {
                    // 성토
                    workSurfaceDepth = -elevationDiff; // 음수 (지표면 위)
                    workSurfaceY = startY + workSurfaceDepth * scale;

                    // 성토 영역
                    ctx.fillStyle = 'rgba(139, 115, 85, 0.3)';
                    ctx.fillRect(boreholeX, workSurfaceY, layout.boreholeColumn.width, Math.abs(workSurfaceDepth) * scale);

                    // 성토 라벨
                    ctx.fillStyle = '#5D4037';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`성토 ${elevationDiff.toFixed(1)}m`, boreholeX + layout.boreholeColumn.width/2, workSurfaceY + Math.abs(workSurfaceDepth) * scale / 2 + 4);
                } else {
                    // 절토
                    workSurfaceDepth = Math.abs(elevationDiff);
                    workSurfaceY = startY + workSurfaceDepth * scale;

                    // 절토 영역 (해칭)
                    ctx.fillStyle = 'rgba(198, 40, 40, 0.1)';
                    ctx.fillRect(boreholeX, startY, layout.boreholeColumn.width, workSurfaceDepth * scale);

                    // 절토 라벨
                    ctx.fillStyle = '#c62828';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`절토 ${Math.abs(elevationDiff).toFixed(1)}m`, boreholeX + layout.boreholeColumn.width/2, startY + workSurfaceDepth * scale / 2 + 4);
                }

                // 계획고(작업면) 라인
                ctx.strokeStyle = '#e65100';
                ctx.lineWidth = 3;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(boreholeX - 30, workSurfaceY);
                ctx.lineTo(boreholeX + layout.boreholeColumn.width + 30, workSurfaceY);
                ctx.stroke();

                // 계획고 라벨 (좌측)
                ctx.fillStyle = '#e65100';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(`계획고 EL.${targetElevation.toFixed(2)}m`, boreholeX - 35, workSurfaceY + 4);

                // 원지반 라인 (점선)
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(boreholeX - 20, startY);
                ctx.lineTo(boreholeX + layout.boreholeColumn.width + 20, startY);
                ctx.stroke();
                ctx.setLineDash([]);

            } else {
                // 원지반 = 계획고
                workSurfaceY = startY;
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(boreholeX - 30, startY);
                ctx.lineTo(boreholeX + layout.boreholeColumn.width + 30, startY);
                ctx.stroke();

                ctx.fillStyle = '#1e3a5f';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(`지표고=계획고 EL.${originalElevation.toFixed(2)}m`, boreholeX - 35, startY + 4);
            }

            // ============================================================
            // 말뚝 그리기 (선단지지고 포함)
            // ============================================================
            if (result && result.pileLength > 0) {
                const pile = getCurrentPile();
                const pileX = boreholeX + layout.boreholeColumn.width / 2;
                const pileWidth = 35;
                const pileStartY = workSurfaceY;
                const pileEndY = pileStartY + result.pileLength * scale;
                const pileTipLevel = result.pileTipLevel || (targetElevation - result.pileLength);

                // 말뚝 본체 (그라데이션)
                const pileGradient = ctx.createLinearGradient(pileX - pileWidth/2, 0, pileX + pileWidth/2, 0);
                pileGradient.addColorStop(0, 'rgba(30, 58, 95, 0.4)');
                pileGradient.addColorStop(0.5, 'rgba(30, 58, 95, 0.2)');
                pileGradient.addColorStop(1, 'rgba(30, 58, 95, 0.4)');
                ctx.fillStyle = pileGradient;
                ctx.fillRect(pileX - pileWidth/2, pileStartY, pileWidth, result.pileLength * scale);

                // 말뚝 테두리
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.strokeRect(pileX - pileWidth/2, pileStartY, pileWidth, result.pileLength * scale);

                // 말뚝 선단 (삼각형)
                ctx.beginPath();
                ctx.moveTo(pileX - pileWidth/2, pileEndY);
                ctx.lineTo(pileX, pileEndY + 18);
                ctx.lineTo(pileX + pileWidth/2, pileEndY);
                ctx.closePath();
                ctx.fillStyle = '#1e3a5f';
                ctx.fill();
                ctx.stroke();

                // 말뚝 두부 라벨
                ctx.fillStyle = '#1e3a5f';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${pile.type === 'steel' ? '강관' : 'PHC'} ${pile.diameter * 1000}mm`, pileX, pileStartY - 8);

                // 말뚝 길이 표시 (말뚝 옆)
                ctx.save();
                ctx.translate(pileX + pileWidth/2 + 15, pileStartY + result.pileLength * scale / 2);
                ctx.rotate(-Math.PI/2);
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#1e3a5f';
                ctx.textAlign = 'center';
                ctx.fillText(`L = ${result.pileLength.toFixed(1)} m`, 0, 0);
                ctx.restore();

                // ============================================================
                // 선단지지고 표시 (핵심 추가 사항)
                // ============================================================
                ctx.strokeStyle = '#c62828';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.moveTo(boreholeX - 40, pileEndY);
                ctx.lineTo(boreholeX + layout.boreholeColumn.width + 50, pileEndY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 선단지지고 라벨 (좌측 - 깊이와 EL 동시 표기)
                const tipDepthFromGL = originalElevation - pileTipLevel;
                ctx.fillStyle = '#c62828';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(`선단 GL-${tipDepthFromGL.toFixed(1)}m`, boreholeX - 45, pileEndY - 8);
                ctx.fillText(`EL.${pileTipLevel.toFixed(2)}m`, boreholeX - 45, pileEndY + 8);

                // 선단지지고 우측 라벨 (지지층 정보)
                ctx.textAlign = 'left';
                ctx.fillText(`지지층: ${result.bearingLayer?.soil_name || '풍화암'}`, boreholeX + layout.boreholeColumn.width + 55, pileEndY + 4);

                // 근입깊이 표시
                if (result.bearingLayer) {
                    const penetration = parseFloat(document.getElementById('penetrationDepth')?.value) || 1.0;
                    ctx.font = '10px Arial';
                    ctx.fillStyle = '#666';
                    ctx.fillText(`(근입 ${penetration.toFixed(1)}m)`, boreholeX + layout.boreholeColumn.width + 55, pileEndY + 18);
                }
            }

            // ============================================================
            // 지하수위 표시
            // ============================================================
            const gwl = selectedBorehole.metadata?.GROUND_WATER_LEVEL;
            if (gwl) {
                let gwlDepth = null;
                if (selectedBorehole.metadata._GROUND_WATER_LEVEL_PARSED !== undefined) {
                    gwlDepth = Math.abs(selectedBorehole.metadata._GROUND_WATER_LEVEL_PARSED);
                } else {
                    const parsed = parseGroundwaterLevel(gwl);
                    if (parsed !== null) gwlDepth = Math.abs(parsed);
                }

                if (gwlDepth !== null && gwlDepth > 0 && gwlDepth < maxDepth) {
                    const gwlY = startY + gwlDepth * scale;
                    const gwlElevation = originalElevation - gwlDepth;

                    // 지하수위 라인
                    ctx.strokeStyle = '#0277bd';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(boreholeX - 20, gwlY);
                    ctx.lineTo(boreholeX + layout.boreholeColumn.width + 20, gwlY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // 물방울 아이콘
                    ctx.font = '14px Arial';
                    ctx.fillText('💧', boreholeX - 35, gwlY + 5);

                    // 지하수위 라벨
                    ctx.font = '10px Arial';
                    ctx.fillStyle = '#0277bd';
                    ctx.textAlign = 'right';
                    ctx.fillText(`GWL EL.${gwlElevation.toFixed(1)}m`, boreholeX - 45, gwlY + 4);
                }
            }

            // ============================================================
            // 정보 패널 (우측 하단)
            // ============================================================
            if (result && !result.isInvalid) {
                const panelX = capacityX + layout.capacityColumn.width + 20;
                const panelY = startY;
                const panelWidth = 200;
                const panelHeight = 280;

                // 패널 배경
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
                ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

                // 패널 헤더
                ctx.fillStyle = '#1e3a5f';
                ctx.fillRect(panelX, panelY, panelWidth, 28);
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText('설계 요약', panelX + panelWidth/2, panelY + 18);

                // 정보 항목
                const items = [
                    { label: '허용지지력 (Qa)', value: `${(result.Qa || 0).toFixed(0)} kN`, color: '#2e7d32' },
                    { label: '극한지지력 (Qu)', value: `${(result.Qu || 0).toFixed(0)} kN`, color: '#1565c0' },
                    { label: '주면마찰력 (Qs)', value: `${(result.Qs || 0).toFixed(0)} kN`, color: '#1976d2' },
                    { label: '선단지지력 (Qp)', value: `${(result.Qp || 0).toFixed(0)} kN`, color: '#c62828' },
                    { label: '총 침하량', value: `${(result.St || 0).toFixed(1)} mm`, color: result.settlementCheck === 'PASS' ? '#2e7d32' : '#c62828' },
                    { label: '수평지지력 (Ha)', value: `${(result.horizontalCapacity?.Ha_final || 0).toFixed(0)} kN`, color: '#7b1fa2' },
                    { label: '인발저항력 (Q_pull)', value: `${(result.upliftCapacity?.Q_pull || 0).toFixed(0)} kN`, color: '#00838f' }
                ];

                let itemY = panelY + 45;
                items.forEach(item => {
                    ctx.font = '10px Arial';
                    ctx.fillStyle = '#666';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, panelX + 10, itemY);

                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = item.color;
                    ctx.textAlign = 'right';
                    ctx.fillText(item.value, panelX + panelWidth - 10, itemY);

                    itemY += 32;
                });

                // 안전율 표시
                itemY += 5;
                ctx.fillStyle = '#eee';
                ctx.fillRect(panelX + 5, itemY - 12, panelWidth - 10, 25);
                ctx.font = '10px Arial';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                const FSv = parseFloat(document.getElementById('sfVertical')?.value) || 3.0;
                ctx.fillText(`적용 안전율: FSv=${FSv.toFixed(1)}`, panelX + panelWidth/2, itemY + 5);
            }

            // ============================================================
            // 범례 (하단)
            // ============================================================
            const legendY = canvas.height - 45;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(0, legendY - 15, canvas.width, 60);
            ctx.strokeStyle = '#dee2e6';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, legendY - 15);
            ctx.lineTo(canvas.width, legendY - 15);
            ctx.stroke();

            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#1e3a5f';
            ctx.textAlign = 'left';
            ctx.fillText('범례:', 20, legendY + 5);

            const legends = [
                { color: '#e65100', label: '계획고', type: 'line' },
                { color: '#c62828', label: '선단지지고', type: 'dash' },
                { color: '#0277bd', label: '지하수위', type: 'dash' },
                { color: '#1976d2', label: 'N값', type: 'circle' },
                { color: '#2e7d32', label: '누적지지력', type: 'fill' },
                { color: '#c62828', label: '지지층(N≥50)', type: 'box' }
            ];

            let legendX = 80;
            legends.forEach(leg => {
                if (leg.type === 'line') {
                    ctx.strokeStyle = leg.color;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(legendX, legendY + 2);
                    ctx.lineTo(legendX + 25, legendY + 2);
                    ctx.stroke();
                } else if (leg.type === 'dash') {
                    ctx.strokeStyle = leg.color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 3]);
                    ctx.beginPath();
                    ctx.moveTo(legendX, legendY + 2);
                    ctx.lineTo(legendX + 25, legendY + 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else if (leg.type === 'circle') {
                    ctx.beginPath();
                    ctx.arc(legendX + 12, legendY + 2, 5, 0, Math.PI * 2);
                    ctx.fillStyle = leg.color;
                    ctx.fill();
                } else if (leg.type === 'fill') {
                    ctx.fillStyle = leg.color + '40';
                    ctx.fillRect(legendX, legendY - 5, 25, 14);
                    ctx.strokeStyle = leg.color;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(legendX, legendY - 5, 25, 14);
                } else if (leg.type === 'box') {
                    ctx.strokeStyle = leg.color;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(legendX, legendY - 5, 25, 14);
                }

                ctx.font = '10px Arial';
                ctx.fillStyle = '#333';
                ctx.textAlign = 'left';
                ctx.fillText(leg.label, legendX + 30, legendY + 6);
                legendX += 110;
            });

            // 캔버스 클릭 이벤트 설정
            setupCanvasTooltip(canvas);
        }

        // N값 포인트 클릭/호버 시 툴팁 표시
        function setupCanvasTooltip(canvas) {
            // 기존 이벤트 리스너 제거 (중복 방지)
            canvas.removeEventListener('mousemove', handleCanvasMouseMove);
            canvas.removeEventListener('click', handleCanvasClick);

            // 새 이벤트 리스너 추가
            canvas.addEventListener('mousemove', handleCanvasMouseMove);
            canvas.addEventListener('click', handleCanvasClick);
        }

        function handleCanvasMouseMove(e) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);

            let hoveredPoint = null;
            for (const point of nValuePoints) {
                const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
                if (dist <= point.radius * 1.5) {
                    hoveredPoint = point;
                    break;
                }
            }

            canvas.style.cursor = hoveredPoint ? 'pointer' : 'default';

            // 툴팁 표시/숨김
            let tooltip = document.getElementById('nValueTooltip');
            if (hoveredPoint) {
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'nValueTooltip';
                    tooltip.style.cssText = 'position:fixed;background:linear-gradient(135deg,#1e3a5f,#2c5282);color:#fff;padding:12px 16px;border-radius:8px;font-size:12px;z-index:1000;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);min-width:160px;';
                    document.body.appendChild(tooltip);
                }
                const elValue = hoveredPoint.elevation !== undefined ? hoveredPoint.elevation.toFixed(2) : 'N/A';
                tooltip.innerHTML = `
                    <div style="font-weight:bold;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.3);">N값 상세 정보</div>
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">
                        <span style="color:#90caf9;">심도:</span><span>GL-${hoveredPoint.depth.toFixed(1)}m</span>
                        <span style="color:#90caf9;">표고:</span><span>EL.${elValue}m</span>
                        <span style="color:#90caf9;">N값:</span><span style="font-weight:bold;color:${hoveredPoint.nValue >= 50 ? '#ff8a80' : '#fff'};">${hoveredPoint.nValue}</span>
                        <span style="color:#90caf9;">지층:</span><span>${hoveredPoint.layer}</span>
                    </div>
                `;
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY - 10) + 'px';
                tooltip.style.display = 'block';
            } else if (tooltip) {
                tooltip.style.display = 'none';
            }
        }

        function handleCanvasClick(e) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            for (const point of nValuePoints) {
                const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
                if (dist <= point.radius) {
                    // 클릭 시 알림 표시
                    alert(`N값 정보\n\n심도: GL-${point.depth.toFixed(1)}m\nN값: ${point.nValue}\n지층: ${point.layer}`);
                    break;
                }
            }
        }

        // ============================================================
        // SVG 기반 시추주상도 시각화 (벡터 이미지, 텍스트 선택 가능)
        // ============================================================
        function drawBoreholeSVG() {
            const index = document.getElementById('boreholeSelect').value;
            if (index === '') return;

            selectedBorehole = boreholeData[index];
            if (!selectedBorehole) return;

            const svg = document.getElementById('boreholeSVG');
            if (!svg) {
                // Fallback to canvas
                drawBorehole();
                return;
            }

            // SVG 초기화
            svg.innerHTML = '';

            // 기본 데이터 수집
            const originalElevation = getGroundSurfaceElevation(selectedBorehole.metadata) || 0;
            let targetElevation = selectedBorehole._targetElevation;
            if (targetElevation === undefined || isNaN(targetElevation)) {
                const targetInput = document.getElementById('targetGroundElevation');
                targetElevation = targetInput ? parseFloat(targetInput.value) : originalElevation;
                if (isNaN(targetElevation)) targetElevation = originalElevation;
            }

            const result = calculationResults.find(r => r.borehole === selectedBorehole.hole_no);

            // 깊이 계산
            let actualMaxDepth = 0;
            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach(layer => {
                    if (layer && layer.depth_range) {
                        const depthMatch = layer.depth_range.match(/([\d.]+)~([\d.]+)m/);
                        if (depthMatch) {
                            const depthTo = parseFloat(depthMatch[2]) || 0;
                            if (depthTo > actualMaxDepth) actualMaxDepth = depthTo;
                        }
                    }
                });
            }

            if (result && result.pileTipDepth) {
                actualMaxDepth = Math.max(actualMaxDepth, result.pileTipDepth + 2);
            }

            const maxDepth = Math.max(15, Math.min(actualMaxDepth + 3, 40));

            // 레이아웃 설정
            const layout = {
                width: 1400,
                height: Math.max(750, maxDepth * 22 + 180),
                margin: { left: 140, top: 120, right: 40, bottom: 80 },
                columns: {
                    depth: { x: 0, width: 110 },
                    borehole: { x: 120, width: 160 },
                    nValue: { x: 300, width: 200 },
                    capacity: { x: 520, width: 200 },
                    info: { x: 740, width: 220 }
                }
            };

            svg.setAttribute('width', layout.width);
            svg.setAttribute('height', layout.height);

            const scale = (layout.height - layout.margin.top - layout.margin.bottom) / maxDepth;
            const startX = layout.margin.left;
            const startY = layout.margin.top;

            // 지층 색상 맵
            const layerColors = {
                '매립': '#8B7355',
                '붕적': '#C4A484',
                '퇴적': '#D2B48C',
                '충적': '#DEB887',
                '풍화잔류토': '#E8C872',
                '풍화토': '#DEB887',
                '풍화암': '#BDB76B',
                '연암': '#A9A9A9',
                '경암': '#696969',
                'default': '#E0E0E0'
            };

            function getLayerColor(soilName) {
                for (const [key, color] of Object.entries(layerColors)) {
                    if (soilName && soilName.includes(key)) return color;
                }
                return layerColors.default;
            }

            // SVG 요소 생성 헬퍼
            function createSVGElement(tag, attrs) {
                const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
                return el;
            }

            // 1. 헤더 영역
            const headerGroup = createSVGElement('g', { id: 'header' });

            // 헤더 배경
            const headerRect = createSVGElement('rect', {
                x: 0, y: 0, width: layout.width, height: 70,
                fill: 'url(#headerGradient)'
            });

            // 그라데이션 정의
            const defs = createSVGElement('defs', {});
            const headerGradient = createSVGElement('linearGradient', {
                id: 'headerGradient', x1: '0%', y1: '0%', x2: '100%', y2: '0%'
            });
            headerGradient.innerHTML = `
                <stop offset="0%" style="stop-color:#1e3a5f"/>
                <stop offset="100%" style="stop-color:#2c5282"/>
            `;
            defs.appendChild(headerGradient);
            svg.appendChild(defs);

            headerGroup.appendChild(headerRect);

            // 제목
            const title = createSVGElement('text', {
                x: 25, y: 35, fill: '#ffffff', 'font-size': '18', 'font-weight': 'bold'
            });
            title.textContent = '시추주상도 및 말뚝 설계 현황';
            headerGroup.appendChild(title);

            const boreholeTitle = createSVGElement('text', {
                x: 25, y: 58, fill: '#90caf9', 'font-size': '16', 'font-weight': 'bold'
            });
            boreholeTitle.textContent = selectedBorehole.hole_no || 'Unknown';
            headerGroup.appendChild(boreholeTitle);

            // 프로젝트 정보
            const projectName = selectedBorehole.metadata?.PROJECT_NAME || '';
            if (projectName) {
                const projectText = createSVGElement('text', {
                    x: layout.width - 25, y: 30, fill: '#b0bec5', 'font-size': '12', 'text-anchor': 'end'
                });
                projectText.textContent = projectName.substring(0, 50);
                headerGroup.appendChild(projectText);
            }

            const elevInfo = createSVGElement('text', {
                x: layout.width - 25, y: 52, fill: '#b0bec5', 'font-size': '12', 'text-anchor': 'end'
            });
            elevInfo.textContent = `지표고: EL.${originalElevation.toFixed(2)}m | 계획고: EL.${targetElevation.toFixed(2)}m`;
            headerGroup.appendChild(elevInfo);

            svg.appendChild(headerGroup);

            // 2. 컬럼 헤더
            const columnHeaderBg = createSVGElement('rect', {
                x: 0, y: 70, width: layout.width, height: 35, fill: '#f8f9fa'
            });
            svg.appendChild(columnHeaderBg);

            const columnHeaders = [
                { text: '깊이(GL) / 표고(EL)', x: startX + 40 },
                { text: '시추주상도', x: startX + layout.columns.borehole.x + 80 },
                { text: 'N값 (타격횟수)', x: startX + layout.columns.nValue.x + 100 },
                { text: '누적 지지력 (kN)', x: startX + layout.columns.capacity.x + 100 }
            ];

            columnHeaders.forEach(col => {
                const text = createSVGElement('text', {
                    x: col.x, y: 92, fill: '#1e3a5f', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'middle'
                });
                text.textContent = col.text;
                svg.appendChild(text);
            });

            // 3. 메인 컨텐츠 영역
            const mainGroup = createSVGElement('g', { id: 'main', transform: `translate(0, ${startY})` });

            // 3-1. 깊이/EL 눈금
            const depthGroup = createSVGElement('g', { id: 'depthScale' });
            for (let depth = 0; depth <= maxDepth; depth += 2) {
                const y = depth * scale;
                const el = originalElevation - depth;

                // 눈금선
                const line = createSVGElement('line', {
                    x1: startX, y1: y, x2: startX + 100, y2: y,
                    stroke: '#dee2e6', 'stroke-width': 1
                });
                depthGroup.appendChild(line);

                // GL 깊이
                const glText = createSVGElement('text', {
                    x: startX + 30, y: y + 4, fill: '#495057', 'font-size': '10', 'text-anchor': 'end'
                });
                glText.textContent = `GL-${depth}m`;
                depthGroup.appendChild(glText);

                // EL 표고
                const elText = createSVGElement('text', {
                    x: startX + 95, y: y + 4, fill: '#1976d2', 'font-size': '10', 'text-anchor': 'end'
                });
                elText.textContent = `EL.${el.toFixed(1)}`;
                depthGroup.appendChild(elText);
            }
            mainGroup.appendChild(depthGroup);

            // 3-2. 지층 (시추주상도)
            const boreholeGroup = createSVGElement('g', { id: 'borehole' });
            const boreholeX = startX + layout.columns.borehole.x;

            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach((layer, idx) => {
                    if (!layer || !layer.depth_range) return;

                    const depthMatch = layer.depth_range.match(/([\d.]+)~([\d.]+)m/);
                    if (!depthMatch) return;

                    const depthFrom = parseFloat(depthMatch[1]) || 0;
                    const depthTo = Math.min(parseFloat(depthMatch[2]) || 0, maxDepth);
                    const thickness = (depthTo - depthFrom) * scale;

                    if (thickness <= 0) return;

                    const y = depthFrom * scale;
                    const soilName = layer.soil_name || '';
                    const color = getLayerColor(soilName);
                    const isBearingLayer = soilName.includes('풍화암') || soilName.includes('연암');

                    // 지층 사각형
                    const layerRect = createSVGElement('rect', {
                        x: boreholeX, y: y, width: layout.columns.borehole.width, height: thickness,
                        fill: color, stroke: isBearingLayer ? '#c62828' : '#666',
                        'stroke-width': isBearingLayer ? 3 : 1,
                        class: 'soil-layer',
                        'data-depth': `${depthFrom}~${depthTo}m`,
                        'data-soil': soilName
                    });
                    boreholeGroup.appendChild(layerRect);

                    // 지층명
                    if (thickness > 25) {
                        const nameText = createSVGElement('text', {
                            x: boreholeX + layout.columns.borehole.width / 2,
                            y: y + thickness / 2 + 4,
                            fill: '#212529', 'font-size': thickness > 40 ? '11' : '10',
                            'font-weight': isBearingLayer ? 'bold' : 'normal',
                            'text-anchor': 'middle'
                        });
                        nameText.textContent = soilName;
                        boreholeGroup.appendChild(nameText);
                    }

                    // 깊이 범위 (지층 우측)
                    const rangeText = createSVGElement('text', {
                        x: boreholeX + layout.columns.borehole.width + 8,
                        y: y + thickness / 2 + 3,
                        fill: '#666', 'font-size': '9'
                    });
                    rangeText.textContent = `${depthFrom.toFixed(1)}~${depthTo.toFixed(1)}m`;
                    boreholeGroup.appendChild(rangeText);
                });
            }
            mainGroup.appendChild(boreholeGroup);

            // 3-3. N값 그래프
            const nValueGroup = createSVGElement('g', { id: 'nValues' });
            const nValueX = startX + layout.columns.nValue.x;
            const nValueWidth = layout.columns.nValue.width - 20;

            // N값 배경
            const nValueBg = createSVGElement('rect', {
                x: nValueX, y: 0, width: nValueWidth, height: maxDepth * scale,
                fill: 'rgba(66, 165, 245, 0.03)'
            });
            nValueGroup.appendChild(nValueBg);

            // N값 눈금
            [0, 25, 50].forEach(n => {
                const x = nValueX + (n / 50) * nValueWidth;
                const gridLine = createSVGElement('line', {
                    x1: x, y1: 0, x2: x, y2: maxDepth * scale,
                    stroke: '#90caf9', 'stroke-width': 0.5, 'stroke-dasharray': '3,3'
                });
                nValueGroup.appendChild(gridLine);

                const label = createSVGElement('text', {
                    x: x, y: -8, fill: '#1976d2', 'font-size': '9', 'text-anchor': 'middle'
                });
                label.textContent = n.toString();
                nValueGroup.appendChild(label);
            });

            // N값 데이터 수집
            const nValueData = [];
            if (selectedBorehole.soil_data && Array.isArray(selectedBorehole.soil_data)) {
                selectedBorehole.soil_data.forEach(layer => {
                    if (layer.samples && Array.isArray(layer.samples)) {
                        layer.samples.forEach(sample => {
                            if (!sample || sample.Depth > maxDepth) return;
                            const nValue = extractNValue(sample.Hits);
                            if (nValue) {
                                nValueData.push({
                                    depth: sample.Depth,
                                    nValue: nValue,
                                    layer: layer.soil_name
                                });
                            }
                        });
                    }
                });
            }

            // N값 연결선 (path)
            if (nValueData.length > 1) {
                let pathD = nValueData.map((d, i) => {
                    const x = nValueX + (Math.min(d.nValue, 50) / 50) * nValueWidth;
                    const y = d.depth * scale;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

                const nValueLine = createSVGElement('path', {
                    d: pathD, fill: 'none', stroke: '#1976d2', 'stroke-width': 2
                });
                nValueGroup.appendChild(nValueLine);
            }

            // N값 포인트 및 바
            nValueData.forEach(data => {
                const x = nValueX + (Math.min(data.nValue, 50) / 50) * nValueWidth;
                const y = data.depth * scale;
                const barWidth = (Math.min(data.nValue, 50) / 50) * nValueWidth;
                const isHigh = data.nValue >= 50;

                // N값 바
                const bar = createSVGElement('rect', {
                    x: nValueX, y: y - 4, width: barWidth, height: 8,
                    fill: isHigh ? 'rgba(198, 40, 40, 0.25)' : 'rgba(25, 118, 210, 0.15)'
                });
                nValueGroup.appendChild(bar);

                // N값 포인트
                const point = createSVGElement('circle', {
                    cx: x, cy: y, r: 5,
                    fill: isHigh ? '#c62828' : '#1976d2',
                    stroke: '#fff', 'stroke-width': 1.5,
                    class: 'n-value-point',
                    'data-depth': data.depth,
                    'data-nvalue': data.nValue,
                    'data-layer': data.layer,
                    style: 'cursor: pointer;'
                });
                nValueGroup.appendChild(point);

                // N값 텍스트
                const nText = createSVGElement('text', {
                    x: x + 10, y: y + 3,
                    fill: isHigh ? '#c62828' : '#1e3a5f',
                    'font-size': '9', 'font-weight': isHigh ? 'bold' : 'normal'
                });
                nText.textContent = data.nValue.toString();
                nValueGroup.appendChild(nText);
            });
            mainGroup.appendChild(nValueGroup);

            // 3-4. 누적 지지력 그래프
            const capacityGroup = createSVGElement('g', { id: 'capacity' });
            const capacityX = startX + layout.columns.capacity.x;
            const capacityWidth = layout.columns.capacity.width - 20;

            if (result && result.skinFrictionDetails && result.skinFrictionDetails.length > 0) {
                // 지지력 배경
                const capBg = createSVGElement('rect', {
                    x: capacityX, y: 0, width: capacityWidth, height: maxDepth * scale,
                    fill: 'rgba(76, 175, 80, 0.03)'
                });
                capacityGroup.appendChild(capBg);

                const maxCapacity = result.Qu || 3000;
                const capScale = capacityWidth / maxCapacity;

                // 지지력 눈금
                const capTicks = [0, Math.round(maxCapacity / 3), Math.round(maxCapacity * 2 / 3), Math.round(maxCapacity)];
                capTicks.forEach(cap => {
                    const x = capacityX + cap * capScale;
                    const gridLine = createSVGElement('line', {
                        x1: x, y1: 0, x2: x, y2: maxDepth * scale,
                        stroke: '#81c784', 'stroke-width': 0.5, 'stroke-dasharray': '3,3'
                    });
                    capacityGroup.appendChild(gridLine);

                    const label = createSVGElement('text', {
                        x: x, y: -8, fill: '#2e7d32', 'font-size': '9', 'text-anchor': 'middle'
                    });
                    label.textContent = cap.toString();
                    capacityGroup.appendChild(label);
                });

                // 누적 지지력 계산
                let cumulativeQs = 0;
                const capPoints = [{ depth: 0, capacity: 0 }];

                result.skinFrictionDetails.forEach(detail => {
                    const depthMatch = detail.depth.match(/([\d.]+)/);
                    if (depthMatch) {
                        const depth = parseFloat(depthMatch[1]);
                        cumulativeQs += detail.Qs || 0;
                        capPoints.push({ depth, capacity: cumulativeQs });
                    }
                });

                // 선단지지력 추가
                if (result.pileTipDepth) {
                    capPoints.push({
                        depth: result.pileTipDepth,
                        capacity: cumulativeQs + (result.Qp || 0)
                    });
                }

                // 누적 지지력 영역
                if (capPoints.length > 1) {
                    let areaD = capPoints.map((p, i) => {
                        const x = capacityX + p.capacity * capScale;
                        const y = p.depth * scale;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');
                    areaD += ` L ${capacityX} ${capPoints[capPoints.length - 1].depth * scale} L ${capacityX} 0 Z`;

                    const areaPath = createSVGElement('path', {
                        d: areaD, fill: 'rgba(76, 175, 80, 0.2)', stroke: 'none'
                    });
                    capacityGroup.appendChild(areaPath);

                    // 지지력 선
                    let lineD = capPoints.map((p, i) => {
                        const x = capacityX + p.capacity * capScale;
                        const y = p.depth * scale;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');

                    const capLine = createSVGElement('path', {
                        d: lineD, fill: 'none', stroke: '#2e7d32', 'stroke-width': 2
                    });
                    capacityGroup.appendChild(capLine);

                    // 포인트
                    capPoints.forEach((p, i) => {
                        if (i === 0) return;
                        const x = capacityX + p.capacity * capScale;
                        const y = p.depth * scale;
                        const isTip = i === capPoints.length - 1 && result.pileTipDepth;

                        const point = createSVGElement('circle', {
                            cx: x, cy: y, r: 4,
                            fill: isTip ? '#c62828' : '#2e7d32'
                        });
                        capacityGroup.appendChild(point);
                    });
                }
            }
            mainGroup.appendChild(capacityGroup);

            // 3-5. 계획고/원지반 라인
            const elevationDiff = targetElevation - originalElevation;
            const workSurfaceDepth = elevationDiff > 0 ? -elevationDiff : Math.abs(elevationDiff);
            const workSurfaceY = workSurfaceDepth * scale;

            if (Math.abs(elevationDiff) > 0.01) {
                if (elevationDiff < 0) {
                    // 절토 영역
                    const cutRect = createSVGElement('rect', {
                        x: boreholeX, y: 0, width: layout.columns.borehole.width, height: workSurfaceY,
                        fill: 'rgba(198, 40, 40, 0.1)'
                    });
                    mainGroup.appendChild(cutRect);

                    const cutLabel = createSVGElement('text', {
                        x: boreholeX + layout.columns.borehole.width / 2, y: workSurfaceY / 2 + 4,
                        fill: '#c62828', 'font-size': '10', 'font-weight': 'bold', 'text-anchor': 'middle'
                    });
                    cutLabel.textContent = `절토 ${Math.abs(elevationDiff).toFixed(1)}m`;
                    mainGroup.appendChild(cutLabel);
                }

                // 계획고 라인
                const planLine = createSVGElement('line', {
                    x1: boreholeX - 40, y1: workSurfaceY,
                    x2: boreholeX + layout.columns.borehole.width + 50, y2: workSurfaceY,
                    stroke: '#e65100', 'stroke-width': 3
                });
                mainGroup.appendChild(planLine);

                // 계획고 라벨
                const planLabel = createSVGElement('text', {
                    x: boreholeX - 45, y: workSurfaceY + 4,
                    fill: '#e65100', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'end'
                });
                planLabel.textContent = `계획고 EL.${targetElevation.toFixed(2)}m`;
                mainGroup.appendChild(planLabel);

                // 원지반 라인 (점선)
                const origLine = createSVGElement('line', {
                    x1: boreholeX - 20, y1: 0,
                    x2: boreholeX + layout.columns.borehole.width + 30, y2: 0,
                    stroke: '#1e3a5f', 'stroke-width': 2, 'stroke-dasharray': '5,3'
                });
                mainGroup.appendChild(origLine);
            } else {
                // 원지반 = 계획고
                const surfaceLine = createSVGElement('line', {
                    x1: boreholeX - 40, y1: 0,
                    x2: boreholeX + layout.columns.borehole.width + 50, y2: 0,
                    stroke: '#1e3a5f', 'stroke-width': 2
                });
                mainGroup.appendChild(surfaceLine);

                const surfaceLabel = createSVGElement('text', {
                    x: boreholeX - 45, y: 4,
                    fill: '#1e3a5f', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'end'
                });
                surfaceLabel.textContent = `지표고=계획고 EL.${originalElevation.toFixed(2)}m`;
                mainGroup.appendChild(surfaceLabel);
            }

            // 3-6. 말뚝 그리기
            if (result && result.pileLength > 0) {
                const pileGroup = createSVGElement('g', { id: 'pile' });
                const pileX = boreholeX + layout.columns.borehole.width / 2;
                const pileWidth = 32;
                const pileStartY = Math.max(0, workSurfaceY);
                const pileEndY = pileStartY + result.pileLength * scale;
                const pileTipLevel = result.pileTipLevel || (targetElevation - result.pileLength);

                // 말뚝 본체
                const pileRect = createSVGElement('rect', {
                    x: pileX - pileWidth / 2, y: pileStartY,
                    width: pileWidth, height: result.pileLength * scale,
                    fill: 'rgba(30, 58, 95, 0.25)', stroke: '#1e3a5f', 'stroke-width': 2
                });
                pileGroup.appendChild(pileRect);

                // 말뚝 선단 (삼각형)
                const tipPath = createSVGElement('path', {
                    d: `M ${pileX - pileWidth / 2} ${pileEndY} L ${pileX} ${pileEndY + 15} L ${pileX + pileWidth / 2} ${pileEndY} Z`,
                    fill: '#1e3a5f', stroke: '#1e3a5f', 'stroke-width': 1
                });
                pileGroup.appendChild(tipPath);

                // 말뚝 타입/직경 라벨
                const pile = getCurrentPile();
                const pileLabel = createSVGElement('text', {
                    x: pileX, y: pileStartY - 10,
                    fill: '#1e3a5f', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'middle'
                });
                pileLabel.textContent = `${pile.type === 'steel' ? '강관' : 'PHC'} Φ${pile.diameter * 1000}mm`;
                pileGroup.appendChild(pileLabel);

                // 말뚝 길이 라벨
                const lengthLabel = createSVGElement('text', {
                    x: pileX + pileWidth / 2 + 8, y: pileStartY + result.pileLength * scale / 2,
                    fill: '#1e3a5f', 'font-size': '12', 'font-weight': 'bold',
                    transform: `rotate(-90, ${pileX + pileWidth / 2 + 8}, ${pileStartY + result.pileLength * scale / 2})`
                });
                lengthLabel.textContent = `L = ${result.pileLength.toFixed(1)} m`;
                pileGroup.appendChild(lengthLabel);

                // 선단지지고 라인
                const tipLine = createSVGElement('line', {
                    x1: boreholeX - 50, y1: pileEndY,
                    x2: boreholeX + layout.columns.borehole.width + 60, y2: pileEndY,
                    stroke: '#c62828', 'stroke-width': 2, 'stroke-dasharray': '8,4'
                });
                pileGroup.appendChild(tipLine);

                // 선단지지고 라벨 (GL/EL 동시 표기)
                const tipDepthFromGL = originalElevation - pileTipLevel;
                const tipLabel1 = createSVGElement('text', {
                    x: boreholeX - 55, y: pileEndY - 8,
                    fill: '#c62828', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'end'
                });
                tipLabel1.textContent = `선단 GL-${tipDepthFromGL.toFixed(1)}m`;
                pileGroup.appendChild(tipLabel1);

                const tipLabel2 = createSVGElement('text', {
                    x: boreholeX - 55, y: pileEndY + 8,
                    fill: '#c62828', 'font-size': '11', 'font-weight': 'bold', 'text-anchor': 'end'
                });
                tipLabel2.textContent = `EL.${pileTipLevel.toFixed(2)}m`;
                pileGroup.appendChild(tipLabel2);

                // 지지층 라벨
                const bearingLabel = createSVGElement('text', {
                    x: boreholeX + layout.columns.borehole.width + 65, y: pileEndY + 4,
                    fill: '#c62828', 'font-size': '10', 'font-weight': 'bold'
                });
                bearingLabel.textContent = `지지층: ${result.bearingLayer?.soil_name || '풍화암'}`;
                pileGroup.appendChild(bearingLabel);

                mainGroup.appendChild(pileGroup);
            }

            // 3-7. 지하수위
            const gwl = selectedBorehole.metadata?.GROUND_WATER_LEVEL;
            if (gwl) {
                let gwlDepth = parseGroundwaterLevel(gwl);
                if (gwlDepth !== null) {
                    gwlDepth = Math.abs(gwlDepth);
                    if (gwlDepth > 0 && gwlDepth < maxDepth) {
                        const gwlY = gwlDepth * scale;
                        const gwlElevation = originalElevation - gwlDepth;

                        const gwlLine = createSVGElement('line', {
                            x1: boreholeX - 30, y1: gwlY,
                            x2: boreholeX + layout.columns.borehole.width + 30, y2: gwlY,
                            stroke: '#0277bd', 'stroke-width': 2, 'stroke-dasharray': '4,4'
                        });
                        mainGroup.appendChild(gwlLine);

                        const gwlLabel = createSVGElement('text', {
                            x: boreholeX - 55, y: gwlY + 4,
                            fill: '#0277bd', 'font-size': '10', 'text-anchor': 'end'
                        });
                        gwlLabel.textContent = `💧 GWL EL.${gwlElevation.toFixed(1)}m`;
                        mainGroup.appendChild(gwlLabel);
                    }
                }
            }

            svg.appendChild(mainGroup);

            // 4. 정보 패널
            if (result && !result.isInvalid) {
                const infoGroup = createSVGElement('g', { id: 'infoPanel', transform: `translate(${startX + layout.columns.info.x}, ${startY})` });

                // 패널 배경
                const panelRect = createSVGElement('rect', {
                    x: 0, y: 0, width: layout.columns.info.width, height: 310,
                    fill: '#ffffff', stroke: '#1e3a5f', 'stroke-width': 2, rx: 8
                });
                infoGroup.appendChild(panelRect);

                // 패널 헤더
                const panelHeader = createSVGElement('rect', {
                    x: 0, y: 0, width: layout.columns.info.width, height: 30,
                    fill: '#1e3a5f', rx: 8
                });
                infoGroup.appendChild(panelHeader);

                const panelHeaderRect = createSVGElement('rect', {
                    x: 0, y: 20, width: layout.columns.info.width, height: 10, fill: '#1e3a5f'
                });
                infoGroup.appendChild(panelHeaderRect);

                const panelTitle = createSVGElement('text', {
                    x: layout.columns.info.width / 2, y: 20,
                    fill: '#ffffff', 'font-size': '12', 'font-weight': 'bold', 'text-anchor': 'middle'
                });
                panelTitle.textContent = '설계 요약';
                infoGroup.appendChild(panelTitle);

                // 정보 항목
                const items = [
                    { label: '허용지지력 (Qa)', value: `${(result.Qa || 0).toFixed(0)} kN`, color: '#2e7d32' },
                    { label: '극한지지력 (Qu)', value: `${(result.Qu || 0).toFixed(0)} kN`, color: '#1565c0' },
                    { label: '주면마찰력 (Qs)', value: `${(result.Qs || 0).toFixed(0)} kN`, color: '#1976d2' },
                    { label: '선단지지력 (Qp)', value: `${(result.Qp || 0).toFixed(0)} kN`, color: '#c62828' },
                    { label: '총 침하량', value: `${(result.St || 0).toFixed(2)} mm`, color: result.settlementCheck === 'PASS' ? '#2e7d32' : '#c62828' },
                    { label: '수평지지력 (Ha)', value: `${(result.horizontalCapacity?.Ha_final || 0).toFixed(0)} kN`, color: '#7b1fa2' },
                    { label: '인발저항력 (Q_pull)', value: `${(result.upliftCapacity?.Q_pull || 0).toFixed(0)} kN`, color: '#00838f' }
                ];

                items.forEach((item, idx) => {
                    const y = 55 + idx * 35;

                    const labelText = createSVGElement('text', {
                        x: 15, y: y, fill: '#666', 'font-size': '10'
                    });
                    labelText.textContent = item.label;
                    infoGroup.appendChild(labelText);

                    const valueText = createSVGElement('text', {
                        x: layout.columns.info.width - 15, y: y,
                        fill: item.color, 'font-size': '12', 'font-weight': 'bold', 'text-anchor': 'end'
                    });
                    valueText.textContent = item.value;
                    infoGroup.appendChild(valueText);
                });

                // 안전율
                const FSv = parseFloat(document.getElementById('sfVertical')?.value) || 3.0;
                const sfRect = createSVGElement('rect', {
                    x: 10, y: 275, width: layout.columns.info.width - 20, height: 25,
                    fill: '#f5f5f5', rx: 4
                });
                infoGroup.appendChild(sfRect);

                const sfText = createSVGElement('text', {
                    x: layout.columns.info.width / 2, y: 292,
                    fill: '#666', 'font-size': '10', 'text-anchor': 'middle'
                });
                sfText.textContent = `적용 안전율: FSv = ${FSv.toFixed(1)}`;
                infoGroup.appendChild(sfText);

                svg.appendChild(infoGroup);
            }

            // 5. 범례
            const legendY = layout.height - 50;
            const legendBg = createSVGElement('rect', {
                x: 0, y: legendY - 10, width: layout.width, height: 60, fill: '#fafafa'
            });
            svg.appendChild(legendBg);

            const legendLine = createSVGElement('line', {
                x1: 0, y1: legendY - 10, x2: layout.width, y2: legendY - 10,
                stroke: '#dee2e6', 'stroke-width': 1
            });
            svg.appendChild(legendLine);

            const legendTitle = createSVGElement('text', {
                x: 25, y: legendY + 15, fill: '#1e3a5f', 'font-size': '11', 'font-weight': 'bold'
            });
            legendTitle.textContent = '범례:';
            svg.appendChild(legendTitle);

            const legends = [
                { color: '#e65100', label: '계획고', type: 'line' },
                { color: '#c62828', label: '선단지지고', type: 'dash' },
                { color: '#0277bd', label: '지하수위', type: 'dash' },
                { color: '#1976d2', label: 'N값', type: 'circle' },
                { color: '#2e7d32', label: '누적지지력', type: 'area' },
                { color: '#c62828', label: '지지층(N≥50)', type: 'box' }
            ];

            let legendX = 90;
            legends.forEach(leg => {
                const group = createSVGElement('g', { transform: `translate(${legendX}, ${legendY + 10})` });

                if (leg.type === 'line') {
                    const line = createSVGElement('line', {
                        x1: 0, y1: 5, x2: 25, y2: 5,
                        stroke: leg.color, 'stroke-width': 3
                    });
                    group.appendChild(line);
                } else if (leg.type === 'dash') {
                    const line = createSVGElement('line', {
                        x1: 0, y1: 5, x2: 25, y2: 5,
                        stroke: leg.color, 'stroke-width': 2, 'stroke-dasharray': '4,3'
                    });
                    group.appendChild(line);
                } else if (leg.type === 'circle') {
                    const circle = createSVGElement('circle', {
                        cx: 12, cy: 5, r: 5, fill: leg.color
                    });
                    group.appendChild(circle);
                } else if (leg.type === 'area') {
                    const rect = createSVGElement('rect', {
                        x: 0, y: -2, width: 25, height: 14,
                        fill: leg.color + '40', stroke: leg.color, 'stroke-width': 1
                    });
                    group.appendChild(rect);
                } else if (leg.type === 'box') {
                    const rect = createSVGElement('rect', {
                        x: 0, y: -2, width: 25, height: 14,
                        fill: 'none', stroke: leg.color, 'stroke-width': 3
                    });
                    group.appendChild(rect);
                }

                const label = createSVGElement('text', {
                    x: 32, y: 9, fill: '#333', 'font-size': '10'
                });
                label.textContent = leg.label;
                group.appendChild(label);

                svg.appendChild(group);
                legendX += 120;
            });

            // SVG 툴팁 이벤트 설정
            setupSVGTooltips(svg);
        }

        // SVG 툴팁 이벤트
        function setupSVGTooltips(svg) {
            const tooltip = document.createElement('div');
            tooltip.id = 'svgTooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: linear-gradient(135deg, #1e3a5f, #2c5282);
                color: #fff;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: none;
                min-width: 150px;
            `;
            document.body.appendChild(tooltip);

            // N값 포인트 호버
            svg.querySelectorAll('.n-value-point').forEach(point => {
                point.addEventListener('mouseenter', (e) => {
                    const depth = point.getAttribute('data-depth');
                    const nValue = point.getAttribute('data-nvalue');
                    const layer = point.getAttribute('data-layer');
                    const elevation = getGroundSurfaceElevation(selectedBorehole.metadata) - parseFloat(depth);

                    tooltip.innerHTML = `
                        <div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.3);padding-bottom:6px;">N값 상세 정보</div>
                        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">
                            <span style="color:#90caf9;">심도:</span><span>GL-${parseFloat(depth).toFixed(1)}m</span>
                            <span style="color:#90caf9;">표고:</span><span>EL.${elevation.toFixed(2)}m</span>
                            <span style="color:#90caf9;">N값:</span><span style="font-weight:bold;color:${parseInt(nValue) >= 50 ? '#ff8a80' : '#fff'};">${nValue}</span>
                            <span style="color:#90caf9;">지층:</span><span>${layer}</span>
                        </div>
                    `;
                    tooltip.style.display = 'block';
                });

                point.addEventListener('mousemove', (e) => {
                    tooltip.style.left = (e.clientX + 15) + 'px';
                    tooltip.style.top = (e.clientY - 10) + 'px';
                });

                point.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });
            });

            // 지층 호버
            svg.querySelectorAll('.soil-layer').forEach(layer => {
                layer.addEventListener('mouseenter', (e) => {
                    const depth = layer.getAttribute('data-depth');
                    const soil = layer.getAttribute('data-soil');

                    tooltip.innerHTML = `
                        <div style="font-weight:bold;margin-bottom:6px;">${soil}</div>
                        <div style="color:#90caf9;">깊이: ${depth}</div>
                    `;
                    tooltip.style.display = 'block';
                    layer.style.opacity = '0.8';
                });

                layer.addEventListener('mousemove', (e) => {
                    tooltip.style.left = (e.clientX + 15) + 'px';
                    tooltip.style.top = (e.clientY - 10) + 'px';
                });

                layer.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                    layer.style.opacity = '1';
                });
            });
        }

        // SVG 이미지 내보내기
        function exportBoreholeImage() {
            const svg = document.getElementById('boreholeSVG');
            if (!svg) return;

            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `시추주상도_${selectedBorehole?.hole_no || 'unknown'}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // ============================================================
        // 3D 지질 시각화 (Plotly.js 기반 전문가용 뷰어)
        // ============================================================
        let visualization3DData = { gridData: null };
        let selected3DBoreholeIndex = null; // 선택된 시추공 인덱스 (null = 전체 보기)

        /**
         * IDW (Inverse Distance Weighting) 보간
         */
        function idwInterpolate(points, values, queryX, queryY, power = 2) {
            let sumWeights = 0;
            let sumValues = 0;

            for (let i = 0; i < points.length; i++) {
                const dist = Math.sqrt(
                    Math.pow(points[i].x - queryX, 2) +
                    Math.pow(points[i].y - queryY, 2)
                );
                if (dist < 0.001) return values[i];
                const weight = 1 / Math.pow(dist, power);
                sumWeights += weight;
                sumValues += values[i] * weight;
            }
            return sumWeights > 0 ? sumValues / sumWeights : 0;
        }

        /**
         * 시추공 데이터로부터 3D 시각화용 그리드 데이터 생성
         */
        function generate3DGridData() {
            if (!boreholeData || boreholeData.length === 0) return null;

            const hasCoords = boreholeData.some(bh =>
                bh.metadata?.X_COORDINATE && bh.metadata?.Y_COORDINATE
            );

            const coords = boreholeData.map((bh, idx) => {
                if (hasCoords && bh.metadata?.X_COORDINATE && bh.metadata?.Y_COORDINATE) {
                    return { x: parseFloat(bh.metadata.X_COORDINATE), y: parseFloat(bh.metadata.Y_COORDINATE) };
                } else {
                    const angle = (idx / boreholeData.length) * Math.PI * 2;
                    return { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50 };
                }
            });

            const minX = Math.min(...coords.map(c => c.x));
            const maxX = Math.max(...coords.map(c => c.x));
            const minY = Math.min(...coords.map(c => c.y));
            const maxY = Math.max(...coords.map(c => c.y));
            const rangeX = maxX - minX || 100;
            const rangeY = maxY - minY || 100;
            const margin = Math.max(rangeX, rangeY) * 0.15;

            const gridResolution = 40;
            const gridX = [], gridY = [];
            for (let i = 0; i < gridResolution; i++) {
                gridX.push(minX - margin + (rangeX + 2 * margin) * i / (gridResolution - 1));
                gridY.push(minY - margin + (rangeY + 2 * margin) * i / (gridResolution - 1));
            }

            const surfaceValues = boreholeData.map(bh => getGroundSurfaceElevation(bh.metadata) || 50);
            const gwlValues = boreholeData.map((bh, idx) => {
                const el = surfaceValues[idx];
                const gwl = parseGroundwaterLevel(bh.metadata?.GROUND_WATER_LEVEL);
                return gwl !== null ? el + gwl : el - 5;
            });

            // 현재 선택된 지지층 유형 확인
            const bearingType = document.getElementById('bearingLayer')?.value || 'weathered_rock';

            // 풍화암 상단 표고 (풍화암 시작 심도) - calculateForBorehole()과 동일한 로직 적용
            const weatheredRockTopValues = boreholeData.map((bh, idx) => {
                const el = surfaceValues[idx];
                if (!bh.soil_data) return el - 15;

                for (const layer of bh.soil_data) {
                    const soilName = layer.soil_name || '';
                    let isWeatheredRock = false;

                    // calculateForBorehole()과 동일한 판정 로직
                    if (bearingType === 'weathered_rock') {
                        // 풍화암은 무조건 포함
                        if (soilName.includes('풍화암')) {
                            isWeatheredRock = true;
                        }
                        // 풍화잔류토는 N>=50인 경우에만 포함
                        else if (soilName.includes('풍화잔류토') || soilName.includes('풍화토') || soilName.includes('잔류토')) {
                            const avgN = getAverageN(layer);
                            if (avgN >= 50) {
                                isWeatheredRock = true;
                            }
                        }
                    } else {
                        // 다른 지지층 유형 선택 시에도 풍화암 레이어 표시를 위해
                        if (soilName.includes('풍화암')) {
                            isWeatheredRock = true;
                        }
                    }

                    if (isWeatheredRock) {
                        const match = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (match) return el - parseFloat(match[1]);
                    }
                }
                return el - 15;
            });

            // 풍화암 하단 표고 (풍화암 끝 심도 = 연암 시작 또는 풍화암 층 하단)
            const weatheredRockBottomValues = boreholeData.map((bh, idx) => {
                const el = surfaceValues[idx];
                if (!bh.soil_data) return el - 20;

                for (const layer of bh.soil_data) {
                    const soilName = layer.soil_name || '';
                    let isWeatheredRock = false;

                    if (bearingType === 'weathered_rock') {
                        if (soilName.includes('풍화암')) {
                            isWeatheredRock = true;
                        } else if (soilName.includes('풍화잔류토') || soilName.includes('풍화토') || soilName.includes('잔류토')) {
                            const avgN = getAverageN(layer);
                            if (avgN >= 50) {
                                isWeatheredRock = true;
                            }
                        }
                    } else {
                        if (soilName.includes('풍화암')) {
                            isWeatheredRock = true;
                        }
                    }

                    if (isWeatheredRock) {
                        const match = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (match) return el - parseFloat(match[2]); // 하단 심도
                    }
                }
                return el - 20;
            });

            // 연암 상단 표고
            const softRockTopValues = boreholeData.map((bh, idx) => {
                const el = surfaceValues[idx];
                if (!bh.soil_data) return el - 20;
                for (const layer of bh.soil_data) {
                    if (layer.soil_name && layer.soil_name.includes('연암')) {
                        const match = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (match) return el - parseFloat(match[1]);
                    }
                }
                return el - 20;
            });

            // 연암 하단 표고
            const softRockBottomValues = boreholeData.map((bh, idx) => {
                const el = surfaceValues[idx];
                if (!bh.soil_data) return el - 25;
                for (const layer of bh.soil_data) {
                    if (layer.soil_name && layer.soil_name.includes('연암')) {
                        const match = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (match) return el - parseFloat(match[2]);
                    }
                }
                return el - 25;
            });

            const interpolateGrid = (values) => {
                const zGrid = [];
                for (let i = 0; i < gridResolution; i++) {
                    const row = [];
                    for (let j = 0; j < gridResolution; j++) {
                        row.push(idwInterpolate(coords, values, gridX[j], gridY[i]));
                    }
                    zGrid.push(row);
                }
                return zGrid;
            };

            return {
                x: gridX, y: gridY,
                z_surface: interpolateGrid(surfaceValues),
                z_gwl: interpolateGrid(gwlValues),
                z_weathered_rock_top: interpolateGrid(weatheredRockTopValues),
                z_weathered_rock_bottom: interpolateGrid(weatheredRockBottomValues),
                z_soft_rock_top: interpolateGrid(softRockTopValues),
                z_soft_rock_bottom: interpolateGrid(softRockBottomValues),
                coords: coords, hasCoords: hasCoords,
                // 개별 시추공별 레이어 정보 (말뚝 근입 확인용)
                boreholeLayerInfo: boreholeData.map((bh, idx) => ({
                    weatheredRockTop: weatheredRockTopValues[idx],
                    weatheredRockBottom: weatheredRockBottomValues[idx],
                    softRockTop: softRockTopValues[idx],
                    softRockBottom: softRockBottomValues[idx]
                }))
            };
        }

        function open3DVisualization() {
            if (!boreholeData || boreholeData.length === 0) {
                alert('시추공 데이터가 없습니다. JSON 파일을 먼저 업로드하세요.');
                return;
            }
            const modal = document.getElementById('modal3DView');
            modal.style.display = 'block';
            visualization3DData.gridData = generate3DGridData();
            setTimeout(() => {
                update3DPlotly();
                update3DPlotlySidePanel();
            }, 100);
        }

        function close3DVisualization() {
            const modal = document.getElementById('modal3DView');
            modal.style.display = 'none';
            const container = document.getElementById('3dPlotlyContainer');
            if (container && typeof Plotly !== 'undefined') {
                Plotly.purge(container);
            }
        }

        /**
         * Plotly 3D 시각화 메인 함수
         * - 지층별 레이어 온오프
         * - 시추공 선택 시 반경 5m 원형 단면 표시
         * - 마커 크기 축소
         */
        function update3DPlotly() {
            const container = document.getElementById('3dPlotlyContainer');
            if (!container) return;

            // 설정이 변경되었을 수 있으므로 그리드 데이터를 항상 다시 생성
            visualization3DData.gridData = generate3DGridData();

            const data3d = visualization3DData.gridData;
            if (!data3d) {
                container.innerHTML = '<p style="padding: 20px; color: #666;">데이터가 없습니다.</p>';
                return;
            }

            // 레이어 표시 옵션 - 체크박스 상태 명시적 확인
            const chkContours = document.getElementById('chk3DContours');
            const chkBoreholes = document.getElementById('chk3DBoreholes');
            const chkPiles = document.getElementById('chk3DPiles');
            const chkGWL = document.getElementById('chk3DGWL');
            const chkSurface = document.getElementById('chk3DSurface');
            const chkWeathered = document.getElementById('chk3DWeathered');
            const chkSoftRock = document.getElementById('chk3DSoftRock');

            const showContours = chkContours ? chkContours.checked : false;
            const showBoreholes = chkBoreholes ? chkBoreholes.checked : true;
            const showPiles = chkPiles ? chkPiles.checked : true;
            const showGWL = chkGWL ? chkGWL.checked : true;
            const showSurface = chkSurface ? chkSurface.checked : true;
            const showWeathered = chkWeathered ? chkWeathered.checked : true;
            const showSoftRock = chkSoftRock ? chkSoftRock.checked : true;

            console.log('3D Layer visibility:', { showSurface, showWeathered, showSoftRock, showGWL, showBoreholes, showPiles });

            const traces = [];
            const selectedIdx = selected3DBoreholeIndex;
            const clipRadius = 5; // 반경 5m 원형 클리핑

            // 선택된 시추공이 있으면 해당 위치 기준으로 클리핑
            let clipCenter = null;
            if (selectedIdx !== null && data3d.coords[selectedIdx]) {
                clipCenter = data3d.coords[selectedIdx];
            }

            // 클리핑 함수: 특정 중심점에서 반경 내의 데이터만 추출
            const clipGridData = (zGrid, radius) => {
                if (!clipCenter) return { x: data3d.x, y: data3d.y, z: zGrid };

                const clippedX = [], clippedY = [], clippedZ = [];
                for (let i = 0; i < data3d.y.length; i++) {
                    const row = [];
                    let hasValidData = false;
                    for (let j = 0; j < data3d.x.length; j++) {
                        const dist = Math.sqrt(Math.pow(data3d.x[j] - clipCenter.x, 2) + Math.pow(data3d.y[i] - clipCenter.y, 2));
                        if (dist <= radius) {
                            row.push(zGrid[i][j]);
                            hasValidData = true;
                        } else {
                            row.push(null);
                        }
                    }
                    if (hasValidData) {
                        clippedZ.push(row);
                    } else {
                        clippedZ.push(row);
                    }
                }
                return { x: data3d.x, y: data3d.y, z: clippedZ };
            };

            // 1. 지표면 Surface
            if (showSurface) {
                const surfData = clipCenter ? clipGridData(data3d.z_surface, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_surface };
                traces.push({
                    x: surfData.x, y: surfData.y, z: surfData.z,
                    type: 'surface', name: '지표면',
                    colorscale: [[0,'#A08060'],[0.5,'#C4A77D'],[1,'#DEB887']],
                    opacity: clipCenter ? 0.9 : 0.75, showscale: false,
                    contours: { z: { show: showContours, color: 'rgba(0,0,0,0.2)', width: 1 } },
                    hovertemplate: '<b>지표면</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
            }

            // 2. 지하수위 Surface
            if (showGWL) {
                const gwlData = clipCenter ? clipGridData(data3d.z_gwl, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_gwl };
                traces.push({
                    x: gwlData.x, y: gwlData.y, z: gwlData.z,
                    type: 'surface', name: '지하수위',
                    colorscale: [[0,'rgba(66,165,245,0.6)'],[1,'rgba(33,150,243,0.6)']],
                    opacity: 0.45, showscale: false,
                    hovertemplate: '<b>지하수위</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
            }

            // 3. 풍화암층 - 상단/하단
            if (showWeathered) {
                const wrTopData = clipCenter ? clipGridData(data3d.z_weathered_rock_top, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_weathered_rock_top };
                const wrBotData = clipCenter ? clipGridData(data3d.z_weathered_rock_bottom, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_weathered_rock_bottom };
                traces.push({
                    x: wrTopData.x, y: wrTopData.y, z: wrTopData.z,
                    type: 'surface', name: '풍화암 상단',
                    colorscale: [[0,'#CD853F'],[0.5,'#D2691E'],[1,'#B8860B']],
                    opacity: clipCenter ? 0.85 : 0.7, showscale: false,
                    contours: { z: { show: showContours, color: 'rgba(139,69,19,0.3)', width: 1 } },
                    hovertemplate: '<b>풍화암 상단</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
                traces.push({
                    x: wrBotData.x, y: wrBotData.y, z: wrBotData.z,
                    type: 'surface', name: '풍화암 하단',
                    colorscale: [[0,'#8B6914'],[0.5,'#9B7B30'],[1,'#A0522D']],
                    opacity: clipCenter ? 0.8 : 0.65, showscale: false,
                    hovertemplate: '<b>풍화암 하단</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
            }

            // 4. 연암층 - 상단/하단
            if (showSoftRock) {
                const srTopData = clipCenter ? clipGridData(data3d.z_soft_rock_top, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_soft_rock_top };
                const srBotData = clipCenter ? clipGridData(data3d.z_soft_rock_bottom, clipRadius) : { x: data3d.x, y: data3d.y, z: data3d.z_soft_rock_bottom };
                traces.push({
                    x: srTopData.x, y: srTopData.y, z: srTopData.z,
                    type: 'surface', name: '연암 상단',
                    colorscale: [[0,'#708090'],[0.5,'#778899'],[1,'#696969']],
                    opacity: clipCenter ? 0.85 : 0.7, showscale: false,
                    contours: { z: { show: showContours, color: 'rgba(47,79,79,0.3)', width: 1 } },
                    hovertemplate: '<b>연암 상단</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
                traces.push({
                    x: srBotData.x, y: srBotData.y, z: srBotData.z,
                    type: 'surface', name: '연암 하단',
                    colorscale: [[0,'#2F4F4F'],[0.5,'#3D5C5C'],[1,'#4A6969']],
                    opacity: clipCenter ? 0.75 : 0.6, showscale: false,
                    hovertemplate: '<b>연암 하단</b><br>표고: EL.%{z:.2f}m<extra></extra>'
                });
            }

            // 5. 시추공 및 말뚝
            if (showBoreholes) {
                const penetrationDepth = parseFloat(document.getElementById('penetrationDepth')?.value) || 1.0;
                console.log('[3D 검증] 현재 설정 - 지지층:', document.getElementById('bearingLayer')?.value, ', 근입깊이:', penetrationDepth, 'm');

                const bhData = boreholeData.map((bh, idx) => {
                    const el = getGroundSurfaceElevation(bh.metadata) || 50;
                    const result = calculationResults.find(r => r.borehole === bh.hole_no);
                    let totalDepth = 20;
                    if (bh.soil_data && bh.soil_data.length > 0) {
                        const lastLayer = bh.soil_data[bh.soil_data.length - 1];
                        const match = lastLayer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                        if (match) totalDepth = parseFloat(match[2]);
                    }
                    const layerInfo = data3d.boreholeLayerInfo?.[idx] || {};

                    const bhInfo = {
                        idx, holeNo: bh.hole_no || `BH-${idx+1}`,
                        x: data3d.coords[idx].x, y: data3d.coords[idx].y,
                        groundEl: el, endEl: el - totalDepth, totalDepth,
                        pileLength: result?.pileLength || 0,
                        pileTipEl: result?.pileTipLevel || el,
                        Qa: result?.Qa || 0,
                        weatheredRockTop: layerInfo.weatheredRockTop || el - 15,
                        weatheredRockBottom: layerInfo.weatheredRockBottom || el - 20,
                        softRockTop: layerInfo.softRockTop || el - 20
                    };

                    // 디버그: 말뚝 선단과 풍화암 상단 레벨 비교
                    if (result?.pileLength > 0) {
                        const diff = bhInfo.pileTipEl - bhInfo.weatheredRockTop;
                        console.log(`[3D 검증] ${bhInfo.holeNo}: 지표고=${el.toFixed(2)}, 풍화암상단=${bhInfo.weatheredRockTop.toFixed(2)}, 말뚝선단=${bhInfo.pileTipEl.toFixed(2)}, 차이=${diff.toFixed(2)}m (+ = 선단이 위, - = 선단이 아래)`);
                    }

                    return bhInfo;
                });

                // 시추공 마커 (크기 축소)
                const markerColors = bhData.map((b, i) => i === selectedIdx ? '#FF5722' : '#1565C0');
                const markerSizes = bhData.map((b, i) => i === selectedIdx ? 6 : 4);

                traces.push({
                    x: bhData.map(b => b.x), y: bhData.map(b => b.y), z: bhData.map(b => b.groundEl + 1),
                    mode: 'markers+text', type: 'scatter3d',
                    marker: { size: markerSizes, color: markerColors, symbol: 'circle', line: { color: '#fff', width: 1 } },
                    text: bhData.map(b => b.holeNo),
                    textposition: 'top center',
                    textfont: { size: 8, color: '#333', family: 'Arial' },
                    name: '시추공',
                    hovertemplate: bhData.map(b =>
                        `<b>${b.holeNo}</b><br>지표고: EL.${b.groundEl.toFixed(2)}m<br>시추깊이: ${b.totalDepth.toFixed(1)}m<extra></extra>`)
                });

                // 시추공 수직 라인 (가는 선)
                bhData.forEach((bh, idx) => {
                    const lineColor = idx === selectedIdx ? '#FF5722' : '#0277BD';
                    const lineWidth = idx === selectedIdx ? 4 : 2;
                    traces.push({
                        x: [bh.x, bh.x], y: [bh.y, bh.y], z: [bh.groundEl, bh.endEl],
                        mode: 'lines', type: 'scatter3d',
                        line: { color: lineColor, width: lineWidth },
                        showlegend: false, hoverinfo: 'skip'
                    });
                });

                // 말뚝 표시
                if (showPiles) {
                    bhData.filter(b => b.pileLength > 0).forEach((bh, idx) => {
                        const isSelected = bh.idx === selectedIdx;
                        const pileColor = isSelected ? '#D84315' : '#263238';
                        const pileWidth = isSelected ? 7 : 5;

                        // 말뚝 본체
                        traces.push({
                            x: [bh.x, bh.x], y: [bh.y, bh.y], z: [bh.groundEl, bh.pileTipEl],
                            mode: 'lines', type: 'scatter3d',
                            line: { color: pileColor, width: pileWidth },
                            name: idx === 0 ? '말뚝' : '', showlegend: idx === 0, hoverinfo: 'skip'
                        });

                        // 말뚝 선단 - Cone
                        traces.push({
                            type: 'cone',
                            x: [bh.x], y: [bh.y], z: [bh.pileTipEl],
                            u: [0], v: [0], w: [-0.5],
                            sizemode: 'absolute',
                            sizeref: isSelected ? 1.2 : 0.8,
                            anchor: 'tip',
                            colorscale: [[0, '#B71C1C'], [1, '#E53935']],
                            showscale: false,
                            name: idx === 0 ? '선단' : '', showlegend: idx === 0,
                            hovertemplate:
                                `<b>${bh.holeNo}</b><br>선단: EL.${bh.pileTipEl.toFixed(2)}m<br>` +
                                `말뚝장: ${bh.pileLength.toFixed(1)}m | Qa: ${bh.Qa.toFixed(0)}kN<br>` +
                                `근입층: ${bh.pileTipEl > bh.softRockTop ? '풍화암' : '연암'}<extra></extra>`
                        });
                    });
                }

                // 선택된 시추공 클리핑 원 표시
                if (clipCenter && selectedIdx !== null) {
                    const circlePoints = 36;
                    const circleX = [], circleY = [], circleZ = [];
                    const bhInfo = bhData[selectedIdx];
                    for (let i = 0; i <= circlePoints; i++) {
                        const angle = (i / circlePoints) * Math.PI * 2;
                        circleX.push(clipCenter.x + Math.cos(angle) * clipRadius);
                        circleY.push(clipCenter.y + Math.sin(angle) * clipRadius);
                        circleZ.push(bhInfo.groundEl);
                    }
                    traces.push({
                        x: circleX, y: circleY, z: circleZ,
                        mode: 'lines', type: 'scatter3d',
                        line: { color: '#FF5722', width: 3, dash: 'dash' },
                        name: '분석 영역', showlegend: true, hoverinfo: 'skip'
                    });
                }
            }

            // Z 범위 계산
            let zMin = Infinity, zMax = -Infinity;
            [data3d.z_surface, data3d.z_soft_rock_bottom].forEach(zData => {
                if (zData) zData.flat().forEach(val => {
                    if (val !== null && !isNaN(val)) { zMin = Math.min(zMin, val); zMax = Math.max(zMax, val); }
                });
            });

            const xRange = Math.max(...data3d.x) - Math.min(...data3d.x);
            const yRange = Math.max(...data3d.y) - Math.min(...data3d.y);
            const zRange = zMax - zMin;
            const xyMaxRange = Math.max(xRange, yRange);

            // 선택 시 카메라 조정
            let camera = { eye: { x: 1.5, y: 1.5, z: 0.8 }, center: { x: 0, y: 0, z: -0.1 } };
            if (clipCenter) {
                camera = { eye: { x: 0.8, y: 0.8, z: 0.6 }, center: { x: 0, y: 0, z: -0.15 } };
            }

            const titleText = clipCenter
                ? `시추공 ${boreholeData[selectedIdx]?.hole_no || ''} 주변 지층 단면 (반경 ${clipRadius}m)`
                : '3D 지질 모델';

            const layout = {
                title: { text: titleText, font: { size: 14, color: '#1e3a5f' }, y: 0.98 },
                scene: {
                    xaxis: { title: 'X (m)', gridcolor: '#e0e0e0', showbackground: true, backgroundcolor: '#fafafa' },
                    yaxis: { title: 'Y (m)', gridcolor: '#e0e0e0', showbackground: true, backgroundcolor: '#f5f5f5', autorange: 'reversed' },
                    zaxis: { title: 'EL. (m)', gridcolor: '#e0e0e0', showbackground: true, backgroundcolor: '#f0f0f0' },
                    camera: camera,
                    aspectmode: 'manual',
                    aspectratio: { x: 1, y: yRange / xRange || 1, z: (zRange / xyMaxRange) * 2 || 0.5 }
                },
                margin: { l: 0, r: 0, t: 30, b: 0 },
                showlegend: false,
                paper_bgcolor: 'white'
            };

            // 기존 플롯 완전히 제거 후 새로 그리기
            Plotly.purge(container);
            Plotly.newPlot(container, traces, layout, {
                responsive: true, displayModeBar: true,
                modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'], displaylogo: false
            });

            // 범례 업데이트 (체크박스 상태 반영)
            updateLegend3DPanel();
        }

        // 범례 패널 업데이트 (체크박스 상태에 따른 투명도)
        function updateLegend3DPanel() {
            const legendDiv = document.getElementById('3dLegendItems');
            if (!legendDiv) return;

            const chkSurface = document.getElementById('chk3DSurface');
            const chkGWL = document.getElementById('chk3DGWL');
            const chkWeathered = document.getElementById('chk3DWeathered');
            const chkSoftRock = document.getElementById('chk3DSoftRock');

            const surfaceOpacity = chkSurface?.checked ? 1 : 0.3;
            const gwlOpacity = chkGWL?.checked ? 1 : 0.3;
            const weatheredOpacity = chkWeathered?.checked ? 1 : 0.3;
            const softRockOpacity = chkSoftRock?.checked ? 1 : 0.3;

            legendDiv.innerHTML = `
                <div style="display:flex;align-items:center;margin-bottom:5px;opacity:${surfaceOpacity};"><div style="width:20px;height:12px;background:#C4A77D;margin-right:8px;border-radius:2px;border:1px solid #a08060;"></div><span style="font-size:11px;">지표면</span></div>
                <div style="display:flex;align-items:center;margin-bottom:5px;opacity:${gwlOpacity};"><div style="width:20px;height:12px;background:#42A5F5;margin-right:8px;border-radius:2px;border:1px solid #1976D2;"></div><span style="font-size:11px;">지하수위</span></div>
                <div style="display:flex;align-items:center;margin-bottom:5px;opacity:${weatheredOpacity};"><div style="width:20px;height:12px;background:#D2691E;margin-right:8px;border-radius:2px;border:1px solid #8B4513;"></div><span style="font-size:11px;">풍화암</span></div>
                <div style="display:flex;align-items:center;margin-bottom:5px;opacity:${softRockOpacity};"><div style="width:20px;height:12px;background:#708090;margin-right:8px;border-radius:2px;border:1px solid #2F4F4F;"></div><span style="font-size:11px;">연암</span></div>
                <div style="border-top:1px solid #eee;margin:8px 0;"></div>
                <div style="display:flex;align-items:center;margin-bottom:5px;"><div style="width:20px;height:12px;background:#1565C0;margin-right:8px;border-radius:50%;"></div><span style="font-size:11px;">시추공</span></div>
                <div style="display:flex;align-items:center;"><div style="width:20px;height:12px;background:linear-gradient(180deg,#263238 60%,#B71C1C);margin-right:8px;border-radius:2px;"></div><span style="font-size:11px;">말뚝/선단</span></div>
            `;
        }

        // 시추공 선택 함수
        function select3DBorehole(idx) {
            selected3DBoreholeIndex = idx;
            update3DPlotly();
            update3DSelectedBoreholeInfo(idx);

            // 버튼 활성화 상태 업데이트
            document.querySelectorAll('#3dBoreholeList button').forEach((btn, i) => {
                btn.style.background = i === idx ? '#1565C0' : '#f5f5f5';
                btn.style.color = i === idx ? 'white' : '#333';
            });
        }

        // 시추공 선택 해제
        function clear3DBoreholeSelection() {
            selected3DBoreholeIndex = null;
            update3DPlotly();
            document.getElementById('3dSelectedBoreholeInfo').style.display = 'none';
            document.querySelectorAll('#3dBoreholeList button').forEach(btn => {
                btn.style.background = '#f5f5f5';
                btn.style.color = '#333';
            });
        }

        // 선택된 시추공 상세 정보 표시
        function update3DSelectedBoreholeInfo(idx) {
            const infoPanel = document.getElementById('3dSelectedBoreholeInfo');
            const detailDiv = document.getElementById('3dSelectedBoreholeDetail');
            if (!infoPanel || !detailDiv || idx === null) return;

            const bh = boreholeData[idx];
            const result = calculationResults.find(r => r.borehole === bh.hole_no);
            const el = getGroundSurfaceElevation(bh.metadata) || 0;
            const layerInfo = visualization3DData.gridData?.boreholeLayerInfo?.[idx] || {};

            let html = `
                <div style="background: #E3F2FD; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                    <strong style="color: #1565C0; font-size: 13px;">${bh.hole_no || `BH-${idx+1}`}</strong>
                </div>
                <table style="width: 100%; font-size: 11px;">
                    <tr><td style="color: #666;">지표고</td><td style="text-align: right;"><b>EL. ${el.toFixed(2)} m</b></td></tr>
                    <tr><td style="color: #666;">풍화암 상단</td><td style="text-align: right;">EL. ${(layerInfo.weatheredRockTop || 0).toFixed(2)} m</td></tr>
                    <tr><td style="color: #666;">연암 상단</td><td style="text-align: right;">EL. ${(layerInfo.softRockTop || 0).toFixed(2)} m</td></tr>
            `;

            if (result && result.pileLength > 0) {
                const embedLayer = result.pileTipLevel > layerInfo.softRockTop ? '풍화암' : '연암';
                const embedDepth = result.pileTipLevel > layerInfo.softRockTop
                    ? (layerInfo.weatheredRockTop - result.pileTipLevel).toFixed(1)
                    : (layerInfo.softRockTop - result.pileTipLevel).toFixed(1);
                html += `
                    <tr style="border-top: 1px solid #e0e0e0;"><td colspan="2" style="padding-top: 6px; color: #1565C0; font-weight: 600;">말뚝 설계</td></tr>
                    <tr><td style="color: #666;">말뚝장</td><td style="text-align: right;"><b>${result.pileLength.toFixed(1)} m</b></td></tr>
                    <tr><td style="color: #666;">선단 표고</td><td style="text-align: right;">EL. ${result.pileTipLevel.toFixed(2)} m</td></tr>
                    <tr><td style="color: #666;">근입층</td><td style="text-align: right; color: #D84315;"><b>${embedLayer}</b></td></tr>
                    <tr><td style="color: #666;">근입 깊이</td><td style="text-align: right;">${embedDepth} m</td></tr>
                    <tr><td style="color: #666;">허용지지력</td><td style="text-align: right;"><b>${result.Qa.toFixed(0)} kN</b></td></tr>
                `;
            }
            html += '</table>';

            detailDiv.innerHTML = html;
            infoPanel.style.display = 'block';
        }

        function reset3DPlotlyView() {
            const container = document.getElementById('3dPlotlyContainer');
            if (container && typeof Plotly !== 'undefined') {
                Plotly.relayout(container, { 'scene.camera': { eye: { x: 1.5, y: 1.5, z: 1.0 }, center: { x: 0, y: 0, z: -0.1 } } });
            }
        }

        function update3DPlotlySidePanel() {
            const projectInfoDiv = document.getElementById('3dProjectInfo');
            if (projectInfoDiv && boreholeData.length > 0) {
                const firstBH = boreholeData[0];
                projectInfoDiv.innerHTML = `
                    <div style="margin-bottom: 4px;"><strong>프로젝트:</strong> ${firstBH.metadata?.PROJECT_NAME || '미입력'}</div>
                    <div style="margin-bottom: 4px;"><strong>위치:</strong> ${firstBH.metadata?.LOCATION || '미입력'}</div>
                    <div><strong>시추공 수:</strong> ${boreholeData.length}개</div>
                `;
            }

            // 범례는 updateLegend3DPanel() 함수에서 관리
            updateLegend3DPanel();

            const designSummaryDiv = document.getElementById('3dDesignSummary');
            if (designSummaryDiv && calculationResults.length > 0) {
                const validResults = calculationResults.filter(r => r.pileLength > 0);
                const avgQa = validResults.length > 0 ? validResults.reduce((s,r) => s + (r.Qa||0), 0) / validResults.length : 0;
                const avgLength = validResults.length > 0 ? validResults.reduce((s,r) => s + (r.pileLength||0), 0) / validResults.length : 0;
                const pile = getCurrentPile();
                designSummaryDiv.innerHTML = `
                    <div style="margin-bottom:4px;"><strong>말뚝:</strong> ${pile.type==='phc'?'PHC':'강관'} ${(pile.diameter*1000).toFixed(0)}mm</div>
                    <div style="margin-bottom:4px;"><strong>설계:</strong> ${validResults.length}/${boreholeData.length}개</div>
                    <div style="margin-bottom:4px;"><strong>평균 Qa:</strong> ${avgQa.toFixed(0)} kN</div>
                    <div><strong>평균 말뚝장:</strong> ${avgLength.toFixed(1)}m</div>
                `;
            }

            const bhListDiv = document.getElementById('3dBoreholeList');
            if (bhListDiv) {
                let html = '';
                boreholeData.forEach((bh, idx) => {
                    const result = calculationResults.find(r => r.borehole === bh.hole_no);
                    const hasResult = result && result.pileLength > 0;
                    html += `<button onclick="select3DBorehole(${idx})" style="
                        padding: 4px 8px; font-size: 10px; border: 1px solid #ddd; border-radius: 4px;
                        background: #f5f5f5; color: #333; cursor: pointer; display: flex; flex-direction: column;
                        align-items: center; min-width: 50px; transition: all 0.2s;
                    " onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background=this.dataset.selected==='true'?'#1565C0':'#f5f5f5'">
                        <span style="font-weight: 600;">${bh.hole_no || 'BH-'+(idx+1)}</span>
                        ${hasResult ? `<span style="font-size: 9px; color: #2e7d32;">${result.pileLength.toFixed(1)}m</span>` : ''}
                    </button>`;
                });
                bhListDiv.innerHTML = html;
            }
        }

        // 레거시 함수 스텁 (호환성 유지) - 더 이상 사용하지 않지만 호출 시 오류 방지
        function init3DScene() {
            // Three.js 코드 제거됨 - Plotly.js 사용
            console.log('init3DScene deprecated - using Plotly.js instead');
        }


        // 말뚝 지지력 산정 불가 메시지 표시 함수
        function showInvalidCalculationMessage(result) {
            const excavation = result.excavation || 0;
            const elevation = result.elevation || 0;
            const pileLength = result.pileLength || 0;
            const pileTipLevel = result.pileTipLevel || 0;

            // 산정 불가 사유 메시지
            const invalidMessage = `
                <div class="invalid-calculation-notice" style="
                    background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%);
                    border: 2px solid #c62828;
                    border-radius: 12px;
                    padding: 30px;
                    margin: 20px 0;
                    text-align: center;
                ">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                    <h3 style="color: #c62828; margin: 0 0 15px 0; font-size: 1.5rem;">말뚝 지지력 산정 불가</h3>
                    <p style="color: #666; margin: 0 0 20px 0; font-size: 1.1rem;">
                        ${result.invalidReason || '계획고가 지지층 상단보다 낮아 말뚝 설치가 불필요합니다.'}
                    </p>
                    <div style="
                        background: #fff;
                        border-radius: 8px;
                        padding: 15px;
                        display: inline-block;
                        text-align: left;
                    ">
                        <table style="border-collapse: collapse; font-size: 0.95rem;">
                            <tr>
                                <td style="padding: 5px 15px; color: #666;">지표고:</td>
                                <td style="padding: 5px 15px; font-weight: 600;">EL. ${elevation.toFixed(2)} m</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 15px; color: #666;">계획고:</td>
                                <td style="padding: 5px 15px; font-weight: 600;">EL. ${excavation.toFixed(2)} m</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 15px; color: #666;">선단 레벨:</td>
                                <td style="padding: 5px 15px; font-weight: 600;">EL. ${pileTipLevel.toFixed(2)} m</td>
                            </tr>
                            <tr style="color: #c62828;">
                                <td style="padding: 5px 15px; border-top: 1px solid #ddd;">산정 말뚝 길이:</td>
                                <td style="padding: 5px 15px; font-weight: 700; border-top: 1px solid #ddd;">${pileLength.toFixed(2)} m (무효)</td>
                            </tr>
                        </table>
                    </div>
                    <p style="color: #888; margin: 20px 0 0 0; font-size: 0.9rem;">
                        계획고를 조정하거나 지지층 설정을 확인해 주세요.
                    </p>
                </div>
            `;

            // 모든 계산 영역에 산정 불가 메시지 표시
            document.getElementById('lengthCalc1').innerHTML = '';
            document.getElementById('lengthCalc2').innerHTML = '';
            document.getElementById('lengthCalc3').innerHTML = '';
            document.getElementById('lengthResult').innerHTML = invalidMessage;

            // 주면마찰력 영역
            document.getElementById('skinFrictionDetails').innerHTML = '';
            document.getElementById('skinFrictionTotal').innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';

            // 주면마찰력 테이블
            const tableBody = document.getElementById('skinFrictionDetailTableBody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999; padding: 30px;">말뚝 길이가 0 이하로 산정 불가</td></tr>';
            }

            // 선단지지력 영역
            const endBearingDetails = document.getElementById('endBearingDetails');
            if (endBearingDetails) {
                endBearingDetails.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';
            }

            // 허용지지력 영역
            const allowableCapacity = document.getElementById('allowableCapacity');
            if (allowableCapacity) {
                allowableCapacity.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';
            }

            // 침하량 영역
            const settlementDetails = document.getElementById('settlementDetails');
            if (settlementDetails) {
                settlementDetails.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';
            }

            // 수평지지력 영역
            const horizontalDetails = document.getElementById('horizontalDetails');
            if (horizontalDetails) {
                horizontalDetails.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';
            }

            // 인발저항력 영역
            const upliftDetails = document.getElementById('upliftDetails');
            if (upliftDetails) {
                upliftDetails.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">산정 불가</div>';
            }

            // MathJax 재렌더링 (필요시)
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise();
            }
        }

        function updateCalculations() {
            if (!calculationResults || calculationResults.length === 0) return;

            const selectIndex = document.getElementById('calcBoreholeSelect').value || 0;
            const result = calculationResults[selectIndex];

            if (!result) return;

            document.getElementById('calcBorehole').textContent = result.borehole || 'Unknown';

            // 말뚝 길이가 0 이하인 경우 - 산정 불가 메시지 표시
            if (result.isInvalid || result.pileLength <= 0) {
                showInvalidCalculationMessage(result);
                return;
            }

            // Update pile length calculation with null checks
            const excavation = result.excavation || 0;
            const elevation = result.elevation || 0;
            const pileLength = result.pileLength || 0;
            const pileTipLevel = result.pileTipLevel || 0;
            // Bearing elevation is 1m above pile tip (since pile penetrates 1m into bearing layer)
            const bearingElevation = pileTipLevel + 1.0;

            document.getElementById('lengthCalc1').innerHTML =
                `작업면 표고: $EL_{start} = ${excavation.toFixed(1)}$ m`;
            document.getElementById('lengthCalc2').innerHTML =
                `지지층 상단: $EL_{bearing} = ${bearingElevation.toFixed(1)}$ m (${result.bearingLayer ? result.bearingLayer.soil_name : '지지층'})`;
            document.getElementById('lengthCalc3').innerHTML =
                `근입 깊이: $P_{penetration} = ${parseFloat(document.getElementById('penetrationDepth')?.value || 1.0).toFixed(1)}$ m (구조물 기초 설계 기준 규정)`;
            document.getElementById('lengthResult').innerHTML =
                `$$L_{pile} = EL_{start} - EL_{tip} = ${excavation.toFixed(1)} - ${pileTipLevel.toFixed(1)} = ${pileLength.toFixed(1)} \\text{ m}$$`;
            
            // Update skin friction details - Mathcad style with detailed formula breakdown
            let skinFrictionHTML = '';
            const pile = getCurrentPile();
            const D = pile.diameter;
            const method = document.getElementById('constructionMethod').value;
            const methodFactor = method === 'driven' ? 1.0 : 0.7;
            const methodName = method === 'driven' ? '타입말뚝' : '매입말뚝';

            // 현재 적용 중인 계수 읽기 (입력 검토 탭에서 설정한 값)
            const betaSandForDisplay = parseFloat(document.getElementById('betaSand')?.value) || 2.0;
            const betaClayForDisplay = parseFloat(document.getElementById('betaClay')?.value) || 6.25;

            if (result.skinFrictionDetails && Array.isArray(result.skinFrictionDetails)) {
                // Show first few layers with detailed calculation
                const showDetailCount = Math.min(3, result.skinFrictionDetails.length);
                for (let index = 0; index < showDetailCount; index++) {
                    const detail = result.skinFrictionDetails[index];
                    // soilType을 사용하여 점성토/사질토 판별 (온톨로지 기반)
                    const isClay = detail.soilType === 'clay';
                    const soilTypeLabel = isClay ? '점성토' : '사질토';
                    const betaValue = isClay ? betaClayForDisplay : betaSandForDisplay;

                    skinFrictionHTML += `
                        <div class="calc-substitution" style="margin-top: 10px; font-weight: 600;">
                            ▶ 구간 ${index + 1}: ${detail.depth}m (${detail.layer})
                        </div>
                    `;

                    // 계산식 표현 - 입력 검토 탭의 계수 값 사용
                    const N = detail.N || 0;
                    const thickness = detail.thickness || 0;
                    const fs = detail.fs || 0;
                    const As = detail.As || 0;
                    const Qs = detail.Qs || 0;
                    const fs_raw = betaValue * N;
                    const fs_final = fs_raw * methodFactor;

                    skinFrictionHTML += `
                        <div class="calc-intermediate" style="margin-left: 20px;">
                            ${soilTypeLabel}: $f_s = \\beta \\times N \\times \\text{시공계수}$<br>
                            $f_s = ${betaValue} \\times ${N} \\times ${methodFactor} = ${fs_final.toFixed(1)}$ kPa
                        </div>
                    `;

                    skinFrictionHTML += `
                        <div class="calc-intermediate" style="margin-left: 20px;">
                            $A_s = \\pi \\times D \\times L_i = \\pi \\times ${D} \\times ${thickness.toFixed(2)} = ${As.toFixed(3)}$ m²<br>
                            $Q_{s,${index+1}} = f_s \\times A_s = ${fs.toFixed(1)} \\times ${As.toFixed(3)} = ${Qs.toFixed(1)}$ kN
                        </div>
                    `;
                }

                if (result.skinFrictionDetails.length > showDetailCount) {
                    skinFrictionHTML += `
                        <div class="calc-substitution" style="margin-top: 10px; color: #666;">
                            ... 나머지 ${result.skinFrictionDetails.length - showDetailCount}개 구간은 아래 테이블 참조 ...
                        </div>
                    `;
                }
            }
            document.getElementById('skinFrictionDetails').innerHTML = skinFrictionHTML;
            document.getElementById('skinFrictionTotal').innerHTML =
                `<strong>총 주면마찰력:</strong> $$Q_s = \\sum_{i=1}^{n} f_{s,i} \\times A_{s,i} = ${(result.Qs || 0).toFixed(1)} \\text{ kN}$$`;
            
            // Update skin friction detail table (사질토/점성토 구분)
            const tableBody = document.getElementById('skinFrictionDetailTableBody');
            if (tableBody && result.skinFrictionDetails && Array.isArray(result.skinFrictionDetails)) {
                let tableHTML = '';
                let cumulativeQs = 0;
                let cumulativePileLength = 0;  // 누적 말뚝 길이
                let totalQs_sand = 0;
                let totalQs_clay = 0;

                // 현재 적용 중인 계수 읽기
                const betaSandValue = parseFloat(document.getElementById('betaSand')?.value) || 2.0;
                const betaClayValue = parseFloat(document.getElementById('betaClay')?.value) || 6.25;
                const pileD = pile.diameter;
                const methodFactor = method === 'driven' ? 1.0 : 0.7;

                // 작업면 표고 (말뚝 두부 위치)
                const excavationEL = result.excavation || 0;

                result.skinFrictionDetails.forEach((detail, index) => {
                    cumulativeQs += detail.Qs || 0;
                    const isClay = detail.soilType === 'clay';
                    const soilTypeLabel = isClay ? '점성토' : '사질토';
                    const soilTypeColor = isClay ? '#fafafa' : '#f8f8f8';  // 차분한 색상
                    const betaValue = isClay ? betaClayValue : betaSandValue;

                    if (isClay) {
                        totalQs_clay += detail.Qs || 0;
                    } else {
                        totalQs_sand += detail.Qs || 0;
                    }

                    // 상세 계산 정보 생성
                    const N = detail.N || 0;
                    const thickness = detail.thickness || 0;
                    const fs = detail.fs || 0;
                    const As = detail.As || 0;
                    const Qs = detail.Qs || 0;

                    // 누적 말뚝 길이 계산
                    cumulativePileLength += thickness;

                    // 깊이 정보를 EL(표고)로 변환
                    // detail.depth는 "0.0-1.0" 형식이므로 파싱
                    const depthParts = detail.depth.split('-');
                    const depthFrom = parseFloat(depthParts[0]) || 0;
                    const depthTo = parseFloat(depthParts[1]) || depthFrom + thickness;
                    const elFrom = (excavationEL - depthFrom).toFixed(1);
                    const elTo = (excavationEL - depthTo).toFixed(1);

                    // fs 계산 상세
                    const fsTooltip = `
                        <div class="calc-tooltip-title">주면마찰응력 (fs) 계산</div>
                        <div class="calc-tooltip-formula">fs = β × N × 시공보정계수</div>
                        <div class="calc-tooltip-step">• β (${soilTypeLabel}) = ${betaValue}</div>
                        <div class="calc-tooltip-step">• N값 = ${N}</div>
                        <div class="calc-tooltip-step">• 시공보정계수 = ${methodFactor} (${method === 'driven' ? '타입' : '매입'})</div>
                        <div class="calc-tooltip-result">fs = ${betaValue} × ${N} × ${methodFactor} = ${fs.toFixed(1)} kPa</div>
                    `;

                    // As 계산 상세
                    const AsTooltip = `
                        <div class="calc-tooltip-title">주면적 (As) 계산</div>
                        <div class="calc-tooltip-formula">As = π × D × t</div>
                        <div class="calc-tooltip-step">• D (말뚝 직경) = ${pileD} m</div>
                        <div class="calc-tooltip-step">• t (구간 두께) = ${thickness.toFixed(2)} m</div>
                        <div class="calc-tooltip-result">As = π × ${pileD} × ${thickness.toFixed(2)} = ${As.toFixed(3)} m²</div>
                    `;

                    // Qs 계산 상세
                    const QsTooltip = `
                        <div class="calc-tooltip-title">주면마찰력 (Qs) 계산</div>
                        <div class="calc-tooltip-formula">Qs = fs × As</div>
                        <div class="calc-tooltip-step">• fs = ${fs.toFixed(1)} kPa</div>
                        <div class="calc-tooltip-step">• As = ${As.toFixed(3)} m²</div>
                        <div class="calc-tooltip-result">Qs = ${fs.toFixed(1)} × ${As.toFixed(3)} = ${Qs.toFixed(1)} kN</div>
                    `;

                    // 누적 계산 상세
                    const prevCumulative = cumulativeQs - Qs;
                    const cumTooltip = `
                        <div class="calc-tooltip-title">누적 주면마찰력</div>
                        <div class="calc-tooltip-formula">ΣQs = 이전 누적 + 현 구간</div>
                        <div class="calc-tooltip-step">• 이전 누적 = ${prevCumulative.toFixed(1)} kN</div>
                        <div class="calc-tooltip-step">• 현 구간 Qs = ${Qs.toFixed(1)} kN</div>
                        <div class="calc-tooltip-result">ΣQs = ${prevCumulative.toFixed(1)} + ${Qs.toFixed(1)} = ${cumulativeQs.toFixed(1)} kN</div>
                    `;

                    // 말뚝길이 상세 (구간 두께 + 누적)
                    const prevPileLength = cumulativePileLength - thickness;
                    const pileLengthTooltip = `
                        <div class="calc-tooltip-title">말뚝 길이 (누적)</div>
                        <div class="calc-tooltip-step">• 현 구간 두께 = ${thickness.toFixed(2)} m</div>
                        <div class="calc-tooltip-step">• 이전 누적 = ${prevPileLength.toFixed(2)} m</div>
                        <div class="calc-tooltip-result">누적 길이 = ${cumulativePileLength.toFixed(2)} m</div>
                    `;

                    // 샘플 정보 표시
                    const sampleInfo = detail.sampleInfo;
                    const sampleDisplay = sampleInfo
                        ? `<br><span style="font-size:0.75em;color:#888;">${sampleInfo.sampleNo || ''} (${sampleInfo.hits})</span>`
                        : '';
                    const nValueTitle = sampleInfo
                        ? `${sampleInfo.sampleNo || ''} @${sampleInfo.depth}m: ${sampleInfo.hits} → N=${N}`
                        : `보간값: N=${N}`;

                    // 새로운 컬럼 순서: 토층명, 깊이(EL,m), 토질분류, 말뚝길이(m), N값, β, fs, As, Qs, 누적
                    tableHTML += `
                        <tr style="background-color: ${soilTypeColor};">
                            <td>${detail.layer}${sampleDisplay}</td>
                            <td>EL.${elFrom}~${elTo}</td>
                            <td style="font-weight: 500; color: ${isClay ? '#455a64' : '#5d4037'};">${soilTypeLabel}</td>
                            <td class="calc-tooltip">
                                <span class="calc-tooltip-trigger">${thickness.toFixed(2)}<br><small style="color:#666;">(Σ${cumulativePileLength.toFixed(1)})</small></span>
                                <div class="calc-tooltip-content">${pileLengthTooltip}</div>
                            </td>
                            <td title="${nValueTitle}">${N}</td>
                            <td>${betaValue}</td>
                            <td class="calc-tooltip">
                                <span class="calc-tooltip-trigger">${fs.toFixed(1)}</span>
                                <div class="calc-tooltip-content">${fsTooltip}</div>
                            </td>
                            <td class="calc-tooltip">
                                <span class="calc-tooltip-trigger">${As.toFixed(3)}</span>
                                <div class="calc-tooltip-content">${AsTooltip}</div>
                            </td>
                            <td class="calc-tooltip">
                                <span class="calc-tooltip-trigger">${Qs.toFixed(1)}</span>
                                <div class="calc-tooltip-content">${QsTooltip}</div>
                            </td>
                            <td class="calc-tooltip">
                                <strong class="calc-tooltip-trigger">${cumulativeQs.toFixed(1)}</strong>
                                <div class="calc-tooltip-content">${cumTooltip}</div>
                            </td>
                        </tr>
                    `;
                });

                // 합계 행 추가 - 현재 설정된 계수 값 표시
                tableHTML += `
                    <tr style="background-color: #f5f5f5; font-weight: 600;">
                        <td colspan="3" style="text-align: right;">총 말뚝 길이:</td>
                        <td>${cumulativePileLength.toFixed(2)} m</td>
                        <td colspan="4" style="text-align: right;">사질토 합계 (βs=${betaSandValue}):</td>
                        <td colspan="2">${totalQs_sand.toFixed(1)} kN</td>
                    </tr>
                    <tr style="background-color: #f5f5f5; font-weight: 600;">
                        <td colspan="4"></td>
                        <td colspan="4" style="text-align: right;">점성토 합계 (βc=${betaClayValue}):</td>
                        <td colspan="2">${totalQs_clay.toFixed(1)} kN</td>
                    </tr>
                    <tr style="background-color: #e8f5e9; font-weight: 700;">
                        <td colspan="4"></td>
                        <td colspan="4" style="text-align: right;">총 주면마찰력 (Qs):</td>
                        <td colspan="2">${cumulativeQs.toFixed(1)} kN</td>
                    </tr>
                `;
                tableBody.innerHTML = tableHTML;

                // 범례의 계수값도 업데이트
                const legendBetaSand = document.getElementById('legendBetaSand');
                const legendBetaClay = document.getElementById('legendBetaClay');
                if (legendBetaSand) legendBetaSand.textContent = betaSandValue;
                if (legendBetaClay) legendBetaClay.textContent = betaClayValue;
            }

            // Update end bearing - Mathcad style with detailed calculation
            const Ap = Math.PI * pile.diameter * pile.diameter / 4;
            const Qp = result.Qp || 0;
            const endBearingCoeff = result.endBearingCoeff || parseFloat(document.getElementById('endBearingCoefficient').value) || 300;
            const tipN = result.bearingLayer ? getAverageN(result.bearingLayer) : 50;
            const methodForEndBearing = document.getElementById('constructionMethod').value;
            const qpLimit = methodForEndBearing === 'driven' ? 15000 : 12000;
            const qp_raw = endBearingCoeff * tipN;
            const qp_calculated = Math.min(qp_raw, qpLimit);
            const bearingLayerName = result.bearingLayer ? result.bearingLayer.soil_name : '풍화암';

            // Update formula display
            const endBearingFormulaEl = document.getElementById('endBearingFormula');
            if (endBearingFormulaEl) {
                endBearingFormulaEl.innerHTML = `
                    선단지지력 계산 (${methodForEndBearing === 'driven' ? '타입말뚝' : '매입말뚝'}):
                    $$q_p = C_{end} \\times N_{tip}$$
                    <div style="font-size: 0.9rem; color: #666; margin-top: 5px;">
                        $C_{end} = ${endBearingCoeff}$ kN/m², 상한값 = ${qpLimit.toLocaleString()} kPa
                    </div>
                `;
            }

            // Update N value display with explanation
            document.getElementById('endBearingCalc').innerHTML =
                `지지층 N값: $N_{tip} = ${tipN}$ (${bearingLayerName}, 선단부 상부 1D~하부 4D 평균)`;

            // Update area calculation with formula
            document.getElementById('endBearingCalc2').innerHTML =
                `선단 단면적: $A_p = \\frac{\\pi \\times D^2}{4} = \\frac{\\pi \\times ${pile.diameter}^2}{4} = ${Ap.toFixed(4)}$ m²`;

            // Update qp calculation with limit check
            const endBearingCalc3El = document.getElementById('endBearingCalc3');
            if (endBearingCalc3El) {
                if (qp_raw > qpLimit) {
                    endBearingCalc3El.innerHTML =
                        `$q_p = ${endBearingCoeff} \\times ${tipN} = ${qp_raw.toLocaleString()}$ kPa > ${qpLimit.toLocaleString()} kPa<br>
                         <span style="color: #f57c00;">→ 상한값 적용: $q_p = ${qpLimit.toLocaleString()}$ kPa</span>`;
                } else {
                    endBearingCalc3El.innerHTML =
                        `$q_p = C_{end} \\times N_{tip} = ${endBearingCoeff} \\times ${tipN} = ${qp_calculated.toLocaleString()}$ kPa ≤ ${qpLimit.toLocaleString()} kPa ✓`;
                }
            }

            // Update final result with box display
            document.getElementById('endBearingResult').innerHTML =
                `$$Q_p = q_p \\times A_p = ${qp_calculated.toLocaleString()} \\times ${Ap.toFixed(4)} = ${Qp.toFixed(1)} \\text{ kN}$$`;
            
            // Update capacity - Mathcad style with step-by-step calculation
            const Qs = result.Qs || 0;
            const Qu = result.Qu || 0;
            const Qa = result.Qa || 0;
            const FSv = parseFloat(document.getElementById('sfVertical').value) || 3.0;

            document.getElementById('ultimateCalc').innerHTML =
                `극한지지력: $$Q_u = Q_s + Q_p = ${Qs.toFixed(1)} + ${Qp.toFixed(1)} = ${Qu.toFixed(1)} \\text{ kN}$$`;
            document.getElementById('allowableCalc').innerHTML =
                `지반 허용지지력: $$Q_{a,soil} = \\frac{Q_u}{FS_v} = \\frac{${Qu.toFixed(1)}}{${FSv}} = ${(Qu/FSv).toFixed(1)} \\text{ kN}$$`;
            
            // Update splice calculation detail
            const spliceMethod = result.spliceMethod || document.getElementById('spliceMethod').value;
            const numberOfSplices = result.numberOfSplices || 0;
            const spliceReductionRate = result.spliceReductionRate || 0;
            const spliceDetails = result.spliceDetails || [];
            const spliceFactor = result.spliceFactor || 1.0;
            const baseAllowable = pile.allowable || 0;
            const PILE_UNIT_LENGTH = 15.0;
            
            let spliceDescription = '';
            
            if (spliceMethod === 'none' || numberOfSplices === 0) {
                spliceDescription = `이음 없음: $Q_{a,material} = ${baseAllowable.toFixed(0)}$ kN (감소 없음)`;
            } else {
                // 이음 개소 산정
                spliceDescription = `말뚝 길이: $L = ${pileLength.toFixed(1)}$ m<br>`;
                spliceDescription += `말뚝 한 본당 길이: $L_{unit} = ${PILE_UNIT_LENGTH}$ m<br>`;
                spliceDescription += `이음 개소 수: $n = \\lfloor ${pileLength.toFixed(1)} / ${PILE_UNIT_LENGTH} \\rfloor = ${numberOfSplices}$ 개소<br><br>`;
                
                // 이음 방법별 감소율
            if (spliceMethod === 'welding') {
                    spliceDescription += `용접 이음: 개소당 5% 감소<br>`;
                    spliceDescription += `총 감소율: $R_{total} = ${numberOfSplices} \\times 5 = ${spliceReductionRate.toFixed(1)}$%<br>`;
            } else if (spliceMethod === 'bolting') {
                    spliceDescription += `볼트식 이음: 개소당 10% 감소<br>`;
                    spliceDescription += `총 감소율: $R_{total} = ${numberOfSplices} \\times 10 = ${spliceReductionRate.toFixed(1)}$%<br>`;
                } else if (spliceMethod === 'filled') {
                    spliceDescription += `충전식 이음: 최초 2개소 20%/개소, 3개소째 30%/개소<br>`;
                    let detailText = '';
                    spliceDetails.forEach((rate, idx) => {
                        if (idx > 0) detailText += ' + ';
                        detailText += `${rate.toFixed(0)}`;
                    });
                    spliceDescription += `총 감소율: $R_{total} = ${detailText} = ${spliceReductionRate.toFixed(1)}$%<br>`;
                }
                
                spliceDescription += `<br>재료 허용지지력 감소:<br>`;
                spliceDescription += `$Q_{a,material} = ${baseAllowable.toFixed(0)} \\times (1 - ${spliceReductionRate.toFixed(1)}/100) = ${baseAllowable.toFixed(0)} \\times ${spliceFactor.toFixed(3)} = ${(baseAllowable * spliceFactor).toFixed(0)}$ kN`;
            }
            
            document.getElementById('spliceCalcDetail').innerHTML = spliceDescription;
            document.getElementById('materialCalc').innerHTML = 
                `재료 허용지지력: $Q_{a,material} = ${(baseAllowable * spliceFactor).toFixed(0)}$ kN (${pile.spec || 'PHC 500-B'})`;
            
            const Qa_soil = result.Qa_soil || (Qu / FSv);
            const Qa_material = result.Qa_material || (baseAllowable * spliceFactor);
            document.getElementById('finalCapacity').innerHTML = 
                `최종 허용지지력: $Q_a = min(${Qa_soil.toFixed(0)}, ${Qa_material.toFixed(0)}) = ${Qa.toFixed(0)}$ kN`;
            
            // Update settlement (using allowable capacity) - Mathcad style with 3-component method
            const Q_settle = result.Qa || 0; // Use allowable capacity
            const Se = result.Se || 0;
            const Ss_display = result.Ss || 0;
            const Sp_display = result.Sp || 0;
            const Sps_display = result.Sps || 0;
            const Sc = result.Sc || 0;
            const St = result.St || 0;

            // Calculate load distribution ratio (허용지지력 기준)
            const Rp_display = Qp / FSv; // 허용 선단지지력
            const Rf_display = Qs / FSv; // 허용 주면마찰력
            const tipRatio = (Rp_display + Rf_display) > 0 ? Rp_display / (Rp_display + Rf_display) : 0.5;
            const shaftRatio = 1 - tipRatio;
            const Qps = Q_settle * tipRatio; // Load to tip
            const Qfs = Q_settle * shaftRatio; // Load to shaft

            // 침하량 계수 가져오기 (입력 검토 탭에서 설정된 값)
            const settlementCoeffsDisplay = getSettlementCoefficients();
            const alpha_s = settlementCoeffsDisplay.alphaS;
            const Cp = settlementCoeffsDisplay.Cp;

            // Get elastic modulus based on pile type
            // 구조물 기초 설계기준 해설 표 5.3.10 기준
            let E_display, E_display_MPa;
            if (pile.type === 'steel') {
                // 강관말뚝: 2.00×10⁸ kN/m² = 200,000 MPa
                E_display = PILE_ELASTIC_MODULUS.STEEL.E_kPa;
                E_display_MPa = PILE_ELASTIC_MODULUS.STEEL.E_MPa;
            } else {
                // PC 및 PHC 말뚝: 3.92×10⁷ kN/m² = 39,200 MPa
                E_display = PILE_ELASTIC_MODULUS.PHC.E_kPa;
                E_display_MPa = PILE_ELASTIC_MODULUS.PHC.E_MPa;
            }

            // Update settlement calculation displays with Mathcad style
            document.getElementById('elasticCalc1').innerHTML =
                `허용지지력 (하중 분담 기반): $Q_a = ${Q_settle.toFixed(0)}$ kN<br>
                 하중 분담비: 선단 ${(tipRatio * 100).toFixed(1)}%, 주면 ${(shaftRatio * 100).toFixed(1)}%<br>
                 $Q_{ps} = ${Q_settle.toFixed(0)} \\times ${tipRatio.toFixed(3)} = ${Qps.toFixed(1)}$ kN (선단 전달)<br>
                 $Q_{fs} = ${Q_settle.toFixed(0)} \\times ${shaftRatio.toFixed(3)} = ${Qfs.toFixed(1)}$ kN (주면 전달)`;

            document.getElementById('elasticCalc2').innerHTML = `말뚝 길이: $L = ${pileLength.toFixed(1)}$ m`;

            // 단면적 상세 계산 표시 (중공 단면 - 두께 반영)
            const t_display = pile.thickness || 0.08;
            const D_outer = pile.diameter;
            const D_inner = D_outer - 2 * t_display;
            const A_calculated = Math.PI / 4 * (D_outer * D_outer - D_inner * D_inner);
            document.getElementById('elasticCalc3').innerHTML =
                `단면적 (중공 단면):<br>
                 $A_p = \\frac{\\pi}{4} \\times (D_o^2 - D_i^2) = \\frac{\\pi}{4} \\times (${D_outer}^2 - ${D_inner.toFixed(3)}^2)$<br>
                 <span style="margin-left: 20px;">= ${A_calculated.toFixed(4)} m² (외경 D=${D_outer}m, 두께 t=${t_display}m)</span><br>
                 <span style="font-size: 0.85rem; color: #666;">※ 실제 적용값: ${pile.area} m² (말뚝 제원표 기준)</span>`;

            // 탄성계수 상세 근거 표시
            const pileTypeLabel = pile.type === 'steel' ? '강관말뚝' : 'PHC 말뚝';
            document.getElementById('elasticCalc4').innerHTML =
                `탄성계수 (구조물기초설계기준해설 표 5.3.10):<br>
                 $E_p = ${E_display_MPa.toLocaleString()}$ MPa = ${E_display.toExponential(2)} kPa<br>
                 <span style="font-size: 0.85rem; color: #666;">※ ${pileTypeLabel}: ${pile.type === 'steel' ? '2.00×10⁸ kN/m²' : '3.92×10⁷ kN/m² (콘크리트 fck=80MPa 기준)'}</span>`;

            document.getElementById('elasticCalc5').innerHTML =
                `$$S_s = \\frac{(Q_{ps} + \\alpha_s \\cdot Q_{fs}) \\times L}{A_p \\times E_p} = \\frac{(${Qps.toFixed(1)} + ${alpha_s} \\times ${Qfs.toFixed(1)}) \\times ${pileLength.toFixed(1)}}{${pile.area} \\times ${E_display.toLocaleString()}} \\times 1000$$
                 $$= ${Ss_display.toFixed(2)} \\text{ mm}$$`;

            // Update tip settlement with detailed calculation
            const qp_settle = qp_calculated || 15000;
            document.getElementById('tipCalc1').innerHTML =
                `선단 전달 하중: $Q_{ps} = ${Qps.toFixed(1)}$ kN`;
            document.getElementById('tipCalc2').innerHTML =
                `경험계수: $C_p = ${Cp}$ (매입말뚝, 사질토/풍화암)`;
            document.getElementById('tipCalc3').innerHTML =
                `말뚝 직경: $D = ${pile.diameter}$ m`;
            document.getElementById('tipCalc4').innerHTML =
                `$$S_p = \\frac{C_p \\times Q_{ps}}{D \\times q_p} \\times 1000 = \\frac{${Cp} \\times ${Qps.toFixed(1)}}{${pile.diameter} \\times ${qp_settle.toLocaleString()}} \\times 1000 = ${Sp_display.toFixed(2)} \\text{ mm}$$`;

            // Update shaft settlement (Sps) calculation - new elements
            const Cs = (0.93 + 0.16 * Math.sqrt(pileLength / pile.diameter)) * Cp;
            const Sps = pileLength > 0 && qp_settle > 0 ? (Qfs * Cs) / (pileLength * qp_settle) * 1000 : 0;

            const shaftSettleCalc1El = document.getElementById('shaftSettleCalc1');
            if (shaftSettleCalc1El) {
                shaftSettleCalc1El.innerHTML =
                    `주면 전달 하중: $Q_{fs} = ${Qfs.toFixed(1)}$ kN`;
            }

            const shaftSettleCalc2El = document.getElementById('shaftSettleCalc2');
            if (shaftSettleCalc2El) {
                shaftSettleCalc2El.innerHTML =
                    `$C_s = (0.93 + 0.16\\sqrt{L/D}) \\times C_p = (0.93 + 0.16\\sqrt{${pileLength.toFixed(1)}/${pile.diameter}}) \\times ${Cp} = ${Cs.toFixed(4)}$`;
            }

            const shaftSettleCalc3El = document.getElementById('shaftSettleCalc3');
            if (shaftSettleCalc3El) {
                shaftSettleCalc3El.innerHTML =
                    `$$S_{ps} = \\frac{Q_{fs} \\times C_s}{L \\times q_p} \\times 1000 = \\frac{${Qfs.toFixed(1)} \\times ${Cs.toFixed(4)}}{${pileLength.toFixed(1)} \\times ${qp_settle.toLocaleString()}} \\times 1000 = ${Sps_display.toFixed(2)} \\text{ mm}$$`;
            }

            const allowableSettlement = settlementCoeffsDisplay.allowableSettlement;
            const isPass = St <= allowableSettlement;
            document.getElementById('settlementTotal').innerHTML =
                `<strong>총 침하량 산정 (Vesic 3성분법):</strong><br>
                 $$S_t = S_s + S_p + S_{ps}$$
                 $$= ${Ss_display.toFixed(2)} + ${Sp_display.toFixed(2)} + ${Sps_display.toFixed(2)} = ${St.toFixed(2)} \\text{ mm}$$
                 <div style="margin-top: 15px; padding: 12px; background: ${isPass ? '#e8f5e9' : '#ffebee'}; border-left: 3px solid ${isPass ? 'var(--status-pass)' : 'var(--status-fail)'}; border-radius: 4px;">
                     <span style="font-size: 1.1rem;">
                         ${isPass ?
                             `총 침하량 ${St.toFixed(2)} mm ≤ 허용침하량 ${allowableSettlement} mm` :
                             `총 침하량 ${St.toFixed(2)} mm > 허용침하량 ${allowableSettlement} mm`}
                         <br><strong style="color: ${isPass ? 'var(--status-pass)' : 'var(--status-fail)'};">
                             ∴ ${isPass ? '적합 (OK)' : '부적합 (NG)'}
                         </strong>
                     </span>
                 </div>`;
            
            // Update horizontal capacity calculation
            if (result.horizontalCapacity) {
                const hc = result.horizontalCapacity;
                const pile = getCurrentPile();
                const D = pile.diameter;
                const L = result.pileLength || 0;
                const t_pile = pile.thickness || 0.08;
                const D_inner_calc = D - 2 * t_pile;

                // 4-1: 지반반력계수 상세 표시
                let khDetailHTML = `지반반력계수: $k_h = ${hc.kh.toFixed(0)}$ kN/m³`;
                if (hc.khDetail) {
                    const kd = hc.khDetail;
                    khDetailHTML = `
                        <strong>지반반력계수 (kh) 산정:</strong><br>
                        <div style="margin: 8px 0 8px 15px; font-size: 0.9rem;">
                            • 상부 토층 (0~${kd.depthLimit.toFixed(1)}m): ${kd.upperLayerName}<br>
                            • 평균 N값: $N_{avg} = ${kd.avgN.toFixed(1)}$<br>
                            • 적용 공식: ${kd.method}<br>
                            • $k_h = ${kd.formula} = ${kd.kh_calculated.toFixed(0)}$ kN/m³<br>
                            ${kd.kh_calculated < kd.kh_min ?
                                `<span style="color: #f57c00;">• 최소값 적용: $k_h = ${kd.kh_min.toLocaleString()}$ kN/m³ (하한값)</span>` :
                                `• 최종값: $k_h = ${kd.value.toFixed(0)}$ kN/m³`}
                        </div>
                    `;
                }
                document.getElementById('lateralCalc1').innerHTML = khDetailHTML;

                // 4-2: 단면 2차 모멘트 상세 표시 (중공 원형 단면)
                // I = π/64 × (D⁴ - d⁴) where d = D - 2t
                const I_calculated = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(D_inner_calc, 4));
                const E_pile = pile.type === 'steel' ? PILE_ELASTIC_MODULUS.STEEL.E_kPa : PILE_ELASTIC_MODULUS.PHC.E_kPa;
                const E_pile_MPa = pile.type === 'steel' ? PILE_ELASTIC_MODULUS.STEEL.E_MPa : PILE_ELASTIC_MODULUS.PHC.E_MPa;
                const pileTypeName = pile.type === 'steel' ? '강관말뚝' : 'PHC 말뚝';

                document.getElementById('lateralCalc2').innerHTML =
                    `<strong>단면 2차 모멘트 (중공 원형 단면):</strong><br>
                     <div style="margin: 8px 0 8px 15px; font-size: 0.9rem;">
                         • 외경: $D_o = ${D}$ m, 두께: $t = ${t_pile}$ m<br>
                         • 내경: $D_i = D_o - 2t = ${D} - 2×${t_pile} = ${D_inner_calc.toFixed(3)}$ m<br>
                         • $I = \\frac{\\pi}{64} \\times (D_o^4 - D_i^4)$<br>
                         • $I = \\frac{\\pi}{64} \\times (${D}^4 - ${D_inner_calc.toFixed(3)}^4) = ${I_calculated.toFixed(6)}$ m⁴<br>
                         <span style="color: #666;">※ 적용값: ${pile.I.toFixed(6)} m⁴ (말뚝 제원표 기준)</span>
                     </div>
                     <strong>탄성계수 (구조물기초설계기준해설 표 5.3.10):</strong><br>
                     <div style="margin: 8px 0 8px 15px; font-size: 0.9rem;">
                         • ${pileTypeName}: $E = ${E_pile_MPa.toLocaleString()}$ MPa = ${E_pile.toExponential(2)} kN/m²<br>
                     </div>
                     <strong>휨강성:</strong> $EI = ${E_pile.toExponential(2)} \\times ${pile.I.toFixed(6)} = ${hc.EI.toFixed(0)}$ kN·m²`;

                // 4-3: 특성값 계산 (플라스틱 단면계수 문구 삭제됨)
                document.getElementById('lateralCalc3').innerHTML =
                    `<strong>특성값 (β) 계산:</strong><br>
                     $\\beta = \\sqrt[4]{\\frac{k_h \\times D}{4 \\times EI}} = \\sqrt[4]{\\frac{${hc.kh.toFixed(0)} \\times ${D}}{4 \\times ${hc.EI.toFixed(0)}}} = ${hc.chang.beta.toFixed(6)}$ m⁻¹`;

                // Update beta*L check
                document.getElementById('lateralCalc4').innerHTML =
                    `$\\beta L = ${hc.chang.beta.toFixed(6)} \\times ${L.toFixed(1)} = ${hc.chang.betaL.toFixed(2)} ${hc.chang.isLongPile ? '> 2.5' : '\\leq 2.5'} \\therefore ${hc.chang.isLongPile ? '장말뚝' : '단말뚝'}$`;

                // Update Chang's Method result
                const changResultEl = document.getElementById('lateralResult');
                if (changResultEl) {
                    changResultEl.innerHTML = `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--primary-navy);">[Chang's Method]</strong><br>
                            허용변위: $Y = ${hc.chang.Y}$ cm<br>
                            허용 수평지지력: $H_{a,Chang} = \\frac{2\\sqrt{EI \\cdot k_h \\cdot D} \\cdot Y}{FS_h} = ${hc.chang.Ha.toFixed(2)}$ kN
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--primary-navy);">[Broms' Method]</strong><br>
                            항복모멘트: $M_y = ${hc.broms.My.toFixed(2)}$ kN·m<br>
                            극한지지력: $H_u = ${hc.broms.Hu.toFixed(2)}$ kN<br>
                            허용 수평지지력: $H_{a,Broms} = \\frac{H_u}{FS_h} = \\frac{${hc.broms.Hu.toFixed(2)}}{${parseFloat(document.getElementById('sfHorizontal').value) || 2.0}} = ${hc.broms.Ha.toFixed(2)}$ kN
                        </div>
                        <div style="padding: 12px; background: #e8f5e9; border-left: 3px solid var(--status-pass); border-radius: 4px;">
                            <strong style="color: var(--status-pass); font-size: 1.1rem;">최종 허용 수평지지력:</strong><br>
                            $H_a = \\min(H_{a,Chang}, H_{a,Broms}) = \\min(${hc.chang.Ha.toFixed(2)}, ${hc.broms.Ha.toFixed(2)}) = ${hc.Ha_final.toFixed(2)}$ kN
                        </div>
                    `;
                }
            }

            // Update uplift capacity calculation
            if (result.upliftCapacity) {
                const uc = result.upliftCapacity;
                const pile = getCurrentPile();
                const Ap = Math.PI * Math.pow(pile.diameter, 2) / 4;
                const FSp = parseFloat(document.getElementById('sfPullout').value) || 3.0;
                
                // Update GWL and lengths
                const upliftCalc1El = document.getElementById('upliftCalc1');
                if (upliftCalc1El) {
                    upliftCalc1El.innerHTML = 
                        `지하수위: EL. ${uc.gwlElevation.toFixed(2)} m`;
                }
                const upliftCalc2El = document.getElementById('upliftCalc2');
                if (upliftCalc2El) {
                    upliftCalc2El.innerHTML = 
                        `공기중 길이: $l_1 = L - l_2 = ${result.pileLength.toFixed(1)} - ${uc.l2.toFixed(2)} = ${uc.l1.toFixed(2)}$ m`;
                }
                const upliftCalc3El = document.getElementById('upliftCalc3');
                if (upliftCalc3El) {
                    upliftCalc3El.innerHTML = 
                        `수중 길이: $l_2 = EL_{GWL} - EL_{tip} = ${uc.gwlElevation.toFixed(2)} - ${result.pileTipLevel.toFixed(2)} = ${uc.l2.toFixed(2)}$ m`;
                }
                
                // Update weight calculations
                const upliftCalc4El = document.getElementById('upliftCalc4');
                if (upliftCalc4El) {
                    upliftCalc4El.innerHTML = 
                        `전체 자중: $W_{total} = w_{pile} \\times L = ${uc.unitWeightPile.toFixed(2)} \\times ${result.pileLength.toFixed(1)} = ${uc.weightTotal.toFixed(2)}$ kN`;
                }
                const upliftCalc5El = document.getElementById('upliftCalc5');
                if (upliftCalc5El) {
                    upliftCalc5El.innerHTML = 
                        `부력: $B = A_p \\times l_2 \\times \\gamma_w = ${Ap.toFixed(4)} \\times ${uc.l2.toFixed(2)} \\times 10 = ${uc.buoyancy.toFixed(2)}$ kN`;
                }
                const upliftCalc6El = document.getElementById('upliftCalc6');
                if (upliftCalc6El) {
                    upliftCalc6El.innerHTML = 
                        `유효 자중: $W_p = W_{total} - B = ${uc.weightTotal.toFixed(2)} - ${uc.buoyancy.toFixed(2)} = ${uc.Wp.toFixed(2)}$ kN`;
                }
                
                // Update final result
                const upliftResultEl = document.getElementById('upliftResult');
                if (upliftResultEl) {
                    const Qu_term = result.Qu || 0;
                    const Qu_FSp = Qu_term / FSp;
                    upliftResultEl.innerHTML = 
                        `$Q_{pull} = \\frac{Q_u}{FS_p} + W_p = \\frac{${Qu_term.toFixed(1)}}{${FSp}} + ${uc.Wp.toFixed(2)} = ${Qu_FSp.toFixed(2)} + ${uc.Wp.toFixed(2)} = ${uc.Q_pull.toFixed(2)}$ kN`;
                }
            }
            
            // Render MathJax
            if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                MathJax.typesetPromise().catch((err) => console.log('MathJax typeset error:', err));
            }
        }

        function openDetailModal(boreholeNo) {
            const borehole = boreholeData.find(b => b && b.hole_no === boreholeNo);
            const result = calculationResults.find(r => r && r.borehole === boreholeNo);
            
            if (!borehole || !result) {
                alert('시추공 데이터를 찾을 수 없습니다.');
                return;
            }
            
            document.getElementById('modalBorehole').textContent = boreholeNo || 'Unknown';
            
            // Update info with null checks
            const originalElevation = result.elevation || 0;
            const targetElevation = result.excavation || 0;
            const elevationDiff = targetElevation - originalElevation;
            
            document.getElementById('modalGL').textContent = `EL. ${originalElevation.toFixed(1)} m`;
            document.getElementById('modalExc').textContent = `EL. ${targetElevation.toFixed(1)} m`;
            
            // Update label based on ground modification type
            const excLabel = document.getElementById('modalExcLabel');
            if (elevationDiff > 0.01) {
                excLabel.textContent = '작업면 (성토 후):';
            } else if (elevationDiff < -0.01) {
                excLabel.textContent = '작업면 (절토 후):';
            } else {
                excLabel.textContent = '작업면:';
            }
            
            document.getElementById('modalBearing').textContent = result.bearingLayer?.soil_name || '-';
            document.getElementById('modalLength').textContent = (result.pileLength || 0).toFixed(1);
            document.getElementById('modalGWT').textContent = borehole.metadata?.GROUND_WATER_LEVEL || '미확인';

            // 근입 깊이 동기화 (입력 검토 탭에서 설정된 값)
            const penetrationDepth = parseFloat(document.getElementById('penetrationDepth')?.value ||
                                                document.getElementById('reviewPenetrationDepth')?.value || 1.0);
            document.getElementById('modalPenetration').textContent = penetrationDepth.toFixed(1);

            // Draw modal canvas
            drawModalCanvas(borehole, result);
            
            // Update layer table - include fill/excavation layers
            const tbody = document.querySelector('#modalLayerTable tbody');
            tbody.innerHTML = '';
            
            const modalOriginalElevation = result.elevation || 0;
            const modalTargetElevation = result.excavation || 0;
            const modalElevationDiff = modalTargetElevation - modalOriginalElevation;
            
            // 저장된 커스텀 레이어 리스트에서 값 찾는 헬퍼 함수
            function findCustomParams(layerName, depthFrom, depthTo) {
                // 깊이 정규화 (min/max 정렬)
                const queryDepthFrom = Math.min(depthFrom, depthTo);
                const queryDepthTo = Math.max(depthFrom, depthTo);

                // 1. _customLayerList에서 깊이 범위로 검색 (가장 정확)
                if (borehole._customLayerList && borehole._customLayerList.length > 0) {
                    for (const saved of borehole._customLayerList) {
                        // 깊이 범위가 일치하는지 확인 (0.2m 오차 허용)
                        if (Math.abs(saved.depthFrom - queryDepthFrom) < 0.2 &&
                            Math.abs(saved.depthTo - queryDepthTo) < 0.2) {
                            console.log(`[findCustomParams] 깊이범위 매칭: ${saved.layerName} (${saved.depthFrom}~${saved.depthTo}m)`);
                            return saved;
                        }
                    }
                    // 토층명이 같은 레이어 검색 (보조)
                    for (const saved of borehole._customLayerList) {
                        if (saved.layerName === layerName) {
                            console.log(`[findCustomParams] 토층명 매칭: ${saved.layerName}`);
                            return saved;
                        }
                    }
                }
                // 2. _customParams에서 토층명으로 검색 (보조)
                if (borehole._customParams && borehole._customParams[layerName]) {
                    console.log(`[findCustomParams] _customParams 매칭: ${layerName}`);
                    return borehole._customParams[layerName];
                }
                return null;
            }

            // Add fill layer if exists
            if (modalElevationDiff > 0.01) {
                let fillN = parseFloat(document.getElementById('fillNValue').value || 8);
                let fillCu = 0;
                let fillPhi = 30;
                let fillGamma = 18;
                let fillE = 2.5 * fillN;
                const fillHeight = modalElevationDiff;

                // 저장된 성토재 커스텀 값 불러오기
                const savedFill = findCustomParams('성토재', -fillHeight, 0);
                if (savedFill) {
                    if (savedFill.N > 0) fillN = savedFill.N;
                    if (savedFill.cu >= 0) fillCu = savedFill.cu;
                    if (savedFill.phi > 0) fillPhi = savedFill.phi;
                    if (savedFill.gamma > 0) fillGamma = savedFill.gamma;
                    if (savedFill.E > 0) fillE = savedFill.E;
                    console.log(`[openDetailModal] 성토재 커스텀 값 불러옴: N=${fillN}`);
                }

                // 성토층 EL 표기 계산
                const fillElTop = modalTargetElevation;
                const fillElBottom = modalOriginalElevation;

                const row = document.createElement('tr');
                row.style.backgroundColor = 'rgba(139, 115, 85, 0.1)';
                row.dataset.originalDepthFrom = (-fillHeight).toFixed(2);
                row.dataset.originalDepthTo = '0';
                row.dataset.layerName = '성토재';
                row.innerHTML = `
                    <td>EL.${fillElTop.toFixed(1)}~${fillElBottom.toFixed(1)}<br><span style="font-size:0.8em;color:#666;">(0.0~${fillHeight.toFixed(1)}m)</span></td>
                    <td><strong>성토재</strong></td>
                    <td><input type="number" value="${fillN}" step="1" style="width: 60px;" class="form-input"></td>
                    <td><input type="number" value="${fillCu}" step="1" style="width: 80px;" class="form-input"></td>
                    <td><input type="number" value="${fillPhi}" step="1" style="width: 60px;" class="form-input"></td>
                    <td><input type="number" value="${fillGamma}" step="0.1" style="width: 60px;" class="form-input"></td>
                    <td><input type="number" value="${fillE.toFixed(0)}" step="1" style="width: 80px;" class="form-input"></td>
                `;
                tbody.appendChild(row);
            }

            // Add original ground layers - 샘플별로 행 분할
            if (borehole.soil_data && Array.isArray(borehole.soil_data)) {
                borehole.soil_data.forEach(layer => {
                    if (!layer) return;

                    const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                    if (!depthMatch) return;

                    // 원지반 기준 깊이 (원본)
                    const layerDepthFrom = parseFloat(depthMatch[1]) || 0;
                    const layerDepthTo = parseFloat(depthMatch[2]) || 0;
                    const layerName = layer.soil_name || '-';

                    // 샘플이 있으면 각 샘플별로 행 생성
                    if (layer.samples && Array.isArray(layer.samples) && layer.samples.length > 0) {
                        // 샘플을 깊이순 정렬
                        const sortedSamples = [...layer.samples].sort((a, b) =>
                            (parseFloat(a.Depth) || 0) - (parseFloat(b.Depth) || 0)
                        );

                        sortedSamples.forEach((sample, sampleIdx) => {
                            if (!sample || !sample.Hits) return;

                            const sampleDepth = parseFloat(sample.Depth) || 0;
                            const nValue = extractNValue(sample.Hits);
                            if (!nValue || nValue <= 0) return;

                            // 샘플 깊이 범위 계산 (이전 샘플 ~ 현재 샘플, 또는 레이어 시작 ~ 현재 샘플)
                            let depthFrom, depthTo;
                            if (sampleIdx === 0) {
                                depthFrom = layerDepthFrom;
                            } else {
                                const prevSample = sortedSamples[sampleIdx - 1];
                                depthFrom = parseFloat(prevSample.Depth) || layerDepthFrom;
                            }
                            depthTo = sampleDepth;

                            // 마지막 샘플이면 레이어 끝까지
                            if (sampleIdx === sortedSamples.length - 1 && sampleDepth < layerDepthTo) {
                                depthTo = layerDepthTo;
                            }

                            // 절토 조정
                            let displayDepthFrom = depthFrom;
                            let displayDepthTo = depthTo;
                            if (modalElevationDiff < -0.01) {
                                const excDepth = Math.abs(modalElevationDiff);
                                displayDepthFrom = Math.max(0, depthFrom - excDepth);
                                displayDepthTo = Math.max(0, depthTo - excDepth);
                                if (displayDepthTo <= 0) return;
                            }

                            // 입력검토 탭에서 편집된 토질정수 가져오기
                            let cu = 0, phi = 30, gamma = 18, E = 50;
                            const layerStats = soilLayerStatistics[layerName];

                            // 1순위: 입력검토 탭 DOM에서 직접 읽기
                            const allRows = document.querySelectorAll('#soilParameterTableBody tr');
                            let foundRow = null;
                            allRows.forEach(r => {
                                if (r.dataset.layerName === layerName) {
                                    foundRow = r;
                                }
                            });

                            if (foundRow) {
                                const inputs = foundRow.querySelectorAll('.soil-param-input');
                                if (inputs.length >= 4) {
                                    cu = parseFloat(inputs[0]?.value) || 0;
                                    phi = parseFloat(inputs[1]?.value) || 30;
                                    gamma = parseFloat(inputs[2]?.value) || 18;
                                    E = parseFloat(inputs[3]?.value) || 50;
                                    console.log(`[모달] ${layerName} DOM에서 읽음: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                                }
                            } else if (layerStats && layerStats.recommended) {
                                // 2순위: 저장된 추천값 사용
                                cu = layerStats.recommended.cu || 0;
                                phi = layerStats.recommended.phi || 30;
                                gamma = layerStats.recommended.gamma || 18;
                                E = layerStats.recommended.E || 50;
                                console.log(`[모달] ${layerName} recommended에서 읽음: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                            } else {
                                // 3순위: N값 기반 기본 계산
                                const isCohesive = layerName.includes('점토') || layerName.includes('실트');
                                cu = isCohesive ? 12 * nValue : 0;
                                phi = Math.min(28 + nValue / 2, 40);
                                gamma = 18;
                                E = 2.5 * nValue;
                                console.log(`[모달] ${layerName} 기본계산: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                            }

                            // EL 표기 계산
                            const elTop = modalTargetElevation - displayDepthFrom;
                            const elBottom = modalTargetElevation - displayDepthTo;

                            const row = document.createElement('tr');
                            row.dataset.originalDepthFrom = depthFrom.toFixed(2);
                            row.dataset.originalDepthTo = depthTo.toFixed(2);
                            row.dataset.layerName = layerName;
                            row.dataset.sampleDepth = sampleDepth.toFixed(2);
                            row.innerHTML = `
                                <td>EL.${elTop.toFixed(1)}~${elBottom.toFixed(1)}<br><span style="font-size:0.8em;color:#666;">(${displayDepthFrom.toFixed(1)}~${displayDepthTo.toFixed(1)}m)</span></td>
                                <td>${layerName}<br><span style="font-size:0.75em;color:#888;">${sample.Sample_number || ''} @${sampleDepth}m</span></td>
                                <td title="${sample.Hits} → N=${nValue}"><input type="number" value="${nValue}" step="1" style="width: 60px;" class="form-input"></td>
                                <td><input type="number" value="${cu.toFixed(0)}" step="1" style="width: 80px;" class="form-input"></td>
                                <td><input type="number" value="${phi.toFixed(0)}" step="1" style="width: 60px;" class="form-input"></td>
                                <td><input type="number" value="${gamma.toFixed(1)}" step="0.1" style="width: 60px;" class="form-input"></td>
                                <td><input type="number" value="${E.toFixed(0)}" step="1" style="width: 80px;" class="form-input"></td>
                            `;
                            tbody.appendChild(row);
                        });
                    } else {
                        // 샘플 없으면 레이어 전체를 하나의 행으로
                        let displayDepthFrom = layerDepthFrom;
                        let displayDepthTo = layerDepthTo;

                        if (modalElevationDiff < -0.01) {
                            const excDepth = Math.abs(modalElevationDiff);
                            displayDepthFrom = Math.max(0, layerDepthFrom - excDepth);
                            displayDepthTo = Math.max(0, layerDepthTo - excDepth);
                            if (displayDepthTo <= 0) return;
                        }

                        // 토층명에서 N값 추정
                        const avgN = getAverageN(layer);

                        // 입력검토 탭에서 편집된 토질정수 가져오기
                        let cu = 0, phi = 30, gamma = 18, E = 50;
                        const layerStats2 = soilLayerStatistics[layerName];

                        // 1순위: 입력검토 탭 DOM에서 직접 읽기
                        const allRows2 = document.querySelectorAll('#soilParameterTableBody tr');
                        let foundRow2 = null;
                        allRows2.forEach(r => {
                            if (r.dataset.layerName === layerName) {
                                foundRow2 = r;
                            }
                        });

                        if (foundRow2) {
                            const inputs = foundRow2.querySelectorAll('.soil-param-input');
                            if (inputs.length >= 4) {
                                cu = parseFloat(inputs[0]?.value) || 0;
                                phi = parseFloat(inputs[1]?.value) || 30;
                                gamma = parseFloat(inputs[2]?.value) || 18;
                                E = parseFloat(inputs[3]?.value) || 50;
                                console.log(`[모달-노샘플] ${layerName} DOM에서 읽음: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                            }
                        } else if (layerStats2 && layerStats2.recommended) {
                            cu = layerStats2.recommended.cu || 0;
                            phi = layerStats2.recommended.phi || 30;
                            gamma = layerStats2.recommended.gamma || 18;
                            E = layerStats2.recommended.E || 50;
                            console.log(`[모달-노샘플] ${layerName} recommended에서 읽음: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                        } else {
                            // 통계 없으면 N값 기반 기본 계산
                            const isCohesive = layerName.includes('점토') || layerName.includes('실트');
                            cu = isCohesive ? 12 * avgN : 0;
                            phi = Math.min(28 + avgN / 2, 40);
                            gamma = 18;
                            E = 2.5 * avgN;
                            console.log(`[모달-노샘플] ${layerName} 기본계산: cu=${cu}, phi=${phi}, gamma=${gamma}, E=${E}`);
                        }

                        const elTop = modalTargetElevation - displayDepthFrom;
                        const elBottom = modalTargetElevation - displayDepthTo;

                        const row = document.createElement('tr');
                        row.dataset.originalDepthFrom = layerDepthFrom.toFixed(2);
                        row.dataset.originalDepthTo = layerDepthTo.toFixed(2);
                        row.dataset.layerName = layerName;
                        row.innerHTML = `
                            <td>EL.${elTop.toFixed(1)}~${elBottom.toFixed(1)}<br><span style="font-size:0.8em;color:#666;">(${displayDepthFrom.toFixed(1)}~${displayDepthTo.toFixed(1)}m)</span></td>
                            <td>${layerName}<br><span style="font-size:0.75em;color:#999;">(샘플없음-추정)</span></td>
                            <td><input type="number" value="${avgN}" step="1" style="width: 60px;" class="form-input"></td>
                            <td><input type="number" value="${cu.toFixed(0)}" step="1" style="width: 80px;" class="form-input"></td>
                            <td><input type="number" value="${phi.toFixed(0)}" step="1" style="width: 60px;" class="form-input"></td>
                            <td><input type="number" value="${gamma.toFixed(1)}" step="0.1" style="width: 60px;" class="form-input"></td>
                            <td><input type="number" value="${E.toFixed(0)}" step="1" style="width: 80px;" class="form-input"></td>
                        `;
                        tbody.appendChild(row);
                    }
                });
            }
            
            document.getElementById('detailModal').classList.add('active');
        }

        function drawModalCanvas(borehole, result) {
            const canvas = document.getElementById('modalCanvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Drawing parameters
            const startX = 50;
            const startY = 50;
            const columnWidth = 120;
            const scale = 18;
            
            // Draw title
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#1e3a5f';
            ctx.textAlign = 'center';
            ctx.fillText(borehole.hole_no || 'Unknown', startX + columnWidth/2, 25);
            
            // Draw layers
            let currentY = startY;
            if (borehole.soil_data && Array.isArray(borehole.soil_data)) {
                borehole.soil_data.forEach(layer => {
                    if (!layer || !layer.depth_range) return;
                    
                    const depthMatch = layer.depth_range.match(/([\d.]+)~([\d.]+)m/);
                    if (!depthMatch) return;
                    
                    const depthFrom = parseFloat(depthMatch[1]) || 0;
                    const depthTo = Math.min(parseFloat(depthMatch[2]) || 0, 25);
                    const thickness = (depthTo - depthFrom) * scale;
                    
                    if (thickness <= 0) return;
                    
                    // Layer color
                    let color = '#f5f5f5';
                    const soilName = layer.soil_name || '';
                    if (soilName.includes('매립')) color = '#8B7355';
                    else if (soilName.includes('퇴적')) color = '#D2B48C';
                    else if (soilName.includes('풍화토')) color = '#DEB887';
                    else if (soilName.includes('풍화암')) color = '#BDB76B';
                    else if (soilName.includes('연암')) color = '#A9A9A9';
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(startX, currentY, columnWidth, thickness);
                    ctx.strokeStyle = '#495057';
                    ctx.strokeRect(startX, currentY, columnWidth, thickness);
                    
                    // Layer name
                    ctx.fillStyle = '#212529';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(soilName, startX + columnWidth + 10, currentY + thickness/2 + 3);
                    
                    // Depth
                    ctx.textAlign = 'right';
                    ctx.font = '9px Arial';
                    ctx.fillStyle = '#6c757d';
                    ctx.fillText(`${depthFrom.toFixed(1)}`, startX - 5, currentY + 10);
                    
                    currentY += thickness;
                });
            }
            
            // Get ground modification info from result
            const originalElevation = result.elevation || 0;
            const targetElevation = result.excavation || 0;
            const elevationDiff = targetElevation - originalElevation;
            
            // Determine pile start Y position (work surface)
            let pileStartY = startY; // Default: original ground level
            let workSurfaceY = startY;
            
            if (elevationDiff > 0.01) {
                // Fill - work surface is above original ground
                const fillHeight = elevationDiff;
                workSurfaceY = startY - fillHeight * scale;
                pileStartY = workSurfaceY;
            } else if (elevationDiff < -0.01) {
                // Excavation - work surface is below original ground
                const excDepth = Math.abs(elevationDiff);
                workSurfaceY = startY + excDepth * scale;
                pileStartY = workSurfaceY;
            }
            
            // Draw pile if result exists
            if (result && result.pileLength > 0) {
                const pileX = startX + columnWidth/2;
                const pileWidth = 20;
                const pileLength = (result.pileLength || 0) * scale;
                
                ctx.fillStyle = 'rgba(44, 82, 130, 0.3)';
                ctx.fillRect(pileX - pileWidth/2, pileStartY, pileWidth, pileLength);
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.strokeRect(pileX - pileWidth/2, pileStartY, pileWidth, pileLength);
                
                // Labels
                ctx.fillStyle = '#1e3a5f';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`L=${(result.pileLength || 0).toFixed(1)}m`, pileX, pileStartY + pileLength + 20);
            }
            
            // Draw groundwater level if available
            if (result && result.upliftCapacity && result.upliftCapacity.gwlElevation !== null) {
                const gwlElevation = result.upliftCapacity.gwlElevation;
                // Only draw if GWL is within reasonable range (not too deep)
                if (gwlElevation > -1000 && gwlElevation < originalElevation + 10) {
                    const gwlDepth = originalElevation - gwlElevation;
                    const gwlY = startY + gwlDepth * scale;
                    
                    // Draw groundwater level line (blue dashed line)
                    ctx.strokeStyle = '#0277bd';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 3]);
                    ctx.beginPath();
                    ctx.moveTo(startX - 20, gwlY);
                    ctx.lineTo(startX + columnWidth + 20, gwlY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Draw water fill below GWL (light blue)
                    if (gwlY < startY + 25 * scale) {
                        ctx.fillStyle = 'rgba(3, 169, 244, 0.15)';
                        const waterBottom = Math.min(startY + 25 * scale, canvas.height - 20);
                        ctx.fillRect(startX, gwlY, columnWidth, waterBottom - gwlY);
                    }
                    
                    // GWL label
                    ctx.fillStyle = '#0277bd';
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'right';
                    ctx.fillText(`GWL EL.${gwlElevation.toFixed(1)}m`, startX - 25, gwlY + 4);
                }
            }
            
            // Draw work surface (target elevation) line
            if (Math.abs(elevationDiff) > 0.01) {
                if (elevationDiff > 0.01) {
                    // Fill case
                    const fillHeight = elevationDiff;
                    const fillY = startY - fillHeight * scale;
                    
                    // Draw fill zone
                    ctx.fillStyle = 'rgba(139, 115, 85, 0.3)';
                    ctx.fillRect(startX, fillY, columnWidth, fillHeight * scale);
                    
                    // Draw work surface line (top of fill)
                    ctx.strokeStyle = '#2e7d32';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(startX - 20, workSurfaceY);
                    ctx.lineTo(startX + columnWidth + 20, workSurfaceY);
                    ctx.stroke();
                    
                    ctx.fillStyle = '#2e7d32';
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`작업면 (성토 후) EL.${targetElevation.toFixed(1)}m`, startX + columnWidth + 25, workSurfaceY + 3);
                    
                    // Draw original ground line
                    ctx.strokeStyle = '#1e3a5f';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 3]);
                    ctx.beginPath();
                    ctx.moveTo(startX - 20, startY);
                    ctx.lineTo(startX + columnWidth + 20, startY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    ctx.fillStyle = '#1e3a5f';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`원지반 EL.${originalElevation.toFixed(1)}m`, startX + columnWidth + 25, startY + 3);
                } else {
                    // Excavation case
                    const excDepth = Math.abs(elevationDiff);
                    
                    // Draw work surface line (excavation bottom)
                    ctx.strokeStyle = '#c62828';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(startX - 20, workSurfaceY);
                    ctx.lineTo(startX + columnWidth + 20, workSurfaceY);
                    ctx.stroke();
                    
                    ctx.fillStyle = '#c62828';
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`작업면 (절토 후) EL.${targetElevation.toFixed(1)}m`, startX + columnWidth + 25, workSurfaceY + 3);
                    
                    // Draw original ground line
                    ctx.strokeStyle = '#1e3a5f';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 3]);
                    ctx.beginPath();
                    ctx.moveTo(startX - 20, startY);
                    ctx.lineTo(startX + columnWidth + 20, startY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    ctx.fillStyle = '#1e3a5f';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`원지반 EL.${originalElevation.toFixed(1)}m`, startX + columnWidth + 25, startY + 3);
                }
            } else {
                // No change - work surface = original ground
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(startX - 20, startY);
                ctx.lineTo(startX + columnWidth + 20, startY);
                ctx.stroke();
                
                ctx.fillStyle = '#495057';
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(`작업면 EL.${targetElevation.toFixed(1)}m`, startX + columnWidth + 25, startY + 3);
            }
        }

        function saveModalData() {
            // 모달에서 수정된 토질 매개변수를 boreholeData에 저장
            const modalBorehole = document.getElementById('modalBorehole').textContent;
            const boreholeIndex = boreholeData.findIndex(b => b.hole_no === modalBorehole);

            if (boreholeIndex < 0) {
                alert('시추공 데이터를 찾을 수 없습니다.');
                return;
            }

            const borehole = boreholeData[boreholeIndex];
            const tbody = document.querySelector('#modalLayerTable tbody');
            const rows = tbody.querySelectorAll('tr');

            // 커스텀 파라미터 초기화 (새로 저장)
            borehole._customParams = {};
            borehole._customParamsByDepth = {};

            // 모든 레이어 정보를 배열로 수집
            const layerList = [];

            rows.forEach((row, idx) => {
                const inputs = row.querySelectorAll('input');
                if (inputs.length < 5) return;

                // data 속성에서 원지반 깊이와 토층명 가져오기
                const originalDepthFrom = parseFloat(row.dataset.originalDepthFrom);
                const originalDepthTo = parseFloat(row.dataset.originalDepthTo);
                const layerName = row.dataset.layerName || '';

                // NaN 체크
                if (isNaN(originalDepthFrom) || isNaN(originalDepthTo)) {
                    console.warn(`[saveModalData] 깊이 정보 없음, 건너뜀`);
                    return;
                }

                // 토층명이 없으면 셀에서 가져오기
                const cells = row.querySelectorAll('td');
                const displayLayerName = layerName || (cells.length >= 2 ? cells[1].textContent.trim() : '');

                const customN = parseFloat(inputs[0].value) || 0;
                const customCu = parseFloat(inputs[1].value) || 0;
                const customPhi = parseFloat(inputs[2].value) || 30;
                const customGamma = parseFloat(inputs[3].value) || 18;
                const customE = parseFloat(inputs[4].value) || 50;

                const params = {
                    N: customN,
                    cu: customCu,
                    phi: customPhi,
                    gamma: customGamma,
                    E: customE,
                    depthFrom: Math.min(originalDepthFrom, originalDepthTo),
                    depthTo: Math.max(originalDepthFrom, originalDepthTo),
                    layerName: displayLayerName
                };

                layerList.push(params);

                // 토층명으로 저장
                if (displayLayerName) {
                    borehole._customParams[displayLayerName] = params;
                }

                console.log(`[saveModalData] 수집: ${displayLayerName}, 깊이: ${params.depthFrom.toFixed(2)}~${params.depthTo.toFixed(2)}m, N=${customN}`);
            });

            // 레이어 리스트를 시추공에 저장 (깊이 범위 검색용)
            borehole._customLayerList = layerList;

            console.log(`[saveModalData] ${modalBorehole}: 총 ${layerList.length}개 레이어 저장됨`);
            console.log('[saveModalData] customParams:', borehole._customParams);
            console.log('[saveModalData] _customLayerList:', borehole._customLayerList);

            // 저장 완료 알림
            alert(`토질 매개변수가 저장되었습니다.\n(${layerList.length}개 지층)`);

            // 모달 닫고 재계산
            closeModal();
            performAnalysis();
        }

        function closeModal() {
            document.getElementById('detailModal').classList.remove('active');
        }

        // Function to update individual borehole target elevation
        function updateBoreholeTargetElevation(boreholeIndex, newValue) {
            const targetElevation = parseFloat(newValue);
            if (isNaN(targetElevation) || boreholeIndex < 0 || boreholeIndex >= boreholeData.length) {
                return;
            }
            
            const borehole = boreholeData[boreholeIndex];
            borehole._targetElevation = targetElevation;
            
            // Recalculate only this borehole
            try {
                const result = calculateForBorehole(borehole);
                calculationResults[boreholeIndex] = result;
                
                // Update displays
                updateSummaryTable();
                updateSummaryCards();
                updateCharts();
                updateCalculations();
            } catch (error) {
                console.error('Error recalculating borehole', borehole.hole_no, ':', error);
                alert('계산 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // Function to update individual borehole pile tip elevation (선단지지고)
        function updateBoreholeTipElevation(boreholeIndex, newValue) {
            const tipElevation = parseFloat(newValue);
            if (isNaN(tipElevation) || boreholeIndex < 0 || boreholeIndex >= boreholeData.length) {
                return;
            }

            const borehole = boreholeData[boreholeIndex];
            borehole._customPileTipLevel = tipElevation;

            console.log(`[updateBoreholeTipElevation] ${borehole.hole_no}: 선단지지고 변경 = EL.${tipElevation.toFixed(2)}m`);

            // Recalculate only this borehole
            try {
                const result = calculateForBorehole(borehole);
                calculationResults[boreholeIndex] = result;

                // Update displays
                updateSummaryTable();
                updateSummaryCards();
                updateCharts();
                updateCalculations();

                console.log(`[updateBoreholeTipElevation] ${borehole.hole_no}: 재계산 완료 - 말뚝길이=${result.pileLength?.toFixed(1)}m, 허용지지력=${result.Qa?.toFixed(0)}kN`);
            } catch (error) {
                console.error('Error recalculating borehole', borehole.hole_no, ':', error);
                alert('계산 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // Function to reset borehole pile tip elevation to calculated default
        function resetBoreholeTipElevation(boreholeIndex) {
            if (boreholeIndex < 0 || boreholeIndex >= boreholeData.length) {
                return;
            }

            const borehole = boreholeData[boreholeIndex];
            delete borehole._customPileTipLevel;

            console.log(`[resetBoreholeTipElevation] ${borehole.hole_no}: 선단지지고 기본값으로 복원`);

            // Recalculate only this borehole
            try {
                const result = calculateForBorehole(borehole);
                calculationResults[boreholeIndex] = result;

                // Update displays
                updateSummaryTable();
                updateSummaryCards();
                updateCharts();
                updateCalculations();
            } catch (error) {
                console.error('Error recalculating borehole', borehole.hole_no, ':', error);
                alert('계산 중 오류가 발생했습니다: ' + error.message);
            }
        }

        function generateReport() {
            const reportContent = document.getElementById('reportContent');

            // Check if calculations have been performed
            if (!calculationResults || calculationResults.length === 0) {
                reportContent.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: var(--status-warning);">
                        <p style="font-size: 1.1rem; margin-bottom: 10px;">계산 결과가 없습니다</p>
                        <p style="margin-bottom: 20px;">보고서를 생성하려면 먼저 "통합 분석 실행"을 수행해주세요.</p>
                        <p style="font-size: 0.9rem; color: var(--text-muted);">
                            ※ 통합 분석 실행 후 보고서를 생성하면 다음 내용이 포함됩니다:<br>
                            - 프로젝트 개요 및 설계 조건<br>
                            - 시추공별 상세 계산서<br>
                            - 부록: 말뚝 제원 및 적용 공식
                        </p>
                    </div>
                `;
                return;
            }

            // 섹션 선택 옵션 읽기
            const includeCover = document.getElementById('sectionCover')?.checked ?? true;
            const includeSummary = document.getElementById('sectionSummary')?.checked ?? true;
            const includeDesignConditions = document.getElementById('sectionDesignConditions')?.checked ?? true;
            const includeDetailedCalc = document.getElementById('sectionDetailedCalc')?.checked ?? true;
            const includeAppendix = document.getElementById('sectionAppendix')?.checked ?? true;
            const includeSignature = document.getElementById('sectionSignature')?.checked ?? true;

            // 선택된 시추공 인덱스
            const selectedIndices = getSelectedBoreholeIndices();
            if (selectedIndices.length === 0 && includeDetailedCalc) {
                alert('최소 하나 이상의 시추공을 선택해주세요.');
                return;
            }

            // 선택된 시추공에 대한 계산 결과만 필터링
            const selectedResults = selectedIndices.map(idx => calculationResults[idx]).filter(r => r);

            // Generate comprehensive report with selected borehole calculations
            let detailedCalculations = '';

            selectedResults.forEach((result, idx) => {
                const originalIndex = selectedIndices[idx];
                const borehole = boreholeData[originalIndex];
                const pile = getCurrentPile();
                
                detailedCalculations += `
                    <div style="page-break-before: always; margin-top: 40px;">
                        <h3 style="color: var(--primary-steel); margin-bottom: 20px;">
                            시추공 ${result.borehole} 상세 계산서
                        </h3>
                        
                        <h4 style="color: var(--primary-navy); margin: 20px 0 15px 0;">1) 설계 조건</h4>
                        <table class="data-table" style="margin-bottom: 20px;">
                            <tr>
                                <td style="width: 200px; font-weight: 600;">시추공 번호</td>
                                <td>${result.borehole}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">지표고</td>
                                <td>EL. ${result.elevation.toFixed(1)}m</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">굴착고</td>
                                <td>EL. ${result.excavation.toFixed(1)}m</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">말뚝 길이</td>
                                <td>${result.pileLength.toFixed(1)}m</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">지지층</td>
                                <td>${result.bearingLayer ? result.bearingLayer.soil_name : '풍화암'}</td>
                            </tr>
                        </table>
                        
                        <h4 style="color: var(--primary-navy); margin: 20px 0 15px 0;">2) 지지력 계산</h4>
                        
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                            <h5 style="margin-bottom: 10px;">주면마찰력 계산 (층별)</h5>
                            <p style="margin: 5px 0 10px 0; font-size: 0.9rem; color: var(--text-secondary);">
                                주면마찰응력 계산식 (구조물기초설계기준해설):<br>
                                - 사질토: $f_s = \\beta_s \\times N$ (βs = ${parseFloat(document.getElementById('betaSand')?.value) || 2.0})<br>
                                - 점성토: $f_s = \\beta_c \\times N$ (βc = ${parseFloat(document.getElementById('betaClay')?.value) || 6.25})
                            </p>
                            <table class="data-table" style="font-size: 0.85rem;">
                                <thead>
                                    <tr>
                                        <th>깊이</th>
                                        <th>토층</th>
                                        <th>두께 (m)</th>
                                        <th>N값</th>
                                        <th>fs (kPa)</th>
                                        <th>As (m²)</th>
                                        <th>Qs (kN)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${result.skinFrictionDetails.map(d => {
                                        const method = document.getElementById('constructionMethod').value;
                                        const methodFactor = method === 'driven' ? 1.0 : 0.7;
                                        // soilType을 사용하여 점성토/사질토 판별 (온톨로지 기반)
                                        const isClay = d.soilType === 'clay';
                                        // 입력 검토 탭에서 설정한 계수 값 사용
                                        const betaSand = parseFloat(document.getElementById('betaSand')?.value) || 2.0;
                                        const betaClay = parseFloat(document.getElementById('betaClay')?.value) || 6.25;
                                        const betaValue = isClay ? betaClay : betaSand;
                                        const soilTypeLabel = isClay ? '점성토' : '사질토';
                                        const calcNote = `$f_s = ${betaValue} \\times ${d.N} \\times ${methodFactor} = ${d.fs.toFixed(1)}$ kPa`;
                                        return `
                                        <tr style="background: ${isClay ? '#fafafa' : '#f8f8f8'};">
                                            <td>${d.depth}m</td>
                                            <td>${d.layer}</td>
                                            <td>${d.thickness.toFixed(2)}</td>
                                            <td>${d.N}</td>
                                            <td>
                                                ${d.fs.toFixed(1)}
                                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                                                    ${soilTypeLabel}: ${calcNote}
                                                </div>
                                            </td>
                                            <td>${d.As.toFixed(3)}</td>
                                            <td>${d.Qs.toFixed(1)}</td>
                                        </tr>
                                    `;
                                    }).join('')}
                                </tbody>
                                <tfoot>
                                    <tr style="font-weight: 600; background: var(--bg-secondary);">
                                        <td colspan="6">총 주면마찰력: $Q_s = \\sum (f_s \\times A_s)$</td>
                                        <td>${result.Qs.toFixed(1)} kN</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                            <h5 style="margin-bottom: 10px;">선단지지력 계산</h5>
                            <div style="margin: 10px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">입력값:</p>
                                <p style="margin: 5px 0 5px 20px;">$N_{tip} = ${result.bearingLayer ? getAverageN(result.bearingLayer) : 50}$ (선단부 표준관입시험 N값)</p>
                                <p style="margin: 5px 0 5px 20px;">$D = ${pile.diameter}$ m (말뚝 외경)</p>
                            </div>
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">계산 과정:</p>
                                <p style="margin: 5px 0 5px 20px;">단위선단지지력: $q_p = ${result.endBearingCoeff || 300} \\times N_{tip} = ${result.endBearingCoeff || 300} \\times ${result.bearingLayer ? getAverageN(result.bearingLayer) : 50} = ${(pile.crossArea > 0 ? (result.Qp/pile.crossArea).toFixed(0) : 0)}$ kPa</p>
                                <p style="margin: 5px 0 5px 20px;">선단면적: $A_p = \\frac{\\pi \\times D^2}{4} = \\frac{\\pi \\times ${pile.diameter}^2}{4} = ${(pile.crossArea || 0).toFixed(4)}$ m²</p>
                                <p style="margin: 5px 0 5px 20px; font-weight: 600;">선단지지력: $Q_p = q_p \\times A_p = ${(pile.crossArea > 0 ? (result.Qp/pile.crossArea).toFixed(0) : 0)} \\times ${(pile.crossArea || 0).toFixed(4)} = ${(result.Qp || 0).toFixed(1)}$ kN</p>
                            </div>
                        </div>
                        
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                            <h5 style="margin-bottom: 10px; color: var(--status-pass);">지지력 산정 결과</h5>
                            <div style="margin: 10px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">계산 과정:</p>
                                <p style="margin: 5px 0 5px 20px;">극한지지력: $Q_u = Q_s + Q_p = ${result.Qs.toFixed(1)} + ${result.Qp.toFixed(1)} = ${result.Qu.toFixed(1)}$ kN</p>
                                <p style="margin: 5px 0 5px 20px;">지반 허용지지력: $Q_{a,soil} = \\frac{Q_u}{FS_v} = \\frac{${result.Qu.toFixed(1)}}{${parseFloat(document.getElementById('sfVertical').value) || 3.0}} = ${(result.Qa_soil || (result.Qu / (parseFloat(document.getElementById('sfVertical').value) || 3.0))).toFixed(1)}$ kN</p>
                                
                                ${result.numberOfSplices > 0 && result.spliceMethod !== 'none' ? `
                                <div style="margin: 10px 0 10px 20px; padding: 12px; background: rgba(30, 58, 95, 0.05); border-left: 3px solid var(--primary-navy); border-radius: 4px;">
                                    <p style="margin: 5px 0; font-weight: 600;">재료 허용지지력 (이음 감소 적용):</p>
                                    <p style="margin: 5px 0 5px 10px;">말뚝 길이: $L = ${result.pileLength.toFixed(1)}$ m</p>
                                    <p style="margin: 5px 0 5px 10px;">말뚝 한 본당 길이: $L_{unit} = 15.0$ m</p>
                                    <p style="margin: 5px 0 5px 10px;">이음 개소 수: $n = \\lfloor ${result.pileLength.toFixed(1)} / 15.0 \\rfloor = ${result.numberOfSplices}$ 개소</p>
                                    ${result.spliceMethod === 'welding' ? `
                                    <p style="margin: 5px 0 5px 10px;">이음 방법: 용접 이음 (개소당 5% 감소)</p>
                                    <p style="margin: 5px 0 5px 10px;">총 감소율: $R_{total} = ${result.numberOfSplices} \\times 5 = ${result.spliceReductionRate.toFixed(1)}$%</p>
                                    ` : result.spliceMethod === 'bolting' ? `
                                    <p style="margin: 5px 0 5px 10px;">이음 방법: 볼트식 이음 (개소당 10% 감소)</p>
                                    <p style="margin: 5px 0 5px 10px;">총 감소율: $R_{total} = ${result.numberOfSplices} \\times 10 = ${result.spliceReductionRate.toFixed(1)}$%</p>
                                    ` : result.spliceMethod === 'filled' ? `
                                    <p style="margin: 5px 0 5px 10px;">이음 방법: 충전식 이음 (최초 2개소 20%/개소, 3개소째 30%/개소)</p>
                                    <p style="margin: 5px 0 5px 10px;">이음별 감소율: ${result.spliceDetails.map((r, i) => `${i+1}개소: ${r.toFixed(0)}%`).join(', ')}</p>
                                    <p style="margin: 5px 0 5px 10px;">총 감소율: $R_{total} = ${result.spliceDetails.map(r => r.toFixed(0)).join(' + ')} = ${result.spliceReductionRate.toFixed(1)}$%</p>
                                    ` : ''}
                                    <p style="margin: 10px 0 5px 10px; font-weight: 600;">재료 허용지지력 감소:</p>
                                    <p style="margin: 5px 0 5px 10px;">$Q_{a,material} = ${pile.allowable.toFixed(0)} \\times (1 - ${result.spliceReductionRate.toFixed(1)}/100) = ${pile.allowable.toFixed(0)} \\times ${result.spliceFactor.toFixed(3)} = ${(result.Qa_material || (pile.allowable * result.spliceFactor)).toFixed(0)}$ kN</p>
                                </div>
                                ` : `
                                <p style="margin: 5px 0 5px 20px;">재료 허용지지력: $Q_{a,material} = ${pile.allowable.toFixed(0)}$ kN (이음 없음)</p>
                                `}
                                <p style="margin: 10px 0 5px 20px; font-weight: 600; font-size: 1.1rem;">허용지지력: $Q_a = \\min(Q_{a,soil}, Q_{a,material}) = \\min(${(result.Qa_soil || (result.Qu / (parseFloat(document.getElementById('sfVertical').value) || 3.0))).toFixed(1)}, ${(result.Qa_material || pile.allowable).toFixed(0)}) = ${result.Qa.toFixed(0)}$ kN</p>
                            </div>
                        </div>
                        
                        <h4 style="color: var(--primary-navy); margin: 20px 0 15px 0;">3) 침하량 계산 (Vesic 3성분 합산법, 구조물 기초 설계 기준)</h4>

                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                            <h5 style="margin-bottom: 10px;">침하량 계산 상세 (St = Ss + Sp + Sps)</h5>
                            <div style="margin: 10px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">입력값:</p>
                                <p style="margin: 5px 0 5px 20px;">$Q = ${(result.Qa || 0).toFixed(0)}$ kN (설계하중 = 허용지지력)</p>
                                <p style="margin: 5px 0 5px 20px;">$L = ${(result.pileLength || 0).toFixed(1)}$ m (말뚝 길이)</p>
                                <p style="margin: 5px 0 5px 20px;">$A_p = ${(pile.area || 0).toFixed(4)}$ m² (말뚝 순단면적)</p>
                                <p style="margin: 5px 0 5px 20px;">$A_g = ${(pile.crossArea || 0).toFixed(4)}$ m² (말뚝 총단면적)</p>
                                <p style="margin: 5px 0 5px 20px;">$E_p = ${pile.type === 'steel' ? PILE_ELASTIC_MODULUS.STEEL.E_kPa.toLocaleString() : PILE_ELASTIC_MODULUS.PHC.E_kPa.toLocaleString()}$ kN/m² (${pile.type === 'steel' ? '강관말뚝' : 'PHC 말뚝'}, 표 5.3.10)</p>
                                <p style="margin: 5px 0 5px 20px;">$B = ${pile.diameter}$ m (말뚝 외경)</p>
                                <p style="margin: 5px 0 5px 20px;">$q_p = Q_p / A_g = ${(pile.crossArea > 0 ? (result.Qp / pile.crossArea).toFixed(0) : 0)}$ kN/m² (극한 선단지지력도)</p>
                                <p style="margin: 5px 0 5px 20px;">$\\alpha_s = ${(getSettlementCoefficients().alphaS || 0.67)}$ (주면마찰력 분포계수)</p>
                                <p style="margin: 5px 0 5px 20px;">$C_p = ${(getSettlementCoefficients().Cp || 0.12)}$ (경험계수)</p>
                            </div>
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">1) 말뚝 탄성압축 (Ss):</p>
                                <p style="margin: 5px 0 5px 20px;">$S_s = \\frac{(Q_{ps} + \\alpha_s \\cdot Q_{fs}) \\times L}{A_p \\times E_p}$</p>
                                <p style="margin: 5px 0 5px 20px;">$S_s = ${(result.Ss || 0).toFixed(2)}$ mm</p>
                            </div>
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">2) 선단하중에 의한 침하 (Sp):</p>
                                <p style="margin: 5px 0 5px 20px;">$S_p = \\frac{Q_{ps} \\times C_p}{B \\times q_p}$</p>
                                <p style="margin: 5px 0 5px 20px;">$S_p = ${(result.Sp || 0).toFixed(2)}$ mm</p>
                            </div>
                            <div style="margin: 15px 0;">
                                <p style="margin: 5px 0; font-weight: 600;">3) 주면마찰력에 의한 침하 (Sps):</p>
                                <p style="margin: 5px 0 5px 20px;">$C_s = (0.93 + 0.16\\sqrt{L_p/B}) \\times C_p$</p>
                                <p style="margin: 5px 0 5px 20px;">$S_{ps} = \\frac{Q_{fs} \\times C_s}{L_p \\times q_p}$</p>
                                <p style="margin: 5px 0 5px 20px;">$S_{ps} = ${(result.Sps || 0).toFixed(2)}$ mm</p>
                            </div>
                            <div style="margin: 15px 0; padding-top: 10px; border-top: 2px solid var(--border-primary);">
                                <p style="margin: 5px 0; font-weight: 600; font-size: 1.1rem;">총 침하량:</p>
                                <p style="margin: 5px 0 5px 20px; font-weight: 600; font-size: 1.1rem;">$S_t = S_s + S_p + S_{ps} = ${(result.Ss || 0).toFixed(2)} + ${(result.Sp || 0).toFixed(2)} + ${(result.Sps || 0).toFixed(2)} = ${(result.St || 0).toFixed(2)}$ mm</p>
                            </div>
                        </div>
                        
                        <h4 style="color: var(--primary-navy); margin: 20px 0 15px 0;">4) 검토 결과</h4>
                        
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>검토 항목</th>
                                    <th>기준값</th>
                                    <th>계산값</th>
                                    <th>판정</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>허용 침하량</td>
                                    <td>≤ ${document.getElementById('allowableSettlement').value} mm</td>
                                    <td>${(result.St || 0).toFixed(1)} mm</td>
                                    <td>
                                        <span class="status-badge ${(result.St || 0) <= parseFloat(document.getElementById('allowableSettlement').value) ? 'status-pass' : 'status-fail'}">
                                            ${(result.St || 0) <= parseFloat(document.getElementById('allowableSettlement').value) ? 'PASS' : 'FAIL'}
                                        </span>
                                    </td>
                                </tr>
                                ${result.horizontalCapacity ? `
                                <tr>
                                    <td>수평 지지력</td>
                                    <td>-</td>
                                    <td>
                                        Chang's: ${result.horizontalCapacity.chang.Ha.toFixed(2)} kN<br>
                                        Broms': ${result.horizontalCapacity.broms.Ha.toFixed(2)} kN<br>
                                        <strong>최종: ${result.horizontalCapacity.Ha_final.toFixed(2)} kN</strong>
                                    </td>
                                    <td>
                                        <span class="status-badge status-pass">적용</span>
                                    </td>
                                </tr>
                                ` : ''}
                                ${result.upliftCapacity ? `
                                <tr>
                                    <td>인발 저항력</td>
                                    <td>-</td>
                                    <td>
                                        <strong>${result.upliftCapacity.Q_pull.toFixed(2)} kN</strong>
                                    </td>
                                    <td>
                                        <span class="status-badge status-pass">적용</span>
                                    </td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                        
                        ${result.horizontalCapacity ? `
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; margin-top: 20px;">
                            <h5 style="margin-bottom: 10px;">수평 지지력 계산 상세</h5>
                            <p style="margin: 5px 0;"><strong>지반반력계수:</strong> $k_h = ${result.horizontalCapacity.kh.toFixed(0)}$ kN/m³</p>
                            <p style="margin: 5px 0;"><strong>Chang's Method:</strong> $\\beta = ${result.horizontalCapacity.chang.beta.toFixed(6)}$ m⁻¹, $H_a = ${result.horizontalCapacity.chang.Ha.toFixed(2)}$ kN</p>
                            <p style="margin: 5px 0;"><strong>Broms' Method:</strong> $M_y = ${result.horizontalCapacity.broms.My.toFixed(2)}$ kN·m, $H_u = ${result.horizontalCapacity.broms.Hu.toFixed(2)}$ kN, $H_a = ${result.horizontalCapacity.broms.Ha.toFixed(2)}$ kN</p>
                            <p style="margin: 10px 0 0 0; font-weight: 600;">최종 허용 수평지지력: $H_a = ${result.horizontalCapacity.Ha_final.toFixed(2)}$ kN</p>
                        </div>
                        ` : ''}
                        ${result.upliftCapacity ? (() => {
                            const reportPile = getCurrentPile();
                            const Ap = Math.PI * Math.pow(reportPile.diameter, 2) / 4;
                            return `
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; margin-top: 20px;">
                            <h5 style="margin-bottom: 10px;">인발 저항력 계산 상세</h5>
                            <p style="margin: 5px 0;"><strong>지하수위:</strong> EL. ${result.upliftCapacity.gwlElevation.toFixed(2)} m</p>
                            <p style="margin: 5px 0;"><strong>구간 길이:</strong> 공기중 $l_1 = ${result.upliftCapacity.l1.toFixed(2)}$ m, 수중 $l_2 = ${result.upliftCapacity.l2.toFixed(2)}$ m</p>
                            <p style="margin: 5px 0;"><strong>전체 자중:</strong> $W_{total} = ${result.upliftCapacity.unitWeightPile.toFixed(2)} \\times ${result.pileLength.toFixed(1)} = ${result.upliftCapacity.weightTotal.toFixed(2)}$ kN</p>
                            <p style="margin: 5px 0;"><strong>부력:</strong> $B = A_p \\times l_2 \\times \\gamma_w = ${Ap.toFixed(4)} \\times ${result.upliftCapacity.l2.toFixed(2)} \\times 10 = ${result.upliftCapacity.buoyancy.toFixed(2)}$ kN</p>
                            <p style="margin: 5px 0;"><strong>유효 자중:</strong> $W_p = W_{total} - B = ${result.upliftCapacity.weightTotal.toFixed(2)} - ${result.upliftCapacity.buoyancy.toFixed(2)} = ${result.upliftCapacity.Wp.toFixed(2)}$ kN</p>
                            <p style="margin: 5px 0;"><strong>계산식:</strong> $Q_{pull} = \\frac{Q_u}{FS_p} + W_p = \\frac{${result.Qu.toFixed(1)}}{${parseFloat(document.getElementById('sfPullout').value) || 3.0}} + ${result.upliftCapacity.Wp.toFixed(2)} = ${result.upliftCapacity.Q_pull.toFixed(2)}$ kN</p>
                            <p style="margin: 10px 0 0 0; font-weight: 600;">허용 인발 저항력: $Q_{pull} = ${result.upliftCapacity.Q_pull.toFixed(2)}$ kN</p>
                        </div>
                        `;
                        })() : ''}
                    </div>
                `;
            });
            
            // 표지 섹션 HTML
            const coverSection = includeCover ? `
                <div data-report-section="cover" style="text-align: center; margin-bottom: 50px; min-height: 500px; display: flex; flex-direction: column; justify-content: center;">
                    ${companyLogoDataUrl ? `
                        <div style="margin-bottom: 40px;">
                            <img src="${companyLogoDataUrl}" alt="회사 로고" style="max-height: 100px; max-width: 300px;">
                        </div>
                    ` : ''}
                    <h1 style="color: var(--primary-navy); margin-bottom: 30px; font-size: 2rem;">
                        말뚝 기초 설계 검토 보고서
                    </h1>
                    <div style="margin: 40px 0;">
                        <p style="font-size: 1.4rem; margin: 10px 0; font-weight: 600;">${document.getElementById('projectName').value || '프로젝트명 미입력'}</p>
                        <p style="color: var(--text-secondary); font-size: 1.1rem;">${document.getElementById('projectLocation').value || ''}</p>
                    </div>
                    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid var(--border-primary);">
                        <p style="font-size: 1rem;">작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
                    </div>
                </div>
            ` : '';

            // 요약 및 설계 조건 섹션 HTML
            const summarySection = (includeSummary || includeDesignConditions) ? `
                <div data-report-section="summary" style="${includeCover ? 'page-break-before: always;' : ''} margin-top: 20px;">
                    ${includeSummary ? `
                    <h2 style="color: var(--primary-navy); margin-bottom: 30px;">요약 (Executive Summary)</h2>

                    <div style="margin-bottom: 30px;">
                        <h3 style="color: var(--primary-steel); margin-bottom: 15px;">1. 프로젝트 개요</h3>
                        <table class="data-table">
                            <tr>
                                <td style="width: 200px; font-weight: 600;">프로젝트명</td>
                                <td>${document.getElementById('projectName').value}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">위치</td>
                                <td>${document.getElementById('projectLocation').value}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">설계기준</td>
                                <td>구조물기초설계기준 (말뚝기초)</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">검토 시추공 수</td>
                                <td>${selectedResults.length}개 (전체 ${boreholeData.length}개 중)</td>
                            </tr>
                        </table>
                    </div>
                    ` : ''}

                    ${includeDesignConditions ? `
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: var(--primary-steel); margin-bottom: 15px;">${includeSummary ? '2.' : '1.'} 설계 조건</h3>
                        <table class="data-table">
                            <tr>
                                <td style="width: 200px; font-weight: 600;">말뚝 종류</td>
                                <td>${(() => {
                                    const pile = getCurrentPile();
                                    if (pile.type === 'phc') {
                                        return 'PHC 말뚝 (' + pile.spec + ')';
                                    } else {
                                        return '강관 말뚝 (' + pile.spec + ', ' + pile.material + ')';
                                    }
                                })()}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">시공 방법</td>
                                <td>${document.getElementById('constructionMethod').options[document.getElementById('constructionMethod').selectedIndex].text}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">안전율 (연직/수평/인발)</td>
                                <td>${document.getElementById('sfVertical').value} / ${document.getElementById('sfHorizontal').value} / ${document.getElementById('sfPullout').value}</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">허용 침하량</td>
                                <td>${document.getElementById('allowableSettlement').value} mm</td>
                            </tr>
                            <tr>
                                <td style="font-weight: 600;">선단지지력 계수</td>
                                <td>${document.getElementById('endBearingCoefficient').value} kN/m2</td>
                            </tr>
                        </table>
                    </div>
                    ` : ''}

                    ${includeSummary ? `
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: var(--primary-steel); margin-bottom: 15px;">${includeDesignConditions ? '3.' : '2.'} 검토 결과 요약</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>시추공</th>
                                    <th>말뚝길이 (m)</th>
                                    <th>극한지지력 (kN)</th>
                                    <th>허용지지력 (kN)</th>
                                    <th>총침하량 (mm)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${selectedResults.map(r => `
                                    <tr>
                                        <td>${r.borehole}</td>
                                        <td>${r.pileLength.toFixed(1)}</td>
                                        <td>${r.Qu.toFixed(0)}</td>
                                        <td>${r.Qa.toFixed(0)}</td>
                                        <td>${r.St.toFixed(1)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-bottom: 30px;">
                        <h3 style="color: var(--primary-steel); margin-bottom: 15px;">${includeDesignConditions ? '4.' : '3.'} 종합 평가</h3>
                        <div style="padding: 20px; background: var(--bg-tertiary); border-radius: 4px;">
                            <ul style="margin-left: 20px; line-height: 1.8;">
                                <li>평균 말뚝 길이: ${(selectedResults.reduce((sum, r) => sum + r.pileLength, 0) / selectedResults.length).toFixed(1)} m</li>
                                <li>평균 허용지지력: ${(selectedResults.reduce((sum, r) => sum + r.Qa, 0) / selectedResults.length).toFixed(0)} kN</li>
                                <li>최대 침하량: ${Math.max(...selectedResults.map(r => r.St)).toFixed(1)} mm</li>
                            </ul>
                        </div>
                    </div>
                    ` : ''}
                </div>
            ` : '';

            // 상세 계산서 섹션
            const detailedCalcSection = includeDetailedCalc ? `
                <div data-report-section="detailed-calc">
                    ${detailedCalculations}
                </div>
            ` : '';

            // 부록 섹션 HTML
            const appendixSection = includeAppendix ? `
                <div data-report-section="appendix" style="page-break-before: always; margin-top: 40px;">
                    <h2 style="color: var(--primary-navy); margin-bottom: 30px;">부록 (Appendix)</h2>

                    <h3 style="color: var(--primary-steel); margin-bottom: 15px;">A. 설계 기준 및 참고 문헌</h3>
                    <ul style="margin-left: 20px; line-height: 1.8;">
                        <li>구조물기초설계기준 해설 (2018)</li>
                        <li>도로교설계기준 (수평지반반력계수)</li>
                        <li>Tomlinson (1957) - alpha법 주면마찰력</li>
                        <li>Vesic, A.S. (1977) - 침하량 산정</li>
                        <li>Chang, Y.L. (1937) - 수평 변위기준 지지력</li>
                        <li>Broms, B. (1964) - 수평 파괴기준 지지력</li>
                    </ul>

                    <h3 style="color: var(--primary-steel); margin: 30px 0 15px 0;">B. 말뚝 제원 (Pile Specifications)</h3>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">B-1. PHC 말뚝 제원</h4>
                    <table class="data-table" style="margin-bottom: 30px;">
                        <thead>
                            <tr>
                                <th>규격</th>
                                <th>외경 (m)</th>
                                <th>벽두께 (m)</th>
                                <th>단면적 (m2)</th>
                                <th>단면2차모멘트 (m4)</th>
                                <th>허용지지력 (kN)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(PHC_PILES).map(([spec, props]) =>
                                '<tr><td><strong>' + spec + '</strong></td><td>' + props.diameter.toFixed(2) + '</td><td>' + props.thickness.toFixed(3) + '</td><td>' + props.area.toFixed(4) + '</td><td>' + props.I.toFixed(5) + '</td><td>' + props.allowable.toFixed(0) + '</td></tr>'
                            ).join('')}
                        </tbody>
                    </table>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">B-2. 강관 말뚝 제원</h4>
                    <div style="margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>강재 규격:</strong> KS F 4602, JIS A 5525, ASTM A252</p>
                        <p style="margin: 5px 0;"><strong>탄성계수:</strong> E = 200,000 MPa</p>
                        <p style="margin: 5px 0;"><strong>포아송비:</strong> v = 0.3</p>
                        <p style="margin: 5px 0;"><strong>단위중량:</strong> gamma = 7.85 t/m3</p>
                    </div>

                    <h3 style="color: var(--primary-steel); margin: 30px 0 15px 0;">C. 주요 계산식</h3>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">C-1. 연직 지지력</h4>
                    <div style="padding: 15px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 20px;">
                        <p style="margin: 10px 0;">극한지지력: $Q_u = Q_s + Q_p$</p>
                        <p style="margin: 10px 0;">주면마찰력: $Q_s = \\sum (f_s \\times A_s)$</p>
                        <p style="margin: 10px 0;">선단지지력: $Q_p = q_p \\times A_p$</p>
                        <p style="margin: 10px 0;">허용지지력: $Q_a = \\min(Q_u/FS, Q_{material})$</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">C-2. 침하량 (Vesic)</h4>
                    <div style="padding: 15px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 20px;">
                        <p style="margin: 10px 0;">총 침하량: $S_t = S_s + S_p + S_{ps}$</p>
                        <p style="margin: 10px 0;">탄성압축: $S_s = (Q_{ps} + \\alpha_s Q_{fs}) L / (A_p E_p)$</p>
                        <p style="margin: 10px 0;">선단침하: $S_p = Q_{ps} C_p / (B q_p)$</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">C-3. 수평 지지력</h4>
                    <div style="padding: 15px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 20px;">
                        <p style="margin: 10px 0;">Chang: $H_a = 2\\sqrt{EI k_h D} \\cdot Y / FS_h$</p>
                        <p style="margin: 10px 0;">Broms: $H_u = 9 M_y / (\\gamma D^3 K_p)$</p>
                        <p style="margin: 10px 0;">최종: $H_a = \\min(H_{Chang}, H_{Broms})$</p>
                    </div>

                    <h3 style="color: var(--primary-steel); margin: 30px 0 15px 0;">D. 토질정수 추정 근거</h3>
                    <p style="margin-bottom: 15px; color: var(--text-secondary);">
                        N값이 측정되지 않은 지층의 경우, 지층명 및 토질 특성을 기반으로 아래 기준에 따라 토질정수를 추정하였습니다.
                    </p>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">D-1. 비배수전단강도 (cu) 추정식</h4>
                    <table class="data-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>추정식</th>
                                <th>공식</th>
                                <th>출처</th>
                                <th>적용 대상</th>
                                <th>비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Terzaghi & Peck</td><td>$c_u = 6.25 \\times N$ (kPa)</td><td>Terzaghi & Peck (1967)</td><td>정규압밀 점토</td><td>가장 보편적 사용</td></tr>
                            <tr><td>Stroud</td><td>$c_u = 4.4 \\times N$ (kPa)</td><td>Stroud (1974)</td><td>과압밀 점토</td><td>보수적 추정</td></tr>
                            <tr><td>Hara</td><td>$c_u = 29 \\times N^{0.72}$ (kPa)</td><td>Hara et al. (1974)</td><td>일본 점토</td><td>비선형 관계</td></tr>
                        </tbody>
                    </table>
                    <div style="padding: 10px; background: #fff3cd; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>참고:</strong> 점성토 기본값은 Terzaghi & Peck (1967) 공식을 적용합니다. 사질토의 경우 cu = 0으로 설정됩니다.</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">D-2. 내부마찰각 (φ) 추정식</h4>
                    <table class="data-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>추정식</th>
                                <th>공식</th>
                                <th>출처</th>
                                <th>적용 대상</th>
                                <th>비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>Dunham</td><td>$\\phi = \\sqrt{12N} + 15$ (°)</td><td>Dunham (1954)</td><td>모래질 흙</td><td>널리 사용</td></tr>
                            <tr><td>Peck</td><td>$\\phi = 28 + 0.4N$ (°), max 40°</td><td>Peck et al. (1953)</td><td>사질토</td><td>상한 40° 제한</td></tr>
                            <tr><td>JRA</td><td>$\\phi = \\sqrt{20N} + 15$ (°)</td><td>일본도로협회 (1996)</td><td>사질토 일반</td><td>일본 기준</td></tr>
                        </tbody>
                    </table>
                    <div style="padding: 10px; background: #fff3cd; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>참고:</strong> 사질토 기본값은 Dunham (1954) 공식을 적용합니다. 점성토의 경우 별도 계산 없이 경험적 값을 사용합니다.</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">D-3. 단위중량 (γ) 추정 범위</h4>
                    <table class="data-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>지층 종류</th>
                                <th>단위중량 범위 (kN/m³)</th>
                                <th>기본 적용값</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>유기질토</td><td>12 ~ 16</td><td>14</td></tr>
                            <tr><td>연약점토</td><td>15 ~ 17</td><td>16</td></tr>
                            <tr><td>보통점토</td><td>17 ~ 19</td><td>18</td></tr>
                            <tr><td>느슨한 모래</td><td>16 ~ 18</td><td>17</td></tr>
                            <tr><td>조밀한 모래</td><td>18 ~ 20</td><td>19</td></tr>
                            <tr><td>풍화토</td><td>18 ~ 20</td><td>19</td></tr>
                            <tr><td>풍화암</td><td>20 ~ 23</td><td>21</td></tr>
                            <tr><td>연암</td><td>22 ~ 25</td><td>23</td></tr>
                        </tbody>
                    </table>
                    <div style="padding: 10px; background: #d4edda; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #28a745;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>참고:</strong> 지하수위 아래에서는 수중단위중량 ($\\gamma' = \\gamma_{sat} - 10$)을 적용해야 합니다.</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">D-4. 탄성계수 (E) 추정식</h4>
                    <table class="data-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>지층 종류</th>
                                <th>추정식</th>
                                <th>출처</th>
                                <th>경험적 범위</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>점성토</td><td>$E = 300 \\sim 500 \\times c_u$ (kPa)</td><td>Duncan & Buchignani (1976)</td><td>2 ~ 30 MPa</td></tr>
                            <tr><td>사질토</td><td>$E = 500 \\sim 1500 \\times \\sqrt{N}$ (kPa)</td><td>Bowles (1996)</td><td>10 ~ 80 MPa</td></tr>
                            <tr><td>일반 (간편식)</td><td>$E = 2.5 \\times N$ (MPa)</td><td>실무 간편식</td><td>개략적 추정용</td></tr>
                        </tbody>
                    </table>
                    <div style="padding: 10px; background: #fff3cd; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>참고:</strong> 기본적으로 간편식 ($E = 2.5N$)을 적용하며, 정밀 검토 시 지층 특성에 따른 별도 공식을 사용합니다.</p>
                    </div>

                    <h4 style="color: var(--primary-navy); margin: 20px 0 10px 0;">D-5. N값 미측정 시 지층명 기반 기본값</h4>
                    <p style="margin-bottom: 10px; color: var(--text-secondary);">
                        시료가 채취되지 않은 지층의 경우, 지층명을 분석하여 아래 기본값을 적용합니다:
                    </p>
                    <table class="data-table" style="margin-bottom: 20px;">
                        <thead>
                            <tr>
                                <th>지층 분류</th>
                                <th>대표 지층명</th>
                                <th>기본 N값</th>
                                <th>cu (kPa)</th>
                                <th>φ (°)</th>
                                <th>γ (kN/m³)</th>
                                <th>E (MPa)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>매립토</td><td>매립층, 성토층</td><td>5</td><td>-</td><td>28</td><td>17</td><td>12.5</td></tr>
                            <tr><td>연약 점토</td><td>점토, 실트, 연약층</td><td>4</td><td>25</td><td>-</td><td>16</td><td>10</td></tr>
                            <tr><td>모래</td><td>사층, 모래층, 사질토</td><td>15</td><td>-</td><td>32</td><td>18</td><td>37.5</td></tr>
                            <tr><td>자갈</td><td>자갈층, 역층, 사력층</td><td>30</td><td>-</td><td>36</td><td>20</td><td>75</td></tr>
                            <tr><td>풍화토</td><td>풍화토, 풍화잔류토</td><td>25</td><td>-</td><td>33</td><td>19</td><td>62.5</td></tr>
                            <tr><td>풍화암</td><td>풍화암</td><td>50</td><td>-</td><td>38</td><td>21</td><td>125</td></tr>
                            <tr><td>연암</td><td>연암, 기반암</td><td>50+</td><td>-</td><td>40</td><td>23</td><td>200+</td></tr>
                        </tbody>
                    </table>
                    <div style="padding: 10px; background: #f8d7da; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
                        <p style="margin: 0; font-size: 0.9rem;"><strong>주의:</strong> 위 기본값은 N값 데이터가 없는 경우에 한하여 참고용으로 사용됩니다.
                        실제 설계 시에는 현장 시험 결과를 우선 적용해야 하며, 기본값 적용 시 보수적 판단이 필요합니다.
                        보고서에서 "(샘플없음-추정)"으로 표기된 지층은 이 기준이 적용된 것입니다.</p>
                    </div>
                </div>
            ` : '';

            // 서명란 섹션 HTML
            const signatureSection = includeSignature ? `
                <div data-report-section="signature" style="margin-top: 60px; padding-top: 30px; border-top: 2px solid var(--border-primary);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px;">
                        <div style="text-align: center;">
                            <p style="margin-bottom: 50px; font-weight: 600;">작성</p>
                            <div style="border-bottom: 1px solid var(--border-primary); width: 150px; margin: 0 auto;"></div>
                            <p style="margin-top: 10px; color: var(--text-secondary);">담당자</p>
                        </div>
                        <div style="text-align: center;">
                            <p style="margin-bottom: 50px; font-weight: 600;">검토</p>
                            <div style="border-bottom: 1px solid var(--border-primary); width: 150px; margin: 0 auto;"></div>
                            <p style="margin-top: 10px; color: var(--text-secondary);">팀장</p>
                        </div>
                        <div style="text-align: center;">
                            <p style="margin-bottom: 50px; font-weight: 600;">승인</p>
                            <div style="border-bottom: 1px solid var(--border-primary); width: 150px; margin: 0 auto;"></div>
                            <p style="margin-top: 10px; color: var(--text-secondary);">본부장</p>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 40px;">
                        <p style="color: var(--text-muted); font-size: 0.9rem;">
                            Copyright ${new Date().getFullYear()} All Rights Reserved
                        </p>
                    </div>
                </div>
            ` : '';

            // CSS 변수를 직접 색상 값으로 변환 (PDF/Word 호환성)
            const cssVarMap = {
                'var(--primary-navy)': '#1e3a5f',
                'var(--primary-steel)': '#4a6fa5',
                'var(--bg-tertiary)': '#f5f5f5',
                'var(--bg-secondary)': '#fafafa',
                'var(--text-primary)': '#1a1a2e',
                'var(--text-secondary)': '#4a4a68',
                'var(--text-muted)': '#8a8aa3',
                'var(--border-primary)': '#d1d5db',
                'var(--status-pass)': '#2e7d32',
                'var(--status-fail)': '#c62828'
            };

            let reportHTML = `
                <div style="border: 2px solid #1e3a5f; padding: 30px; background: white;">
                    ${coverSection}
                    ${summarySection}
                    ${detailedCalcSection}
                    ${appendixSection}
                    ${signatureSection}
                </div>
            `;

            // CSS 변수를 실제 색상으로 대체
            for (const [cssVar, value] of Object.entries(cssVarMap)) {
                const regex = new RegExp(cssVar.replace(/[()]/g, '\\$&'), 'g');
                reportHTML = reportHTML.replace(regex, value);
            }

            reportContent.innerHTML = reportHTML;

            // Render MathJax for formulas in the report
            setTimeout(() => {
                if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                    MathJax.typesetPromise([reportContent]).catch((err) => console.log('MathJax typeset error:', err));
                }
            }, 100);
        }

        function printReport() {
            window.print();
        }
        
        async function exportToWord() {
            try {
                const reportContent = document.getElementById('reportContent');
                if (!reportContent.innerHTML.trim() || reportContent.innerHTML.includes('보고서 생성" 버튼을 클릭')) {
                    alert('먼저 보고서를 생성해주세요.');
                    return;
                }

                const projectName = document.getElementById('projectName').value || '말뚝기초설계';
                const fileName = `${projectName}_설계보고서_${new Date().toISOString().split('T')[0]}.doc`;

                // HTML 전처리
                let processedHTML = reportContent.innerHTML
                    .replace(/var\(--primary-navy\)/g, '#1e3a5f')
                    .replace(/var\(--primary-steel\)/g, '#4a6fa5')
                    .replace(/var\(--bg-tertiary\)/g, '#f5f5f5')
                    .replace(/var\(--bg-secondary\)/g, '#fafafa')
                    .replace(/var\(--text-primary\)/g, '#1a1a2e')
                    .replace(/var\(--text-secondary\)/g, '#555')
                    .replace(/var\(--text-muted\)/g, '#888')
                    .replace(/var\(--border-primary\)/g, '#ccc')
                    .replace(/var\(--status-pass\)/g, '#2e7d32')
                    .replace(/var\(--status-fail\)/g, '#c62828')
                    .replace(/data-report-section="[^"]*"/g, '')
                    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
                    .replace(/display:\s*flex[^;]*/gi, '')
                    .replace(/display:\s*grid[^;]*/gi, '')
                    .replace(/justify-content:[^;]*/gi, '')
                    .replace(/align-items:[^;]*/gi, '')
                    .replace(/flex-direction:[^;]*/gi, '')
                    .replace(/gap:[^;]*/gi, '');

                // MathJax 수식을 텍스트로 변환
                processedHTML = processedHTML.replace(/<mjx-container[^>]*>[\s\S]*?<\/mjx-container>/gi, '[수식]');

                // Word 호환 HTML 생성
                const wordHTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page { size: A4; margin: 2cm; }
body { font-family: '맑은 고딕', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
h1 { font-size: 18pt; color: #1e3a5f; text-align: center; margin: 20pt 0; padding-bottom: 10pt; border-bottom: 2pt solid #1e3a5f; }
h2 { font-size: 14pt; color: #1e3a5f; margin: 18pt 0 12pt 0; padding-left: 8pt; border-left: 4pt solid #1e3a5f; }
h3 { font-size: 12pt; color: #2c5282; margin: 14pt 0 8pt 0; }
h4 { font-size: 11pt; color: #2c5282; margin: 12pt 0 6pt 0; }
h5 { font-size: 10pt; color: #2e7d32; margin: 8pt 0 4pt 0; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 9pt; }
th { background-color: #1e3a5f; color: #fff; padding: 6pt; text-align: center; font-weight: bold; border: 1pt solid #000; }
td { padding: 5pt; border: 1pt solid #000; text-align: center; vertical-align: middle; }
p { margin: 6pt 0; }
ul, ol { margin: 8pt 0 8pt 20pt; }
li { margin: 3pt 0; }
.status-pass { color: #2e7d32; font-weight: bold; }
.status-fail { color: #c62828; font-weight: bold; }
div { margin: 5pt 0; }
</style>
</head>
<body>
${processedHTML}
</body>
</html>`;

                // Blob 생성 및 다운로드
                const blob = new Blob(['\ufeff' + wordHTML], { type: 'application/msword;charset=utf-8' });

                // 다운로드 링크 생성
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);

                alert('Word 파일이 생성되었습니다.\n\n참고: 수식은 [수식]으로 표시됩니다.\nMicrosoft Word에서 열어주세요.');
            } catch (error) {
                console.error('Word export error:', error);
                alert('Word 파일 생성 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // ============================================================
        // 보고서 생성 관련 전역 변수
        // ============================================================
        let companyLogoDataUrl = null;

        // ============================================================
        // 로고 업로드 관련 함수
        // ============================================================
        function handleLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 파일 타입 검증
            if (!file.type.startsWith('image/')) {
                alert('이미지 파일만 업로드 가능합니다.');
                return;
            }

            // 파일 크기 검증 (최대 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('파일 크기는 5MB 이하로 제한됩니다.');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                companyLogoDataUrl = e.target.result;

                // 미리보기 표시
                const preview = document.getElementById('logoPreview');
                const previewContainer = document.getElementById('logoPreviewContainer');
                const fileName = document.getElementById('logoFileName');

                preview.src = companyLogoDataUrl;
                previewContainer.style.display = 'flex';
                fileName.textContent = file.name;

                console.log('로고 업로드 완료:', file.name);
            };
            reader.readAsDataURL(file);
        }

        function removeLogo() {
            companyLogoDataUrl = null;
            document.getElementById('logoPreview').src = '';
            document.getElementById('logoPreviewContainer').style.display = 'none';
            document.getElementById('logoFileName').textContent = '';
            document.getElementById('companyLogoInput').value = '';
        }

        // ============================================================
        // 시추공 선택 관련 함수
        // ============================================================
        function updateBoreholeSelection() {
            const container = document.getElementById('boreholeSelectionContainer');
            if (!container) return;

            if (!boreholeData || boreholeData.length === 0) {
                container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">시추공 데이터를 먼저 로드해주세요.</span>';
                return;
            }

            container.innerHTML = boreholeData.map((bh, idx) => `
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 6px 12px; background: var(--bg-tertiary); border-radius: 4px; border: 1px solid var(--border-primary);">
                    <input type="checkbox" class="borehole-select-checkbox" data-index="${idx}" checked>
                    <span style="font-size: 0.9rem;">${bh.hole_no || '시추공 ' + (idx + 1)}</span>
                </label>
            `).join('');
        }

        function selectAllBoreholes(select) {
            const checkboxes = document.querySelectorAll('.borehole-select-checkbox');
            checkboxes.forEach(cb => cb.checked = select);
        }

        function getSelectedBoreholeIndices() {
            const checkboxes = document.querySelectorAll('.borehole-select-checkbox:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        }

        // ============================================================
        // PDF 생성 함수 - 새 창 인쇄 방식 (가장 안정적)
        // ============================================================
        async function exportToPDF() {
            const reportContent = document.getElementById('reportContent');

            // 보고서 내용 확인
            if (!reportContent.innerHTML.trim() || reportContent.innerHTML.includes('보고서 생성" 버튼을 클릭')) {
                alert('먼저 보고서를 생성해주세요.');
                return;
            }

            // 진행 상태 표시
            const progressContainer = document.getElementById('pdfProgressContainer');
            const progressBar = document.getElementById('pdfProgressBar');
            const progressText = document.getElementById('pdfProgressText');
            progressContainer.style.display = 'block';
            progressBar.style.width = '50%';
            progressText.textContent = '인쇄 창 준비 중...';

            try {
                // MathJax 렌더링 완료 대기
                if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                    await MathJax.typesetPromise([reportContent]);
                }
                await new Promise(resolve => setTimeout(resolve, 300));

                const projectName = document.getElementById('projectName').value || '말뚝기초설계';

                // CSS 변수를 실제 색상으로 변환
                let htmlContent = reportContent.innerHTML
                    .replace(/var\(--primary-navy\)/g, '#1e3a5f')
                    .replace(/var\(--primary-steel\)/g, '#4a6fa5')
                    .replace(/var\(--bg-tertiary\)/g, '#f5f5f5')
                    .replace(/var\(--bg-secondary\)/g, '#fafafa')
                    .replace(/var\(--text-primary\)/g, '#1a1a2e')
                    .replace(/var\(--text-secondary\)/g, '#555')
                    .replace(/var\(--text-muted\)/g, '#888')
                    .replace(/var\(--border-primary\)/g, '#ccc')
                    .replace(/var\(--status-pass\)/g, '#2e7d32')
                    .replace(/var\(--status-fail\)/g, '#c62828')
                    .replace(/data-report-section="[^"]*"/g, '');

                // 새 창 열기
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                    alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
                    progressContainer.style.display = 'none';
                    return;
                }

                // 인쇄용 HTML 작성
                printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${projectName} - 설계보고서</title>
<style>
@page { size: A4; margin: 15mm; }
@media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
}
* { box-sizing: border-box; }
body {
    font-family: 'Malgun Gothic', sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 15px;
}
h1 { font-size: 18pt; color: #1e3a5f; text-align: center; margin: 20px 0; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
h2 { font-size: 14pt; color: #1e3a5f; margin: 20px 0 10px; border-left: 4px solid #1e3a5f; padding-left: 10px; }
h3 { font-size: 12pt; color: #2c5282; margin: 15px 0 8px; }
h4 { font-size: 11pt; color: #2c5282; margin: 12px 0 6px; }
h5 { font-size: 10pt; color: #2e7d32; margin: 10px 0 5px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; }
th, td { border: 1px solid #333; padding: 5px 6px; text-align: center; vertical-align: middle; }
th { background: #1e3a5f; color: #fff; font-weight: bold; }
tr:nth-child(even) { background: #f5f5f5; }
p { margin: 6px 0; }
ul, ol { margin: 8px 0 8px 20px; }
li { margin: 3px 0; }
.data-table { width: 100%; }
.status-pass { color: #2e7d32; font-weight: bold; }
.status-fail { color: #c62828; font-weight: bold; }
img { max-width: 100%; height: auto; }
</style>
<script>
window.MathJax = {
    tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
    startup: {
        pageReady: function() {
            return MathJax.startup.defaultPageReady().then(function() {
                setTimeout(function() { window.print(); }, 800);
            });
        }
    }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"><\/script>
</head>
<body>
<div style="max-width: 180mm; margin: 0 auto;">
${htmlContent}
</div>
<div class="no-print" style="position:fixed;top:10px;right:10px;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:5px;cursor:pointer;z-index:9999" onclick="window.print()">PDF로 인쇄</div>
</body>
</html>`);
                printWindow.document.close();

                progressBar.style.width = '100%';
                progressText.textContent = '인쇄 대화상자에서 "PDF로 저장" 선택!';

                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error('PDF 생성 오류:', error);
                alert('PDF 생성 중 오류가 발생했습니다: ' + error.message);
                progressContainer.style.display = 'none';
            }
        }

        function exportReport() {
            // 레거시 함수 - exportToPDF로 리다이렉트
            exportToPDF();
        }

        function resetInputs() {
            if (confirm('모든 입력값을 초기화하시겠습니까?')) {
                location.reload();
            }
        }

        function showLoading() {
            document.getElementById('loadingSpinner').classList.add('active');
        }

        function hideLoading() {
            setTimeout(() => {
                document.getElementById('loadingSpinner').classList.remove('active');
            }, 300);
        }

        // ============================================================
        // Sensitivity Analysis Functions
        // ============================================================
        
        function initializeSensitivityAnalysis() {
            // Add event listeners for parameter changes
            const param1Select = document.getElementById('sensitivityParam1');
            const param2Select = document.getElementById('sensitivityParam2');
            
            if (param1Select) {
                param1Select.addEventListener('change', updateSensitivityRangeControls);
            }
            if (param2Select) {
                param2Select.addEventListener('change', updateSensitivityRangeControls);
            }
        }

        function updateSensitivityBoreholeSelect() {
            const select = document.getElementById('sensitivityBoreholeSelect');
            if (!select) return;
            
            select.innerHTML = '';
            if (boreholeData && boreholeData.length > 0) {
                boreholeData.forEach((borehole, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = borehole.hole_no || `시추공 ${index + 1}`;
                    if (index === 0) option.selected = true;
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '시추공 데이터가 없습니다';
                select.appendChild(option);
            }
        }

        function updateSensitivityRangeControls() {
            const param1 = document.getElementById('sensitivityParam1')?.value || 'diameter';
            const param2 = document.getElementById('sensitivityParam2')?.value || 'penetration';
            
            updateParamRangeControl('param1RangeControls', param1);
            updateParamRangeControl('param2RangeControls', param2);
        }

        function updateParamRangeControl(containerId, paramType) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            let html = '';
            
            switch(paramType) {
                case 'diameter':
                    html = `
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <span>직경:</span>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="0.4" checked> Ø400
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="0.45" checked> Ø450
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="0.5" checked> Ø500
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="0.6" checked> Ø600
                            </label>
                        </div>
                    `;
                    break;
                case 'penetration':
                    html = `
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <span>근입깊이:</span>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="0.5" checked> 0.5m
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="1.0" checked> 1.0m
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="1.5" checked> 1.5m
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="2.0" checked> 2.0m
                            </label>
                        </div>
                    `;
                    break;
                case 'endBearingCoeff':
                    html = `
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <span>계수 (kN/m²):</span>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="250" checked> 250
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="300" checked> 300
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="350" checked> 350
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="400" checked> 400
                            </label>
                        </div>
                    `;
                    break;
                case 'pileType':
                    html = `
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            <span>말뚝 종류:</span>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="phc" checked> PHC
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" class="param-value" value="steel" checked> 강관
                            </label>
                        </div>
                    `;
                    break;
            }
            
            container.innerHTML = html;
        }

        function runSensitivityAnalysis() {
            if (!calculationResults || calculationResults.length === 0) {
                alert('먼저 통합 분석을 실행해주세요.');
                return;
            }
            
            const boreholeIndex = parseInt(document.getElementById('sensitivityBoreholeSelect').value);
            if (isNaN(boreholeIndex) || !boreholeData[boreholeIndex]) {
                alert('시추공을 선택해주세요.');
                return;
            }
            
            const param1 = document.getElementById('sensitivityParam1').value;
            const param2 = document.getElementById('sensitivityParam2').value;
            
            if (param1 === param2) {
                alert('변수 1과 변수 2는 서로 다른 값을 선택해야 합니다.');
                return;
            }
            
            // Get selected values for each parameter
            const param1Values = Array.from(document.querySelectorAll('#param1RangeControls .param-value:checked')).map(cb => {
                if (param1 === 'pileType') return cb.value; // String value
                return parseFloat(cb.value);
            });
            const param2Values = Array.from(document.querySelectorAll('#param2RangeControls .param-value:checked')).map(cb => {
                if (param2 === 'pileType') return cb.value; // String value
                return parseFloat(cb.value);
            });
            
            if (param1Values.length === 0 || param2Values.length === 0) {
                alert('각 변수에 대해 최소 1개 이상의 값을 선택해주세요.');
                return;
            }
            
            // Get analysis metrics
            const metrics = {
                allowable: document.getElementById('sensitivityAllowable').checked,
                settlement: document.getElementById('sensitivitySettlement').checked,
                horizontal: document.getElementById('sensitivityHorizontal').checked,
                cost: document.getElementById('sensitivityCost').checked
            };
            
            if (!metrics.allowable && !metrics.settlement && !metrics.horizontal && !metrics.cost) {
                alert('최소 1개 이상의 분석 지표를 선택해주세요.');
                return;
            }
            
            showLoading();
            
            // Perform sensitivity analysis
            const results = performSensitivityCalculation(boreholeIndex, param1, param2, param1Values, param2Values, metrics);
            
            // Display results
            displaySensitivityResults(results, param1, param2, param1Values, param2Values, metrics);
            
            hideLoading();
        }

        function performSensitivityCalculation(boreholeIndex, param1, param2, param1Values, param2Values, metrics) {
            const borehole = boreholeData[boreholeIndex];
            const baseResult = calculationResults[boreholeIndex];
            const results = [];
            
            // Get base values
            const basePile = getCurrentPile();
            const baseDiameter = basePile.diameter;
            const basePileType = basePile.type || 'phc';
            const basePenetration = 1.0; // Default penetration
            const baseSafetyFactor = parseFloat(document.getElementById('sfVertical').value) || 3.0;
            const baseEndBearingCoeff = parseFloat(document.getElementById('endBearingCoefficient').value) || 300;
            
            // Calculate for each combination
            for (let i = 0; i < param1Values.length; i++) {
                for (let j = 0; j < param2Values.length; j++) {
                    const p1Value = param1Values[i];
                    const p2Value = param2Values[j];
                    
                    // Create parameter combination
                    const params = {
                        diameter: baseDiameter,
                        pileType: basePileType,
                        penetration: basePenetration,
                        safetyFactor: baseSafetyFactor,
                        endBearingCoeff: baseEndBearingCoeff
                    };
                    
                    // Apply parameter values
                    if (param1 === 'diameter') params.diameter = parseFloat(p1Value);
                    else if (param1 === 'pileType') params.pileType = p1Value;
                    else if (param1 === 'penetration') params.penetration = parseFloat(p1Value);
                    else if (param1 === 'endBearingCoeff') params.endBearingCoeff = parseFloat(p1Value);

                    if (param2 === 'diameter') params.diameter = parseFloat(p2Value);
                    else if (param2 === 'pileType') params.pileType = p2Value;
                    else if (param2 === 'penetration') params.penetration = parseFloat(p2Value);
                    else if (param2 === 'endBearingCoeff') params.endBearingCoeff = parseFloat(p2Value);
                    
                    // Calculate with modified parameters
                    const calcResult = calculateSensitivityCase(borehole, params, baseResult);
                    
                    results.push({
                        param1Value: p1Value,
                        param2Value: p2Value,
                        param1Index: i,
                        param2Index: j,
                        ...calcResult
                    });
                }
            }
            
            return results;
        }

        function calculateSensitivityCase(borehole, params, baseResult) {
            // Simplified calculation for sensitivity analysis
            // This uses the same logic as calculateForBorehole but with modified parameters
            
            const pile = getPileByDiameterAndType(params.diameter, params.pileType);
            const D = params.diameter;
            
            // Get original ground elevation
            const originalElevation = getGroundSurfaceElevation(borehole.metadata) || 0;
            const targetElevation = parseFloat(document.getElementById('targetGroundElevation').value) || originalElevation;
            
            // Find bearing layer
            const bearingLayer = findBearingLayer(borehole);
            if (!bearingLayer) {
                return { Qa: 0, Qu: 0, St: 0, Ha: 0, safetyFactor: 0, costIndex: 100 };
            }
            
            // Calculate pile length with modified penetration
            const bearingDepth = getBearingLayerDepth(borehole, bearingLayer);
            const pileTipDepth = bearingDepth + params.penetration;
            const pileLength = pileTipDepth;
            
            // Calculate skin friction (simplified)
            let Qs = 0;
            const method = document.getElementById('constructionMethod').value;
            const methodFactor = method === 'driven' ? 1.0 : 0.7;
            
            // Simplified skin friction calculation
            for (let depth = 0; depth < pileLength; depth += 1) {
                const layer = findLayerAtDepth(borehole, depth);
                if (!layer) continue;
                
                const avgN = getAverageN(layer);
                const As = Math.PI * D * 1.0;
                let fs = 0;
                
                if (layer.soil_name.includes('점토') || layer.soil_name.includes('실트')) {
                    const cu = 12 * avgN;
                    const alpha = cu < 25 ? 1.0 : cu < 50 ? 0.7 : 0.5;
                    fs = alpha * cu;
                } else {
                    const beta = 0.3;
                    const sigma_v = 18 * depth;
                    fs = beta * sigma_v;
                }
                
                fs *= methodFactor;
                Qs += fs * As;
            }
            
            // Calculate end bearing
            const tipN = getAverageN(bearingLayer);
            const qp = Math.min(params.endBearingCoeff * tipN, 10000);
            const Ap = Math.PI * D * D / 4;
            const Qp = qp * Ap;
            
            const Qu = Qs + Qp;
            const Qa_soil = Qu / params.safetyFactor;
            
            // Apply splice reduction (same logic as calculateForBorehole)
            const spliceMethod = document.getElementById('spliceMethod').value;
            const PILE_UNIT_LENGTH = 15.0;
            const numberOfSplices = Math.floor(pileLength / PILE_UNIT_LENGTH);
            
            let spliceReductionRate = 0.0;
            if (spliceMethod !== 'none' && numberOfSplices > 0) {
                if (spliceMethod === 'welding') {
                    spliceReductionRate = numberOfSplices * 5.0;
                } else if (spliceMethod === 'bolting') {
                    spliceReductionRate = numberOfSplices * 10.0;
                } else if (spliceMethod === 'filled') {
                    for (let i = 0; i < numberOfSplices; i++) {
                        spliceReductionRate += (i < 2 ? 20.0 : 30.0);
                    }
                }
            }
            spliceReductionRate = Math.min(spliceReductionRate, 100.0);
            const spliceFactor = 1.0 - (spliceReductionRate / 100.0);
            
            const Qa_material = (pile.allowable || 0) * spliceFactor;
            const Qa = Math.min(Qa_soil, Qa_material);
            
            // Simplified settlement
            // 구조물 기초 설계기준 해설 표 5.3.10 기준
            const E = params.pileType === 'steel' ? PILE_ELASTIC_MODULUS.STEEL.E_kPa : PILE_ELASTIC_MODULUS.PHC.E_kPa;
            const Se = (Qa * pileLength) / (pile.area * E) * 1000;
            const Es = 2500 * tipN;
            const q_applied = Qa / Ap;
            const Sp = (q_applied * D * 0.85) / Es * 1000;
            const St = Se + Sp;
            
            // Cost index (relative to base)
            // 비용지수 = (재료량 비율) × (단가 비율)
            // 재료량 = 단면적 × 길이 (단면적은 직경²에 비례)
            // 단가 비율 = 말뚝 종류별 단가 비율
            const basePile = getCurrentPile();
            const baseDiameter = basePile.diameter;
            const basePileType = basePile.type || 'phc';
            const baseLength = pileLength; // Use current calculation's pile length
            
            // Get user-defined cost ratio (강관/PHC 비용 비율)
            const steelPhcCostRatio = parseFloat(document.getElementById('steelPhcCostRatio')?.value) || 1.5;
            
            // Cost factor: PHC = 1.0, Steel = user-defined ratio
            const pileTypeCostFactor = params.pileType === 'steel' ? steelPhcCostRatio : 1.0;
            const basePileTypeCostFactor = basePileType === 'steel' ? steelPhcCostRatio : 1.0;
            
            // Material volume ratio = (area ratio) × (length ratio)
            // Area ratio = (diameter/baseDiameter)²
            // Length ratio = (pileLength/baseLength)
            const areaRatio = Math.pow(params.diameter / baseDiameter, 2);
            const lengthRatio = pileLength / baseLength;
            const materialVolumeRatio = areaRatio * lengthRatio;
            
            // Cost index = material volume ratio × unit cost ratio
            const costIndex = materialVolumeRatio * (pileTypeCostFactor / basePileTypeCostFactor) * 100;
            
            // Calculate horizontal capacity
            const horizontalResult = calculateHorizontalCapacity(borehole, pile, pileLength, D);
            const Ha = horizontalResult.Ha_final || 0;
            
            return {
                Qa: Qa,
                Qu: Qu,
                Qs: Qs,
                Qp: Qp,
                St: St,
                Ha: Ha,
                safetyFactor: params.safetyFactor,
                costIndex: costIndex
            };
        }

        function getPileByDiameterAndType(diameter, pileType) {
            if (pileType === 'steel') {
                // For steel, create a simplified pile object
                const D = diameter;
                const t = D * 0.02; // Approximate thickness (2% of diameter)
                const d = D - 2 * t;
                const A = Math.PI / 4 * (D * D - d * d);
                const I = Math.PI / 64 * (Math.pow(D, 4) - Math.pow(d, 4));
                const mat = STEEL_PIPE_SPECS.materials['SKK400'];
                const allowableStress = mat ? mat.yieldStrength / 1.5 : 235 / 1.5;
                const allowable = allowableStress * A * 1000;
                
                return {
                    type: 'steel',
                    diameter: D,
                    thickness: t,
                    area: A,
                    crossArea: Math.PI * D * D / 4,
                    I: I,
                    allowable: allowable
                };
            } else {
                // PHC pile
                const specs = Object.entries(PHC_PILES).find(([spec, props]) => Math.abs(props.diameter - diameter) < 0.01);
                if (specs) {
                    return { ...PHC_PILES[specs[0]], type: 'phc' };
                }
                // Default to closest
                return { ...PHC_PILES['500-A'], type: 'phc' };
            }
        }

        function findBearingLayer(borehole) {
            if (!borehole.soil_data) return null;
            
            for (let layer of borehole.soil_data) {
                const soilName = layer.soil_name || '';
                if (soilName.includes('풍화암') || soilName.includes('연암') || soilName.includes('암반')) {
                    return layer;
                }
            }
            
            // Return last layer if no rock found
            return borehole.soil_data[borehole.soil_data.length - 1] || null;
        }

        function getBearingLayerDepth(borehole, bearingLayer) {
            if (!bearingLayer || !bearingLayer.depth_range) return 20;
            
            const depthMatch = bearingLayer.depth_range.match(/([\d.]+)~([\d.]+)m/);
            if (depthMatch) {
                return parseFloat(depthMatch[1]);
            }
            return 20;
        }

        function displaySensitivityResults(results, param1, param2, param1Values, param2Values, metrics) {
            // Show results section
            document.getElementById('sensitivityResults').style.display = 'block';
            
            // Update heatmap
            updateSensitivityHeatmap(results, param1, param2, param1Values, param2Values, metrics);
            
            // Update comparison table
            updateSensitivityComparisonTable(results, param1, param2, param1Values, param2Values, metrics);
            
            // Update detail table
            updateSensitivityDetailTable(results, param1, param2, param1Values, param2Values, metrics);
        }

        function updateSensitivityHeatmap(results, param1, param2, param1Values, param2Values, metrics) {
            const ctx = document.getElementById('sensitivityHeatmapChart');
            if (!ctx) return;
            
            if (sensitivityChart) {
                sensitivityChart.destroy();
            }
            
            // Prepare data for heatmap
            // Priority: allowable > horizontal > settlement > cost
            const primaryMetric = metrics.allowable ? 'Qa' :
                                 (metrics.horizontal ? 'Ha' :
                                 (metrics.settlement ? 'St' : 'costIndex'));
            
            // Create matrix data
            const matrixData = [];
            const labelsX = param1Values.map(v => formatParamValue(param1, v));
            const labelsY = param2Values.map(v => formatParamValue(param2, v));
            
            for (let j = 0; j < param2Values.length; j++) {
                const row = [];
                for (let i = 0; i < param1Values.length; i++) {
                    const result = results.find(r => r.param1Index === i && r.param2Index === j);
                    row.push(result ? result[primaryMetric] : 0);
                }
                matrixData.push(row);
            }
            
            // Create chart with heatmap-like visualization using bar chart
            const datasets = labelsY.map((label, j) => ({
                label: label,
                data: matrixData[j],
                backgroundColor: matrixData[j].map(val => getHeatmapColor(val, primaryMetric, results)),
                borderColor: 'rgba(255, 255, 255, 0.8)',
                borderWidth: 1
            }));
            
            sensitivityChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labelsX,
                    datasets: datasets
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: getParamLabel(param1) },
                            stacked: false
                        },
                        y: {
                            title: { display: true, text: getParamLabel(param2) },
                            stacked: false
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const result = results.find(r => 
                                        r.param1Index === context.dataIndex && 
                                        r.param2Index === context.datasetIndex
                                    );
                                    if (!result) return '';
                                    
                                    let tooltip = `${getMetricLabel(primaryMetric)}: ${formatMetricValue(primaryMetric, result[primaryMetric])}`;
                                    if (metrics.allowable && primaryMetric !== 'Qa') {
                                        tooltip += `\n허용지지력: ${result.Qa.toFixed(0)} kN`;
                                    }
                                    if (metrics.horizontal && primaryMetric !== 'Ha') {
                                        tooltip += `\n수평지지력: ${result.Ha.toFixed(0)} kN`;
                                    }
                                    if (metrics.settlement && primaryMetric !== 'St') {
                                        tooltip += `\n침하량: ${(result.St || 0).toFixed(1)} mm`;
                                    }
                                    return tooltip;
                                }
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    }
                }
            });
        }

        function getHeatmapColor(value, metric, allResults) {
            const values = allResults.map(r => r[metric]).filter(v => v > 0);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min;
            
            if (range === 0) return 'rgba(128, 128, 128, 0.7)';
            
            const ratio = (value - min) / range;
            
            // Green (low) to Red (high) for most metrics
            // For settlement, reverse (red = bad, green = good)
            if (metric === 'St') {
                // Settlement: lower is better (green), higher is worse (red)
                const r = Math.round(255 * ratio);
                const g = Math.round(255 * (1 - ratio));
                return `rgba(${r}, ${g}, 0, 0.7)`;
            } else if (metric === 'costIndex') {
                // Cost index: lower is better (green), higher is worse (red)
                const r = Math.round(255 * ratio);
                const g = Math.round(255 * (1 - ratio));
                return `rgba(${r}, ${g}, 0, 0.7)`;
            } else {
                // Qa, Ha: higher is better (green), lower is worse (red)
                const r = Math.round(255 * (1 - ratio));
                const g = Math.round(255 * ratio);
                return `rgba(${r}, ${g}, 0, 0.7)`;
            }
        }

        function formatParamValue(paramType, value) {
            switch(paramType) {
                case 'diameter': return `Ø${(value * 1000).toFixed(0)}`;
                case 'pileType': return value === 'steel' ? '강관' : 'PHC';
                case 'penetration': return `${value.toFixed(1)}m`;
                case 'endBearingCoeff': return `${value.toFixed(0)}`;
                default: return value.toString();
            }
        }

        function getParamLabel(paramType) {
            switch(paramType) {
                case 'diameter': return '말뚝 직경';
                case 'pileType': return '말뚝 종류';
                case 'penetration': return '근입깊이 (m)';
                case 'endBearingCoeff': return '선단지지력 계수 (kN/m²)';
                default: return paramType;
            }
        }

        function getMetricLabel(metric) {
            switch(metric) {
                case 'Qa': return '허용지지력';
                case 'Ha': return '수평지지력';
                case 'St': return '침하량';
                case 'costIndex': return '비용지수';
                default: return metric;
            }
        }

        function formatMetricValue(metric, value) {
            switch(metric) {
                case 'Qa': return `${value.toFixed(0)} kN`;
                case 'Ha': return `${value.toFixed(0)} kN`;
                case 'St': return `${value.toFixed(1)} mm`;
                case 'costIndex': return value.toFixed(0);
                default: return value.toFixed(2);
            }
        }

        function updateSensitivityComparisonTable(results, param1, param2, param1Values, param2Values, metrics) {
            const tbody = document.getElementById('sensitivityComparisonTableBody');
            if (!tbody) return;
            
            // Find base case (current design)
            const basePile = getCurrentPile();
            const baseDiameter = basePile.diameter;
            const basePileType = basePile.type || 'phc';
            const basePenetration = 1.0;
            const baseSafetyFactor = parseFloat(document.getElementById('sfVertical').value) || 3.0;
            const baseEndBearingCoeff = parseFloat(document.getElementById('endBearingCoefficient').value) || 300;
            
            // Helper function to compare values (handles both numeric and string)
            const compareValue = (resultValue, baseValue, paramType) => {
                if (paramType === 'pileType') {
                    return resultValue === baseValue;
                }
                return Math.abs(parseFloat(resultValue) - parseFloat(baseValue)) < 0.01;
            };
            
            const baseResult = results.find(r => {
                const p1Match = compareValue(r.param1Value,
                    param1 === 'diameter' ? baseDiameter :
                    param1 === 'pileType' ? basePileType :
                    param1 === 'penetration' ? basePenetration : baseEndBearingCoeff, param1);
                const p2Match = compareValue(r.param2Value,
                    param2 === 'diameter' ? baseDiameter :
                    param2 === 'pileType' ? basePileType :
                    param2 === 'penetration' ? basePenetration : baseEndBearingCoeff, param2);
                return p1Match && p2Match;
            }) || results[0];
            
            // Find top 3 alternatives
            const alternatives = results
                .filter(r => r !== baseResult)
                .sort((a, b) => b.Qa - a.Qa)
                .slice(0, 3);
            
            // Get parameter values for each case
            const getParamValue = (result, param) => {
                if (param === param1) {
                    return formatParamValue(param, result.param1Value);
                } else if (param === param2) {
                    return formatParamValue(param, result.param2Value);
                }
                // Get from base if not in analysis
                if (param === 'diameter') return formatParamValue('diameter', baseDiameter);
                if (param === 'pileType') return formatParamValue('pileType', basePileType);
                if (param === 'penetration') return formatParamValue('penetration', basePenetration);
                if (param === 'endBearingCoeff') return formatParamValue('endBearingCoeff', baseEndBearingCoeff);
                return '-';
            };
            
            const rows = [
                {
                    label: '설계 조건',
                    base: `${getParamLabel(param1)}: ${getParamValue(baseResult, param1)}<br>${getParamLabel(param2)}: ${getParamValue(baseResult, param2)}`,
                    alts: alternatives.map(a => `${getParamLabel(param1)}: ${getParamValue(a, param1)}<br>${getParamLabel(param2)}: ${getParamValue(a, param2)}`)
                },
                { label: '허용지지력', base: `${baseResult.Qa.toFixed(0)} kN`, alts: alternatives.map(a => `${a.Qa.toFixed(0)} kN`) },
                { label: '침하량', base: `${baseResult.St.toFixed(1)} mm`, alts: alternatives.map(a => `${a.St.toFixed(1)} mm`) },
                ...(metrics.horizontal ? [{ label: '수평지지력', base: `${baseResult.Ha.toFixed(0)} kN`, alts: alternatives.map(a => `${a.Ha.toFixed(0)} kN`) }] : []),
                { 
                    label: '비용지수<br><span style="font-size: 0.8rem; color: var(--text-secondary);">(현행=100)</span>', 
                    base: baseResult.costIndex.toFixed(0), 
                    alts: alternatives.map(a => {
                        const diff = a.costIndex - baseResult.costIndex;
                        const sign = diff > 0 ? '+' : '';
                        return `${a.costIndex.toFixed(0)} <span style="font-size: 0.85rem; color: ${diff < 0 ? 'var(--status-pass)' : diff > 0 ? 'var(--status-fail)' : 'var(--text-secondary)'};">(${sign}${diff.toFixed(0)})</span>`;
                    })
                }
            ];
            
            tbody.innerHTML = rows.map(row => `
                <tr>
                    <td style="font-weight: 600;">${row.label}</td>
                    <td>${row.base}</td>
                    ${row.alts.map(alt => `<td>${alt}</td>`).join('')}
                </tr>
            `).join('');
        }

        function updateSensitivityDetailTable(results, param1, param2, param1Values, param2Values, metrics) {
            const thead = document.getElementById('sensitivityDetailTableHead');
            const tbody = document.getElementById('sensitivityDetailTableBody');
            if (!thead || !tbody) return;
            
            // Create header
            let headerHTML = `<tr><th>${getParamLabel(param2)}</th>`;
            param1Values.forEach(val => {
                headerHTML += `<th>${formatParamValue(param1, val)}</th>`;
            });
            headerHTML += `</tr>`;
            thead.innerHTML = headerHTML;
            
            // Create body
            let bodyHTML = '';
            for (let j = 0; j < param2Values.length; j++) {
                bodyHTML += `<tr><td style="font-weight: 600;">${formatParamValue(param2, param2Values[j])}</td>`;
                for (let i = 0; i < param1Values.length; i++) {
                    const result = results.find(r => r.param1Index === i && r.param2Index === j);
                    if (result) {
                        let cellContent = '';
                        if (metrics.allowable) cellContent += `지지력: ${result.Qa.toFixed(0)}<br>`;
                        if (metrics.horizontal) cellContent += `수평: ${result.Ha.toFixed(0)}<br>`;
                        if (metrics.settlement) cellContent += `침하: ${(result.St || 0).toFixed(1)}<br>`;
                        if (metrics.cost) cellContent += `비용: ${result.costIndex.toFixed(0)}`;
                        bodyHTML += `<td style="font-size: 0.9rem;">${cellContent}</td>`;
                    } else {
                        bodyHTML += `<td>-</td>`;
                    }
                }
                bodyHTML += `</tr>`;
            }
            tbody.innerHTML = bodyHTML;
        }

        function resetSensitivityAnalysis() {
            document.getElementById('sensitivityResults').style.display = 'none';
            if (sensitivityChart) {
                sensitivityChart.destroy();
                sensitivityChart = null;
            }
            updateSensitivityRangeControls();
        }

        // ============================================================
        // 입력 검토 탭 관련 함수들
        // ============================================================

        // 전역 설계 파라미터 저장 객체
        let globalDesignParameters = {
            soilParams: {},  // 지층별 토질정수
            formulaCoeffs: {}, // 공식 계수
            estimationMethods: {} // 추정식 선택
        };

        // 지층별 통계 분석 결과
        let soilLayerStatistics = {};

        // 토질정수 추천 근거 데이터베이스
        const SOIL_PARAM_RATIONALE = {
            cu: {
                title: "비배수전단강도 (cu) 추정 근거",
                methods: {
                    terzaghi: {
                        formula: "cu = 6.25 × N (kPa)",
                        reference: "Terzaghi & Peck (1967)",
                        applicability: "정규압밀 점토",
                        note: "가장 보편적으로 사용되는 경험식"
                    },
                    stroud: {
                        formula: "cu = 4.4 × N (kPa)",
                        reference: "Stroud (1974)",
                        applicability: "과압밀 점토",
                        note: "영국 점토에서 유도, 보수적 추정"
                    },
                    hara: {
                        formula: "cu = 29 × N^0.72 (kPa)",
                        reference: "Hara et al. (1974)",
                        applicability: "일본 점토",
                        note: "비선형 관계, 높은 N값에서 보수적"
                    }
                },
                typical_ranges: {
                    "연약점토": "10-25 kPa (N=2-4)",
                    "중간점토": "25-50 kPa (N=4-8)",
                    "경질점토": "50-100 kPa (N=8-16)",
                    "매우 경질": "100-200 kPa (N=16-32)"
                }
            },
            phi: {
                title: "내부마찰각 (φ) 추정 근거",
                methods: {
                    dunham: {
                        formula: "φ = √(12N) + 15 (°)",
                        reference: "Dunham (1954)",
                        applicability: "모래질 흙",
                        note: "미국에서 개발, 널리 사용"
                    },
                    peck: {
                        formula: "φ = 28 + 0.4N (°), max 40°",
                        reference: "Peck et al. (1953)",
                        applicability: "사질토",
                        note: "간편식, 상한 40° 제한"
                    },
                    jra: {
                        formula: "φ = √(20N) + 15 (°)",
                        reference: "일본도로협회 (1996)",
                        applicability: "사질토 일반",
                        note: "일본 기준, Dunham식보다 높은 값"
                    }
                },
                typical_ranges: {
                    "느슨한 모래": "28-30° (N<10)",
                    "중간 모래": "30-35° (N=10-30)",
                    "조밀한 모래": "35-40° (N=30-50)",
                    "매우 조밀": "40-45° (N>50)"
                }
            },
            gamma: {
                title: "단위중량 (γ) 추정 근거",
                description: "지층 종류와 상대밀도/점조도에 따른 경험적 범위",
                typical_ranges: {
                    "유기질토": "12-16 kN/m³",
                    "연약점토": "15-17 kN/m³",
                    "보통점토": "17-19 kN/m³",
                    "느슨한 모래": "16-18 kN/m³",
                    "조밀한 모래": "18-20 kN/m³",
                    "풍화토": "18-20 kN/m³",
                    "풍화암": "20-23 kN/m³",
                    "연암": "22-25 kN/m³"
                },
                note: "지하수위 아래에서는 수중단위중량(γ' = γsat - 10) 적용"
            },
            E: {
                title: "탄성계수 (E) 추정 근거",
                methods: {
                    clay: {
                        formula: "E = 300-500 × cu (kPa)",
                        reference: "Duncan & Buchignani (1976)",
                        applicability: "점성토",
                        note: "OCR 및 소성지수에 따라 보정"
                    },
                    sand: {
                        formula: "E = 500-1500 × N^0.5 (kPa)",
                        reference: "Bowles (1996)",
                        applicability: "사질토",
                        note: "구속압에 따라 변동"
                    },
                    simple: {
                        formula: "E = 2.5 × N (MPa)",
                        reference: "실무 간편식",
                        applicability: "일반 토사",
                        note: "개략적 추정용"
                    }
                },
                typical_ranges: {
                    "연약점토": "2-10 MPa",
                    "보통점토": "10-30 MPa",
                    "느슨한 모래": "10-30 MPa",
                    "조밀한 모래": "30-80 MPa",
                    "풍화토": "30-100 MPa",
                    "풍화암": "100-500 MPa",
                    "연암": "500-5000 MPa"
                }
            },
            skinFriction: {
                title: "주면마찰력 계수 근거",
                description: "구조물 기초 설계 기준 기준",
                methods: {
                    clay: {
                        formula: "fs = α × cu",
                        alpha_values: "α = 1.0 (cu<25), 0.9 (25-50), 0.7 (50-100), 0.5 (>100)",
                        reference: "Tomlinson α법",
                        note: "점성토에서 부착력 기반"
                    },
                    sand: {
                        formula: "fs = β × N (kN/m²)",
                        beta_values: "β = 2.0 (KDS 기준)",
                        reference: "구조물 기초 설계 기준",
                        note: "사질토에서 마찰력 기반"
                    }
                },
                limits: {
                    clay: "fs,max = 150 kN/m²",
                    sand: "fs,max = 200 kN/m²"
                }
            },
            endBearing: {
                title: "선단지지력 계수 근거",
                description: "구조물 기초 설계 기준 기준",
                formula: "qp = α × N (kN/m²)",
                typical_values: {
                    "모래/자갈": "α = 250-300",
                    "풍화암": "α = 300-400",
                    "연암 이상": "α = 400-500"
                },
                limit: "qp,max = 15,000 kN/m² (KDS 기준)",
                note: "지지층 N값과 근입깊이에 따라 결정"
            },
            construction: {
                title: "시공방법 보정계수 근거",
                description: "시공 중 지반 교란 정도 반영",
                values: {
                    "타입 말뚝": "1.0 (기준값)",
                    "매입 말뚝": "0.7 (굴착에 의한 이완)",
                    "현장타설": "0.6-0.8 (시공조건에 따라)"
                },
                reference: "구조물 기초 설계 기준, 도로교 설계기준"
            },
            safety: {
                title: "안전율 적용 근거",
                description: "구조물 기초 설계 기준 기준",
                values: {
                    "압축 (FSc)": "3.0 (정적 재하시험 미실시 시)",
                    "인발 (FSp)": "3.0-4.0",
                    "수평 (FSh)": "1.5-2.5"
                },
                note: "재하시험 실시 시 안전율 감소 가능 (2.0-2.5)"
            }
        };

        // ============================================================
        // 토질 분류 엔진 (구조물기초설계기준해설 2018 기반)
        // ============================================================

        const SOIL_CLASSIFICATION_ENGINE = {
            // USCS 코드 매핑
            uscs_mapping: {
                sandy: ["GW", "GP", "GM", "GC", "SW", "SP", "SM", "SC"],
                cohesive: ["ML", "MH", "CL", "CH", "CL-ML", "OL", "OH", "Pt"],
                rock: ["WR", "SR", "HR", "BR"]
            },

            // 확정 키워드 (HIGH confidence)
            definite_keywords: {
                sandy: {
                    exact: ["사질토", "사층", "모래층", "자갈층", "역층", "사력층", "조립토"],
                    contains: ["사질", "모래", "자갈", "역질", "사력", "조립질"]
                },
                cohesive: {
                    exact: ["점토", "점토층", "점성토", "실트", "실트층", "연약층", "연약점토", "이탄층"],
                    contains: ["점토", "점성", "실트", "연약", "이탄", "유기질토", "니질"]
                },
                rock: {
                    exact: ["풍화암", "연암", "경암", "기반암", "암반"],
                    contains: ["풍화암", "연암", "경암", "기반암"]
                }
            },

            // 추정 키워드 (MEDIUM confidence)
            probable_keywords: {
                sandy: [
                    { name: "풍화토", aliases: ["풍화잔류토", "잔류토", "마사토", "마사"], probability: 0.85 },
                    { name: "붕적층", aliases: ["붕적토", "애추"], probability: 0.75 },
                    { name: "선상지퇴적층", aliases: ["선상지"], probability: 0.80 }
                ],
                cohesive: [
                    { name: "해성퇴적층", aliases: ["해성점토", "해안퇴적층", "해성층"], probability: 0.90 },
                    { name: "호성퇴적층", aliases: ["호성층", "호소퇴적층"], probability: 0.85 },
                    { name: "배후습지퇴적층", aliases: ["배후습지", "습지퇴적층"], probability: 0.90 }
                ]
            },

            // 수동 확인 필요 지층 (MANUAL_REQUIRED)
            indeterminate_layers: [
                { name: "성토층", aliases: ["매립층", "인공매립층", "성토", "매립토", "복토층"], prompt: "성토재료의 토질 특성을 선택하세요" },
                { name: "퇴적층", aliases: ["퇴적토", "미고결퇴적층"], prompt: "퇴적층의 세부 토질을 선택하세요" },
                { name: "충적층", aliases: ["충적토", "하천퇴적층", "범람원퇴적층"], prompt: "충적층의 세부 토질을 선택하세요" },
                { name: "전답토", aliases: ["경작토", "표토", "객토", "농경지토양"], prompt: "표토층의 토질 특성을 선택하세요" },
                { name: "구릉지퇴적층", aliases: ["구릉지퇴적토"], prompt: "구릉지 퇴적층의 토질을 선택하세요" },
                { name: "토사혼합층", aliases: ["혼합토", "혼성토"], prompt: "우세한 토질 특성을 선택하세요" },
                { name: "호박돌혼합층", aliases: ["전석혼합층", "호박돌층"], prompt: "호박돌 사이 충전재의 토질을 선택하세요" },
                { name: "토층", aliases: ["토사층", "토사"], prompt: "토층의 세부 토질을 선택하세요" }
            ]
        };

        // USCS 코드 추출 함수 (다중 코드 지원)
        function extractUSCSCode(soilName) {
            if (!soilName) return null;

            // 유효한 USCS 코드 목록
            const validUSCSCodes = [
                // 조립토 (Coarse-grained soils)
                'GW', 'GP', 'GM', 'GC', 'GW-GM', 'GW-GC', 'GP-GM', 'GP-GC',
                'SW', 'SP', 'SM', 'SC', 'SW-SM', 'SW-SC', 'SP-SM', 'SP-SC',
                // 세립토 (Fine-grained soils)
                'ML', 'CL', 'OL', 'MH', 'CH', 'OH', 'CL-ML', 'Pt',
                // 암반 코드
                'WR', 'SR', 'HR', 'BR'
            ];

            // 다중 USCS 코드 추출 (예: "전답토 CL, SM" → ["CL", "SM"])
            const allCodes = [];

            // 쉼표, 슬래시, 공백으로 구분된 다중 코드 패턴
            // 예: "CL, SM", "CL/SM", "CL SM"
            const multiCodePattern = /([A-Z]{2}(?:-[A-Z]{2})?)[,\/\s]+([A-Z]{2}(?:-[A-Z]{2})?)/g;
            let multiMatch;
            while ((multiMatch = multiCodePattern.exec(soilName)) !== null) {
                if (validUSCSCodes.includes(multiMatch[1])) allCodes.push(multiMatch[1]);
                if (validUSCSCodes.includes(multiMatch[2])) allCodes.push(multiMatch[2]);
            }

            if (allCodes.length > 0) {
                // 다중 코드가 있으면 배열 반환
                return allCodes.length === 1 ? allCodes[0] : allCodes;
            }

            // 다양한 패턴으로 단일 USCS 코드 추출
            const patterns = [
                /\(([A-Z]{2}(?:-[A-Z]{2})?)\)/,  // 괄호 형식: 풍화토(SM), 점토(CL-ML)
                /\[([A-Z]{2}(?:-[A-Z]{2})?)\]/,  // 대괄호 형식: 풍화토[SM]
                /[-_]([A-Z]{2}(?:-[A-Z]{2})?)$/,  // 접미사 형식: 풍화토-SM
                /^([A-Z]{2}(?:-[A-Z]{2})?)[-_:]/, // 접두사 형식: SM-풍화토
                /\s+([A-Z]{2}(?:-[A-Z]{2})?)$/,   // 공백 후 접미사: 퇴적층 SM, 전답토 CL
                /\s+([A-Z]{2}(?:-[A-Z]{2})?)\s*$/ // 공백 구분: 붕적층 SP
            ];

            for (const pattern of patterns) {
                const match = soilName.match(pattern);
                if (match) {
                    const code = match[1].toUpperCase();
                    // 유효한 USCS 코드인지 확인
                    if (validUSCSCodes.includes(code) || validUSCSCodes.includes(code.split('-')[0])) {
                        return code;
                    }
                }
            }

            // 지층명 끝에 공백으로 구분된 대문자 2-5글자가 있으면 USCS 코드로 간주
            const endMatch = soilName.match(/\s+([A-Z]{2,5})$/);
            if (endMatch) {
                const code = endMatch[1];
                if (validUSCSCodes.includes(code) || validUSCSCodes.includes(code.split('-')[0])) {
                    return code;
                }
            }

            return null;
        }

        // USCS 코드로 토질 분류 (다중 코드 지원)
        function classifyByUSCS(uscsCode) {
            if (!uscsCode) return null;

            // 다중 코드 처리 (예: ["CL", "SM"] → mixed)
            if (Array.isArray(uscsCode)) {
                const behaviors = uscsCode.map(code => {
                    const primaryCode = code.split('-')[0];
                    if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.sandy.includes(primaryCode)) return 'sandy';
                    if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.cohesive.includes(primaryCode)) return 'cohesive';
                    if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.rock.includes(primaryCode)) return 'rock';
                    return null;
                }).filter(b => b !== null);

                // 혼합 토질 판정
                const hasSandy = behaviors.includes('sandy');
                const hasCohesive = behaviors.includes('cohesive');

                if (hasSandy && hasCohesive) {
                    // 점성토 + 사질토 혼합 → mixed
                    return {
                        behavior: 'mixed',
                        confidence: 'HIGH',
                        method: 'USCS_CODE_MIXED',
                        extracted_codes: uscsCode,
                        note: `혼합 토질 (${uscsCode.join(', ')}): 점성토+사질토 특성 공존`
                    };
                } else if (hasSandy) {
                    return { behavior: 'sandy', confidence: 'HIGH', method: 'USCS_CODE_EXACT', extracted_codes: uscsCode };
                } else if (hasCohesive) {
                    return { behavior: 'cohesive', confidence: 'HIGH', method: 'USCS_CODE_EXACT', extracted_codes: uscsCode };
                }
            }

            // 단일 코드 처리 (예: CL-ML → 첫 번째 코드 기준)
            const primaryCode = (typeof uscsCode === 'string') ? uscsCode.split('-')[0] : uscsCode;

            if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.sandy.includes(primaryCode)) {
                return { behavior: 'sandy', confidence: 'HIGH', method: 'USCS_CODE_EXACT' };
            }
            if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.cohesive.includes(primaryCode)) {
                return { behavior: 'cohesive', confidence: 'HIGH', method: 'USCS_CODE_EXACT' };
            }
            if (SOIL_CLASSIFICATION_ENGINE.uscs_mapping.rock.includes(primaryCode)) {
                return { behavior: 'rock', confidence: 'HIGH', method: 'USCS_CODE_EXACT' };
            }
            return null;
        }

        // 확정 키워드로 토질 분류
        function classifyByDefiniteKeyword(soilName) {
            const name = soilName.toLowerCase();

            // 암반 먼저 체크 (풍화암 vs 풍화토 구분)
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.rock.exact) {
                if (soilName === keyword) {
                    return { behavior: 'rock', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.rock.contains) {
                if (soilName.includes(keyword)) {
                    return { behavior: 'rock', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }

            // 점성토 체크
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.cohesive.exact) {
                if (soilName === keyword) {
                    return { behavior: 'cohesive', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.cohesive.contains) {
                if (soilName.includes(keyword)) {
                    return { behavior: 'cohesive', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }

            // 사질토 체크
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.sandy.exact) {
                if (soilName === keyword) {
                    return { behavior: 'sandy', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }
            for (const keyword of SOIL_CLASSIFICATION_ENGINE.definite_keywords.sandy.contains) {
                if (soilName.includes(keyword)) {
                    return { behavior: 'sandy', confidence: 'HIGH', method: 'KEYWORD_DEFINITE' };
                }
            }

            return null;
        }

        // 추정 키워드로 토질 분류
        function classifyByProbableKeyword(soilName) {
            // 사질토 추정
            for (const layer of SOIL_CLASSIFICATION_ENGINE.probable_keywords.sandy) {
                if (soilName.includes(layer.name) || layer.aliases.some(a => soilName.includes(a))) {
                    return {
                        behavior: 'sandy',
                        confidence: 'MEDIUM',
                        confidence_score: layer.probability,
                        method: 'KEYWORD_PROBABLE',
                        note: `${layer.name}은 대부분 사질토`
                    };
                }
            }

            // 점성토 추정
            for (const layer of SOIL_CLASSIFICATION_ENGINE.probable_keywords.cohesive) {
                if (soilName.includes(layer.name) || layer.aliases.some(a => soilName.includes(a))) {
                    return {
                        behavior: 'cohesive',
                        confidence: 'MEDIUM',
                        confidence_score: layer.probability,
                        method: 'KEYWORD_PROBABLE',
                        note: `${layer.name}은 대부분 점성토`
                    };
                }
            }

            return null;
        }

        // 수동 확인 필요 지층 체크
        function checkIndeterminateLayer(soilName) {
            for (const layer of SOIL_CLASSIFICATION_ENGINE.indeterminate_layers) {
                if (soilName === layer.name || layer.aliases.some(a => soilName.includes(a) || soilName === a)) {
                    return {
                        behavior: 'unknown',
                        confidence: 'MANUAL_REQUIRED',
                        method: 'INDETERMINATE',
                        manual_flag: true,
                        ui_prompt: layer.prompt
                    };
                }
            }
            return null;
        }

        // 메인 토질 분류 함수
        function classifySoilBehavior(soilName) {
            if (!soilName) {
                return {
                    behavior: 'unknown',
                    confidence: 'MANUAL_REQUIRED',
                    method: 'NO_INPUT',
                    manual_flag: true,
                    ui_prompt: '지층명을 입력하세요'
                };
            }

            // Stage 1: USCS 코드 파싱
            const uscsCode = extractUSCSCode(soilName);
            if (uscsCode) {
                const uscsResult = classifyByUSCS(uscsCode);
                if (uscsResult) {
                    uscsResult.extracted_uscs_code = uscsCode;
                    uscsResult.manual_flag = false;
                    return uscsResult;
                }
            }

            // Stage 2a: 확정 키워드
            const definiteResult = classifyByDefiniteKeyword(soilName);
            if (definiteResult) {
                definiteResult.manual_flag = false;
                return definiteResult;
            }

            // Stage 2b: 추정 키워드
            const probableResult = classifyByProbableKeyword(soilName);
            if (probableResult) {
                probableResult.manual_flag = false;
                return probableResult;
            }

            // Stage 3: 수동 확인 필요 체크
            const indeterminateResult = checkIndeterminateLayer(soilName);
            if (indeterminateResult) {
                return indeterminateResult;
            }

            // Stage 4: 기본값 (알 수 없음)
            return {
                behavior: 'unknown',
                confidence: 'MANUAL_REQUIRED',
                method: 'DEFAULT_UNKNOWN',
                manual_flag: true,
                ui_prompt: '지층의 토질 특성을 선택하세요'
            };
        }

        // 기존 classifySoilType 함수 (하위 호환성)
        function classifySoilType(soilName) {
            const result = classifySoilBehavior(soilName);
            // 기존 코드와 호환을 위해 behavior를 변환
            switch (result.behavior) {
                case 'sandy': return 'sand';
                case 'cohesive': return 'clay';
                case 'mixed': return 'mixed';  // 혼합토 추가
                case 'rock': return 'rock';
                default: return 'unknown';
            }
        }

        // JSON 업로드 시 지층별 통계 분석
        function analyzeBoreholeStatistics() {
            if (!boreholeData || boreholeData.length === 0) return;

            soilLayerStatistics = {};

            // 모든 시추공에서 지층 데이터 수집
            boreholeData.forEach(borehole => {
                if (!borehole.soil_data) return;

                borehole.soil_data.forEach(layer => {
                    if (!layer || !layer.soil_name) return;

                    const layerName = layer.soil_name;

                    if (!soilLayerStatistics[layerName]) {
                        soilLayerStatistics[layerName] = {
                            name: layerName,
                            boreholes: [],
                            nValues: [],
                            nValueDetails: [], // 상세 정보: {borehole, depth, hits, n, thickness}
                            depths: [],
                            thicknesses: []
                        };
                    }

                    // 시추공 추가
                    if (!soilLayerStatistics[layerName].boreholes.includes(borehole.hole_no)) {
                        soilLayerStatistics[layerName].boreholes.push(borehole.hole_no);
                    }

                    // 깊이 정보 먼저 파싱
                    const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                    const depthFrom = depthMatch ? parseFloat(depthMatch[1]) : 0;
                    const depthTo = depthMatch ? parseFloat(depthMatch[2]) : 0;
                    const layerThickness = depthTo - depthFrom;

                    // N값 수집 (samples 배열에서 Hits 파싱)
                    if (layer.samples && Array.isArray(layer.samples)) {
                        layer.samples.forEach(sample => {
                            // Hits 형식: "6/30", "15/30", "50/10" 등
                            if (sample.Hits) {
                                const hitsMatch = sample.Hits.match(/(\d+)\/(\d+)/);
                                if (hitsMatch) {
                                    const blows = parseInt(hitsMatch[1]);
                                    const penetration = parseInt(hitsMatch[2]);
                                    // N값 환산 (30cm 기준)
                                    let n;
                                    if (penetration === 30) {
                                        n = blows;
                                    } else if (penetration > 0) {
                                        // 환산: N = blows * 30 / penetration
                                        n = Math.round(blows * 30 / penetration);
                                    } else {
                                        n = blows;
                                    }
                                    // 상한값 적용 (N≥50 → 50)
                                    n = Math.min(n, 50);
                                    if (!isNaN(n) && n >= 0) {
                                        soilLayerStatistics[layerName].nValues.push(n);
                                        // 상세 정보 저장 (가중치 평균 계산용)
                                        soilLayerStatistics[layerName].nValueDetails.push({
                                            borehole: borehole.hole_no,
                                            depth: sample.Depth || `${depthFrom}~${depthTo}`,
                                            hits: sample.Hits,
                                            n: n,
                                            thickness: layerThickness > 0 ? layerThickness : 1, // 두께 정보
                                            layerDepthFrom: depthFrom,
                                            layerDepthTo: depthTo
                                        });
                                    }
                                }
                            }
                        });
                    }
                    // 기존 spt_results 형식도 지원
                    if (layer.spt_results && Array.isArray(layer.spt_results)) {
                        layer.spt_results.forEach(spt => {
                            const n = parseInt(spt.n_value);
                            if (!isNaN(n) && n >= 0) {
                                soilLayerStatistics[layerName].nValues.push(n);
                                soilLayerStatistics[layerName].nValueDetails.push({
                                    borehole: borehole.hole_no,
                                    depth: spt.depth || `${depthFrom}~${depthTo}`,
                                    hits: `${n}/30`,
                                    n: n,
                                    thickness: layerThickness > 0 ? layerThickness : 1,
                                    layerDepthFrom: depthFrom,
                                    layerDepthTo: depthTo
                                });
                            }
                        });
                    }

                    // 깊이 정보 수집
                    if (depthMatch) {
                        const depthTo = parseFloat(depthMatch[2]);
                        soilLayerStatistics[layerName].depths.push({ from: depthFrom, to: depthTo });
                        soilLayerStatistics[layerName].thicknesses.push(depthTo - depthFrom);
                    }
                });
            });

            // 통계 계산
            Object.keys(soilLayerStatistics).forEach(layerName => {
                const stats = soilLayerStatistics[layerName];
                const nValues = stats.nValues;
                const details = stats.nValueDetails;

                if (nValues.length > 0) {
                    stats.nMin = Math.min(...nValues);
                    stats.nMax = Math.max(...nValues);
                    // 단순 평균
                    stats.nAvgSimple = nValues.reduce((a, b) => a + b, 0) / nValues.length;

                    // 가중치 평균 계산 (두께 기반)
                    if (details.length > 0) {
                        let weightedSum = 0;
                        let totalWeight = 0;
                        details.forEach(d => {
                            weightedSum += d.n * d.thickness;
                            totalWeight += d.thickness;
                        });
                        stats.nAvgWeighted = totalWeight > 0 ? weightedSum / totalWeight : stats.nAvgSimple;
                    } else {
                        stats.nAvgWeighted = stats.nAvgSimple;
                    }

                    // 기본 nAvg는 가중치 평균 사용
                    stats.nAvg = stats.nAvgWeighted;

                    stats.nStd = Math.sqrt(
                        nValues.reduce((sum, n) => sum + Math.pow(n - stats.nAvgSimple, 2), 0) / nValues.length
                    );
                    stats.nCount = nValues.length;
                } else {
                    stats.nMin = 0;
                    stats.nMax = 0;
                    stats.nAvg = 0;
                    stats.nAvgSimple = 0;
                    stats.nAvgWeighted = 0;
                    stats.nStd = 0;
                    stats.nCount = 0;
                }

                // 토질 분류 (상세 결과 포함)
                const classificationResult = classifySoilBehavior(layerName);
                stats.classification = classificationResult;
                stats.soilType = classifySoilType(layerName); // 하위 호환성
                stats.behavior = classificationResult.behavior; // sandy, cohesive, rock, unknown

                // 추천 토질정수 계산
                stats.recommended = calculateRecommendedParams(stats);
            });

            console.log('[analyzeBoreholeStatistics] 지층별 통계:', soilLayerStatistics);
        }

        // 추천 토질정수 계산
        function calculateRecommendedParams(stats) {
            const N = stats.nAvg || 15;
            const soilType = stats.soilType;
            const behavior = stats.behavior || (stats.classification ? stats.classification.behavior : null);

            // cu 추정식 선택 - 점성토/혼합토/사질토 분리 (behavior 기반)
            let cu = 0;
            let cuRationale = '';

            // 혼합토 (CL+SM 등): cu와 φ 모두 계산
            if (behavior === 'mixed' || soilType === 'mixed') {
                // 혼합토용 cu 추정식 (점성토 성분 반영)
                const cuMethodClay = document.querySelector('input[name="cuEstimationClay"]:checked')?.value || 'terzaghi';
                switch (cuMethodClay) {
                    case 'terzaghi':
                        cu = 6.25 * N * 0.7;  // 혼합토는 70% 적용
                        cuRationale = `Terzaghi (혼합토): cu = 6.25 × ${N.toFixed(0)} × 0.7 = ${cu.toFixed(0)} kPa`;
                        break;
                    case 'stroud':
                        cu = 4.4 * N * 0.7;
                        cuRationale = `Stroud (혼합토): cu = 4.4 × ${N.toFixed(0)} × 0.7 = ${cu.toFixed(0)} kPa`;
                        break;
                    default:
                        cu = 6.25 * N * 0.7;
                        cuRationale = `Terzaghi (혼합토): cu = 6.25 × ${N.toFixed(0)} × 0.7 = ${cu.toFixed(0)} kPa`;
                }
            } else if (behavior === 'cohesive' || soilType === 'clay') {
                // 점성토용 cu 추정식
                const cuMethodClay = document.querySelector('input[name="cuEstimationClay"]:checked')?.value || 'terzaghi';
                switch (cuMethodClay) {
                    case 'terzaghi':
                        cu = 6.25 * N;
                        cuRationale = `Terzaghi & Peck (점성토): cu = 6.25 × ${N.toFixed(0)} = ${cu.toFixed(0)} kPa`;
                        break;
                    case 'stroud':
                        cu = 4.4 * N;
                        cuRationale = `Stroud (점성토): cu = 4.4 × ${N.toFixed(0)} = ${cu.toFixed(0)} kPa`;
                        break;
                    case 'custom':
                        const coeffClay = parseFloat(document.getElementById('cuCoeffCite')?.value || 6.25);
                        cu = coeffClay * N;
                        cuRationale = `사용자 정의 (점성토): cu = ${coeffClay} × ${N.toFixed(0)} = ${cu.toFixed(0)} kPa`;
                        break;
                }
            } else if (behavior === 'sandy' || soilType === 'sand') {
                // 사질토는 cu = 0 (비배수전단강도 없음)
                cu = 0;
                cuRationale = `사질토: cu = 0 (배수조건, 마찰력 지배)`;
            } else if (behavior === 'unknown') {
                // 알 수 없는 경우 보수적으로 점성토 계수 적용
                cu = 6.25 * N;
                cuRationale = `기본값 (미분류): cu = 6.25 × ${N.toFixed(0)} = ${cu.toFixed(0)} kPa (보수적 적용)`;
            }

            // φ 추정식 선택
            const phiMethod = document.querySelector('input[name="phiEstimation"]:checked')?.value || 'dunham';
            let phi = 30;
            let phiRationale = '';

            // 사질토, 혼합토, 암반은 φ 계산
            if (soilType === 'sand' || soilType === 'mixed' || soilType === 'rock') {
                switch (phiMethod) {
                    case 'dunham':
                        phi = Math.sqrt(12 * N) + 15;
                        phiRationale = `Dunham: φ = √(12×${N.toFixed(0)}) + 15 = ${phi.toFixed(0)}°`;
                        break;
                    case 'peck':
                        phi = Math.min(28 + 0.4 * N, 40);
                        phiRationale = `Peck: φ = 28 + 0.4×${N.toFixed(0)} = ${Math.min(28 + 0.4 * N, 40).toFixed(0)}° (max 40°)`;
                        break;
                    case 'jra':
                        phi = Math.sqrt(20 * N) + 15;
                        phiRationale = `일본도로협회: φ = √(20×${N.toFixed(0)}) + 15 = ${phi.toFixed(0)}°`;
                        break;
                    case 'custom_phi':
                        const base = parseFloat(document.getElementById('phiCustomBase')?.value || 28);
                        const coeff = parseFloat(document.getElementById('phiCustomCoeff')?.value || 0.4);
                        phi = Math.min(base + coeff * N, 45);
                        phiRationale = `사용자 정의: φ = ${base} + ${coeff}×${N.toFixed(0)} = ${phi.toFixed(0)}°`;
                        break;
                }
            } else if (soilType === 'clay') {
                // 점성토: 전응력 해석 시 φ=0이나, 유효응력 해석 시 φ' 존재
                // CL(저소성 점토)은 φ'=20~30°, CH(고소성 점토)는 φ'=15~25°
                // 보수적으로 N값 기반 경험식 적용 (점토의 유효 내부마찰각)
                if (N <= 2) {
                    phi = 18;
                    phiRationale = `점성토 (연약, N≤2): φ' = 18° (유효응력 기준)`;
                } else if (N <= 4) {
                    phi = 22;
                    phiRationale = `점성토 (연약~중간, N=2~4): φ' = 22° (유효응력 기준)`;
                } else if (N <= 8) {
                    phi = 25;
                    phiRationale = `점성토 (중간, N=4~8): φ' = 25° (유효응력 기준)`;
                } else if (N <= 15) {
                    phi = 28;
                    phiRationale = `점성토 (견고, N=8~15): φ' = 28° (유효응력 기준)`;
                } else {
                    phi = 30;
                    phiRationale = `점성토 (매우 견고, N>15): φ' = 30° (유효응력 기준)`;
                }
            }

            // γ 추정 (지층 종류별)
            let gamma = 18;
            let gammaRationale = '';

            if (soilType === 'clay') {
                if (N < 4) gamma = 16;
                else if (N < 8) gamma = 17;
                else if (N < 15) gamma = 18;
                else gamma = 19;
                gammaRationale = `점성토 (N=${N.toFixed(0)}): γ = ${gamma} kN/m³`;
            } else if (soilType === 'sand') {
                if (N < 10) gamma = 17;
                else if (N < 30) gamma = 18;
                else gamma = 19;
                gammaRationale = `사질토 (N=${N.toFixed(0)}): γ = ${gamma} kN/m³`;
            } else if (soilType === 'mixed') {
                // 혼합토: 점성토와 사질토의 중간값
                if (N < 5) gamma = 17;
                else if (N < 15) gamma = 18;
                else gamma = 19;
                gammaRationale = `혼합토 (N=${N.toFixed(0)}): γ = ${gamma} kN/m³`;
            } else if (soilType === 'rock') {
                if (stats.name.includes('풍화토')) {
                    gamma = 19;
                    gammaRationale = `풍화토: γ = ${gamma} kN/m³`;
                } else if (stats.name.includes('풍화암')) {
                    gamma = 21;
                    gammaRationale = `풍화암: γ = ${gamma} kN/m³`;
                } else {
                    gamma = 23;
                    gammaRationale = `연암 이상: γ = ${gamma} kN/m³`;
                }
            } else {
                gamma = 18;
                gammaRationale = `혼합토 (기본값): γ = ${gamma} kN/m³`;
            }

            // E 추정 (간편식)
            let E = 2.5 * N; // MPa
            let eRationale = `간편식: E = 2.5 × ${N.toFixed(0)} = ${E.toFixed(0)} MPa`;

            if (soilType === 'rock') {
                if (stats.name.includes('풍화토')) {
                    E = Math.max(3 * N, 50);
                } else if (stats.name.includes('풍화암')) {
                    E = Math.max(5 * N, 100);
                } else {
                    E = Math.max(10 * N, 300);
                }
                eRationale = `암반: E = ${E.toFixed(0)} MPa (N=${N.toFixed(0)} 기반)`;
            }

            return {
                cu: Math.round(cu),
                phi: Math.round(phi),
                gamma: gamma,
                E: Math.round(E),
                rationale: {
                    cu: cuRationale,
                    phi: phiRationale,
                    gamma: gammaRationale,
                    E: eRationale
                }
            };
        }

        // 입력 검토 탭 업데이트
        function updateInputReviewTab() {
            if (!boreholeData || boreholeData.length === 0) {
                document.getElementById('inputReviewPlaceholder').style.display = 'block';
                document.getElementById('inputReviewContent').style.display = 'none';
                return;
            }

            // 지층별 통계 분석
            analyzeBoreholeStatistics();

            // 플레이스홀더 숨기고 콘텐츠 표시
            document.getElementById('inputReviewPlaceholder').style.display = 'none';
            document.getElementById('inputReviewContent').style.display = 'block';

            // 지층별 토질정수 테이블 업데이트
            updateSoilParameterTable();

            // 공식 계수 및 설정 동기화 (사이드바 → 입력검토 탭)
            syncFormulaCoefficients();

            // 말뚝 타입에 따른 옵션 표시/숨김 설정
            onReviewPileTypeChange();

            // 말뚝 제원 정보 업데이트
            updateReviewPileSpecs();
        }

        // 지층별 토질정수 테이블 업데이트
        function updateSoilParameterTable() {
            const tbody = document.getElementById('soilParameterTableBody');
            if (!tbody) return;

            tbody.innerHTML = '';

            // 지층 순서 정렬 (평균 깊이 기준)
            const sortedLayers = Object.keys(soilLayerStatistics).sort((a, b) => {
                const aDepths = soilLayerStatistics[a].depths;
                const bDepths = soilLayerStatistics[b].depths;
                const aAvgDepth = aDepths.length > 0 ? aDepths.reduce((sum, d) => sum + d.from, 0) / aDepths.length : 0;
                const bAvgDepth = bDepths.length > 0 ? bDepths.reduce((sum, d) => sum + d.from, 0) / bDepths.length : 0;
                return aAvgDepth - bAvgDepth;
            });

            sortedLayers.forEach(layerName => {
                const stats = soilLayerStatistics[layerName];
                const rec = stats.recommended;
                const classification = stats.classification || {};

                // 토질 분류 표시 (behavior 기반) - 차분한 색상
                const behaviorDisplay = {
                    'sandy': { label: '사질토', color: '#5d4037', bgColor: '#fafafa', borderColor: '#bcaaa4' },
                    'cohesive': { label: '점성토', color: '#37474f', bgColor: '#fafafa', borderColor: '#90a4ae' },
                    'rock': { label: '암반', color: '#455a64', bgColor: '#f5f5f5', borderColor: '#78909c' },
                    'unknown': { label: '확인필요', color: '#b71c1c', bgColor: '#fff', borderColor: '#ef9a9a' }
                };

                const confidenceDisplay = {
                    'HIGH': { label: '높음' },
                    'MEDIUM': { label: '중간' },
                    'LOW': { label: '낮음' },
                    'MANUAL_REQUIRED': { label: '수동' }
                };

                const behavior = classification.behavior || 'unknown';
                const confidence = classification.confidence || 'MANUAL_REQUIRED';
                const manualFlag = classification.manual_flag || false;
                const displayInfo = behaviorDisplay[behavior] || behaviorDisplay['unknown'];
                const confInfo = confidenceDisplay[confidence] || confidenceDisplay['MANUAL_REQUIRED'];

                const row = document.createElement('tr');
                row.dataset.layerName = layerName;
                row.dataset.behavior = behavior;

                // N값 범위 클릭 가능하게 (상세 팝업용)
                const nRangeDisplay = stats.nCount > 0
                    ? `<span class="n-value-range" onclick="showNValueDetails('${layerName}')"
                         style="cursor: pointer; text-decoration: underline; color: var(--primary-steel);"
                         title="클릭하여 N값 상세 계산 보기">${stats.nMin}~${stats.nMax}</span>`
                    : '-';

                // 토질분류 셀 - 모든 경우에 드롭다운으로 표시 (사용자가 항상 수정 가능)
                // 추출된 USCS 코드가 있으면 표시
                const uscsCode = classification.extracted_uscs_code || '';
                const uscsDisplay = uscsCode ? ` (${uscsCode})` : '';

                // 암반인 경우 rock 옵션도 표시
                const rockOption = behavior === 'rock' || layerName.includes('암')
                    ? `<option value="rock" ${behavior === 'rock' ? 'selected' : ''}>암반</option>`
                    : '';

                const soilClassCell = `
                    <select class="soil-behavior-select" data-layer="${layerName}"
                            style="padding: 6px 8px; border: 1px solid ${displayInfo.borderColor}; border-radius: 4px; background: ${displayInfo.bgColor}; color: ${displayInfo.color}; font-size: 0.85rem; font-weight: 500; cursor: pointer; min-width: 85px;"
                            onchange="onManualSoilClassChange(this, '${layerName}')"
                            title="${manualFlag ? (classification.ui_prompt || '토질 특성을 선택하세요') : `자동분류: ${classification.method || '-'}${uscsDisplay}\n클릭하여 수정 가능`}">
                        ${manualFlag && behavior === 'unknown' ? '<option value="unknown">선택</option>' : ''}
                        <option value="sandy" ${behavior === 'sandy' ? 'selected' : ''}>사질토</option>
                        <option value="cohesive" ${behavior === 'cohesive' ? 'selected' : ''}>점성토</option>
                        ${rockOption}
                    </select>
                    ${uscsCode ? `<div style="font-size: 0.7rem; color: #888; margin-top: 2px;">${uscsCode}</div>` : ''}
                `;

                row.innerHTML = `
                    <td style="font-weight: 600; color: var(--primary-navy);">${layerName}</td>
                    <td style="font-size: 0.85rem;">${stats.boreholes.slice(0, 3).join(', ')}${stats.boreholes.length > 3 ? ` 외 ${stats.boreholes.length - 3}개` : ''}</td>
                    <td>${nRangeDisplay}</td>
                    <td>
                        ${stats.nCount > 0 ? `<strong>${stats.nAvg.toFixed(1)}</strong>` : '-'}
                        ${stats.nCount > 1 ? `<br><small style="color: var(--text-muted);">(σ=${stats.nStd.toFixed(1)})</small>` : ''}
                    </td>
                    <td>
                        <input type="number" class="soil-param-input" data-param="cu" value="${rec.cu}"
                               step="5" min="0" max="500" style="width: 80px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;"
                               title="${rec.rationale.cu}">
                    </td>
                    <td>
                        <input type="number" class="soil-param-input" data-param="phi" value="${rec.phi}"
                               step="1" min="0" max="45" style="width: 70px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;"
                               title="${rec.rationale.phi}">
                    </td>
                    <td>
                        <input type="number" class="soil-param-input" data-param="gamma" value="${rec.gamma}"
                               step="0.5" min="10" max="30" style="width: 70px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;"
                               title="${rec.rationale.gamma}">
                    </td>
                    <td>
                        <input type="number" class="soil-param-input" data-param="E" value="${rec.E}"
                               step="5" min="1" max="5000" style="width: 80px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;"
                               title="${rec.rationale.E}">
                    </td>
                    <td>${soilClassCell}</td>
                `;
                tbody.appendChild(row);
            });
        }

        // 수동 토질 분류 변경 핸들러
        function onManualSoilClassChange(selectElement, layerName) {
            const newBehavior = selectElement.value;
            const stats = soilLayerStatistics[layerName];

            if (!stats) return;

            // 분류 결과 업데이트
            stats.behavior = newBehavior;
            stats.classification.behavior = newBehavior;
            stats.classification.confidence = 'MANUAL_INPUT';
            stats.classification.method = 'MANUAL_INPUT';
            stats.classification.manual_flag = false; // 사용자가 선택했으므로 더 이상 수동 플래그 필요 없음

            // soilType도 업데이트 (하위 호환성)
            switch (newBehavior) {
                case 'sandy': stats.soilType = 'sand'; break;
                case 'cohesive': stats.soilType = 'clay'; break;
                case 'rock': stats.soilType = 'rock'; break;
                default: stats.soilType = 'unknown';
            }

            // 토질정수 재계산
            stats.recommended = calculateRecommendedParams(stats);

            // 테이블 업데이트
            updateSoilParameterTable();

            console.log(`[onManualSoilClassChange] ${layerName} → ${newBehavior}`);
        }

        // 파라미터 추천 근거 표시
        function showParamRationale(layerName, paramType) {
            const stats = soilLayerStatistics[layerName];
            if (!stats) return;

            const rationale = SOIL_PARAM_RATIONALE[paramType];
            if (!rationale) return;

            let message = `【${rationale.title}】\n\n`;

            // 현재 지층 정보
            message += `▸ 지층: ${layerName}\n`;
            message += `▸ N값: ${stats.nMin}~${stats.nMax} (평균 ${stats.nAvg.toFixed(1)})\n`;
            message += `▸ 토질분류: ${stats.soilType}\n\n`;

            // 추정식
            if (rationale.methods) {
                message += `【적용된 추정식】\n`;
                message += `${stats.recommended.rationale[paramType]}\n\n`;

                message += `【기타 추정식】\n`;
                Object.keys(rationale.methods).forEach(method => {
                    const m = rationale.methods[method];
                    message += `• ${m.reference}: ${m.formula}\n`;
                });
                message += '\n';
            }

            // 일반적인 범위
            if (rationale.typical_ranges) {
                message += `【일반적인 범위】\n`;
                Object.keys(rationale.typical_ranges).forEach(key => {
                    message += `• ${key}: ${rationale.typical_ranges[key]}\n`;
                });
            }

            if (rationale.note) {
                message += `\n※ ${rationale.note}`;
            }

            alert(message);
        }

        // 토질정수 산출 근거 도움말 모달 표시
        function showSoilParamHelpModal() {
            let modal = document.getElementById('soilParamHelpModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'soilParamHelpModal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.6);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                document.body.appendChild(modal);

                // ESC 키로 닫기
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }

            modal.innerHTML = `
                <div style="background: white; border-radius: 8px; max-width: 900px; width: 95%; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                    <div style="background: linear-gradient(135deg, #1e3a5f, #2c5282); color: white; padding: 18px 24px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1;">
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 600;">토질정수 산출 근거 및 사용 방법</h3>
                        <button onclick="document.getElementById('soilParamHelpModal').style.display='none'"
                                style="background: none; border: none; color: white; font-size: 1.8rem; cursor: pointer; line-height: 1; padding: 0 5px;">&times;</button>
                    </div>
                    <div style="padding: 24px; line-height: 1.7; color: #333;">

                        <!-- 개요 -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">개요</h4>
                            <p style="margin: 0; text-align: justify;">
                                본 테이블은 시추주상도에서 추출된 표준관입시험(SPT) N값을 기반으로 각 지층의 토질정수를 자동 산정합니다.
                                산정된 값은 경험적 상관관계식을 적용한 추천값이며, 설계자가 현장 조건 및 기존 지반조사 결과를 고려하여 수정할 수 있습니다.
                            </p>
                            <p style="margin: 10px 0 0 0; padding: 12px; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem;">
                                <strong>사용 방법:</strong> 각 토질정수 입력칸에 마우스를 올리면 해당 값의 산출 근거(적용 공식, 계산 과정)가 툴팁으로 표시됩니다.
                                N값 범위를 클릭하면 시추공별 상세 N값 데이터와 가중평균 계산 과정을 확인할 수 있습니다.
                            </p>
                        </div>

                        <!-- 토질 분류 기준 -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">토질 분류 기준</h4>
                            <p style="margin: 0 0 10px 0;">지층명 및 USCS 코드를 분석하여 토질을 자동 분류합니다. 분류 결과에 따라 적용되는 추정식이 달라집니다.</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 8px;">
                                <thead>
                                    <tr style="background: #e8eef4;">
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left; width: 15%;">분류</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left; width: 25%;">USCS 코드</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">대표 지층명</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-weight: 600;">사질토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">SW, SP, SM, SC, GW, GP, GM, GC</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">모래, 자갈, 사질토, 풍화토, 풍화잔류토</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px; font-weight: 600;">점성토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">CL, CH, ML, MH, OL, OH</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">점토, 실트, 점성토, 연약층</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-weight: 600;">혼합토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">CL+SM, SC+ML 등 복합</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">점토질 모래, 실트질 점토 등</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px; font-weight: 600;">암반</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">WR, SR, HR</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">풍화암, 연암, 경암</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- 비배수전단강도 cu -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">비배수전단강도 (cu) 추정</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: #e8eef4;">
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">토질</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">추정식</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">출처</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">비고</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">점성토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">c<sub>u</sub> = 6.25 × N (kPa)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">Terzaghi & Peck (1967)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">정규압밀 점토, 가장 보편적</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">혼합토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">c<sub>u</sub> = 6.25 × N × 0.7 (kPa)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">Terzaghi 수정</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">점성토 성분 70% 반영</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">사질토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">c<sub>u</sub> = 0</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">-</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">배수조건, 마찰력 지배</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                                * 대안 추정식: Stroud (1974) c<sub>u</sub> = 4.4N (과압밀 점토), Hara et al. (1974) c<sub>u</sub> = 29N<sup>0.72</sup> (일본 점토)
                            </p>
                        </div>

                        <!-- 내부마찰각 phi -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">내부마찰각 (phi) 추정</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: #e8eef4;">
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">토질</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">추정식</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">출처</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">비고</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">사질토/혼합토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">phi = sqrt(12N) + 15 (deg)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">Dunham (1954)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">가장 널리 사용</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">점성토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">N값 기반 유효 내부마찰각</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">경험적 상관관계</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">유효응력 해석 기준</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p style="margin: 12px 0 8px 0; font-weight: 600; color: #333;">점성토 유효 내부마찰각 (phi') 기준:</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                <thead>
                                    <tr style="background: #f5f5f5;">
                                        <th style="border: 1px solid #ddd; padding: 8px;">점토 상태</th>
                                        <th style="border: 1px solid #ddd; padding: 8px;">N값 범위</th>
                                        <th style="border: 1px solid #ddd; padding: 8px;">phi' (deg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">연약</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">N <= 2</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">18</td></tr>
                                    <tr style="background: #fafafa;"><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">연약~중간</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">2 < N <= 4</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">22</td></tr>
                                    <tr><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">중간</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">4 < N <= 8</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">25</td></tr>
                                    <tr style="background: #fafafa;"><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">견고</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">8 < N <= 15</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">28</td></tr>
                                    <tr><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">매우 견고</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">N > 15</td><td style="border: 1px solid #ddd; padding: 6px; text-align: center;">30</td></tr>
                                </tbody>
                            </table>
                            <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                                * 대안 추정식: Peck et al. (1953) phi = 28 + 0.4N (max 40deg), JRA (1996) phi = sqrt(20N) + 15
                            </p>
                        </div>

                        <!-- 단위중량 gamma -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">단위중량 (gamma) 추정</h4>
                            <p style="margin: 0 0 10px 0;">토질 분류 및 N값에 따른 경험적 범위를 적용합니다.</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: #e8eef4;">
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">토질</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">N값 범위</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">gamma (kN/m3)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;" rowspan="3">점성토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">N < 4</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">16</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">4 <= N < 8</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">17</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">N >= 8</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">18~19</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;" rowspan="2">사질토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">N < 10</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">17</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">N >= 10</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">18~19</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">풍화토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">-</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">19</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">풍화암</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">-</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">21</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">연암 이상</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">-</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">23</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                                * 지하수위 아래에서는 수중단위중량 (gamma' = gamma_sat - 10) 적용 필요
                            </p>
                        </div>

                        <!-- 탄성계수 E -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">탄성계수 (E) 추정</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background: #e8eef4;">
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">토질</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">추정식</th>
                                        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">출처</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">일반 토사 (간편식)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">E = 2.5 × N (MPa)</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">실무 간편식</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">풍화토</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">E = 3 × N (MPa), min 50</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">경험식</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #ccc; padding: 8px;">풍화암</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">E = 5 × N (MPa), min 100</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">경험식</td>
                                    </tr>
                                    <tr style="background: #fafafa;">
                                        <td style="border: 1px solid #ccc; padding: 8px;">연암 이상</td>
                                        <td style="border: 1px solid #ccc; padding: 8px; font-family: 'Times New Roman', serif;">E = 10 × N (MPa), min 300</td>
                                        <td style="border: 1px solid #ccc; padding: 8px;">경험식</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #666;">
                                * 정밀 해석 시: 점성토 E = 300~500 × cu (Duncan & Buchignani, 1976), 사질토 E = 500~1500 × sqrt(N) (Bowles, 1996)
                            </p>
                        </div>

                        <!-- N값 평균 계산 방법 -->
                        <div style="margin-bottom: 28px;">
                            <h4 style="color: #1e3a5f; margin: 0 0 12px 0; font-size: 1.05rem; border-left: 4px solid #1e3a5f; padding-left: 12px;">N값 평균 계산 방법</h4>
                            <p style="margin: 0 0 10px 0;">동일 지층이 여러 시추공에서 출현할 경우, 두께 기반 가중평균을 적용합니다.</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: 'Times New Roman', serif; font-size: 1rem;">
                                <p style="margin: 0 0 8px 0;"><strong>가중평균 N값:</strong></p>
                                <p style="margin: 0; text-align: center; font-size: 1.1rem;">
                                    N<sub>avg</sub> = (SUM N<sub>i</sub> × t<sub>i</sub>) / (SUM t<sub>i</sub>)
                                </p>
                                <p style="margin: 10px 0 0 0; font-size: 0.9rem; color: #666; font-family: sans-serif;">
                                    여기서, N<sub>i</sub> = 각 측정점의 N값, t<sub>i</sub> = 해당 구간의 두께 (m)
                                </p>
                            </div>
                            <p style="margin: 12px 0 0 0; font-size: 0.9rem;">
                                N값 범위를 클릭하면 각 시추공별 N값 데이터와 가중평균 계산 과정을 상세히 확인할 수 있습니다.
                            </p>
                        </div>

                        <!-- 주의사항 -->
                        <div style="margin-bottom: 10px; padding: 15px; background: #fff8e1; border-left: 4px solid #ff9800; border-radius: 0 4px 4px 0;">
                            <h4 style="color: #e65100; margin: 0 0 10px 0; font-size: 0.95rem;">주의사항</h4>
                            <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem; color: #333;">
                                <li style="margin-bottom: 6px;">본 추천값은 경험적 상관관계에 기반한 참고값입니다.</li>
                                <li style="margin-bottom: 6px;">실제 설계 시에는 현장시험 결과, 실내시험 결과를 우선 적용해야 합니다.</li>
                                <li style="margin-bottom: 6px;">N값이 없는 지층은 지층명 기반 기본값이 적용되며, "(샘플없음-추정)"으로 표기됩니다.</li>
                                <li style="margin-bottom: 6px;">토질분류가 부정확할 경우 드롭다운에서 직접 수정할 수 있습니다.</li>
                                <li>모든 값은 설계자의 판단에 따라 수정 가능하며, 수정 후 "설정 적용" 버튼을 클릭해야 계산에 반영됩니다.</li>
                            </ul>
                        </div>

                        <!-- 참고문헌 -->
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                            <h4 style="color: #666; margin: 0 0 10px 0; font-size: 0.9rem;">참고문헌</h4>
                            <ul style="margin: 0; padding-left: 20px; font-size: 0.8rem; color: #666; line-height: 1.8;">
                                <li>Terzaghi, K. & Peck, R.B. (1967). Soil Mechanics in Engineering Practice, 2nd Ed.</li>
                                <li>Dunham, J.W. (1954). Pile Foundation for Buildings, ASCE Proceedings.</li>
                                <li>Peck, R.B., Hanson, W.E. & Thornburn, T.H. (1953). Foundation Engineering.</li>
                                <li>Stroud, M.A. (1974). The Standard Penetration Test in Insensitive Clays and Soft Rocks.</li>
                                <li>Duncan, J.M. & Buchignani, A.L. (1976). An Engineering Manual for Settlement Studies.</li>
                                <li>Bowles, J.E. (1996). Foundation Analysis and Design, 5th Ed.</li>
                                <li>일본도로협회 (1996). 도로교시방서 동해설.</li>
                                <li>구조물기초설계기준 해설 (2018). 국토교통부.</li>
                            </ul>
                        </div>

                    </div>
                </div>
            `;

            modal.style.display = 'flex';
        }

        // N값 상세 계산 팝업 표시
        function showNValueDetails(layerName) {
            const stats = soilLayerStatistics[layerName];
            if (!stats || !stats.nValueDetails || stats.nValueDetails.length === 0) {
                alert(`${layerName} 지층의 N값 데이터가 없습니다.`);
                return;
            }

            // 모달 생성 또는 기존 모달 사용
            let modal = document.getElementById('nValueDetailModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'nValueDetailModal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                document.body.appendChild(modal);
            }

            const details = stats.nValueDetails;

            // 시추공별로 그룹화
            const byBorehole = {};
            details.forEach(d => {
                if (!byBorehole[d.borehole]) {
                    byBorehole[d.borehole] = [];
                }
                byBorehole[d.borehole].push(d);
            });

            // 테이블 HTML 생성
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 15px;">
                    <thead>
                        <tr style="background: #e3f2fd;">
                            <th style="border: 1px solid #ddd; padding: 8px;">시추공</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">심도 (m)</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">타격횟수</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">N값</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">두께 (m)</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">N×두께</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totalWeight = 0;
            let weightedSum = 0;

            details.forEach((d, idx) => {
                const nxThickness = d.n * d.thickness;
                totalWeight += d.thickness;
                weightedSum += nxThickness;

                tableHTML += `
                    <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9f9f9'};">
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${d.borehole}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${d.depth}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${d.hits}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center; font-weight: 600;">${d.n}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${d.thickness.toFixed(2)}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${nxThickness.toFixed(2)}</td>
                    </tr>
                `;
            });

            // 합계 행
            tableHTML += `
                    <tr style="background: #fff3e0; font-weight: 600;">
                        <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">합계:</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${totalWeight.toFixed(2)}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${weightedSum.toFixed(2)}</td>
                    </tr>
                </tbody>
                </table>
            `;

            const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
            const simpleAvg = stats.nAvgSimple;

            modal.innerHTML = `
                <div style="background: white; border-radius: 8px; max-width: 700px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <div style="background: var(--primary-navy, #1a365d); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.1rem;">N값 상세 계산 - ${layerName}</h3>
                        <button onclick="document.getElementById('nValueDetailModal').style.display='none'"
                                style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 15px; padding: 12px; background: #e8f5e9; border-radius: 4px; border-left: 3px solid #4caf50;">
                            <strong>가중치 평균 공식:</strong><br>
                            <span style="font-family: serif; font-style: italic;">N<sub>avg</sub> = Σ(N<sub>i</sub> × t<sub>i</sub>) / Σt<sub>i</sub></span><br>
                            <small style="color: #555;">여기서 t<sub>i</sub>는 각 측정점의 해당 지층 두께</small>
                        </div>

                        ${tableHTML}

                        <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div>
                                    <strong>단순 평균:</strong><br>
                                    <span style="font-size: 1.2rem; color: #666;">${simpleAvg.toFixed(2)}</span>
                                    <small style="display: block; color: #999;">= (${stats.nValues.join(' + ')}) / ${stats.nCount}</small>
                                </div>
                                <div>
                                    <strong>가중치 평균:</strong><br>
                                    <span style="font-size: 1.2rem; color: var(--primary-steel, #4a7c59); font-weight: 600;">${weightedAvg.toFixed(2)}</span>
                                    <small style="display: block; color: #999;">= ${weightedSum.toFixed(2)} / ${totalWeight.toFixed(2)}</small>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
                            <small>
                                <strong>N값 범위:</strong> ${stats.nMin} ~ ${stats.nMax}<br>
                                <strong>표준편차 (σ):</strong> ${stats.nStd.toFixed(2)}<br>
                                <strong>데이터 개수:</strong> ${stats.nCount}개 (${Object.keys(byBorehole).length}개 시추공)
                            </small>
                        </div>

                        <div style="text-align: center; margin-top: 20px;">
                            <button onclick="document.getElementById('nValueDetailModal').style.display='none'"
                                    style="padding: 10px 30px; background: var(--primary-navy, #1a365d); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.95rem;">
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modal.style.display = 'flex';

            // 모달 바깥 클릭 시 닫기
            modal.onclick = function(e) {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            };
        }


        // 공식 계수 및 설정 동기화 (사이드바 → 입력검토 탭)
        function syncFormulaCoefficients() {
            // 사이드바 값을 입력검토 탭에 동기화
            const sfVertical = document.getElementById('sfVertical')?.value || 3.0;
            const sfPullout = document.getElementById('sfPullout')?.value || 3.0;
            const sfHorizontal = document.getElementById('sfHorizontal')?.value || 2.0;
            const endBearingCoeff = document.getElementById('endBearingCoefficient')?.value || 300;
            const allowableSettlement = document.getElementById('allowableSettlement')?.value || 25;
            const targetElevation = document.getElementById('targetGroundElevation')?.value || 0;
            const fillNValue = document.getElementById('fillNValue')?.value || 8;

            // 안전율 및 설계 기준 동기화
            document.getElementById('reviewSfCompression').value = sfVertical;
            document.getElementById('reviewSfPullout').value = sfPullout;
            if (document.getElementById('reviewSfLateral')) {
                document.getElementById('reviewSfLateral').value = sfHorizontal;
            }
            document.getElementById('endBearingAlpha').value = endBearingCoeff;
            if (document.getElementById('reviewAllowableSettlement')) {
                document.getElementById('reviewAllowableSettlement').value = allowableSettlement;
            }

            // 계획고 및 성토 N값 동기화
            if (document.getElementById('reviewTargetElevation')) {
                document.getElementById('reviewTargetElevation').value = targetElevation;
            }
            if (document.getElementById('reviewFillN')) {
                document.getElementById('reviewFillN').value = fillNValue;
            }

            // 말뚝 타입 동기화
            const pileType = document.getElementById('pileTypeSelector')?.value || 'phc';
            if (document.getElementById('reviewPileType')) {
                document.getElementById('reviewPileType').value = pileType;
            }

            // PHC 말뚝 규격 동기화
            if (pileType === 'phc') {
                const phcSpec = document.getElementById('phcPileType')?.value || '500-B';
                if (document.getElementById('reviewPhcSpec')) {
                    document.getElementById('reviewPhcSpec').value = phcSpec;
                }
            } else {
                // 강관 말뚝 규격 동기화
                const steelDia = document.getElementById('steelDiameter')?.value || '508.0';
                const steelThk = document.getElementById('steelThickness')?.value || '12.7';
                const steelMat = document.getElementById('steelMaterial')?.value || 'SKK400';
                if (document.getElementById('reviewSteelDia')) {
                    document.getElementById('reviewSteelDia').value = steelDia;
                }
                if (document.getElementById('reviewSteelThk')) {
                    document.getElementById('reviewSteelThk').value = steelThk;
                }
                if (document.getElementById('reviewSteelMat')) {
                    document.getElementById('reviewSteelMat').value = steelMat;
                }
            }

            // 시공 조건 동기화
            const constMethod = document.getElementById('constructionMethod')?.value || 'bored';
            const bearingLayer = document.getElementById('bearingLayer')?.value || 'weathered_rock';
            const penetrationDepth = document.getElementById('penetrationDepth')?.value || '1.0';
            const spliceMethod = document.getElementById('spliceMethod')?.value || 'none';

            if (document.getElementById('reviewConstMethod')) {
                document.getElementById('reviewConstMethod').value = constMethod;
            }
            if (document.getElementById('reviewBearingLayer')) {
                document.getElementById('reviewBearingLayer').value = bearingLayer;
            }
            if (document.getElementById('reviewPenetrationDepth')) {
                document.getElementById('reviewPenetrationDepth').value = penetrationDepth;
            }
            if (document.getElementById('reviewSpliceMethod')) {
                document.getElementById('reviewSpliceMethod').value = spliceMethod;
            }
        }

        // 설정 적용 및 계산 실행
        function applyInputReviewSettings() {
            if (!boreholeData || boreholeData.length === 0) {
                alert('시추공 데이터가 없습니다. 먼저 JSON 파일을 업로드해주세요.');
                return;
            }

            showLoading();

            try {
                // 1. 지층별 토질정수 수집
                const soilParams = {};
                document.querySelectorAll('#soilParameterTableBody tr').forEach(row => {
                    const layerName = row.dataset.layerName;
                    if (!layerName) return;

                    const inputs = row.querySelectorAll('.soil-param-input');
                    soilParams[layerName] = {
                        cu: parseFloat(inputs[0]?.value || 0),
                        phi: parseFloat(inputs[1]?.value || 30),
                        gamma: parseFloat(inputs[2]?.value || 18),
                        E: parseFloat(inputs[3]?.value || 50)
                    };
                });

                // 2. 공식 계수 수집
                const formulaCoeffs = {
                    alphaLow: parseFloat(document.getElementById('alphaLow')?.value || 1.0),
                    alphaHigh: parseFloat(document.getElementById('alphaHigh')?.value || 0.5),
                    betaSand: parseFloat(document.getElementById('betaSand')?.value || 2.0),
                    betaClay: parseFloat(document.getElementById('betaClay')?.value || 6.25),
                    fsMaxClay: parseFloat(document.getElementById('fsMaxClay')?.value || 150),
                    fsMaxSand: parseFloat(document.getElementById('fsMaxSand')?.value || 200),
                    endBearingAlpha: parseFloat(document.getElementById('endBearingAlpha')?.value || 300),
                    qpMax: parseFloat(document.getElementById('qpMax')?.value || 15000),
                    factorDriven: parseFloat(document.getElementById('factorDriven')?.value || 1.0),
                    factorBored: parseFloat(document.getElementById('factorBored')?.value || 0.7),
                    sfCompression: parseFloat(document.getElementById('reviewSfCompression')?.value || 3.0),
                    sfPullout: parseFloat(document.getElementById('reviewSfPullout')?.value || 3.0),
                    sfLateral: parseFloat(document.getElementById('reviewSfLateral')?.value || 2.0),
                    // 침하량 계수 추가
                    alphaS: parseFloat(document.querySelector('input[name="alphaS"]:checked')?.value || 0.67),
                    Cp: parseFloat(document.getElementById('reviewCp')?.value || 0.12),
                    allowableSettlement: parseFloat(document.getElementById('reviewAllowableSettlement')?.value || 25)
                };

                // 2-1. 토질 분류 결과 수집
                const soilClassifications = {};
                Object.keys(soilLayerStatistics).forEach(layerName => {
                    const stats = soilLayerStatistics[layerName];
                    soilClassifications[layerName] = {
                        behavior: stats.behavior || 'unknown',
                        soilType: stats.soilType || 'unknown',
                        classification: stats.classification || {}
                    };
                });

                // 3. 전역 파라미터에 저장
                globalDesignParameters.soilParams = soilParams;
                globalDesignParameters.formulaCoeffs = formulaCoeffs;
                globalDesignParameters.soilClassifications = soilClassifications;

                // 4. 말뚝 제원 및 시공 조건 동기화
                syncHiddenInputs();

                // 5. 사이드바 설정 동기화
                document.getElementById('sfVertical').value = formulaCoeffs.sfCompression;
                document.getElementById('sfPullout').value = formulaCoeffs.sfPullout;
                document.getElementById('endBearingCoefficient').value = formulaCoeffs.endBearingAlpha;
                document.getElementById('allowableSettlement').value = formulaCoeffs.allowableSettlement;

                // 5. 각 시추공에 토질정수 적용 및 계획고/선단지지고 리셋
                const newTargetElevation = parseFloat(document.getElementById('reviewTargetElevation')?.value);
                boreholeData.forEach(borehole => {
                    // 기존 커스텀 파라미터 초기화
                    borehole._customParams = {};
                    borehole._customLayerList = [];

                    // 계획고 리셋 (새로운 값 적용을 위해 기존 값 삭제)
                    if (!isNaN(newTargetElevation)) {
                        borehole._targetElevation = newTargetElevation;
                    } else {
                        delete borehole._targetElevation;
                    }

                    // 커스텀 선단지지고 리셋 (설정 적용 시 자동 계산값으로 복원)
                    delete borehole._customPileTipLevel;

                    if (borehole.soil_data) {
                        borehole.soil_data.forEach(layer => {
                            if (!layer || !layer.soil_name) return;

                            const layerName = layer.soil_name;
                            const params = soilParams[layerName];

                            if (params) {
                                const depthMatch = layer.depth_range?.match(/([\d.]+)~([\d.]+)m/);
                                const depthFrom = depthMatch ? parseFloat(depthMatch[1]) : 0;
                                const depthTo = depthMatch ? parseFloat(depthMatch[2]) : 0;

                                const avgN = getAverageN(layer);

                                const layerParams = {
                                    N: avgN,
                                    cu: params.cu,
                                    phi: params.phi,
                                    gamma: params.gamma,
                                    E: params.E,
                                    depthFrom: depthFrom,
                                    depthTo: depthTo,
                                    layerName: layerName
                                };

                                borehole._customParams[layerName] = layerParams;
                                borehole._customLayerList.push(layerParams);
                            }
                        });
                    }
                });

                // 디버깅 로그: 적용된 설정값
                console.log('[applyInputReviewSettings] ========== 설정 적용 시작 ==========');
                console.log('[applyInputReviewSettings] 적용된 토질정수:', soilParams);
                console.log('[applyInputReviewSettings] 적용된 공식계수:', formulaCoeffs);
                console.log('[applyInputReviewSettings] 적용된 계획고:', newTargetElevation);
                console.log('[applyInputReviewSettings] 말뚝타입:', document.getElementById('pileTypeSelector')?.value);
                console.log('[applyInputReviewSettings] 시공법:', document.getElementById('constructionMethod')?.value);
                console.log('[applyInputReviewSettings] 지지층:', document.getElementById('bearingLayer')?.value);
                console.log('[applyInputReviewSettings] 안전율(압축):', document.getElementById('sfVertical')?.value);
                console.log('[applyInputReviewSettings] 허용침하량:', document.getElementById('allowableSettlement')?.value);
                console.log('[applyInputReviewSettings] ========== 설정 적용 완료 ==========');

                // 6. 계산 실행
                performAnalysis();

                // 7. 종합 검토 탭으로 이동
                setTimeout(() => {
                    document.querySelector('.tab-button[data-tab="overview"]')?.click();
                }, 500);

                hideLoading();
                const pileTypeDesc = document.getElementById('pileTypeSelector')?.value === 'phc' ?
                    `PHC ${document.getElementById('phcPileType')?.value}` :
                    `강관 Ø${document.getElementById('steelDiameter')?.value}mm`;
                const constMethodDesc = document.getElementById('constructionMethod')?.value === 'driven' ? '항타말뚝' : '매입말뚝';
                alert(`설정이 적용되었습니다.\n\n• ${Object.keys(soilParams).length}개 지층 토질정수 적용\n• ${boreholeData.length}개 시추공 계산 완료\n• 말뚝: ${pileTypeDesc} (${constMethodDesc})\n• 계획고: EL.${newTargetElevation}m\n• 안전율: ${formulaCoeffs.sfCompression}\n• 허용침하량: ${formulaCoeffs.allowableSettlement}mm`);

            } catch (error) {
                hideLoading();
                console.error('[applyInputReviewSettings] 오류:', error);
                alert('설정 적용 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // 기본값 복원
        function resetInputReviewSettings() {
            if (!confirm('모든 설정을 기본값으로 복원하시겠습니까?')) return;

            // 공식 계수 기본값 복원
            document.getElementById('alphaLow').value = 1.0;
            document.getElementById('alphaHigh').value = 0.5;
            document.getElementById('betaSand').value = 2.0;
            document.getElementById('fsMaxClay').value = 150;
            document.getElementById('fsMaxSand').value = 200;
            document.getElementById('endBearingAlpha').value = 300;
            document.getElementById('qpMax').value = 15000;
            document.getElementById('factorDriven').value = 1.0;
            document.getElementById('factorBored').value = 0.7;
            document.getElementById('reviewSfCompression').value = 3.0;
            document.getElementById('reviewSfPullout').value = 3.0;
            document.getElementById('reviewSfLateral').value = 2.0;

            // 추정식 기본값 복원 - 점성토/사질토 분리
            const cuClayRadio = document.querySelector('input[name="cuEstimationClay"][value="terzaghi"]');
            const cuSandRadio = document.querySelector('input[name="cuEstimationSand"][value="standard"]');
            const phiRadio = document.querySelector('input[name="phiEstimation"][value="dunham"]');
            if (cuClayRadio) cuClayRadio.checked = true;
            if (cuSandRadio) cuSandRadio.checked = true;
            if (phiRadio) phiRadio.checked = true;

            // cu 계수 기본값 복원
            const cuCoeffCite = document.getElementById('cuCoeffCite');
            const cuCoeffSand = document.getElementById('cuCoeffSand');
            if (cuCoeffCite) cuCoeffCite.value = 6.25;
            if (cuCoeffSand) cuCoeffSand.value = 2.0;

            // 지층별 토질정수 다시 계산
            if (boreholeData && boreholeData.length > 0) {
                analyzeBoreholeStatistics();
                updateSoilParameterTable();
            }

            alert('기본값으로 복원되었습니다.');
        }

        // 추정식 변경 시 토질정수 재계산
        function onEstimationMethodChange() {
            if (boreholeData && boreholeData.length > 0) {
                // 추천값 재계산
                Object.keys(soilLayerStatistics).forEach(layerName => {
                    soilLayerStatistics[layerName].recommended = calculateRecommendedParams(soilLayerStatistics[layerName]);
                });
                updateSoilParameterTable();
            }
        }

        // 이벤트 리스너 등록 (DOM 로드 후)
        document.addEventListener('DOMContentLoaded', function() {
            // 추정식 라디오 버튼 변경 이벤트 - 점성토/사질토 분리
            document.querySelectorAll('input[name="cuEstimationClay"], input[name="cuEstimationSand"], input[name="phiEstimation"]').forEach(radio => {
                radio.addEventListener('change', onEstimationMethodChange);
            });

            // cu 계수 입력 변경 이벤트
            const cuCoeffCite = document.getElementById('cuCoeffCite');
            const cuCoeffSand = document.getElementById('cuCoeffSand');
            if (cuCoeffCite) {
                cuCoeffCite.addEventListener('change', onEstimationMethodChange);
                cuCoeffCite.addEventListener('input', function() {
                    // 사용자 정의 선택으로 자동 전환
                    const customRadio = document.querySelector('input[name="cuEstimationClay"][value="custom"]');
                    if (customRadio) customRadio.checked = true;
                });
            }
            if (cuCoeffSand) {
                cuCoeffSand.addEventListener('change', onEstimationMethodChange);
                cuCoeffSand.addEventListener('input', function() {
                    // 사용자 정의 선택으로 자동 전환
                    const customRadio = document.querySelector('input[name="cuEstimationSand"][value="custom"]');
                    if (customRadio) customRadio.checked = true;
                });
            }
        });

        // ============================================================
        // 입력 검토 탭 - 말뚝 제원 및 시공 조건 관련 함수들
        // ============================================================

        // 말뚝 타입 변경 시
        function onReviewPileTypeChange() {
            const pileType = document.getElementById('reviewPileType')?.value || 'phc';
            const phcOptions = document.getElementById('reviewPhcOptions');
            const steelOptions = document.getElementById('reviewSteelOptions');

            if (pileType === 'phc') {
                if (phcOptions) phcOptions.style.display = 'block';
                if (steelOptions) steelOptions.style.display = 'none';
            } else {
                if (phcOptions) phcOptions.style.display = 'none';
                if (steelOptions) steelOptions.style.display = 'block';
            }

            updateReviewPileSpecs();
            syncHiddenInputs();
        }

        // 말뚝 제원 표시 업데이트
        function updateReviewPileSpecs() {
            const pileType = document.getElementById('reviewPileType')?.value || 'phc';

            let diameter, thickness, area, grossArea, perimeter, Ep, structural;

            if (pileType === 'phc') {
                const spec = document.getElementById('reviewPhcSpec')?.value || '500-B';
                const pile = PHC_PILES[spec];
                if (pile) {
                    diameter = pile.diameter * 1000;
                    thickness = pile.thickness * 1000;
                    area = pile.area;
                    grossArea = pile.crossArea;
                    perimeter = Math.PI * pile.diameter;
                    Ep = PILE_ELASTIC_MODULUS.PHC.E_MPa;
                    structural = pile.allowable;
                }
            } else {
                const dia = parseFloat(document.getElementById('reviewSteelDia')?.value || 508) / 1000;
                const thk = parseFloat(document.getElementById('reviewSteelThk')?.value || 12.7) / 1000;
                const mat = document.getElementById('reviewSteelMat')?.value || 'SKK400';
                const fy = STEEL_PIPE_SPECS.materials[mat]?.yieldStrength || 235;

                diameter = dia * 1000;
                thickness = thk * 1000;
                area = Math.PI * (Math.pow(dia/2, 2) - Math.pow((dia - 2*thk)/2, 2));
                grossArea = Math.PI * Math.pow(dia/2, 2);
                perimeter = Math.PI * dia;
                Ep = PILE_ELASTIC_MODULUS.STEEL.E_MPa;
                structural = area * fy * 1000 / 1.5;
            }

            // 표시 업데이트
            document.getElementById('reviewPileDiameter').textContent = `${diameter.toFixed(0)} mm`;
            document.getElementById('reviewPileThickness').textContent = `${thickness.toFixed(0)} mm`;
            document.getElementById('reviewPileArea').textContent = `${area.toFixed(4)} m²`;
            document.getElementById('reviewPileGrossArea').textContent = `${grossArea.toFixed(4)} m²`;
            document.getElementById('reviewPilePerimeter').textContent = `${perimeter.toFixed(3)} m`;
            document.getElementById('reviewPileEp').textContent = `${Ep.toLocaleString()} MPa`;
            document.getElementById('reviewPileStructural').textContent = `${structural.toLocaleString(undefined, {maximumFractionDigits: 0})} kN`;

            syncHiddenInputs();
        }

        // 숨겨진 입력 필드에 동기화 (기존 시스템과 호환)
        function syncHiddenInputs() {
            const pileType = document.getElementById('reviewPileType')?.value || 'phc';
            document.getElementById('pileTypeSelector').value = pileType;

            if (pileType === 'phc') {
                document.getElementById('phcPileType').value = document.getElementById('reviewPhcSpec')?.value || '500-B';
            } else {
                document.getElementById('steelDiameter').value = document.getElementById('reviewSteelDia')?.value || '508.0';
                document.getElementById('steelThickness').value = document.getElementById('reviewSteelThk')?.value || '12.7';
                document.getElementById('steelMaterial').value = document.getElementById('reviewSteelMat')?.value || 'SKK400';
            }

            document.getElementById('constructionMethod').value = document.getElementById('reviewConstMethod')?.value || 'bored';
            document.getElementById('bearingLayer').value = document.getElementById('reviewBearingLayer')?.value || 'weathered_rock';
            document.getElementById('penetrationDepth').value = document.getElementById('reviewPenetrationDepth')?.value || '1.0';
            document.getElementById('spliceMethod').value = document.getElementById('reviewSpliceMethod')?.value || 'none';
            document.getElementById('targetGroundElevation').value = document.getElementById('reviewTargetElevation')?.value || '0';
            document.getElementById('fillNValue').value = document.getElementById('reviewFillN')?.value || '8';

            // 안전율 동기화
            document.getElementById('sfVertical').value = document.getElementById('reviewSfCompression')?.value || '3.0';
            document.getElementById('sfPullout').value = document.getElementById('reviewSfPullout')?.value || '3.0';
            document.getElementById('sfHorizontal').value = document.getElementById('reviewSfLateral')?.value || '2.0';
            document.getElementById('allowableSettlement').value = document.getElementById('reviewAllowableSettlement')?.value || '25';
            document.getElementById('endBearingCoefficient').value = document.getElementById('endBearingAlpha')?.value || '300';

            // 사이드바 말뚝 옵션 표시 업데이트
            togglePileTypeInputs();

            // 사이드바 요약 업데이트
            updateSidebarSummary();
        }

        // 사이드바 요약 업데이트 (좌측 패널 요소가 없으면 건너뜀)
        function updateSidebarSummary() {
            // 사이드바 요약 요소들이 삭제되어 더 이상 필요 없음
            // 요소가 존재할 경우에만 업데이트
            const summaryPileType = document.getElementById('summaryPileType');
            const summaryConstMethod = document.getElementById('summaryConstMethod');
            const summaryBearingLayer = document.getElementById('summaryBearingLayer');
            const summarySafetyFactor = document.getElementById('summarySafetyFactor');
            const summaryAllowableSettlement = document.getElementById('summaryAllowableSettlement');

            // 요소가 하나도 없으면 함수 종료
            if (!summaryPileType && !summaryConstMethod && !summaryBearingLayer) {
                return;
            }

            const pileType = document.getElementById('reviewPileType')?.value || 'phc';
            let pileDesc = '';

            if (pileType === 'phc') {
                const spec = document.getElementById('reviewPhcSpec')?.value || '500-B';
                pileDesc = `PHC Ø${spec.split('-')[0]}mm-${spec.split('-')[1]}`;
            } else {
                const dia = document.getElementById('reviewSteelDia')?.value || '508';
                pileDesc = `강관 Ø${dia}mm`;
            }

            const constMethod = document.getElementById('reviewConstMethod')?.value || 'bored';
            const constMethodDesc = constMethod === 'driven' ? '항타말뚝' : '매입말뚝';

            const bearingLayer = document.getElementById('reviewBearingLayer')?.value || 'weathered_rock';
            const penetration = document.getElementById('reviewPenetrationDepth')?.value || '1.0';
            const bearingLayerName = bearingLayer === 'weathered_rock' ? '풍화암' :
                                    bearingLayer === 'soft_rock' ? '연암' : 'N≥50';
            const bearingLayerDesc = `${bearingLayerName} ${penetration}m`;

            const sfComp = document.getElementById('reviewSfCompression')?.value || '3.0';
            const sfPull = document.getElementById('reviewSfPullout')?.value || '3.0';
            const allowSettlement = document.getElementById('reviewAllowableSettlement')?.value || '25';

            if (summaryPileType) summaryPileType.textContent = pileDesc;
            if (summaryConstMethod) summaryConstMethod.textContent = constMethodDesc;
            if (summaryBearingLayer) summaryBearingLayer.textContent = bearingLayerDesc;
            if (summarySafetyFactor) summarySafetyFactor.textContent = `${sfComp} / ${sfPull}`;
            if (summaryAllowableSettlement) summaryAllowableSettlement.textContent = `${allowSettlement} mm`;
        }

        // 침하량 계산 계수 가져오기
        function getSettlementCoefficients() {
            // 전역 설계 파라미터에서 우선 가져오고, 없으면 DOM에서 가져옴
            const coeffs = globalDesignParameters.formulaCoeffs || {};

            return {
                alphaS: coeffs.alphaS ||
                        parseFloat(document.querySelector('input[name="alphaS"]:checked')?.value || 0.67),
                Cp: coeffs.Cp ||
                    parseFloat(document.getElementById('reviewCp')?.value || 0.12),
                allowableSettlement: coeffs.allowableSettlement ||
                                     parseFloat(document.getElementById('reviewAllowableSettlement')?.value ||
                                                document.getElementById('allowableSettlement')?.value || 25)
            };
        }
