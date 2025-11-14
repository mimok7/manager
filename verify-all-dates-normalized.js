const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const tableConfigs = [
    { table: 'sh_r', column: 'checkin_date' },
    { table: 'sh_c', column: 'boarding_datetime' },
    { table: 'sh_cc', column: 'boarding_date' },
    { table: 'sh_p', column: 'date' },
    { table: 'sh_h', column: 'checkin_date' },
    { table: 'sh_t', column: 'start_date' },
    { table: 'sh_rc', column: 'boarding_date' }
];

async function verifyAllDates() {
    console.log('🔍 전체 날짜 형식 검증 시작\n');
    console.log('='.repeat(70));

    let totalRecords = 0;
    let totalNormalized = 0;
    let totalNonNormalized = 0;

    for (const config of tableConfigs) {
        // 전체 데이터 개수 조회
        const { count: totalCount } = await supabase
            .from(config.table)
            .select('*', { count: 'exact', head: true });

        // 페이지네이션으로 전체 데이터 조회
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(config.table)
                .select(config.column)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error(`❌ ${config.table} 조회 실패:`, error);
                break;
            }

            if (data && data.length > 0) {
                allData = allData.concat(data);
                page++;
                hasMore = data.length === pageSize;
            } else {
                hasMore = false;
            }
        }

        let isoCount = 0;
        let nonIsoCount = 0;
        const nonIsoSamples = [];

        allData.forEach(row => {
            const value = row[config.column];
            if (!value) return;

            if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                isoCount++;
            } else {
                nonIsoCount++;
                if (nonIsoSamples.length < 5) {
                    nonIsoSamples.push(value);
                }
            }
        });

        totalRecords += allData.length;
        totalNormalized += isoCount;
        totalNonNormalized += nonIsoCount;

        const status = nonIsoCount === 0 ? '✅' : '⚠️';
        console.log(`${status} ${config.table}.${config.column}`);
        console.log(`   전체: ${totalCount}건 (조회: ${allData.length}건)`);
        console.log(`   ISO 형식: ${isoCount}건`);

        if (nonIsoCount > 0) {
            console.log(`   비표준 형식: ${nonIsoCount}건`);
            console.log(`   예시: ${nonIsoSamples.join(', ')}`);
        }
        console.log();
    }

    console.log('='.repeat(70));
    console.log('📊 전체 요약');
    console.log(`   총 레코드: ${totalRecords.toLocaleString()}건`);
    console.log(`   정규화 완료: ${totalNormalized.toLocaleString()}건`);
    console.log(`   비표준 형식: ${totalNonNormalized.toLocaleString()}건`);

    if (totalNonNormalized === 0) {
        console.log('\n🎉 모든 날짜가 ISO 형식으로 정규화되었습니다!');
    } else {
        console.log(`\n⚠️  ${totalNonNormalized}건의 비표준 형식이 남아있습니다.`);
    }

    // 2025-11-14 데이터 검색 테스트
    console.log('\n' + '='.repeat(70));
    console.log('🎯 2025-11-14 데이터 검색 테스트\n');

    const { data: cruiseData, error: cruiseError } = await supabase
        .from('sh_r')
        .select('order_id, cruise_name, checkin_date')
        .eq('checkin_date', '2025-11-14');

    if (cruiseError) {
        console.error('❌ 조회 실패:', cruiseError);
    } else {
        console.log(`✅ 크루즈 예약 (2025-11-14): ${cruiseData.length}건\n`);
        cruiseData.forEach((row, i) => {
            console.log(`${i + 1}. ${row.cruise_name} (${row.order_id})`);
        });
    }

    process.exit(0);
}

verifyAllDates();
