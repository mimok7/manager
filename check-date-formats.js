const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDateFormats() {
    console.log('🔍 sh_r 테이블의 날짜 형식 분석 중...\n');

    // 1. 전체 데이터 샘플 조회
    const { data: allSamples, error: allError } = await supabase
        .from('sh_r')
        .select('order_id, cruise_name, checkin_date')
        .limit(20);

    if (allError) {
        console.error('❌ 조회 실패:', allError);
        return;
    }

    console.log('📅 전체 데이터 샘플 (최근 20건):');
    allSamples.forEach((row, i) => {
        console.log(`${i + 1}. ${row.checkin_date} | ${row.cruise_name} | ${row.order_id}`);
    });

    // 2. 2026년 데이터 조회 (여러 형식)
    console.log('\n🎯 2026년 데이터 검색:');

    const { data: data2026, error: error2026 } = await supabase
        .from('sh_r')
        .select('order_id, cruise_name, checkin_date')
        .or('checkin_date.like.%2026%')
        .limit(20);

    if (data2026 && data2026.length > 0) {
        console.log(`✅ 2026년 데이터 ${data2026.length}건 발견:`);
        data2026.forEach((row, i) => {
            console.log(`${i + 1}. ${row.checkin_date} | ${row.cruise_name} | ${row.order_id}`);
        });
    } else {
        console.log('❌ 2026년 데이터 없음');
    }

    // 3. 오늘 날짜 (2025-11-14) 데이터 검색
    console.log('\n🎯 2025-11-14 데이터 검색:');

    const todayFormats = [
        '%2025-11-14%',
        '%2025. 11. 14%',
        '%11/14/2025%',
        '%14/11/2025%'
    ];

    for (const format of todayFormats) {
        const { data: todayData } = await supabase
            .from('sh_r')
            .select('order_id, cruise_name, checkin_date')
            .like('checkin_date', format)
            .limit(5);

        if (todayData && todayData.length > 0) {
            console.log(`✅ "${format}" 형식으로 ${todayData.length}건 발견:`);
            todayData.forEach(row => console.log(`  - ${row.checkin_date}`));
        }
    }

    // 4. 날짜 형식 분류
    console.log('\n📊 날짜 형식 분석:');
    const { data: allData } = await supabase
        .from('sh_r')
        .select('checkin_date')
        .limit(1000);

    const formatCounts = {
        'ISO (YYYY-MM-DD)': 0,
        '한국식 (YYYY. M. D)': 0,
        '슬래시 (YYYY/MM/DD)': 0,
        '기타': 0,
        'null/empty': 0
    };

    const samples = {
        'ISO (YYYY-MM-DD)': [],
        '한국식 (YYYY. M. D)': [],
        '슬래시 (YYYY/MM/DD)': [],
        '기타': []
    };

    allData?.forEach(row => {
        const date = row.checkin_date;
        if (!date) {
            formatCounts['null/empty']++;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            formatCounts['ISO (YYYY-MM-DD)']++;
            if (samples['ISO (YYYY-MM-DD)'].length < 3) samples['ISO (YYYY-MM-DD)'].push(date);
        } else if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}$/.test(date)) {
            formatCounts['한국식 (YYYY. M. D)']++;
            if (samples['한국식 (YYYY. M. D)'].length < 3) samples['한국식 (YYYY. M. D)'].push(date);
        } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date)) {
            formatCounts['슬래시 (YYYY/MM/DD)']++;
            if (samples['슬래시 (YYYY/MM/DD)'].length < 3) samples['슬래시 (YYYY/MM/DD)'].push(date);
        } else {
            formatCounts['기타']++;
            if (samples['기타'].length < 3) samples['기타'].push(date);
        }
    });

    console.log('\n형식별 개수:');
    Object.entries(formatCounts).forEach(([format, count]) => {
        console.log(`  ${format}: ${count}건`);
        if (samples[format] && samples[format].length > 0) {
            console.log(`    예시: ${samples[format].join(', ')}`);
        }
    });

    process.exit(0);
}

checkDateFormats();
