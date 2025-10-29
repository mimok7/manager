'use client';
import { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import ConfirmationGenerateModal from '@/components/ConfirmationGenerateModal';
import supabase from '@/lib/supabase';
import Link from 'next/link';

// 예약 단위 카드 렌더링을 위해 ReservationWithQuoteInfo 타입 정의
interface ReservationWithQuoteInfo {
    re_id: string;
    re_quote_id: string;
    re_type: string;
    re_status: string;
    quote_title: string;
    user_name: string;
    user_email: string;
    user_phone: string;
    created_at: string;
    total_price: number;
    payment_status: string;
    status?: string;
    confirmed_at?: string | null;
    confirmation_status?: 'waiting' | 'generated' | 'sent'; // 확인서 상태 추가
    services?: Array<{ type: string, data: any[] }>; // 서비스 정보 추가
    serviceData?: { total: number, services: any[] }; // 서비스 상세 금액 정보 추가
}

export default function ManagerConfirmationPage() {
    const [quotes, setQuotes] = useState<ReservationWithQuoteInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('paid'); // paid만 기본으로
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set()); // 선택된 카드들
    const [statusFilter, setStatusFilter] = useState<string>('waiting'); // 기본: 확인서 대기

    // 페이지네이션 상태
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // 팝업 모달 상태 추가
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
    // 서비스 상세 지연 조회 로딩 상태
    const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadQuotesWithReservations();
    }, [statusFilter, page]);

    // 서비스 상세 정보 조회 함수 (payments 페이지와 동일)
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
                            const nights = Number(hotel.schedule?.match(/\d+/)?.[0]) || 1;
                            const rooms = Number(hotel.room_count) || 1;
                            const quantity = nights * rooms;
                            const hotelAmount = unitPrice * quantity;
                            services.push({
                                type: `호텔 서비스 (${hotelPrice.hotel_name || hotel.hotel_price_code})`,
                                unitPrice: unitPrice,
                                quantity: quantity,
                                quantityUnit: '박',
                                amount: hotelAmount
                            });
                            total += hotelAmount;
                            console.log('✅ 호텔 서비스:', hotelAmount, '동');
                        }
                    }
                }
            }

            // 5. 렌터카 서비스 조회
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
                        const { data: rentcarPrice, error: rentcarPriceError } = await supabase
                            .from('rent_price')
                            .select('*')
                            .eq('rent_code', rentcar.rentcar_price_code)
                            .maybeSingle();

                        if (rentcarPriceError) {
                            console.error('렌터카 가격 조회 오류:', rentcarPriceError);
                        } else if (rentcarPrice?.price) {
                            const unitPrice = Number(rentcarPrice.price);
                            const quantity = Number(rentcar.rental_days) || 1;
                            const rentcarAmount = unitPrice * quantity;
                            services.push({
                                type: `렌터카 서비스 (${rentcarPrice.rent_name || rentcarPrice.rentcar_name || rentcar.rentcar_price_code})`,
                                unitPrice: unitPrice,
                                quantity: quantity,
                                quantityUnit: '일',
                                amount: rentcarAmount
                            });
                            total += rentcarAmount;
                            console.log('✅ 렌터카 서비스:', rentcarAmount, '동');
                        }
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
                console.log('🎯 투어 데이터:', tourData);
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
                            const quantity = Number(tour.participant_count) || 1;
                            const tourAmount = unitPrice * quantity;
                            services.push({
                                type: `투어 서비스 (${tourPrice.tour_name || tour.tour_price_code})`,
                                unitPrice: unitPrice,
                                quantity: quantity,
                                quantityUnit: '명',
                                amount: tourAmount
                            });
                            total += tourAmount;
                            console.log('✅ 투어 서비스:', tourAmount, '동');
                        }
                    }
                }
            }

            console.log('💰 서비스 상세 조회 완료:', { total, servicesCount: services.length });
            return { total, services };

        } catch (error) {
            console.error('서비스 상세 정보 조회 실패:', error);
            return { total: 0, services: [] };
        }
    };

    const loadQuotesWithReservations = async () => {
        try {
            setLoading(true);
            // 선택된 확인서 상태 기반 서버측 선필터링 구성
            let reservationIdsFilter: string[] | null = null;
            let excludeReservationIds: string[] = [];
            if (statusFilter && statusFilter !== 'all') {
                try {
                    if (statusFilter === 'waiting') {
                        // waiting = confirmation_status가 없거나 status가 waiting
                        // 비대기(생성/발송) 예약 ID를 조회하여 제외 필터로 사용
                        const { data: nonWaiting } = await supabase
                            .from('confirmation_status')
                            .select('reservation_id, status')
                            .in('status', ['generated', 'sent']);
                        excludeReservationIds = (nonWaiting || []).map((r: any) => r.reservation_id).filter(Boolean);
                    } else {
                        // generated 또는 sent만 포함
                        const { data: csData } = await supabase
                            .from('confirmation_status')
                            .select('reservation_id')
                            .eq('status', statusFilter);
                        const ids = (csData || []).map((r: any) => r.reservation_id).filter(Boolean);
                        // 결과가 0이면 바로 빈 결과 반환하도록 빈 배열로 표시
                        reservationIdsFilter = ids;
                        if (ids.length === 0) {
                            setQuotes([]);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('확인서 상태 선필터링 실패(무시):', (e as any)?.message || e);
                }
            }

            // 결제 테이블에서 payment_status가 'completed'인 데이터만 조회 (+선택적으로 reservation_id in 필터)
            let paymentsQuery = supabase
                .from('reservation_payment')
                .select('reservation_id, amount, payment_method, payment_status, created_at, user_id')
                .eq('payment_status', 'completed')
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1); // 페이지네이션 적용
            if (reservationIdsFilter) {
                paymentsQuery = paymentsQuery.in('reservation_id', reservationIdsFilter);
            }
            if (excludeReservationIds && excludeReservationIds.length > 0) {
                // PostgREST in-list 형식 문자열 생성: ("id1","id2")
                const list = `(${excludeReservationIds.map(id => `"${id}"`).join(',')})`;
                paymentsQuery = (paymentsQuery as any).not('reservation_id', 'in', list);
            }
            const { data: paymentsData, error } = await paymentsQuery as any;
            if (error) throw error;

            // 동일 예약에 다중 결제가 있을 수 있으니 최신 결제 기준으로 예약을 중복 제거
            const sortedPayments = (paymentsData || []).slice().sort((a: any, b: any) => {
                const at = new Date(a.created_at).getTime();
                const bt = new Date(b.created_at).getTime();
                return at - bt; // 오래된 것 먼저, 뒤에서 마지막 값이 최신으로 남도록
            });
            const uniquePaymentsMap = new Map<string, any>();
            for (const p of sortedPayments) {
                if (p?.reservation_id) uniquePaymentsMap.set(p.reservation_id, p);
            }
            const uniquePayments = Array.from(uniquePaymentsMap.values());
            // 전체 페이지 수 계산용 (추후 totalCount 활용 가능)
            // const totalCount = paymentsData?.length || 0;

            // user_id로 고객명/연락처 병렬 조회
            const userIds = Array.from(new Set((uniquePayments || []).map((p: any) => p.user_id).filter(Boolean)));
            let usersMap = new Map();
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, name, phone_number, email')
                    .in('id', userIds);
                usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));
            }

            // 예약 ID들로 실제 예약 데이터와 서비스 정보 조회
            const reservationIds = (uniquePayments || []).map(p => p.reservation_id);
            let reservationsMap = new Map();
            // 서비스 테이블은 초기 로딩 속도를 위해 지연 조회로 전환 (여기서는 조회하지 않음)

            if (reservationIds.length > 0) {
                // 예약 기본 정보만 조회 (서비스 정보는 지연 로드)
                const { data: reservationsData } = await supabase
                    .from('reservation')
                    .select('re_id, re_quote_id, re_type, re_status')
                    .in('re_id', reservationIds);
                reservationsMap = new Map((reservationsData || []).map((r: any) => [r.re_id, r]));
            }

            // 확인서 상태 정보 조회
            let confirmationStatusMap = new Map();
            if (reservationIds.length > 0) {
                const { data: confirmationData, error: confirmationError } = await supabase
                    .from('confirmation_status')
                    .select('reservation_id, status, generated_at, sent_at')
                    .in('reservation_id', reservationIds);
                if (confirmationError) {
                    console.warn('확인서 상태 테이블 조회 실패 또는 미존재(무시):', confirmationError.message);
                }
                confirmationStatusMap = new Map((confirmationData || []).map((c: any) => [c.reservation_id, c]));
            }

            // quote_id로 실제 견적 제목 조회
            const quoteIds = Array.from(new Set((uniquePayments || []).map(p => {
                const reservation = reservationsMap.get(p.reservation_id);
                return reservation?.re_quote_id;
            }).filter(Boolean)));

            let quotesMap = new Map();
            if (quoteIds.length > 0) {
                const { data: quotesData } = await supabase
                    .from('quote')
                    .select('id, title')
                    .in('id', quoteIds);
                quotesMap = new Map((quotesData || []).map((q: any) => [q.id, q]));
            }

            const paidReservations = await Promise.all((uniquePayments || []).map(async (p: any) => {
                const user = usersMap.get(p.user_id) || {};
                const reservation = reservationsMap.get(p.reservation_id) || {};
                const services = [] as any[]; // 초기에는 비워두고 필요 시 로딩
                const quote = quotesMap.get(reservation.re_quote_id) || {};
                const confirmationStatus = confirmationStatusMap.get(p.reservation_id) || {};

                // 서비스 상세 정보는 지연 로드 (초기에는 조회하지 않음)
                const serviceData = undefined as any;

                console.log('🔍 예약 데이터 처리:', {
                    reservation_id: p.reservation_id,
                    re_quote_id: reservation.re_quote_id,
                    quote: quote,
                    user: user
                });

                return {
                    re_id: p.reservation_id,
                    re_quote_id: reservation.re_quote_id || '',
                    re_type: reservation.re_type || '',
                    re_status: reservation.re_status || '',
                    // 제목이 없을 때 아이디 노출로 인한 중복 방지를 위해 단순 '예약'으로 대체
                    quote_title: quote.title || '예약',
                    user_name: user.name || '',
                    user_email: user.email || '',
                    user_phone: user.phone_number || '',
                    created_at: p.created_at,
                    total_price: p.amount,
                    payment_status: p.payment_status,
                    status: '',
                    confirmed_at: confirmationStatus.generated_at || null,
                    confirmation_status: (confirmationStatus.status as any) || 'waiting',
                    services: services, // 서비스 정보는 지연 로드
                    serviceData: serviceData, // 상세 금액 정보는 지연 로드
                };
            }));
            setQuotes(paidReservations);
        } catch (error) {
            console.error('견적 데이터 로드 실패:', error);

        } finally {
            setLoading(false);
        }
    };

    // 서비스 상세 지연 조회 트리거
    const fetchServiceDetailsFor = async (reservationId: string) => {
        if (!reservationId) return;
        setLoadingDetails(prev => new Set(prev).add(reservationId));
        try {
            const details = await getServiceDetails(reservationId);
            // 상세 내역의 type 목록으로 서비스 뱃지 구성 (간단형)
            const uniqueTypes = Array.from(new Set((details?.services || []).map((s: any) => s.type?.split(' ')[0])));
            const servicesForBadges = uniqueTypes.map(t => ({ type: t || '서비스', data: [] }));
            setQuotes(prev => prev.map(q => q.re_id === reservationId ? { ...q, serviceData: details, services: servicesForBadges } : q));
        } catch (e) {
            console.error('서비스 상세 지연 조회 실패:', e);
        } finally {
            setLoadingDetails(prev => {
                const next = new Set(prev);
                next.delete(reservationId);
                return next;
            });
        }
    };

    // 서비스 타입별 표시 함수
    const renderServiceBadges = (reservation: ReservationWithQuoteInfo) => {
        const services = reservation.services || [];
        const serviceColors = {
            '크루즈': 'bg-blue-100 text-blue-800',
            '크루즈 차량': 'bg-purple-100 text-purple-800',
            '공항': 'bg-green-100 text-green-800',
            '호텔': 'bg-orange-100 text-orange-800',
            '렌터카': 'bg-red-100 text-red-800',
            '투어': 'bg-indigo-100 text-indigo-800',
            '차량': 'bg-gray-100 text-gray-800'
        } as Record<string, string>;

        if (services.length === 0) {
            return <span className="text-gray-400 text-xs">서비스 정보 없음</span>;
        }

        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {services.map((service, index) => {
                    // 공항 서비스의 경우 세부 카테고리 표시
                    if (service.type === '공항' && service.data && service.data.length > 0) {
                        return service.data.map((airportService: any, airportIndex: number) => {
                            const category = airportService.ra_airport_location?.includes('픽업') ? '공항/픽업' :
                                airportService.ra_airport_location?.includes('샌딩') ? '공항/샌딩' : '공항';
                            return (
                                <span
                                    key={`${index}-${airportIndex}`}
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${serviceColors['공항']}`}
                                >
                                    {category}
                                </span>
                            );
                        });
                    }

                    return (
                        <span
                            key={index}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${serviceColors[service.type as keyof typeof serviceColors] || 'bg-gray-100 text-gray-800'}`}
                        >
                            {service.type}
                        </span>
                    );
                })}
            </div>
        );
    };    // 카드 선택 토글
    const toggleCardSelection = (reservationId: string) => {
        const newSelected = new Set(selectedCards);
        if (newSelected.has(reservationId)) {
            newSelected.delete(reservationId);
        } else {
            newSelected.add(reservationId);
        }
        setSelectedCards(newSelected);
    };

    // 전체 선택/해제
    const toggleAllSelection = () => {
        if (selectedCards.size === filteredQuotes.length) {
            setSelectedCards(new Set());
        } else {
            setSelectedCards(new Set(filteredQuotes.map(q => q.re_id)));
        }
    };

    // 일괄 생성 처리
    const handleBulkGeneration = async () => {
        if (selectedCards.size === 0) {
            alert('생성할 확인서를 선택해주세요.');
            return;
        }
        try {
            const selectedReservations = Array.from(selectedCards);
            const { data: updatedRows, error: updateErr } = await supabase
                .from('confirmation_status')
                .update({ status: 'generated' })
                .in('reservation_id', selectedReservations)
                .select('reservation_id');

            if (updateErr) {
                console.warn('일괄 업데이트 오류(무시 후 진행):', updateErr.message);
            }

            const updatedSet = new Set((updatedRows || []).map((r: any) => r.reservation_id));
            const remainingToInsert = selectedReservations.filter(id => !updatedSet.has(id));

            if (remainingToInsert.length > 0) {
                const reToQuote = new Map(quotes.map(q => [q.re_id, q.re_quote_id] as const));
                const insertPayload = remainingToInsert.map(id => ({
                    reservation_id: id,
                    quote_id: reToQuote.get(id) || null,
                    status: 'generated' as const,
                }));

                const { error: insertErr } = await supabase
                    .from('confirmation_status')
                    .insert(insertPayload);

                if (insertErr) {
                    console.warn('일괄 삽입 오류(낙관적 처리):', insertErr.message);
                }
            }

            alert(`${selectedCards.size}개의 확인서 생성이 완료되었습니다.`);
            // 낙관적 로컬 상태 반영
            const selectedSet = new Set(selectedReservations);
            setQuotes(prev => prev.map(q => selectedSet.has(q.re_id) ? { ...q, confirmation_status: 'generated' } : q));
            setSelectedCards(new Set());

            // 데이터 새로고침
            await loadQuotesWithReservations();
        } catch (error) {
            console.error('일괄 생성 실패:', error);
            alert('일괄 생성 중 오류가 발생했습니다.');
        }
    };

    // 확인서 상태별 뱃지 렌더링 함수
    const renderConfirmationStatusBadge = (confirmationStatus: string) => {
        switch (confirmationStatus) {
            case 'waiting':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">확인서 대기</span>;
            case 'generated':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">확인서 생성</span>;
            case 'sent':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">고객 발송</span>;
            default:
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">확인서 대기</span>;
        }
    };

    // 검색 및 상태 필터 적용
    const filteredQuotes = quotes.filter((reservation) => {
        // 상태 필터 적용
        if (statusFilter !== 'all' && reservation.confirmation_status !== statusFilter) {
            return false;
        }

        // 검색어 필터 적용
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            reservation.quote_title?.toLowerCase().includes(term) ||
            reservation.user_name?.toLowerCase().includes(term) ||
            reservation.user_email?.toLowerCase().includes(term) ||
            reservation.user_phone?.toLowerCase().includes(term) ||
            reservation.re_id?.toLowerCase().includes(term)
        );
    });

    // 단건 생성 버튼 핸들러: 상태를 'generated'로 업데이트하고 목록 갱신 후 모달 오픈
    const handleGenerateClick = async (reservation: ReservationWithQuoteInfo) => {
        try {
            console.log('📄 확인서 생성(단건) 실행:', {
                reservation_id: reservation.re_id,
                quote_id: reservation.re_quote_id,
            });

            // 모달을 즉시 오픈하여 작업 흐름을 끊기지 않게 함
            setSelectedQuoteId(reservation.re_quote_id);
            setIsModalOpen(true);

            // 1) 기존 행이 있으면 업데이트 (예약당 1행 규칙)
            const { error: updateError, data: updateData } = await supabase
                .from('confirmation_status')
                .update({ status: 'generated' })
                .eq('reservation_id', reservation.re_id)
                .select('reservation_id');

            if (updateError) {
                console.warn('⚠️ 업데이트 실패, 신규 생성 시도:', updateError.message);
                // 2) 없으면 삽입 (예외 상황 대비)
                const { error: insertError } = await supabase
                    .from('confirmation_status')
                    .insert({
                        reservation_id: reservation.re_id,
                        quote_id: reservation.re_quote_id,
                        status: 'generated',
                    });
                if (insertError) {
                    console.error('❌ 확인서 상태 삽입 실패(낙관적 처리로 진행):', insertError.message);
                    // 테이블이 없거나 권한 오류 등으로 실패해도 모달은 유지하고 로컬 상태를 업데이트
                    setQuotes(prev => prev.map(q => q.re_id === reservation.re_id ? { ...q, confirmation_status: 'generated' } : q));
                    return; // 서버 반영 실패 시 여기서 종료(모달은 이미 열림)
                }
            } else if (!updateData || updateData.length === 0) {
                // 업데이트가 0건이면 삽입 시도
                const { error: insertError } = await supabase
                    .from('confirmation_status')
                    .insert({
                        reservation_id: reservation.re_id,
                        quote_id: reservation.re_quote_id,
                        status: 'generated',
                    });
                if (insertError) {
                    console.error('❌ 확인서 상태 삽입 실패(낙관적 처리로 진행):', insertError.message);
                    setQuotes(prev => prev.map(q => q.re_id === reservation.re_id ? { ...q, confirmation_status: 'generated' } : q));
                    return;
                }
            }

            // 3) 목록 새로고침하여 필터에 즉시 반영
            await loadQuotesWithReservations();
            // 모달은 이미 열림 상태 유지
        } catch (e: any) {
            console.error('❌ 확인서 생성 처리 중 오류:', e?.message || e);
            // 서버 오류 시에도 미리보기는 가능해야 하므로 로컬 상태만 반영
            setQuotes(prev => prev.map(q => q.re_id === reservation.re_id ? { ...q, confirmation_status: 'generated' } : q));
        }
    };

    // 미리보기(모달) 전용 핸들러
    const handlePreviewClick = (reservation: ReservationWithQuoteInfo) => {
        if (!reservation?.re_quote_id) return;
        setSelectedQuoteId(reservation.re_quote_id);
        setIsModalOpen(true);
    };

    return (
        <ManagerLayout title="예약 확인서 발송 관리" activeTab="confirmation">
            <div className="py-8">
                {/* 필터 및 검색 영역 */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        {/* 상태별 필터 */}
                        <div className="flex gap-2 items-center">
                            {[
                                { value: 'all', label: '전체' },
                                { value: 'waiting', label: '확인서 대기' },
                                { value: 'generated', label: '확인서 생성' },
                                { value: 'sent', label: '고객 발송' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setStatusFilter(opt.value)}
                                    className={`px-3 py-2 rounded text-sm border transition-colors font-medium ${statusFilter === opt.value
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-blue-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* 선택 및 일괄 처리 */}
                        {filteredQuotes.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleAllSelection}
                                    className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                                >
                                    {selectedCards.size === filteredQuotes.length ? '전체 해제' : '전체 선택'}
                                </button>
                                {selectedCards.size > 0 && (
                                    <button
                                        onClick={handleBulkGeneration}
                                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition-colors"
                                    >
                                        📄 선택된 {selectedCards.size}개 일괄생성
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="고객명, 이메일, 전화번호, 견적명, 예약ID 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-80 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button
                            onClick={loadQuotesWithReservations}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                        >
                            🔄 새로고침
                        </button>
                    </div>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mr-4"></div>
                        <p className="ml-4 text-gray-600">데이터를 불러오는 중...</p>
                    </div>
                ) : (
                    <>
                        {/* 예약 목록 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredQuotes.map((reservation) => (
                                <div
                                    key={reservation.re_id}
                                    className={`bg-white rounded-lg shadow-sm p-6 hover:bg-gray-50 transition-colors ${selectedCards.has(reservation.re_id)
                                        ? 'border-2 border-blue-500'
                                        : 'border border-gray-200'
                                        }`}
                                >
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                                            <button
                                                onClick={() => toggleCardSelection(reservation.re_id)}
                                                className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                                            >
                                                {selectedCards.has(reservation.re_id) ? (
                                                    <div className="w-5 h-5 bg-blue-600 text-white rounded flex items-center justify-center">✓</div>
                                                ) : (
                                                    <div className="w-5 h-5 border-2 border-gray-400 rounded"></div>
                                                )}
                                            </button>
                                            <div className="p-3 bg-gray-100 rounded-full flex-shrink-0">
                                                📄
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-base text-gray-900 truncate whitespace-nowrap">
                                                    {reservation.user_name || '고객명 없음'}
                                                </h4>
                                            </div>
                                        </div>
                                        {/* 카드 내부 정보를 1열로 세로 배치 */}
                                        <div className="flex flex-col gap-1 text-sm text-gray-700 mt-2 w-full">
                                            <div>
                                                <span className="font-semibold">견적명: </span>
                                                {reservation.quote_title}
                                            </div>
                                            <div>
                                                <span className="font-semibold">예약 ID: </span>
                                                {reservation.re_id?.length > 8
                                                    ? String(reservation.re_id).slice(0, 8) + '...'
                                                    : reservation.re_id || '-'}
                                            </div>
                                            <div>
                                                <span className="font-semibold">이메일: </span>
                                                {reservation.user_email || '-'}
                                            </div>
                                            <div>
                                                <span className="font-semibold">예약일: </span>
                                                {reservation.created_at
                                                    ? new Date(reservation.created_at).toLocaleDateString()
                                                    : '-'}
                                            </div>
                                            <div>
                                                <span className="font-semibold">상태: </span>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-1">결제완료</span>
                                                <span className="ml-1">
                                                    {renderConfirmationStatusBadge(reservation.confirmation_status || 'waiting')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">결제금액: </span>
                                                <span className="text-lg font-bold text-green-700">
                                                    {reservation.total_price?.toLocaleString() || 0}동
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">서비스 내역: </span>
                                                {reservation.services && reservation.services.length > 0 ? (
                                                    renderServiceBadges(reservation)
                                                ) : (
                                                    <button
                                                        onClick={() => fetchServiceDetailsFor(reservation.re_id)}
                                                        className="ml-2 px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50"
                                                        disabled={loadingDetails.has(reservation.re_id)}
                                                    >
                                                        {loadingDetails.has(reservation.re_id) ? '불러오는 중…' : '내역 불러오기'}
                                                    </button>
                                                )}
                                            </div>
                                            {/* 서비스별 금액 상세 정보 */}
                                            {reservation.serviceData?.services && reservation.serviceData.services.length > 0 ? (
                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded flex flex-col gap-1">
                                                    <div className="text-sm font-medium text-green-800 mb-2">💰 서비스별 금액 상세</div>
                                                    <div className="flex flex-col gap-2">
                                                        {reservation.serviceData.services.map((service: any, idx: number) => (
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
                                                            <span>{reservation.serviceData?.total?.toLocaleString() || 0}동</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {/* 버튼들을 한 행에 배치 */}
                                            <div className="mt-3 flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleGenerateClick(reservation)}
                                                    className={`px-4 py-1 text-sm rounded transition-colors whitespace-nowrap ${reservation.confirmation_status === 'waiting'
                                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                    disabled={reservation.confirmation_status !== 'waiting'}
                                                >
                                                    📄 확인서 생성
                                                </button>
                                                <Link
                                                    href={`/manager/confirmation/${reservation.re_id}/send`}
                                                    className={`px-4 py-1 text-sm rounded transition-colors whitespace-nowrap ${reservation.confirmation_status === 'generated'
                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    📧 고객 발송
                                                </Link>
                                                <button
                                                    onClick={() => handlePreviewClick(reservation)}
                                                    className="px-4 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm transition-colors whitespace-nowrap"
                                                >
                                                    👁️ 미리보기
                                                </button>
                                            </div>
                                            {reservation.confirmed_at && (
                                                <div className="mt-2 text-xs text-gray-500">
                                                    ✅ 발송일: {reservation.confirmed_at}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredQuotes.length === 0 && !loading && (
                            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                                <div className="text-4xl mb-4">📄</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    {searchTerm ? '검색 결과가 없습니다' : '발송할 확인서가 없습니다'}
                                </h3>
                                <p className="text-gray-500">
                                    {searchTerm ? '다른 검색어로 시도해보세요.' : '결제완료+예약완료된 예약이 없습니다.'}
                                </p>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        전체 보기
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 확인서 생성 팝업 모달 */}
            <ConfirmationGenerateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                quoteId={selectedQuoteId}
            />
        </ManagerLayout>
    );
}
