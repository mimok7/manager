'use client';

import React, { useState, useEffect } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import ShtCarSeatMap from '@/components/ShtCarSeatMap';
import supabase from '@/lib/supabase';
import {
    Calendar,
    Car,
    Users,
    MapPin,
    Eye,
    Filter,
    ChevronLeft,
    ChevronRight,
    Plus,
    Grid3X3,
    List
} from 'lucide-react';

interface ShtCarReservation {
    id: string;
    reservation_id: string;
    vehicle_number: string;
    seat_number: string;
    sht_category: string;
    usage_date: string;
    pickup_location?: string;
    dropoff_location?: string;
    pier_location?: string;
    cruise_name?: string;
    booker_name?: string;
    booker_email?: string;
    reservation_status?: string;
}

export default function ShtCarPage() {
    const [reservations, setReservations] = useState<ShtCarReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedVehicle, setSelectedVehicle] = useState('all');
    // 카테고리 필터: 전체 / Pickup / Dropoff
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'pickup' | 'dropoff'>('all');
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [mapVehicle, setMapVehicle] = useState<string>('');
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const [displayMode, setDisplayMode] = useState<'table' | 'card'>('card');
    const [vehicles, setVehicles] = useState<string[]>([]);

    useEffect(() => {
        loadReservations();
    }, [selectedDate, selectedVehicle, viewMode]);

    const getDateRange = (base: Date, mode: 'day' | 'week' | 'month') => {
        const start = new Date(base);
        const end = new Date(base);

        if (mode === 'day') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (mode === 'week') {
            const day = start.getDay();
            const diffToMonday = (day === 0 ? -6 : 1) - day;
            start.setDate(start.getDate() + diffToMonday);
            start.setHours(0, 0, 0, 0);
            end.setTime(start.getTime());
            end.setDate(end.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(start.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        }

        return { start, end };
    };

    const loadReservations = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange(selectedDate, viewMode);

            // vw_manager_sht_car_report 뷰에서 모든 필요한 정보를 한 번에 조회
            let query = supabase
                .from('vw_manager_sht_car_report')
                .select('*')
                .gte('usage_date', start.toISOString())
                .lte('usage_date', end.toISOString())
                .order('usage_date', { ascending: true })
                .order('vehicle_number', { ascending: true })
                .order('seat_number', { ascending: true });

            if (selectedVehicle !== 'all') {
                query = query.eq('vehicle_number', selectedVehicle);
            }

            const { data: reservationData, error } = await query;

            if (error) {
                console.error('스하차량 예약 조회 실패:', error);
                return;
            }

            console.log('📋 조회된 스하차량 데이터:', reservationData?.length, '건');
            if (reservationData && reservationData.length > 0) {
                console.log('📋 데이터 샘플:', reservationData[0]);
            }

            // 중복 제거: 복합키 기반
            const uniqueMap = new Map<string, any>();
            reservationData?.forEach(item => {
                const key = `${item.reservation_id || ''}-${item.vehicle_number || ''}-${item.seat_number || ''}-${item.usage_date || ''}-${item.sht_category || ''}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, item);
                }
            });

            const uniqueReservations = Array.from(uniqueMap.values());
            console.log('🔄 중복 제거 후 데이터:', uniqueReservations.length, '건');

            // 데이터 매핑
            const mappedReservations = uniqueReservations.map(reservation => ({
                id: reservation.id,
                reservation_id: reservation.reservation_id,
                vehicle_number: reservation.vehicle_number,
                seat_number: reservation.seat_number,
                sht_category: reservation.sht_category,
                usage_date: reservation.usage_date,
                pickup_location: reservation.pickup_location,
                dropoff_location: reservation.dropoff_location,
                pier_location: reservation.pier_location,
                cruise_name: reservation.cruise_name,
                booker_name: reservation.booker_name,
                booker_email: reservation.booker_email,
                reservation_status: 'confirmed' // 뷰에서 상태 정보가 없으므로 기본값
            }));

            // 차량 목록 동적 구성 (현재 기간 데이터 기준)
            const distinctVehicles = Array.from(new Set(mappedReservations
                .map(r => r.vehicle_number)
                .filter(v => !!v))) as string[];
            distinctVehicles.sort();
            setVehicles(distinctVehicles);

            // 좌석도 기본 차량 선택 보정
            if (!mapVehicle && distinctVehicles.length > 0) {
                setMapVehicle(distinctVehicles[0]);
            }

            setReservations(mappedReservations);
        } catch (error) {
            console.error('스하차량 예약 로딩 실패:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const openSeatMap = (vehicleNumber: string, category?: 'pickup' | 'dropoff', usageDate?: string) => {
        // 액션에서 사용일이 전달되면 해당 날짜로 필터하고 일 단위 뷰로 이동
        if (usageDate) {
            try {
                const d = new Date(usageDate);
                if (!isNaN(d.getTime())) {
                    setSelectedDate(d);
                    setViewMode('day');
                }
            } catch (e) {
                // 무시
            }
        }

        setMapVehicle(vehicleNumber);
        // 카테고리 지정이 있으면 모달 내부에서 초기 카테고리로 사용되도록 state 동기화는 모달쪽에서 처리
        setIsMapOpen(true);
    };

    // 카테고리 매칭 함수 (전체/픽업/드랍)
    const categoryMatches = (rawCat?: string, rawSeat?: string) => {
        if (selectedCategory === 'all') return true;
        const cat = String(rawCat || '').trim().toLowerCase();
        if (selectedCategory === 'pickup') return cat === 'pickup';
        if (selectedCategory === 'dropoff') return cat === 'dropoff' || cat === 'drop-off';
        return false;
    };

    // 카테고리 필터 적용된 예약 목록 (렌더/통계용)
    const filteredReservations = reservations.filter(r => categoryMatches(r.sht_category, r.seat_number));

    // 날짜별 그룹화
    const groupedReservations: { [date: string]: ShtCarReservation[] } = filteredReservations.reduce((groups, reservation) => {
        const date = new Date(reservation.usage_date).toISOString().split('T')[0];
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(reservation);
        return groups;
    }, {} as { [date: string]: ShtCarReservation[] });

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status?: string) => {
        switch (status) {
            case 'confirmed':
                return '확정';
            case 'pending':
                return '대기';
            case 'cancelled':
                return '취소';
            default:
                return '미정';
        }
    };

    // 차량별 통계 (좌석 단위 집계, 'All' 처리)
    const vehicleStats = vehicles.map(vehicle => {
        const vehicleReservations = filteredReservations.filter(r => r.vehicle_number === vehicle);
        // 좌석 레이아웃 기준 총 좌석 수: C1(1) + A1~A6(6) + B1~B3(3) = 10 (운전석 X 제외)
        const totalSeats = 10;

        // 'All'로 예약된 경우 전체 좌석 점유 처리
        // 'All'은 카테고리가 아니라 좌석번호가 All로 표시되는 경우만 단독 예약 처리
        const hasAllReservation = vehicleReservations.some(r => String(r.seat_number || '').trim().toLowerCase() === 'all');

        let reservedSeats = 0;
        if (hasAllReservation) {
            reservedSeats = totalSeats;
        } else {
            const seatSet = new Set<string>();
            vehicleReservations.forEach(r => {
                const raw = String(r.seat_number || '').trim();
                if (!raw) return;
                // seat_number가 'All'이면 전체 처리 (안전망)
                if (raw.toLowerCase() === 'all') {
                    seatSet.clear();
                    for (const s of ['C1', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3']) seatSet.add(s);
                    return;
                }
                raw.split(',').map(s => s.trim()).filter(Boolean).forEach(s => seatSet.add(s));
            });
            reservedSeats = seatSet.size;
        }

        const availableSeats = Math.max(totalSeats - reservedSeats, 0);
        const occupancyRate = Math.round((reservedSeats / totalSeats) * 100);

        // 분류 카운트 (Pickup / Drop-off / All) - 전체 데이터 기준으로도 참고하기 위해 원본 reservations에서 집계
        const allVehicleReservations = reservations.filter(r => r.vehicle_number === vehicle);
        const pickupCount = allVehicleReservations.filter(r => String(r.sht_category || '').toLowerCase() === 'pickup').length;
        const dropoffCount = allVehicleReservations.filter(r => {
            const c = String(r.sht_category || '').toLowerCase();
            return c === 'drop-off' || c === 'dropoff';
        }).length;
        // 전체예약은 좌석번호가 All인 경우만 카운트
        const allCount = allVehicleReservations.filter(r => String(r.seat_number || '').toLowerCase() === 'all').length;

        return {
            vehicle,
            totalSeats,
            reservedSeats,
            availableSeats,
            occupancyRate,
            hasAllReservation,
            pickupCount,
            dropoffCount,
            allCount
        };
    });

    if (loading) {
        return (
            <ManagerLayout title="스하차량 관리" activeTab="sht-car">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">스하차량 정보를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="스하차량 관리" activeTab="sht-car">
            <div className="space-y-6">
                {/* 컨트롤 패널 */}
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
                                {selectedDate.toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    ...(viewMode === 'day' && { day: 'numeric' })
                                })}
                            </h2>

                            {viewMode === 'day' && (
                                <button
                                    onClick={() => setSelectedDate(new Date())}
                                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 text-sm font-medium hover:bg-blue-100"
                                >
                                    오늘
                                </button>
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
                                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                                일간
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                                주간
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                                월간
                            </button>
                        </div>
                    </div>

                    {/* 구분/차량/보기 필터 - 한 행에 배치 */}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex gap-2 items-center">
                            <Filter className="w-5 h-5 text-gray-600" />
                            <span className="text-sm text-gray-600">구분:</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    전체
                                </button>
                                <button
                                    onClick={() => setSelectedCategory('pickup')}
                                    className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedCategory === 'pickup' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    픽업
                                </button>
                                <button
                                    onClick={() => setSelectedCategory('dropoff')}
                                    className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedCategory === 'dropoff' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    드랍
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 items-center">
                            <span className="text-sm text-gray-600">차량:</span>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setSelectedVehicle('all')}
                                    className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedVehicle === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                >
                                    전체 차량
                                </button>
                                {vehicles.map(vehicle => (
                                    <button
                                        key={vehicle}
                                        onClick={() => setSelectedVehicle(vehicle)}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedVehicle === vehicle ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                        {vehicle}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 items-center">
                            <span className="text-sm text-gray-600">보기:</span>
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setDisplayMode('card')}
                                    className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center gap-2 ${displayMode === 'card'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                    카드
                                </button>
                                <button
                                    onClick={() => setDisplayMode('table')}
                                    className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center gap-2 ${displayMode === 'table'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <List className="w-4 h-4" />
                                    테이블
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 선택 차량 상세: Pickup / Drop-off 요약 카드 */}
                {selectedVehicle !== 'all' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(['pickup', 'dropoff'] as const).map(cat => {
                            const list = reservations.filter(r => r.vehicle_number === selectedVehicle)
                                .filter(r => {
                                    const rc = String(r.sht_category || '').trim().toLowerCase();
                                    const seatAll = String(r.seat_number || '').trim().toLowerCase() === 'all';
                                    if (seatAll) return true; // 전체예약은 항상 포함
                                    return cat === 'pickup' ? rc === 'pickup' : (rc === 'dropoff' || rc === 'drop-off');
                                });
                            const seatChips: string[] = [];
                            const hasAll = list.some(r => String(r.seat_number || '').trim().toLowerCase() === 'all');
                            if (hasAll) {
                                seatChips.push('All');
                            } else {
                                const set = new Set<string>();
                                list.forEach(r => String(r.seat_number || '')
                                    .split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s))
                                );
                                seatChips.push(...Array.from(set));
                            }

                            // 해당 카테고리의 위치 정보 수집
                            const locations = list.map(r => ({
                                pickup: r.pickup_location,
                                dropoff: r.dropoff_location,
                                pier: r.pier_location,
                                cruise: r.cruise_name
                            })).filter(loc => loc.pickup || loc.dropoff || loc.pier);

                            return (
                                <div key={cat} className="bg-white rounded-lg shadow-md p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-base font-semibold flex items-center gap-2">
                                            {cat === 'pickup' ? 'Pickup 좌석' : 'Drop-off 좌석'}
                                        </h3>
                                        <button
                                            onClick={() => openSeatMap(selectedVehicle, cat)}
                                            className={`px-2 py-1 rounded text-xs ${cat === 'pickup' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                                        >좌석도</button>
                                    </div>

                                    {/* 좌석 정보 */}
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {seatChips.length === 0 ? (
                                            <span className="text-xs text-gray-500">좌석 없음</span>
                                        ) : (
                                            seatChips.map((s) => (
                                                <span key={s} className={`px-2 py-1 rounded-full text-xs ${s === 'All' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{s}</span>
                                            ))
                                        )}
                                    </div>

                                    {/* 위치 정보 */}
                                    {locations.length > 0 && (
                                        <div className="space-y-2 text-xs">
                                            {locations[0].pickup && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-green-500" />
                                                    <span className="text-gray-600">승차:</span>
                                                    <span className="text-gray-800">{locations[0].pickup}</span>
                                                </div>
                                            )}
                                            {locations[0].dropoff && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-red-500" />
                                                    <span className="text-gray-600">하차:</span>
                                                    <span className="text-gray-800">{locations[0].dropoff}</span>
                                                </div>
                                            )}
                                            {(locations[0].cruise || locations[0].pier) && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-blue-500" />
                                                    <span className="text-gray-600">선착장:</span>
                                                    <span className="text-gray-800">{locations[0].cruise || locations[0].pier}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 차량별 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {vehicleStats.map(stat => (
                        <div key={stat.vehicle} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Car className="w-5 h-5 text-blue-600" />
                                    {stat.vehicle}
                                </h3>
                                <button
                                    onClick={() => openSeatMap(stat.vehicle)}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="좌석 배치도 보기"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {stat.hasAllReservation && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                            <span className="text-sm font-medium text-purple-700">전체 예약됨</span>
                                        </div>
                                        <p className="text-xs text-purple-600 mt-1">이 차량은 단독으로 예약되었습니다.</p>
                                    </div>
                                )}

                                {/* 카테고리 카운트 배지 */}
                                <div className="flex gap-2 text-xs flex-wrap">
                                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Pickup {stat.pickupCount}</span>
                                    <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Drop-off {stat.dropoffCount}</span>
                                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700">All {stat.allCount}</span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">예약됨:</span>
                                    <span className="font-semibold text-red-600">{stat.reservedSeats}석</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">예약 가능:</span>
                                    <span className="font-semibold text-blue-600">{stat.availableSeats}석</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">점유율:</span>
                                    <span className="font-semibold">{stat.occupancyRate}%</span>
                                </div>

                                {/* 점유율 바 */}
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${stat.hasAllReservation ? 'bg-purple-500' :
                                            stat.occupancyRate >= 80 ? 'bg-red-500' :
                                                stat.occupancyRate >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${stat.occupancyRate}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 예약 목록 */}
                <div className="bg-white rounded-lg shadow-md">
                    <div className="p-6 border-b">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="w-6 h-6 text-blue-600" />
                            스하차량 예약 현황 ({filteredReservations.length}건)
                        </h3>
                    </div>

                    {filteredReservations.length === 0 ? (
                        <div className="p-8 text-center">
                            <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-600 mb-2">
                                예약된 스하차량이 없습니다
                            </h3>
                            <p className="text-gray-500">선택한 기간에 예약된 차량이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedReservations)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([date, dateReservations]) => (
                                    <div key={date} className="border-b border-gray-200 pb-6 last:border-b-0">
                                        <div className="flex items-center gap-3 mb-4 p-4 bg-blue-50 rounded-lg">
                                            <Calendar className="w-5 h-5 text-blue-600" />
                                            <h4 className="text-lg font-semibold text-blue-800">
                                                {new Date(date).toLocaleDateString('ko-KR', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    weekday: 'long'
                                                })}
                                            </h4>
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                                {dateReservations.length}건 예약
                                            </span>
                                        </div>

                                        {displayMode === 'table' ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                차량번호
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                좌석번호
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                구분
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                승차위치
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                하차위치
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                선착장
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                예약자
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                상태
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                액션
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dateReservations.map((reservation) => (
                                                            <tr key={reservation.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {reservation.vehicle_number}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                                                        {reservation.seat_number}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {(() => {
                                                                        const category = String(reservation.sht_category || '').trim().toLowerCase();
                                                                        const isPickup = category === 'pickup';
                                                                        const isDropoff = category === 'drop-off' || category === 'dropoff';
                                                                        const cls = (isPickup || isDropoff)
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : 'bg-gray-100 text-gray-800';
                                                                        const label = isPickup ? '픽업' : (isDropoff ? '드랍' : (reservation.sht_category || '일반'));
                                                                        return (
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
                                                                                {label}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {reservation.pickup_location ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3 text-green-500" />
                                                                            <span>{reservation.pickup_location}</span>
                                                                        </div>
                                                                    ) : '-'
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {reservation.dropoff_location ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3 text-red-500" />
                                                                            <span>{reservation.dropoff_location}</span>
                                                                        </div>
                                                                    ) : '-'
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {(reservation.cruise_name || reservation.pier_location) ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <MapPin className="w-3 h-3 text-blue-500" />
                                                                            <span>{reservation.cruise_name || reservation.pier_location}</span>
                                                                        </div>
                                                                    ) : '-'
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    <div>
                                                                        <div className="font-medium">{reservation.booker_name || '-'}</div>
                                                                        <div className="text-xs text-gray-500">{reservation.booker_email || ''}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.reservation_status)}`}>
                                                                        {getStatusText(reservation.reservation_status)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                                    <button
                                                                        onClick={() => openSeatMap(reservation.vehicle_number, undefined, reservation.usage_date)}
                                                                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                        좌석도
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {dateReservations.map((reservation) => (
                                                    <div key={reservation.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <Car className="w-4 h-4 text-blue-500" />
                                                                <span className="font-medium text-gray-900">{reservation.vehicle_number}</span>
                                                            </div>
                                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                                                {reservation.seat_number}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-2 mb-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm text-gray-500">구분:</span>
                                                                {(() => {
                                                                    const category = String(reservation.sht_category || '').trim().toLowerCase();
                                                                    const isPickup = category === 'pickup';
                                                                    const isDropoff = category === 'drop-off' || category === 'dropoff';
                                                                    const cls = (isPickup || isDropoff)
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-gray-100 text-gray-800';
                                                                    const label = isPickup ? '픽업' : (isDropoff ? '드랍' : (reservation.sht_category || '일반'));
                                                                    return (
                                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
                                                                            {label}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {reservation.pickup_location && (
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="w-3 h-3 text-green-500" />
                                                                    <span className="text-sm text-gray-600">픽업: {reservation.pickup_location}</span>
                                                                </div>
                                                            )}

                                                            {reservation.dropoff_location && (
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="w-3 h-3 text-red-500" />
                                                                    <span className="text-sm text-gray-600">드랍: {reservation.dropoff_location}</span>
                                                                </div>
                                                            )}

                                                            {(reservation.cruise_name || reservation.pier_location) && (
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="w-3 h-3 text-blue-500" />
                                                                    <span className="text-sm text-gray-600">선착장: {reservation.cruise_name || reservation.pier_location}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-gray-900">{reservation.booker_name || '-'}</span>
                                                                <span className="text-xs text-gray-500">{reservation.booker_email || ''}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.reservation_status)}`}>
                                                                    {getStatusText(reservation.reservation_status)}
                                                                </span>
                                                                <button
                                                                    onClick={() => openSeatMap(reservation.vehicle_number, undefined, reservation.usage_date)}
                                                                    className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 좌석 배치도 모달 */}
            <ShtCarSeatMap
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                selectedDate={selectedDate}
                vehicleNumber={mapVehicle}
                // categoryFilter는 all / pickup / dropoff 허용
                categoryFilter={selectedCategory}
            />
        </ManagerLayout>
    );
}
