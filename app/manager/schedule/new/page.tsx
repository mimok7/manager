'use client';

import React, { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import ReservationDetailModal from '../../../../components/ReservationDetailModal';
import {
  Calendar,
  Clock,
  Ship,
  Plane,
  Building,
  MapPin,
  Car,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SHCReservation {
  orderId: string;
  customerName: string; // SH_M에서 조회한 한글이름
  customerEnglishName?: string; // SH_M에서 조회한 영문이름
  carType: string;
  carCode: string;
  carCount: number;
  passengerCount: number;
  pickupDatetime: string;
  pickupLocation: string;
  dropoffLocation: string;
  unitPrice: number;
  totalPrice: number;
  email: string;
}

interface SHRReservation {
  orderId: string;
  customerName: string; // SH_M에서 조회한 한글이름
  customerEnglishName?: string; // SH_M에서 조회한 영문이름
  cruise: string;
  category: string;
  roomType: string;
  roomCount: number;
  roomCode: string;
  days: number;
  discount: string;
  checkin: string;
  time: string;
  adult: number;
  child: number;
  toddler: number;
  boardingInfo: string;
  totalGuests: number;
  boardingHelp: string;
  discountCode: string;
  note: string;
  requestNote?: string; // 요청사항/특이사항/메모
}

// 스하차량 (SH_CC)
interface SHCCReservation {
  orderId: string;
  customerName: string;
  customerEnglishName?: string;
  cruiseInfo?: string; // SH_R에서 조회한 크루즈명 (C열)
  boardingDate: string; // C열: 승차일
  serviceType: string; // D열: 구분
  category: string; // E열: 분류
  vehicleNumber: string; // F열: 차량번호
  seatNumber: string; // G열: 좌석번호
  name: string; // H열: 이름
  pickupLocation?: string; // L열: 승차위치
  dropoffLocation?: string; // M열: 하차위치
  email: string;
}

// 공항 (SH_P)
interface SHPReservation {
  orderId: string;
  customerName: string;
  customerEnglishName?: string;
  tripType: string; // C열: 구분
  category: string; // D열: 분류
  route: string; // E열: 경로
  carCode: string;
  carType: string;
  date: string; // H열: 일자
  time: string;
  airportName: string;
  flightNumber: string;
  passengerCount: number;
  carrierCount: number;
  placeName: string;
  stopover: string;
  carCount: number;
  unitPrice: number;
  totalPrice: number;
  email: string;
}

// 호텔 (SH_H)
interface SHHReservation {
  orderId: string;
  customerName: string;
  customerEnglishName?: string;
  hotelCode: string;
  hotelName: string;
  roomName: string;
  roomType: string;
  roomCount: number;
  days: number;
  checkinDate: string; // I열: 체크인날짜
  checkoutDate: string;
  breakfastService: string;
  adult: number;
  child: number;
  toddler: number;
  extraBed: number;
  totalGuests: number;
  note: string;
  unitPrice: number;
  totalPrice: number;
  email: string;
}

// 투어 (SH_T)
interface SHTReservation {
  orderId: string;
  customerName: string;
  customerEnglishName?: string;
  tourCode: string;
  tourName: string;
  tourType: string;
  detailCategory: string;
  quantity: number;
  startDate: string; // H열: 시작일자
  endDate: string;
  participants: number;
  dispatch: string;
  pickupLocation: string;
  dropoffLocation: string;
  memo: string;
  unitPrice: number;
  totalPrice: number;
  email: string;
  tourNote: string;
}

// 렌트카 (SH_RC)
interface SHRCReservation {
  orderId: string;
  customerName: string;
  customerEnglishName?: string;
  carCode: string;
  tripType: string;
  category: string;
  route: string;
  carType: string;
  carCount: number;
  pickupDate: string; // I열: 승차일자
  pickupTime: string;
  pickupLocation: string;
  carrierCount: number;
  destination: string;
  stopover: string;
  passengerCount: number;
  usagePeriod: string;
  memo: string;
  unitPrice: number;
  totalPrice: number;
  email: string;
}

export default function ManagerSchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // 오늘 날짜로 초기화
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  // 주/월간 보기에서 일별 그룹화 추가 (기본: 일별)
  const [groupMode, setGroupMode] = useState<'type' | 'day'>('day');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Google Sheets 데이터
  const [googleSheetsData, setGoogleSheetsData] = useState<any[]>([]);
  const [googleSheetsLoading, setGoogleSheetsLoading] = useState(true);
  const [googleSheetsError, setGoogleSheetsError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, [selectedDate, viewMode]);

  useEffect(() => {
    loadGoogleSheetsData();
  }, [typeFilter]);

  const getRange = (base: Date, mode: 'day' | 'week' | 'month') => {
    const start = new Date(base);
    const end = new Date(base);
    if (mode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (mode === 'week') {
      // 주간: 월요일 시작 기준
      const day = start.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // 일요일(0) -> -6, 월(1)->0 ...
      start.setDate(start.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // 월간: 해당 월 1일 ~ 말일
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0); // 다음 달 0일 = 말일
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  };

  const loadGoogleSheetsData = async () => {
    try {
      setGoogleSheetsLoading(true);
      setGoogleSheetsError(null);

      // 'all'일 때는 모든 서비스를 병렬로 조회
      if (typeFilter === 'all') {
        const serviceTypes = ['cruise', 'car', 'vehicle', 'airport', 'hotel', 'tour', 'rentcar'];

        const results = await Promise.all(
          serviceTypes.map(async (type) => {
            try {
              const response = await fetch(`/api/schedule/google-sheets?type=${type}`);
              const contentType = response.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                return [];
              }
              const result = await response.json();
              return result.success ? (result.data || []) : [];
            } catch {
              return [];
            }
          })
        );

        // 모든 서비스 데이터 합치기
        const allData = results.flat();
        setGoogleSheetsData(allData);
      } else {
        // 개별 서비스 타입 조회
        const typeMapping: Record<string, string> = {
          'cruise': 'cruise',
          'car': 'car',
          'sht': 'vehicle',
          'airport': 'airport',
          'hotel': 'hotel',
          'tour': 'tour',
          'rentcar': 'rentcar'
        };

        const apiType = typeMapping[typeFilter] || 'car';

        const response = await fetch(`/api/schedule/google-sheets?type=${apiType}`);

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Google Sheets API가 올바르게 응답하지 않았습니다. (HTML 페이지 반환)');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
        }

        setGoogleSheetsData(result.data || []);
      }
    } catch (err: any) {
      setGoogleSheetsError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setGoogleSheetsLoading(false);
    }
  };

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    try {
      // "YYYY. MM. DD" 형식 처리
      if (dateStr.includes('. ')) {
        const parts = dateStr.split('. ').map(p => p.trim());
        if (parts.length >= 3) {
          const [year, month, day] = parts;
          const dayNum = day.split(' ')[0]; // 시간 부분 제거
          // 로컬 시간대로 Date 객체 생성
          const date = new Date(
            parseInt(year),
            parseInt(month) - 1, // 월은 0부터 시작
            parseInt(dayNum)
          );
          return date;
        }
      }

      // "YYYY-MM-DD" 형식
      if (dateStr.includes('-')) {
        const datePart = dateStr.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        // 로컬 시간대로 Date 객체 생성
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        return date;
      }

      // 기타 형식
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      // 에러 무시
    }

    return null;
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString('ko-KR') + '동';
  };

  const isPastDate = (dateStr: string): boolean => {
    const date = parseDate(dateStr);
    if (!date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date < today;
  };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const { start, end } = getRange(selectedDate, viewMode);

      // 서비스별 날짜 컬럼 기준으로 기간 내 데이터 조회 (배치)
      const [cruiseRes, airportRes, hotelRes, rentcarRes, tourRes, cruiseCarRes, carShtRes] = await Promise.all([
        // cruise: checkin (date)
        supabase
          .from('reservation_cruise')
          .select('*, reservation_id')
          .gte('checkin', start.toISOString().slice(0, 10))
          .lte('checkin', end.toISOString().slice(0, 10)),
        // airport: ra_datetime (timestamp)
        supabase
          .from('reservation_airport')
          .select('*, reservation_id')
          .gte('ra_datetime', start.toISOString())
          .lte('ra_datetime', end.toISOString()),
        // hotel: checkin_date (date)
        supabase
          .from('reservation_hotel')
          .select('*, reservation_id')
          .gte('checkin_date', start.toISOString().slice(0, 10))
          .lte('checkin_date', end.toISOString().slice(0, 10)),
        // rentcar: pickup_datetime (timestamp)
        supabase
          .from('reservation_rentcar')
          .select('*, reservation_id')
          .gte('pickup_datetime', start.toISOString())
          .lte('pickup_datetime', end.toISOString()),
        // tour: usage_date (date) - 없을 수 있음, maybeSingle 대신 범위 조회
        supabase
          .from('reservation_tour')
          .select('*, reservation_id')
          .gte('usage_date', start.toISOString().slice(0, 10))
          .lte('usage_date', end.toISOString().slice(0, 10)),
        // cruise car: pickup_datetime (date)
        supabase
          .from('reservation_cruise_car')
          .select('*, reservation_id')
          .gte('pickup_datetime', start.toISOString().slice(0, 10))
          .lte('pickup_datetime', end.toISOString().slice(0, 10)),
        // car_sht: usage_date (timestamptz)
        supabase
          .from('reservation_car_sht')
          .select('*, reservation_id')
          .gte('usage_date', start.toISOString())
          .lte('usage_date', end.toISOString())
      ]);

      const serviceRows: Array<{ table: string; rows: any[] }> = [
        { table: 'reservation_cruise', rows: cruiseRes.data || [] },
        { table: 'reservation_airport', rows: airportRes.data || [] },
        { table: 'reservation_hotel', rows: hotelRes.data || [] },
        { table: 'reservation_rentcar', rows: rentcarRes.data || [] },
        { table: 'reservation_tour', rows: tourRes.data || [] },
        { table: 'reservation_cruise_car', rows: cruiseCarRes.data || [] },
        { table: 'reservation_car_sht', rows: carShtRes.data || [] }
      ];

      // 크루즈 room_price_code → room_price(cruise, room_type) 매핑 조회
      const cruiseCodes = Array.from(
        new Set((cruiseRes.data || []).map((r: any) => r.room_price_code).filter(Boolean))
      );
      let cruiseInfoByCode = new Map<string, { cruise?: string; room_type?: string; room_category?: string }>();
      if (cruiseCodes.length > 0) {
        const { data: rpData } = await supabase
          .from('room_price')
          .select('room_code, cruise, room_type, room_category')
          .in('room_code', cruiseCodes);
        for (const rp of rpData || []) {
          cruiseInfoByCode.set(rp.room_code, {
            cruise: rp.cruise || undefined,
            room_type: rp.room_type || undefined,
            room_category: rp.room_category || undefined
          });
        }
      }

      // 해당되는 예약 ID들 조회
      const reservationIds = Array.from(
        new Set(
          serviceRows.flatMap(s => (s.rows || []).map((r: any) => r.reservation_id)).filter(Boolean)
        )
      );

      if (reservationIds.length === 0) {
        setSchedules([]);
        return;
      }

      // 예약 기본 정보와 사용자 정보 일괄 조회
      const { data: reservationsData, error: resErr } = await supabase
        .from('reservation')
        .select('re_id, re_type, re_status, re_user_id')
        .in('re_id', reservationIds);
      if (resErr) {
        setSchedules([]);
        return;
      }
      const reservationById = new Map(reservationsData!.map(r => [r.re_id, r]));

      const userIds = Array.from(new Set(reservationsData!.map(r => r.re_user_id).filter(Boolean)));
      let usersById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);
        usersById = new Map((usersData || []).map(u => [u.id, u]));
      }

      // 스케줄 객체로 변환
      const result: any[] = [];
      const toTimeStr = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

      for (const { table, rows } of serviceRows) {
        for (const row of rows) {
          const reservation = reservationById.get(row.reservation_id);
          if (!reservation) continue;
          let scheduleDate: Date | null = null;
          let scheduleTime = '';
          let location: string | null = null;
          let duration: string | null = null;
          const reservationAny = reservation as any;
          let type = reservationAny.re_type;

          if (table === 'reservation_cruise') {
            // checkin은 date만 있을 가능성
            if (row.checkin) {
              scheduleDate = new Date(row.checkin + 'T09:00:00');
              // 크루즈는 시간 표기 숨김
              scheduleTime = '';
            }
            location = '하롱베이';
            // room_price_code로 크루즈/룸타입 부가 정보
            if (row.room_price_code) {
              const info = cruiseInfoByCode.get(row.room_price_code);
              if (info) {
                (row as any)._cruise_info = { ...info, room_code: row.room_price_code };
              }
            }
          } else if (table === 'reservation_airport') {
            if (row.ra_datetime) {
              // UTC → 현지 시간 보정
              const d = new Date(row.ra_datetime);
              if (!isNaN(d.getTime())) {
                // 현지 시간대(베트남/한국)로 변환
                const localDate = new Date(d.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 (한국 기준)
                scheduleDate = localDate;
                scheduleTime = toTimeStr(localDate);
              }
            }
            location = row.ra_airport_location || null;
          } else if (table === 'reservation_hotel') {
            if (row.checkin_date) {
              scheduleDate = new Date(row.checkin_date + 'T15:00:00');
              scheduleTime = '15:00';
            }
            // 예약 시 hotel_category에 호텔명 저장하는 패턴
            location = row.hotel_category || null;
            if (row.nights) duration = `${row.nights}박`;
          } else if (table === 'reservation_rentcar') {
            if (row.pickup_datetime) {
              // UTC → 현지 시간 보정
              const d = new Date(row.pickup_datetime);
              if (!isNaN(d.getTime())) {
                const localDate = new Date(d.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 (한국 기준)
                scheduleDate = localDate;
                scheduleTime = toTimeStr(localDate);
              }
            }
            if (row.pickup_location && row.destination) {
              location = `${row.pickup_location} → ${row.destination}`;
            } else {
              location = row.pickup_location || row.destination || null;
            }
          } else if (table === 'reservation_tour') {
            if (row.usage_date) {
              scheduleDate = new Date(row.usage_date + 'T09:00:00');
              scheduleTime = '09:00';
            }
            location = row.pickup_location || row.dropoff_location || null;
            if (row.tour_duration) duration = row.tour_duration;
          } else if (table === 'reservation_cruise_car') {
            // pickup_datetime is date, default to 09:00
            if (row.pickup_datetime) {
              scheduleDate = new Date(row.pickup_datetime + 'T09:00:00');
              scheduleTime = '09:00';
            }
            if (row.pickup_location && row.dropoff_location) {
              location = `${row.pickup_location} → ${row.dropoff_location}`;
            } else {
              location = row.pickup_location || row.dropoff_location || null;
            }
          } else if (table === 'reservation_car_sht') {
            // usage_date is timestamptz
            if (row.usage_date) {
              const d = new Date(row.usage_date);
              if (!isNaN(d.getTime())) {
                const localDate = new Date(d.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                scheduleDate = localDate;
                scheduleTime = toTimeStr(localDate);
              }
            }
            // No location fields; show category or vehicle info in location slot
            location = row.sht_category || row.vehicle_number || row.dispatch_code || null;
          }

          if (!scheduleDate) continue; // 날짜가 없으면 제외

          result.push({
            re_id: reservationAny.re_id,
            re_type: type,
            re_status: reservationAny.re_status,
            users: usersById.get(reservationAny.re_user_id) || null,
            schedule_date: scheduleDate,
            schedule_time: scheduleTime,
            location,
            duration,
            service_table: table,
            service_row: row,
            cruise_info: (row as any)._cruise_info || null
          });
        }
      }

      // 타입 필터는 렌더에서 적용하되, 여기서는 날짜 범위 내 결과만 세팅
      // 최신순 정렬 (시간 기준)
      result.sort((a, b) => a.schedule_date.getTime() - b.schedule_date.getTime());
      setSchedules(result);
    } catch (error) {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cruise': return <Ship className="w-5 h-5 text-blue-600" />;
      case 'airport': return <Plane className="w-5 h-5 text-green-600" />;
      case 'hotel': return <Building className="w-5 h-5 text-purple-600" />;
      case 'tour': return <MapPin className="w-5 h-5 text-orange-600" />;
      case 'rentcar': return <Car className="w-5 h-5 text-red-600" />;
      case 'car': return <Car className="w-5 h-5 text-red-600" />;
      case 'vehicle': return <Car className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'cruise': return '크루즈';
      case 'airport': return '공항';
      case 'hotel': return '호텔';
      case 'tour': return '투어';
      case 'rentcar': return '렌트카';
      case 'car': return '차량';
      case 'vehicle': return '차량';
      case 'sht': return '스하차량';
      default: return type;
    }
  };

  // 표시용 타입명/아이콘 (service_table을 반영)
  const getDisplayTypeName = (schedule: any) => {
    if (schedule?.service_table === 'reservation_car_sht') return getTypeName('sht');
    if (schedule?.service_table === 'reservation_cruise_car') return getTypeName('vehicle');
    return getTypeName(schedule?.re_type);
  };

  const getDisplayTypeIcon = (schedule: any) => {
    if (schedule?.service_table === 'reservation_car_sht') return getTypeIcon('vehicle');
    if (schedule?.service_table === 'reservation_cruise_car') return getTypeIcon('vehicle');
    return getTypeIcon(schedule?.re_type);
  };

  // 크루즈명 + 객실타입 표시용 유틸 (가용 필드에서 최대한 추출)
  const getCruiseNameAndRoom = (row: any) => {
    const cruise =
      row?.cruise_name ||
      row?.cruise ||
      row?.cruise_title ||
      row?.room_price_cruise ||
      row?.room_cruise ||
      '';
    const roomType =
      row?.room_type ||
      row?.room_category ||
      row?.room ||
      row?.room_price_room_type ||
      '';
    const code = row?.room_price_code || '';
    const left = cruise || (code ? `코드:${code}` : '크루즈');
    const right = roomType;
    return [left, right].filter(Boolean).join(' ');
  };

  // 크루즈 레이블을 '크루즈 / 객실타입' 형식으로 반환 (슬래시 앞뒤 공백 포함)
  const formatCruiseLabel = (schedule: any) => {
    const row = schedule?.service_row || {};
    const info = schedule?.cruise_info || {};
    const cruise = info?.cruise || row?.cruise_name || row?.cruise || row?.cruise_title || row?.room_price_cruise || '';
    const roomType = info?.room_type || row?.room_type || row?.room_category || row?.room || row?.room_price_room_type || '';
    if (cruise && roomType) return `${cruise} / ${roomType}`;
    if (cruise) return cruise;
    if (roomType) return roomType;
    // fallback to existing heuristic
    // replace only the first whitespace between cruise and room with ' / '
    return getCruiseNameAndRoom(row).replace(/\s+/, ' / ');
  };

  // 시간 무시, 날짜(YYYY-MM-DD) 기준으로만 분류
  // 현지 날짜 기준으로 비교 (UTC 변환 오류 방지)
  const isSameLocalDate = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // 주/월간 포함 범위 비교 (양끝 포함)
  const isDateInRange = (date: Date, start: Date, end: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return d >= s && d <= e;
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (typeFilter !== 'all') {
      if (typeFilter === 'sht') {
        if (schedule.service_table !== 'reservation_car_sht') return false;
      } else if (typeFilter === 'vehicle') {
        if (schedule.service_table !== 'reservation_cruise_car') return false;
      } else if (typeFilter === 'cruise') {
        // 크루즈 필터: 차량 테이블은 제외하고 cruise 예약만 포함
        if (schedule.service_table === 'reservation_cruise_car' || schedule.service_table === 'reservation_car_sht') return false;
        if (schedule.re_type !== 'cruise') return false;
      } else if (schedule.re_type !== typeFilter) {
        return false;
      }
    }
    if (!schedule.schedule_date) return false;
    if (viewMode === 'day') return isSameLocalDate(schedule.schedule_date, selectedDate);
    const { start, end } = getRange(selectedDate, viewMode);
    return isDateInRange(schedule.schedule_date, start, end);
  });

  // 서비스 타입별 그룹
  const groupedByType: Record<string, any[]> = filteredSchedules.reduce(
    (acc: Record<string, any[]>, cur) => {
      const k = cur.re_type || 'other';
      (acc[k] ||= []).push(cur);
      return acc;
    },
    {}
  );

  // 날짜(YYYY-MM-DD) 기준 그룹 (주/월간 일별 그룹화용)
  const toKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const weekdayShort = ['일', '월', '화', '수', '목', '금', '토'];
  const formatDateLabel = (d: Date) => {
    const dateStr = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    return `${dateStr} (${weekdayShort[d.getDay()]})`;
  };
  const groupedByDate: Record<string, any[]> = filteredSchedules.reduce(
    (acc: Record<string, any[]>, cur) => {
      const k = toKey(cur.schedule_date);
      (acc[k] ||= []).push(cur);
      return acc;
    },
    {}
  );

  // Google Sheets 데이터 필터링
  const filteredGoogleSheets = googleSheetsData.filter(reservation => {
    let targetDate: Date | null = null;
    let dateType = '';

    // 각 서비스 타입별 날짜 필드 확인
    if (reservation.checkin) {
      // 크루즈 데이터
      targetDate = parseDate(reservation.checkin);
      dateType = '크루즈 체크인';
    } else if (reservation.pickupDatetime) {
      // 차량 데이터
      targetDate = parseDate(reservation.pickupDatetime);
      dateType = '차량 승차일시';
    } else if (reservation.boardingDate) {
      // 스하차량 데이터
      targetDate = parseDate(reservation.boardingDate);
      dateType = '스하차량 승차일';
    } else if (reservation.date) {
      // 공항 데이터 (수정: datetime → date)
      targetDate = parseDate(reservation.date);
      dateType = '공항 일자';
    } else if (reservation.checkinDate) {
      // 호텔 데이터
      targetDate = parseDate(reservation.checkinDate);
      dateType = '호텔 체크인';
    } else if (reservation.startDate) {
      // 투어 데이터
      targetDate = parseDate(reservation.startDate);
      dateType = '투어 시작일';
    } else if (reservation.pickupDate) {
      // 렌트카 데이터
      targetDate = parseDate(reservation.pickupDate);
      dateType = '렌트카 승차일';
    }

    if (!targetDate) {
      return false;
    }

    if (viewMode === 'day') {
      return isSameLocalDate(targetDate, selectedDate);
    }
    const { start, end } = getRange(selectedDate, viewMode);
    return isDateInRange(targetDate, start, end);
  });

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Google Sheets 데이터 타입 확인 함수들
  const isCruiseData = (item: any): item is SHRReservation => {
    return 'checkin' in item && 'cruise' in item;
  };

  const isVehicleData = (item: any): item is SHCCReservation => {
    return 'boardingDate' in item && 'vehicleNumber' in item;
  };

  const isAirportData = (item: any): item is SHPReservation => {
    return 'airportName' in item && 'flightNumber' in item;
  };

  const isHotelData = (item: any): item is SHHReservation => {
    return 'hotelName' in item && 'checkinDate' in item;
  };

  const isTourData = (item: any): item is SHTReservation => {
    return 'tourName' in item && 'startDate' in item;
  };

  const isRentcarData = (item: any): item is SHRCReservation => {
    return 'pickupDate' in item && 'usagePeriod' in item;
  };

  const isCarData = (item: any): item is SHCReservation => {
    return 'pickupDatetime' in item && !('boardingDate' in item) && !('pickupDate' in item);
  };

  // 서비스 타입 판별 함수
  const getServiceType = (reservation: any): string => {
    if (isCruiseData(reservation)) return 'cruise';
    if (isVehicleData(reservation)) return 'vehicle';
    if (isAirportData(reservation)) return 'airport';
    if (isHotelData(reservation)) return 'hotel';
    if (isTourData(reservation)) return 'tour';
    if (isRentcarData(reservation)) return 'rentcar';
    if (isCarData(reservation)) return 'car';
    return 'unknown';
  };

  // 서비스 타입별 아이콘 및 이름
  const getServiceInfo = (type: string) => {
    const serviceMap: Record<string, { icon: React.ReactNode; name: string; color: string }> = {
      cruise: { icon: <Ship className="w-5 h-5" />, name: '크루즈', color: 'blue' },
      car: { icon: <Car className="w-5 h-5" />, name: '차량', color: 'blue' },
      vehicle: { icon: <Car className="w-5 h-5" />, name: '스하차량', color: 'purple' },
      airport: { icon: <Plane className="w-5 h-5" />, name: '공항', color: 'green' },
      hotel: { icon: <Building className="w-5 h-5" />, name: '호텔', color: 'orange' },
      tour: { icon: <MapPin className="w-5 h-5" />, name: '투어', color: 'red' },
      rentcar: { icon: <Car className="w-5 h-5" />, name: '렌트카', color: 'indigo' }
    };
    return serviceMap[type] || { icon: <Calendar className="w-5 h-5" />, name: '기타', color: 'gray' };
  };

  // 서비스별 그룹화
  const groupedByService = filteredGoogleSheets.reduce((acc: Record<string, any[]>, reservation) => {
    const serviceType = getServiceType(reservation);
    (acc[serviceType] ||= []).push(reservation);
    return acc;
  }, {});

  // Google Sheets 예약 카드 렌더링
  const renderGoogleSheetsCard = (reservation: any, index: number) => {
    // 1. 크루즈 데이터
    if (isCruiseData(reservation)) {
      const checkinDate = parseDate(reservation.checkin);
      const isPast = isPastDate(reservation.checkin);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 border border-blue-200">
              <Ship className="w-5 h-5 text-blue-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              크루즈
            </h5>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-blue-100 text-blue-800'
                  }`}
              >
                {isPast ? '완료' : '예정'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-blue-700 text-base">
                  {reservation.customerName}
                </span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">
                    ({reservation.customerEnglishName})
                  </span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">크루즈</span>
              <span className="text-sm font-bold text-blue-700 break-words">{reservation.cruise}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">객실</span>
              <span className="text-sm break-words">{reservation.roomType} {reservation.category && `(${reservation.category})`}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">
                {checkinDate?.toLocaleDateString('ko-KR')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원</span>
              <span className="text-sm">
                {reservation.adult > 0 && `👨 ${reservation.adult}명`}
                {reservation.child > 0 && ` 👶 ${reservation.child}명`}
                {reservation.toddler > 0 && ` 🍼 ${reservation.toddler}명`}
                {reservation.adult === 0 && reservation.child === 0 && reservation.toddler === 0 && (
                  <span className="text-gray-400">-</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">객실수</span>
              <span className="text-sm">{reservation.roomCount}개</span>
            </div>
            {reservation.discount && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-500 text-xs">할인</span>
                <span className="text-sm text-green-600">{reservation.discount}</span>
              </div>
            )}
            {reservation.requestNote && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-200">
                <span className="font-semibold text-orange-600 text-xs whitespace-nowrap">📝</span>
                <span className="text-sm text-gray-700 leading-relaxed">{reservation.requestNote}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. 스하차량 데이터
    else if (isVehicleData(reservation)) {
      const boardingDate = parseDate(reservation.boardingDate);
      const isPast = isPastDate(reservation.boardingDate);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-50 border border-purple-200">
              <Car className="w-5 h-5 text-purple-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              스하차량
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-purple-100 text-purple-800'}`}>
              {isPast ? '완료' : '예정'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-purple-700 text-base">{reservation.customerName}</span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">({reservation.customerEnglishName})</span>
                )}
              </div>
            )}
            {(reservation.serviceType || reservation.category) && (
              <div className="flex items-center gap-2 mb-1">
                {reservation.serviceType && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-semibold">
                    {reservation.serviceType}
                  </span>
                )}
                {reservation.category && (
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-xs">
                    {reservation.category}
                  </span>
                )}
              </div>
            )}
            {reservation.cruiseInfo && (
              <div className="flex items-start gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-semibold text-gray-500 text-xs mt-0.5">크루즈</span>
                <span className="text-sm text-purple-700 font-medium break-words">{reservation.cruiseInfo}</span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">{boardingDate?.toLocaleDateString('ko-KR')}</span>
            </div>
            <div className="flex items-start gap-2">
              <Car className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-sm break-words">{reservation.vehicleNumber} / 좌석: {reservation.seatNumber}</span>
            </div>
            {reservation.pickupLocation && (
              <div className="flex items-start gap-2 mt-1">
                <span className="font-semibold text-gray-500 text-xs mt-0.5">픽업</span>
                <span className="text-sm break-words">{reservation.pickupLocation}</span>
              </div>
            )}
            {reservation.dropoffLocation && (
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-500 text-xs mt-0.5">드랍</span>
                <span className="text-sm break-words">{reservation.dropoffLocation}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 3. 공항 데이터
    else if (isAirportData(reservation)) {
      const serviceDate = parseDate(reservation.date);
      const isPast = isPastDate(reservation.date);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-50 border border-green-200">
              <Plane className="w-5 h-5 text-green-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              공항서비스
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
              {isPast ? '완료' : '예정'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-green-700 text-base">{reservation.customerName}</span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">({reservation.customerEnglishName})</span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">구분</span>
              <span className="text-sm font-bold text-green-700 break-words">{reservation.tripType} - {reservation.category}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">경로</span>
              <span className="text-sm break-words">{reservation.route}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">
                {serviceDate?.toLocaleDateString('ko-KR')} {reservation.time}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Plane className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-sm break-words">{reservation.airportName} / {reservation.flightNumber}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-sm break-words">{reservation.placeName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원/차량</span>
              <span className="text-sm">👥 {reservation.passengerCount}명 / 🚗 {reservation.carCount}대</span>
            </div>
            {reservation.carrierCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-500 text-xs">캐리어</span>
                <span className="text-sm">🧳 {reservation.carrierCount}개</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 4. 호텔 데이터
    else if (isHotelData(reservation)) {
      const checkinDate = parseDate(reservation.checkinDate);
      const isPast = isPastDate(reservation.checkinDate);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-50 border border-orange-200">
              <Building className="w-5 h-5 text-orange-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              호텔
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-orange-100 text-orange-800'}`}>
              {isPast ? '완료' : '예정'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-orange-700 text-base">{reservation.customerName}</span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">({reservation.customerEnglishName})</span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">호텔</span>
              <span className="text-sm font-bold text-orange-700 break-words">{reservation.hotelName}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">객실</span>
              <span className="text-sm break-words">{reservation.roomName} ({reservation.roomType})</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">
                {checkinDate?.toLocaleDateString('ko-KR')}
                {reservation.days > 0 && <span className="text-xs text-gray-500 ml-1">({reservation.days}박)</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원</span>
              <span className="text-sm">
                {reservation.adult > 0 && `👨 ${reservation.adult}명`}
                {reservation.child > 0 && ` 👶 ${reservation.child}명`}
                {reservation.toddler > 0 && ` 🍼 ${reservation.toddler}명`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">객실수</span>
              <span className="text-sm">{reservation.roomCount}개</span>
            </div>
            {reservation.breakfastService && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-500 text-xs">조식</span>
                <span className="text-sm">🍳 포함</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 5. 투어 데이터
    else if (isTourData(reservation)) {
      const startDate = parseDate(reservation.startDate);
      const isPast = isPastDate(reservation.startDate);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-pink-50 border border-pink-200">
              <MapPin className="w-5 h-5 text-pink-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              투어
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-pink-100 text-pink-800'}`}>
              {isPast ? '완료' : '예정'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-pink-700 text-base">{reservation.customerName}</span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">({reservation.customerEnglishName})</span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">투어</span>
              <span className="text-sm font-bold text-pink-700 break-words">{reservation.tourName}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">종류</span>
              <span className="text-sm break-words">{reservation.tourType}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">{startDate?.toLocaleDateString('ko-KR')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원</span>
              <span className="text-sm">👥 {reservation.participants}명</span>
            </div>
            {reservation.pickupLocation && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="text-sm break-words">{reservation.pickupLocation}</span>
              </div>
            )}
            {reservation.quantity > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-500 text-xs">수량</span>
                <span className="text-sm">{reservation.quantity}개</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 6. 렌트카 데이터
    else if (isRentcarData(reservation)) {
      const pickupDate = parseDate(reservation.pickupDate);
      const isPast = isPastDate(reservation.pickupDate);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200">
              <Car className="w-5 h-5 text-indigo-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              렌트카
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-indigo-100 text-indigo-800'}`}>
              {isPast ? '완료' : '예정'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-indigo-700 text-base">{reservation.customerName}</span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">({reservation.customerEnglishName})</span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">차량</span>
              <span className="text-sm font-bold text-indigo-700 break-words">{reservation.carType}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">경로</span>
              <span className="text-sm break-words">{reservation.route} ({reservation.tripType})</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">
                {pickupDate?.toLocaleDateString('ko-KR')} {reservation.pickupTime}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-sm break-words">
                {reservation.pickupLocation}
                {reservation.destination && ` → ${reservation.destination}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원/차량</span>
              <span className="text-sm">👥 {reservation.passengerCount}명 / 🚗 {reservation.carCount}대</span>
            </div>
            {reservation.usagePeriod && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-500 text-xs">사용기간</span>
                <span className="text-sm">{reservation.usagePeriod}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 7. 차량 데이터 (기본)
    else if (isCarData(reservation)) {
      const pickupDate = parseDate(reservation.pickupDatetime);
      const isPast = isPastDate(reservation.pickupDatetime);

      return (
        <div
          key={`${reservation.orderId}-${index}`}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full ${isPast ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 border border-blue-200">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
              차량
            </h5>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${isPast
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-blue-100 text-blue-800'
                  }`}
              >
                {isPast ? '완료' : '예정'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
            {reservation.customerName && (
              <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-100">
                <span className="font-bold text-blue-700 text-base">
                  {reservation.customerName}
                </span>
                {reservation.customerEnglishName && (
                  <span className="text-xs text-gray-400">
                    ({reservation.customerEnglishName})
                  </span>
                )}
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="font-semibold text-gray-500 text-xs mt-0.5">차량</span>
              <span className="text-sm break-words">{reservation.carType}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm">
                {pickupDate?.toLocaleDateString('ko-KR')}
              </span>
            </div>
            {reservation.pickupLocation && (
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-500 text-xs mt-0.5">승차</span>
                <span className="text-sm break-words">{reservation.pickupLocation}</span>
              </div>
            )}
            {reservation.dropoffLocation && (
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-500 text-xs mt-0.5">하차</span>
                <span className="text-sm break-words">{reservation.dropoffLocation}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-500 text-xs">인원/차량</span>
              <span className="text-sm">
                👥 {reservation.passengerCount}명 / 🚗 {reservation.carCount}대
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 기타 (fallback)
    return null;
  };

  if (loading) {
    return (
      <ManagerLayout title="예약 일정 (신/구 구분)" activeTab="schedule-new">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">일정 정보를 불러오는 중...</p>
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="예약 일정 (신/구 구분)" activeTab="schedule-new">
      <div className="space-y-6">

        {/* 일정 컨트롤 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold">
                {viewMode === 'day'
                  ? selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                  : viewMode === 'week'
                    ? (() => {
                      const { start, end } = getRange(selectedDate, 'week');
                      return `${start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
                    })()
                    : selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </h2>

              {/* 오늘 버튼 추가 */}
              {viewMode === 'day' && (
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 text-sm font-medium hover:bg-blue-100"
                >오늘</button>
              )}

              <button
                onClick={() => navigateDate('next')}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'day' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
              >
                일간
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'week' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
              >
                주간
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
              >
                월간
              </button>
              {(viewMode === 'week' || viewMode === 'month') && (
                <div className="ml-4 flex items-center gap-2">
                  <span className="text-sm text-gray-600">그룹화:</span>
                  <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
                    <button
                      onClick={() => setGroupMode('day')}
                      className={`px-3 py-1 text-sm ${groupMode === 'day' ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-700'}`}
                    >
                      일별
                    </button>
                    <button
                      onClick={() => setGroupMode('type')}
                      className={`px-3 py-1 text-sm ${groupMode === 'type' ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-700'}`}
                    >
                      타입별
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 타입 필터 */}
          <div className="flex gap-2">
            <Filter className="w-5 h-5 text-gray-600 mt-2" />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${typeFilter === 'all' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
              >
                전체
              </button>
              {['cruise', 'vehicle', 'sht', 'airport', 'hotel', 'tour', 'rentcar'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${typeFilter === type ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                  {getTypeName(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 일정 목록 - 2열 구조 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: Supabase 데이터 */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b bg-green-50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-green-600" />
                DB 예약 일정 ({filteredSchedules.length}건)
              </h3>
            </div>

            {filteredSchedules.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {typeFilter === 'all' ? '예약된 일정이 없습니다' : `${getTypeName(typeFilter)} 일정이 없습니다`}
                </h3>
              </div>
            ) : (
              <div className="p-6 space-y-10">
                {/* 일간 보기: 기존 타입별 구분 없이 전체 리스트 */}
                {viewMode === 'day' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredSchedules.map((schedule: any) => (
                        <div key={`${schedule.re_id}-${schedule.service_table}`} className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full">
                          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200">
                              {getDisplayTypeIcon(schedule)}
                            </div>
                            <h5 className="font-bold text-sm flex-1 truncate text-gray-800">
                              {getDisplayTypeName(schedule)}
                            </h5>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${schedule.re_status === 'confirmed' ? 'bg-green-100 text-green-800' : schedule.re_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                {schedule.re_status === 'confirmed' ? '확정' : schedule.re_status === 'pending' ? '대기' : '취소'}
                              </span>
                              <button
                                onClick={() => { setSelectedSchedule(schedule); setIsModalOpen(true); }}
                                className="bg-blue-500 text-white py-0.5 px-2 rounded text-xs hover:bg-blue-600 transition-colors"
                              >상세</button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
                            <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">고객명</span><span className="text-sm">{schedule.users?.name || '-'}</span></div>
                            <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">이메일</span><span className="text-sm">{schedule.users?.email || '-'}</span></div>
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{schedule.schedule_date.toLocaleDateString('ko-KR')}</span>
                              {schedule.schedule_time && (<><Clock className="w-4 h-4 ml-2 text-gray-400" /><span className="text-sm">{schedule.schedule_time}</span></>)}
                            </div>
                            {schedule.service_table === 'reservation_cruise' && (<div className="flex items-center gap-2"><span className="text-sm">{formatCruiseLabel(schedule)}</span></div>)}
                            {schedule.service_table !== 'reservation_cruise' && schedule.location && (<div className="flex items-center gap-2"><span className="text-sm">{schedule.location}</span></div>)}
                            {schedule.duration && <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">기간</span><span className="text-sm">{schedule.duration}</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 주/월간 보기 */}
                {(viewMode === 'week' || viewMode === 'month') && (
                  <>
                    {groupMode === 'day' && (
                      <div className="space-y-8">
                        {Object.keys(groupedByDate)
                          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                          .map(key => {
                            const list = groupedByDate[key];
                            const d = new Date(key + 'T00:00:00');
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-md font-semibold flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-green-600" /> {formatDateLabel(d)} <span className="text-gray-500">({list.length}건)</span>
                                  </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {list.map((schedule: any) => (
                                    <div key={`${schedule.re_id}-${schedule.service_table}`} className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full">
                                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200">
                                          {getDisplayTypeIcon(schedule)}
                                        </div>
                                        <h5 className="font-bold text-sm flex-1 truncate text-gray-800">{getDisplayTypeName(schedule)}</h5>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${schedule.re_status === 'confirmed' ? 'bg-green-100 text-green-800' : schedule.re_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {schedule.re_status === 'confirmed' ? '확정' : schedule.re_status === 'pending' ? '대기' : '취소'}
                                          </span>
                                          <button onClick={() => { setSelectedSchedule(schedule); setIsModalOpen(true); }} className="bg-blue-500 text-white py-0.5 px-2 rounded text-xs hover:bg-blue-600 transition-colors">상세</button>
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
                                        <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">고객명</span><span className="text-sm">{schedule.users?.name || '-'}</span></div>
                                        <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">이메일</span><span className="text-sm">{schedule.users?.email || '-'}</span></div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Calendar className="w-4 h-4 text-gray-400" />
                                          <span className="text-sm">{schedule.schedule_date.toLocaleDateString('ko-KR')}</span>
                                          {schedule.schedule_time && (<><Clock className="w-4 h-4 ml-2 text-gray-400" /><span className="text-sm">{schedule.schedule_time}</span></>)}
                                        </div>
                                        {schedule.service_table === 'reservation_cruise' && (<div className="flex items-center gap-2"><span className="text-sm">{formatCruiseLabel(schedule)}</span></div>)}
                                        {schedule.service_table !== 'reservation_cruise' && schedule.location && (<div className="flex items-center gap-2"><span className="text-sm">{schedule.location}</span></div>)}
                                        {schedule.duration && <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">기간</span><span className="text-sm">{schedule.duration}</span></div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {groupMode === 'type' && (
                      <div className="space-y-10">
                        {Object.entries(groupedByType).map(([type, list]) => (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-md font-semibold flex items-center gap-2">
                                {getTypeIcon(typeFilter === 'sht' || typeFilter === 'vehicle' ? 'vehicle' : type)} {typeFilter === 'sht' ? getTypeName('sht') : typeFilter === 'vehicle' ? getTypeName('vehicle') : getTypeName(type)} <span className="text-gray-500">({list.length}건)</span>
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {list.map((schedule: any) => (
                                <div key={`${schedule.re_id}-${schedule.service_table}`} className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-3 flex flex-col h-full">
                                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200">
                                      {getDisplayTypeIcon(schedule)}
                                    </div>
                                    <h5 className="font-bold text-sm flex-1 truncate text-gray-800">{getDisplayTypeName(schedule)}</h5>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${schedule.re_status === 'confirmed' ? 'bg-green-100 text-green-800' : schedule.re_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                        {schedule.re_status === 'confirmed' ? '확정' : schedule.re_status === 'pending' ? '대기' : '취소'}
                                      </span>
                                      <button onClick={() => { setSelectedSchedule(schedule); setIsModalOpen(true); }} className="bg-blue-500 text-white py-0.5 px-2 rounded text-xs hover:bg-blue-600 transition-colors">상세</button>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1 text-sm text-gray-700 mt-1">
                                    <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">고객명</span><span className="text-sm">{schedule.users?.name || '-'}</span></div>
                                    <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">이메일</span><span className="text-sm">{schedule.users?.email || '-'}</span></div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm">{schedule.schedule_date.toLocaleDateString('ko-KR')}</span>
                                      {schedule.schedule_time && (<><Clock className="w-4 h-4 ml-2 text-gray-400" /><span className="text-sm">{schedule.schedule_time}</span></>)}
                                    </div>
                                    {schedule.service_table === 'reservation_cruise' && (<div className="flex items-center gap-2"><span className="text-sm">{formatCruiseLabel(schedule)}</span></div>)}
                                    {schedule.service_table !== 'reservation_cruise' && schedule.location && (<div className="flex items-center gap-2"><span className="text-sm">{schedule.location}</span></div>)}
                                    {schedule.duration && <div className="flex items-center gap-2"><span className="font-semibold text-gray-500 text-xs">기간</span><span className="text-sm">{schedule.duration}</span></div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div >

          {/* 오른쪽: Google Sheets 데이터 */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b bg-blue-50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Sheets 예약 일정 ({filteredGoogleSheets.length}건)
              </h3>
            </div>

            {googleSheetsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Google Sheets 데이터를 불러오는 중...</p>
              </div>
            ) : googleSheetsError ? (
              <div className="p-8 text-center">
                <Calendar className="w-16 h-16 text-red-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-600 mb-2">
                  데이터 로드 실패
                </h3>
                <p className="text-sm text-gray-500">{googleSheetsError}</p>
              </div>
            ) : filteredGoogleSheets.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  예약된 일정이 없습니다
                </h3>
              </div>
            ) : (
              <div className="p-6 space-y-10">
                {/* 일간 보기 - 서비스별 그룹화 */}
                {viewMode === 'day' && (
                  <div className="space-y-6">
                    {Object.entries(groupedByService)
                      .sort(([typeA], [typeB]) => {
                        const order = ['cruise', 'car', 'vehicle', 'airport', 'hotel', 'tour', 'rentcar'];
                        return order.indexOf(typeA) - order.indexOf(typeB);
                      })
                      .map(([serviceType, reservations]) => {
                        const serviceInfo = getServiceInfo(serviceType);
                        const reservationArray = Array.isArray(reservations) ? reservations : [];
                        return (
                          <div key={serviceType}>
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                              <div className={`text-${serviceInfo.color}-600`}>
                                {serviceInfo.icon}
                              </div>
                              <h4 className="text-md font-semibold text-gray-800">
                                {serviceInfo.name}
                                <span className="ml-2 text-sm text-gray-500">({reservationArray.length}건)</span>
                              </h4>
                            </div>

                            {/* 스하차량인 경우 분류(category)별로 서브그룹화 */}
                            {serviceType === 'vehicle' ? (
                              <div className="space-y-4">
                                {Object.entries(
                                  reservationArray.reduce((acc: Record<string, any[]>, reservation) => {
                                    const category = reservation.category || '미분류';
                                    (acc[category] ||= []).push(reservation);
                                    return acc;
                                  }, {})
                                ).map(([category, categoryReservations]) => (
                                  <div key={category}>
                                    <div className="flex items-center gap-2 mb-2 ml-4">
                                      <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm font-semibold">
                                        {category}
                                      </span>
                                      <span className="text-xs text-gray-500">({categoryReservations.length}건)</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                      {categoryReservations.map((reservation, index) =>
                                        renderGoogleSheetsCard(reservation, index)
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {reservationArray.map((reservation, index) =>
                                  renderGoogleSheetsCard(reservation, index)
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {Object.keys(groupedByService).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        예약된 일정이 없습니다.
                      </div>
                    )}
                  </div>
                )}

                {/* 주/월간 보기 */}
                {(viewMode === 'week' || viewMode === 'month') && (
                  <>
                    {groupMode === 'day' && (
                      <div className="space-y-8">
                        {Object.entries(
                          filteredGoogleSheets.reduce((acc: Record<string, any[]>, reservation) => {
                            // 각 서비스 타입별 날짜 필드 확인
                            let date: Date | null = null;

                            if (reservation.checkin) {
                              date = parseDate(reservation.checkin); // 크루즈
                            } else if (reservation.pickupDatetime) {
                              date = parseDate(reservation.pickupDatetime); // 차량
                            } else if (reservation.boardingDate) {
                              date = parseDate(reservation.boardingDate); // 스하차량
                            } else if (reservation.date) {
                              date = parseDate(reservation.date); // 공항
                            } else if (reservation.checkinDate) {
                              date = parseDate(reservation.checkinDate); // 호텔
                            } else if (reservation.startDate) {
                              date = parseDate(reservation.startDate); // 투어
                            } else if (reservation.pickupDate) {
                              date = parseDate(reservation.pickupDate); // 렌트카
                            }

                            if (date) {
                              const key = toKey(date);
                              (acc[key] ||= []).push(reservation);
                            }
                            return acc;
                          }, {})
                        )
                          .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                          .map(([dateKey, reservations]) => {
                            const d = new Date(dateKey + 'T00:00:00');
                            const reservationArray = Array.isArray(reservations) ? reservations : [];

                            // 날짜별로 서비스 타입별 그룹화
                            const serviceGroups = reservationArray.reduce((acc: Record<string, any[]>, reservation) => {
                              const serviceType = getServiceType(reservation);
                              (acc[serviceType] ||= []).push(reservation);
                              return acc;
                            }, {});

                            return (
                              <div key={dateKey}>
                                <div className="flex items-center justify-between mb-3 pb-2 border-b-2">
                                  <h4 className="text-lg font-bold flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    {formatDateLabel(d)}
                                    <span className="text-gray-500">({reservationArray.length}건)</span>
                                  </h4>
                                </div>
                                <div className="space-y-4">
                                  {Object.entries(serviceGroups)
                                    .sort(([typeA], [typeB]) => {
                                      const order = ['cruise', 'car', 'vehicle', 'airport', 'hotel', 'tour', 'rentcar'];
                                      return order.indexOf(typeA) - order.indexOf(typeB);
                                    })
                                    .map(([serviceType, serviceReservations]) => {
                                      const serviceInfo = getServiceInfo(serviceType);
                                      const serviceReservationArray = Array.isArray(serviceReservations) ? serviceReservations : [];
                                      return (
                                        <div key={serviceType}>
                                          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-200">
                                            <div className={`text-${serviceInfo.color}-600`}>
                                              {serviceInfo.icon}
                                            </div>
                                            <h5 className="text-sm font-semibold text-gray-700">
                                              {serviceInfo.name}
                                              <span className="ml-2 text-xs text-gray-500">({serviceReservationArray.length}건)</span>
                                            </h5>
                                          </div>

                                          {/* 스하차량인 경우 분류(category)별로 서브그룹화 */}
                                          {serviceType === 'vehicle' ? (
                                            <div className="space-y-4">
                                              {Object.entries(
                                                serviceReservationArray.reduce((acc: Record<string, any[]>, reservation) => {
                                                  const category = reservation.category || '미분류';
                                                  (acc[category] ||= []).push(reservation);
                                                  return acc;
                                                }, {})
                                              ).map(([category, categoryReservations]) => (
                                                <div key={category}>
                                                  <div className="flex items-center gap-2 mb-2 ml-4">
                                                    <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm font-semibold">
                                                      {category}
                                                    </span>
                                                    <span className="text-xs text-gray-500">({categoryReservations.length}건)</span>
                                                  </div>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                    {categoryReservations.map((reservation, index) =>
                                                      renderGoogleSheetsCard(reservation, index)
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                              {serviceReservationArray.map((reservation, index) =>
                                                renderGoogleSheetsCard(reservation, index)
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {groupMode === 'type' && (
                      <div className="space-y-6">
                        {Object.entries(groupedByService)
                          .sort(([typeA], [typeB]) => {
                            const order = ['cruise', 'car', 'vehicle', 'airport', 'hotel', 'tour', 'rentcar'];
                            return order.indexOf(typeA) - order.indexOf(typeB);
                          })
                          .map(([serviceType, reservations]) => {
                            const serviceInfo = getServiceInfo(serviceType);
                            const reservationArray = Array.isArray(reservations) ? reservations : [];
                            return (
                              <div key={serviceType}>
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                  <div className={`text-${serviceInfo.color}-600`}>
                                    {serviceInfo.icon}
                                  </div>
                                  <h4 className="text-md font-semibold text-gray-800">
                                    {serviceInfo.name}
                                    <span className="ml-2 text-sm text-gray-500">({reservationArray.length}건)</span>
                                  </h4>
                                </div>

                                {/* 스하차량인 경우 분류(category)별로 서브그룹화 */}
                                {serviceType === 'vehicle' ? (
                                  <div className="space-y-4">
                                    {Object.entries(
                                      reservationArray.reduce((acc: Record<string, any[]>, reservation) => {
                                        const category = reservation.category || '미분류';
                                        (acc[category] ||= []).push(reservation);
                                        return acc;
                                      }, {})
                                    ).map(([category, categoryReservations]) => (
                                      <div key={category}>
                                        <div className="flex items-center gap-2 mb-2 ml-4">
                                          <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm font-semibold">
                                            {category}
                                          </span>
                                          <span className="text-xs text-gray-500">({categoryReservations.length}건)</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                          {categoryReservations.map((reservation, index) =>
                                            renderGoogleSheetsCard(reservation, index)
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {reservationArray.map((reservation, index) =>
                                      renderGoogleSheetsCard(reservation, index)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div >

      {/* 예약 디테일 모달 */}
      <ReservationDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedSchedule}
        title="예약 상세 정보"
        onRefresh={loadSchedules}
      />
    </ManagerLayout>
  );
}
