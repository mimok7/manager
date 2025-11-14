const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRLS() {
    console.log('🔍 RLS 정책 및 데이터 접근 확인\n');

    const tables = ['sh_r', 'sh_c', 'sh_cc', 'sh_p', 'sh_h', 'sh_t', 'sh_rc', 'sh_m'];

    for (const table of tables) {
        console.log(`\n📋 테이블: ${table}`);

        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: false })
            .limit(5);

        if (error) {
            console.log(`  ❌ 조회 실패: ${error.message}`);
            console.log(`     Code: ${error.code}`);
            console.log(`     Details: ${error.details}`);
            console.log(`     Hint: ${error.hint}`);
        } else {
            console.log(`  ✅ 조회 성공: ${data?.length || 0}건 조회됨`);
            if (count !== null) {
                console.log(`     전체: ${count}건`);
            }
            if (data && data.length > 0) {
                const sampleKeys = Object.keys(data[0]).slice(0, 5).join(', ');
                console.log(`     컬럼 샘플: ${sampleKeys}`);
            }
        }
    }

    // 인증 상태 확인
    console.log('\n🔐 인증 상태 확인:');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.log('  ❌ 인증 오류:', authError.message);
    } else if (!user) {
        console.log('  ⚠️  미인증 상태 (익명 접근)');
        console.log('     → RLS 정책에서 anon 키로 접근 허용해야 함');
    } else {
        console.log('  ✅ 인증됨:', user.email);
        console.log('     User ID:', user.id);
    }

    process.exit(0);
}

checkRLS();
