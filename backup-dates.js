const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const tableConfigs = [
    { table: 'sh_r', columns: ['checkin_date'] },
    { table: 'sh_c', columns: ['boarding_datetime'] },
    { table: 'sh_cc', columns: ['boarding_date'] },
    { table: 'sh_p', columns: ['date'] },
    { table: 'sh_h', columns: ['checkin_date'] },
    { table: 'sh_t', columns: ['start_date'] },
    { table: 'sh_rc', columns: ['boarding_date'] }
];

async function backupTable(tableName, columns) {
    console.log(`📦 백업 중: ${tableName}...`);

    const selectColumns = ['id', ...columns].join(', ');
    const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns);

    if (error) {
        console.error(`❌ ${tableName} 백업 실패:`, error);
        return;
    }

    const backupData = {
        table: tableName,
        columns: columns,
        timestamp: new Date().toISOString(),
        rowCount: data.length,
        data: data
    };

    const filename = `backup_${tableName}_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));

    console.log(`  ✅ 저장: ${filename} (${data.length}건)`);
    return filename;
}

async function main() {
    console.log('🔒 날짜 데이터 백업 시작\n');

    const backupFiles = [];

    for (const config of tableConfigs) {
        const filename = await backupTable(config.table, config.columns);
        if (filename) {
            backupFiles.push(filename);
        }
    }

    console.log('\n✅ 전체 백업 완료!');
    console.log(`📂 백업 파일 목록:`);
    backupFiles.forEach(file => console.log(`  - ${file}`));

    process.exit(0);
}

main();
