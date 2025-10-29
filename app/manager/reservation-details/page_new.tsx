'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ManagerLayout from '@/components/ManagerLayout';
import supabase from '@/lib/supabase';
import ReservationDetailModal from '@/components/ReservationDetailModal';
import {
    Calendar,
    Ship,
    Plane,
    Building,
    MapPin,
    Car,
    Search,
    Eye,
    Mail,
    FileText,
} from 'lucide-react';

export default function ManagerReservationDetailsPage() {
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedReservation, setSelectedReservation] = useState<any>(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        loadReservationDetails();
    }, []);

    const loadReservationDetails = useCallback(async () => {
        try {
            setLoading(true);

            // 1) reservations 조회
            const { data: reservations, error: reservationsError } = await supabase
                .from('reservation')
                .select('*')
                .order('re_created_at', { ascending: false });

            if (reservationsError) {
                console.error('reservations 조회 실패:', reservationsError);
                setReservations([]);
                setLoading(false);
                return;
            }

            if (!reservations || reservations.length === 0) {
                setReservations([]);
                setLoading(false);
                return;
            }

            // 2) 사용자 정보 일괄 조회 (service-tables와 동일한 방식)
            const userIds = Array.from(new Set(reservations.map((r: any) => r.re_user_id).filter(Boolean)));
            let userMap: Record<string, any> = {};
            if (userIds.length) {
                const { data: users, error: userErr } = await supabase
                    .from('users')
                    .select('id, name, email, phone_number')
                    .in('id', userIds);

                if (userErr) {
                    console.warn('사용자 조회 실패:', userErr.message || userErr);
                } else if (users) {
                    userMap = (users as any[]).reduce((acc, u) => {
                        acc[u.id] = {
                            id: u.id,
                            name: u.name || (u.email ? u.email.split('@')[0] : '사용자'),
                            email: u.email,
                            phone: u.phone_number || '',
                        };
                        return acc;
                    }, {} as Record<string, any>);
                }
            }

            // 3) 서비스 상세 정보 조회
            const cruiseIds = reservations.filter((r) => r.re_type === 'cruise').map((r) => r.re_id);
            const cruiseCarIds = reservations.filter((r) => r.re_type === 'cruise_car').map((r) => r.re_id);
            const shtCarIds = reservations.filter((r) => r.re_type === 'sht_car').map((r) => r.re_id);
            const airportIds = reservations.filter((r) => r.re_type === 'airport').map((r) => r.re_id);
            const hotelIds = reservations.filter((r) => r.re_type === 'hotel').map((r) => r.re_id);
            const tourIds = reservations.filter((r) => r.re_type === 'tour').map((r) => r.re_id);
            const rentcarIds = reservations.filter((r) => r.re_type === 'rentcar').map((r) => r.re_id);
            const carIds = reservations.filter((r) => r.re_type === 'car').map((r) => r.re_id);

            const [cruiseRes, cruiseCarRes, shtCarRes, airportRes, hotelRes, tourRes, rentcarRes, carRes] =
                await Promise.all([
                    cruiseIds.length
                        ? supabase.from('reservation_cruise').select('*').in('reservation_id', cruiseIds)
                        : Promise.resolve({ data: [], error: null }),
                    cruiseCarIds.length
                        ? supabase.from('reservation_cruise_car').select('*').in('reservation_id', cruiseCarIds)
                        : Promise.resolve({ data: [], error: null }),
                    shtCarIds.length
                        ? supabase.from('reservation_sht_car').select('*').in('reservation_id', shtCarIds)
                        : Promise.resolve({ data: [], error: null }),
                    airportIds.length
                        ? supabase.from('reservation_airport').select('*').in('reservation_id', airportIds)
                        : Promise.resolve({ data: [], error: null }),
                    hotelIds.length
                        ? supabase.from('reservation_hotel').select('*').in('reservation_id', hotelIds)
                        : Promise.resolve({ data: [], error: null }),
                    tourIds.length
                        ? supabase.from('reservation_tour').select('*').in('reservation_id', tourIds)
                        : Promise.resolve({ data: [], error: null }),
                    rentcarIds.length
                        ? supabase.from('reservation_rentcar').select('*').in('reservation_id', rentcarIds)
                        : Promise.resolve({ data: [], error: null }),
                    carIds.length
                        ? supabase.from('reservation_car_sht').select('*').in('reservation_id', carIds)
                        : Promise.resolve({ data: [], error: null }),
                ]);

            // 서비스별 맵 생성
            const cruiseMap = new Map((cruiseRes.data || []).map((r: any) => [r.reservation_id, r]));
            const cruiseCarMap = new Map((cruiseCarRes.data || []).map((r: any) => [r.reservation_id, r]));
            const shtCarMap = new Map((shtCarRes.data || []).map((r: any) => [r.reservation_id, r]));
            const airportMap = new Map((airportRes.data || []).map((r: any) => [r.reservation_id, r]));
            const hotelMap = new Map((hotelRes.data || []).map((r: any) => [r.reservation_id, r]));
            const tourMap = new Map((tourRes.data || []).map((r: any) => [r.reservation_id, r]));
            const rentcarMap = new Map((rentcarRes.data || []).map((r: any) => [r.reservation_id, r]));
            const carMap = new Map((carRes.data || []).map((r: any) => [r.reservation_id, r]));

            // 4) 데이터 병합
            const detailedReservations = reservations.map((reservation) => {
                let serviceDetails: any = null;
                switch (reservation.re_type) {
                    case 'cruise':
                        serviceDetails = cruiseMap.get(reservation.re_id) || null;
                        break;
                    case 'cruise_car':
                        serviceDetails = cruiseCarMap.get(reservation.re_id) || null;
                        break;
                    case 'sht_car':
                        serviceDetails = shtCarMap.get(reservation.re_id) || null;
                        break;
                    case 'airport':
                        serviceDetails = airportMap.get(reservation.re_id) || null;
                        break;
                    case 'hotel':
                        serviceDetails = hotelMap.get(reservation.re_id) || null;
                        break;
                    case 'tour':
                        serviceDetails = tourMap.get(reservation.re_id) || null;
                        break;
                    case 'rentcar':
                        serviceDetails = rentcarMap.get(reservation.re_id) || null;
                        break;
                    case 'car':
                        serviceDetails = carMap.get(reservation.re_id) || null;
                        break;
                }

                // service-tables와 동일한 방식으로 사용자 정보 연결
                const user = userMap[reservation.re_user_id];

                return {
                    ...reservation,
                    users: user || undefined,
                    service_details: serviceDetails,
                };
            });

            setReservations(detailedReservations);
        } catch (error) {
            console.error('예약 상세 정보 로딩 실패:', error);
            setReservations([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const getServiceIcon = (type: string) => {
        switch (type) {
            case 'cruise':
                return <Ship className="w-5 h-5 text-blue-600" />;
            case 'cruise_car':
                return <Car className="w-5 h-5 text-blue-400" />;
            case 'sht_car':
                return <Car className="w-5 h-5 text-cyan-600" />;
            case 'airport':
                return <Plane className="w-5 h-5 text-green-600" />;
            case 'hotel':
                return <Building className="w-5 h-5 text-purple-600" />;
            case 'tour':
                return <MapPin className="w-5 h-5 text-orange-600" />;
            case 'rentcar':
                return <Car className="w-5 h-5 text-red-600" />;
            case 'car':
                return <Car className="w-5 h-5 text-amber-600" />;
            default:
                return <FileText className="w-5 h-5 text-gray-600" />;
        }
    };

    const getServiceName = (type: string) => {
        switch (type) {
            case 'cruise':
                return '크루즈';
            case 'cruise_car':
                return '크루즈 차량';
            case 'sht_car':
                return 'SHT 차량';
            case 'airport':
                return '공항 픽업/드롭';
            case 'hotel':
                return '호텔';
            case 'tour':
                return '투어';
            case 'rentcar':
                return '렌터카';
            case 'car':
                return '차량';
            default:
                return '기타';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return '대기';
            case 'confirmed':
                return '확정';
            case 'cancelled':
                return '취소';
            case 'completed':
                return '완료';
            default:
                return status;
        }
    };

    // 날짜별 그룹화 (생성일 기준)
    const getReservationDate = (reservation: any) => {
        return new Date(reservation.re_created_at);
    };

    const groupByReservationDate = (items: any[]) => {
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
            const date = getReservationDate(item).toISOString().slice(0, 10);
            if (!groups[date]) groups[date] = [];
            groups[date].push(item);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a)); // 최신 순
        return sortedKeys.map(key => ({
            date: key,
            items: groups[key]
        }));
    };

    const handleViewDetails = (reservation: any) => {
        setSelectedReservation(reservation);
        setShowDetails(true);
    };

    // 필터링된 예약 목록
    const filteredReservations = reservations.filter(reservation => {
        // 상태 필터
        if (statusFilter !== 'all' && reservation.re_status !== statusFilter) {
            return false;
        }

        // 타입 필터
        if (typeFilter !== 'all' && reservation.re_type !== typeFilter) {
            return false;
        }

        // 검색어 필터
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const userName = reservation.users?.name?.toLowerCase() || '';
            const userEmail = reservation.users?.email?.toLowerCase() || '';
            const reservationId = reservation.re_id.toLowerCase();

            if (!userName.includes(query) && !userEmail.includes(query) && !reservationId.includes(query)) {
                return false;
            }
        }

        return true;
    });

    if (loading) {
        return (
            <ManagerLayout title="예약 상세 정보" activeTab="reservation-details">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">예약 정보를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="예약 상세 정보" activeTab="reservation-details">
            <div className="space-y-6">
                {/* 검색 및 필터 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* 검색 */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="고객명, 이메일, 예약ID로 검색..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 상태 필터 */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'all', label: '전체', color: 'bg-gray-100 text-gray-700 border-gray-300', active: 'bg-gray-500 text-white border-gray-700' },
                                { value: 'pending', label: '대기', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', active: 'bg-yellow-500 text-white border-yellow-700' },
                                { value: 'confirmed', label: '확정', color: 'bg-green-50 text-green-700 border-green-200', active: 'bg-green-500 text-white border-green-700' },
                                { value: 'cancelled', label: '취소', color: 'bg-red-50 text-red-700 border-red-200', active: 'bg-red-500 text-white border-red-700' },
                                { value: 'completed', label: '완료', color: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-500 text-white border-blue-700' },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={`px-3 py-1 rounded text-xs font-semibold border transition-all duration-150 whitespace-nowrap text-center min-w-[60px]
                                        ${statusFilter === item.value ? item.active : item.color}
                                    `}
                                    onClick={() => setStatusFilter(item.value)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* 타입 필터 */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'all', label: '전체', color: 'bg-gray-100 text-gray-700 border-gray-300', active: 'bg-gray-500 text-white border-gray-700' },
                                { value: 'cruise', label: '크루즈', color: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-500 text-white border-blue-700' },
                                { value: 'cruise_car', label: '크루즈 차량', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', active: 'bg-cyan-500 text-white border-cyan-700' },
                                { value: 'sht_car', label: '스하차량', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-500 text-white border-indigo-700' },
                                { value: 'airport', label: '공항', color: 'bg-green-50 text-green-700 border-green-200', active: 'bg-green-500 text-white border-green-700' },
                                { value: 'hotel', label: '호텔', color: 'bg-purple-50 text-purple-700 border-purple-200', active: 'bg-purple-500 text-white border-purple-700' },
                                { value: 'tour', label: '투어', color: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-700' },
                                { value: 'rentcar', label: '렌터카', color: 'bg-red-50 text-red-700 border-red-200', active: 'bg-red-500 text-white border-red-700' },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={`px-3 py-1 rounded text-xs font-semibold border transition-all duration-150 whitespace-nowrap text-center min-w-[60px]
                                        ${typeFilter === item.value ? item.active : item.color}
                                    `}
                                    onClick={() => setTypeFilter(item.value)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 예약 목록 */}
                <div className="bg-white rounded-lg shadow-md">
                    <div className="p-6 border-b">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-6 h-6 text-blue-600" />
                            예약 목록 ({filteredReservations.length}건)
                        </h3>
                    </div>

                    {filteredReservations.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-600 mb-2">예약 정보가 없습니다</h3>
                            <p className="text-gray-500">검색 조건을 변경해보세요.</p>
                        </div>
                    ) : (
                        (() => {
                            const groups = groupByReservationDate(filteredReservations);
                            return (
                                <div className="space-y-6 p-6">
                                    {groups.map((g: any) => (
                                        <div key={g.date}>
                                            <div className="bg-blue-50 px-4 py-2 rounded-t-lg flex items-center gap-4">
                                                <Calendar className="w-4 h-4 text-blue-600" />
                                                <span className="font-semibold text-blue-900">{new Date(g.date).toLocaleDateString('ko-KR')}</span>
                                                <span className="ml-2 text-xs text-gray-500">총 {g.items.length}건</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                                {g.items.map((reservation: any) => (
                                                    <div key={reservation.re_id} className="border rounded-lg p-4 bg-white hover:shadow-md transition-all">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start gap-3 flex-1">
                                                                {getServiceIcon(reservation.re_type)}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <h4 className="font-semibold text-sm">
                                                                            {getServiceName(reservation.re_type)}
                                                                        </h4>
                                                                        <span
                                                                            className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                                                                                reservation.re_status,
                                                                            )}`}
                                                                        >
                                                                            {getStatusText(reservation.re_status)}
                                                                        </span>
                                                                    </div>

                                                                    <div className="space-y-1 text-xs text-gray-600">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-medium">고객:</span>
                                                                            <span>
                                                                                {reservation.users?.name || '이름 없음'}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1">
                                                                            <Mail className="w-3 h-3" />
                                                                            <span>
                                                                                {reservation.users?.email || '이메일 없음'}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            <span>{new Date(reservation.re_created_at).toLocaleDateString('ko-KR')}</span>
                                                                        </div>

                                                                        <div className="text-blue-600">
                                                                            ID: {reservation.re_id.slice(0, 8)}...
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                className="text-xs px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
                                                                onClick={() => handleViewDetails(reservation)}
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                                상세보기
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>

                {/* 예약 상세 모달 */}
                <ReservationDetailModal
                    isOpen={showDetails}
                    onClose={() => setShowDetails(false)}
                    reservation={selectedReservation}
                    title={
                        selectedReservation
                            ? `${getServiceName(selectedReservation.re_type)} 예약 상세정보`
                            : '예약 상세 정보'
                    }
                />
            </div>
        </ManagerLayout>
    );
}
