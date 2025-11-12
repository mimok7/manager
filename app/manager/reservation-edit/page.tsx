'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import {
    Search,
    Edit3,
    Eye,
    Calendar,
    User,
    FileText,
    ArrowRight,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    Mail,
    Phone,
    Car,
    MapPin,
    Ship,
    Plane,
    Building
} from 'lucide-react';

interface ServiceReservation {
    re_id: string;
    re_type: string;
    re_status: string;
    vehicleData?: any;
}

interface ReservationSummary {
    re_quote_id: string | null;
    re_created_at: string;
    users: {
        name: string;
        email: string;
        phone: string;
    } | null;
    quote: {
        title: string;
        status: string;
    } | null;
    services: ServiceReservation[]; // 여러 서비스를 담는 배열
}

function ReservationEditContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [reservations, setReservations] = useState<ReservationSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedReservation, setSelectedReservation] = useState<ReservationSummary | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // URL 파라미터에서 타입 필터 설정
        const type = searchParams.get('type');
        if (type) {
            setTypeFilter(type);
        }

        // URL 파라미터에서 상태 필터 설정
        const status = searchParams.get('status');
        if (status) {
            setStatusFilter(status);
        }

        loadReservations();
    }, [searchParams]);

    // 필터 변경 시 데이터 재로드
    useEffect(() => {
        if (!loading) {
            loadReservations();
        }
    }, [statusFilter, typeFilter]);

    const loadReservations = async () => {
        try {
            console.log('🔄 예약 데이터 로드 시작 (manager_reservations)…');
            setLoading(true);

            // 1) 매니저 전용 뷰에서 기본 목록 조회
            let baseQuery = supabase
                .from('manager_reservations')
                .select('re_id, re_type, re_status, re_created_at, re_quote_id, customer_name, customer_email, customer_phone')
                .order('re_created_at', { ascending: false })
                .limit(200);

            if (statusFilter !== 'all') {
                baseQuery = baseQuery.eq('re_status', statusFilter);
            }
            if (typeFilter !== 'all') {
                baseQuery = baseQuery.eq('re_type', typeFilter);
            }

            const { data: baseRows, error: baseErr } = await baseQuery;
            if (baseErr) {
                console.error('❌ manager_reservations 조회 실패:', baseErr);
                setReservations([]);
                return;
            }

            if (!baseRows || baseRows.length === 0) {
                setReservations([]);
                return;
            }

            // 2) 각 서비스별 차량 데이터를 배치로 조회
            const reservationIds = baseRows.map(r => r.re_id);
            let vehicleDataMap: Record<string, any> = {};

            if (reservationIds.length > 0) {
                // 크루즈 차량 데이터 (기존)
                const { data: cruiseCars, error: cruiseCarErr } = await supabase
                    .from('reservation_cruise_car')
                    .select('reservation_id, car_price_code, car_count, passenger_count, pickup_location, dropoff_location, pickup_datetime')
                    .in('reservation_id', reservationIds);

                if (!cruiseCarErr && cruiseCars) {
                    cruiseCars.forEach(car => {
                        vehicleDataMap[car.reservation_id] = {
                            ...car,
                            service_type: 'cruise',
                            vehicle_type: '차량'
                        };
                    });
                }

                // 공항 차량 데이터 (reservation_airport에 car_count, passenger_count 등이 있음)
                const { data: airportCars, error: airportCarErr } = await supabase
                    .from('reservation_airport')
                    .select('reservation_id, ra_car_count, ra_passenger_count, ra_airport_location, ra_datetime')
                    .in('reservation_id', reservationIds);

                if (!airportCarErr && airportCars) {
                    airportCars.forEach(car => {
                        if (car.ra_car_count && car.ra_car_count > 0) {
                            vehicleDataMap[car.reservation_id] = {
                                reservation_id: car.reservation_id,
                                car_count: car.ra_car_count,
                                passenger_count: car.ra_passenger_count,
                                pickup_location: car.ra_airport_location,
                                pickup_datetime: car.ra_datetime,
                                service_type: 'airport',
                                vehicle_type: '공항 차량'
                            };
                        }
                    });
                }

                // 렌터카 차량 데이터
                const { data: rentcarCars, error: rentcarCarErr } = await supabase
                    .from('reservation_rentcar')
                    .select('reservation_id, car_count, passenger_count, pickup_location, destination, pickup_datetime')
                    .in('reservation_id', reservationIds);

                if (!rentcarCarErr && rentcarCars) {
                    rentcarCars.forEach(car => {
                        if (car.car_count && car.car_count > 0) {
                            vehicleDataMap[car.reservation_id] = {
                                reservation_id: car.reservation_id,
                                car_count: car.car_count,
                                passenger_count: car.passenger_count,
                                pickup_location: car.pickup_location,
                                dropoff_location: car.destination,
                                pickup_datetime: car.pickup_datetime,
                                service_type: 'rentcar',
                                vehicle_type: '렌터카'
                            };
                        }
                    });
                }

                // 투어 차량 데이터
                const { data: tourCars, error: tourCarErr } = await supabase
                    .from('reservation_tour')
                    .select('reservation_id, tour_capacity, pickup_location, dropoff_location, usage_date')
                    .in('reservation_id', reservationIds);

                if (!tourCarErr && tourCars) {
                    tourCars.forEach(car => {
                        if (car.tour_capacity && car.tour_capacity > 0) {
                            vehicleDataMap[car.reservation_id] = {
                                reservation_id: car.reservation_id,
                                car_count: 1, // 투어는 보통 1대
                                passenger_count: car.tour_capacity,
                                pickup_location: car.pickup_location,
                                dropoff_location: car.dropoff_location,
                                pickup_datetime: car.usage_date,
                                service_type: 'tour',
                                vehicle_type: '투어 차량'
                            };
                        }
                    });
                }

                console.log('✅ 차량 데이터 로드 완료:', Object.keys(vehicleDataMap).length, '개 예약에 차량 데이터 있음');
            }

            // 3) quote를 배치로 조회하여 맵 구성
            const quoteIds = baseRows.map(r => r.re_quote_id).filter(Boolean);
            let quoteMap: Record<string, { title: string; status: string }> = {};
            if (quoteIds.length > 0) {
                const { data: quotes, error: quoteErr } = await supabase
                    .from('quote')
                    .select('id, title, status')
                    .in('id', quoteIds as string[]);
                if (!quoteErr && quotes) {
                    quoteMap = quotes.reduce((acc: Record<string, { title: string; status: string }>, q: any) => {
                        acc[q.id] = { title: q.title, status: q.status };
                        return acc;
                    }, {});
                } else if (quoteErr) {
                    console.warn('⚠️ 견적 배치 조회 오류:', quoteErr);
                }
            }

            // 4) quote_id별로 그룹화하여 최종 머지
            const groupedByQuote: Record<string, ReservationSummary> = {};

            baseRows.forEach((r: any) => {
                const groupKey = r.re_quote_id || r.re_id; // quote_id가 없으면 re_id를 키로 사용

                if (!groupedByQuote[groupKey]) {
                    // 새로운 그룹 생성
                    groupedByQuote[groupKey] = {
                        re_quote_id: r.re_quote_id,
                        re_created_at: r.re_created_at,
                        users: {
                            name: r.customer_name,
                            email: r.customer_email,
                            phone: r.customer_phone,
                        },
                        quote: r.re_quote_id && quoteMap[r.re_quote_id]
                            ? { title: quoteMap[r.re_quote_id].title, status: quoteMap[r.re_quote_id].status }
                            : null,
                        services: []
                    };
                }

                // 서비스 추가
                groupedByQuote[groupKey].services.push({
                    re_id: r.re_id,
                    re_type: r.re_type,
                    re_status: r.re_status,
                    vehicleData: vehicleDataMap[r.re_id] || null
                });
            });

            const merged: ReservationSummary[] = Object.values(groupedByQuote);

            console.log('✅ 예약 데이터 로드/머지 완료:', merged.length, '개 그룹 (총', baseRows.length, '개 서비스)');
            setReservations(merged);
        } catch (error) {
            console.error('❌ 예약 목록 로드 실패:', error);
            setReservations([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReservations();
    }, [statusFilter, typeFilter]);

    const filteredReservations = reservations.filter(reservation => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();
        return (
            reservation.users?.name?.toLowerCase().includes(searchLower) ||
            reservation.users?.email?.toLowerCase().includes(searchLower) ||
            reservation.quote?.title?.toLowerCase().includes(searchLower) ||
            reservation.services.some(s =>
                s.re_type.toLowerCase().includes(searchLower) ||
                s.re_status.toLowerCase().includes(searchLower)
            )
        );
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'processing':
                return <AlertTriangle className="w-4 h-4 text-blue-500" />;
            case 'cancelled':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getTypeLabel = (type: string) => {
        const typeMap: { [key: string]: string } = {
            'cruise': '🚢 크루즈',
            'hotel': '🏨 호텔',
            'airport': '✈️ 공항',
            'rentcar': '🚗 렌터카',
            'tour': '🎯 투어',
            'vehicle': '🚙 차량'
        };
        return typeMap[type] || type;
    };

    const getStatusLabel = (status: string) => {
        const statusMap: { [key: string]: string } = {
            'pending': '대기중',
            'confirmed': '확정',
            'processing': '처리중',
            'cancelled': '취소됨',
            'completed': '완료'
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'text-green-600';
            case 'cancelled': return 'text-red-600';
            case 'pending': return 'text-yellow-600';
            case 'processing': return 'text-blue-600';
            case 'completed': return 'text-green-600';
            default: return 'text-gray-600';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'cruise': return <Ship className="w-5 h-5 text-blue-600" />;
            case 'airport': return <Plane className="w-5 h-5 text-green-600" />;
            case 'hotel': return <Building className="w-5 h-5 text-purple-600" />;
            case 'tour': return <MapPin className="w-5 h-5 text-orange-600" />;
            case 'rentcar': return <Car className="w-5 h-5 text-red-600" />;
            case 'vehicle': return <Car className="w-5 h-5 text-red-600" />;
            default: return <Clock className="w-5 h-5 text-gray-600" />;
        }
    };

    // 로딩 상태 처리
    if (loading) {
        return (
            <ManagerLayout title="📝 예약 수정" activeTab="reservation-edit">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">데이터 로드 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="📝 예약 수정" activeTab="reservation-edit">
            <div className="space-y-6">
                {/* 필터 및 검색 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="고객명, 이메일, 여행명으로 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-80"
                                />
                            </div>

                            {/* 상태 필터 버튼 */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm font-medium text-gray-700 px-2 py-2">상태:</span>
                                {['all', 'pending', 'confirmed', 'processing', 'cancelled', 'completed'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-3 py-1 text-sm rounded-full transition-colors ${statusFilter === status
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {status === 'all' ? '전체' : getStatusLabel(status)}
                                    </button>
                                ))}
                            </div>

                            {/* 서비스 타입 필터 버튼 */}
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm font-medium text-gray-700 px-2 py-2">서비스:</span>
                                {['all', 'cruise', 'hotel', 'airport', 'rentcar', 'tour', 'vehicle'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`px-3 py-1 text-sm rounded-full transition-colors ${typeFilter === type
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {type === 'all' ? '전체' : getTypeLabel(type).split(' ')[1]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="text-sm text-gray-600 whitespace-nowrap">
                            총 {filteredReservations.length}개의 예약
                        </div>
                    </div>

                    {/* 현재 필터 표시 */}
                    {(typeFilter !== 'all' || statusFilter !== 'all' || searchTerm) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="text-sm font-medium text-gray-600">현재 필터:</span>
                            {typeFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                                    {getTypeLabel(typeFilter)}
                                    <button
                                        onClick={() => setTypeFilter('all')}
                                        className="ml-1 hover:bg-green-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center"
                                        title="필터 제거"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {statusFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                                    {getStatusLabel(statusFilter)}
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center"
                                        title="필터 제거"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            {searchTerm && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                                    검색: "{searchTerm}"
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5 w-4 h-4 flex items-center justify-center"
                                        title="검색어 제거"
                                    >
                                        ×
                                    </button>
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setStatusFilter('pending'); // 'all'이 아닌 'pending'으로 초기화
                                    setTypeFilter('all');
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded"
                            >
                                필터 초기화 (대기중)
                            </button>
                        </div>
                    )}

                    {/* 예약 목록 카드 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {filteredReservations.length === 0 ? (
                            <div className="col-span-full text-center py-12">
                                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">예약이 없습니다</h3>
                                <p className="text-gray-600">
                                    {searchTerm || statusFilter !== 'pending' || typeFilter !== 'all'
                                        ? '검색 조건에 맞는 예약이 없습니다.'
                                        : '대기중인 예약이 없습니다.'
                                    }
                                </p>
                                <div className="mt-4">
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setStatusFilter('pending');
                                            setTypeFilter('all');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        필터 초기화
                                    </button>
                                </div>
                            </div>
                        ) : (
                            filteredReservations.map((reservation) => (
                                <div key={reservation.re_quote_id || reservation.services[0]?.re_id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    {/* 카드 헤더 */}
                                    <div className="p-4 border-b border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {reservation.services.map((service, idx) => (
                                                    <span key={idx} className="text-lg">{getTypeLabel(service.re_type).split(' ')[0]}</span>
                                                ))}
                                            </div>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                {reservation.services.length}개 서비스
                                            </span>
                                        </div>
                                    </div>

                                    {/* 카드 본문 */}
                                    <div className="p-4 space-y-3">
                                        {/* 고객 정보 */}
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 mb-1">
                                                {reservation.users?.name || '정보 없음'}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                {reservation.users?.email || '이메일 없음'}
                                            </div>
                                        </div>

                                        {/* 여행 정보 */}
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 mb-1">
                                                {reservation.quote?.title || '제목 없음'}
                                            </div>
                                            <div className="text-xs text-gray-500 mb-2">
                                                견적: {reservation.quote?.status || '미확인'}
                                            </div>

                                            {/* 서비스별 정보 표시 */}
                                            <div className="space-y-2">
                                                {reservation.services.map((service, idx) => (
                                                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-medium text-gray-800">
                                                                {getTypeLabel(service.re_type)}
                                                            </span>
                                                            <span className={`text-xs ${getStatusColor(service.re_status)}`}>
                                                                {getStatusLabel(service.re_status)}
                                                            </span>
                                                        </div>
                                                        {service.vehicleData && (
                                                            <div className="text-blue-600">
                                                                🚗 차량: {service.vehicleData.car_count}대, 👥 {service.vehicleData.passenger_count}명
                                                                <br />
                                                                📍 {service.vehicleData.pickup_location}{service.vehicleData.dropoff_location ? ` → ${service.vehicleData.dropoff_location}` : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 예약 상세 정보 */}
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <div>{new Date(reservation.re_created_at).toLocaleDateString('ko-KR')}</div>
                                        </div>
                                    </div>

                                    {/* 카드 푸터 */}
                                    <div className="p-4 border-t border-gray-100">
                                        <div className="flex flex-col gap-2">
                                            {reservation.services.map((service, idx) => (
                                                <div key={idx} className="flex gap-2">
                                                    <button
                                                        onClick={() => router.push(`/manager/reservation-edit/${service.re_type}?id=${service.re_id}`)}
                                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                        {getTypeLabel(service.re_type)} 수정
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    setSelectedReservation(reservation);
                                                    setIsModalOpen(true);
                                                }}
                                                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                            >
                                                <Eye className="w-3 h-3" />
                                                전체 보기
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 예약 상세 정보 모달 */}
                {isModalOpen && selectedReservation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            {/* 모달 헤더 */}
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            {selectedReservation.services.map((service, idx) => (
                                                <div key={idx}>{getTypeIcon(service.re_type)}</div>
                                            ))}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">
                                                예약 상세 정보 ({selectedReservation.services.length}개 서비스)
                                            </h2>
                                            <p className="text-sm text-gray-600">
                                                {selectedReservation.quote?.title || '제목 없음'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-gray-400 hover:text-gray-600 text-2xl"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* 모달 본문 */}
                            <div className="p-6 space-y-6">
                                {/* 예약 기본 정보 */}
                                <div className="bg-white rounded-lg shadow-md p-6">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        예약 기본 정보
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="space-y-2 text-sm">
                                                <div><span className="text-gray-600">서비스 개수:</span> <strong>{selectedReservation.services.length}개</strong></div>
                                                <div><span className="text-gray-600">서비스 타입:</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {selectedReservation.services.map((service, idx) => (
                                                            <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                                {getTypeLabel(service.re_type)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span className="text-gray-600">생성일:</span>
                                                    <strong>{new Date(selectedReservation.re_created_at).toLocaleDateString('ko-KR')}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 고객 정보 */}
                                {selectedReservation.users && (
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <User className="w-5 h-5 text-green-600" /> 고객 정보
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <div className="space-y-2 text-sm">
                                                    <div><span className="text-gray-600">고객명:</span> <strong>{selectedReservation.users.name || '정보 없음'}</strong></div>
                                                    <div className="flex items-center gap-1">
                                                        <Mail className="w-4 h-4 text-gray-500" />
                                                        <span className="text-gray-600">이메일:</span>
                                                        <a href={`mailto:${selectedReservation.users.email}`} className="text-blue-600 hover:underline">
                                                            {selectedReservation.users.email || '이메일 없음'}
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Phone className="w-4 h-4 text-gray-500" />
                                                        <span className="text-gray-600">전화번호:</span>
                                                        <a href={`tel:${selectedReservation.users.phone}`} className="text-blue-600 hover:underline">
                                                            {selectedReservation.users.phone || '전화번호 없음'}
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 여행 정보 */}
                                {selectedReservation.quote && (
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <FileText className="w-6 h-6 text-purple-600" />
                                            연결된 견적 정보
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <span className="text-gray-600 text-sm">견적 제목:</span>
                                                <p className="font-medium">{selectedReservation.quote.title}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-600 text-sm">견적 상태:</span>
                                                <p className="font-medium">{selectedReservation.quote.status}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 서비스별 상세 정보 */}
                                {selectedReservation.services.map((service, idx) => (
                                    <div key={idx} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                {getTypeIcon(service.re_type)}
                                                {getTypeLabel(service.re_type)} 서비스
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(service.re_status)}
                                                <span className={`text-sm font-medium ${getStatusColor(service.re_status)}`}>
                                                    {getStatusLabel(service.re_status)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="text-sm">
                                                <span className="text-gray-600">예약 ID:</span>
                                                <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                    {service.re_id.substring(0, 8)}...
                                                </span>
                                            </div>

                                            {service.vehicleData && (
                                                <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                                                    <div className="font-semibold text-blue-900">차량/이동 정보</div>
                                                    {service.vehicleData.car_price_code && (
                                                        <div><span className="text-gray-700">차량 코드:</span> <strong>{service.vehicleData.car_price_code}</strong></div>
                                                    )}
                                                    <div><span className="text-gray-700">차량 대수:</span> <strong>{service.vehicleData.car_count}대</strong></div>
                                                    <div><span className="text-gray-700">승객 수:</span> <strong>{service.vehicleData.passenger_count}명</strong></div>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4 text-gray-500" />
                                                        <span className="text-gray-700">출발:</span>
                                                        <strong>{service.vehicleData.pickup_location}</strong>
                                                    </div>
                                                    {service.vehicleData.dropoff_location && (
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="w-4 h-4 text-gray-500" />
                                                            <span className="text-gray-700">도착:</span>
                                                            <strong>{service.vehicleData.dropoff_location}</strong>
                                                        </div>
                                                    )}
                                                    {service.vehicleData.pickup_datetime && (
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="w-4 h-4 text-gray-500" />
                                                            <span className="text-gray-700">일시:</span>
                                                            <strong>{new Date(service.vehicleData.pickup_datetime).toLocaleString('ko-KR')}</strong>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="pt-2">
                                                <button
                                                    onClick={() => {
                                                        setIsModalOpen(false);
                                                        router.push(`/manager/reservation-edit/${service.re_type}?id=${service.re_id}`);
                                                    }}
                                                    className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm font-medium"
                                                >
                                                    이 서비스 수정하기
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 모달 푸터 */}
                            <div className="p-6 border-t border-gray-200 bg-gray-50">
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ManagerLayout>
    );
}

export default function ReservationEditPage() {
    return (
        <Suspense fallback={
            <ManagerLayout title="📝 예약 수정" activeTab="reservation-edit">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">페이지를 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        }>
            <ReservationEditContent />
        </Suspense>
    );
}
