# 스테이하롱 크루즈 - 관리자 시스템 (Manager)

## 프로젝트 개요
스테이하롱 크루즈 관리자 시스템입니다. 견적 승인, 예약 관리, 결제 처리, 배차 관리 등 실무 운영에 필요한 모든 기능을 제공합니다.

## 주요 기능
- ✅ 견적 승인 및 관리
- ✅ 예약 현황 조회 및 수정
- ✅ 결제 관리 (입금 확인, 환불 처리)
- ✅ 배차 관리 (공항/크루즈/렌터카/차량)
- ✅ 예약 일정 캘린더
- ✅ 통계 분석 대시보드
- ✅ 사용자 관리
- ✅ 알림 관리
- ✅ 예약확인서 생성

## 기술 스택
- **Framework**: Next.js 15.3.5 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4.17
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **UI Components**: React 19

## 사용자 권한
- **admin** (관리자): 시스템 전체 관리, 모든 기능 접근
- **manager** (매니저): 견적 승인, 예약 관리, 결제 처리
- **dispatcher** (배차 담당자): 배차 관리 전용

## 프로젝트 구조
```
sht-manager/
├── app/
│   ├── page.tsx              # 메인 페이지 (관리자 전용)
│   ├── login/                # 로그인
│   ├── admin/                # 관리자 전용
│   │   ├── quotes/          # 견적 관리
│   │   ├── users/           # 사용자 관리
│   │   └── sql-runner/      # SQL 실행 도구
│   ├── manager/              # 매니저 페이지
│   │   ├── analytics/       # 통계 분석
│   │   ├── quotes/          # 견적 관리
│   │   ├── reservations/    # 예약 관리
│   │   ├── payments/        # 결제 관리
│   │   ├── schedule/        # 예약 일정
│   │   ├── dispatch/        # 배차 관리
│   │   └── notifications/   # 알림 관리
│   ├── dispatch/             # 배차 담당자 페이지
│   └── customer/             # 고객 관련 (발송 관리 등)
├── components/               # 공용 컴포넌트
│   ├── AdminLayout.tsx      # 관리자 레이아웃
│   ├── ManagerLayout.tsx    # 매니저 레이아웃
│   ├── ManagerSidebar.tsx   # 매니저 사이드바
│   └── ...
├── lib/                      # 유틸리티 및 비즈니스 로직
│   ├── supabase.ts          # Supabase 클라이언트
│   └── ...
└── sql/                      # 데이터베이스 스키마 정보
    └── db.csv               # 테이블 구조 정의
```

## 환경 설정
1. `.env.local` 파일 생성
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. 의존성 설치
```bash
npm install
```

3. 개발 서버 실행
```bash
npm run dev
# 또는 포트 변경
$env:PORT=3001; npm run dev
```

4. 브라우저에서 접속
```
http://localhost:3001
```

## 배포
- **Domain**: admin.stayhalong.com
- **Platform**: Vercel / Railway
- **Port**: 3001 (개발), 80/443 (프로덕션)

## 데이터베이스
- **Provider**: Supabase PostgreSQL
- **Connection**: 고객 시스템과 동일한 데이터베이스 사용
- **RLS Policy**: 
  - 관리자 권한 필수
  - 역할별 접근 제어 (admin > manager > dispatcher)

## 주요 개발 패턴
### 권한 검사
```typescript
// 관리자 권한 확인
const { data: userData } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();

if (!['admin', 'manager', 'dispatcher'].includes(userData.role)) {
  alert('접근 권한이 없습니다.');
  router.push('/login');
  return;
}
```

### 예약 관리 패턴
```typescript
// 예약 상태 업데이트
const { error } = await supabase
  .from('reservation')
  .update({ 
    re_status: 'confirmed',
    updated_at: new Date().toISOString()
  })
  .eq('re_id', reservationId);

// 결제 정보 기록
await supabase.from('payment').insert({
  reservation_id: reservationId,
  amount: totalAmount,
  payment_method: 'bank_transfer',
  status: 'completed'
});
```

### 통계 조회 패턴
```typescript
// RPC 함수 호출 (성능 최적화)
const { data: stats } = await supabase
  .rpc('get_analytics_data', {
    start_date: '2025-01-01',
    end_date: '2025-12-31'
  });
```

## 핵심 기능
### 1. 견적 관리 (`/manager/quotes`)
- 견적 목록 조회 (필터링, 검색)
- 견적 상세보기
- 견적 승인/거부
- 크루즈 견적 직접 생성

### 2. 예약 관리 (`/manager/reservations`)
- 예약 목록 조회
- 예약 상세 정보
- 예약 수정
- 일괄 처리

### 3. 결제 관리 (`/manager/payments`)
- 입금 확인
- 결제 내역 조회
- 환불 처리
- 결제 통계

### 4. 배차 관리 (`/manager/dispatch`)
- 공항 서비스 배차
- 크루즈 차량 배차
- 렌터카 배차
- 스하 차량 배차

### 5. 예약 일정 (`/manager/schedule`)
- 캘린더 뷰
- 일별/월별 예약 현황
- 신규/구 예약 구분
- 일정 필터링

### 6. 통계 분석 (`/manager/analytics`)
- 예약 추이 그래프
- 매출 통계
- 서비스별 분석
- 월별 리포트

## 레이아웃 컴포넌트
### ManagerLayout
```tsx
<ManagerLayout title="페이지 제목" activeTab="menu-key">
  {/* 컨텐츠 */}
</ManagerLayout>
```
- 사이드바 자동 생성
- 권한 체크 내장
- 로그아웃 기능 포함

### AdminLayout
```tsx
<AdminLayout title="관리자 페이지" activeTab="admin-menu">
  {/* 관리자 전용 컨텐츠 */}
</AdminLayout>
```

## 스크립트
- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm run start` - 프로덕션 서버 실행
- `npm run lint` - ESLint 검사
- `npm run lint:fix` - ESLint 자동 수정

## 성능 최적화
- **모듈 수**: ~500-700개 (고객 시스템 분리 후)
- **로딩 시간**: 1-3초 (기존 3-8초에서 50-70% 개선)
- **번들 크기**: 관리자 전용 코드만 포함

## 보안
- RLS(Row Level Security) 정책 적용
- 역할 기반 접근 제어 (RBAC)
- Supabase Auth 통합
- 관리자 권한 없으면 자동 로그아웃

## 관련 프로젝트
- **고객 시스템**: `sht-customer` (reservation.stayhalong.com)
  - 견적 조회, 예약 생성
  - 일반 고객 전용

## 문의
- 개발팀: tech@stayhalong.com
- 버전: 1.0.0 (Manager Edition)
- 최종 업데이트: 2025.10.29
