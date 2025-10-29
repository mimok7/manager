'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ManagerLayout from '@/components/ManagerLayout';
import PaymentDetailModal from '../../../components/PaymentDetailModal';
import supabase from '@/lib/supabase';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Eye,
} from 'lucide-react';

// 결제 상태/수단 텍스트 변환
const getPaymentStatusText = (status: string) => {
  switch (status) {
    case 'pending': return '결제 대기';
    case 'completed': return '결제 완료';
    case 'failed': return '결제 실패';
    default: return status;
  }
};
const getPaymentStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'failed': return <AlertCircle className="w-5 h-5 text-red-600" />;
    default: return <Clock className="w-5 h-5 text-yellow-600" />;
  }
};
const getPaymentMethodText = (method: string) => {
  switch (method) {
    case 'CARD': case 'card': return '신용카드';
    case 'BANK': case 'bank': return '계좌이체';
    case 'CASH': case 'cash': return '현금';
    default: return method || '신용카드';
  }
};

export default function ManagerPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // 최초 로딩시 결제대기만 보이도록 기본값 'pending'
  const [filter, setFilter] = useState('pending');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [bulkCompleting, setBulkCompleting] = useState(false);
  const [creatingLinkId, setCreatingLinkId] = useState<string | null>(null);
  // 페이지네이션 상태
  const PAGE_SIZE = 24;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 대량 IN 쿼리/업데이트를 분할 처리하기 위한 유틸
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  // 예약 디테일 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);

  // 상세보기 모달 열기
  const openDetailModal = (payment: any) => {
    setSelectedReservation(payment);
    setModalOpen(true);
  };

  // 결제 레코드 생성 함수 (견적 ID별로 처리) - 개선된 버전
  const generatePaymentRecords = async () => {
    setGenerating(true);
    try {
      // 1. 확정된 예약 조회 (total_amount 포함)
      const { data: reservations } = await supabase
        .from('reservation')
        .select('re_id, re_user_id, re_quote_id, re_type, re_status, total_amount')
        .eq('re_status', 'confirmed')
        .not('re_quote_id', 'is', null);

      if (!reservations || reservations.length === 0) {
        alert('견적 ID가 있는 확정된 예약이 없습니다.');
        return;
      }

      console.log('🔍 확정된 예약 조회:', reservations.length, '건');

      // 2. 견적별로 그룹화
      const quoteGroups = new Map<string, any[]>();
      reservations.forEach(reservation => {
        const quoteId = reservation.re_quote_id;
        if (!quoteGroups.has(quoteId)) {
          quoteGroups.set(quoteId, []);
        }
        quoteGroups.get(quoteId)!.push(reservation);
      });

      console.log('📋 견적별 그룹화:', quoteGroups.size, '개 견적');

      // 3. 이미 결제 레코드가 있는 견적 제외
      const quoteIds = Array.from(quoteGroups.keys());
      const { data: existingPayments } = await supabase
        .from('reservation_payment')
        .select('reservation_id')
        .in('reservation_id', reservations.map(r => r.re_id));

      // 이미 결제가 있는 견적 ID들을 찾기
      const existingQuoteIds = new Set();
      for (const payment of existingPayments || []) {
        const reservation = reservations.find(r => r.re_id === payment.reservation_id);
        if (reservation) {
          existingQuoteIds.add(reservation.re_quote_id);
        }
      }

      // 새로 처리할 견적들만 필터링
      const newQuoteIds = quoteIds.filter(qId => !existingQuoteIds.has(qId));

      if (newQuoteIds.length === 0) {
        alert('새로 생성할 결제 레코드가 없습니다. (모든 견적에 이미 결제 레코드가 있습니다)');
        return;
      }

      console.log('🆕 신규 결제 생성 대상:', newQuoteIds.length, '개 견적');

      // 4. 견적별 총 금액 계산 및 결제 레코드 생성 (개선된 로직)
      const paymentRecords = [];
      for (const quoteId of newQuoteIds) {
        const quoteReservations = quoteGroups.get(quoteId)!;

        // reservation.total_amount를 합산 (이미 계산된 값 사용)
        const quoteTotalAmount = quoteReservations.reduce((sum, reservation) => {
          return sum + (Number(reservation.total_amount) || 0);
        }, 0);

        const quoteUserId = quoteReservations[0].re_user_id;
        const serviceTypes = [...new Set(quoteReservations.map(r => r.re_type))];

        console.log(`� 견적 ${quoteId}:`, {
          예약수: quoteReservations.length,
          총금액: quoteTotalAmount,
          서비스타입: serviceTypes.join(', ')
        });

        // 견적별로 하나의 결제 레코드 생성
        if (quoteTotalAmount > 0) {
          const mainReservationId = quoteReservations[0].re_id; // 대표 예약 ID
          paymentRecords.push({
            reservation_id: mainReservationId,
            user_id: quoteUserId,
            amount: quoteTotalAmount,
            payment_method: 'CARD',
            payment_status: 'pending',
            memo: `자동 생성 - 견적 ${quoteId} (${serviceTypes.join(', ')}) (${new Date().toLocaleDateString()})`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          console.log(`✅ 견적 ${quoteId}: ${quoteTotalAmount.toLocaleString()}동 결제 레코드 생성`);
        } else {
          console.log(`❌ 견적 ${quoteId}: 총액이 0원이므로 결제 레코드 생성하지 않음`);
        }
      }

      // 5. 결제 레코드 일괄 삽입
      if (paymentRecords.length > 0) {
        const { error } = await supabase
          .from('reservation_payment')
          .insert(paymentRecords);

        if (error) {
          throw error;
        }

        alert(`${paymentRecords.length}개의 결제 레코드가 생성되었습니다.`);
      } else {
        alert('생성할 결제 레코드가 없습니다. (모든 예약의 금액이 0원입니다)');
      }

    } catch (error) {
      console.error('결제 레코드 생성 실패:', error);
      alert('결제 레코드 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
      // 생성 완료 후 목록 새로고침
      await loadPayments();
    }
  };

  // 결제 목록 로드 (상세 정보 포함)
  const loadPayments = async () => {
    setLoading(true);
    try {
      // 결제 목록 조회: 현재 필터에 맞춰 서버 사이드에서 정확히 로드 (all이면 전체)
      let query = supabase
        .from('reservation_payment')
        .select(`
          *,
          reservation:reservation_id (
            re_id,
            re_status,
            re_type,
            re_quote_id,
            total_amount
          )
        `)
        .order('created_at', { ascending: false });

      if (filter && filter !== 'all') {
        query = query.eq('payment_status', filter);
      }

      // 초기 페이지 범위
      const { data: paymentRows } = await (query as any).range(0, PAGE_SIZE - 1);

      const rows: any[] = (paymentRows as any[]) || [];

      // 사용자 정보 매핑
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, name, email').in('id', userIds as string[])
        : { data: [] };

      const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

      // 각 결제에 대한 서비스 상세 정보 조회
      const enriched = await Promise.all(rows.map(async (r: any) => {
        console.log('🔍 결제 처리 중:', {
          paymentId: r.id,
          reservationId: r.reservation_id,
          userId: r.user_id,
          amount: r.amount
        });

        const serviceData = await getServiceDetails(r.reservation_id);

        const result = {
          ...r,
          users: r.user_id ? usersMap.get(r.user_id) : undefined,
          calculatedAmount: r.reservation?.total_amount || 0,
          serviceData
        };

        console.log('✅ 결제 완료:', {
          paymentId: r.id,
          서비스수: serviceData.services.length,
          서비스데이터: serviceData
        });

        return result;
      }));

      setPayments(enriched);
      setHasMore((enriched?.length || 0) === PAGE_SIZE);
      console.log('💾 결제 목록 로드 완료:', enriched.length, '건');
    } catch (e) {
      console.error('결제 목록 로드 실패:', e);
      setPayments([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // 다음 페이지 로드
  const loadMorePayments = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      // 동일한 쿼리 빌드
      let query = supabase
        .from('reservation_payment')
        .select(`
          *,
          reservation:reservation_id (
            re_id,
            re_status,
            re_type,
            re_quote_id,
            total_amount
          )
        `)
        .order('created_at', { ascending: false });
      if (filter && filter !== 'all') {
        query = query.eq('payment_status', filter);
      }
      const offset = payments.length;
      const { data: paymentRows } = await (query as any).range(offset, offset + PAGE_SIZE - 1);
      const rows: any[] = (paymentRows as any[]) || [];

      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, name, email').in('id', userIds as string[])
        : { data: [] };
      const usersMap = new Map((users || []).map((u: any) => [u.id, u]));

      const enrichedNext = await Promise.all(rows.map(async (r: any) => {
        const serviceData = await getServiceDetails(r.reservation_id);
        return {
          ...r,
          users: r.user_id ? usersMap.get(r.user_id) : undefined,
          calculatedAmount: r.reservation?.total_amount || 0,
          serviceData
        };
      }));

      setPayments(prev => prev.concat(enrichedNext));
      if ((enrichedNext?.length || 0) < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      console.error('다음 페이지 로드 실패:', e);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // 서비스 상세 정보 조회 함수 (간소화된 버전)
  const getServiceDetails = async (reservationId: string) => {
    if (!reservationId) {
      console.log('❌ reservationId가 없습니다:', reservationId);
      return { total: 0, services: [] };
    }

    console.log('🔍 서비스 상세 정보 조회 시작:', reservationId);

    try {
      const services: any[] = [];
      let total = 0;

      // 1. 크루즈 객실 서비스 조회
      const { data: cruiseData, error: cruiseError } = await supabase
        .from('reservation_cruise')
        .select('*')
        .eq('reservation_id', reservationId);

      if (cruiseError) {
        console.error('크루즈 예약 조회 오류:', cruiseError);
      } else if (cruiseData && cruiseData.length > 0) {
        console.log('🚢 크루즈 데이터:', cruiseData);
        for (const cruise of cruiseData) {
          if (cruise.room_price_code) {
            const { data: roomPrice, error: roomPriceError } = await supabase
              .from('room_price')
              .select('price, room_code, room_type')
              .eq('room_code', cruise.room_price_code)
              .maybeSingle();

            if (roomPriceError) {
              console.error('객실 가격 조회 오류:', roomPriceError);
            } else if (roomPrice?.price) {
              const unitPrice = Number(roomPrice.price);
              const quantity = Number(cruise.guest_count) || 1;
              const roomAmount = unitPrice * quantity;
              services.push({
                type: `크루즈 객실 (${roomPrice.room_type || cruise.room_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: '명',
                amount: roomAmount
              });
              total += roomAmount;
              console.log('✅ 크루즈 객실:', roomAmount, '동');
            }
          }
        }
      }

      // 2. 크루즈 차량 서비스 조회
      const { data: cruiseCarData, error: cruiseCarError } = await supabase
        .from('reservation_cruise_car')
        .select('*')
        .eq('reservation_id', reservationId);

      if (cruiseCarError) {
        console.error('크루즈 차량 예약 조회 오류:', cruiseCarError);
      } else if (cruiseCarData && cruiseCarData.length > 0) {
        console.log('🚗 크루즈 차량 데이터:', cruiseCarData);
        for (const car of cruiseCarData) {
          if (car.car_price_code) {
            const { data: carPrice, error: carPriceError } = await supabase
              .from('car_price')
              .select('price, car_code, car_type')
              .eq('car_code', car.car_price_code)
              .maybeSingle();

            if (carPriceError) {
              console.error('차량 가격 조회 오류:', carPriceError);
            } else if (carPrice?.price) {
              const unitPrice = Number(carPrice.price);
              const quantity = Number(car.car_count) || 1;
              const carAmount = unitPrice * quantity;
              services.push({
                type: `크루즈 차량 (${carPrice.car_type || car.car_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: '대',
                amount: carAmount
              });
              total += carAmount;
              console.log('✅ 크루즈 차량:', carAmount, '동');
            }
          }
        }
      }

      // 3. 공항 서비스 조회
      const { data: airportData, error: airportError } = await supabase
        .from('reservation_airport')
        .select('*')
        .eq('reservation_id', reservationId);

      if (airportError) {
        console.error('공항 예약 조회 오류:', airportError);
      } else if (airportData && airportData.length > 0) {
        console.log('✈️ 공항 데이터:', airportData);
        for (const airport of airportData) {
          if (airport.airport_price_code) {
            const { data: airportPrice, error: airportPriceError } = await supabase
              .from('airport_price')
              .select('price, airport_code, airport_route')
              .eq('airport_code', airport.airport_price_code)
              .maybeSingle();

            if (airportPriceError) {
              console.error('공항 가격 조회 오류:', airportPriceError);
            } else if (airportPrice?.price) {
              const unitPrice = Number(airportPrice.price);
              const quantity = Number(airport.ra_passenger_count) || 1;
              const airportAmount = unitPrice * quantity;
              services.push({
                type: `공항 서비스 (${airportPrice.airport_route || airport.airport_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: '명',
                amount: airportAmount
              });
              total += airportAmount;
              console.log('✅ 공항 서비스:', airportAmount, '동');
            }
          }
        }
      }

      // 4. 호텔 서비스 조회
      const { data: hotelData, error: hotelError } = await supabase
        .from('reservation_hotel')
        .select('*')
        .eq('reservation_id', reservationId);

      if (hotelError) {
        console.error('호텔 예약 조회 오류:', hotelError);
      } else if (hotelData && hotelData.length > 0) {
        console.log('🏨 호텔 데이터:', hotelData);
        for (const hotel of hotelData) {
          if (hotel.hotel_price_code) {
            const { data: hotelPrice, error: hotelPriceError } = await supabase
              .from('hotel_price')
              .select('price, hotel_code, hotel_name')
              .eq('hotel_code', hotel.hotel_price_code)
              .maybeSingle();

            if (hotelPriceError) {
              console.error('호텔 가격 조회 오류:', hotelPriceError);
            } else if (hotelPrice?.price) {
              const unitPrice = Number(hotelPrice.price);
              const nights = Number(hotel.schedule?.match(/\d+/)?.[0]) || 1; // schedule에서 숫자 추출
              const rooms = Number(hotel.room_count) || 1;
              const quantity = nights * rooms;
              const hotelAmount = unitPrice * quantity;
              services.push({
                type: `호텔 (${hotelPrice.hotel_name || hotel.hotel_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: `${nights}박 ${rooms}실`,
                amount: hotelAmount
              });
              total += hotelAmount;
              console.log('✅ 호텔 서비스:', hotelAmount, '동');
            }
          } else if (hotel.total_price && Number(hotel.total_price) > 0) {
            // 가격 코드가 없고 total_price가 있는 경우
            const hotelAmount = Number(hotel.total_price);
            const quantity = Number(hotel.room_count) || 1;
            services.push({
              type: `호텔 (코드없음)`,
              unitPrice: hotelAmount, // total_price를 단가로 사용
              quantity: quantity,
              quantityUnit: '실',
              amount: hotelAmount
            });
            total += hotelAmount;
            console.log('✅ 호텔 서비스 (총액):', hotelAmount, '동');
          }
        }
      }

      // 5. 렌터카 서비스 조회 (rent_price 테이블 사용)
      const { data: rentcarData, error: rentcarError } = await supabase
        .from('reservation_rentcar')
        .select('*')
        .eq('reservation_id', reservationId);

      if (rentcarError) {
        console.error('렌터카 예약 조회 오류:', rentcarError);
      } else if (rentcarData && rentcarData.length > 0) {
        console.log('🚗 렌터카 데이터:', rentcarData);
        for (const rentcar of rentcarData) {
          if (rentcar.rentcar_price_code) {
            const { data: rentPrice, error: rentPriceError } = await supabase
              .from('rent_price')
              .select('price, rent_code, rent_type')
              .eq('rent_code', rentcar.rentcar_price_code)
              .maybeSingle();

            if (rentPriceError) {
              console.error('렌터카 가격 조회 오류:', rentPriceError);
            } else if (rentPrice?.price) {
              const unitPrice = Number(rentPrice.price);
              const days = Math.max(1, Math.ceil((new Date(rentcar.pickup_datetime).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) || 1;
              const carCount = Number(rentcar.rentcar_count) || 1;
              const quantity = days * carCount;
              const rentcarAmount = unitPrice * quantity;
              services.push({
                type: `렌터카 (${rentPrice.rent_type || rentcar.rentcar_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: `${days}일 ${carCount}대`,
                amount: rentcarAmount
              });
              total += rentcarAmount;
              console.log('✅ 렌터카 서비스:', rentcarAmount, '동');
            }
          } else if (rentcar.total_price && Number(rentcar.total_price) > 0) {
            // 가격 코드가 없고 total_price가 있는 경우
            const rentcarAmount = Number(rentcar.total_price);
            const quantity = Number(rentcar.rentcar_count) || 1;
            services.push({
              type: `렌터카 (코드없음)`,
              unitPrice: rentcarAmount, // total_price를 단가로 사용
              quantity: quantity,
              quantityUnit: '대',
              amount: rentcarAmount
            });
            total += rentcarAmount;
            console.log('✅ 렌터카 서비스 (총액):', rentcarAmount, '동');
          }
        }
      }

      // 6. 투어 서비스 조회
      const { data: tourData, error: tourError } = await supabase
        .from('reservation_tour')
        .select('*')
        .eq('reservation_id', reservationId);

      if (tourError) {
        console.error('투어 예약 조회 오류:', tourError);
      } else if (tourData && tourData.length > 0) {
        console.log('🗺️ 투어 데이터:', tourData);
        for (const tour of tourData) {
          if (tour.tour_price_code) {
            const { data: tourPrice, error: tourPriceError } = await supabase
              .from('tour_price')
              .select('price, tour_code, tour_name')
              .eq('tour_code', tour.tour_price_code)
              .maybeSingle();

            if (tourPriceError) {
              console.error('투어 가격 조회 오류:', tourPriceError);
            } else if (tourPrice?.price) {
              const unitPrice = Number(tourPrice.price);
              const quantity = Number(tour.tour_capacity) || 1;
              const tourAmount = unitPrice * quantity;
              services.push({
                type: `투어 (${tourPrice.tour_name || tour.tour_price_code})`,
                unitPrice: unitPrice,
                quantity: quantity,
                quantityUnit: '명',
                amount: tourAmount
              });
              total += tourAmount;
              console.log('✅ 투어 서비스:', tourAmount, '동');
            }
          } else if (tour.total_price && Number(tour.total_price) > 0) {
            // 가격 코드가 없고 total_price가 있는 경우
            const tourAmount = Number(tour.total_price);
            const quantity = Number(tour.tour_capacity) || 1;
            services.push({
              type: `투어 (코드없음)`,
              unitPrice: tourAmount, // total_price를 단가로 사용
              quantity: quantity,
              quantityUnit: '명',
              amount: tourAmount
            });
            total += tourAmount;
            console.log('✅ 투어 서비스 (총액):', tourAmount, '동');
          }
        }
      }

      // 7. 차량 서비스 조회 (reservation_car_sht)
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('reservation_car_sht')
        .select('*')
        .eq('reservation_id', reservationId);

      if (vehicleError) {
        console.error('차량 예약 조회 오류:', vehicleError);
      } else if (vehicleData && vehicleData.length > 0) {
        console.log('🚗 차량 데이터:', vehicleData);
        for (const vehicle of vehicleData) {
          // 차량 서비스는 보통 정액이므로 기본 금액 설정 (실제로는 car_price 테이블에서 조회해야 함)
          const unitPrice = 50000; // 기본 차량 서비스 단가
          const quantity = Number(vehicle.seat_number) || 1;
          const vehicleAmount = unitPrice * quantity;
          services.push({
            type: `차량 서비스 (${vehicle.vehicle_number || '번호없음'})`,
            unitPrice: unitPrice,
            quantity: quantity,
            quantityUnit: '좌석',
            amount: vehicleAmount
          });
          total += vehicleAmount;
          console.log('✅ 차량 서비스:', vehicleAmount, '동');
        }
      }

      console.log('📊 서비스 상세 정보 완료:', {
        reservationId,
        서비스수: services.length,
        총금액: total,
        서비스목록: services
      });

      return { total, services };
    } catch (error) {
      console.error('❌ 서비스 상세 정보 조회 실패:', reservationId, error);
      return { total: 0, services: [] };
    }
  };

  // 필터 변경 시 초기화 후 첫 페이지 로드
  useEffect(() => {
    setPayments([]);
    setHasMore(true);
    loadPayments();
  }, [filter]);

  // 필터/검색
  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      (payment.users?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.users?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(payment.reservation_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || payment.payment_status === filter;
    return matchesSearch && matchesFilter;
  });

  // 전체 선택
  const handleSelectAll = () => {
    if (selectedPayments.size === filteredPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(filteredPayments.map(p => p.id)));
    }
  };
  const handleSelectPayment = (id: string) => {
    const next = new Set(selectedPayments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPayments(next);
  };

  // 결제완료 처리
  const updatePaymentStatus = async (paymentId: string, status: string) => {
    await supabase
      .from('reservation_payment')
      .update({ payment_status: status })
      .eq('id', paymentId);
    await loadPayments();
  };

  // OnePay 결제창 링크 생성
  const createPaymentLink = async (paymentId: string) => {
    try {
      setCreatingLinkId(paymentId);
      const res = await fetch('/api/payments/onepay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        alert(json?.error || '결제 링크 생성에 실패했습니다.');
        return null;
      }
      return json.url as string;
    } catch (e) {
      console.error('결제 링크 생성 실패:', e);
      alert('결제 링크 생성 중 오류가 발생했습니다.');
      return null;
    } finally {
      setCreatingLinkId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('링크가 클립보드에 복사되었습니다.');
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // 일괄 결제완료 처리
  const handleBulkComplete = async () => {
    if (selectedPayments.size === 0) {
      alert('선택된 결제가 없습니다.');
      return;
    }

    const selectedCount = selectedPayments.size;
    const confirmed = confirm(`선택된 ${selectedCount}건의 결제를 모두 완료 처리하시겠습니까?`);

    if (!confirmed) return;

    try {
      setBulkCompleting(true);
      const selectedIds = Array.from(selectedPayments);

      // 사전 조회: 예약 ID 매핑 확보 (배치)
      let beforeRows: any[] = [];
      for (const batch of chunkArray(selectedIds, 100)) {
        const { data: rows, error: preErr } = await supabase
          .from('reservation_payment')
          .select('id, reservation_id, payment_status')
          .in('id', batch);
        if (preErr) throw preErr;
        beforeRows = beforeRows.concat(rows || []);
      }

      // 일괄 업데이트 시도 + 영향 행 수 확인 (배치)
      let updatedRowsAll: any[] = [];
      let lastError: any = null;
      for (const batch of chunkArray(selectedIds, 100)) {
        const { data: updatedRows, error } = await supabase
          .from('reservation_payment')
          .update({ payment_status: 'completed', updated_at: new Date().toISOString() })
          .in('id', batch)
          .select('id, reservation_id, payment_status');
        if (error) {
          lastError = error;
        }
        updatedRowsAll = updatedRowsAll.concat(updatedRows || []);
      }

      let succeededIds = new Set<string>((updatedRowsAll || []).map((r: any) => String(r.id)));

      // 영향이 없는 경우(정책/조건 문제 등), 개별 폴백 시도
      if (succeededIds.size === 0 && !lastError) {
        for (const pid of selectedIds) {
          const { data: row, error: updErr } = await supabase
            .from('reservation_payment')
            .update({ payment_status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', pid)
            .select('id, reservation_id, payment_status')
            .maybeSingle();
          if (!updErr && row?.id) {
            succeededIds.add(String(row.id));
          }
        }
      }

      if (lastError) throw lastError;

      const successCount = succeededIds.size;
      if (successCount === 0) {
        throw new Error('업데이트된 행이 없습니다. 권한 정책(RLS) 또는 선택 항목을 확인하세요.');
      }

      // 완료된 예약의 확인서 상태 자동 생성(upsert)
      const successRows = (beforeRows || []).filter(r => succeededIds.has(String(r.id)));
      const reservationIds = Array.from(new Set(successRows.map((r: any) => r.reservation_id).filter(Boolean)));
      if (reservationIds.length > 0) {
        // 이미 존재하는 상태 조회 (배치)
        let existingSet = new Set<string>();
        for (const batch of chunkArray(reservationIds, 100)) {
          const { data: csRows } = await supabase
            .from('confirmation_status')
            .select('reservation_id')
            .in('reservation_id', batch);
          (csRows || []).forEach((r: any) => existingSet.add(r.reservation_id));
        }
        const missing = reservationIds.filter(id => !existingSet.has(id));
        if (missing.length > 0) {
          // 예약에서 quote_id 매핑 가져오기 (배치)
          const qMap = new Map<string, string | null>();
          for (const batch of chunkArray(missing, 100)) {
            const { data: rRows } = await supabase
              .from('reservation')
              .select('re_id, re_quote_id')
              .in('re_id', batch);
            (rRows || []).forEach((r: any) => qMap.set(r.re_id, r.re_quote_id));
          }
          // 삽입도 배치로 분할
          const insertsAll = missing.map((rid: string) => ({
            reservation_id: rid,
            quote_id: qMap.get(rid) || null,
            status: 'waiting',
          }));
          for (const batch of chunkArray(insertsAll, 100)) {
            await supabase.from('confirmation_status').insert(batch);
          }
        }
      }

      alert(`${successCount}건의 결제가 완료 처리되었습니다.`);
      setSelectedPayments(new Set());
      await loadPayments();
    } catch (error) {
      console.error('일괄 결제완료 처리 실패:', error);
      alert('일괄 결제완료 처리 중 오류가 발생했습니다.');
    } finally {
      setBulkCompleting(false);
    }
  };

  // 예약확인서 페이지로 이동
  const navigateToConfirmation = (payment: any) => {
    // 예약 ID와 결제 정보를 쿼리 파라미터로 전달
    const params = new URLSearchParams({
      reservationId: payment.reservation_id || '',
      paymentId: payment.id || '',
      userId: payment.user_id || ''
    });
    router.push(`/manager/confirmation?${params.toString()}`);
  };

  // 통계
  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const completedAmount = payments.filter(p => p.payment_status === 'completed').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // 로딩 UI
  if (loading) {
    return (
      <ManagerLayout title="결제 관리" activeTab="payments">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">결제 정보를 불러오는 중...</p>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="결제 관리" activeTab="payments">
      <div className="space-y-6">
        {/* 결제 통계 */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 결제 금액</p>
                <p className="text-lg font-bold text-gray-900">
                  {totalAmount.toLocaleString()} 동
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600">완료된 결제</p>
                <p className="text-lg font-bold text-gray-900">
                  {completedAmount.toLocaleString()} 동
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600">결제 건수</p>
                <p className="text-lg font-bold text-gray-900">
                  {payments.length}건
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 검색/필터 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex gap-4 mb-4 flex-wrap items-center">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="고객명, 이메일, 예약ID로 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:border-green-500 text-sm"
              />
            </div>
            <div className="flex gap-2 items-center">
              {[
                { value: 'all', label: '전체' },
                { value: 'pending', label: '결제대기' },
                { value: 'completed', label: '결제완료' },
                { value: 'failed', label: '실패' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-2 rounded text-sm border transition-colors font-medium ${filter === opt.value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-green-50'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <button
                onClick={generatePaymentRecords}
                disabled={generating}
                className={`ml-2 px-4 py-2 text-white rounded text-sm transition-colors ${generating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                title="확정된 예약을 기반으로 결제 레코드를 생성합니다"
              >
                {generating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    결제 자료 생성 중...
                  </div>
                ) : (
                  '결제 자료 가져오기'
                )}
              </button>
            </div>
          </div>
          {/* 전체 선택 및 일괄 처리 */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              {selectedPayments.size === filteredPayments.length && filteredPayments.length > 0 ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
              )}
              전체 선택 ({selectedPayments.size}/{filteredPayments.length})
            </button>

            {selectedPayments.size > 0 && (
              <button
                onClick={handleBulkComplete}
                disabled={bulkCompleting}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm ${bulkCompleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                <CheckCircle className="w-4 h-4" />
                {bulkCompleting ? '처리 중...' : `일괄결제완료 (${selectedPayments.size}건)`}
              </button>
            )}
          </div>
        </div>

        {/* 결제 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <CreditCard className="w-6 h-6 text-green-500" />
              결제 목록 ({filteredPayments.length}건)
            </h3>
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-500">결제 데이터가 없습니다.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`bg-white rounded-lg shadow-sm p-6 hover:bg-gray-50 transition-colors ${selectedPayments.has(payment.id)
                      ? 'border-2 border-blue-500'
                      : 'border border-gray-200'
                      }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleSelectPayment(payment.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {selectedPayments.has(payment.id) ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-400 rounded"></div>
                          )}
                        </button>
                        <div className="p-3 bg-gray-100 rounded-full">
                          <CreditCard className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-base text-gray-900">
                            {payment.users?.name
                              ? payment.users.name
                              : payment.users?.email
                                ? payment.users.email
                                : '고객명 없음'}
                          </h4>
                        </div>
                      </div>
                      {/* 카드 내부 정보를 1열로 세로 배치 */}
                      <div className="flex flex-col gap-1 text-sm text-gray-700 mt-2 w-full">
                        <div>
                          <span className="font-semibold">예약 ID: </span>
                          {payment.reservation_id
                            ? String(payment.reservation_id).slice(0, 8) + '...'
                            : '-'}
                        </div>
                        <div>
                          <span className="font-semibold">이메일: </span>
                          {payment.users?.email || '-'}
                        </div>
                        <div>
                          <span className="font-semibold">결제일: </span>
                          {payment.created_at
                            ? new Date(payment.created_at).toLocaleDateString()
                            : '-'}
                        </div>
                        <div>
                          <span className="font-semibold">상태: </span>
                          <span className="ml-1">
                            {getPaymentStatusText(payment.payment_status)}
                          </span>
                          {payment.payment_status === 'failed' && (
                            <span className="ml-2 text-xs text-red-600">(결제 미완료: 고객 재시도 필요)</span>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold">결제수단: </span>
                          {getPaymentMethodText(payment.payment_method)}
                        </div>
                        <div>
                          <span className="font-semibold">금액: </span>
                          <span className="text-lg font-bold text-green-700">
                            {payment.calculatedAmount > 0
                              ? payment.calculatedAmount.toLocaleString()
                              : Number(payment.amount || 0).toLocaleString()}
                            동
                          </span>
                          {payment.calculatedAmount > 0 &&
                            Math.abs(payment.calculatedAmount - Number(payment.amount || 0)) > 1 && (
                              <span className="ml-2 text-xs text-orange-600">
                                (저장금액: {Number(payment.amount || 0).toLocaleString()}동)
                              </span>
                            )}
                        </div>
                        {/* 게이트웨이/거래번호/원문 응답 (있을 때만 표시) */}
                        {(payment.gateway || payment.transaction_id || payment.raw_response) && (
                          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded flex flex-col gap-2">
                            <div className="text-xs text-gray-600">
                              <span className="font-semibold">게이트웨이:</span> {payment.gateway || '-'}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                              <span className="font-semibold">거래번호:</span> <span>{payment.transaction_id || '-'}</span>
                              {payment.transaction_id && (
                                <button
                                  className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                                  onClick={() => copyToClipboard(String(payment.transaction_id))}
                                  title="거래번호 복사"
                                >
                                  복사
                                </button>
                              )}
                            </div>
                            {payment.raw_response && (
                              <details className="text-xs text-gray-700">
                                <summary className="cursor-pointer select-none">원문 응답 미리보기</summary>
                                <pre className="mt-1 bg-white p-2 rounded border max-h-48 overflow-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(payment.raw_response, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                        {/* 서비스별 금액 상세 정보 */}
                        {payment.serviceData?.services && payment.serviceData.services.length > 0 ? (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded flex flex-col gap-1">
                            <div className="text-sm font-medium text-green-800 mb-2">💰 서비스별 금액 상세</div>
                            <div className="flex flex-col gap-2">
                              {payment.serviceData.services.map((service: any, idx: number) => (
                                <div key={idx} className="flex flex-col gap-1 p-2 bg-white rounded border border-green-100">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-green-800">{service.type}</span>
                                    <span className="text-xs font-bold text-green-700">{service.amount.toLocaleString()}동</span>
                                  </div>
                                  <div className="text-xs text-green-600">
                                    {service.unitPrice?.toLocaleString() || 0}동 × {service.quantity || 1}{service.quantityUnit ? ` ${service.quantityUnit}` : ''} = {service.amount.toLocaleString()}동
                                  </div>
                                </div>
                              ))}
                              <div className="border-t border-green-300 mt-2 pt-2 flex justify-between text-sm font-bold text-green-900">
                                <span>총 계산 금액:</span>
                                <span>{payment.calculatedAmount?.toLocaleString() || 0}동</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                            <div className="text-sm text-gray-600">
                              📋 서비스 상세 정보 없음
                              <div className="text-xs text-gray-500 mt-1">
                                예약 ID: {payment.reservation_id || '없음'}
                              </div>
                              {payment.serviceData && (
                                <div className="text-xs text-gray-500">
                                  디버그: {JSON.stringify(payment.serviceData)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* 버튼들을 한 행에 배치 */}
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {/* 상세보기 버튼 (항상 표시) */}
                          <button
                            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
                            onClick={() => openDetailModal(payment)}
                            title="결제 상세 정보 보기"
                          >
                            <Eye className="w-4 h-4" />
                            상세보기
                          </button>

                          {/* 결제 창 생성/복사 (pending 상태에서만 노출) */}
                          {payment.payment_status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                disabled={!!creatingLinkId}
                                onClick={async () => {
                                  const url = await createPaymentLink(payment.id);
                                  if (url) window.open(url, '_blank');
                                }}
                              >
                                {creatingLinkId === payment.id ? '생성중...' : '결제창 열기'}
                              </button>
                              <button
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                disabled={!!creatingLinkId}
                                onClick={async () => {
                                  const url = await createPaymentLink(payment.id);
                                  if (url) await copyToClipboard(url);
                                }}
                              >
                                링크 복사
                              </button>
                            </div>
                          )}

                          {/* 예약확인서 생성 버튼 (completed 상태에서만 노출) */}
                          {payment.payment_status === 'completed' && (
                            <button
                              className="px-4 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                              onClick={() => navigateToConfirmation(payment)}
                            >
                              예약확인서 생성
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2 mt-2">
                        {getPaymentStatusIcon(payment.payment_status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* 더 불러오기 */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={loadMorePayments}
                  disabled={loadingMore}
                  className={`px-4 py-2 rounded text-sm text-white ${loadingMore ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {loadingMore ? '불러오는 중...' : '더 불러오기'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 결제 상세 모달 */}
      {selectedReservation && (
        <PaymentDetailModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          payment={selectedReservation}
        />
      )}
    </ManagerLayout>
  );
}
