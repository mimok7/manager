'use client';

import React, { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import { Search, Car, Users, Calendar, AlertCircle, CheckCircle, User, MapPin, Plane, Ship } from 'lucide-react';

interface VehicleReservation {
    reservation_id: string;
    re_user_id: string;
    re_quote_id: string;
    re_status: string;
    re_created_at: string;
    service_type: 'airport' | 'rentcar' | 'cruise_car' | 'car_sht';
    dispatch_code?: string;
    // 서비스별 날짜 필드
    service_date?: string;
    service_datetime?: string;
    // 기타 정보
    location?: string;
    passenger_count?: number;
    car_count?: number;
    vehicle_number?: string;
    seat_number?: string;
    sht_category?: string;
    car_type?: string;
    pickup_location?: string;
    dropoff_location?: string;
    users?: {
        name?: string;
        phone?: string;
        email?: string;
    };
    quote?: {
        title?: string;
        quote_id?: string;
    };
}

const VehicleDispatchCodesPage = () => {
    const [reservations, setReservations] = useState<VehicleReservation[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 필터 상태
    const [serviceFilter, setServiceFilter] = useState<'all' | 'airport' | 'rentcar' | 'cruise_car' | 'car_sht'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'has_code' | 'no_code'>('all');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [futureOnly, setFutureOnly] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // 편집 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingCode, setEditingCode] = useState<string>('');

    // 로컬 YYYY-MM-DD 포맷터
    const formatLocalYMD = (input: string | Date) => {
        const d = typeof input === 'string' ? new Date(input) : input;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // 차량 예약 데이터 로드 (service-tables 패턴 적용)
    const loadVehicleReservations = async () => {
        try {
            setLoading(true);
            setError(null);

            // 각 서비스별로 개별 조회 후 병합 (service-tables 패턴)
            const [airportRes, rentcarRes, cruiseCarRes, carShtRes] = await Promise.all([
                // 공항 서비스
                supabase
                    .from('reservation_airport')
                    .select(`
                        reservation_id, dispatch_code, ra_airport_location, ra_datetime, 
                        ra_passenger_count, ra_car_count, airport_price_code, created_at, id,
                        reservation!inner (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `),
                // 렌터카 서비스 - 단순 조회로 테스트
                supabase
                    .from('reservation_rentcar')
                    .select('*'),
                // 크루즈 차량 서비스
                supabase
                    .from('reservation_cruise_car')
                    .select(`
                        reservation_id, dispatch_code, pickup_datetime, pickup_location, 
                        passenger_count, car_count, car_price_code, created_at, id,
                        reservation!inner (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `),
                // SHT 차량 서비스
                supabase
                    .from('reservation_car_sht')
                    .select(`
                        reservation_id, dispatch_code, usage_date, sht_category, 
                        vehicle_number, seat_number, pickup_location, dropoff_location, 
                        pickup_datetime, created_at, id,
                        reservation!inner (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `)
            ]);

            console.log('📋 각 서비스별 데이터 로드 결과:');
            console.log('공항:', airportRes.data?.length || 0, '건', airportRes.error && airportRes.error);
            console.log('렌터카:', rentcarRes.data?.length || 0, '건', rentcarRes.error && rentcarRes.error);
            console.log('크루즈차량:', cruiseCarRes.data?.length || 0, '건', cruiseCarRes.error && cruiseCarRes.error);
            console.log('SHT차량:', carShtRes.data?.length || 0, '건', carShtRes.error && carShtRes.error);

            // 렌터카 에러 상세 로그
            if (rentcarRes.error) {
                console.error('렌터카 쿼리 에러:', rentcarRes.error);
            }
            if (rentcarRes.data && rentcarRes.data.length > 0) {
                console.log('렌터카 샘플 데이터:', rentcarRes.data[0]);
            }

            // 렌터카 데이터를 위한 reservation 정보 별도 조회
            let reservationMap: Record<string, any> = {};
            let userMap: Record<string, any> = {};
            let quoteMap: Record<string, any> = {};

            if (rentcarRes.data && rentcarRes.data.length > 0) {
                const rentcarReservationIds = rentcarRes.data.map((item: any) => item.reservation_id).filter(Boolean);

                if (rentcarReservationIds.length > 0) {
                    // Reservation 정보 조회
                    const { data: reservations } = await supabase
                        .from('reservation')
                        .select('re_id, re_user_id, re_quote_id, re_status, re_created_at')
                        .in('re_id', rentcarReservationIds);

                    if (reservations) {
                        reservationMap = Object.fromEntries(reservations.map(r => [r.re_id, r]));

                        const userIds = reservations.map(r => r.re_user_id).filter(Boolean);
                        const quoteIds = reservations.map(r => r.re_quote_id).filter(Boolean);

                        // Users 정보 조회
                        if (userIds.length > 0) {
                            const { data: users } = await supabase
                                .from('users')
                                .select('id, name, email, phone_number')
                                .in('id', userIds);

                            if (users) {
                                userMap = Object.fromEntries(users.map(u => [u.id, u]));
                            }
                        }

                        // Quote 정보 조회
                        if (quoteIds.length > 0) {
                            const { data: quotes } = await supabase
                                .from('quote')
                                .select('id, title')
                                .in('id', quoteIds);

                            if (quotes) {
                                quoteMap = Object.fromEntries(quotes.map(q => [q.id, q]));
                            }
                        }
                    }
                }
            }

            // 다른 서비스들의 Quote 정보도 추가로 조회
            const otherReservationData = [
                ...(airportRes.data || []),
                ...(cruiseCarRes.data || []),
                ...(carShtRes.data || [])
            ];

            const otherQuoteIds = Array.from(new Set(
                otherReservationData
                    .map((item: any) => item.reservation?.re_quote_id)
                    .filter(Boolean)
                    .filter(id => !quoteMap[id]) // 이미 조회된 것 제외
            ));

            if (otherQuoteIds.length > 0) {
                const { data: otherQuotes } = await supabase
                    .from('quote')
                    .select('id, title')
                    .in('id', otherQuoteIds);

                if (otherQuotes) {
                    otherQuotes.forEach(q => {
                        quoteMap[q.id] = q;
                    });
                }
            }

            // 데이터 변환 및 병합
            const merged: VehicleReservation[] = [];

            // 공항 서비스 처리
            if (airportRes.data) {
                airportRes.data.forEach((item: any) => {
                    if (!item.reservation) return;

                    merged.push({
                        reservation_id: item.reservation_id,
                        re_user_id: item.reservation.re_user_id,
                        re_quote_id: item.reservation.re_quote_id,
                        re_status: item.reservation.re_status,
                        re_created_at: item.reservation.re_created_at,
                        service_type: 'airport',
                        dispatch_code: item.dispatch_code,
                        service_datetime: item.ra_datetime, // 공항은 일시
                        location: item.ra_airport_location,
                        passenger_count: item.ra_passenger_count,
                        car_type: '공항픽업 차량', // 공항 서비스 차량 타입
                        users: item.reservation.users ? {
                            name: item.reservation.users.name,
                            email: item.reservation.users.email,
                            phone: item.reservation.users.phone_number
                        } : undefined,
                        quote: item.reservation.re_quote_id && quoteMap[item.reservation.re_quote_id] ? {
                            title: quoteMap[item.reservation.re_quote_id].title,
                            quote_id: item.reservation.re_quote_id
                        } : undefined
                    });
                });
            }

            // 렌터카 서비스 처리
            if (rentcarRes.data) {
                console.log('렌터카 원시 데이터 샘플:', rentcarRes.data.slice(0, 3));

                rentcarRes.data.forEach((item: any) => {
                    const reservation = reservationMap[item.reservation_id];
                    if (!reservation) {
                        console.log('예약 정보 없음:', item.reservation_id);
                        return;
                    }

                    const user = userMap[reservation.re_user_id];
                    const quote = quoteMap[reservation.re_quote_id];

                    merged.push({
                        reservation_id: item.reservation_id,
                        re_user_id: reservation.re_user_id,
                        re_quote_id: reservation.re_quote_id,
                        re_status: reservation.re_status,
                        re_created_at: reservation.re_created_at,
                        service_type: 'rentcar',
                        dispatch_code: item.dispatch_code,
                        service_date: item.pickup_datetime ? formatLocalYMD(item.pickup_datetime) : undefined,
                        service_datetime: item.pickup_datetime,
                        location: item.destination || item.pickup_location || '목적지 미정',
                        passenger_count: item.passenger_count,
                        car_type: '렌터카', // 렌터카 서비스 차량 타입
                        users: user ? {
                            name: user.name,
                            email: user.email,
                            phone: user.phone_number
                        } : undefined,
                        quote: quote ? {
                            title: quote.title,
                            quote_id: reservation.re_quote_id
                        } : undefined
                    });
                });
            }            // 크루즈 차량 서비스 처리
            if (cruiseCarRes.data) {
                cruiseCarRes.data.forEach((item: any) => {
                    if (!item.reservation) return;

                    merged.push({
                        reservation_id: item.reservation_id,
                        re_user_id: item.reservation.re_user_id,
                        re_quote_id: item.reservation.re_quote_id,
                        re_status: item.reservation.re_status,
                        re_created_at: item.reservation.re_created_at,
                        service_type: 'cruise_car',
                        dispatch_code: item.dispatch_code,
                        service_datetime: item.pickup_datetime, // 크루즈차량은 일시
                        location: item.pickup_location,
                        passenger_count: item.passenger_count,
                        car_type: '크루즈 전용차량', // 크루즈 차량 서비스 차량 타입
                        users: item.reservation.users ? {
                            name: item.reservation.users.name,
                            email: item.reservation.users.email,
                            phone: item.reservation.users.phone_number
                        } : undefined,
                        quote: item.reservation.re_quote_id && quoteMap[item.reservation.re_quote_id] ? {
                            title: quoteMap[item.reservation.re_quote_id].title,
                            quote_id: item.reservation.re_quote_id
                        } : undefined
                    });
                });
            }

            // SHT 차량 서비스 처리
            if (carShtRes.data) {
                carShtRes.data.forEach((item: any) => {
                    if (!item.reservation) return;

                    merged.push({
                        reservation_id: item.reservation_id,
                        re_user_id: item.reservation.re_user_id,
                        re_quote_id: item.reservation.re_quote_id,
                        re_status: item.reservation.re_status,
                        re_created_at: item.reservation.re_created_at,
                        service_type: 'car_sht',
                        dispatch_code: item.dispatch_code,
                        service_date: item.usage_date ? formatLocalYMD(item.usage_date) : undefined, // SHT는 날짜만
                        vehicle_number: item.vehicle_number,
                        seat_number: item.seat_number,
                        sht_category: item.sht_category,
                        pickup_location: item.pickup_location,
                        dropoff_location: item.dropoff_location,
                        service_datetime: item.pickup_datetime,
                        // SHT 차량: 카테고리에 따라 적절한 위치 표시
                        location: item.sht_category?.toLowerCase() === 'pickup'
                            ? item.pickup_location || '승차위치 미정'
                            : item.dropoff_location || '하차위치 미정',
                        users: item.reservation.users ? {
                            name: item.reservation.users.name,
                            email: item.reservation.users.email,
                            phone: item.reservation.users.phone_number
                        } : undefined,
                        quote: item.reservation.re_quote_id && quoteMap[item.reservation.re_quote_id] ? {
                            title: quoteMap[item.reservation.re_quote_id].title,
                            quote_id: item.reservation.re_quote_id
                        } : undefined
                    });
                });
            }

            console.log('🎯 최종 병합된 데이터:', merged.length, '건');

            // 샘플 데이터 확인
            merged.slice(0, 3).forEach((item, idx) => {
                console.log(`샘플 ${idx + 1}:`, {
                    service_type: item.service_type,
                    service_date: item.service_date,
                    service_datetime: item.service_datetime,
                    location: item.location,
                    user_name: item.users?.name
                });
            });

            setReservations(merged);
        } catch (err) {
            console.error('데이터 로드 오류:', err);
            setError('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 필터링된 예약 계산
    const filteredReservations = reservations.filter(r => {
        // 서비스 타입 필터
        if (serviceFilter !== 'all' && r.service_type !== serviceFilter) return false;

        // 배차 코드 상태 필터
        if (statusFilter === 'has_code' && (!r.dispatch_code || r.dispatch_code.trim() === '')) return false;
        if (statusFilter === 'no_code' && (r.dispatch_code && r.dispatch_code.trim() !== '')) return false;

        // 날짜 필터
        const serviceDate = r.service_date || (r.service_datetime ? formatLocalYMD(r.service_datetime) : null);
        if (dateFilter && serviceDate !== dateFilter) return false;

        // 오늘 이후만 보기
        if (futureOnly && serviceDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const itemDate = new Date(serviceDate);
            if (itemDate < today) return false;
        }

        // 검색 필터
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            const name = r.users?.name?.toLowerCase() || '';
            const title = r.quote?.title?.toLowerCase() || '';
            const location = r.location?.toLowerCase() || '';
            const code = r.dispatch_code?.toLowerCase() || '';
            const quoteId = r.re_quote_id?.toLowerCase() || '';
            const vehicleNumber = r.vehicle_number?.toLowerCase() || '';

            if (!name.includes(q) && !title.includes(q) && !location.includes(q) &&
                !code.includes(q) && !quoteId.includes(q) && !vehicleNumber.includes(q)) {
                return false;
            }
        }

        return true;
    });

    // 배차 코드 업데이트
    const updateDispatchCode = async (reservationId: string, serviceType: string, newCode: string) => {
        try {
            const tableMap = {
                'airport': 'reservation_airport',
                'rentcar': 'reservation_rentcar',
                'cruise_car': 'reservation_cruise_car',
                'car_sht': 'reservation_car_sht'
            };

            const tableName = tableMap[serviceType as keyof typeof tableMap];
            if (!tableName) {
                console.error('알 수 없는 서비스 타입:', serviceType);
                alert('지원하지 않는 서비스 타입입니다.');
                return;
            }

            const { error: updateError } = await supabase
                .from(tableName)
                .update({ dispatch_code: newCode.trim() || null })
                .eq('reservation_id', reservationId);

            if (updateError) {
                console.error('배차 코드 업데이트 오류:', updateError);
                alert('배차 코드 업데이트에 실패했습니다.');
                return;
            }

            // 로컬 상태 업데이트
            setReservations(prev =>
                prev.map(r =>
                    r.reservation_id === reservationId
                        ? { ...r, dispatch_code: newCode.trim() || undefined }
                        : r
                )
            );

            setEditingId(null);
            setEditingCode('');
            console.log('배차 코드 업데이트 완료:', reservationId, '→', newCode);
        } catch (err) {
            console.error('배차 코드 업데이트 예외:', err);
            alert('배차 코드 업데이트 중 오류가 발생했습니다.');
        }
    };

    // 편집 시작
    const startEditing = (reservationId: string, currentCode: string = '') => {
        setEditingId(reservationId);
        setEditingCode(currentCode);
    };

    // 편집 취소
    const cancelEditing = () => {
        setEditingId(null);
        setEditingCode('');
    };

    // 날짜별 그룹화 (service-tables 패턴)
    const groupByServiceDateForVehicle = (data: VehicleReservation[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const groups: Record<string, VehicleReservation[]> = {};

        data.forEach(item => {
            const serviceDate = item.service_date || (item.service_datetime ? formatLocalYMD(item.service_datetime) : null);

            if (!serviceDate) {
                (groups['미정'] ||= []).push(item);
                return;
            }

            // 오늘 이후만 그룹화 (futureOnly가 false면 과거 데이터도 포함)
            if (!futureOnly || new Date(serviceDate) >= today) {
                (groups[serviceDate] ||= []).push(item);
            }
        });

        return Object.entries(groups)
            .sort(([a], [b]) => {
                if (a === '미정') return 1;
                if (b === '미정') return -1;
                return a.localeCompare(b);
            })
            .map(([date, reservations]) => ({
                date,
                reservations: reservations.sort((a, b) => {
                    // 차량 번호 있는 것 우선
                    if (a.vehicle_number && !b.vehicle_number) return -1;
                    if (!a.vehicle_number && b.vehicle_number) return 1;
                    return (a.vehicle_number || '').localeCompare(b.vehicle_number || '');
                })
            }));
    };

    // 컴포넌트 마운트시 데이터 로드
    useEffect(() => {
        loadVehicleReservations();
    }, []);

    const groupedData = groupByServiceDateForVehicle(filteredReservations);

    // 서비스 타입 아이콘 반환
    const getServiceIcon = (serviceType: string) => {
        switch (serviceType) {
            case 'airport': return <Plane className="w-4 h-4" />;
            case 'rentcar': return <Car className="w-4 h-4" />;
            case 'cruise_car': return <Ship className="w-4 h-4" />;
            case 'car_sht': return <Car className="w-4 h-4" />;
            default: return <Car className="w-4 h-4" />;
        }
    };

    // 서비스 타입 라벨 반환
    const getServiceLabel = (serviceType: string) => {
        switch (serviceType) {
            case 'airport': return '공항';
            case 'rentcar': return '렌터카';
            case 'cruise_car': return '크루즈카';
            case 'car_sht': return '스하차량';
            default: return '차량';
        }
    };

    if (loading) {
        return (
            <ManagerLayout title="차량 배차 코드 관리" activeTab="dispatch-codes-vehicle">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="ml-4 text-gray-600">차량 예약 데이터를 불러오는 중...</p>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="차량 배차 코드 관리" activeTab="dispatch-codes-vehicle">
            <div className="space-y-6">
                {/* 헤더 및 통계 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Car className="w-5 h-5 text-blue-600" />
                                <span className="text-sm text-blue-600">전체 차량 예약</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-700 mt-1">
                                {reservations.length}건
                            </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-green-600">배차 코드 발급완료</span>
                            </div>
                            <div className="text-2xl font-bold text-green-700 mt-1">
                                {reservations.filter(r => r.dispatch_code && r.dispatch_code.trim() !== '').length}건
                            </div>
                        </div>

                        <div className="bg-orange-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                <span className="text-sm text-orange-600">배차 코드 미발급</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-700 mt-1">
                                {reservations.filter(r => !r.dispatch_code || r.dispatch_code.trim() === '').length}건
                            </div>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                <span className="text-sm text-purple-600">서비스별 분류</span>
                            </div>
                            <div className="text-sm text-purple-700 mt-1">
                                공항 {reservations.filter(r => r.service_type === 'airport').length} /
                                렌터카 {reservations.filter(r => r.service_type === 'rentcar').length} /
                                크루즈카 {reservations.filter(r => r.service_type === 'cruise_car').length} /
                                SHT {reservations.filter(r => r.service_type === 'car_sht').length}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 필터 섹션 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* 서비스 타입 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">서비스 타입</label>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    { key: 'all', label: '전체', color: 'bg-gray-100 text-gray-700' },
                                    { key: 'airport', label: '공항', color: 'bg-blue-100 text-blue-700' },
                                    { key: 'rentcar', label: '렌터카', color: 'bg-green-100 text-green-700' },
                                    { key: 'cruise_car', label: '크루즈카', color: 'bg-purple-100 text-purple-700' },
                                    { key: 'car_sht', label: 'SHT', color: 'bg-orange-100 text-orange-700' }
                                ].map(service => (
                                    <button
                                        key={service.key}
                                        onClick={() => setServiceFilter(service.key as any)}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${serviceFilter === service.key
                                            ? service.color.replace('100', '200').replace('700', '800')
                                            : service.color
                                            }`}
                                    >
                                        {service.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 배차 코드 상태 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">배차 코드 상태</label>
                            <div className="flex gap-2">
                                {[
                                    { key: 'all', label: '전체', color: 'bg-gray-100 text-gray-700' },
                                    { key: 'has_code', label: '발급완료', color: 'bg-green-100 text-green-700' },
                                    { key: 'no_code', label: '미발급', color: 'bg-orange-100 text-orange-700' }
                                ].map(status => (
                                    <button
                                        key={status.key}
                                        onClick={() => setStatusFilter(status.key as any)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === status.key
                                            ? status.color.replace('100', '200').replace('700', '800')
                                            : status.color
                                            }`}
                                    >
                                        {status.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 날짜 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">서비스 날짜</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                                <button
                                    type="button"
                                    onClick={() => setFutureOnly(prev => !prev)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors focus:outline-none ${futureOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                                >
                                    오늘 이후만 보기
                                </button>
                            </div>
                        </div>

                        {/* 검색 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="이름, 여행명, 배차코드, 견적ID 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 필터 초기화 */}
                    {(serviceFilter !== 'all' || statusFilter !== 'all' || dateFilter || searchTerm || futureOnly) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setServiceFilter('all');
                                    setStatusFilter('all');
                                    setDateFilter('');
                                    setFutureOnly(true);
                                    setSearchTerm('');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                모든 필터 초기화
                            </button>
                        </div>
                    )}
                </div>

                {/* 예약 목록 */}
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800">
                            차량 예약 목록 ({filteredReservations.length}건)
                        </h2>
                    </div>

                    {error && (
                        <div className="p-6 bg-red-50 border-l-4 border-red-400">
                            <div className="flex items-center">
                                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                                <p className="text-red-700">{error}</p>
                            </div>
                            <button
                                onClick={loadVehicleReservations}
                                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                            >
                                다시 시도
                            </button>
                        </div>
                    )}

                    {filteredReservations.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Car className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p>조건에 맞는 차량 예약이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                {groupedData.map(group => (
                                    <React.Fragment key={`group-${group.date}`}>
                                        {/* 그룹 헤더 */}
                                        <div className="col-span-full">
                                            <div className="bg-gray-100 rounded-lg px-4 py-2 mb-4">
                                                <h3 className="text-sm font-semibold text-gray-700">
                                                    서비스 날짜 {group.date} · {group.reservations.length}건
                                                </h3>
                                            </div>
                                        </div>

                                        {/* 그룹 내 카드들 */}
                                        {group.reservations.map((reservation) => (
                                            <div key={reservation.reservation_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                {/* 예약 정보 섹션 */}
                                                <div className="mb-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {reservation.users?.name || '이름 없음'}
                                                        </span>
                                                        <div className="flex items-center gap-1 ml-auto">
                                                            {getServiceIcon(reservation.service_type)}
                                                            <span className="text-xs text-gray-500">
                                                                {getServiceLabel(reservation.service_type)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mb-1">
                                                        {reservation.quote?.title || '제목 없음'}
                                                    </div>
                                                    {/* 견적ID는 사용자 카드에서 제거됨 */}
                                                </div>

                                                {/* 차량 서비스 일정 섹션 */}
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-600 mb-1">
                                                        {reservation.service_date || reservation.service_datetime ? (
                                                            <>
                                                                <div className="font-medium">
                                                                    서비스 일시: {
                                                                        reservation.service_date || (
                                                                            reservation.service_datetime &&
                                                                            (reservation.service_type === 'rentcar' || reservation.service_type === 'car_sht'
                                                                                ? formatLocalYMD(reservation.service_datetime)
                                                                                : new Date(reservation.service_datetime).toLocaleString('ko-KR'))
                                                                        )
                                                                    }
                                                                </div>
                                                                {/* SHT 차량의 경우 상세 위치 정보 표시 */}
                                                                {reservation.service_type === 'car_sht' ? (
                                                                    <div className="text-gray-500 space-y-1">
                                                                        {reservation.sht_category?.toLowerCase() === 'pickup' ? (
                                                                            <>
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-xs px-1 py-0.5 rounded bg-green-50 text-green-700">픽업</span>
                                                                                    <MapPin className="w-3 h-3" />
                                                                                    승차: {reservation.pickup_location || '위치 미정'}
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-xs px-1 py-0.5 rounded bg-red-50 text-red-700">드랍</span>
                                                                                    <MapPin className="w-3 h-3" />
                                                                                    하차: {reservation.dropoff_location || '위치 미정'}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-gray-500 flex items-center gap-1">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {reservation.location || '위치 미정'}
                                                                    </div>
                                                                )}
                                                                {reservation.car_type && (
                                                                    <div className="text-gray-500">
                                                                        차종: {reservation.car_type}
                                                                    </div>
                                                                )}
                                                                {reservation.vehicle_number && (
                                                                    <div className="text-gray-700 font-medium">
                                                                        차량번호: {reservation.vehicle_number}
                                                                    </div>
                                                                )}
                                                                {reservation.passenger_count && (
                                                                    <div className="text-gray-500">
                                                                        승객: {reservation.passenger_count}명
                                                                    </div>
                                                                )}
                                                                {/* SHT 차량만 차량 대수와 좌석번호 표시 */}
                                                                {reservation.service_type === 'car_sht' && reservation.car_count && (
                                                                    <div className="text-gray-500">
                                                                        차량: {reservation.car_count}대
                                                                    </div>
                                                                )}
                                                                {reservation.seat_number && (
                                                                    <div className="text-gray-500">
                                                                        좌석번호: {reservation.seat_number}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">일정 미정</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 배차 코드 섹션 */}
                                                <div className="mb-3">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        배차 코드
                                                    </label>
                                                    {editingId === reservation.reservation_id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingCode}
                                                                onChange={(e) => setEditingCode(e.target.value)}
                                                                placeholder="배차 코드 입력"
                                                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => updateDispatchCode(reservation.reservation_id, reservation.service_type, editingCode)}
                                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                                            >
                                                                저장
                                                            </button>
                                                            <button
                                                                onClick={cancelEditing}
                                                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                                                            >
                                                                취소
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                {reservation.dispatch_code ? (
                                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        {reservation.dispatch_code}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                                        미발급
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => startEditing(reservation.reservation_id, reservation.dispatch_code || '')}
                                                                disabled={editingId !== null}
                                                                className="text-xs text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                                                            >
                                                                {reservation.dispatch_code ? '수정' : '발급'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 예약 상태 섹션 */}
                                                <div className="flex items-center justify-between">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${reservation.re_status === 'confirmed'
                                                        ? 'bg-green-100 text-green-800'
                                                        : reservation.re_status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {reservation.re_status}
                                                    </span>
                                                    <div className="text-xs text-gray-400">
                                                        {new Date(reservation.re_created_at).toLocaleDateString('ko-KR')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ManagerLayout>
    );
};

export default VehicleDispatchCodesPage;
