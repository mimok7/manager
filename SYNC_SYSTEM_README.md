# 구글 시트 → Supabase 동기화 시스템

## 📋 개요
구글 시트(Google Sheets)의 SH_* 시트 데이터를 Supabase PostgreSQL 데이터베이스로 자동 동기화하는 시스템입니다.

## 🎯 주요 기능
- ✅ SH_M (사용자/고객 정보) 동기화
- ✅ SH_R (크루즈 예약) 동기화
- ✅ SH_C (차량 예약) 동기화
- ✅ SH_CC (스하차량/사파) 동기화
- ✅ SH_P (공항 서비스) 동기화
- ✅ SH_H (호텔 예약) 동기화
- ✅ SH_T (투어 예약) 동기화
- ✅ SH_RC (렌터카 예약) 동기화
- 🔄 실시간 동기화 (수동 트리거)
- 📊 동기화 상태 대시보드
- 🔧 테이블 자동 생성 SQL

## 🚀 설치 및 설정

### 1. 환경 변수 설정
`.env.local` 파일에 다음 변수들이 설정되어 있어야 합니다:

```env
# Google Sheets API
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@email.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase 테이블 생성

#### 방법 1: UI에서 SQL 생성 및 실행
1. `/manager/sync` 페이지 접속
2. "테이블 생성 SQL 생성" 버튼 클릭
3. 생성된 SQL 복사
4. Supabase Dashboard → SQL Editor로 이동
5. SQL 붙여넣기 후 실행

#### 방법 2: API로 SQL 가져오기
```bash
curl http://localhost:3000/api/sync/google-to-supabase?action=generate-sql
```

### 3. 테이블 구조

각 테이블은 다음과 같은 기본 구조를 가집니다:

```sql
CREATE TABLE sh_m (
    id SERIAL PRIMARY KEY,
    order_id TEXT,
    reservation_date TEXT,
    korean_name TEXT,
    english_name TEXT,
    phone TEXT,
    email TEXT,
    payment_amount TEXT,
    payment_status TEXT,
    request_note TEXT,
    status TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sh_m_order_id ON sh_m(order_id);
```

## 📖 사용 방법

### 웹 UI 사용

1. **매니저 페이지 접속**
   ```
   /manager/sync
   ```

2. **전체 동기화**
   - "전체 동기화 시작" 버튼 클릭
   - 모든 SH_* 시트가 한 번에 동기화됩니다

3. **개별 시트 동기화**
   - 각 시트 카드의 "개별 동기화" 버튼 클릭
   - 선택한 시트만 동기화됩니다

4. **동기화 결과 확인**
   - 각 카드에 동기화 상태 표시
   - ✅ 성공 / ❌ 실패
   - 원본 데이터 수, 유효 데이터 수, 동기화된 데이터 수 표시

### API 사용

#### 전체 동기화
```bash
curl http://localhost:3000/api/sync/google-to-supabase?action=sync
```

#### 특정 시트만 동기화
```bash
curl http://localhost:3000/api/sync/google-to-supabase?action=sync&sheet=SH_M
```

#### SQL 생성
```bash
curl http://localhost:3000/api/sync/google-to-supabase?action=generate-sql
```

## 🔄 자동화 설정

### Vercel Cron Job 설정

`vercel.json` 파일에 추가:

```json
{
  "crons": [
    {
      "path": "/api/sync/google-to-supabase?action=sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

이렇게 하면 6시간마다 자동으로 동기화됩니다.

### 수동 트리거 (GitHub Actions 등)

```yaml
name: Sync Google Sheets
on:
  schedule:
    - cron: '0 */6 * * *'  # 6시간마다
  workflow_dispatch:  # 수동 실행

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST https://your-domain.com/api/sync/google-to-supabase?action=sync
```

## 📊 데이터 매핑

### SH_M (사용자/고객 정보)
| Google Sheets 열 | Supabase 컬럼 | 설명 |
|------------------|--------------|------|
| A | order_id | 주문ID |
| B | reservation_date | 예약일 |
| C | nickname | 닉네임 |
| D | korean_name | 한글이름 |
| E | english_name | 영문이름 |
| F | passport_number | 여권번호 |
| I | phone | 핸드폰 |
| J | email | 이메일 |
| M | payment_amount | 결제금액 |
| N | payment_status | 결제상태 |
| R | request_note | 요청사항 |

### SH_R (크루즈 예약)
| Google Sheets 열 | Supabase 컬럼 | 설명 |
|------------------|--------------|------|
| A | order_id | 주문ID |
| B | cruise_name | 크루즈명 |
| C | room_type | 객실타입 |
| D | checkin_date | 체크인 |
| E | checkout_date | 체크아웃 |
| G | guest_count | 인원 |
| H | room_price | 객실가격 |

### 기타 시트
- `SH_C`: 차량 예약
- `SH_CC`: 스하차량/사파
- `SH_P`: 공항 서비스
- `SH_H`: 호텔 예약
- `SH_T`: 투어 예약
- `SH_RC`: 렌터카 예약

## ⚠️ 주의 사항

1. **데이터 덮어쓰기**
   - 동기화 시 기존 데이터는 삭제되고 최신 데이터로 대체됩니다
   - 중요한 데이터는 백업하세요

2. **권한 관리**
   - Google Service Account에 시트 읽기 권한이 있어야 합니다
   - Supabase RLS 정책을 적절히 설정하세요

3. **데이터 검증**
   - `order_id`가 없는 행은 동기화되지 않습니다
   - 빈 값(null, 빈 문자열)은 저장되지 않습니다

4. **성능**
   - 대량 데이터(수천 건 이상) 동기화 시 시간이 소요될 수 있습니다
   - API 타임아웃 설정 확인 필요

## 🐛 트러블슈팅

### 동기화 실패
```
❌ 테이블이 존재하지 않습니다
```
→ SQL 생성 후 Supabase에서 테이블을 먼저 생성하세요

### 권한 오류
```
❌ Google Sheets API 권한 오류
```
→ Service Account 이메일을 시트 편집자로 추가하세요

### 데이터 누락
```
⚠️ 유효 데이터가 원본보다 적습니다
```
→ `order_id`가 없는 행이 있는지 확인하세요

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 환경 변수가 올바르게 설정되었는지
2. Google Sheets 시트명이 정확한지 (SH_M, SH_R 등)
3. Supabase 테이블이 생성되었는지
4. 네트워크 연결 상태

## 📝 변경 이력

### v1.0.0 (2025-01-14)
- ✅ 초기 버전 출시
- ✅ 8개 시트 동기화 지원
- ✅ 웹 UI 대시보드
- ✅ API 엔드포인트
- ✅ 자동 SQL 생성
