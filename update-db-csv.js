const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchSchema() {
    console.log('🔍 Supabase 스키마 조회 중...');

    try {
        // SQL 쿼리로 스키마 정보 조회
        const { data, error } = await supabase
            .from('information_schema.columns')
            .select('table_name, column_name, data_type')
            .eq('table_schema', 'public')
            .order('table_name', { ascending: true })
            .order('ordinal_position', { ascending: true });

        if (error) {
            console.error('❌ 스키마 조회 실패:', error);
            console.log('\n📋 대신 모든 테이블 목록 조회...');

            // 각 테이블별로 조회
            const tables = [
                'airport', 'airport_price', 'business_notifications', 'car', 'car_price',
                'confirmation_status', 'cruise', 'cruise_info', 'cruise_location',
                'customer_notifications', 'customer_request_attachments', 'customer_request_history',
                'customer_requests', 'dispatcher_users', 'exchange_rates', 'hotel', 'hotel_price',
                'manager_reservations', 'notification_reads', 'notification_templates', 'notifications',
                'payment_info', 'payment_notifications', 'quote', 'quote_item', 'rent_price', 'rentcar',
                'reservation', 'reservation_airport', 'reservation_car_sht', 'reservation_confirmation',
                'reservation_cruise', 'reservation_cruise_car', 'reservation_hotel', 'reservation_payment',
                'reservation_payments', 'reservation_rentcar', 'reservation_tour', 'room', 'room_price',
                'tour', 'tour_price', 'users'
            ];

            const allColumns = [];

            for (const tableName of tables) {
                console.log(`  📊 ${tableName} 조회 중...`);
                const { data: tableData, error: tableError } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(0);

                if (!tableError && tableData !== null) {
                    // 테이블 구조만 확인
                    const { data: sampleRow } = await supabase
                        .from(tableName)
                        .select('*')
                        .limit(1)
                        .maybeSingle();

                    if (sampleRow) {
                        Object.keys(sampleRow).forEach(columnName => {
                            const value = sampleRow[columnName];
                            let dataType = 'text';

                            if (value === null) {
                                dataType = 'text';
                            } else if (typeof value === 'number') {
                                dataType = Number.isInteger(value) ? 'integer' : 'numeric';
                            } else if (typeof value === 'boolean') {
                                dataType = 'boolean';
                            } else if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
                                dataType = 'timestamp with time zone';
                            } else if (typeof value === 'object' && value !== null) {
                                dataType = 'jsonb';
                            } else if (Array.isArray(value)) {
                                dataType = 'ARRAY';
                            }

                            allColumns.push({
                                table_name: tableName,
                                column_name: columnName,
                                data_type: dataType
                            });
                        });
                    } else {
                        console.log(`  ⚠️ ${tableName} - 데이터 없음, 기존 구조 유지`);
                    }
                }
            }

            if (allColumns.length > 0) {
                const csv = 'table_name,column_name,data_type\n' +
                    allColumns.map(row => `${row.table_name},${row.column_name},${row.data_type}`).join('\n');

                fs.writeFileSync('sql/db.csv', csv, 'utf-8');
                console.log(`\n✅ db.csv 파일 업데이트 완료! (${allColumns.length}개 컬럼)`);
            }

            return;
        }

        console.log('✅ 스키마 조회 성공:', data.length, '개 컬럼');

        // CSV 생성
        const csv = 'table_name,column_name,data_type\n' +
            data.map(row => `${row.table_name},${row.column_name},${row.data_type}`).join('\n');

        fs.writeFileSync('sql/db.csv', csv, 'utf-8');
        console.log('💾 db.csv 파일 업데이트 완료!');

    } catch (err) {
        console.error('❌ 오류 발생:', err);
    }
}

fetchSchema().catch(console.error);
