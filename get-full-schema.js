const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getFullSchema() {
    console.log('🔍 Supabase 전체 스키마 조회 중...');

    // SQL 쿼리 실행
    const query = `
    SELECT 
      table_name,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;

    try {
        // Supabase RPC로 실행 시도
        const { data, error } = await supabase.rpc('exec_sql', { sql: query });

        if (error) {
            console.log('⚠️ RPC 실행 실패:', error.message);
            console.log('💡 Supabase Dashboard의 SQL Editor에서 다음 쿼리를 실행하세요:');
            console.log('\n' + query + '\n');
            console.log('그리고 결과를 CSV로 다운로드하여 sql/db.csv에 저장하세요.');
            return;
        }

        console.log('✅ 스키마 조회 성공:', data.length, '개 컬럼');

        // CSV 생성
        const csv = 'table_name,column_name,data_type\n' +
            data.map(row => `${row.table_name},${row.column_name},${row.data_type}`).join('\n');

        fs.writeFileSync('sql/db.csv', csv, 'utf-8');
        console.log('💾 db.csv 파일 업데이트 완료!');

    } catch (err) {
        console.error('❌ 오류:', err);
    }
}

getFullSchema();
