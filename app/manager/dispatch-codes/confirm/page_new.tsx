'use client';

import React, { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import { Search, Car, Users, Calendar, AlertCircle, CheckCircle, User, MapPin, Plane, Ship, CheckCircle2 } from 'lucide-react';

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
    sht_category?: string;
    car_type?: string;
    // 승차확인/메모 추가 필드
    pickup_confirmed_at?: string;
    dispatch_memo?: string;
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
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [futureOnly, setFutureOnly] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');

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
                        ra_passenger_count, ra_car_count, airport_price_code, created_at,
                        pickup_confirmed_at, dispatch_memo,
                        reservation:reservation_id (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `),
                // 렌터카 서비스
                supabase
                    .from('reservation_rentcar')
                    .select(`
                        reservation_id, dispatch_code, pickup_datetime, pickup_location, 
                        destination, passenger_count, car_count, rentcar_price_code, created_at,
                        pickup_confirmed_at, dispatch_memo,
                        reservation:reservation_id (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `),
                // 크루즈 차량 서비스
                supabase
                    .from('reservation_cruise_car')
                    .select(`
                        reservation_id, dispatch_code, pickup_datetime, pickup_location, 
                        passenger_count, car_count, car_price_code, created_at,
                        pickup_confirmed_at, dispatch_memo,
                        reservation:reservation_id (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `),
                // SHT 차량 서비스
                supabase
                    .from('reservation_car_sht')
                    .select(`
                        reservation_id, dispatch_code, usage_date, sht_category, 
                        vehicle_number, created_at,
                        pickup_confirmed_at, dispatch_memo,
                        reservation:reservation_id (
                            re_id, re_user_id, re_quote_id, re_status, re_created_at,
                            users:re_user_id (id, name, email, phone_number)
                        )
                    `)
            ]);

            console.log('📋 각 서비스별 데이터 로드 결과:');
            console.log('공항:', airportRes.data?.length || 0, '건');
            console.log('렌터카:', rentcarRes.data?.length || 0, '건');
            console.log('크루즈차량:', cruiseCarRes.data?.length || 0, '건');
            console.log('SHT차량:', carShtRes.data?.length || 0, '건');

            // Quote 정보를 별도로 조회
            const allReservationData = [
                ...(airportRes.data || []),
                ...(rentcarRes.data || []),
                ...(cruiseCarRes.data || []),
                ...(carShtRes.data || [])
            ];

            const quoteIds = Array.from(new Set(
                allReservationData
                    .map((item: any) => item.reservation?.re_quote_id)
                    .filter(Boolean)
            ));

            let quoteMap: Record<string, any> = {};
            if (quoteIds.length > 0) {
                const { data: quotes } = await supabase
                    .from('quote')
                    .select('id, title')
                    .in('id', quoteIds);

                if (quotes) {
                    quoteMap = Object.fromEntries(quotes.map(q => [q.id, q]));
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
                        car_count: item.ra_car_count,
                        pickup_confirmed_at: item.pickup_confirmed_at,
                        dispatch_memo: item.dispatch_memo,
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
                rentcarRes.data.forEach((item: any) => {
                    if (!item.reservation) return;

                    merged.push({
                        reservation_id: item.reservation_id,
                        re_user_id: item.reservation.re_user_id,
                        re_quote_id: item.reservation.re_quote_id,
                        re_status: item.reservation.re_status,
                        re_created_at: item.reservation.re_created_at,
                        service_type: 'rentcar',
                        dispatch_code: item.dispatch_code,
                        service_date: item.pickup_datetime ? formatLocalYMD(item.pickup_datetime) : undefined, // 렌터카는 날짜만
                        location: item.destination || item.pickup_location,
                        passenger_count: item.passenger_count,
                        car_count: item.car_count,
                        pickup_confirmed_at: item.pickup_confirmed_at,
                        dispatch_memo: item.dispatch_memo,
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

            // 크루즈 차량 서비스 처리
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
                        car_count: item.car_count,
                        pickup_confirmed_at: item.pickup_confirmed_at,
                        dispatch_memo: item.dispatch_memo,
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
                        sht_category: item.sht_category,
                        pickup_confirmed_at: item.pickup_confirmed_at,
                        dispatch_memo: item.dispatch_memo,
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
                    user_name: item.users?.name,
                    pickup_confirmed_at: item.pickup_confirmed_at,
                    dispatch_memo: item.dispatch_memo
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

        // 승차 확인 상태 필터
        if (statusFilter === 'confirmed' && !r.pickup_confirmed_at) return false;
        if (statusFilter === 'unconfirmed' && r.pickup_confirmed_at) return false;

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
            const memo = r.dispatch_memo?.toLowerCase() || '';

            if (!name.includes(q) && !title.includes(q) && !location.includes(q) &&
                !code.includes(q) && !quoteId.includes(q) && !vehicleNumber.includes(q) && !memo.includes(q)) {
                return false;
            }
        }

        return true;
    });

    // 날짜별 그룹화 (service-tables 패턴)
    const groupByServiceDate = (data: VehicleReservation[]) => {
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

    const groupedData = groupByServiceDate(filteredReservations);

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
            <ManagerLayout title="승차 확인 · 배차 메모" activeTab="dispatch-codes-confirm">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="ml-4 text-gray-600">차량 예약 데이터를 불러오는 중...</p>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="승차 확인 · 배차 메모" activeTab="dispatch-codes-confirm">
            <div className="space-y-6">
                {/* 헤더 및 통계 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-800">승차 확인 · 배차 메모</h1>
                    </div>

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
                                <span className="text-sm text-green-600">승차 확인</span>
                            </div>
                            <div className="text-2xl font-bold text-green-700 mt-1">
                                {reservations.filter(r => r.pickup_confirmed_at).length}건
                            </div>
                        </div>

                        <div className="bg-orange-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                <span className="text-sm text-orange-600">미확인</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-700 mt-1">
                                {reservations.filter(r => !r.pickup_confirmed_at).length}건
                            </div>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                <span className="text-sm text-purple-600">메모 등록</span>
                            </div>
                            <div className="text-2xl font-bold text-purple-700 mt-1">
                                {reservations.filter(r => (r.dispatch_memo || '').trim() !== '').length}건
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

                        {/* 승차 확인 상태 필터 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">승차 확인</label>
                            <div className="flex gap-2">
                                {[
                                    { key: 'all', label: '전체', color: 'bg-gray-100 text-gray-700' },
                                    { key: 'confirmed', label: '확인', color: 'bg-green-100 text-green-700' },
                                    { key: 'unconfirmed', label: '미확인', color: 'bg-orange-100 text-orange-700' }
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
                                    placeholder="이름, 여행명, 위치, 메모 검색"
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
                            승차 확인/메모 목록 ({filteredReservations.length}건)
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
                                                                <div className="text-gray-500 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {reservation.location || '위치 미정'}
                                                                </div>
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
                                                                {reservation.car_count && (
                                                                    <div className="text-gray-500">
                                                                        차량: {reservation.car_count}대
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">일정 미정</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 승차 확인 상태 */}
                                                <div className="mb-2">
                                                    {reservation.pickup_confirmed_at ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            확인: {new Date(reservation.pickup_confirmed_at).toLocaleString('ko-KR')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                                            미확인
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 메모 */}
                                                <div className="mb-3">
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">배차 메모</label>
                                                    {((reservation.dispatch_memo || '').trim() !== '') ? (
                                                        <div className="text-sm whitespace-pre-wrap min-h-[1.5rem] bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-2 py-1">
                                                            {reservation.dispatch_memo}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 min-h-[1.5rem]">메모 없음</div>
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