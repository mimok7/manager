-- SH_M 테이블 생성
DROP TABLE IF EXISTS sh_m;
CREATE TABLE sh_m (
    id SERIAL PRIMARY KEY,
    order_id TEXT,
    reservation_date TEXT,
    email TEXT,
    korean_name TEXT,
    english_name TEXT,
    nickname TEXT,
    member_grade TEXT,
    name TEXT,
    phone TEXT,
    creator TEXT,
    created_at TEXT,
    exchange_rate TEXT,
    usd_rate TEXT,
    url TEXT,
    plan TEXT,
    payment_method TEXT,
    request_note TEXT,
    kakao_id TEXT,
    special_note TEXT,
    birth_date TEXT,
    memo TEXT,
    discount_amount TEXT,
    discount_code TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_m_order_id ON sh_m(order_id);

-- SH_R 테이블 생성
DROP TABLE IF EXISTS sh_r;
CREATE TABLE sh_r (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    cruise_name TEXT,
    division TEXT,
    room_type TEXT,
    room_count TEXT,
    room_code TEXT,
    schedule_days TEXT,
    room_discount TEXT,
    checkin_date TEXT,
    time TEXT,
    adult TEXT,
    child TEXT,
    toddler TEXT,
    boarding_count TEXT,
    guest_count TEXT,
    modifier TEXT,
    modified_at TEXT,
    boarding_help TEXT,
    discount_code TEXT,
    room_note TEXT,
    processed TEXT,
    processed_at TEXT,
    boat TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    unit TEXT,
    connecting_room TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_r_order_id ON sh_r(order_id);

-- SH_C 테이블 생성
DROP TABLE IF EXISTS sh_c;
CREATE TABLE sh_c (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    division TEXT,
    category TEXT,
    cruise_name TEXT,
    vehicle_type TEXT,
    vehicle_code TEXT,
    vehicle_count TEXT,
    passenger_count TEXT,
    boarding_datetime TEXT,
    boarding_location TEXT,
    dropoff_location TEXT,
    modifier TEXT,
    modified_at TEXT,
    quantity TEXT,
    processed TEXT,
    processed_at TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    unit TEXT,
    migrated TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_c_order_id ON sh_c(order_id);

-- SH_CC 테이블 생성
DROP TABLE IF EXISTS sh_cc;
CREATE TABLE sh_cc (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    boarding_date TEXT,
    division TEXT,
    category TEXT,
    vehicle_number TEXT,
    seat_number TEXT,
    name TEXT,
    modifier TEXT,
    modified_at TEXT,
    email TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_cc_order_id ON sh_cc(order_id);

-- SH_P 테이블 생성
DROP TABLE IF EXISTS sh_p;
CREATE TABLE sh_p (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    division TEXT,
    category TEXT,
    route TEXT,
    vehicle_code TEXT,
    vehicle_type TEXT,
    date TEXT,
    time TEXT,
    airport_name TEXT,
    flight_number TEXT,
    passenger_count TEXT,
    carrier_count TEXT,
    location_name TEXT,
    stopover TEXT,
    stopover_wait_time TEXT,
    vehicle_count TEXT,
    modifier TEXT,
    modified_at TEXT,
    processed TEXT,
    processed_at TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    fast_service TEXT,
    unit TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_p_order_id ON sh_p(order_id);

-- SH_H 테이블 생성
DROP TABLE IF EXISTS sh_h;
CREATE TABLE sh_h (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    hotel_code TEXT,
    hotel_name TEXT,
    room_name TEXT,
    room_type TEXT,
    room_count TEXT,
    schedule TEXT,
    checkin_date TEXT,
    checkout_date TEXT,
    breakfast_service TEXT,
    adult TEXT,
    child TEXT,
    toddler TEXT,
    extra_bed TEXT,
    guest_count TEXT,
    modifier TEXT,
    modified_at TEXT,
    processed TEXT,
    processed_at TEXT,
    note TEXT,
    discount_amount TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_h_order_id ON sh_h(order_id);

-- SH_T 테이블 생성
DROP TABLE IF EXISTS sh_t;
CREATE TABLE sh_t (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    tour_code TEXT,
    tour_name TEXT,
    tour_type TEXT,
    detail_category TEXT,
    quantity TEXT,
    start_date TEXT,
    end_date TEXT,
    tour_count TEXT,
    dispatch TEXT,
    pickup_location TEXT,
    dropoff_location TEXT,
    modifier TEXT,
    modified_at TEXT,
    memo TEXT,
    processed TEXT,
    processed_at TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    tour_note TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_t_order_id ON sh_t(order_id);

-- SH_RC 테이블 생성
DROP TABLE IF EXISTS sh_rc;
CREATE TABLE sh_rc (
    id SERIAL PRIMARY KEY,
    sheet_id TEXT,
    order_id TEXT,
    vehicle_code TEXT,
    division TEXT,
    category TEXT,
    route TEXT,
    vehicle_type TEXT,
    vehicle_count TEXT,
    boarding_date TEXT,
    boarding_time TEXT,
    boarding_location TEXT,
    carrier_count TEXT,
    destination TEXT,
    stopover TEXT,
    passenger_count TEXT,
    usage_period TEXT,
    modifier TEXT,
    modified_at TEXT,
    memo TEXT,
    processed TEXT,
    processed_at TEXT,
    amount TEXT,
    total TEXT,
    email TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sh_rc_order_id ON sh_rc(order_id);