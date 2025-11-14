const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixRemainingDates() {
    console.log('🔍 sh_r 테이블의 비표준 날짜 검색 중...\n');

    const { data, error } = await supabase
        .from('sh_r')
        .select('id, order_id, cruise_name, checkin_date');

    if (error) {
        console.error('❌ 조회 실패:', error);
        process.exit(1);
    }

    const nonIso = data.filter(row => {
        const date = row.checkin_date;
        return date && !/^\d{4}-\d{2}-\d{2}/.test(date);
    });

    console.log(`발견된 비표준 날짜: ${nonIso.length}건\n`);

    nonIso.forEach((row, i) => {
        console.log(`${i + 1}. id=${row.id}, order_id=${row.order_id}`);
        console.log(`   크루즈: ${row.cruise_name}`);
        console.log(`   날짜: "${row.checkin_date}"`);
        console.log();
    });

    // 수동 변환 (점 구분 공백 있음)
    console.log('🔄 수동 변환 시작...\n');

    for (const row of nonIso) {
        const original = row.checkin_date;

        // 모든 점 구분 형식 처리 (공백 유무 무관)
        const match = original.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})$/);
        if (match) {
            const [, year, month, day] = match;
            const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

            console.log(`  "${original}" → "${normalized}"`);

            const { error: updateError } = await supabase
                .from('sh_r')
                .update({ checkin_date: normalized })
                .eq('id', row.id);

            if (updateError) {
                console.error(`    ❌ 업데이트 실패:`, updateError);
            } else {
                console.log(`    ✅ 성공`);
            }
        } else {
            console.warn(`  ⚠️ 패턴 매칭 실패: "${original}"`);
        }
    }

    // 최종 검증
    console.log('\n🔍 최종 검증 중...\n');

    const { data: finalData } = await supabase
        .from('sh_r')
        .select('checkin_date');

    const finalNonIso = finalData.filter(row => {
        const date = row.checkin_date;
        return date && !/^\d{4}-\d{2}-\d{2}/.test(date);
    });

    if (finalNonIso.length === 0) {
        console.log('✅ sh_r.checkin_date 완전히 정규화 완료! (1000건)');
    } else {
        console.log(`⚠️  여전히 비표준 형식 ${finalNonIso.length}건 남음:`);
        finalNonIso.slice(0, 5).forEach(row => console.log(`  - "${row.checkin_date}"`));
    }

    process.exit(0);
}

fixRemainingDates();
