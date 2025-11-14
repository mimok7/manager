const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 날짜 파싱 함수 (여러 형식 지원)
function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmed = dateStr.trim();

    // 1. ISO 형식 (YYYY-MM-DD) - 이미 정규화됨
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    // 2. 한국식 (YYYY. M. D 또는 YYYY. MM. DD)
    const koreanMatch = trimmed.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$/);
    if (koreanMatch) {
        const [, year, month, day] = koreanMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 3. 점 구분 공백 없음 (YYYY.MM.DD 또는 YYYY.M.D)
    const dotMatch = trimmed.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (dotMatch) {
        const [, year, month, day] = dotMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 4. 하이픈 형식 (YYYY-M-D)
    const hyphenMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (hyphenMatch) {
        const [, year, month, day] = hyphenMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 5. 슬래시 형식 (YYYY/MM/DD 또는 YYYY/M/D)
    const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
        const [, year, month, day] = slashMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    console.warn(`⚠️ 파싱 실패: "${dateStr}"`);
    return null;
}

// 테이블별 날짜 컬럼 정의
const tableConfigs = [
    { table: 'sh_r', columns: ['checkin_date'] },
    { table: 'sh_c', columns: ['boarding_datetime'] }, // datetime이지만 날짜 부분만 정규화
    { table: 'sh_cc', columns: ['boarding_date'] },
    { table: 'sh_p', columns: ['date'] },
    { table: 'sh_h', columns: ['checkin_date'] },
    { table: 'sh_t', columns: ['start_date'] },
    { table: 'sh_rc', columns: ['boarding_date'] }
];

async function normalizeTableDates(tableName, dateColumns) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 테이블: ${tableName}`);
    console.log(`${'='.repeat(60)}`);

    for (const columnName of dateColumns) {
        console.log(`\n🔍 컬럼: ${columnName}`);

        // 1. 전체 데이터 조회 (페이지네이션으로 모든 데이터 가져오기)
        let allRows = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: pageData, error: fetchError } = await supabase
                .from(tableName)
                .select('id, ' + columnName)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (fetchError) {
                console.error(`❌ 조회 실패 (페이지 ${page}):`, fetchError);
                break;
            }

            if (pageData && pageData.length > 0) {
                allRows = allRows.concat(pageData);
                page++;
                hasMore = pageData.length === pageSize;
                process.stdout.write(`\r  조회 중... ${allRows.length}건`);
            } else {
                hasMore = false;
            }
        }

        console.log(`\n  총 ${allRows.length}건 조회 완료`);

        // 2. 변환 필요한 데이터 분석
        const updates = [];
        const formatStats = {
            'ISO (이미 정규화)': 0,
            '한국식 (YYYY. M. D)': 0,
            '점 구분 (YYYY.M.D)': 0,
            '하이픈 (YYYY-M-D)': 0,
            '슬래시 (YYYY/M/D)': 0,
            '파싱 실패': 0,
            'null/empty': 0
        };

        for (const row of allRows) {
            const originalValue = row[columnName];

            if (!originalValue) {
                formatStats['null/empty']++;
                continue;
            }

            const normalized = parseDate(originalValue);

            if (!normalized) {
                formatStats['파싱 실패']++;
                console.warn(`  ⚠️ 파싱 실패: id=${row.id}, value="${originalValue}"`);
                continue;
            }

            // 형식 통계
            if (originalValue === normalized) {
                formatStats['ISO (이미 정규화)']++;
            } else if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}$/.test(originalValue)) {
                formatStats['한국식 (YYYY. M. D)']++;
            } else if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(originalValue)) {
                formatStats['점 구분 (YYYY.M.D)']++;
            } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(originalValue)) {
                formatStats['하이픈 (YYYY-M-D)']++;
            } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(originalValue)) {
                formatStats['슬래시 (YYYY/M/D)']++;
            }

            // 변환 필요한 경우만 업데이트 목록에 추가
            if (originalValue !== normalized) {
                updates.push({
                    id: row.id,
                    original: originalValue,
                    normalized: normalized
                });
            }
        }

        // 3. 통계 출력
        console.log('\n  📊 형식별 통계:');
        Object.entries(formatStats).forEach(([format, count]) => {
            if (count > 0) {
                console.log(`    ${format}: ${count}건`);
            }
        });

        // 4. 업데이트 실행
        if (updates.length === 0) {
            console.log(`\n  ✅ 변환 불필요 (모두 정규화됨)`);
            continue;
        }

        console.log(`\n  🔄 ${updates.length}건 변환 시작...`);

        // 샘플 출력 (최대 5개)
        console.log('\n  변환 예시:');
        updates.slice(0, 5).forEach(({ original, normalized }) => {
            console.log(`    "${original}" → "${normalized}"`);
        });

        // 배치 업데이트 (100건씩)
        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);

            for (const { id, normalized } of batch) {
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update({ [columnName]: normalized })
                    .eq('id', id);

                if (updateError) {
                    console.error(`    ❌ 업데이트 실패 (id=${id}):`, updateError.message);
                    errorCount++;
                } else {
                    successCount++;
                }
            }

            // 진행률 표시
            const progress = Math.min(i + batchSize, updates.length);
            const percent = ((progress / updates.length) * 100).toFixed(1);
            process.stdout.write(`\r  진행: ${progress}/${updates.length} (${percent}%)`);
        }

        console.log(`\n\n  ✅ 완료: 성공 ${successCount}건, 실패 ${errorCount}건`);
    }
}

async function main() {
    console.log('🚀 날짜 형식 정규화 시작\n');
    console.log('목표: 모든 날짜를 ISO 형식 (YYYY-MM-DD)으로 통일\n');

    const startTime = Date.now();

    try {
        for (const config of tableConfigs) {
            await normalizeTableDates(config.table, config.columns);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('✅ 전체 마이그레이션 완료!');
        console.log(`⏱️  소요 시간: ${elapsed}초`);
        console.log('='.repeat(60));

        // 검증
        console.log('\n🔍 검증 중...\n');
        await verifyNormalization();

    } catch (error) {
        console.error('\n❌ 마이그레이션 중 오류 발생:', error);
        process.exit(1);
    }

    process.exit(0);
}

async function verifyNormalization() {
    for (const config of tableConfigs) {
        for (const columnName of config.columns) {
            const { data, error } = await supabase
                .from(config.table)
                .select(columnName)
                .limit(1000);

            if (error) {
                console.error(`❌ ${config.table}.${columnName} 검증 실패:`, error);
                continue;
            }

            let isoCount = 0;
            let nonIsoCount = 0;
            const nonIsoSamples = [];

            data.forEach(row => {
                const value = row[columnName];
                if (!value) return;

                if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                    isoCount++;
                } else {
                    nonIsoCount++;
                    if (nonIsoSamples.length < 3) {
                        nonIsoSamples.push(value);
                    }
                }
            });

            if (nonIsoCount === 0) {
                console.log(`✅ ${config.table}.${columnName}: 모두 정규화됨 (${isoCount}건)`);
            } else {
                console.log(`⚠️  ${config.table}.${columnName}: ISO ${isoCount}건, 비표준 ${nonIsoCount}건`);
                console.log(`   예시: ${nonIsoSamples.join(', ')}`);
            }
        }
    }
}

main();
