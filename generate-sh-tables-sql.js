require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_ID 환경변수가 설정되지 않았습니다.');
    process.exit(1);
}

async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            type: 'service_account',
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
}

const SHEET_MAPPINGS = {
    'SH_M': 'sh_m',
    'SH_R': 'sh_r',
    'SH_C': 'sh_c',
    'SH_CC': 'sh_cc',
    'SH_P': 'sh_p',
    'SH_H': 'sh_h',
    'SH_T': 'sh_t',
    'SH_RC': 'sh_rc',
};

async function fetchSheetHeaders(sheets, sheetName) {
    try {
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!1:1`,
        });
        const headers = headerResponse.data.values?.[0] || [];

        // 전체 행 수 확인 (샘플 데이터로 확인)
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!2:999999`,
        });
        const totalRows = dataResponse.data.values?.length || 0;
        console.log(`   📊 총 ${totalRows}건의 데이터 발견`);

        return headers;
    } catch (error) {
        console.error(`❌ ${sheetName} 헤더 가져오기 실패:`, error.message);
        return [];
    }
}

function sanitizeColumnName(header, index) {
    if (!header || header.trim() === '') {
        return `col_${index}`;
    }

    const koreanMap = {
        '주문id': 'order_id',
        'id': 'sheet_id',
        'email': 'email',
        'adult': 'adult',
        'child': 'child',
        'toddler': 'toddler',
        'toodler': 'toddler',
        '예약일': 'reservation_date',
        '닉네임': 'nickname',
        '한글이름': 'korean_name',
        '영문이름': 'english_name',
        '여권번호': 'passport_number',
        '생년월일': 'birth_date',
        '성별': 'gender',
        '핸드폰': 'phone',
        '전화번호': 'phone',
        '이메일': 'email',
        '주소': 'address',
        '결제방법': 'payment_method',
        '결제방식': 'payment_method',
        '결제금액': 'payment_amount',
        '결제상태': 'payment_status',
        '입금액': 'deposit_amount',
        '잔금': 'balance_amount',
        '결제일': 'payment_date',
        '요청사항': 'request_note',
        '특이사항': 'special_note',
        '메모': 'memo',
        '상태': 'status',
        '크루즈': 'cruise_name',
        '크루즈명': 'cruise_name',
        '구분': 'division',
        '분류': 'category',
        '객실타입': 'room_type',
        '객실종류': 'room_type',
        '객실수': 'room_count',
        '체크인': 'checkin_date',
        '체크인날짜': 'checkin_date',
        '체크아웃': 'checkout_date',
        '체크아웃날짜': 'checkout_date',
        '박수': 'nights',
        '일정일수': 'schedule_days',
        '일정': 'schedule',
        '인원': 'guest_count',
        '인원수': 'guest_count',
        '성인인원': 'adult_count',
        '아동인원': 'child_count',
        '어린이인원': 'child_count',
        '투어인원': 'tour_count',
        '투숙인원': 'guest_count',
        '승선인원': 'boarding_count',
        '가격': 'price',
        '총금액': 'total_price',
        '금액': 'amount',
        '합계': 'total',
        '할인금액': 'discount_amount',
        '할인액': 'discount_amount',
        '할인코드': 'discount_code',
        '이용일': 'usage_date',
        '날짜': 'date',
        '일자': 'date',
        '시작일자': 'start_date',
        '종료일자': 'end_date',
        '승차일': 'boarding_date',
        '승차일자': 'boarding_date',
        '승차일시': 'boarding_datetime',
        '차량타입': 'vehicle_type',
        '차량': 'vehicle_type',
        '차량종류': 'vehicle_type',
        '차량수': 'vehicle_count',
        '차량대수': 'vehicle_count',
        '차량번호': 'vehicle_number',
        '차량코드': 'vehicle_code',
        '객실코드': 'room_code',
        '호텔코드': 'hotel_code',
        '투어코드': 'tour_code',
        '좌석번호': 'seat_number',
        '승차인원': 'passenger_count',
        '출발지': 'departure',
        '목적지': 'destination',
        '경로': 'route',
        '픽업': 'pickup_location',
        '픽업위치': 'pickup_location',
        '하차': 'dropoff_location',
        '하차위치': 'dropoff_location',
        '드랍위치': 'dropoff_location',
        '승차위치': 'boarding_location',
        '승차장소': 'boarding_location',
        '장소명': 'location_name',
        '시간': 'time',
        '승차시간': 'boarding_time',
        '승객수': 'passenger_count',
        '항공일': 'flight_date',
        '항공편': 'flight_number',
        '공항': 'airport_name',
        '공항명': 'airport_name',
        '호텔': 'hotel_name',
        '호텔명': 'hotel_name',
        '객실명': 'room_name',
        '투어': 'tour_name',
        '투어명': 'tour_name',
        '투어종류': 'tour_type',
        '수량': 'quantity',
        '상세구분': 'detail_category',
        '참가자': 'participant_count',
        '회원등급': 'member_grade',
        '이름': 'name',
        '만든사람': 'creator',
        '만든일시': 'created_at',
        '수정자': 'modifier',
        '수정일시': 'modified_at',
        '객실할인': 'room_discount',
        '비고': 'note',
        '객실비고': 'room_note',
        '투어비고': 'tour_note',
        '처리': 'processed',
        '처리일시': 'processed_at',
        '환율': 'exchange_rate',
        '미환율': 'usd_rate',
        'url': 'url',
        '요금제': 'plan',
        '카톡id': 'kakao_id',
        '단위': 'unit',
        '이관': 'migrated',
        '캐리어수량': 'carrier_count',
        '캐리어갯수': 'carrier_count',
        '경유지': 'stopover',
        '경유지대기시간': 'stopover_wait_time',
        '패스트': 'fast_service',
        '조식서비스': 'breakfast_service',
        '엑스트라베드': 'extra_bed',
        '배차': 'dispatch',
        '사용기간': 'usage_period',
        '보트': 'boat',
        '커넥팅룸': 'connecting_room',
        '승선도움': 'boarding_help',
    };

    const clean = header.trim().toLowerCase();
    if (koreanMap[clean]) return koreanMap[clean];

    let name = clean
        .replace(/[^a-z0-9가-힣\s]/g, '')
        .replace(/\s+/g, '_');

    if (/^\d/.test(name)) name = 'col_' + name;
    if (name.length > 63) name = name.substring(0, 63);

    return name || `col_${index}`;
}

function generateSQL(tableName, columnNames) {
    const columns = columnNames.map(col => `    ${col} TEXT`);

    return `
-- ${tableName.toUpperCase()} 테이블 생성
DROP TABLE IF EXISTS ${tableName};
CREATE TABLE ${tableName} (
    id SERIAL PRIMARY KEY,
${columns.join(',\n')},
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_${tableName}_order_id ON ${tableName}(order_id);
`.trim();
}

async function main() {
    console.log('🔍 구글시트 헤더 분석 및 SQL 생성 시작...\n');

    const sheets = await getGoogleSheetsClient();
    const sqlStatements = [];

    for (const [sheetName, tableName] of Object.entries(SHEET_MAPPINGS)) {
        console.log(`📋 ${sheetName} → ${tableName} 분석 중...`);

        const headers = await fetchSheetHeaders(sheets, sheetName);
        console.log(`   원본 헤더 (${headers.length}개):`, headers.join(', '));

        const columnNames = headers.map((h, i) => sanitizeColumnName(h, i));
        console.log(`   변환된 컬럼 (${columnNames.length}개):`, columnNames.join(', '));

        const sql = generateSQL(tableName, columnNames);
        sqlStatements.push(sql);
        console.log(`   ✅ SQL 생성 완료\n`);
    }

    const fullSQL = sqlStatements.join('\n\n');

    fs.writeFileSync('create-sh-tables.sql', fullSQL);
    console.log('✅ create-sh-tables.sql 파일 생성 완료!');
    console.log('\n📄 생성된 SQL:\n');
    console.log(fullSQL);
}

main().catch(console.error);
