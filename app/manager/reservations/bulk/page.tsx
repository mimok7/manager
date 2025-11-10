"use client";

import React, { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import ManagerLayout from '@/components/ManagerLayout';
import {
    CheckSquare,
    Square,
    ArrowLeft,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Edit,
    Trash2,
    AlertTriangle,
    Users,
    Eye,
    X
} from 'lucide-react';

interface ServiceReservation {
    re_id: string;
    re_type: string;
    re_status: string;
}

interface ReservationItem {
    re_quote_id: string | null;
    re_created_at: string;
    users: {
        id: string;
        name: string;
        email: string;
        phone: string;
        english_name?: string;
    } | null;
    quote: {
        title: string;
    } | null;
    services: ServiceReservation[];
}

type BulkAction = 'confirm' | 'cancel' | 'delete' | 'status_update';


export default function BulkReservationPage() {
    const router = useRouter();
    const [reservations, setReservations] = useState<ReservationItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('pending');
    const [serviceFilter, setServiceFilter] = useState<string>('all');
    const [bulkAction, setBulkAction] = useState<BulkAction>('confirm');
    const [newStatus, setNewStatus] = useState<string>('confirmed');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchTrigger, setSearchTrigger] = useState<number>(0); // 검색 버튼 클릭용
    const [viewingReservation, setViewingReservation] = useState<ReservationItem | null>(null);
    const [reservationDetails, setReservationDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        loadReservations();
    }, [filter, serviceFilter, searchTrigger]);

    const loadReservations = async () => {
        try {
            setLoading(true);

            // 매니저 권한 확인
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!userData || !['manager', 'admin'].includes(userData.role)) {
                alert('매니저 권한이 필요합니다.');
                router.push('/');
                return;
            }

            // 1) 예약 데이터 조회 (기본 컬럼만)
            let baseQuery = supabase
                .from('reservation')
                .select('re_id, re_type, re_status, re_created_at, re_quote_id, re_user_id')
                .order('re_created_at', { ascending: false });

            if (filter !== 'all') {
                baseQuery = baseQuery.eq('re_status', filter);
            }

            if (serviceFilter !== 'all') {
                baseQuery = baseQuery.eq('re_type', serviceFilter);
            }

            const { data: reservationsRows, error: reservationsError } = await baseQuery;
            if (reservationsError) throw reservationsError;

            const rows = reservationsRows || [];


            // 2) robust 사용자/견적 정보 매핑 (reservations/page.tsx 참고)
            const userIds = Array.from(new Set(rows.map((r: any) => r.re_user_id).filter(Boolean)));
            const quoteIds = Array.from(new Set(rows.map((r: any) => r.re_quote_id).filter(Boolean)));

            // 사용자 정보 robust하게 조회 및 맵 생성
            let usersRes: any = { data: [], error: null };
            if (userIds.length > 0) {
                // 개별 조회 (fallback)
                const userDataPromises = userIds.map(async (userId) => {
                    const { data: singleUser, error: singleError } = await supabase
                        .from('users')
                        .select('id, name, email, phone_number, english_name')
                        .eq('id', userId)
                        .maybeSingle();
                    if (singleError) return null;
                    return singleUser;
                });
                const individualUsers = await Promise.all(userDataPromises);
                const validUsers = individualUsers.filter(user => user !== null);

                // 배치 조회도 병행
                usersRes = await supabase
                    .from('users')
                    .select('id, name, email, phone_number, english_name')
                    .in('id', userIds);
                if (validUsers.length > 0) {
                    usersRes.data = validUsers;
                    usersRes.error = null;
                }
            }
            // robust userMap
            const userMap = new Map<string, { id: string; name: string; email: string; phone_number: string; english_name?: string }>();
            (usersRes.data || []).forEach((u: any) => {
                if (u && u.id) {
                    userMap.set(u.id, {
                        id: u.id,
                        name: u.name || u.email?.split('@')[0] || `사용자_${u.id.substring(0, 8)}`,
                        email: u.email || '이메일 없음',
                        phone_number: u.phone_number || '',
                        english_name: u.english_name || undefined,
                    });
                }
            });

            // 견적 정보
            let quotesById: Record<string, any> = {};
            if (quoteIds.length > 0) {
                const { data: quotesData } = await supabase
                    .from('quote')
                    .select('id, title')
                    .in('id', quoteIds);
                (quotesData || []).forEach((q: any) => { quotesById[q.id] = q; });
            }

            // robust 최종 목록 구성
            let rawList = rows.map((r: any) => {
                // robust 사용자 정보
                let userInfo = r.re_user_id ? userMap.get(r.re_user_id) : null;
                let finalUserInfo: { id: string; name: string; email: string; phone: string; english_name?: string } | null = null;

                if (userInfo) {
                    finalUserInfo = {
                        id: userInfo.id,
                        name: userInfo.name,
                        email: userInfo.email,
                        phone: (userInfo as any).phone_number || '',
                        english_name: (userInfo as any).english_name,
                    };
                } else if (r.re_user_id) {
                    // 실시간 fallback 조회
                    finalUserInfo = {
                        id: r.re_user_id,
                        name: `데이터 없음_${r.re_user_id.substring(0, 8)}`,
                        email: '조회 실패',
                        phone: '',
                    };
                }

                return {
                    re_id: r.re_id,
                    re_type: r.re_type,
                    re_status: r.re_status,
                    re_created_at: r.re_created_at,
                    re_quote_id: r.re_quote_id,
                    users: finalUserInfo,
                    quote: r.re_quote_id ? (quotesById[r.re_quote_id] || null) : null,
                };
            });

            // 추가 보정: 일부 예약에서 quote가 누락된 경우
            const missingQuoteIds = Array.from(new Set(rawList.filter(it => it.re_quote_id && !it.quote).map(it => it.re_quote_id!)));
            if (missingQuoteIds.length > 0) {
                try {
                    const { data: moreQuotes } = await supabase
                        .from('quote')
                        .select('id, title')
                        .in('id', missingQuoteIds);
                    (moreQuotes || []).forEach((q: any) => { quotesById[q.id] = q; });
                    rawList = rawList.map(it => ({ ...it, quote: it.re_quote_id ? (it.quote || quotesById[it.re_quote_id] || null) : null }));
                } catch (e) {
                    // 무시하고 기존 rawList 사용
                }
            }

            // quote_id별로 그룹화
            const groupedByQuote: Record<string, ReservationItem> = {};

            rawList.forEach((r: any) => {
                const groupKey = r.re_quote_id || r.re_id; // quote_id가 없으면 re_id를 키로 사용

                if (!groupedByQuote[groupKey]) {
                    // 새로운 그룹 생성
                    groupedByQuote[groupKey] = {
                        re_quote_id: r.re_quote_id,
                        re_created_at: r.re_created_at,
                        users: r.users,
                        quote: r.quote,
                        services: []
                    };
                }

                // 서비스 추가
                groupedByQuote[groupKey].services.push({
                    re_id: r.re_id,
                    re_type: r.re_type,
                    re_status: r.re_status
                });
            });

            let list: ReservationItem[] = Object.values(groupedByQuote);

            // 이름/이메일 통합 검색 필터
            const q = searchQuery.trim().toLowerCase();
            if (q) {
                list = list.filter(item => {
                    const user = item.users;
                    return (
                        (user?.name && user.name.toLowerCase().includes(q)) ||
                        (user?.email && user.email.toLowerCase().includes(q))
                    );
                });
            }

            console.log('✅ 예약 데이터 로드/머지 완료:', list.length, '개 그룹 (총', rows.length, '개 서비스)');
            setReservations(list);
            setSelectedItems(new Set()); // 선택 초기화
            setError(null);

        } catch (error) {
            console.error('예약 목록 로드 실패:', error);
            setError('예약 목록을 불러오는 중 오류가 발생했습니다.');
            setReservations([]);
            setSelectedItems(new Set());
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        const allServiceIds = reservations.flatMap(r => r.services.map(s => s.re_id));
        if (selectedItems.size === allServiceIds.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(allServiceIds));
        }
    };

    const handleSelectItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    const handleViewDetails = async (reservation: ReservationItem) => {
        setViewingReservation(reservation);
        setDetailsLoading(true);
        setReservationDetails(null);

        try {
            let allDetails: any = {};

            // 모든 서비스에 대해 상세 정보 조회
            for (const service of reservation.services) {
                const reId = service.re_id;
                const reType = service.re_type;

                let details: any = {};

                // 서비스 타입별로 상세 정보 조회
                switch (reType) {
                    case 'cruise':
                        const { data: cruiseData, error: cruiseError } = await supabase
                            .from('reservation_cruise')
                            .select('*')
                            .eq('reservation_id', reId)
                            .single();

                        if (cruiseError) {
                            console.error('크루즈 데이터 조회 오류:', cruiseError);
                        }
                        console.log('크루즈 데이터:', cruiseData);

                        const { data: cruiseCarData, error: carError } = await supabase
                            .from('reservation_cruise_car')
                            .select('*')
                            .eq('reservation_id', reId);

                        if (carError) {
                            console.error('크루즈 차량 데이터 조회 오류:', carError);
                        }
                        console.log('크루즈 차량 데이터:', cruiseCarData);

                        // room_price_code로 크루즈명, 객실명, 카테고리 조회
                        let roomPriceInfo = null;
                        if (cruiseData?.room_price_code) {
                            console.log('room_price_code:', cruiseData.room_price_code);

                            // room_code로 조회 시도
                            const { data: roomPrice, error: roomPriceError } = await supabase
                                .from('room_price')
                                .select('cruise, room_type, room_category, schedule')
                                .eq('room_code', cruiseData.room_price_code)
                                .maybeSingle();

                            if (roomPriceError) {
                                console.error('room_price 조회 오류 (room_code):', roomPriceError);
                            }

                            if (roomPrice) {
                                roomPriceInfo = roomPrice;
                                console.log('room_price 정보 (room_code):', roomPriceInfo);
                            } else {
                                // room_code로 찾지 못했을 경우, 다른 컬럼으로 시도
                                console.log('room_code로 찾지 못함, 대체 검색 시도');
                                const { data: roomPriceAlt } = await supabase
                                    .from('room_price')
                                    .select('cruise, room_type, room_category, schedule, room_code')
                                    .limit(10);
                                console.log('room_price 샘플 데이터:', roomPriceAlt);
                            }
                        } else {
                            console.log('room_price_code가 없음');
                        }

                        // car_price_code로 차량명 조회
                        let carPriceInfos: any[] = [];
                        if (cruiseCarData && cruiseCarData.length > 0) {
                            for (const car of cruiseCarData) {
                                if (car.car_price_code) {
                                    console.log('car_price_code:', car.car_price_code);
                                    const { data: carPrice, error: carPriceError } = await supabase
                                        .from('car_price')
                                        .select('cruise, car_type, car_category')
                                        .eq('car_code', car.car_price_code)
                                        .maybeSingle();

                                    if (carPriceError) {
                                        console.error('car_price 조회 오류:', carPriceError);
                                    }
                                    console.log('car_price 정보:', carPrice);
                                    carPriceInfos.push({ ...car, priceInfo: carPrice });
                                } else {
                                    carPriceInfos.push({ ...car, priceInfo: null });
                                }
                            }
                        }

                        details = {
                            cruise: { ...cruiseData, roomPriceInfo },
                            cars: carPriceInfos
                        };
                        console.log('최종 크루즈 details:', details);
                        break;

                    case 'airport':
                        const { data: airportData, error: airportError } = await supabase
                            .from('reservation_airport')
                            .select('*')
                            .eq('reservation_id', reId)
                            .single();

                        if (airportError) {
                            console.error('공항 데이터 조회 오류:', airportError);
                        }
                        console.log('공항 데이터:', airportData);

                        // airport_price_code로 공항 서비스 상세 정보 조회
                        let airportPriceInfo = null;
                        if (airportData?.airport_price_code) {
                            console.log('airport_price_code:', airportData.airport_price_code);
                            const { data: airportPrice, error: airportPriceError } = await supabase
                                .from('airport_price')
                                .select('*')
                                .eq('airport_code', airportData.airport_price_code)
                                .maybeSingle();

                            if (airportPriceError) {
                                console.error('airport_price 조회 오류:', airportPriceError);
                            }
                            console.log('airport_price 정보:', airportPrice);
                            airportPriceInfo = airportPrice;
                        }

                        details = { airport: { ...airportData, airportPriceInfo } };
                        break;

                    case 'hotel':
                        const { data: hotelData, error: hotelError } = await supabase
                            .from('reservation_hotel')
                            .select('*')
                            .eq('reservation_id', reId)
                            .single();

                        if (hotelError) {
                            console.error('호텔 데이터 조회 오류:', hotelError);
                        }
                        console.log('호텔 데이터:', hotelData);

                        // hotel_price_code로 호텔 상세 정보 조회
                        let hotelPriceInfo = null;
                        if (hotelData?.hotel_price_code) {
                            console.log('hotel_price_code:', hotelData.hotel_price_code);
                            const { data: hotelPrice, error: hotelPriceError } = await supabase
                                .from('hotel_price')
                                .select('*')
                                .eq('hotel_code', hotelData.hotel_price_code)
                                .maybeSingle();

                            if (hotelPriceError) {
                                console.error('hotel_price 조회 오류:', hotelPriceError);
                            }
                            console.log('hotel_price 정보:', hotelPrice);
                            hotelPriceInfo = hotelPrice;
                        }

                        details = { hotel: { ...hotelData, hotelPriceInfo } };
                        break;

                    case 'tour':
                        const { data: tourData, error: tourError } = await supabase
                            .from('reservation_tour')
                            .select('*')
                            .eq('reservation_id', reId)
                            .single();

                        if (tourError) {
                            console.error('투어 데이터 조회 오류:', tourError);
                        }
                        console.log('투어 데이터:', tourData);

                        // tour_price_code로 투어 상세 정보 조회
                        let tourPriceInfo = null;
                        if (tourData?.tour_price_code) {
                            console.log('tour_price_code:', tourData.tour_price_code);
                            const { data: tourPrice, error: tourPriceError } = await supabase
                                .from('tour_price')
                                .select('*')
                                .eq('tour_code', tourData.tour_price_code)
                                .maybeSingle();

                            if (tourPriceError) {
                                console.error('tour_price 조회 오류:', tourPriceError);
                            }
                            console.log('tour_price 정보:', tourPrice);
                            tourPriceInfo = tourPrice;
                        }

                        details = { tour: { ...tourData, tourPriceInfo } };
                        break;

                    case 'rentcar':
                        const { data: rentcarData, error: rentcarError } = await supabase
                            .from('reservation_rentcar')
                            .select('*')
                            .eq('reservation_id', reId)
                            .single();

                        if (rentcarError) {
                            console.error('렌터카 데이터 조회 오류:', rentcarError);
                        }
                        console.log('렌터카 데이터:', rentcarData);

                        // rentcar_price_code로 렌터카 상세 정보 조회
                        let rentcarPriceInfo = null;
                        if (rentcarData?.rentcar_price_code) {
                            console.log('rentcar_price_code:', rentcarData.rentcar_price_code);
                            const { data: rentcarPrice, error: rentcarPriceError } = await supabase
                                .from('rentcar_price')
                                .select('*')
                                .eq('rentcar_code', rentcarData.rentcar_price_code)
                                .maybeSingle();

                            if (rentcarPriceError) {
                                console.error('rentcar_price 조회 오류:', rentcarPriceError);
                            }
                            console.log('rentcar_price 정보:', rentcarPrice);
                            rentcarPriceInfo = rentcarPrice;
                        }

                        details = { rentcar: { ...rentcarData, rentcarPriceInfo } };
                        break;
                }

                // 각 서비스 상세 정보를 allDetails에 저장
                if (!allDetails[reType]) {
                    allDetails[reType] = [];
                }
                allDetails[reType].push({ ...details, service });
            }

            setReservationDetails(allDetails);
        } catch (error) {
            console.error('예약 상세 정보 로드 실패:', error);
            setReservationDetails({ error: '상세 정보를 불러올 수 없습니다.' });
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetailsModal = () => {
        setViewingReservation(null);
        setReservationDetails(null);
    };

    const handleBulkAction = async () => {
        if (selectedItems.size === 0) {
            alert('처리할 항목을 선택해주세요.');
            return;
        }

        const actionText = {
            confirm: '확정',
            cancel: '취소',
            delete: '삭제',
            status_update: '상태 변경'
        }[bulkAction];

        if (!confirm(`선택한 ${selectedItems.size}건의 예약을 ${actionText} 처리하시겠습니까?`)) {
            return;
        }

        setProcessing(true);

        try {
            const selectedIds = Array.from(selectedItems);

            switch (bulkAction) {
                case 'confirm':
                    await supabase
                        .from('reservation')
                        .update({ re_status: 'confirmed' })
                        .in('re_id', selectedIds);
                    break;

                case 'cancel':
                    await supabase
                        .from('reservation')
                        .update({ re_status: 'cancelled' })
                        .in('re_id', selectedIds);
                    break;

                case 'delete':
                    await supabase
                        .from('reservation')
                        .delete()
                        .in('re_id', selectedIds);
                    break;

                case 'status_update':
                    await supabase
                        .from('reservation')
                        .update({ re_status: newStatus })
                        .in('re_id', selectedIds);
                    break;
            }

            alert(`${selectedItems.size}건의 예약이 성공적으로 ${actionText} 처리되었습니다.`);
            setSelectedItems(new Set());
            loadReservations(); // 목록 새로고침

        } catch (error) {
            console.error(' 처리 실패:', error);
            alert(' 처리 중 오류가 발생했습니다.');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'confirmed': return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'cancelled': return <XCircle className="w-4 h-4 text-red-600" />;
            default: return <Clock className="w-4 h-4 text-yellow-600" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return '대기중';
            case 'confirmed': return '확정';
            case 'cancelled': return '취소됨';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'cruise': return '크루즈';
            case 'airport': return '공항';
            case 'hotel': return '호텔';
            case 'tour': return '투어';
            case 'rentcar': return '렌터카';
            default: return type;
        }
    };

    if (loading) {
        return (
            <ManagerLayout title=" 처리" activeTab="reservations">
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">예약 목록을 불러오는 중...</p>
                    </div>
                </div>
            </ManagerLayout>
        );
    }

    return (
        <ManagerLayout title="예약  처리" activeTab="reservations">
            <div className="space-y-6">

                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/manager/reservations')}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Edit className="w-7 h-7 text-green-600" />
                                예약 변경 및 처리
                            </h1>
                            <p className="text-gray-600 mt-1">여러 예약을 변경하거나 처리합니다.</p>
                        </div>
                    </div>

                    <button
                        onClick={loadReservations}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        title="새로고림"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        ⚠️ {error}
                    </div>
                )}

                {/* 필터 및  작업 컨트롤 */}
                <div className="bg-white rounded-lg shadow-md p-6">

                    <div className="flex flex-col md:flex-row md:items-end md:gap-6 gap-2 mb-4 w-full">
                        <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4 flex-1">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value as any)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg min-w-[110px]"
                                >
                                    <option value="all">전체 예약</option>
                                    <option value="pending">대기중</option>
                                    <option value="confirmed">확정</option>
                                    <option value="cancelled">취소</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">서비스</label>
                                <select
                                    value={serviceFilter}
                                    onChange={(e) => setServiceFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg min-w-[110px]"
                                >
                                    <option value="all">전체</option>
                                    <option value="cruise">크루즈</option>
                                    <option value="airport">공항</option>
                                    <option value="hotel">호텔</option>
                                    <option value="tour">투어</option>
                                    <option value="rentcar">렌터카</option>
                                </select>
                            </div>
                            <form
                                onSubmit={e => { e.preventDefault(); setSearchTrigger(v => v + 1); }}
                                className="flex gap-2 items-end"
                                style={{ minWidth: 0 }}
                            >
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">이름/이메일</label>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="이름 또는 이메일 입력"
                                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px]"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                                    style={{ height: 40, marginTop: 18 }}
                                >검색</button>
                            </form>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">작업</label>
                                <select
                                    value={bulkAction}
                                    onChange={(e) => setBulkAction(e.target.value as BulkAction)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg min-w-[110px]"
                                >
                                    <option value="confirm"> 확정</option>
                                    <option value="cancel"> 취소</option>
                                    <option value="status_update">상태 변경</option>
                                    <option value="delete"> 삭제</option>
                                </select>
                            </div>
                            {bulkAction === 'status_update' && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">새 상태</label>
                                    <select
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[110px]"
                                    >
                                        <option value="pending">대기중</option>
                                        <option value="confirmed">확정</option>
                                        <option value="cancelled">취소</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end min-w-[120px]">
                            <button
                                onClick={handleBulkAction}
                                disabled={selectedItems.size === 0 || processing}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors w-full ${selectedItems.size === 0
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : bulkAction === 'delete'
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                {processing ? '처리 중...' :
                                    selectedItems.size === 0 ? '항목 선택 필요' :
                                        `${selectedItems.size}건 처리`}
                            </button>
                            <p className="text-xs text-gray-500 mt-2">총 {reservations.length}건 / 선택 {selectedItems.size}건</p>
                        </div>
                    </div>

                    {/* 삭제 경고 */}
                    {bulkAction === 'delete' && selectedItems.size > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-medium">주의:</span>
                                <span>삭제된 예약은 복구할 수 없습니다.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 예약 목록 */}
                <div className="bg-white rounded-lg shadow-md">
                    <div className="p-6 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">예약 목록</h3>
                            <button
                                onClick={handleSelectAll}
                                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                {selectedItems.size === reservations.length ? (
                                    <CheckSquare className="w-4 h-4" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                전체 선택
                            </button>
                        </div>
                    </div>

                    {reservations.length === 0 ? (
                        <div className="p-8 text-center">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-600 mb-2">
                                {filter === 'all' ? '예약이 없습니다' : `${getStatusText(filter)} 예약이 없습니다`}
                            </h3>
                        </div>
                    ) : (
                        <div className="max-h-[70vh] overflow-y-auto">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                                {reservations.map((reservation) => {
                                    const allServiceIds = reservation.services.map(s => s.re_id);
                                    const isSelected = allServiceIds.some(id => selectedItems.has(id));

                                    return (
                                        <div
                                            key={reservation.re_quote_id || reservation.services[0]?.re_id}
                                            className={`p-4 bg-white rounded-lg shadow-sm transition-all transform ${isSelected ? 'ring-2 ring-blue-300' : 'border border-gray-100'} hover:shadow-md hover:-translate-y-0.5`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <button
                                                    onClick={() => {
                                                        // 모든 서비스 선택/해제
                                                        const newSelected = new Set(selectedItems);
                                                        if (isSelected) {
                                                            allServiceIds.forEach(id => newSelected.delete(id));
                                                        } else {
                                                            allServiceIds.forEach(id => newSelected.add(id));
                                                        }
                                                        setSelectedItems(newSelected);
                                                    }}
                                                    className="p-1 hover:bg-gray-100 rounded mt-1"
                                                    aria-label="선택"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-h-[120px]">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap gap-1 mb-2">
                                                                {reservation.services.map((service, idx) => (
                                                                    <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                                        {getTypeName(service.re_type)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <div className="mt-1 text-sm space-y-1">
                                                                <div className="text-sm text-gray-700 truncate">
                                                                    <span className="text-xs text-gray-500">고객명:</span>
                                                                    <span className="ml-2 font-semibold text-base text-gray-900">{reservation.users?.name || 'N/A'}</span>
                                                                </div>
                                                                <div className="text-sm text-gray-600 truncate">
                                                                    <span className="text-xs text-gray-500">여행명:</span>
                                                                    <span className="ml-2 italic">{reservation.quote?.title || 'N/A'}</span>
                                                                </div>
                                                                <div className="text-sm text-gray-600 truncate">
                                                                    <span className="text-xs text-gray-500">이메일:</span>
                                                                    <span className="ml-2">{reservation.users?.email || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right flex flex-col items-end gap-2">
                                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                                {reservation.services.length}개 서비스
                                                            </span>
                                                            <button
                                                                onClick={() => handleViewDetails(reservation)}
                                                                className="p-1.5 hover:bg-blue-50 rounded-full transition-colors"
                                                                title="상세보기"
                                                            >
                                                                <Eye className="w-4 h-4 text-blue-600" />
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/manager/reservation-edit?quote_id=${reservation.re_quote_id}`)}
                                                                className="p-1.5 hover:bg-green-50 rounded-full transition-colors"
                                                                title="수정하기"
                                                            >
                                                                <Edit className="w-4 h-4 text-green-600" />
                                                            </button>
                                                            <div className="text-xs text-gray-400">{new Date(reservation.re_created_at).toLocaleDateString('ko-KR')}</div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-1 text-sm text-gray-600">
                                                        <div className="text-sm text-gray-500">
                                                            <span className="text-xs text-gray-500">영문이름:</span>
                                                            <span className="ml-2 text-gray-700">{reservation.users?.english_name || (reservation.users?.email ? reservation.users.email.split('@')[0] : 'N/A')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 상세보기 모달 */}
                {viewingReservation && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            {/* 모달 헤더 */}
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">
                                        예약 상세 정보 ({viewingReservation.services.length}개 서비스)
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {viewingReservation.users?.name} • {viewingReservation.quote?.title}
                                    </p>
                                </div>
                                <button
                                    onClick={closeDetailsModal}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* 모달 내용 */}
                            <div className="p-6">
                                {detailsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                                            <p className="text-gray-600">상세 정보를 불러오는 중...</p>
                                        </div>
                                    </div>
                                ) : reservationDetails?.error ? (
                                    <div className="text-center py-12">
                                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                        <p className="text-red-600">{reservationDetails.error}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* 기본 정보 */}
                                        <div>
                                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-blue-600" />
                                                기본 정보
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                                <div>
                                                    <span className="text-sm text-gray-500">서비스 개수:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.services.length}개</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500">고객명:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.users?.name}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500">영문명:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.users?.english_name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500">이메일:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.users?.email}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500">전화번호:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.users?.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-500">예약일:</span>
                                                    <p className="font-medium text-gray-900">
                                                        {new Date(viewingReservation.re_created_at).toLocaleString('ko-KR')}
                                                    </p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-sm text-gray-500">여행명:</span>
                                                    <p className="font-medium text-gray-900">{viewingReservation.quote?.title}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 서비스별 상세 정보 */}
                                        {!reservationDetails?.error && reservationDetails && (() => {
                                            // 서비스 순서 정의 (크루즈부터 역순)
                                            const serviceOrder = ['cruise', 'rentcar', 'tour', 'hotel', 'airport'];
                                            const sortedEntries = Object.entries(reservationDetails).sort(([typeA], [typeB]) => {
                                                const indexA = serviceOrder.indexOf(typeA);
                                                const indexB = serviceOrder.indexOf(typeB);
                                                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                                            });

                                            return sortedEntries.map(([serviceType, serviceDataArray]: [string, any]) => (
                                                <div key={serviceType}>
                                                    {Array.isArray(serviceDataArray) && serviceDataArray.map((serviceData: any, idx: number) => {
                                                        const service = serviceData.service;

                                                        return (
                                                            <div key={idx} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500 mb-4">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <h4 className="font-semibold text-gray-900 text-lg">
                                                                        {getTypeName(service.re_type)} 서비스
                                                                    </h4>
                                                                    <div className={`inline-flex items-center px-3 py-1 rounded text-sm ${getStatusColor(service.re_status)}`}>
                                                                        {getStatusText(service.re_status)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm text-gray-600 mb-4">
                                                                    예약 ID: <span className="font-mono">{service.re_id}</span>
                                                                </div>

                                                                {/* 크루즈 상세 정보 */}
                                                                {serviceType === 'cruise' && serviceData.cruise && (
                                                                    <div className="space-y-4">
                                                                        {/* 디버그 정보 */}
                                                                        {!serviceData.cruise.roomPriceInfo && serviceData.cruise.room_price_code && (
                                                                            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded text-sm">
                                                                                ⚠️ room_price 정보를 찾을 수 없습니다. (코드: {serviceData.cruise.room_price_code})
                                                                            </div>
                                                                        )}

                                                                        <div className="bg-blue-50 p-4 rounded-lg">
                                                                            <h5 className="font-semibold text-gray-900 mb-3">객실 정보</h5>
                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                {serviceData.cruise.roomPriceInfo ? (
                                                                                    <>
                                                                                        <div>
                                                                                            <span className="text-sm text-gray-600">크루즈명:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.cruise.roomPriceInfo.cruise || 'N/A'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-sm text-gray-600">객실 타입:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.cruise.roomPriceInfo.room_type || 'N/A'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-sm text-gray-600">객실 카테고리:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.cruise.roomPriceInfo.room_category || 'N/A'}</p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-sm text-gray-600">일정:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.cruise.roomPriceInfo.schedule || 'N/A'}</p>
                                                                                        </div>
                                                                                    </>
                                                                                ) : null}
                                                                                {serviceData.cruise.room_price_code && (
                                                                                    <div>
                                                                                        <span className="text-sm text-gray-600">객실 가격 코드:</span>
                                                                                        <p className="font-medium text-gray-900">{serviceData.cruise.room_price_code}</p>
                                                                                    </div>
                                                                                )}
                                                                                {serviceData.cruise.checkin && (
                                                                                    <div>
                                                                                        <span className="text-sm text-gray-600">체크인:</span>
                                                                                        <p className="font-medium text-gray-900">{serviceData.cruise.checkin}</p>
                                                                                    </div>
                                                                                )}
                                                                                {serviceData.cruise.checkout && (
                                                                                    <div>
                                                                                        <span className="text-sm text-gray-600">체크아웃:</span>
                                                                                        <p className="font-medium text-gray-900">{serviceData.cruise.checkout}</p>
                                                                                    </div>
                                                                                )}
                                                                                {serviceData.cruise.guest_count && (
                                                                                    <div>
                                                                                        <span className="text-sm text-gray-600">투숙객 수:</span>
                                                                                        <p className="font-medium text-gray-900">{serviceData.cruise.guest_count}명</p>
                                                                                    </div>
                                                                                )}
                                                                                {serviceData.cruise.room_total_price !== null && serviceData.cruise.room_total_price !== undefined && (
                                                                                    <div>
                                                                                        <span className="text-sm text-gray-600">객실 총액:</span>
                                                                                        <p className="font-medium text-blue-600">{serviceData.cruise.room_total_price?.toLocaleString()}동</p>
                                                                                    </div>
                                                                                )}
                                                                                {serviceData.cruise.reservation_id && (
                                                                                    <div className="col-span-2">
                                                                                        <span className="text-sm text-gray-600">예약 ID:</span>
                                                                                        <p className="font-medium text-gray-900 font-mono text-xs">{serviceData.cruise.reservation_id}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {serviceData.cruise.request_note && (
                                                                                <div className="mt-3">
                                                                                    <span className="text-sm text-gray-600">요청사항:</span>
                                                                                    <p className="text-gray-900 mt-1 whitespace-pre-wrap">{serviceData.cruise.request_note}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* 차량 정보 */}
                                                                        {serviceData.cars && serviceData.cars.length > 0 && (
                                                                            <div className="bg-green-50 p-4 rounded-lg">
                                                                                <h5 className="font-semibold text-gray-900 mb-3">차량 정보 ({serviceData.cars.length}대)</h5>
                                                                                {serviceData.cars.map((car: any, carIdx: number) => (
                                                                                    <div key={carIdx} className="bg-white p-3 rounded mb-2 last:mb-0">
                                                                                        <div className="grid grid-cols-2 gap-2">
                                                                                            {car.priceInfo && (
                                                                                                <>
                                                                                                    <div>
                                                                                                        <span className="text-sm text-gray-600">크루즈:</span>
                                                                                                        <p className="font-medium text-gray-900">{car.priceInfo.cruise || 'N/A'}</p>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <span className="text-sm text-gray-600">차량 타입:</span>
                                                                                                        <p className="font-medium text-gray-900">{car.priceInfo.car_type || 'N/A'}</p>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <span className="text-sm text-gray-600">차량 카테고리:</span>
                                                                                                        <p className="font-medium text-gray-900">{car.priceInfo.car_category || 'N/A'}</p>
                                                                                                    </div>
                                                                                                </>
                                                                                            )}
                                                                                            {car.car_price_code && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">차량 가격 코드:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.car_price_code}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.vehicle_number && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">차량번호:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.vehicle_number}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.seat_number && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">좌석수:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.seat_number}인승</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.color_label && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">색상:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.color_label}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.boarding_assist && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">승선보조:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.boarding_assist}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.pickup_location && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">픽업 위치:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.pickup_location}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.dropoff_location && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">하차 위치:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.dropoff_location}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.passenger_count && (
                                                                                                <div>
                                                                                                    <span className="text-sm text-gray-600">탑승 인원:</span>
                                                                                                    <p className="font-medium text-gray-900">{car.passenger_count}명</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {car.reservation_cruise_car_id && (
                                                                                                <div className="col-span-2">
                                                                                                    <span className="text-sm text-gray-600">차량 예약 ID:</span>
                                                                                                    <p className="font-medium text-gray-900 font-mono text-xs">{car.reservation_cruise_car_id}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* 공항 상세 정보 */}
                                                                {serviceType === 'airport' && serviceData.airport && (
                                                                    <div className="bg-purple-50 p-4 rounded-lg">
                                                                        <h5 className="font-semibold text-gray-900 mb-3">공항 서비스 정보</h5>

                                                                        {/* 가격 테이블 정보 */}
                                                                        {serviceData.airport.airportPriceInfo && (
                                                                            <div className="bg-white p-3 rounded-lg mb-3">
                                                                                <h6 className="font-medium text-gray-800 mb-2">가격 정보</h6>
                                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                    {serviceData.airport.airportPriceInfo.category && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">카테고리:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.airport.airportPriceInfo.category}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.airport.airportPriceInfo.route && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">경로:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.airport.airportPriceInfo.route}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.airport.airportPriceInfo.vehicle_type && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">차량:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.airport.airportPriceInfo.vehicle_type}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.airport.airportPriceInfo.price !== null && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">가격:</span>
                                                                                            <p className="font-medium text-blue-600">{serviceData.airport.airportPriceInfo.price?.toLocaleString()}동</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {serviceData.airport.airport_price_code && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">가격 코드:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.airport_price_code}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_airport_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">공항:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_airport_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_flight_number && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">항공편:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_flight_number}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_datetime && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">일시:</span>
                                                                                    <p className="font-medium text-gray-900">
                                                                                        {new Date(serviceData.airport.ra_datetime).toLocaleString('ko-KR')}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_passenger_count && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">승객 수:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_passenger_count}명</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_pickup_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">픽업 위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_pickup_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_dropoff_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">하차 위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_dropoff_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_service_type && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">서비스 타입:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_service_type}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.ra_vehicle_type && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">차량 타입:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.airport.ra_vehicle_type}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.airport.reservation_id && (
                                                                                <div className="col-span-2">
                                                                                    <span className="text-sm text-gray-600">예약 ID:</span>
                                                                                    <p className="font-medium text-gray-900 font-mono text-xs">{serviceData.airport.reservation_id}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {serviceData.airport.ra_request_note && (
                                                                            <div className="mt-3">
                                                                                <span className="text-sm text-gray-600">요청사항:</span>
                                                                                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{serviceData.airport.ra_request_note}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* 호텔 상세 정보 */}
                                                                {serviceType === 'hotel' && serviceData.hotel && (
                                                                    <div className="bg-pink-50 p-4 rounded-lg">
                                                                        <h5 className="font-semibold text-gray-900 mb-3">호텔 정보</h5>

                                                                        {/* 가격 테이블 정보 */}
                                                                        {serviceData.hotel.hotelPriceInfo && (
                                                                            <div className="bg-white p-3 rounded-lg mb-3">
                                                                                <h6 className="font-medium text-gray-800 mb-2">가격 정보</h6>
                                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                    {serviceData.hotel.hotelPriceInfo.hotel_name && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">호텔명:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.hotel.hotelPriceInfo.hotel_name}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.hotel.hotelPriceInfo.room_type && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">객실 타입:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.hotel.hotelPriceInfo.room_type}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.hotel.hotelPriceInfo.location && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">위치:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.hotel.hotelPriceInfo.location}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.hotel.hotelPriceInfo.price !== null && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">가격:</span>
                                                                                            <p className="font-medium text-blue-600">{serviceData.hotel.hotelPriceInfo.price?.toLocaleString()}동</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {serviceData.hotel.hotel_price_code && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">가격 코드:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.hotel_price_code}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.hotel_name && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">호텔명:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.hotel_name}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.room_type && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">객실 타입:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.room_type}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.checkin_date && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">체크인:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.checkin_date}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.checkout_date && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">체크아웃:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.checkout_date}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.nights && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">숙박일:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.nights}박</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.guest_count && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">투숙객 수:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.guest_count}명</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.hotel_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.hotel.hotel_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.total_price !== null && serviceData.hotel.total_price !== undefined && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">총 가격:</span>
                                                                                    <p className="font-medium text-blue-600">{serviceData.hotel.total_price?.toLocaleString()}동</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.hotel.reservation_id && (
                                                                                <div className="col-span-2">
                                                                                    <span className="text-sm text-gray-600">예약 ID:</span>
                                                                                    <p className="font-medium text-gray-900 font-mono text-xs">{serviceData.hotel.reservation_id}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {serviceData.hotel.request_note && (
                                                                            <div className="mt-3">
                                                                                <span className="text-sm text-gray-600">요청사항:</span>
                                                                                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{serviceData.hotel.request_note}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* 투어 상세 정보 */}
                                                                {serviceType === 'tour' && serviceData.tour && (
                                                                    <div className="bg-orange-50 p-4 rounded-lg">
                                                                        <h5 className="font-semibold text-gray-900 mb-3">투어 정보</h5>

                                                                        {/* 가격 테이블 정보 */}
                                                                        {serviceData.tour.tourPriceInfo && (
                                                                            <div className="bg-white p-3 rounded-lg mb-3">
                                                                                <h6 className="font-medium text-gray-800 mb-2">가격 정보</h6>
                                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                    {serviceData.tour.tourPriceInfo.tour_name && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">투어명:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.tour.tourPriceInfo.tour_name}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.tour.tourPriceInfo.tour_type && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">투어 타입:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.tour.tourPriceInfo.tour_type}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.tour.tourPriceInfo.location && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">위치:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.tour.tourPriceInfo.location}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.tour.tourPriceInfo.duration && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">소요 시간:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.tour.tourPriceInfo.duration}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.tour.tourPriceInfo.price !== null && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">가격:</span>
                                                                                            <p className="font-medium text-blue-600">{serviceData.tour.tourPriceInfo.price?.toLocaleString()}동</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {serviceData.tour.tour_price_code && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">가격 코드:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.tour_price_code}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.tour_name && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">투어명:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.tour_name}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.tour_date && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">투어 날짜:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.tour_date}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.participant_count && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">참가자 수:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.participant_count}명</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.pickup_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">픽업 위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.pickup_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.tour_duration && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">투어 기간:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.tour_duration}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.tour_type && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">투어 타입:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.tour.tour_type}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.total_price !== null && serviceData.tour.total_price !== undefined && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">총 가격:</span>
                                                                                    <p className="font-medium text-blue-600">{serviceData.tour.total_price?.toLocaleString()}동</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.tour.reservation_id && (
                                                                                <div className="col-span-2">
                                                                                    <span className="text-sm text-gray-600">예약 ID:</span>
                                                                                    <p className="font-medium text-gray-900 font-mono text-xs">{serviceData.tour.reservation_id}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {serviceData.tour.request_note && (
                                                                            <div className="mt-3">
                                                                                <span className="text-sm text-gray-600">요청사항:</span>
                                                                                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{serviceData.tour.request_note}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* 렌터카 상세 정보 */}
                                                                {serviceType === 'rentcar' && serviceData.rentcar && (
                                                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                                                        <h5 className="font-semibold text-gray-900 mb-3">렌터카 정보</h5>

                                                                        {/* 가격 테이블 정보 */}
                                                                        {serviceData.rentcar.rentcarPriceInfo && (
                                                                            <div className="bg-white p-3 rounded-lg mb-3">
                                                                                <h6 className="font-medium text-gray-800 mb-2">가격 정보</h6>
                                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                    {serviceData.rentcar.rentcarPriceInfo.vehicle_type && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">차량 타입:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.rentcar.rentcarPriceInfo.vehicle_type}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.rentcar.rentcarPriceInfo.vehicle_model && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">차량 모델:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.rentcar.rentcarPriceInfo.vehicle_model}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.rentcar.rentcarPriceInfo.seats && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">좌석수:</span>
                                                                                            <p className="font-medium text-gray-900">{serviceData.rentcar.rentcarPriceInfo.seats}인승</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {serviceData.rentcar.rentcarPriceInfo.price_per_day !== null && (
                                                                                        <div>
                                                                                            <span className="text-gray-600">일일 가격:</span>
                                                                                            <p className="font-medium text-blue-600">{serviceData.rentcar.rentcarPriceInfo.price_per_day?.toLocaleString()}동</p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            {serviceData.rentcar.rentcar_price_code && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">가격 코드:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.rentcar_price_code}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.vehicle_type && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">차량 타입:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.vehicle_type}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.pickup_datetime && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">픽업 일시:</span>
                                                                                    <p className="font-medium text-gray-900">
                                                                                        {new Date(serviceData.rentcar.pickup_datetime).toLocaleString('ko-KR')}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.return_datetime && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">반납 일시:</span>
                                                                                    <p className="font-medium text-gray-900">
                                                                                        {new Date(serviceData.rentcar.return_datetime).toLocaleString('ko-KR')}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.rental_days && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">대여일:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.rental_days}일</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.driver_count && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">운전자 수:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.driver_count}명</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.pickup_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">픽업 위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.pickup_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.return_location && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">반납 위치:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.return_location}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.destination && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">목적지:</span>
                                                                                    <p className="font-medium text-gray-900">{serviceData.rentcar.destination}</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.total_price !== null && serviceData.rentcar.total_price !== undefined && (
                                                                                <div>
                                                                                    <span className="text-sm text-gray-600">총 가격:</span>
                                                                                    <p className="font-medium text-blue-600">{serviceData.rentcar.total_price?.toLocaleString()}동</p>
                                                                                </div>
                                                                            )}
                                                                            {serviceData.rentcar.reservation_id && (
                                                                                <div className="col-span-2">
                                                                                    <span className="text-sm text-gray-600">예약 ID:</span>
                                                                                    <p className="font-medium text-gray-900 font-mono text-xs">{serviceData.rentcar.reservation_id}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {serviceData.rentcar.request_note && (
                                                                            <div className="mt-3">
                                                                                <span className="text-sm text-gray-600">요청사항:</span>
                                                                                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{serviceData.rentcar.request_note}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* 모달 푸터 */}
                            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-between gap-3">
                                <button
                                    onClick={closeDetailsModal}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    닫기
                                </button>
                                <div className="flex gap-2 flex-wrap">
                                    {viewingReservation.services.map((service, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                closeDetailsModal();
                                                router.push(`/manager/reservation-edit/${service.re_type}?id=${service.re_id}`);
                                            }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                        >
                                            <Edit className="w-4 h-4" />
                                            {getTypeName(service.re_type)} 수정
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ManagerLayout>
    );
}
